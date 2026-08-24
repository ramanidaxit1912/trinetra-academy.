const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const subs = await prisma.submission.findMany({
    select: { id: true, photoUrl: true, answers: true, student: { select: { name: true } } },
    orderBy: { submittedAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(subs, null, 2));
}
check().catch(console.error).finally(() => prisma.$disconnect());
