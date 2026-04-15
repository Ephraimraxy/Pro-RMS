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
let isSystemReady = false; // Flag for database/seed readiness

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

app.use(pinoHttp({ logger }));

// ── BOOTING PROTECTOR MIDDLEWARE ───────────────────────────────────────────
app.use((req, res, next) => {
  if (!isSystemReady && req.path.startsWith('/api') && !req.path.startsWith('/api/health')) {
    return res.status(503).json({ 
      error: 'System Initializing', 
      message: 'The RMS core is currently synchronizing with the database and seeding authority records. Please wait 10 seconds.' 
    });
  }
  next();
});

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
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || '').trim();
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
  if (!token) return res.status(401).json({ error: 'You must be logged in to access this. Please sign in and try again.' });

  // Check blacklist
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Your session is invalid or has expired. Please log in again.' });
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

// ── Central friendly error responder ─────────────────────────────────────────
// 4xx errors: pass the message through (already human-readable).
// 5xx errors: never expose raw DB / system internals — use a safe fallback.
const sendError = (res, status, message) => {
  if (status >= 500) {
    logger.error(`[API ${status}] ${message}`);
    return res.status(status).json({ error: 'Something went wrong on our end. Please try again, or contact support if the problem persists.' });
  }
  return res.status(status).json({ error: message });
};
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
  return res.status(403).json({ error: 'You do not have permission to perform this action.' });
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
    include: { users: true }
  });
  if (!dept) return { ready: false, reason: 'Department not found' };
  if (dept.name === 'Super Admin') return { ready: true };

  if (!dept.headName || !dept.headEmail) {
    return {
      ready: false,
      reason: `Your department profile is incomplete. Please go to Dept Profile and fill in the Head Official name and email before submitting a request.`
    };
  }

  const headUser = await prisma.user.findFirst({
    where: { email: dept.headEmail },
    include: { signature: true }
  });

  if (!headUser) {
    return {
      ready: false,
      reason: `The head official for "${dept.name}" (${dept.headEmail}) has not created a system account yet. Please ask them to log in and set up their profile first.`
    };
  }

  if (!headUser.signature) {
    return {
      ready: false,
      reason: `The head official for "${dept.name}" has not uploaded a digital signature yet. Please go to Dept Profile → Signature and upload one before submitting.`
    };
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
  y -= 16;
  page.drawText(`Type: ${requisition.type}    Amount: NGN ${Number(requisition.amount || 0).toLocaleString()}`, { x: margin, y, size: 11, font });
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
          amountLine(requisition.type, requisition.amount),
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
          amountLine(requisition.type, requisition.amount),
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
      return res.status(400).json({ error: 'Login details are missing or invalid. Please check your credentials and try again.' });
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
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
});

app.post('/api/auth/dept-login', authLimiter, async (req, res) => {
  try {
    const parsed = z.object({
      departmentName: z.string().min(1),
      accessCode: z.string().min(1),
      mfaCode: z.string().optional().nullable()
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Login details are missing or invalid. Please check your credentials and try again.' });
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
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
});

app.get('/api/departments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const department = await prisma.department.findUnique({ where: { id: parseInt(id) } });
    if (!department) return res.status(404).json({ error: 'Department not found' });
    if (req.user.role === 'department' && req.user.deptId && department.id !== req.user.deptId) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    res.json(department);
  } catch (error) { sendError(res, 500, error.message); }
});

// Dynamic Requisition Types
app.get('/api/requisition-types', async (req, res) => {
  try {
    const types = await prisma.requisitionType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
  } catch (error) { sendError(res, 500, error.message); }
});

// Dynamic Workflow Stages
app.get('/api/workflow-stages', async (req, res) => {
  try {
    const stages = await prisma.workflowStage.findMany({ orderBy: { sequence: 'asc' } });
    res.json(stages);
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
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

// Returns true for financial/procurement requests (Cash, Purchase, etc.)
// Memo type is purely administrative and should never show monetary amounts
const isMonetaryType = (type) => {
  if (!type) return false;
  return type.toLowerCase() !== 'memo';
};

// Returns an Amount line string for emails, or null if the request is non-monetary
const amountLine = (type, amount) => {
  if (!isMonetaryType(type)) return null;
  return `Amount: ${formatCurrency(amount)}`;
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
    
    // 1. Create Platform Notification (for Dashboard bell icon)
    if (departmentId) {
      await prisma.notification.create({
        data: {
          departmentId: departmentId,
          content: subject,
          link: requisition?.id ? `/requisitions/${requisition.id}` : null
        }
      });
    }

    // 2. Send Email if address exists
    if (!dept?.headEmail) {
      logger.info(`[MAIL] Skipping head notify for ${dept?.name || departmentId} - no email set.`);
      return;
    }
    
    const actionUrl = APP_BASE_URL ? `${APP_BASE_URL.replace(/\/$/, '')}/requisitions/${requisition.id}` : '';
    const { text, html } = buildEmailContent({
      title: subject,
      lines,
      actionUrl,
      actionLabel: 'Open Requisition'
    });
    
    logger.info(`[MAIL] Attempting to send email to: ${dept.headEmail} | Subject: ${subject}`);
    const result = await sendEmail({ to: dept.headEmail, subject, text, html });
    if (result && result.skipped) {
      logger.warn(`[MAIL] Send SKIPPED for ${dept.headEmail} — GMAIL_USER=${process.env.GMAIL_USER ? 'SET' : 'MISSING'}, GMAIL_APP_PASSWORD=${process.env.GMAIL_APP_PASSWORD ? 'SET' : 'MISSING'}`);
    } else {
      logger.info(`[MAIL] ✅ Email sent successfully to: ${dept.headEmail}`);
    }
  } catch (err) {
    logger.error(`[MAIL] Department head notify FAILED for dept ${departmentId}:`, err.message, err.stack);
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

    const link = requisitionId ? `/requisitions/${requisitionId}` : null;
    const notificationData = users.map(u => ({ userId: u.id, content: message, link }));

    // Also create a department-scoped notification so the originating department
    // sees status updates even though they have no User row
    if (departmentId && (roleName === 'creator' || roleName === 'department')) {
      notificationData.push({ departmentId, content: message, link });
    }

    if (notificationData.length > 0) {
      try {
        await prisma.notification.createMany({ data: notificationData });
      } catch (err) {
        logger.warn('[NOTIF] Bulk create failed (possibly missing link column):', err.message);
        // Fallback: create without link
        const safeData = notificationData.map(({ link, ...rest }) => rest);
        await prisma.notification.createMany({ data: safeData }).catch(e => logger.error('[NOTIF] Fallback failed:', e.message));
      }
    }

    // Filter out fake placeholder emails (e.g. seeded @cssgroup.local)
    const emails = users.map(u => u.email).filter(e => e && !e.endsWith('@cssgroup.local'));
    if (emails.length > 0) {
      const actionUrl = (APP_BASE_URL && requisitionId) 
        ? `${APP_BASE_URL.replace(/\/$/, '')}/requisitions/${requisitionId}` 
        : (APP_BASE_URL ? APP_BASE_URL.replace(/\/$/, '') : '');
      const { text, html } = buildEmailContent({
        title: message,
        lines: requisitionId ? [`Requisition ID: #${requisitionId}`] : [],
        actionUrl,
        actionLabel: 'Open Requisition'
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

// Clear ALL notifications for the user/department
app.delete('/api/notifications/clear-all', authenticateToken, async (req, res) => {
  try {
    const deptId = req.user.deptId ? parseInt(req.user.deptId) : null;
    const userId = getNumericUserId(req.user);
    const orClauses = [];
    if (userId) orClauses.push({ userId });
    if (deptId && !isNaN(deptId)) orClauses.push({ departmentId: deptId });
    if (orClauses.length === 0) return res.json({ count: 0 });

    const result = await prisma.notification.deleteMany({
      where: { OR: orClauses }
    });
    res.json({ count: result.count });
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.update({
      where: { id: parseInt(req.params.id) },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
});

app.delete('/api/requisition-types/:id', authenticateToken, requireRoles(['global_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.requisitionType.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
});

app.delete('/api/departments/:id', authenticateToken, requireRoles(['global_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { sendError(res, 500, error.message); }
});

app.put('/api/departments/:id/head', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deptId = parseInt(id);
    if (req.user.role === 'department' && req.user.deptId && req.user.deptId !== deptId) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
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
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
});

// User Signature Upload (User or Admin)
app.post('/api/users/:id/signature', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getNumericUserId(req.user);
    const targetId = parseInt(id);
    if (!req.file) return res.status(400).json({ error: 'No signature uploaded' });
    if (userId !== targetId && normalizeRole(req.user.role) !== 'global_admin') {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    const storageKey = generateStorageKey(`signatures/user-${id}`, req.file.originalname);
    await putObject({ key: storageKey, body: req.file.buffer, contentType: req.file.mimetype });
    const signatureRecord = await prisma.userSignature.upsert({
      where: { userId: targetId },
      update: { imageKey: storageKey },
      create: { userId: targetId, imageKey: storageKey }
    });
    res.json(signatureRecord);
  } catch (error) { sendError(res, 500, error.message); }
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
        return res.status(400).json({ error: 'Some required fields are missing or invalid. Please check your request and try again.' });
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

      // GLOBAL GOVERNANCE CHECK (Bypassed for Global Admins)
      const isGlobalAdmin = normalizeRole(req.user.role) === 'global_admin';
      
      if (!isGlobalAdmin) {
        const originReady = await checkDeptReadiness(originDeptId);
        if (!originReady.ready) return res.status(400).json({ error: originReady.reason });
        
        if (targetDepartmentId) {
          const targetReady = await checkDeptReadiness(targetDepartmentId);
          if (!targetReady.ready) return res.status(400).json({ error: targetReady.reason });
        }
      }

      // Inter-department requests (with targetDepartmentId) from non-admin senders
      // skip the admin workflow entirely – only the target dept reviews them.
      const isAdminOriginated = normalizeRole(req.user.role) === 'global_admin';
      const useWorkflow = !targetDepartmentId || isAdminOriginated;

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
          currentStageId: isDraft ? null : (useWorkflow ? (firstStage?.id || null) : null),
          lastActionById: creatorId,
          lastActionAt: new Date(),
          targetDepartmentId: isDraft ? null : targetDepartmentId,
        }
      });

      // Track the initial creation event for inter-department chain
      if (!isDraft && targetDepartmentId) {
        try {
          await prisma.forwardEvent.create({
            data: {
              requisitionId: created.id,
              fromDeptId: originDeptId,
              toDeptId: targetDepartmentId,
              action: 'created',
              note: data.description || null,
              actorName: req.user?.name || 'System'
            }
          });
        } catch (fwdErr) { logger.warn('[FWD] Forward event creation failed:', fwdErr.message); }
      }

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
            amountLine(created.type, created.amount),
            `Urgency: ${created.urgency || 'normal'}`,
            `Created By: ${req.user?.name || 'System'}`
          ]
        });

        // Notify target department if specified
        if (targetDepartmentId) {
          const originDept = await prisma.department.findUnique({ where: { id: originDeptId } });
          await notifyDepartmentHead({
            departmentId: targetDepartmentId,
            requisition: created,
            subject: `📋 Incoming Requisition: ${created.title}`,
            lines: [
              `From Department: ${originDept?.name || 'Department'}`,
              `Type: ${created.type}`,
              amountLine(created.type, created.amount),
              `Urgency: ${created.urgency || 'normal'}`,
              `Description: ${created.description || '—'}`,
              ``,
              `Please log in to your dashboard to review and respond to this requisition.`
            ]
          });
        }
      }
      createdRecords.push(created);
    }

    res.json([...createdRecords, ...existingRecords]);
  } catch (error) { sendError(res, 500, error.message); }
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
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
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
      
      const originDeptId = userDeptId || updated.departmentId;
      const originDept   = await prisma.department.findUnique({ where: { id: originDeptId } });
      const currentRequisition = await prisma.requisition.findUnique({ where: { id: updated.id }, include: { department: true } });

      // Notify Target Department if specified
      if (updated.targetDepartmentId) {
        await notifyDepartmentHead({
          departmentId: updated.targetDepartmentId,
          requisition: currentRequisition,
          subject: `📋 Incoming Requisition: ${updated.title}`,
          lines: [
            `From Department: ${originDept?.name || 'Department'}`,
            `Type: ${updated.type}`,
            amountLine(updated.type, updated.amount),
            `Urgency: ${updated.urgency || 'normal'}`,
            `Created By: ${req.user?.name || 'System'}`
          ]
        });
      }

      // Also notify origin department head that it's now submitted
      await notifyDepartmentHead({
        departmentId: originDeptId,
        requisition: currentRequisition,
        subject: `Requisition Submitted: ${updated.title}`,
        lines: [
          `Status: Moved from draft to pending`,
          `Type: ${updated.type}`,
          amountLine(updated.type, updated.amount)
        ]
      });
    }
    res.json(updated);
  } catch (error) { sendError(res, 500, error.message); }
});

// Delete requisition (admins can delete any; departments can only delete their own drafts)
app.delete('/api/requisitions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const reqId = parseInt(id);
    const existing = await prisma.requisition.findUnique({ where: { id: reqId } });
    if (!existing) return res.status(404).json({ error: 'Requisition not found' });

    const systemUser = await prisma.user.findFirst({ where: { role: 'global_admin' } });
    const isAdmin = getNumericUserId(req.user) === systemUser?.id;

    if (!isAdmin) {
      if (existing.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft requisitions can be deleted. Submitted or approved records require administrator access.' });
      }
      const userDeptId = req.user.deptId ? parseInt(req.user.deptId) : null;
      if (existing.departmentId !== userDeptId) {
        return res.status(403).json({ error: 'You do not have permission to delete this requisition.' });
      }
    }

    // Cascade-delete all related records in dependency order so FK constraints are satisfied
    // 1. File access logs (reference Attachments)
    const attachments = await prisma.attachment.findMany({ where: { requisitionId: reqId }, select: { id: true } });
    if (attachments.length > 0) {
      await prisma.fileAccessLog.deleteMany({ where: { attachmentId: { in: attachments.map(a => a.id) } } });
    }
    // 2. Attachments
    await prisma.attachment.deleteMany({ where: { requisitionId: reqId } });
    // 3. Signature records (reference Approvals)
    const approvals = await prisma.approval.findMany({ where: { requisitionId: reqId }, select: { id: true } });
    if (approvals.length > 0) {
      await prisma.signatureRecord.deleteMany({ where: { approvalId: { in: approvals.map(a => a.id) } } });
    }
    // 4. Approvals
    await prisma.approval.deleteMany({ where: { requisitionId: reqId } });
    // 5. Forward events (already cascade, but be explicit)
    await prisma.forwardEvent.deleteMany({ where: { requisitionId: reqId } });
    // 6. Notifications linked to this requisition
    await prisma.notification.deleteMany({ where: { link: `/requisitions/${reqId}` } });
    // 7. Finally delete the requisition
    await prisma.requisition.delete({ where: { id: reqId } });

    res.json({ ok: true, message: 'Requisition permanently deleted.' });
  } catch (error) {
    logger.error('[DELETE REQUISITION] Error:', error.message);
    res.status(500).json({ error: 'Failed to delete requisition. Please try again.' });
  }
});

app.post('/api/requisitions/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });

    const systemUser = await prisma.user.findFirst({ where: { role: 'global_admin' } });
    const isAdmin = getNumericUserId(req.user) === systemUser?.id;
    const userDeptId = req.user.deptId ? parseInt(req.user.deptId) : null;

    const targetIds = isAdmin ? ids : [];
    if (!isAdmin) {
      // Departments can only bulk-delete their own drafts
      const allowed = await prisma.requisition.findMany({
        where: { id: { in: ids }, status: 'draft', departmentId: userDeptId },
        select: { id: true }
      });
      allowed.forEach(r => targetIds.push(r.id));
    }
    if (targetIds.length === 0) return res.json({ ok: true, message: 'No eligible records to delete.' });

    // Cascade manually to avoid FK constraint failures
    const attachments = await prisma.attachment.findMany({ where: { requisitionId: { in: targetIds } }, select: { id: true } });
    if (attachments.length > 0) {
      await prisma.fileAccessLog.deleteMany({ where: { attachmentId: { in: attachments.map(a => a.id) } } });
    }
    await prisma.attachment.deleteMany({ where: { requisitionId: { in: targetIds } } });
    const approvals = await prisma.approval.findMany({ where: { requisitionId: { in: targetIds } }, select: { id: true } });
    if (approvals.length > 0) {
      await prisma.signatureRecord.deleteMany({ where: { approvalId: { in: approvals.map(a => a.id) } } });
    }
    await prisma.approval.deleteMany({ where: { requisitionId: { in: targetIds } } });
    await prisma.forwardEvent.deleteMany({ where: { requisitionId: { in: targetIds } } });
    await prisma.notification.deleteMany({ where: { link: { in: targetIds.map(id => `/requisitions/${id}`) } } });
    await prisma.requisition.deleteMany({ where: { id: { in: targetIds } } });
    return res.json({ ok: true, message: `${targetIds.length} record(s) deleted.` });
  } catch (error) {
    logger.error('[BULK DELETE] Error:', error.message);
    res.status(500).json({ error: 'Bulk delete failed. Please try again.' });
  }
});


app.get('/api/departments/:id/activation', authenticateToken, async (req, res) => {
  try {
    const dept = await prisma.department.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { id: true, name: true, headName: true, headEmail: true }
    });
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    res.json({ activated: Boolean(dept.headEmail), headName: dept.headName, headEmail: dept.headEmail });
  } catch (error) { sendError(res, 500, error.message); }
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

    // When returning, find who LAST sent the document to the current holder —
    // explicitly excluding self-loop events (fromDeptId === currentDept) so that
    // previously created bad ISAC→ISAC events don't pollute the lookup.
    const currentHolderDeptId = userDeptId ?? requisition.targetDepartmentId;
    let returnTargetId = requisition.departmentId; // fallback: original creator
    if (returnToSender) {
      const lastInbound = await prisma.forwardEvent.findFirst({
        where: {
          requisitionId: parseInt(id),
          toDeptId: currentHolderDeptId,
          NOT: { fromDeptId: currentHolderDeptId }  // skip self-loop events
        },
        orderBy: { createdAt: 'desc' }
      });
      if (lastInbound?.fromDeptId) {
        returnTargetId = lastInbound.fromDeptId;
      }
    } else {
      returnTargetId = newTargetId;
    }

    const updated = await prisma.requisition.update({
      where: { id: parseInt(id) },
      data: {
        targetDepartmentId: returnTargetId,
        forwardNote: note || null
      },
      include: { department: true, targetDepartment: true }
    });

    // Record ForwardEvent for the chain
    try {
      await prisma.forwardEvent.create({
        data: {
          requisitionId: parseInt(id),
          fromDeptId: userDeptId || requisition.targetDepartmentId || requisition.departmentId,
          toDeptId: returnTargetId,
          action: returnToSender ? 'returned' : 'forwarded',
          note: note || null,
          actorName: req.user?.name || 'Department'
        }
      });
    } catch (fwdErr) { logger.warn('[FWD] Forward event creation failed:', fwdErr.message); }

    await prisma.activityLog.create({
      data: {
        userId: getNumericUserId(req.user) || null,
        action: returnToSender ? 'Requisition Returned' : 'Requisition Forwarded',
        details: `Req #${id}: ${returnToSender ? 'returned to sender' : `forwarded to dept #${newTargetId}`}. Note: ${note || 'none'}`
      }
    });

    // Notify new target dept if applicable
    if (!returnToSender && newTargetId) {
      await notifyDepartmentHead({
        departmentId: newTargetId,
        requisition: updated,
        subject: `📋 Forwarded Requisition: ${updated.title}`,
        lines: [
          `Originally From: ${updated.department?.name || 'Department'}`,
          `Forwarded By: ${requisition.targetDepartment?.name || 'Department'}`,
          `Type: ${updated.type}`,
          amountLine(updated.type, updated.amount),
          note ? `Note: ${note}` : null,
          ``,
          `Please log in to your dashboard to review and respond.`
        ].filter(Boolean)
      });
    }

    // Notify original sender dept on return
    if (returnToSender && updated.departmentId) {
      await notifyDepartmentHead({
        departmentId: updated.departmentId,
        requisition: updated,
        subject: `⚠️ Requisition Returned: ${updated.title}`,
        lines: [
          `Your requisition has been returned for clarification.`,
          `Returned By: ${requisition.targetDepartment?.name || 'Department'}`,
          note ? `Reason: ${note}` : `Please review the requisition for details.`,
          ``,
          `Log in to update the requisition and re-submit.`
        ].filter(Boolean)
      });
    }

    res.json(updated);
  } catch (error) { sendError(res, 500, error.message); }
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
    if (!requisition) return res.status(404).json({ error: 'Requisition not found.' });
    if (!requisition.signedPdfKey) {
      return res.status(404).json({ error: 'This requisition does not have a signed copy yet. It must be fully approved before a signed document is generated.' });
    }
    // All authenticated users (including target departments) may download the signed copy
    const stream = await getObjectStream(requisition.signedPdfKey);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="signed-requisition-${id}.pdf"`);
    stream.pipe(res);
  } catch (error) {
    logger.error('[SIGNED PDF] Error:', error.message);
    res.status(500).json({ error: 'Unable to retrieve the signed document. Please try again.' });
  }
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
  } catch (error) { sendError(res, 500, error.message); }
});

// ── DEPARTMENT PROFILE & GOVERNANCE ROUTES ───────────────────────────────────

app.get('/api/department/profile', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'department' || !req.user.deptId) {
      return res.status(403).json({ error: 'Only department accounts can access this profile' });
    }
    const dept = await prisma.department.findUnique({
      where: { id: req.user.deptId }
    });
    // Determine if head official signature is ready
    const headUser = dept?.headEmail ? await prisma.user.findFirst({
      where: { email: dept.headEmail },
      include: { signature: true }
    }) : null;

    res.json({
      ...dept,
      hasSignature: !!headUser?.signature
    });
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
});

app.get('/api/requisitions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const requisition = await prisma.requisition.findUnique({
      where: { id: parseInt(id) },
      include: {
        department:       { select: { name: true, code: true, headName: true, headEmail: true } },
        targetDepartment: { select: { name: true, code: true, headEmail: true, headName: true } },
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
        },
        forwardEvents: {
          include: {
            fromDepartment: { select: { name: true, code: true } },
            toDepartment:   { select: { name: true, code: true } }
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
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    res.json(requisition);
  } catch (error) { sendError(res, 500, error.message); }
});

app.get('/api/requisitions/:id/dynamic-pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const upToEventId = req.query.upToEventId || null; // Optional stage filter

    const requisition = await prisma.requisition.findUnique({
      where: { id: parseInt(id) },
      include: {
        department: { include: { stamp: true } },
        targetDepartment: { include: { stamp: true } },
        approvals: {
          include: {
            stage: true,
            user: { include: { signature: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        forwardEvents: {
          include: {
            fromDepartment: { include: { stamp: true } },
            toDepartment:   { include: { stamp: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!requisition) return res.status(404).json({ error: 'Requisition not found' });

    // ── Stage filtering ────────────────────────────────
    let filteredApprovals = requisition.approvals || [];
    let filteredEvents    = requisition.forwardEvents || [];

    if (upToEventId) {
      if (upToEventId.startsWith('fwd-')) {
        const eventId = parseInt(upToEventId.replace('fwd-', ''));
        const cutIdx = filteredEvents.findIndex(e => e.id === eventId);
        if (cutIdx >= 0) filteredEvents = filteredEvents.slice(0, cutIdx + 1);
      } else if (upToEventId.startsWith('app-')) {
        const appId = parseInt(upToEventId.replace('app-', ''));
        const cutIdx = filteredApprovals.findIndex(a => a.id === appId);
        if (cutIdx >= 0) filteredApprovals = filteredApprovals.slice(0, cutIdx + 1);
      }
    }

    // ── PDF Setup ──────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    const font       = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const A4_W = 595.28, A4_H = 841.89;
    const margin = 50;
    const contentWidth = A4_W - margin * 2;
    const isMemo = requisition.type === 'Memo';
    const isFinancial = requisition.type === 'Cash' || (requisition.amount && requisition.amount > 0);
    let pageNumber = 0;
    let page, y;

    // ── Helper: Add new page with header ────────────────
    const addPage = () => {
      pageNumber++;
      page = pdfDoc.addPage([A4_W, A4_H]);
      y = A4_H - margin;
      // footer on every page
      return page;
    };

    // ── Helper: Check remaining space, add page if needed ──
    const ensureSpace = (needed = 40) => {
      if (y < margin + needed) {
        // page footer
        const pgText = `Page ${pageNumber}`;
        page.drawText(pgText, { x: A4_W / 2 - font.widthOfTextAtSize(pgText, 8) / 2, y: 20, size: 8, font: italicFont, color: rgb(0.5, 0.5, 0.5) });
        addPage();
        return true;
      }
      return false;
    };

    // ── Helper: Draw wrapped text block ─────────────────
    const drawWrappedText = (text, opts = {}) => {
      const { fontSize = 10, textFont = font, indent = 0, lineHeight = 14, maxWidth = contentWidth - indent } = opts;
      const charsPerLine = Math.floor(maxWidth / (textFont.widthOfTextAtSize('M', fontSize) * 0.55));
      const words = text.split(/\s+/);
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (testLine.length > charsPerLine && currentLine) {
          ensureSpace(lineHeight + 5);
          page.drawText(currentLine, { x: margin + indent, y, size: fontSize, font: textFont });
          y -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        ensureSpace(lineHeight + 5);
        page.drawText(currentLine, { x: margin + indent, y, size: fontSize, font: textFont });
        y -= lineHeight;
      }
    };

    // ── Helper: Sanitize text for pdf-lib standard fonts (WinAnsi only) ────
    // Standard fonts (Helvetica etc.) only support Latin-1 / WinAnsi.
    // Any character outside that range causes a hard crash. Replace common
    // offenders and strip anything else outside the printable Latin-1 range.
    const sanitizeText = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/₦/g, 'NGN')
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .replace(/–/g, '-')
        .replace(/—/g, '-')
        .replace(/…/g, '...')
        .replace(/•/g, '-')
        .replace(/[^\x20-\xFF]/g, '?'); // replace any remaining non-WinAnsi
    };

    // ── Helper: Strip HTML tags to plain text ────────────
    const stripHtml = (html) => {
      if (!html) return '';
      return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    // ── Helper: Draw a horizontal rule ──────────────────
    const drawHR = (thickness = 0.5, color = rgb(0.7, 0.7, 0.7)) => {
      page.drawLine({ start: { x: margin, y }, end: { x: A4_W - margin, y }, thickness, color });
      y -= 15;
    };

    // ── Helper: Embed image safely ──────────────────────
    const embedSafe = async (bytes) => {
      if (!bytes) return null;
      try { return await pdfDoc.embedPng(bytes); }
      catch (_) {
        try { return await pdfDoc.embedJpg(bytes); }
        catch (__) { return null; }
      }
    };

    // ══════════════════════════════════════════════════════
    // PAGE 1: DOCUMENT HEADER
    // ══════════════════════════════════════════════════════
    addPage();

    // ── Logo ────────────────────────────────────────────
    try {
      const logoPath = path.join(__dirname, 'samples', 'logo.jpg');
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath);
        const logoImage = await pdfDoc.embedJpg(logoBytes);
        const logoDims = logoImage.scale(0.2);
        page.drawImage(logoImage, { x: margin, y: y - logoDims.height + 10, width: logoDims.width, height: logoDims.height });
      }
    } catch (e) { /* logo skip */ }

    // ── Company Header ──────────────────────────────────
    page.drawText('CSS GLOBAL INTEGRATED FARMS LTD', { x: 150, y: y - 5, size: 14, font: boldFont, color: rgb(0.1, 0.22, 0.43) });
    page.drawText('Km 10, Abuja-Keffi Expressway, Salamu Road, Gora, Nasarawa State.', { x: 150, y: y - 20, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('www.cssgroup.com.ng  |  info@cssgroup.com.ng  |  +234 702 603 3333', { x: 150, y: y - 32, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

    y -= 55;
    page.drawLine({ start: { x: margin, y }, end: { x: A4_W - margin, y }, thickness: 2, color: rgb(0.1, 0.22, 0.43) });
    y -= 25;

    // ── Document Title ──────────────────────────────────
    const docTitle = isMemo ? 'INTERNAL MEMORANDUM' : 'REQUISITION VOUCHER';
    const titleWidth = boldFont.widthOfTextAtSize(docTitle, 16);
    page.drawText(docTitle, { x: A4_W / 2 - titleWidth / 2, y, size: 16, font: boldFont });
    y -= 8;
    // Underline
    page.drawLine({ start: { x: A4_W / 2 - titleWidth / 2 - 5, y }, end: { x: A4_W / 2 + titleWidth / 2 + 5, y }, thickness: 1, color: rgb(0.1, 0.1, 0.1) });
    y -= 30;

    // ══════════════════════════════════════════════════════
    // META BLOCK
    // ══════════════════════════════════════════════════════
    const deptCode = (requisition.department?.code || 'CSS').toUpperCase();
    const createdDate = new Date(requisition.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();

    // ── Compute FROM / TO based on the filtered chain ──────
    // FROM: always the original creator
    const fromDeptName = sanitizeText((requisition.department?.name || 'ORIGIN DEPARTMENT').toUpperCase());

    // TO: all unique external departments that appear in filteredEvents (ordered by first appearance),
    // joined with "/" so a chain ISAC→FPP→HR shows "FPP/HR" regardless of returns/tossing.
    const originDeptId = requisition.departmentId;
    const externalDeptMap = new Map(); // deptId → dept object, insertion-ordered
    for (const evt of filteredEvents) {
      if (evt.toDeptId && evt.toDeptId !== originDeptId && evt.toDepartment && !externalDeptMap.has(evt.toDeptId)) {
        externalDeptMap.set(evt.toDeptId, evt.toDepartment);
      }
      if (evt.fromDeptId && evt.fromDeptId !== originDeptId && evt.fromDepartment && !externalDeptMap.has(evt.fromDeptId)) {
        externalDeptMap.set(evt.fromDeptId, evt.fromDepartment);
      }
    }
    const externalDepts = [...externalDeptMap.values()];
    const toDeptName = externalDepts.length > 0
      ? sanitizeText(externalDepts.map(d => d.name).join('/').toUpperCase())
      : sanitizeText((requisition.targetDepartment?.name || 'PROCESSING DEPARTMENT').toUpperCase());

    // All signatories: originating dept + every external dept in the chain (deduped, ordered)
    const signatoryDepts = [requisition.department, ...externalDepts].filter(Boolean);

    if (isMemo) {
      // Memo-style header
      const memoFields = [
        { label: 'REF:', value: `CSSG/${deptCode}/MO/${String(id).padStart(3, '0')}` },
        { label: 'DATE:', value: createdDate },
        { label: 'TO:', value: toDeptName },
        { label: 'FROM:', value: fromDeptName },
        { label: 'SUBJECT:', value: sanitizeText((requisition.title || 'Untitled').toUpperCase()) },
      ];
      for (const f of memoFields) {
        page.drawText(f.label, { x: margin, y, size: 10, font: boldFont });
        page.drawText(f.value, { x: margin + 70, y, size: 10, font: f.label === 'SUBJECT:' ? boldFont : font });
        y -= 18;
      }
      y -= 5;
      page.drawLine({ start: { x: margin, y }, end: { x: A4_W - margin, y }, thickness: 1.5 });
      y -= 20;
    } else {
      // Requisition Voucher header
      const leftFields = [
        { label: 'Voucher No:', value: `#${id}` },
        { label: 'From:', value: sanitizeText(requisition.department?.name || 'Origin Department') },
        { label: 'To:', value: sanitizeText(externalDepts.length > 0 ? externalDepts.map(d => d.name).join('/') : (requisition.targetDepartment?.name || 'Processing Department')) },
        { label: 'Title:', value: sanitizeText(requisition.title || 'Untitled') },
        { label: 'Type:', value: sanitizeText(requisition.type || 'General') },
        { label: 'Urgency:', value: (requisition.urgency || 'normal').toUpperCase() },
      ];
      // Right side: Date + Amount
      page.drawText(`Date: ${createdDate}`, { x: A4_W - margin - 200, y, size: 10, font: boldFont });
      if (isFinancial) {
        page.drawText(`Amount: NGN ${Number(requisition.amount || 0).toLocaleString()}`, { x: A4_W - margin - 200, y: y - 18, size: 11, font: boldFont, color: rgb(0.1, 0.22, 0.43) });
      }

      for (const f of leftFields) {
        page.drawText(`${f.label}`, { x: margin, y, size: 10, font: boldFont });
        page.drawText(f.value, { x: margin + 85, y, size: 10, font });
        y -= 17;
      }
      y -= 10;
      drawHR(1);
    }

    // ══════════════════════════════════════════════════════
    // CONTENT BODY
    // ══════════════════════════════════════════════════════
    ensureSpace(60);
    page.drawText(isMemo ? 'BODY:' : 'DESCRIPTION / CONTENT:', { x: margin, y, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    y -= 18;

    // Prefer rich HTML content (from Document Studio), fallback to plain description
    const rawContent = requisition.content || requisition.description || 'No content provided.';
    const plainContent = sanitizeText(stripHtml(rawContent));
    const paragraphs = plainContent.split(/\n+/).filter(Boolean);

    for (const para of paragraphs) {
      ensureSpace(20);
      drawWrappedText(para, { indent: isMemo ? 20 : 5 });
      y -= 5;
    }

    // ── Amount block (for Requisition Voucher only) ─────
    if (!isMemo && isFinancial) {
      y -= 10;
      ensureSpace(40);
      page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: A4_W - margin, y: y + 8 }, thickness: 0.5 });
      const amtLabel = 'TOTAL AMOUNT:';
      const amtValue = `NGN ${Number(requisition.amount).toLocaleString()}`;
      page.drawText(amtLabel, { x: margin, y, size: 12, font: boldFont });
      page.drawText(amtValue, { x: A4_W - margin - boldFont.widthOfTextAtSize(amtValue, 12), y, size: 12, font: boldFont, color: rgb(0.1, 0.22, 0.43) });
      y -= 25;
    }

    // ══════════════════════════════════════════════════════
    // PROCESSING CHAIN (ForwardEvents)
    // ══════════════════════════════════════════════════════
    if (filteredEvents.length > 0) {
      ensureSpace(60);
      y -= 10;
      drawHR(1, rgb(0.1, 0.22, 0.43));
      page.drawText('PROCESSING CHAIN — FILE MOVEMENT HISTORY', { x: margin, y, size: 10, font: boldFont, color: rgb(0.1, 0.22, 0.43) });
      y -= 20;

      for (let i = 0; i < filteredEvents.length; i++) {
        const evt = filteredEvents[i];
        ensureSpace(50);
        
        const actionLabel = evt.action === 'created' ? 'CREATED' : evt.action === 'forwarded' ? 'FORWARDED' : 'RETURNED';
        const fromName = sanitizeText(evt.fromDepartment?.name || 'Department');
        const toName   = sanitizeText(evt.toDepartment?.name   || 'Sender');
        const dateStr  = new Date(evt.createdAt).toLocaleString();

        // Step number + action
        page.drawText(`${i + 1}.`, { x: margin, y, size: 9, font: boldFont });
        page.drawText(`[${actionLabel}]`, { x: margin + 15, y, size: 9, font: boldFont, color: evt.action === 'returned' ? rgb(0.8, 0.4, 0) : rgb(0.1, 0.5, 0.2) });
        page.drawText(`${fromName}  ->  ${toName}`, { x: margin + 85, y, size: 9, font });
        y -= 13;

        page.drawText(`Date: ${dateStr}`, { x: margin + 30, y, size: 8, font: italicFont, color: rgb(0.4, 0.4, 0.4) });
        if (evt.actorName) {
          page.drawText(sanitizeText(`By: ${evt.actorName}`), { x: margin + 250, y, size: 8, font: italicFont, color: rgb(0.4, 0.4, 0.4) });
        }
        y -= 13;

        // Comment/note
        if (evt.note) {
          ensureSpace(20);
          page.drawText(sanitizeText(`Comment: "${evt.note}"`), { x: margin + 30, y, size: 8, font: italicFont, color: rgb(0.2, 0.2, 0.2) });
          y -= 13;
        }

        // Embed department stamp for this stage
        const deptForStamp = evt.action === 'returned' ? evt.fromDepartment : evt.toDepartment;
        if (deptForStamp?.stamp?.imageKey) {
          try {
            const stampBuffer = await getObjectBuffer(deptForStamp.stamp.imageKey);
            const stampImg = await embedSafe(stampBuffer);
            if (stampImg) {
              ensureSpace(40);
              const dims = stampImg.scale(0.12);
              page.drawImage(stampImg, { x: A4_W - margin - dims.width - 5, y: y - 5, width: dims.width, height: dims.height, opacity: 0.6 });
              page.drawText(deptForStamp.name || '', { x: A4_W - margin - dims.width - 5, y: y - dims.height - 10, size: 6, font: italicFont, color: rgb(0.4, 0.4, 0.4) });
            }
          } catch (_) { /* stamp embed skip */ }
        }
        y -= 8;
      }
    }

    // ══════════════════════════════════════════════════════
    // APPROVAL TRAIL (Admin Workflow)
    // ══════════════════════════════════════════════════════
    if (filteredApprovals.length > 0) {
      ensureSpace(60);
      y -= 10;
      drawHR(1, rgb(0.1, 0.22, 0.43));
      page.drawText('AUTHORIZATION & APPROVAL TRAIL', { x: margin, y, size: 10, font: boldFont, color: rgb(0.1, 0.22, 0.43) });
      y -= 20;

      for (const app of filteredApprovals) {
        ensureSpace(60);
        const stamp = new Date(app.createdAt).toLocaleString();
        const stageName = app.stage?.name || 'Processed';
        const actionLabel = app.action.toUpperCase();
        const userName = app.user?.name || 'Approver';

        page.drawText(`[${actionLabel}]`, { x: margin, y, size: 9, font: boldFont, color: app.action === 'approved' ? rgb(0.1, 0.5, 0.2) : rgb(0.8, 0.1, 0.1) });
        page.drawText(sanitizeText(`${stageName} by ${userName}`), { x: margin + 80, y, size: 9, font });
        y -= 13;
        page.drawText(`Date: ${stamp}`, { x: margin + 20, y, size: 8, font: italicFont, color: rgb(0.4, 0.4, 0.4) });
        y -= 13;

        if (app.remarks) {
          page.drawText(sanitizeText(`Remarks: "${app.remarks}"`), { x: margin + 20, y, size: 8, font: italicFont });
          y -= 13;
        }

        // Embed approver's digital signature
        const isSuperAdmin = app.user?.role === 'global_admin' || app.user?.email === SUPER_ADMIN_EMAIL;
        if (app.user?.signature?.imageKey) {
          try {
            const sigBuf = await getObjectBuffer(app.user.signature.imageKey);
            const sigImg = await embedSafe(sigBuf);
            if (sigImg) {
              ensureSpace(35);
              const dims = sigImg.scale(0.13);
              page.drawImage(sigImg, { x: A4_W - margin - dims.width - 10, y: y, width: dims.width, height: dims.height, opacity: 0.85 });
              page.drawText(`${userName}`, { x: A4_W - margin - dims.width - 10, y: y - 8, size: 6, font: italicFont, color: rgb(0.4, 0.4, 0.4) });
              if (isSuperAdmin) {
                page.drawText('TRADE MARK', { x: A4_W - margin - 50, y: y - 16, size: 5, font: boldFont, color: rgb(0.1, 0.3, 0.7) });
              }
            }
          } catch (_) { /* sig skip */ }
        } else if (isSuperAdmin) {
          // Fallback: Trade Mark seal for admin without uploaded signature
          ensureSpace(25);
          const tmText = 'GLOBAL AUTHORITY — TRADE MARK';
          const tmWidth = font.widthOfTextAtSize(tmText, 7);
          page.drawRectangle({ x: A4_W - margin - tmWidth - 20, y: y - 3, width: tmWidth + 14, height: 16, borderColor: rgb(0.1, 0.3, 0.7), borderWidth: 1, opacity: 0.8 });
          page.drawText(tmText, { x: A4_W - margin - tmWidth - 13, y: y + 2, size: 7, font: boldFont, color: rgb(0.1, 0.3, 0.7) });
        }
        y -= 15;
      }
    }

    // ══════════════════════════════════════════════════════
    // SIGNATURES — one entry per department in the chain
    // Auto-fills the uploaded digital signature of each dept's head user.
    // Falls back to a blank line if no signature has been uploaded.
    // ══════════════════════════════════════════════════════

    // Pre-fetch head user signatures for every signatory department
    const deptSignatureMap = new Map(); // deptId → { sigImg, sigDims, stampImg, stampDims }
    for (const dept of signatoryDepts) {
      if (!dept) continue;
      const entry = { sigImg: null, sigDims: null, stampImg: null, stampDims: null };

      // Head user's digital signature (uploaded via Dept Profile → Signature)
      if (dept.headEmail) {
        try {
          const headUser = await prisma.user.findFirst({
            where: { email: dept.headEmail },
            include: { signature: true }
          });
          if (headUser?.signature?.imageKey) {
            const sigBuf = await getObjectBuffer(headUser.signature.imageKey);
            const img = await embedSafe(sigBuf);
            if (img) { entry.sigImg = img; entry.sigDims = img.scale(0.18); }
          }
        } catch (_) {}
      }

      // Department seal / stamp (shown as a watermark behind/beside the signature)
      if (dept.stamp?.imageKey) {
        try {
          const stampBuf = await getObjectBuffer(dept.stamp.imageKey);
          const img = await embedSafe(stampBuf);
          if (img) { entry.stampImg = img; entry.stampDims = img.scale(0.13); }
        } catch (_) {}
      }

      deptSignatureMap.set(dept.id, entry);
    }

    const sigRowHeight = 70;
    ensureSpace(30 + signatoryDepts.length * sigRowHeight);
    y -= 15;
    drawHR(0.5);
    page.drawText('SIGNATURES', { x: margin, y, size: 10, font: boldFont, color: rgb(0.1, 0.22, 0.43) });
    y -= 22;

    const colWidth = contentWidth / 2;
    let colIndex = 0;

    for (const dept of signatoryDepts) {
      if (!dept) continue;
      const colX = margin + colIndex * colWidth;
      ensureSpace(sigRowHeight + 10);

      const assets = deptSignatureMap.get(dept.id) || {};
      const { sigImg, sigDims, stampImg, stampDims } = assets;

      const rowStartY = y;

      // 1. Draw the uploaded digital signature image above the line
      if (sigImg && sigDims) {
        page.drawImage(sigImg, {
          x: colX,
          y: rowStartY - sigDims.height,
          width: sigDims.width,
          height: sigDims.height,
          opacity: 0.9
        });
      }

      // 2. Draw department stamp as a small watermark to the right of the signature
      if (stampImg && stampDims) {
        page.drawImage(stampImg, {
          x: colX + (sigDims ? sigDims.width + 6 : 0),
          y: rowStartY - stampDims.height,
          width: stampDims.width,
          height: stampDims.height,
          opacity: 0.5
        });
      }

      // 3. Signature line (drawn below the image area)
      const imageHeight = Math.max(sigDims?.height || 0, stampDims?.height || 0, 30);
      const sigLineY = rowStartY - imageHeight - 6;
      page.drawLine({
        start: { x: colX, y: sigLineY },
        end:   { x: colX + colWidth - 20, y: sigLineY },
        thickness: 0.5,
        color: rgb(0.5, 0.5, 0.5)
      });

      // 4. Head name and department label below the line
      const headName  = sanitizeText(dept?.headName || '________________________');
      const deptLabel = sanitizeText(dept?.name || '');
      page.drawText(headName,        { x: colX, y: sigLineY - 13, size: 9, font: boldFont });
      page.drawText(`(${deptLabel})`, { x: colX, y: sigLineY - 24, size: 8, font: italicFont, color: rgb(0.4, 0.4, 0.4) });

      colIndex++;
      if (colIndex >= 2) {
        colIndex = 0;
        y -= sigRowHeight + 10;
      }
    }

    if (colIndex !== 0) y -= sigRowHeight + 10;
    y -= 10;

    // ── Final Footer ────────────────────────────────────
    const footerText = `Generated by CSS-RMS on ${new Date().toLocaleString()} | Page ${pageNumber}`;
    page.drawText(footerText, { x: A4_W / 2 - font.widthOfTextAtSize(footerText, 7) / 2, y: 20, size: 7, font: italicFont, color: rgb(0.5, 0.5, 0.5) });

    // ── Serve PDF ───────────────────────────────────────
    const pdfBytes = await pdfDoc.save();
    const fileName = isMemo ? `CSS-MEMO-${id}.pdf` : `CSS-REQUISITION-${id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
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
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
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
  } catch (error) { sendError(res, 500, error.message); }
});

app.get('/api/attachments/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const attachment = await prisma.attachment.findUnique({ 
      where: { id: parseInt(id) },
      include: { requisition: true }
    });
    if (!attachment) return res.status(404).json({ error: 'File not found' });
    // Allow access for both originating AND target department
    if (req.user.role === 'department' && req.user.deptId
        && attachment.requisition?.departmentId !== req.user.deptId
        && attachment.requisition?.targetDepartmentId !== req.user.deptId) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
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
  } catch (error) { sendError(res, 500, error.message); }
});

// File Preview (inline rendering instead of forced download)
app.get('/api/attachments/:id/preview', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const attachment = await prisma.attachment.findUnique({ 
      where: { id: parseInt(id) },
      include: { requisition: true }
    });
    if (!attachment) return res.status(404).json({ error: 'File not found' });
    if (req.user.role === 'department' && req.user.deptId
        && attachment.requisition?.departmentId !== req.user.deptId
        && attachment.requisition?.targetDepartmentId !== req.user.deptId) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    if (!attachment.storageKey) return res.status(404).json({ error: 'File missing from storage' });
    const stream = await getObjectStream(attachment.storageKey);
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${attachment.filename}"`);
    stream.pipe(res);
  } catch (error) { sendError(res, 500, error.message); }
});

// ── EMAIL TEST ENDPOINT (Admin only) ──
app.post('/api/test-email', authenticateToken, requireRoles(['global_admin']), async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'Please provide a "to" email address.' });
    logger.info(`[MAIL-TEST] Attempting test email to: ${to}`);
    logger.info(`[MAIL-TEST] GMAIL_USER=${process.env.GMAIL_USER || 'NOT SET'}`);
    logger.info(`[MAIL-TEST] GMAIL_APP_PASSWORD=${process.env.GMAIL_APP_PASSWORD ? 'SET (' + process.env.GMAIL_APP_PASSWORD.length + ' chars)' : 'NOT SET'}`);
    const { text, html } = buildEmailContent({
      title: 'CSS RMS — Email Test',
      lines: [
        'This is a test email from the CSS RMS platform.',
        `Sent at: ${new Date().toLocaleString()}`,
        'If you receive this, email notifications are working correctly.'
      ],
      actionUrl: APP_BASE_URL || '',
      actionLabel: 'Open RMS Dashboard'
    });
    const result = await sendEmail({ to, subject: 'CSS RMS — Email Delivery Test', text, html });
    if (result && result.skipped) {
      logger.warn('[MAIL-TEST] SKIPPED — transport not configured');
      return res.json({ success: false, message: 'Email transport not configured. Check GMAIL_USER and GMAIL_APP_PASSWORD env vars.' });
    }
    logger.info(`[MAIL-TEST] ✅ Test email sent to ${to}`);
    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (error) {
    logger.error('[MAIL-TEST] FAILED:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Requisition Attachments List
app.get('/api/requisitions/:id/attachments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'department' && req.user.deptId) {
      const reqCheck = await prisma.requisition.findUnique({ where: { id: parseInt(id) } });
      // Allow both the creator department AND any target department to view attachments
      if (!reqCheck || (reqCheck.departmentId !== req.user.deptId && reqCheck.targetDepartmentId !== req.user.deptId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    const attachments = await prisma.attachment.findMany({
      where: { requisitionId: parseInt(id) },
      include: { uploadedBy: { select: { name: true } } }
    });
    res.json(attachments);
  } catch (error) { sendError(res, 500, error.message); }
});

// ── AI VOICE TRANSCRIPTION (Whisper Fallback) ──
app.post('/api/ai/transcribe', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided.' });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'AI features are not configured.' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Convert buffer to a File-like object for OpenAI SDK
    const audioFile = new File([req.file.buffer], 'recording.webm', { 
      type: req.file.mimetype || 'audio/webm' 
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    });

    res.json({ text: transcription || '' });
  } catch (error) {
    logger.error('Whisper Transcription Error:', error);
    res.status(500).json({ error: 'Audio transcription failed.', details: error.message });
  }
});

// ── AI INTELLIGENT REFINEMENT & VALIDATION ──
app.post('/api/ai/refine-requisition', authenticateToken, async (req, res) => {
  try {
    const { rawDescription, mode } = req.body;
    if (!rawDescription || rawDescription.trim().length < 5) {
      return res.status(400).json({ error: 'Input is too short. Please describe your request more clearly before refining.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'AI features are not configured. Please contact the administrator.' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const isProMode = mode === 'pro';
    const isReviewMode = mode === 'review';

    // Review/comment mode: no validity gating — just polish grammar and professional tone
    if (isReviewMode) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional corporate communications editor.
Your only job is to fix spelling, grammar, and tone in a review comment or response note written by a department officer in a Requisition Management System.
Keep the original meaning exactly — do not add, remove, or change any facts or requests.
Make it polite, concise, and professional.
Return ONLY a JSON object: { "refinedDescription": string, "actionReason": string }
The actionReason should be a short one-sentence note on what you improved (e.g. "Fixed spelling and improved formal tone.").`
          },
          { role: 'user', content: rawDescription }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.15,
      });
      const data = JSON.parse(response.choices[0].message.content);
      return res.json({
        isValid: true,
        refinedDescription: xss(data.refinedDescription || rawDescription),
        actionReason: xss(data.actionReason || 'Note professionally refined by AI.'),
        recommendedAction: 'submit',
        totalAmount: 0,
        documentType: 'Memo',
        validationMessage: ''
      });
    }

    const SYSTEM_PROMPT = isProMode
      ? `You are a senior document editor for a corporate Requisition Management System (RMS).
Your job is to review and polish a user-submitted document.

CRITICAL RULE — NO PLACEHOLDER BRACKETS:
Never write [Name], [Your Name], [Date], [reason], or any square-bracket placeholder. Only use what the user actually provided.

STEP 1 — VALIDITY CHECK:
Determine if the input is a legitimate organisational document or request. Reject it if:
- It is random characters, keyboard mashing, or clearly nonsensical (e.g. "asdfgh", "test test 123 abc")
- It is entirely personal/social content with zero work relevance
- It is too vague or short to form any coherent request (e.g. "please help me")
- It appears to be someone testing the system with fake/dummy content

STEP 2 — CLASSIFICATION:
- "Cash" → itemised procurement, budget requests, or requests for money/funds
- "Memo" → administrative notice, internal communication, leave request, policy, penalty, or any non-monetary organisational request

STEP 3 — RECOMMENDED ACTION:
Based on the content, suggest:
- "submit" → ready to be submitted and processed normally
- "forward" → requires review or input from another department before submission
- "draft" → needs more detail or clarification from the requester before submitting
- "blocked" → content is invalid, gibberish, or cannot be processed

Return ONLY a JSON object:
{
  "isValid": boolean,
  "validationMessage": string,
  "refinedDescription": string,
  "totalAmount": number,
  "documentType": "Cash" | "Memo",
  "recommendedAction": "submit" | "forward" | "draft" | "blocked",
  "actionReason": string
}`
      : `You are an intelligent corporate Requisition Management assistant for CSS Global Integrated Farms Ltd.
Your role is to validate, refine, and intelligently classify incoming requisition drafts submitted by staff.

CRITICAL RULE — NO PLACEHOLDER BRACKETS:
Never write [Name], [Manager's Name], [Your Name], [Date], [start date], [reason], or any square-bracket placeholder.
Only write what the user actually provided. If a detail is missing, leave it as a natural gap in the sentence or omit it.

STEP 1 — VALIDITY CHECK (most important):
Reject content if it is:
- Random letters, numbers, or keyboard mashing (e.g. "qwerty", "aaaaa bbb ccc", "1234567")
- Voice recordings that produced pure noise/gibberish with no recognisable words
- Completely off-topic personal content (e.g. social conversation, jokes, insults)
- A single vague word or phrase with no context (e.g. "help", "please", "urgent thing")
- Clearly a system test without real intent (e.g. "test test test", "abc xyz 123")
Set isValid to false and recommendedAction to "blocked" in these cases.

STEP 2 — CLASSIFICATION (only if valid):
- "Cash" → requests involving purchasing, procurement, budgeting, or funding (even if no price is given)
- "Memo" → administrative requests: leave applications, notices, internal communications, approvals, policies, complaints

STEP 3 — REFINEMENT (only if valid):
Write only what the user told you. Do not invent names, dates, reasons, or details.
- For Cash: format as a professional requisition using only the items/amounts the user mentioned. If no price, set totalAmount to 0.
- For Memo: write a short, direct professional statement of the request using only what was provided. Do NOT write a full letter with greeting/closing. Just a clear, formal paragraph.

STEP 4 — RECOMMENDED ACTION:
- "submit" → all key details are present (who, what, when/why) and it is ready to route
- "forward" → needs another department's involvement before it can be processed
- "draft" → the intent is clear but essential details are missing (e.g. no dates, no reason, no amounts). List exactly what is missing in actionReason.
- "blocked" → invalid or unprocessable content

For leave requests: if no start date, end date, or reason is provided → set recommendedAction to "draft".
For purchase requests: if no items or amounts are specified → set recommendedAction to "draft".

Return ONLY a JSON object (no extra text):
{
  "isValid": boolean,
  "validationMessage": string,
  "refinedDescription": string,
  "totalAmount": number,
  "documentType": "Cash" | "Memo",
  "recommendedAction": "submit" | "forward" | "draft" | "blocked",
  "actionReason": string
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawDescription }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('Empty response from OpenAI');
    }

    const aiData = JSON.parse(response.choices[0].message.content);

    // If the AI flagged the content as invalid, return early with a user-friendly block
    if (aiData.isValid === false || aiData.recommendedAction === 'blocked') {
      return res.status(422).json({
        blocked: true,
        validationMessage: aiData.validationMessage || 'Your input could not be processed. Please describe your request clearly and professionally.',
        actionReason: aiData.actionReason || 'The content does not appear to be a valid organisational request.'
      });
    }

    return res.json({
      isValid: true,
      refinedDescription: xss(aiData.refinedDescription || aiData.description || ''),
      totalAmount: Number(aiData.totalAmount) || 0,
      documentType: aiData.documentType === 'Memo' ? 'Memo' : 'Cash',
      recommendedAction: aiData.recommendedAction || 'submit',
      actionReason: xss(aiData.actionReason || ''),
      validationMessage: xss(aiData.validationMessage || '')
    });
  } catch (error) {
    logger.error('OpenAI Refinement Error:', error);
    console.error('[AI_REFINEMENT_ERROR]', error.message, error.stack);
    const status = error.status || 500;
    res.status(status).json({
      error: 'AI processing failed. Please try again or submit your request manually.',
      details: error.message
    });
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
  logger.info(`🚀 CSS RMS Unified Node listening on port ${PORT}`);

  // Background Boot Sequence (Allows instant PORT binding for Railway health checks)
  const { exec } = require('child_process');
  const runSetup = (cmd) => new Promise((resolve) => {
    const p = exec(cmd);
    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);
    p.on('exit', () => resolve());
  });

  try {
    if (process.env.SKIP_DB_BOOT === 'true') {
      logger.info('[BOOT] Skipping DB sync as requested');
      isSystemReady = true;
    } else {
      logger.info('[BOOT] Synchronizing database schema...');
      // Note: --accept-data-loss is used for rapid UAT iteration; usually avoided in rigid production
      await runSetup('npx prisma db push --schema=rms_backend/prisma/schema.prisma --accept-data-loss');
      
      logger.info('[BOOT] Seeding core authority records...');
      await runSetup('node rms_backend/prisma/seed.js');
      
      // Secondary setup tasks already in serve.js logic
      try {
        await ensureActivePublicKey();
        logger.info('[BOOT] Active signing key ensured');
      } catch (e) {
        logger.warn('[BOOT] Signing key check deferred:', e.message);
      }

      isSystemReady = true;
      logger.info('✅ [SYSTEM READY] Requisition Management Service fully operational.');
    }
  } catch (err) {
    logger.error('[BOOT CRITICAL] Database sync failed:', err.message);
    // Allowing the server to stay up allows the user to see logs
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
