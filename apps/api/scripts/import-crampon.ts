import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// Correspondance entre les noms anglais du JSON et les slugs qu'on a en base
const BOOK_MAP: Record<string, string> = {
  'Genesis': 'genese',
  'Exodus': 'exode',
  'Leviticus': 'levitique',
  'Numbers': 'nombres',
  'Deuteronomy': 'deuteronome',
  'Joshua': 'josue',
  'Judges': 'juges',
  'Ruth': 'ruth',
  'I Samuel': '1samuel',
  'II Samuel': '2samuel',
  'I Kings': '1rois',
  'II Kings': '2rois',
  'I Chronicles': '1chroniques',
  'II Chronicles': '2chroniques',
  'Ezra': 'esdras',
  'Nehemiah': 'nehemie',
  'Esther': 'esther',
  'Job': 'job',
  'Psalms': 'psaumes',
  'Proverbs': 'proverbes',
  'Ecclesiastes': 'ecclesiaste',
  'Song of Solomon': 'cantique',
  'Isaiah': 'esaie',
  'Jeremiah': 'jeremie',
  'Lamentations': 'lamentations',
  'Ezekiel': 'ezechiel',
  'Daniel': 'daniel',
  'Hosea': 'osee',
  'Joel': 'joel',
  'Amos': 'amos',
  'Obadiah': 'abdias',
  'Jonah': 'jonas',
  'Micah': 'michee',
  'Nahum': 'nahoum',
  'Habakkuk': 'habacuc',
  'Zephaniah': 'sophonie',
  'Haggai': 'aggee',
  'Zechariah': 'zacharie',
  'Malachi': 'malachie',
}

async function main() {
  console.log('🚀 Import de la traduction Crampon 1923...')

  const raw = fs.readFileSync(
    path.join(__dirname, 'data', 'FreCrampon.json'),
    'utf-8'
  )
  const data = JSON.parse(raw)
  const books = data.books

  let totalVerses = 0
  let skipped = 0

  for (const book of books) {
    const slug = BOOK_MAP[book.name]
    if (!slug) {
      console.log(`⚠️  Livre ignoré (NT ou deutérocanonique) : ${book.name}`)
      skipped++
      continue
    }

    // Trouver le livre en base
    const dbBook = await prisma.book.findUnique({ where: { slug } })
    if (!dbBook) {
      console.log(`⚠️  Livre non trouvé en base : ${book.name} (${slug})`)
      continue
    }

    console.log(`📖 Import traduction : ${book.name}...`)

    for (const chapterData of book.chapters) {
      const chapterNum = chapterData.chapter

      // Trouver le chapitre en base
      const dbChapter = await prisma.chapter.findFirst({
        where: { bookId: dbBook.id, number: chapterNum }
      })
      if (!dbChapter) continue

      for (const verseData of chapterData.verses) {
        const verseNum = verseData.verse
        const text = verseData.text.trim()

        // Trouver le verset en base
        const dbVerse = await prisma.verse.findFirst({
          where: { chapterId: dbChapter.id, number: verseNum }
        })
        if (!dbVerse) continue

        // Créer la traduction française active
        await prisma.translation.upsert({
          where: {
            id: `${dbVerse.id}-crampon`
          },
          update: { textFr: text },
          create: {
            id: `${dbVerse.id}-crampon`,
            verseId: dbVerse.id,
            textFr: text,
            isActive: true,
          }
        })

        totalVerses++
      }
    }

    console.log(`✅ ${book.name} importé`)
  }

  console.log(`\n🎉 Import terminé ! ${totalVerses} versets traduits, ${skipped} livres ignorés`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})