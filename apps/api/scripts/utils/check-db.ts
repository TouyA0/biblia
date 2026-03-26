import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const books = await prisma.book.count()
  const chapters = await prisma.chapter.count()
  const verses = await prisma.verse.count()
  const wordTokens = await prisma.wordToken.count()
  const translations = await prisma.translation.count()
  const users = await prisma.user.count()

  console.log('📊 Stats de la base Biblia :')
  console.log(`📚 Livres        : ${books}`)
  console.log(`📑 Chapitres     : ${chapters}`)
  console.log(`📖 Versets       : ${verses}`)
  console.log(`🔤 Mots          : ${wordTokens}`)
  console.log(`🇫🇷 Traductions   : ${translations}`)
  console.log(`👤 Utilisateurs  : ${users}`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})