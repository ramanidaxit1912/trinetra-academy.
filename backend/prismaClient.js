const { PrismaClient } = require('@prisma/client');

// Prisma Client Singleton — prevents multiple connection pools on Render
// (Node.js module cache handles this, global ensures hot-reload safety)
if (!global.prisma) {
  global.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });
}

module.exports = global.prisma;
