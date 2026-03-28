// user.service.js
import prisma from '../lib/prisma.js'

export const getUsers = async () => {
  return await prisma.user.findMany()
}