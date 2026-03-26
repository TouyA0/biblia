import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Nettoyage de la base...')
  await prisma.wordToken.deleteMany()
  console.log('✅ WordTokens supprimés')
  await prisma.verseText.deleteMany()
  console.log('✅ VerseTexts supprimés')
  await prisma.verse.deleteMany()
  console.log('✅ Verses supprimés')
  await prisma.chapter.deleteMany()
  console.log('✅ Chapters supprimés')
  await prisma.book.deleteMany()
  console.log('✅ Books supprimés')
  console.log('🎉 Base nettoyée !')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})