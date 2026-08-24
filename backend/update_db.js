const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  await prisma.marketingItem.updateMany({
    where: { category: 'DHAMAKA_OFFER', title: { contains: 'ગુજરાતી' } },
    data: {
      couponCode: 'GUJ99',
      waMessage: 'નમસ્તે Trinetra Academy, મને ગુજરાતી વર્ણનાત્મક PDF ₹99 વાળી ધમાકા ઓફર [કૂપન: GUJ99] સાથે લેવી છે.'
    }
  });

  await prisma.marketingItem.updateMany({
    where: { category: 'DHAMAKA_OFFER', title: { contains: 'TET-2' } },
    data: {
      couponCode: 'TET50',
      waMessage: 'નમસ્તે Trinetra Academy, મને TET-2 સ્પેશિયલ ₹149 વાળી ધમાકા ઓફર [કૂપન: TET50] સાથે લેવી છે.'
    }
  });

  console.log('✅ Updated coupons in DB');
  await prisma.$disconnect();
}

run();
