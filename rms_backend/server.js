// rms_backend/server.js
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Helper for Auth
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access Denied: No Token' });
  
  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid Token' });
    req.user = user;
    next();
  });
};

// ── AUTHENTICATION ROUTES ──
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { department: true }
    });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    
    const userData = { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      role: user.role, 
      department: user.department?.name || 'General' 
    };

    const token = jwt.sign(userData, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '12h' });
    
    await prisma.activityLog.create({
      data: {
        action: 'Logged In',
        details: `${user.name} (Admin) authenticated`,
        userId: user.id
      }
    });

    return res.json({ token, user: userData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/dept-login', async (req, res) => {
  try {
    const { departmentName, accessCode } = req.body;
    
    const dept = await prisma.department.findFirst({
      where: { name: departmentName, accessCode }
    });

    if (!dept) return res.status(401).json({ error: 'Invalid Department or Access Code' });
    
    const userData = {
      id: `dept_${dept.id}`,
      name: dept.name,
      role: 'department',
      deptId: dept.id,
      email: `${dept.name.toLowerCase().replace(/\s/g, '')}@cssgroup.local`
    };

    const token = jwt.sign(userData, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '12h' });
    
    await prisma.activityLog.create({
      data: {
        action: 'Dept Logged In',
        details: `${dept.name} unit authenticated`,
      }
    });

    return res.json({ token, user: userData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ── DEPARTMENTS ROUTES ──
app.get('/api/departments', async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/departments', authenticateToken, async (req, res) => {
  try {
    const { name, type, accessCode } = req.body;
    const dept = await prisma.department.create({
      data: { name, type, accessCode }
    });
    res.json(dept);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/departments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({
      where: { id: parseInt(id) }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── REQUISITIONS ROUTES ──
app.post('/api/requisitions', authenticateToken, async (req, res) => {
  try {
    const reqData = req.body;
    const items = Array.isArray(reqData) ? reqData : [reqData];
    
    // Convert string creator ID from token to Int if it's not a department
    const creatorId = typeof req.user.id === 'number' ? req.user.id : null;
    
    const created = await prisma.$transaction(
      items.map(item => prisma.requisition.create({
        data: {
          title: item.title || item.description,
          type: item.type || 'Cash',
          amount: parseFloat(item.amount) || 0,
          description: item.description || '',
          status: 'pending',
          departmentId: item.departmentId || req.user.deptId || 1, // Fallback to user's dept
          creatorId: creatorId || 1 // Fallback to system admin for dept logins for now
        }
      }))
    );
    
    res.json({ success: true, inserted: created.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/requisitions', authenticateToken, async (req, res) => {
  try {
    const records = await prisma.requisition.findMany({
      include: { 
        department: { select: { name: true } },
        creator: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── REQUISITION TYPES ──
app.get('/api/requisition-types', async (req, res) => {
  try {
    const types = await prisma.requisitionType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/requisition-types', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    const type = await prisma.requisitionType.create({ data: { name, description } });
    res.json(type);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── WORKFLOW STAGES ──
app.get('/api/workflow-stages', async (req, res) => {
  try {
    const stages = await prisma.workflowStage.findMany({ orderBy: { sequence: 'asc' } });
    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/workflow-stages', authenticateToken, async (req, res) => {
  try {
    const stages = req.body; // Expects an array of stages
    await prisma.$transaction(
      stages.map(s => prisma.workflowStage.upsert({
        where: { sequence: s.sequence },
        update: { name: s.name, role: s.role, threshold: s.threshold },
        create: { sequence: s.sequence, name: s.name, role: s.role, threshold: s.threshold }
      }))
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── NOTIFICATIONS ──
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    // For department logins, we use their deptId to find relevant notifications or link them to the department
    const userId = typeof req.user.id === 'number' ? req.user.id : null;
    
    const notifications = await prisma.notification.findMany({
      where: userId ? { userId } : { user: { departmentId: req.user.deptId } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.update({
      where: { id: parseInt(req.params.id) },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── AUDIT LOGS ──
app.get('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { timestamp: 'desc' },
      take: 100
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 CSS RMS API Matrix listening on port ${PORT}`));
