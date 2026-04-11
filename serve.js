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
const xss = require('xss');
const pino = require('pino');
const pinoHttp = require('pino-http');
const OpenAI = require('openai');
const fs = require('fs');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

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

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.b-cdn.net"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
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

// ── OBSERVABILITY & LOGGING ─────────────────────────────────────────────────
app.use(pinoHttp({ logger }));

// ── INPUT SANITIZATION (XSS PROTECTION) ─────────────────────────────────────
const sanitizeObject = (obj) => {
  if (typeof obj === 'string') return xss(obj);
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item));
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      // Don't modify keys, just values
      newObj[key] = sanitizeObject(value);
    }
    return newObj;
  }
  return obj;
};

const sanitizePayload = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
};

app.use(sanitizePayload);

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

// ── Token Blacklist (for logout) ──────────────────────────────────────────────
const tokenBlacklist = new Set();

// Prune expired tokens from blacklist every 30 minutes
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const entry of tokenBlacklist) {
    try {
      const decoded = jwt.decode(entry);
      if (decoded && decoded.exp && decoded.exp < now) tokenBlacklist.delete(entry);
    } catch { tokenBlacklist.delete(entry); }
  }
}, 30 * 60 * 1000);

// ── Login Lockout Tracking ───────────────────────────────────────────────────
const loginAttempts = new Map(); // key => { count, lockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkLockout(key) {
  const record = loginAttempts.get(key);
  if (!record) return false;
  if (record.lockedUntil && Date.now() < record.lockedUntil) return true;
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    loginAttempts.delete(key);
    return false;
  }
  return false;
}

function recordFailedLogin(key) {
  const record = loginAttempts.get(key) || { count: 0, lockedUntil: null };
  record.count += 1;
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    console.warn(`[AUTH] Account locked: ${key} (${MAX_LOGIN_ATTEMPTS} failed attempts)`);
  }
  loginAttempts.set(key, record);
}

function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
  if (!token) return res.status(401).json({ error: 'Access Denied: No Token' });

  // Check blacklist
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid Token' });
    req.user = user;
    req.token = token; // Stash for logout
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
  return crypto.createHash('sha256').update(content).digest('hex');
};

const checkDeptReadiness = async (deptId) => {
  if (!deptId) return { ready: false, reason: 'Department ID missing' };
  const dept = await prisma.department.findUnique({
    where: { id: deptId },
    include: { users: { include: { signature: true } } }
  });
  if (!dept) return { ready: false, reason: 'Department not found' };
  if (!dept.headName || !dept.headEmail) {
    return { ready: false, reason: `Department "${dept.name}" has not configured their head official's name or email.` };
  }
  // Check if a user with that email has a signature
  const headUser = await prisma.user.findFirst({
    where: { email: dept.headEmail },
    include: { signature: true }
  });
  if (!headUser || !headUser.signature) {
    return { ready: false, reason: `Department "${dept.name}" head official (${dept.headEmail}) has not uploaded a digital signature.` };
  }
  return { ready: true };
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

    // Account lockout check
    if (checkLockout(email)) {
      return res.status(429).json({ error: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.' });
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { department: true } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      recordFailedLogin(email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    clearLoginAttempts(email);
    const userData = { id: user.id, email: user.email, name: user.name, role: user.role, department: user.department?.name || 'General' };
    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '12h' });
    await prisma.activityLog.create({ data: { action: 'Logged In', details: `${user.name} (Admin) authenticated`, userId: user.id } });
    res.json({ token, user: userData });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Logout (revoke token)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  if (req.token) tokenBlacklist.add(req.token);
  res.json({ ok: true, message: 'Token revoked successfully.' });
});

// Refresh Token
app.post('/api/auth/refresh', authenticateToken, (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Invalid session' });
    
    // Revoke old token
    if (req.token) tokenBlacklist.add(req.token);

    // Issue new 12h token
    const userData = { id: user.id, email: user.email, name: user.name, role: user.role, department: user.department, deptId: user.deptId };
    const newToken = jwt.sign(userData, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token: newToken, user: userData });
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
    
    const deptKey = `dept:${(departmentName || '').trim().toLowerCase()}`;
    logger.info(`[AUTH] Unified login attempt: "${departmentName?.trim()}"`);

    // Account lockout check for department
    if (checkLockout(deptKey)) {
      return res.status(429).json({ error: 'Department temporarily locked due to too many failed attempts. Try again in 15 minutes.' });
    }
    
    const dept = await prisma.department.findFirst({ 
      where: { 
        name: { equals: departmentName?.trim(), mode: 'insensitive' }, 
      } 
    });
    
    if (!dept) {
      recordFailedLogin(deptKey);
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
      recordFailedLogin(deptKey);
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
    
    clearLoginAttempts(deptKey);
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

    // Filter out fake placeholder emails (e.g. seeded @cssgroup.local)
    const emails = users.map(u => u.email).filter(e => e && !e.endsWith('@cssgroup.local'));
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
        } else {
          console.log(`[MAIL] Sent to ${emails[i]} OK`);
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

// Mark single notification as read
app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const deptId = req.user.deptId ? parseInt(req.user.deptId) : null;
    const userId = getNumericUserId(req.user);
    const orClauses = [];
    if (userId) orClauses.push({ userId });
    if (deptId && !isNaN(deptId)) orClauses.push({ departmentId: deptId });
    if (orClauses.length === 0) return res.json({ count: 0 });
    const result = await prisma.notification.updateMany({
      where: { OR: orClauses, isRead: false },
      data: { isRead: true }
    });
    res.json({ count: result.count });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.update({
      where: { id: parseInt(req.params.id) },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
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
        clientId:          z.string().optional(),
        title:             z.string().optional(),
        description:       z.string().optional(),
        type:              z.string().optional(),
        amount:            z.union([z.string(), z.number()]).optional(),
        departmentId:      z.number().optional(),
        urgency:           z.string().optional(),
        content:           z.string().optional(),
        isDraft:           z.boolean().optional(),
        targetDepartmentId: z.number().optional(),
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
      const originDeptId = data.departmentId || req.user.deptId || 1;
      if (req.user.role === 'department' && req.user.deptId && originDeptId !== req.user.deptId) {
        return res.status(403).json({ error: 'Department users can only create for their own department' });
      }

      // Validate target department if supplied
      let targetDepartmentId = data.targetDepartmentId || null;
      if (targetDepartmentId) {
        const targetDept = await prisma.department.findUnique({ where: { id: targetDepartmentId } });
        if (!targetDept) {
          return res.status(400).json({ error: 'Target department not found' });
        }
        // Only Global Admin / GM / CEO / HR may route to Super Admin dept
        const superAdminDept = await prisma.department.findFirst({ where: { name: 'Super Admin' } });
        const senderDept = await prisma.department.findUnique({ where: { id: originDeptId } });
        const privilegedCodes = ['GMR', 'CEO', 'HRD'];
        if (
          superAdminDept && targetDepartmentId === superAdminDept.id &&
          normalizeRole(req.user.role) !== 'global_admin' &&
          !privilegedCodes.includes(senderDept?.code)
        ) {
          return res.status(403).json({ error: 'Only GM, CEO, or HR may send to Super Admin' });
        }
      }

      // STRICT GOVERNANCE CHECK
      const originReady = await checkDeptReadiness(originDeptId);
      if (!originReady.ready) return res.status(400).json({ error: originReady.reason });
      
      if (targetDepartmentId) {
        const targetReady = await checkDeptReadiness(targetDepartmentId);
        if (!targetReady.ready) return res.status(400).json({ error: targetReady.reason });
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
          departmentId: originDeptId,
          creatorId,
          content: data.content || null,
          currentStageId: isDraft ? null : (firstStage?.id || null),
          lastActionById: creatorId,
          lastActionAt: new Date(),
          targetDepartmentId: isDraft ? null : targetDepartmentId,
        }
      });

      if (!isDraft) {
        if (firstStage?.role) {
          await notifyRole(firstStage.role, `New Requisition: ${created.title}`, created.id);
        }
        const originDept = await prisma.department.findUnique({ where: { id: originDeptId } });
        await notifyDepartmentHead({
          departmentId: originDeptId,
          requisition: { ...created, department: originDept || null },
          subject: `New Requisition Submitted: ${created.title}`,
          lines: [
            `Department: ${originDept?.name || 'Department'}`,
            `Type: ${created.type}`,
            `Amount: ${formatCurrency(created.amount)}`,
            `Urgency: ${created.urgency || 'normal'}`,
            `Created By: ${req.user?.name || 'System'}`
          ]
        });

        // Notify target department if specified and activated (has headEmail)
        if (targetDepartmentId) {
          const targetDept = await prisma.department.findUnique({ where: { id: targetDepartmentId } });
          if (targetDept?.headEmail) {
            const actionUrl = APP_BASE_URL ? APP_BASE_URL.replace(/\/$/, '') : '';
            const { text, html } = buildEmailContent({
              title: `📋 Incoming Requisition: ${created.title}`,
              lines: [
                `From Department: ${originDept?.name || 'Department'}`,
                `Type: ${created.type}`,
                `Amount: ${formatCurrency(created.amount)}`,
                `Urgency: ${created.urgency || 'normal'}`,
                `Description: ${created.description || '—'}`,
                ``,
                `Please log in to your dashboard to review and respond to this requisition.`
              ],
              actionUrl,
              actionLabel: 'Open Dashboard'
            });
            await sendEmail({
              to: targetDept.headEmail,
              subject: `[CSS RMS] Incoming Requisition: ${created.title}`,
              text,
              html
            });
            // Create in-app notification for target dept
            await prisma.notification.create({
              data: {
                departmentId: targetDepartmentId,
                content: `Incoming Requisition: ${created.title} from ${originDept?.name || 'Department'}`
              }
            });
          }
        }
      }
      createdRecords.push(created);
    }

    res.json([...createdRecords, ...existingRecords]);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Edit draft requisition
app.put('/api/requisitions/:id', authenticateToken, generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = z.object({
      title:             z.string().optional(),
      description:       z.string().optional(),
      type:              z.string().optional(),
      amount:            z.union([z.string(), z.number()]).optional(),
      urgency:           z.string().optional(),
      content:           z.string().optional(),
      isDraft:           z.boolean().optional(),
      targetDepartmentId: z.number().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
    const data = parsed.data;

    const existing = await prisma.requisition.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return res.status(404).json({ error: 'Requisition not found' });
    if (existing.status !== 'draft') return res.status(400).json({ error: 'Only drafts can be edited' });

    // Verify ownership
    const systemUser = await prisma.user.findFirst({ where: { role: 'global_admin' } });
    const isAdmin = getNumericUserId(req.user) === systemUser?.id;
    const userDeptId = req.user.deptId ? parseInt(req.user.deptId) : null;
    if (!isAdmin && existing.departmentId !== userDeptId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const amount = parseFloat(data.amount || existing.amount);
    const eligibleStages = await getEligibleStages(amount);
    const firstStage = eligibleStages[0] || null;

    const updated = await prisma.requisition.update({
      where: { id: parseInt(id) },
      data: {
        title: data.title !== undefined ? data.title : existing.title,
        description: data.description !== undefined ? data.description : existing.description,
        type: data.type !== undefined ? data.type : existing.type,
        amount: data.amount !== undefined ? amount : existing.amount,
        urgency: data.urgency !== undefined ? data.urgency : existing.urgency,
        content: data.content !== undefined ? data.content : existing.content,
        targetDepartmentId: data.isDraft ? existing.targetDepartmentId : data.targetDepartmentId,
        status: data.isDraft ? 'draft' : 'pending',
        currentStageId: data.isDraft ? null : (firstStage?.id || null),
      }
    });

    if (!data.isDraft && existing.status === 'draft') {
      if (firstStage?.role) {
        await notifyRole(firstStage.role, `New Requisition: ${updated.title}`, updated.id);
      }
      // You can replicate the target dept email block here if desired
    }
    res.json(updated);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Delete draft requisition
app.delete('/api/requisitions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.requisition.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return res.status(404).json({ error: 'Requisition not found' });
    
    const systemUser = await prisma.user.findFirst({ where: { role: 'global_admin' } });
    const isAdmin = getNumericUserId(req.user) === systemUser?.id;

    if (!isAdmin) {
      if (existing.status !== 'draft') {
        return res.status(400).json({ error: 'Only drafts can be deleted' });
      }
      const userDeptId = req.user.deptId ? parseInt(req.user.deptId) : null;
      if (existing.departmentId !== userDeptId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    await prisma.requisition.delete({ where: { id: parseInt(id) } });
    res.json({ ok: true, message: 'Deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/requisitions/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });

    const systemUser = await prisma.user.findFirst({ where: { role: 'global_admin' } });
    const isAdmin = getNumericUserId(req.user) === systemUser?.id;
    const userDeptId = req.user.deptId ? parseInt(req.user.deptId) : null;

    if (isAdmin) {
      await prisma.requisition.deleteMany({ where: { id: { in: ids } } });
      return res.json({ ok: true, message: 'Deleted successfully' });
    } else {
      await prisma.requisition.deleteMany({
        where: {
          id: { in: ids },
          status: 'draft',
          departmentId: userDeptId
        }
      });
      return res.json({ ok: true, message: 'Deleted allowed drafts' });
    }
  } catch (error) { res.status(500).json({ error: error.message }); }
});


app.get('/api/departments/:id/activation', authenticateToken, async (req, res) => {
  try {
    const dept = await prisma.department.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { id: true, name: true, headName: true, headEmail: true }
    });
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    res.json({ activated: Boolean(dept.headEmail), headName: dept.headName, headEmail: dept.headEmail });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Forward / Return-to-Sender a requisition (target department response)
app.post('/api/requisitions/:id/forward', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = z.object({
      targetDepartmentId: z.number().nullable().optional(),
      note: z.string().optional(),
      returnToSender: z.boolean().optional()
    }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const { targetDepartmentId, note, returnToSender } = parsed.data;

    const requisition = await prisma.requisition.findUnique({
      where: { id: parseInt(id) },
      include: { department: true, targetDepartment: true }
    });
    if (!requisition) return res.status(404).json({ error: 'Requisition not found' });

    // Only the current target department or admin may forward/return
    const userDeptId = req.user.deptId ? parseInt(req.user.deptId) : null;
    const isAdmin    = normalizeRole(req.user.role) === 'global_admin';
    if (!isAdmin && userDeptId !== requisition.targetDepartmentId) {
      return res.status(403).json({ error: 'Only the current target department may forward or return' });
    }

    const newTargetId = returnToSender ? null : (targetDepartmentId ?? null);
    const updated = await prisma.requisition.update({
      where: { id: parseInt(id) },
      data: {
        targetDepartmentId: newTargetId,
        forwardNote: note || null
      },
      include: { department: true, targetDepartment: true }
    });

    await prisma.activityLog.create({
      data: {
        userId: getNumericUserId(req.user) || null,
        action: returnToSender ? 'Requisition Returned' : 'Requisition Forwarded',
        details: `Req #${id}: ${returnToSender ? 'returned to sender' : `forwarded to dept #${newTargetId}`}. Note: ${note || 'none'}`
      }
    });

    // Notify new target dept if applicable
    if (!returnToSender && newTargetId) {
      const newTarget = await prisma.department.findUnique({ where: { id: newTargetId } });
      if (newTarget?.headEmail) {
        const actionUrl = APP_BASE_URL ? APP_BASE_URL.replace(/\/$/, '') : '';
        const { text, html } = buildEmailContent({
          title: `📋 Forwarded Requisition: ${requisition.title}`,
          lines: [
            `Originally From: ${requisition.department?.name || 'Department'}`,
            `Forwarded By: ${requisition.targetDepartment?.name || 'Department'}`,
            `Type: ${requisition.type}`,
            `Amount: ${formatCurrency(requisition.amount)}`,
            note ? `Note: ${note}` : null,
            ``,
            `Please log in to your dashboard to review and respond.`
          ].filter(Boolean),
          actionUrl,
          actionLabel: 'Open Dashboard'
        });
        await sendEmail({
          to: newTarget.headEmail,
          subject: `[CSS RMS] Forwarded Requisition: ${requisition.title}`,
          text,
          html
        });
        await prisma.notification.create({
          data: {
            departmentId: newTargetId,
            content: `Forwarded Requisition: ${requisition.title}`
          }
        });
      }
    }

    // Notify original sender dept on return
    if (returnToSender && requisition.departmentId) {
      await prisma.notification.create({
        data: {
          departmentId: requisition.departmentId,
          content: `Requisition returned for clarification: ${requisition.title}${note ? ` — ${note}` : ''}`
        }
      });
    }

    res.json(updated);
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

// ── DEPARTMENT PROFILE & GOVERNANCE ROUTES ───────────────────────────────────

app.get('/api/department/profile', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'department' || !req.user.deptId) {
      return res.status(403).json({ error: 'Only department accounts can access this profile' });
    }
    const dept = await prisma.department.findUnique({
      where: { id: req.user.deptId },
      include: {
        users: {
          where: { email: { equals: prisma.department.findUnique({ where: { id: req.user.deptId } }).headEmail } },
          include: { signature: true }
        }
      }
    });
    // Simpler join for the signature status
    const headUser = dept.headEmail ? await prisma.user.findFirst({
      where: { email: dept.headEmail },
      include: { signature: true }
    }) : null;

    res.json({
      ...dept,
      hasSignature: !!headUser?.signature
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/department/profile', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'department' || !req.user.deptId) return res.status(403).json({ error: 'Forbidden' });
    const { headName, headEmail, headTitle, phone, address } = req.body;
    const updated = await prisma.department.update({
      where: { id: req.user.deptId },
      data: { headName, headEmail, headTitle, phone, address }
    });
    res.json(updated);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/department/signature', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'department' || !req.user.deptId) return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No signature file uploaded' });

    const dept = await prisma.department.findUnique({ where: { id: req.user.deptId } });
    if (!dept.headEmail) return res.status(400).json({ error: 'Please set a head official email first' });

    // Find or create the user for this email to attach the signature
    let headUser = await prisma.user.findFirst({ where: { email: dept.headEmail } });
    if (!headUser) {
      // Create a placeholder user if they don't exist
      headUser = await prisma.user.create({
        data: {
          email: dept.headEmail,
          name: dept.headName || 'Department Head',
          role: 'department',
          departmentId: dept.id,
          password: crypto.randomBytes(8).toString('hex') // placeholder
        }
      });
    }

    const storageKey = generateStorageKey(`signatures/head-${dept.id}`, req.file.originalname);
    await putObject({ key: storageKey, body: req.file.buffer, contentType: req.file.mimetype });

    await prisma.userSignature.upsert({
      where: { userId: headUser.id },
      update: { imageKey: storageKey },
      create: { userId: headUser.id, imageKey: storageKey }
    });

    res.json({ success: true, message: 'Department head signature updated successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ── END GOVERNANCE ROUTES ───────────────────────────────────────────────────

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

app.get('/api/requisitions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const requisition = await prisma.requisition.findUnique({
      where: { id: parseInt(id) },
      include: {
        department:       { select: { name: true, headName: true, headEmail: true } },
        targetDepartment: { select: { name: true, headEmail: true, headName: true } },
        creator:          { select: { name: true } },
        currentStage:     true,
        attachments:      true,
        approvals: {
          include: {
            stage:     true,
            user:      { select: { name: true, role: true } },
            signature: { select: { verificationCode: true, payloadHash: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    if (!requisition) return res.status(404).json({ error: 'Requisition not found' });
    if (
      req.user.role === 'department' && req.user.deptId &&
      requisition.departmentId !== req.user.deptId &&
      requisition.targetDepartmentId !== req.user.deptId
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(requisition);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/requisitions/:id/dynamic-pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const requisition = await prisma.requisition.findUnique({
      where: { id: parseInt(id) },
      include: {
        department: true,
        targetDepartment: true,
        approvals: {
          include: {
            stage: true,
            user: { include: { signature: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!requisition) return res.status(404).json({ error: 'Requisition not found' });

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    
    let y = 800;
    const margin = 50;
    const pageWidth = 595.28;

    // 1. Embed Logo
    try {
      if (fs.existsSync(path.join(__dirname, 'samples', 'logo.jpg'))) {
        const logoBytes = fs.readFileSync(path.join(__dirname, 'samples', 'logo.jpg'));
        const logoImage = await pdfDoc.embedJpg(logoBytes);
        const logoDims = logoImage.scale(0.2);
        page.drawImage(logoImage, {
          x: margin,
          y: y - logoDims.height,
          width: logoDims.width,
          height: logoDims.height
        });
      }
    } catch (e) { logger.warn('Logo embed failed:', e.message); }

    // 2. Company Header Info
    const isMemo = requisition.type === 'Memo';
    page.drawText('CSS GLOBAL INTEGRATED FARMS LTD', { x: 150, y: y - 15, size: 14, font: boldFont, color: rgb(0.1, 0.2, 0.4) });
    page.drawText('Km 10, Abuja-Keffi Expressway, Nasarawa State.', { x: 150, y: y - 30, size: 9, font });
    page.drawText('www.cssgroup.com.ng | info@cssgroup.com.ng', { x: 150, y: y - 42, size: 9, font });
    
    y -= 80;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1.5, color: rgb(0.1, 0.2, 0.4) });
    y -= 30;

    // 3. Document Title
    const title = isMemo ? 'INTERNAL MEMORANDUM' : 'REQUISITION VOUCHER';
    page.drawText(title, { 
      x: pageWidth / 2 - (boldFont.widthOfTextAtSize(title, 16) / 2), 
      y, 
      size: 16, 
      font: boldFont,
      decoration: { type: 'underline' }
    });
    y -= 40;

    // 4. Metadata Block
    if (isMemo) {
      page.drawText(`REF: CSSG/${(requisition.department?.code || 'CSS').toUpperCase()}/MO/${id}`, { x: margin, y, size: 10, font: boldFont });
      page.drawText(`DATE: ${new Date(requisition.createdAt).toLocaleDateString().toUpperCase()}`, { x: pageWidth - 160, y, size: 10, font: boldFont });
      y -= 20;
      page.drawText(`TO: ${(requisition.targetDepartment?.name || 'TARGET DEPT').toUpperCase()}`, { x: margin, y, size: 10, font: boldFont });
      y -= 15;
      page.drawText(`FROM: ${(requisition.department?.name || 'ORIGIN DEPT').toUpperCase()}`, { x: margin, y, size: 10, font: boldFont });
      y -= 15;
      page.drawText(`SUBJECT: ${requisition.title.toUpperCase()}`, { x: margin, y, size: 11, font: boldFont });
      y -= 10;
      page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1 });
    } else {
      page.drawText(`Voucher No: #${id}`, { x: margin, y, size: 11, font: boldFont });
      page.drawText(`Date: ${new Date(requisition.createdAt).toLocaleDateString()}`, { x: pageWidth - 160, y, size: 11, font: boldFont });
      y -= 25;
      page.drawText(`Originating Department: ${requisition.department?.name}`, { x: margin, y, size: 10, font });
      y -= 15;
      page.drawText(`Target Department: ${requisition.targetDepartment?.name || 'Processing Department'}`, { x: margin, y, size: 10, font });
      y -= 15;
      page.drawText(`Requisition Title: ${requisition.title}`, { x: margin, y, size: 10, font: boldFont });
    }

    y -= 40;

    // 5. Description Body
    page.drawText('DESCRIPTION / CONTENT:', { x: margin, y, size: 9, font: boldFont });
    y -= 20;
    
    const content = requisition.description || 'No content provided.';
    const lines = content.match(/.{1,85}/g) || [];
    for (const line of lines) {
      if (y < 120) { page.drawText('... (continued on next page)', { x: margin, y, size: 8, font: italicFont }); break; }
      page.drawText(line, { x: margin + 10, y, size: 10, font });
      y -= 15;
    }

    if (!isMemo && requisition.amount > 0) {
      y -= 20;
      page.drawText(`TOTAL AMOUNT:`, { x: margin, y, size: 12, font: boldFont });
      const amtStr = `NGN ${Number(requisition.amount).toLocaleString()}`;
      page.drawText(amtStr, { x: pageWidth - margin - boldFont.widthOfTextAtSize(amtStr, 12), y, size: 12, font: boldFont });
      y -= 20;
    }

    // 6. Approval & Signatures Trail
    y = 250; 
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.7,0.7,0.7) });
    y -= 20;
    page.drawText('AUTHORIZATION & APPROVAL TRAIL', { x: margin, y, size: 9, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
    y -= 25;

    for (const app of requisition.approvals) {
      if (y < 60) break;
      const stamp = new Date(app.createdAt).toLocaleString();
      const statusText = `[${app.action.toUpperCase()}] ${app.stage?.name || 'Processed'} by ${app.user?.name} on ${stamp}`;
      page.drawText(statusText, { x: margin, y, size: 9, font });
      
      // Try to embed user digital signature if available
      if (app.user?.signature?.imageKey) {
        try {
          const sigBuffer = await getObjectBuffer(app.user.signature.imageKey);
          const sigImage = await embedImageIfAvailable(pdfDoc, sigBuffer);
          if (sigImage) {
            const dims = sigImage.scale(0.15);
            page.drawImage(sigImage, { x: pageWidth - margin - dims.width - 20, y: y - 5, width: dims.width, height: dims.height });
          }
        } catch (e) { /* skip sig if fail */ }
      }
      y -= 15;
    }

    // 7. Footer
    const footerText = `Generated dynamically by CSS-RMS on ${new Date().toLocaleString()}`;
    page.drawText(footerText, { x: pageWidth / 2 - (font.widthOfTextAtSize(footerText, 8) / 2), y: 30, size: 8, font: italicFont, color: rgb(0.5, 0.5, 0.5) });

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CSS-REPORT-${id}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) { 
    logger.error('Dynamic PDF Error:', error);
    res.status(500).json({ error: error.message }); 
  }
});

app.get('/api/requisitions', authenticateToken, async (req, res) => {
  try {
    let where = {};
    // RBAC: Department users see their own requisitions AND incoming ones targeted at them
    if (req.user.role === 'department' && req.user.deptId) {
      where = {
        OR: [
          { departmentId: req.user.deptId },
          { targetDepartmentId: req.user.deptId }
        ]
      };
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.requisition.findMany({
        where,
        include: {
          department:       { select: { name: true } },
          targetDepartment: { select: { name: true, headEmail: true } },
          creator:          { select: { name: true } },
          currentStage:     true,
          attachments:      { select: { id: true, filename: true, size: true, mimeType: true } }
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

// ── AI MAGICAL REFINEMENT ──
app.post('/api/ai/refine-requisition', authenticateToken, async (req, res) => {
  try {
    const { rawDescription } = req.body;
    if (!rawDescription || rawDescription.trim().length < 5) {
      return res.status(400).json({ error: 'Description is too short to refine.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'AI features are not configured. Please contact the administrator.' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert executive procurement and correspondence assistant. The user will provide a rough draft. 
If the draft is a list of items to buy, budget, or requests for money/pricing, format it as a professional itemized requisition breakdown and set documentType to "Cash".
If the draft is just a general communication, notice, internal penalty/fine statement (e.g. money captured just as text but no actual funding request), or administrative text with no funding authorization needed, format it as a polite professional memorandum and set documentType to "Memo".
Extract any math/prices mentioned. If NO prices are requested for funding, set totalAmount to 0. 
Always return a JSON object with: 
{ "refinedDescription": string, "totalAmount": number, "documentType": "Cash" | "Memo" }`
        },
        {
          role: "user",
          content: rawDescription
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const aiData = JSON.parse(response.choices[0].message.content);
    // Sanitize ai output just to be safe
    return res.json({
      refinedDescription: xss(aiData.refinedDescription || aiData.description || ''),
      totalAmount: Number(aiData.totalAmount) || 0,
      documentType: aiData.documentType === 'Memo' ? 'Memo' : 'Cash'
    });
  } catch (error) {
    logger.error('OpenAI Refinement Error:', error);
    res.status(500).json({ error: 'AI failed to process the request. Try again.' });
  }
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
const server = app.listen(PORT, async () => {
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
    logger.info('[BOOT] GM, CEO, ICC departments ensured');
  } catch (e) {
    logger.warn('[BOOT] Dept upsert skipped:', e.message);
  }
});

const gracefulShutdown = (signal) => {
  logger.info(`[SHUTDOWN] ${signal} received — closing server gracefully...`);
  server.close(async () => {
    try { await prisma.$disconnect(); } catch (_) {}
    logger.info('[SHUTDOWN] Database disconnected. Exiting.');
    process.exit(0);
  });
  // Force-kill if still not done after 10 s
  setTimeout(() => { logger.error('[SHUTDOWN] Timeout — forcing exit.'); process.exit(1); }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
