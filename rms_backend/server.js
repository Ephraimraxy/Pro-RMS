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
    
    // In a real app, verify against DB. For now, matching the frontend's mock logic:
    if (email === 'admin' && password === 'admin') {
      const user = {
        id: 1,
        email: 'admin@cssgroup.local',
        name: 'Administrator',
        role: 'global_admin',
        department: 'Operations',
      };
      
      const token = jwt.sign(user, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '12h' });
      return res.json({ token, user });
    }
    
    // DB check (uncomment when DB is seeded)
    /*
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, department: user.departmentId }, process.env.JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, user: { ...user, password: undefined } });
    */

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ── DEPARTMENTS ROUTES ──
app.get('/api/departments', authenticateToken, async (req, res) => {
  try {
    // Return all 32 departments and their hierarchies
    const departments = await prisma.department.findMany({
      include: { subDepartments: true }
    });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── REQUISITIONS ROUTES ──
app.post('/api/requisitions', authenticateToken, async (req, res) => {
  try {
    const reqData = req.body;
    // reqData might be a single requisition or an array of sync drafts
    const items = Array.isArray(reqData) ? reqData : [reqData];
    
    const created = await prisma.$transaction(
      items.map(item => prisma.requisition.create({
        data: {
          title: item.title,
          type: item.type,
          amount: item.amount,
          description: item.description,
          status: 'pending',
          departmentId: item.departmentId,
          creatorId: req.user.id
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
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 CSS RMS API Matrix listening on port ${PORT}`));
