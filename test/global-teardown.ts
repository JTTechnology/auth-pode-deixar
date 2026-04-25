import { PrismaClient } from '@prisma/client';

export default async function globalTeardown() {
  const prisma = new PrismaClient();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
}