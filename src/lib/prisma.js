// import { PrismaClient } from '@prisma/client'

// const prisma = new PrismaClient()

// export default prisma




import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma