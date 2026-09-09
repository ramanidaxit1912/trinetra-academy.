const { PrismaClient } = require('@prisma/client');

// Prisma Client Singleton to prevent connection pool exhaustion on Supabase
const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

module.exports = prisma;
