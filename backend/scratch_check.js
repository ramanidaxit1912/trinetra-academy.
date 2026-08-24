const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const qs = await prisma.question.findMany({
    select: { id: true, testCode: true, testName: true, timeLimit: true },
    distinct: ['testCode']
  });
  console.log('Distinct tests with timeLimits:');
  console.log(JSON.stringify(qs, null, 2));
  await prisma.$disconnect();
}
check();
