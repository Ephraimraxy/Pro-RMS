const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const adminPass = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
  const hashedPassword = await bcrypt.hash(adminPass, 10);
  const hashAccessCode = async (code) => bcrypt.hash(code, 10);

  // 1. Create Departments (31 Units)
  const departments = [
    { name: 'Hatchery', type: 'Operational', code: 'HAT', accessCode: 'HATCH-2026' },
    { name: 'Poultry', type: 'Operational', code: 'POL', accessCode: 'POULT-2026' },
    { name: 'Fisheries', type: 'Operational', code: 'FSH', accessCode: 'FISH-2026' },
    { name: 'Ruminant', type: 'Operational', code: 'RUM', accessCode: 'RUMIN-2026' },
    { name: 'FPP', type: 'Operational', code: 'FPP', accessCode: 'FPP-2026' },
    { name: 'Machinery', type: 'Operational', code: 'MCH', accessCode: 'MACH-2026' },
    { name: 'Fuel and Gas Station', type: 'Operational', code: 'FGS', accessCode: 'FUEL-2026' },
    { name: 'Rice Mill', type: 'Operational', code: 'RML', accessCode: 'RICE-2026' },
    { name: 'Soya Mill', type: 'Operational', code: 'SML', accessCode: 'SOYA-2026' },
    { name: 'Feed Mill', type: 'Operational', code: 'FML', accessCode: 'FEED-2026' },
    { name: 'Soap Factory', type: 'Operational', code: 'SFC', accessCode: 'SOAP-2026' },
    { name: 'Store', type: 'Operational', code: 'STR', accessCode: 'STORE-2026' },
    { name: 'Chicken Processing', type: 'Operational', code: 'CPH', accessCode: 'CHICK-2026' },
    { name: 'CEC', type: 'Strategic', code: 'CEC', accessCode: 'CEC-2026' },
    { name: 'Marketing', type: 'Strategic', code: 'MKT', accessCode: 'MKT-2026' },
    { name: 'Audit', type: 'Strategic', code: 'AUD', accessCode: 'AUDIT-2026' },
    { name: 'Account', type: 'Strategic', code: 'ACC', accessCode: 'ACCT-2026' },
    { name: 'ISAC', type: 'Strategic', code: 'ISC', accessCode: 'ISAC-2026' },
    { name: 'ICT', type: 'Strategic', code: 'ICT', accessCode: 'ICT-2026' },
    { name: 'QA/QC', type: 'Strategic', code: 'QAQ', accessCode: 'QAQC-2026' },
    { name: 'M&E', type: 'Strategic', code: 'MAE', accessCode: 'MAE-2026' },
    { name: 'Resort', type: 'Strategic', code: 'RST', accessCode: 'RESORT-2026' },
    { name: 'HR', type: 'Strategic', code: 'HRD', accessCode: 'HR-2026' },
    { name: 'Security', type: 'Strategic', code: 'SEC', accessCode: 'SEC-2026' },
    { name: 'Green Houses and Hydroponics', type: 'Operational', code: 'GHH', accessCode: 'GREEN-2026' },
    { name: 'Water Factory', type: 'Operational', code: 'WFC', accessCode: 'WATER-2026' },
    { name: 'Juice Factory', type: 'Operational', code: 'JFC', accessCode: 'JUICE-2026' },
    { name: 'Procurement', type: 'Strategic', code: 'PRO', accessCode: 'PROC-2026' },
    { name: 'Crop Production', type: 'Operational', code: 'CRP', accessCode: 'CROP-2026' },
    { name: 'Irrigation', type: 'Operational', code: 'IRR', accessCode: 'IRRIG-2026' },
    { name: 'Super Admin', type: 'Strategic', code: 'ADM', accessCode: 'admin123' },
    { name: 'General Manager (GM)', type: 'Strategic', code: 'GMR', accessCode: 'GM-2026' },
    { name: 'CEO (Chairman)', type: 'Strategic', code: 'CEO', accessCode: 'CEO-2026' },
    { name: 'Internal consult and control (ICC)', type: 'Strategic', code: 'ICC', accessCode: 'ICC-2026' },
  ];

  console.log('Seeding departments...');
  for (const dept of departments) {
    const accessCodeHash = dept.accessCode ? await hashAccessCode(dept.accessCode) : null;
    await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: {
        name: dept.name,
        type: dept.type,
        code: dept.code,
        accessCode: null,
        accessCodeLabel: dept.accessCode,
        accessCodeHash
      },
    });
  }

  // 2. Create Admin User
  console.log('Seeding admin user...');
  const hrDept = await prisma.department.findUnique({ where: { name: 'HR' } });
  
  await prisma.user.upsert({
    where: { email: 'admin@cssgroup.local' },
    update: {},
    create: {
      email: 'admin@cssgroup.local',
      name: 'System Administrator',
      password: hashedPassword,
      role: 'global_admin',
      departmentId: hrDept?.id,
    },
  });

  // 3. Create Requisition Types
  console.log('Seeding requisition types...');
  const types = [
    { name: 'Cash', description: 'Request for funds' },
    { name: 'Material', description: 'Request for physical materials' },
    { name: 'Memo', description: 'Communication seeking approval' },
  ];
  for (const type of types) {
    await prisma.requisitionType.upsert({
      where: { name: type.name },
      update: {},
      create: type,
    });
  }

  // 4. Create Initial Workflow Stages (Based on SRS 4.1)
  console.log('Seeding workflow stages...');
  const stages = [
    { sequence: 1, name: 'Administration Review', role: 'Admin', threshold: 0 },
    { sequence: 2, name: 'Internal Audit', role: 'Audit', threshold: 0 },
    { sequence: 3, name: 'Management Approval', role: 'GM', threshold: 500000 },
    { sequence: 4, name: 'Chairman Approval', role: 'Chairman', threshold: 2000000 },
  ];
  for (const stage of stages) {
    await prisma.workflowStage.upsert({
      where: { sequence: stage.sequence }, 
      update: stage,
      create: stage,
    });
  }

  // 5. Seed Public Signing Key if provided
  if (process.env.SIGNING_PUBLIC_KEY) {
    const crypto = require('crypto');
    const publicKey = process.env.SIGNING_PUBLIC_KEY.trim();
    const kid = crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
    await prisma.publicKey.upsert({
      where: { kid },
      update: { publicKey, algorithm: 'Ed25519', active: true },
      create: { kid, publicKey, algorithm: 'Ed25519', active: true }
    });
    console.log(`Seeded public key with kid=${kid}`);
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
