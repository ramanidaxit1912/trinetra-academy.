const prisma = require('./prismaClient');

async function main() {
  console.log('Ensuring tables and columns for Enrolled Students...');
  
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS enrolled_students (
      id SERIAL PRIMARY KEY,
      mobile VARCHAR(30) UNIQUE NOT NULL,
      name VARCHAR(255),
      batch VARCHAR(100) DEFAULT 'Trinetra Regular',
      "isActive" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Table enrolled_students ensured.');

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_enrolled_students_mobile ON enrolled_students(mobile);
  `);
  console.log('✅ Index on enrolled_students(mobile) ensured.');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS "isEnrolledOnly" BOOLEAN DEFAULT false;
  `);
  console.log('✅ Column isEnrolledOnly on questions ensured.');

  const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM enrolled_students;`);
  console.log('Current enrolled count:', count[0].count);
}

main()
  .then(() => {
    console.log('Migration completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
