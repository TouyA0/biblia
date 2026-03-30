import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Marquage des traductions Crampon comme référence...')
  
  const result = await prisma.translation.updateMany({
    where: { isActive: true },
    data: { isReference: true, source: 'Crampon 1923' }
  })
  
  console.log(`✅ ${result.count} traductions marquées comme référence`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})