const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // 1. Create Departments (32 Units)
  const departments = [
    // Strategic Control
    { name: 'Hatchery Management', type: 'Strategic', code: 'HMT', accessCode: 'HATCH-2026' },
    { name: 'Poultry Operations', type: 'Strategic', code: 'POT', accessCode: 'POULT-2026' },
    { name: 'QA/QC', type: 'Strategic', code: 'QAQC', accessCode: 'QAQC-2026' },
    { name: 'HR Department', type: 'Strategic', code: 'HRD', accessCode: 'HR-2026' },
    { name: 'Finance & Accounts', type: 'Strategic', code: 'FIN', accessCode: 'FIN-2026' },
    { name: 'Internal Audit', type: 'Strategic', code: 'AUD', accessCode: 'AUD-2026' },
    { name: 'Strategy & Growth', type: 'Strategic', code: 'SGR', accessCode: 'STRAT-2026' },
    { name: 'Legal & Compliance', type: 'Strategic', code: 'LGL', accessCode: 'LEGAL-2026' },
    
    // Operational Units
    { name: 'Logistics & Supply Chain', type: 'Operational', code: 'LSC', accessCode: 'LOG-2026' },
    { name: 'Procurement', type: 'Operational', code: 'PRO', accessCode: 'PROC-2026' },
    { name: 'Security Services', type: 'Operational', code: 'SEC', accessCode: 'SEC-2026' },
    { name: 'Facilities Management', type: 'Operational', code: 'FAC', accessCode: 'FAC-2026' },
    { name: 'ICT & Digital', type: 'Operational', code: 'ICT', accessCode: 'ICT-2026' },
    { name: 'Marketing', type: 'Operational', code: 'MKT', accessCode: 'MKT-2026' },
    { name: 'Sales & Distribution', type: 'Operational', code: 'SLS', accessCode: 'SALES-2026' },
    { name: 'Customer Experience', type: 'Operational', code: 'CEX', accessCode: 'CUST-2026' },
    { name: 'Research & Development', type: 'Operational', code: 'RND', accessCode: 'RND-2026' },
    { name: 'Warehouse Alpha', type: 'Operational', code: 'WHA', accessCode: 'WHA-2026' },
    { name: 'Warehouse Beta', type: 'Operational', code: 'WHB', accessCode: 'WHB-2026' },
    { name: 'Technical Maintenance', type: 'Operational', code: 'MNT', accessCode: 'MAINT-2026' },
    { name: 'Power & Utilities', type: 'Operational', code: 'PWR', accessCode: 'POW-2026' },
    { name: 'Water Treatment', type: 'Operational', code: 'WTR', accessCode: 'WAT-2026' },
    { name: 'Waste Management', type: 'Operational', code: 'WST', accessCode: 'WST-2026' },
    { name: 'Health & Safety (HSE)', type: 'Operational', code: 'HSE', accessCode: 'HSE-2026' },
    { name: 'Fleet Management', type: 'Operational', code: 'FLT', accessCode: 'FLEET-2026' },
    { name: 'Inventory Control', type: 'Operational', code: 'INV', accessCode: 'INV-2026' },
    { name: 'Hospitality Services', type: 'Operational', code: 'HOS', accessCode: 'HOS-2026' },
    { name: 'Agro-Allied Projects', type: 'Operational', code: 'AAP', accessCode: 'AGRO-2026' },
    { name: 'Environmental Services', type: 'Operational', code: 'ENV', accessCode: 'ENV-2026' },
    { name: 'Special Projects (A)', type: 'Operational', code: 'SPA', accessCode: 'SPA-2026' },
    { name: 'Special Projects (B)', type: 'Operational', code: 'SPB', accessCode: 'SPB-2026' },
    { name: 'Corporate Secretariate', type: 'Strategic', code: 'COR', accessCode: 'CORP-2026' },
  ];

  console.log('Seeding departments...');
  for (const dept of departments) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
  }

  // 2. Create Admin User
  console.log('Seeding admin user...');
  const hrDept = await prisma.department.findUnique({ where: { name: 'HR Department' } });
  
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
