const express = require('express');
const path = require('path');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const multer = require('multer');
const fs = require('fs');

const app = express();
const prisma = new PrismaClient();

// Configure Multer for File Uploads
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// ── BACKEND API ROUTES ──
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

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

// Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, include: { department: true } });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
    const userData = { id: user.id, email: user.email, name: user.name, role: user.role, department: user.department?.name || 'General' };
    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '12h' });
    await prisma.activityLog.create({ data: { action: 'Logged In', details: `${user.name} (Admin) authenticated`, userId: user.id } });
    res.json({ token, user: userData });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/auth/dept-login', async (req, res) => {
  try {
    const { departmentName, accessCode, mfaCode } = req.body;
    
    if (departmentName === 'Super Admin') {
      if (accessCode !== 'admin123') return res.status(401).json({ error: 'Invalid Super Admin Access Code' });
      if (mfaCode !== '123456') return res.status(401).json({ error: 'Invalid MFA PIN' });
      
      const token = jwt.sign({ id: 0, name: 'Super Admin', role: 'global_admin', deptId: 0 }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token, user: { id: 0, name: 'Super Admin', role: 'global_admin', deptId: 0 } });
    }

    console.log(`[AUTH] Unified login attempt: "${departmentName?.trim()}"`);
    
    const dept = await prisma.department.findFirst({ 
      where: { 
        name: { equals: departmentName?.trim(), mode: 'insensitive' }, 
        accessCode: accessCode?.trim() 
      } 
    });
    
    if (!dept) {
      console.warn(`[AUTH] Failed: ${departmentName} / ${accessCode}`);
      return res.status(401).json({ error: 'Invalid Department or Access Code' });
    }
    
    // Unified Role Logic: "Super Admin" department gets 'global_admin' role
    const isSuperAdmin = dept.name.toLowerCase() === 'super admin';
    const userData = { 
      id: isSuperAdmin ? 1 : `dept_${dept.id}`, 
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
    const departments = await prisma.department.findMany({ 
      orderBy: { name: 'asc' } 
    });
    res.json(departments);
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

app.post('/api/workflow-stages', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'global_admin') return res.status(403).json({ error: 'Forbidden' });
    const stages = req.body; // Expects full array
    
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
async function notifyRole(roleName, message, requisitionId) {
  try {
    // Find users with this role (Admin, Audit, etc.) or all if role is global
    const users = await prisma.user.findMany({
      where: roleName === 'creator' 
        ? { requisitions: { some: { id: requisitionId } } }
        : { role: { contains: roleName.toLowerCase() } }
    });
    
    await prisma.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        message,
        requisitionId
      }))
    });
  } catch (err) {
    console.error("Notification failed:", err);
  }
}

// ── NOTIFICATIONS ──
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const isDept = req.user.role === 'department';
    const rawId = !isDept ? req.user.id : req.user.deptId;
    
    // Robust Integer Parsing
    const parsedId = (typeof rawId === 'string' && rawId.startsWith('dept_')) 
      ? parseInt(rawId.split('_')[1]) 
      : parseInt(rawId);

    if (isNaN(parsedId)) {
      console.warn("[NOTIF] Invalid ID format:", { rawId, role: req.user.role });
      return res.json([]);
    }

    let whereClause = {};
    if (!isDept) {
      whereClause = { userId: parsedId };
    } else {
      // Find all users in this department
      const deptUsers = await prisma.user.findMany({
        where: { departmentId: parsedId },
        select: { id: true }
      });
      const userIds = deptUsers.map(u => u.id);
      if (userIds.length === 0) return res.json([]);
      whereClause = { userId: { in: userIds } };
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      include: { requisition: { select: { title: true } } }, // Optional: include metadata
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(notifications);
  } catch (error) {
    console.error("[NOTIF] Fetch Error:", error.message);
    res.status(500).json({ 
      error: "Notification fetch failed", 
      details: error.message,
      diag: { role: req.user?.role, id: req.user?.id, deptId: req.user?.deptId } 
    });
  }
});

app.post('/api/requisition-types', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    const type = await prisma.requisitionType.create({ data: { name, description: description || '' } });
    res.json(type);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/requisition-types/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.requisitionType.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/departments', authenticateToken, async (req, res) => {
  try {
    const { name, type, accessCode } = req.body;
    const dept = await prisma.department.create({ data: { name, type, accessCode } });
    res.json(dept);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/departments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/requisitions', authenticateToken, async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const creatorId = typeof req.user.id === 'number' ? req.user.id : null;
    
    const created = await prisma.$transaction(items.map(item => prisma.requisition.create({
      data: {
        title: item.title || item.description,
        type: item.type || 'Cash',
        amount: parseFloat(item.amount) || 0,
        description: item.description || '',
        status: 'pending',
        departmentId: item.departmentId || req.user.deptId || 1,
        creatorId: creatorId || 1
      }
    })));

    // Notify first workflow stage (default to 'Admin')
    const firstStage = await prisma.workflowStage.findFirst({ orderBy: { sequence: 'asc' } });
    const targetRole = firstStage ? firstStage.role : 'Admin';
    for (const reqItem of created) {
      await notifyRole(targetRole, `New Requisition: ${reqItem.title}`, reqItem.id);
    }

    res.json(created);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/requisitions/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    
    const requisition = await prisma.requisition.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    // Log Activity
    await prisma.activityLog.create({
        data: {
            userId: req.user.id,
            action: `Status Update: ${status}`,
            details: `Requisition #${id} changed to ${status}. Remarks: ${remarks || 'None'}`
        }
    });

    // Determine next notification
    if (status === 'approved') {
        const nextStage = await prisma.workflowStage.findFirst({
            where: { sequence: { gt: 0 } }, // Simplified logic: in real app, track current sequence
            orderBy: { sequence: 'asc' }
        });
        if (nextStage) {
            await notifyRole(nextStage.role, `Pending Approval: ${requisition.title}`, requisition.id);
        } else {
            await notifyRole('creator', `Requisition Fully Approved: ${requisition.title}`, requisition.id);
        }
    } else if (status === 'rejected') {
        await notifyRole('creator', `Requisition Rejected: ${requisition.title}`, requisition.id);
    }

    res.json(requisition);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/requisitions', authenticateToken, async (req, res) => {
  try {
    const where = {};
    // RBAC: Department users only see their own department's requisitions
    if (req.user.role === 'department' && req.user.deptId) {
      where.departmentId = req.user.deptId;
    }
    
    const records = await prisma.requisition.findMany({ 
      where,
      include: { 
        department: { select: { name: true } }, 
        creator: { select: { name: true } },
        attachments: true
      }, 
      orderBy: { createdAt: 'desc' } 
    });
    res.json(records);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({ include: { user: { select: { name: true } } }, orderBy: { timestamp: 'desc' }, take: 100 });
    res.json(logs);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// File Attachments & Auditing
app.post('/api/requisitions/:id/attachments', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;
    
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const attachments = await prisma.$transaction(files.map(f => prisma.attachment.create({
      data: {
        filename: f.originalname,
        url: `/uploads/${f.filename}`,
        requisitionId: parseInt(id),
        uploaderId: req.user.id
      }
    })));

    // Log Activity
    await prisma.activityLog.create({
        data: {
            userId: req.user.id,
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
    const attachment = await prisma.attachment.findUnique({ where: { id: parseInt(id) } });
    if (!attachment) return res.status(404).json({ error: 'File not found' });

    // Audit Log
    await prisma.fileAccessLog.create({
      data: {
        attachmentId: attachment.id,
        userId: req.user.id,
        action: 'DOWNLOAD'
      }
    });

    res.redirect(attachment.url);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Requisition Attachments List
app.get('/api/requisitions/:id/attachments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const attachments = await prisma.attachment.findMany({
      where: { requisitionId: parseInt(id) },
      include: { uploader: { select: { name: true } } }
    });
    res.json(attachments);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ── FRONTEND SERVING ──
const distPath = path.join(__dirname, 'rms_frontend', 'dist');
app.use(express.static(distPath));

app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(distPath, 'index.html'));
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 CSS RMS Unified Node listening on port ${PORT}`));
