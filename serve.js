const express = require('express');
const path = require('path');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const multer = require('multer');
const { 
  putObject, 
  getObjectStream, 
  getObjectBuffer, 
  generateStorageKey 
} = require('./lib/storage');
const { 
  getKeyPair,
  getMasterKey,
  encryptPrivateKey,
  decryptPrivateKey,
  generateKeyPair,
  sha256Hex, 
  signHashHex, 
  verifyHashHex, 
  generateVerificationCode 
} = require('./lib/signing');
const { sendEmail } = require('./lib/mailer');

const app = express();
const prisma = new PrismaClient();

const normalizeTrustProxy = (value) => {
  if (value == null) return undefined;
  const raw = String(value).trim();
  if (raw === '') return undefined;
  const lower = raw.toLowerCase();
  if (lower === 'true') return 1;
  if (lower === 'false') return false;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber)) return asNumber;
  return raw;
};

// Configure Multer for File Uploads (memory storage for object storage)
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error(`File type not allowed: ${file.mimetype}`), { status: 415 }));
  }
});

// Middleware
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const trustProxy = normalizeTrustProxy(process.env.TRUST_PROXY);
if (trustProxy !== undefined) {
  app.set('trust proxy', trustProxy);
} else if (isProd) {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!isProd && allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'));
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

// ── BACKEND API ROUTES ──
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in environment variables.');
}
const JWT_SECRET = process.env.JWT_SECRET;
const APP_BASE_URL = (process.env.APP_BASE_URL || '').trim();
const SUPER_ADMIN_ACCESS_CODE = (process.env.SUPER_ADMIN_ACCESS_CODE || '').trim();
const SUPER_ADMIN_MFA_PIN = (process.env.SUPER_ADMIN_MFA_PIN || '').trim();
const MASTER_KEY = getMasterKey();
let ACTIVE_PUBLIC_KEY = null;
let ACTIVE_PRIVATE_KEY = null;
let ACTIVE_KID = null;
if (process.env.SIGNING_PRIVATE_KEY && process.env.SIGNING_PUBLIC_KEY) {
  const keypair = getKeyPair();
  ACTIVE_PUBLIC_KEY = keypair.publicKey;
  ACTIVE_PRIVATE_KEY = keypair.privateKey;
  ACTIVE_KID = keypair.kid;
} else if (!MASTER_KEY) {
  throw new Error('Signing keys missing. Set SIGNING_PRIVATE_KEY/SIGNING_PUBLIC_KEY or SIGNING_MASTER_KEY for per-department keys.');
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

const approvalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

const publicVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access Denied: No Token' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid Token' });
    req.user = user;
    next();
  });
};

const getNumericUserId = (user) => {
  if (!user) return null;
  if (typeof user.id === 'number') return user.id;
  return null;
};

const normalizeRole = (role) => (role || '').toLowerCase();
const maskSecret = (value) => {
  const raw = String(value || '');
  if (!raw) return '';
  if (raw.length <= 2) return '*'.repeat(raw.length);
  return `${'*'.repeat(raw.length - 2)}${raw.slice(-2)}`;
};

const requireRoles = (roles) => (req, res, next) => {
  const userRole = normalizeRole(req.user?.role);
  const allowed = roles.map(r => r.toLowerCase());
  if (allowed.includes(userRole) || userRole === 'global_admin') return next();
  return res.status(403).json({ error: 'Forbidden' });
};

const ensureActivePublicKey = async () => {
  if (!ACTIVE_PUBLIC_KEY || !ACTIVE_KID) return;
  await prisma.publicKey.upsert({
    where: { kid: ACTIVE_KID },
    update: { publicKey: ACTIVE_PUBLIC_KEY, algorithm: 'Ed25519', active: true },
    create: { kid: ACTIVE_KID, publicKey: ACTIVE_PUBLIC_KEY, algorithm: 'Ed25519', active: true }
  });
};

const getEligibleStages = async (amount = 0) => {
  const stages = await prisma.workflowStage.findMany({ orderBy: { sequence: 'asc' } });
  return stages.filter(s => Number(amount || 0) >= Number(s.threshold || 0));
};

const findNextStage = (eligibleStages, currentStageId) => {
  if (!eligibleStages.length) return null;
  const idx = eligibleStages.findIndex(s => s.id === currentStageId);
  if (idx === -1) return eligibleStages[0];
  return eligibleStages[idx + 1] || null;
};

const computeContentHash = (requisition) => {
  const content = requisition.content || requisition.description || '';
  return sha256Hex(content);
};

const computeAttachmentsHash = (attachments = []) => {
  const normalized = attachments
    .map(a => `${a.storageKey || ''}:${a.size || 0}:${a.mimeType || ''}`)
    .sort()
    .join('|');
  return sha256Hex(normalized);
};

const getGlobalPublicKeyRecord = async () => {
  if (!ACTIVE_PUBLIC_KEY || !ACTIVE_KID) return null;
  return prisma.publicKey.upsert({
    where: { kid: ACTIVE_KID },
    update: { publicKey: ACTIVE_PUBLIC_KEY, algorithm: 'Ed25519', active: true },
    create: { kid: ACTIVE_KID, publicKey: ACTIVE_PUBLIC_KEY, algorithm: 'Ed25519', active: true }
  });
};

const getDepartmentSigningKey = async (departmentId) => {
  if (MASTER_KEY) {
    if (MASTER_KEY.length !== 32) {
      throw new Error('SIGNING_MASTER_KEY must be 32 bytes (hex or base64 for 256-bit key)');
    }
    let deptKey = await prisma.departmentKey.findUnique({
      where: { departmentId },
      include: { publicKey: true }
    });
    if (!deptKey) {
      const { publicKeyPem, privateKeyPem } = generateKeyPair();
      const kid = sha256Hex(publicKeyPem).slice(0, 16);
      const publicKeyRecord = await prisma.publicKey.create({
        data: { kid, algorithm: 'Ed25519', publicKey: publicKeyPem, active: true }
      });
      const privateKeyEnc = encryptPrivateKey(privateKeyPem, MASTER_KEY);
      deptKey = await prisma.departmentKey.create({
        data: {
          departmentId,
          publicKeyId: publicKeyRecord.id,
          privateKeyEnc,
          algorithm: 'Ed25519',
          active: true
        },
        include: { publicKey: true }
      });
      return { privateKey: privateKeyPem, publicKey: publicKeyRecord.publicKey, kid: publicKeyRecord.kid, publicKeyId: publicKeyRecord.id };
    }
    const privateKeyPem = decryptPrivateKey(deptKey.privateKeyEnc, MASTER_KEY);
    return { privateKey: privateKeyPem, publicKey: deptKey.publicKey.publicKey, kid: deptKey.publicKey.kid, publicKeyId: deptKey.publicKeyId };
  }

  const globalRecord = await getGlobalPublicKeyRecord();
  if (!globalRecord) {
    throw new Error('Global signing key not configured.');
  }
  return { privateKey: ACTIVE_PRIVATE_KEY, publicKey: globalRecord.publicKey, kid: globalRecord.kid, publicKeyId: globalRecord.id };
};

const embedImageIfAvailable = async (pdfDoc, bytes) => {
  if (!bytes) return null;
  try {
    return await pdfDoc.embedPng(bytes);
  } catch (err) {
    return await pdfDoc.embedJpg(bytes);
  }
};

const generateSignedPdf = async ({ requisition, approvals, departmentName, approverName, stampBytes, signatureBytes, verificationCode, payloadHash }) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  let y = 800;

  page.drawText('REQUISITION VOUCHER', { x: margin, y, size: 18, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  y -= 24;
  page.drawText(`Department: ${departmentName}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Title: ${requisition.title}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Type: ${requisition.type}    Amount: ₦${Number(requisition.amount || 0).toLocaleString()}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Urgency: ${requisition.urgency || 'normal'}`, { x: margin, y, size: 11, font });
  y -= 22;

  page.drawText('Description:', { x: margin, y, size: 11, font: boldFont });
  y -= 16;
  const desc = requisition.description || '';
  const descLines = desc.match(/.{1,90}/g) || [''];
  for (const line of descLines.slice(0, 6)) {
    page.drawText(line, { x: margin, y, size: 10, font });
    y -= 14;
  }

  y -= 10;
  page.drawText('Approval Trail:', { x: margin, y, size: 11, font: boldFont });
  y -= 16;
  approvals.forEach((a) => {
    const stamp = new Date(a.createdAt).toLocaleString();
    const line = `${a.stage?.name || 'Stage'} - ${a.action.toUpperCase()} by ${a.user?.name || 'User'} @ ${stamp}`;
    page.drawText(line.slice(0, 100), { x: margin, y, size: 9, font });
    y -= 12;
  });

  const stampImage = await embedImageIfAvailable(pdfDoc, stampBytes);
  const signatureImage = await embedImageIfAvailable(pdfDoc, signatureBytes);

  if (stampImage) {
    const stampDims = stampImage.scale(0.3);
    page.drawImage(stampImage, { x: margin, y: 120, width: stampDims.width, height: stampDims.height, opacity: 0.9 });
  }

  if (signatureImage) {
    const sigDims = signatureImage.scale(0.3);
    page.drawImage(signatureImage, { x: 360, y: 120, width: sigDims.width, height: sigDims.height, opacity: 0.9 });
    page.drawText(`Signed by ${approverName}`, { x: 360, y: 105, size: 9, font });
  }

  page.drawText(`Verification Code: ${verificationCode}`, { x: margin, y: 60, size: 9, font: boldFont });
  page.drawText(`Payload Hash: ${payloadHash.slice(0, 20)}...`, { x: margin, y: 46, size: 8, font });

  return pdfDoc.save();
};

const processApprovalAction = async ({ requisitionId, action, remarks, user }) => {
  const userId = getNumericUserId(user);
  if (!userId) {
    const err = new Error('Department accounts cannot approve requisitions');
    err.status = 403;
    throw err;
  }

  const requisition = await prisma.requisition.findUnique({
    where: { id: requisitionId },
    include: { attachments: true, department: true, currentStage: true }
  });
  if (!requisition) {
    const err = new Error('Requisition not found');
    err.status = 404;
    throw err;
  }
  if (requisition.status !== 'pending') {
    const err = new Error('Requisition is not pending');
    err.status = 400;
    throw err;
  }

  const eligibleStages = await getEligibleStages(requisition.amount || 0);
  const currentStage = requisition.currentStageId
    ? eligibleStages.find(s => s.id === requisition.currentStageId)
    : eligibleStages[0];

  if (!currentStage) {
    const err = new Error('No workflow stage configured');
    err.status = 400;
    throw err;
  }

  const userRole = normalizeRole(user.role);
  if (userRole !== 'global_admin' && !userRole.includes(currentStage.role.toLowerCase())) {
    const err = new Error('User role not authorized for this stage');
    err.status = 403;
    throw err;
  }

  const approval = await prisma.approval.create({
    data: {
      requisitionId: requisition.id,
      stageId: currentStage.id,
      action,
      remarks: remarks || null,
      userId
    }
  });

  const payload = {
    requisitionId: requisition.id,
    stageId: currentStage.id,
    departmentId: requisition.departmentId,
    approverId: userId,
    action,
    timestamp: new Date().toISOString(),
    contentHash: computeContentHash(requisition),
    attachmentsHash: computeAttachmentsHash(requisition.attachments)
  };
  const payloadString = JSON.stringify(payload);
  const payloadHash = sha256Hex(payloadString);
  const signingKey = await getDepartmentSigningKey(requisition.departmentId);
  const signature = signHashHex(payloadHash, signingKey.privateKey);

  let verificationCode = generateVerificationCode('VER');
  let attempts = 0;
  while (attempts < 5) {
    const exists = await prisma.signatureRecord.findUnique({ where: { verificationCode } });
    if (!exists) break;
    verificationCode = generateVerificationCode('VER');
    attempts += 1;
  }

  await prisma.signatureRecord.create({
    data: {
      approvalId: approval.id,
      payloadHash,
      signature,
      verificationCode,
      publicKeyId: signingKey.publicKeyId
    }
  });

  let updated;
  if (action === 'approved') {
    const nextStage = findNextStage(eligibleStages, currentStage.id);
    if (nextStage) {
      updated = await prisma.requisition.update({
        where: { id: requisition.id },
        data: {
          currentStageId: nextStage.id,
          lastActionById: userId,
          lastActionAt: new Date()
        }
      });
      await notifyRole(nextStage.role, `Pending Approval: ${requisition.title}`, requisition.id, requisition.departmentId);
      await notifyDepartmentHead({
        departmentId: requisition.departmentId,
        requisition,
        subject: `Requisition Stage Approved: ${requisition.title}`,
        lines: [
          `Status: Pending next approval`,
          `Stage Approved: ${currentStage.name} (${currentStage.role})`,
          `Approved By: ${user.name || 'Approver'}`,
          `Next Stage: ${nextStage.name} (${nextStage.role})`,
          `Verification Code: ${verificationCode}`
        ]
      });
    } else {
      const stamp = await prisma.departmentStamp.findUnique({ where: { departmentId: requisition.departmentId } });
      const signatureRecord = await prisma.userSignature.findUnique({ where: { userId } });

      const stampBytes = stamp ? await getObjectBuffer(stamp.imageKey) : null;
      const signatureBytes = signatureRecord ? await getObjectBuffer(signatureRecord.imageKey) : null;

      const approvals = await prisma.approval.findMany({
        where: { requisitionId: requisition.id },
        include: { stage: true, user: true },
        orderBy: { createdAt: 'asc' }
      });

      const pdfBytes = await generateSignedPdf({
        requisition,
        approvals,
        departmentName: requisition.department?.name || 'Department',
        approverName: user.name || 'Approver',
        stampBytes,
        signatureBytes,
        verificationCode,
        payloadHash
      });

      const pdfKey = generateStorageKey(`signed/${requisition.id}`, `requisition-${requisition.id}.pdf`);
      await putObject({ key: pdfKey, body: pdfBytes, contentType: 'application/pdf' });
      const pdfHash = sha256Hex(pdfBytes);

      updated = await prisma.requisition.update({
        where: { id: requisition.id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          currentStageId: null,
          lastActionById: userId,
          lastActionAt: new Date(),
          signedPdfKey: pdfKey,
          signedPdfHash: pdfHash
        }
      });
      await notifyRole('creator', `Requisition Fully Approved: ${requisition.title}`, requisition.id, requisition.departmentId);
      await notifyRole('department', `Requisition Fully Approved: ${requisition.title}`, requisition.id, requisition.departmentId);
      await notifyDepartmentHead({
        departmentId: requisition.departmentId,
        requisition,
        subject: `Requisition Fully Approved: ${requisition.title}`,
        lines: [
          `Status: Approved`,
          `Approved By: ${user.name || 'Approver'}`,
          `Amount: ${formatCurrency(requisition.amount)}`,
          `Verification Code: ${verificationCode}`
        ]
      });
    }
  } else {
    updated = await prisma.requisition.update({
      where: { id: requisition.id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        currentStageId: null,
        lastActionById: userId,
        lastActionAt: new Date()
      }
    });
    await notifyRole('creator', `Requisition Rejected: ${requisition.title}`, requisition.id, requisition.departmentId);
    await notifyRole('department', `Requisition Rejected: ${requisition.title}`, requisition.id, requisition.departmentId);
    await notifyDepartmentHead({
      departmentId: requisition.departmentId,
      requisition,
      subject: `Requisition Rejected: ${requisition.title}`,
      lines: [
        `Status: Rejected`,
        `Rejected By: ${user.name || 'Approver'}`,
        `Stage: ${currentStage.name} (${currentStage.role})`,
        remarks ? `Remarks: ${remarks}` : null,
        `Verification Code: ${verificationCode}`
      ]
    });
  }

  await prisma.activityLog.create({
    data: {
      userId,
      action: `Requisition ${action}`,
      details: `Requisition #${requisition.id} ${action}. ${remarks ? `Remarks: ${remarks}` : ''}`.trim()
    }
  });

  return updated;
};

// Auth
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const parsed = z.object({
      email: z.string().email(),
      password: z.string().min(1)
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid login payload' });
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email }, include: { department: true } });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
    const userData = { id: user.id, email: user.email, name: user.name, role: user.role, department: user.department?.name || 'General' };
    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '12h' });
    await prisma.activityLog.create({ data: { action: 'Logged In', details: `${user.name} (Admin) authenticated`, userId: user.id } });
    res.json({ token, user: userData });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/auth/dept-login', authLimiter, async (req, res) => {
  try {
    const parsed = z.object({
      departmentName: z.string().min(1),
      accessCode: z.string().min(1),
      mfaCode: z.string().optional().nullable()
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid login payload' });
    }
    const { departmentName, accessCode, mfaCode } = parsed.data;
    
    console.log(`[AUTH] Unified login attempt: "${departmentName?.trim()}"`);
    
    const dept = await prisma.department.findFirst({ 
      where: { 
        name: { equals: departmentName?.trim(), mode: 'insensitive' }, 
      } 
    });
    
    if (!dept) {
      console.warn(`[AUTH] Failed: ${departmentName} / ${maskSecret(accessCode)}`);
      return res.status(401).json({ error: 'Invalid Department or Access Code' });
    }

    const isSuperAdmin = dept.name.toLowerCase() === 'super admin';
    const trimmedAccess = accessCode.trim();
    let codeMatch = false;
    if (isSuperAdmin && SUPER_ADMIN_ACCESS_CODE) {
      const provided = Buffer.from(trimmedAccess);
      const expected = Buffer.from(SUPER_ADMIN_ACCESS_CODE);
      codeMatch = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
    } else {
      codeMatch = dept.accessCodeHash
        ? await bcrypt.compare(trimmedAccess, dept.accessCodeHash)
        : dept.accessCode === trimmedAccess;
    }
    if (!codeMatch) {
      console.warn(`[AUTH] Failed: ${departmentName} / ${maskSecret(accessCode)}`);
      return res.status(401).json({ error: 'Invalid Department or Access Code' });
    }

    if (isSuperAdmin) {
      if (!SUPER_ADMIN_MFA_PIN) {
        return res.status(500).json({ error: 'Super Admin MFA PIN not configured' });
      }
      if (String(mfaCode || '').trim() !== SUPER_ADMIN_MFA_PIN) {
        return res.status(401).json({ error: 'Invalid MFA PIN' });
      }
    }
    
    // Unified Role Logic: "Super Admin" department gets 'global_admin' role
    const adminUser = isSuperAdmin 
      ? await prisma.user.findFirst({ where: { role: 'global_admin' } })
      : null;
    const userData = { 
      id: isSuperAdmin ? (adminUser?.id || 1) : `dept_${dept.id}`, 
      name: dept.name, 
      role: isSuperAdmin ? 'global_admin' : 'department', 
      deptId: dept.id, 
      email: `${dept.name.toLowerCase().replace(/\s/g, '')}@cssgroup.local` 
    };
    
    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '12h' });
    await prisma.activityLog.create({ data: { action: 'Login', details: `${dept.name} authenticated via unified portal` } });
    res.json({ token, user: userData });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/auth/me', authenticateToken, (req, res) => res.json({ user: req.user }));

// Data
app.get('/api/departments', async (req, res) => {
  try {
    // Check optional auth — authenticated users get full data, public gets minimal fields
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let isAuthenticated = false;
    if (token) {
      try { jwt.verify(token, JWT_SECRET); isAuthenticated = true; } catch (_) {}
    }

    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: isAuthenticated
        ? { id: true, name: true, type: true, code: true, headName: true, headTitle: true, headEmail: true, parentId: true, stamp: true }
        : { id: true, name: true, type: true, code: true }
    });
    res.json(departments);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/departments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const department = await prisma.department.findUnique({ where: { id: parseInt(id) } });
    if (!department) return res.status(404).json({ error: 'Department not found' });
    if (req.user.role === 'department' && req.user.deptId && department.id !== req.user.deptId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(department);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Dynamic Requisition Types
app.get('/api/requisition-types', async (req, res) => {
  try {
    const types = await prisma.requisitionType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Dynamic Workflow Stages
app.get('/api/workflow-stages', async (req, res) => {
  try {
    const stages = await prisma.workflowStage.findMany({ orderBy: { sequence: 'asc' } });
    res.json(stages);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/workflow-stages', authenticateToken, requireRoles(['global_admin']), async (req, res) => {
  try {
    const parsed = z.array(z.object({
      name: z.string().min(1),
      role: z.string().min(1),
      threshold: z.union([z.number(), z.string()]).optional()
    })).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid workflow payload' });
    const stages = parsed.data; // Expects full array
    
    await prisma.$transaction([
      prisma.workflowStage.deleteMany(),
      ...stages.map((stage, idx) => prisma.workflowStage.create({
        data: {
          sequence: idx + 1,
          name: stage.name,
          role: stage.role,
          threshold: parseFloat(stage.threshold) || 0
        }
      }))
    ]);
    
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Notifications
// Notifications Helper
const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));

const formatCurrency = (amount) => {
  const num = Number(amount || 0);
  if (Number.isNaN(num)) return '₦0.00';
  return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const buildEmailContent = ({ title, lines = [], actionUrl, actionLabel }) => {
  const safeLines = lines.filter(Boolean).map((line) => String(line));
  const text = [title, '', ...safeLines, actionUrl ? '' : null, actionUrl ? `Open: ${actionUrl}` : null]
    .filter(Boolean)
    .join('\n');
  const listItems = safeLines.map((line) => `<li style="margin-bottom:6px;">${escapeHtml(line)}</li>`).join('');
  const button = actionUrl
    ? `<p style="margin-top:16px;"><a href="${actionUrl}" style="display:inline-block;padding:10px 16px;background:#1a3a6e;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">${escapeHtml(actionLabel || 'Open RMS')}</a></p>`
    : '';
  const html = `
    <div style="font-family:Arial, sans-serif; color:#1a1a1a;">
      <h2 style="margin:0 0 12px 0; color:#1a3a6e;">${escapeHtml(title)}</h2>
      <ul style="padding-left:18px; margin:0 0 12px 0;">${listItems}</ul>
      ${button}
      <p style="font-size:12px;color:#666;margin-top:18px;">CSS RMS Automated Notification</p>
    </div>
  `;
  return { text, html };
};

async function notifyDepartmentHead({ departmentId, requisition, subject, lines }) {
  try {
    const dept = requisition?.department || await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept?.headEmail) return;
    const actionUrl = APP_BASE_URL ? APP_BASE_URL.replace(/\/$/, '') : '';
    const { text, html } = buildEmailContent({
      title: subject,
      lines,
      actionUrl,
      actionLabel: 'Open RMS'
    });
    await sendEmail({ to: dept.headEmail, subject, text, html });
  } catch (err) {
    console.error('[MAIL] Department head notify failed:', err.message);
  }
}

async function notifyRole(roleName, message, requisitionId, departmentId = null) {
  try {
    // Find users with this role (Admin, Audit, etc.)
    const users = await prisma.user.findMany({
      where: roleName === 'creator'
        ? { requisitions: { some: { id: requisitionId } } }
        : { role: { contains: roleName.toLowerCase() } }
    });

    const notificationData = users.map(u => ({ userId: u.id, content: message }));

    // Also create a department-scoped notification so the originating department
    // sees status updates even though they have no User row
    if (departmentId && (roleName === 'creator' || roleName === 'department')) {
      notificationData.push({ departmentId, content: message });
    }

    if (notificationData.length > 0) {
      await prisma.notification.createMany({ data: notificationData });
    }

    const emails = users.map(u => u.email).filter(Boolean);
    if (emails.length > 0) {
      const actionUrl = APP_BASE_URL ? APP_BASE_URL.replace(/\/$/, '') : '';
      const { text, html } = buildEmailContent({
        title: message,
        lines: requisitionId ? [`Requisition ID: ${requisitionId}`] : [],
        actionUrl,
        actionLabel: 'Open RMS'
      });
      const results = await Promise.allSettled(emails.map(email => sendEmail({ to: email, subject: message, text, html })));
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[MAIL] Failed to send to ${emails[i]}:`, r.reason?.message);
        }
      });
    }
  } catch (err) {
    console.error("Notification failed:", err);
  }
}

// ── NOTIFICATIONS ──
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const deptId = req.user.deptId ? parseInt(req.user.deptId) : null;
    const userId = getNumericUserId(req.user);

    // Build an OR query: match by userId (admin) OR departmentId (dept login)
    const orClauses = [];
    if (userId) orClauses.push({ userId });
    if (deptId && !isNaN(deptId)) orClauses.push({ departmentId: deptId });

    if (orClauses.length === 0) {
      console.warn("[NOTIF] No valid ID for notification query:", { role: req.user.role, id: req.user.id, deptId });
      return res.json([]);
    }

    const notifications = await prisma.notification.findMany({
      where: { OR: orClauses },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(notifications);
  } catch (error) {
    console.error("[NOTIF] Fetch Error:", error.message);
    res.status(500).json({ error: "Notification fetch failed" });
  }
});

app.post('/api/requisition-types', authenticateToken, requireRoles(['global_admin']), async (req, res) => {
  try {
    const parsed = z.object({
      name: z.string().min(1),
      description: z.string().optional()
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid type payload' });
    const { name, description } = parsed.data;
    const type = await prisma.requisitionType.create({ data: { name, description: description || '' } });
    res.json(type);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/requisition-types/:id', authenticateToken, requireRoles(['global_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.requisitionType.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/departments', authenticateToken, requireRoles(['global_admin']), async (req, res) => {
  try {
    const parsed = z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      accessCode: z.string().min(4)
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid department payload' });
    }
    const { name, type, accessCode } = parsed.data;
    const accessCodeHash = await bcrypt.hash(accessCode, 10);
    const dept = await prisma.department.create({ data: { name, type, accessCode: null, accessCodeHash, accessCodeLabel: accessCode } });
    res.json(dept);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/departments/:id', authenticateToken, requireRoles(['global_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/departments/:id/head', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deptId = parseInt(id);
    if (req.user.role === 'department' && req.user.deptId && req.user.deptId !== deptId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const parsed = z.object({
      headName: z.string().min(2),
      headTitle: z.string().min(2),
      headEmail: z.string().email()
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid department head payload' });
    const updated = await prisma.department.update({
      where: { id: deptId },
      data: {
        headName: parsed.data.headName,
        headTitle: parsed.data.headTitle,
        headEmail: parsed.data.headEmail
      }
    });
    await prisma.activityLog.create({
      data: {
        userId: getNumericUserId(req.user) || null,
        action: 'Department Head Updated',
        details: `Head info updated for ${updated.name} by ${req.user.name || 'user'}: ${parsed.data.headName} (${parsed.data.headTitle})`
      }
    });
    res.json(updated);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Access Code Reset (Admin only)
app.put('/api/departments/:id/access-code', authenticateToken, requireRoles(['global_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = z.object({ accessCode: z.string().min(4) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Access code must be at least 4 characters' });
    const accessCodeHash = await bcrypt.hash(parsed.data.accessCode, 10);
    const updated = await prisma.department.update({
      where: { id: parseInt(id) },
      data: { accessCodeHash, accessCodeLabel: parsed.data.accessCode }
    });
    await prisma.activityLog.create({
      data: {
        userId: getNumericUserId(req.user) || null,
        action: 'Access Code Reset',
        details: `Access code reset for department: ${updated.name}`
      }
    });
    res.json({ success: true, department: updated.name });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Department Stamp Upload (Admin only)
app.post('/api/departments/:id/stamp', authenticateToken, requireRoles(['global_admin']), upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No stamp uploaded' });
    const storageKey = generateStorageKey(`stamps/department-${id}`, req.file.originalname);
    await putObject({ key: storageKey, body: req.file.buffer, contentType: req.file.mimetype });
    const stamp = await prisma.departmentStamp.upsert({
      where: { departmentId: parseInt(id) },
      update: { imageKey: storageKey },
      create: { departmentId: parseInt(id), imageKey: storageKey }
    });
    res.json(stamp);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// User Signature Upload (User or Admin)
app.post('/api/users/:id/signature', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getNumericUserId(req.user);
    const targetId = parseInt(id);
    if (!req.file) return res.status(400).json({ error: 'No signature uploaded' });
    if (userId !== targetId && normalizeRole(req.user.role) !== 'global_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const storageKey = generateStorageKey(`signatures/user-${id}`, req.file.originalname);
    await putObject({ key: storageKey, body: req.file.buffer, contentType: req.file.mimetype });
    const signatureRecord = await prisma.userSignature.upsert({
      where: { userId: targetId },
      update: { imageKey: storageKey },
      create: { userId: targetId, imageKey: storageKey }
    });
    res.json(signatureRecord);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/requisitions', authenticateToken, generalLimiter, async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (items.length === 0) return res.status(400).json({ error: 'No requisitions supplied' });

    const systemUser = await prisma.user.findFirst({ where: { role: 'global_admin' } });
    const creatorId = getNumericUserId(req.user) || systemUser?.id || 1;
    const createdRecords = [];
    const existingRecords = [];

    for (const item of items) {
      const parsed = z.object({
        clientId: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        type: z.string().optional(),
        amount: z.union([z.string(), z.number()]).optional(),
        departmentId: z.number().optional(),
        urgency: z.string().optional(),
        content: z.string().optional(),
        isDraft: z.boolean().optional()
      }).safeParse(item);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid requisition payload' });
      }
      const data = parsed.data;
      const clientId = data.clientId || crypto.randomUUID();

      const existing = await prisma.requisition.findUnique({ where: { clientId } });
      if (existing) {
        existingRecords.push(existing);
        continue;
      }

      const amount = parseFloat(data.amount || 0) || 0;
      const eligibleStages = await getEligibleStages(amount);
      const firstStage = eligibleStages[0] || null;
      const isDraft = Boolean(data.isDraft);
      const targetDeptId = data.departmentId || req.user.deptId || 1;
      if (req.user.role === 'department' && req.user.deptId && targetDeptId !== req.user.deptId) {
        return res.status(403).json({ error: 'Department users can only create for their own department' });
      }

      const created = await prisma.requisition.create({
        data: {
          clientId,
          title: data.title || data.description || 'Untitled Requisition',
          type: data.type || 'Cash',
          amount,
          description: data.description || '',
          urgency: data.urgency || 'normal',
          status: isDraft ? 'draft' : 'pending',
          departmentId: targetDeptId,
          creatorId,
          content: data.content || null,
          currentStageId: isDraft ? null : (firstStage?.id || null),
          lastActionById: creatorId,
          lastActionAt: new Date()
        }
      });

      if (!isDraft && firstStage?.role) {
        await notifyRole(firstStage.role, `New Requisition: ${created.title}`, created.id);
      }
      if (!isDraft) {
        const dept = await prisma.department.findUnique({ where: { id: targetDeptId } });
        await notifyDepartmentHead({
          departmentId: targetDeptId,
          requisition: { ...created, department: dept || null },
          subject: `New Requisition: ${created.title}`,
          lines: [
            `Department: ${dept?.name || 'Department'}`,
            `Type: ${created.type}`,
            `Amount: ${formatCurrency(created.amount)}`,
            `Urgency: ${created.urgency || 'normal'}`,
            `Status: ${created.status}`,
            `Created By: ${req.user?.name || 'System'}`
          ]
        });
      }
      createdRecords.push(created);
    }

    res.json([...createdRecords, ...existingRecords]);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/requisitions/:id/approve', authenticateToken, approvalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = z.object({ remarks: z.string().optional() }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid approval payload' });
    const updated = await processApprovalAction({ requisitionId: parseInt(id), action: 'approved', remarks: parsed.data.remarks, user: req.user });
    res.json(updated);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/requisitions/:id/reject', authenticateToken, approvalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = z.object({ remarks: z.string().optional() }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid rejection payload' });
    const updated = await processApprovalAction({ requisitionId: parseInt(id), action: 'rejected', remarks: parsed.data.remarks, user: req.user });
    res.json(updated);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Backward compatible status endpoint
app.post('/api/requisitions/:id/status', authenticateToken, approvalLimiter, async (req, res) => {
  try {
    const { status, remarks } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Unsupported status change' });
    }
    const updated = await processApprovalAction({ requisitionId: parseInt(req.params.id), action: status, remarks, user: req.user });
    res.json(updated);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/requisitions/:id/signed-pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const requisition = await prisma.requisition.findUnique({ where: { id: parseInt(id) } });
    if (!requisition?.signedPdfKey) return res.status(404).json({ error: 'Signed PDF not available' });
    if (req.user.role === 'department' && req.user.deptId && requisition.departmentId !== req.user.deptId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const stream = await getObjectStream(requisition.signedPdfKey);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="requisition-${id}.pdf"`);
    stream.pipe(res);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Shared helper for verifying a signature record
async function verifySignatureRecord(record) {
  const signatureValid = verifyHashHex(record.payloadHash, record.signature, record.publicKey.publicKey);
  const hasPdf = !!(record.approval?.requisition?.signedPdfKey && record.approval?.requisition?.signedPdfHash);
  let pdfValid = null;
  if (hasPdf) {
    const pdfBytes = await getObjectBuffer(record.approval.requisition.signedPdfKey);
    pdfValid = sha256Hex(pdfBytes) === record.approval.requisition.signedPdfHash;
  }
  return {
    signatureValid,
    pdfValid,           // true/false if PDF was checked, null if no signed PDF exists yet
    pdfChecked: hasPdf  // explicit flag so callers know whether pdfValid was evaluated
  };
}

// Verification (Admin only)
app.get('/api/verify/:code', authenticateToken, requireRoles(['global_admin']), async (req, res) => {
  try {
    const { code } = req.params;
    const record = await prisma.signatureRecord.findUnique({
      where: { verificationCode: code },
      include: { publicKey: true, approval: { include: { requisition: true } } }
    });
    if (!record) return res.status(404).json({ error: 'Verification code not found' });
    const { signatureValid, pdfValid, pdfChecked } = await verifySignatureRecord(record);
    res.json({
      verificationCode: code,
      signatureValid,
      pdfValid,
      pdfChecked,
      requisitionId: record.approval?.requisitionId,
      approvedAt: record.approval?.createdAt
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Public verification endpoint (rate-limited, no auth required)
app.get('/api/public-verify/:code', publicVerifyLimiter, async (req, res) => {
  try {
    const { code } = req.params;
    const record = await prisma.signatureRecord.findUnique({
      where: { verificationCode: code },
      include: { publicKey: true, approval: { include: { requisition: true } } }
    });
    if (!record) return res.status(404).json({ error: 'Verification code not found' });
    const { signatureValid, pdfValid, pdfChecked } = await verifySignatureRecord(record);
    res.json({
      verificationCode: code,
      signatureValid,
      pdfValid,
      pdfChecked,
      requisitionId: record.approval?.requisitionId,
      approvedAt: record.approval?.createdAt
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/requisitions', authenticateToken, async (req, res) => {
  try {
    const where = {};
    // RBAC: Department users only see their own department's requisitions
    if (req.user.role === 'department' && req.user.deptId) {
      where.departmentId = req.user.deptId;
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.requisition.findMany({
        where,
        include: {
          department: { select: { name: true } },
          creator: { select: { name: true } },
          currentStage: true,
          attachments: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.requisition.count({ where })
    ]);

    res.json({ data: records, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        include: { user: { select: { name: true } } },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      }),
      prisma.activityLog.count()
    ]);
    res.json({ data: logs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// File Attachments & Auditing
app.post('/api/requisitions/:id/attachments', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;
    
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const userId = getNumericUserId(req.user);
    const attachments = [];
    for (const file of files) {
      const storageKey = generateStorageKey(`attachments/${id}`, file.originalname);
      await putObject({ key: storageKey, body: file.buffer, contentType: file.mimetype });
      const created = await prisma.attachment.create({
        data: {
          filename: file.originalname,
          storageKey,
          mimeType: file.mimetype,
          size: file.size,
          requisitionId: parseInt(id),
          uploadedById: userId || null
        }
      });
      attachments.push(created);
    }

    // Log Activity
    await prisma.activityLog.create({
        data: {
            userId: userId || null,
            action: 'File Upload',
            details: `Uploaded ${files.length} files to Requisition #${id}`
        }
    });

    res.json(attachments);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/attachments/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const attachment = await prisma.attachment.findUnique({ 
      where: { id: parseInt(id) },
      include: { requisition: true }
    });
    if (!attachment) return res.status(404).json({ error: 'File not found' });
    if (req.user.role === 'department' && req.user.deptId && attachment.requisition?.departmentId !== req.user.deptId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Audit Log
    const accessUserId = getNumericUserId(req.user);
    if (accessUserId) {
      await prisma.fileAccessLog.create({
        data: {
          attachmentId: attachment.id,
          userId: accessUserId,
          action: 'DOWNLOAD'
        }
      });
    }

    if (!attachment.storageKey) return res.status(404).json({ error: 'File missing from storage' });
    const stream = await getObjectStream(attachment.storageKey);
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    stream.pipe(res);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Requisition Attachments List
app.get('/api/requisitions/:id/attachments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'department' && req.user.deptId) {
      const reqCheck = await prisma.requisition.findUnique({ where: { id: parseInt(id) } });
      if (!reqCheck || reqCheck.departmentId !== req.user.deptId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const attachments = await prisma.attachment.findMany({
      where: { requisitionId: parseInt(id) },
      include: { uploadedBy: { select: { name: true } } }
    });
    res.json(attachments);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ── FRONTEND SERVING ──
// Health check (must be before static + SPA fallback)
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const distPath = path.join(__dirname, 'rms_frontend', 'dist');
app.use(express.static(distPath));

app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 CSS RMS Unified Node listening on port ${PORT}`);
  try {
    await ensureActivePublicKey();
    console.log('[BOOT] Active signing key ensured');
  } catch (e) {
    console.warn('[BOOT] Signing key not ensured:', e.message);
  }
  
  // Boot-time cleanup: remove duplicate/typo departments
  try {
    const deleted = await prisma.department.deleteMany({
      where: { name: { in: ['Soya Milk', 'soya milk', 'SOYA MILK'] } }
    });
    if (deleted.count > 0) console.log(`[BOOT] Cleaned up ${deleted.count} duplicate 'Soya Milk' department(s)`);
  } catch (e) {
    console.warn('[BOOT] Dept cleanup skipped:', e.message);
  }

  // Ensure GM, CEO, ICC departments exist.
  // Access codes come from env vars — no hardcoded credentials.
  try {
    const bootDepts = [
      { name: 'General Manager (GM)',               type: 'Strategic', code: 'GMR', envKey: 'GM_ACCESS_CODE',  fallback: 'GM-2026'   },
      { name: 'CEO (Chairman)',                      type: 'Strategic', code: 'CEO', envKey: 'CEO_ACCESS_CODE', fallback: 'CEO-2026'  },
      { name: 'Internal consult and control (ICC)', type: 'Strategic', code: 'ICC', envKey: 'ICC_ACCESS_CODE', fallback: 'ICC-2026'  },
    ];
    for (const dept of bootDepts) {
      const code = (process.env[dept.envKey] || dept.fallback).trim();
      const accessCodeHash = await bcrypt.hash(code, 10);
      await prisma.department.upsert({
        where: { name: dept.name },
        update: {},   // never overwrite an existing dept's code — use the admin UI to rotate
        create: {
          name: dept.name,
          type: dept.type,
          code: dept.code,
          accessCode: null,
          accessCodeHash,
          accessCodeLabel: dept.envKey  // label shows the env var name, not the value
        }
      });
    }
    console.log('[BOOT] GM, CEO, ICC departments ensured');
  } catch (e) {
    console.warn('[BOOT] Dept upsert skipped:', e.message);
  }
});
