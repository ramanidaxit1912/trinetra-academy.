const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const questions = await prisma.question.findMany({
      take: 10,
      orderBy: { id: 'desc' }
    });
    console.log('--- RECENT 10 QUESTIONS IN DB ---');
    console.log(JSON.stringify(questions, null, 2));

    const submissions = await prisma.submission.findMany({
      take: 5,
      orderBy: { id: 'desc' },
      include: { student: true }
    });
    console.log('--- RECENT 5 SUBMISSIONS IN DB ---');
    console.log(JSON.stringify(submissions, null, 2));
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
