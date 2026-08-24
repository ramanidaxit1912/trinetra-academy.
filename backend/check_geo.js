const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    // Get 2 questions to see what chars are used
    const rows = await prisma.question.findMany({
      take: 2,
      select: { optionA: true, optionB: true, optionC: true, optionD: true }
    });
    
    rows.forEach((q, i) => {
      Object.entries(q).forEach(([col, val]) => {
        if (val) {
          const preview = val.substring(0, 25);
          const codes = [...val].slice(0, 8).map(c => 
            'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')
          ).join(' ');
          console.log('Q' + i + ' ' + col + ': ' + preview + ' | ' + codes);
        }
      });
    });

    // Also specifically find the MN question
    const mnQ = await prisma.question.findFirst({
      where: { text: { contains: 'MN' } },
      select: { id: true, text: true, optionA: true, optionB: true, optionC: true, optionD: true }
    });
    
    if (mnQ) {
      console.log('\n=== MN Question Found ===');
      Object.entries(mnQ).forEach(([col, val]) => {
        if (val) {
          const codes = [...String(val)].slice(0, 12).map(c => 
            'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')
          ).join(' ');
          console.log(col + ': ' + String(val).substring(0, 40) + ' | ' + codes);
        }
      });
    }
  } catch (e) {
    console.log('ERR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
