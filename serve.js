const express = require('express');
const path = require('path');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

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
    const { departmentName, accessCode } = req.body;
    console.log(`[AUTH] Dept login attempt: "${departmentName?.trim()}"`);
    
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
    
    const userData = { id: `dept_${dept.id}`, name: dept.name, role: 'department', deptId: dept.id, email: `${dept.name.toLowerCase().replace(/\s/g, '')}@cssgroup.local` };
    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '12h' });
    await prisma.activityLog.create({ data: { action: 'Dept Logged In', details: `${dept.name} unit authenticated` } });
    res.json({ token, user: userData });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/auth/me', authenticateToken, (req, res) => res.json({ user: req.user }));

// Data
app.get('/api/departments', async (req, res) => {
  try {
    const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } });
    res.json(departments);
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
    res.json({ success: true, inserted: created.length });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/requisitions', authenticateToken, async (req, res) => {
  try {
    const records = await prisma.requisition.findMany({ include: { department: { select: { name: true } }, creator: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(records);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({ include: { user: { select: { name: true } } }, orderBy: { timestamp: 'desc' }, take: 100 });
    res.json(logs);
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
