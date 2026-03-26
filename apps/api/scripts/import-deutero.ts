import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const DEUTERO_MAP: Record<string, { name: string, slug: string, order: number }> = {
  'Tobit':        { name: 'Tobie',      slug: 'tobie',      order: 67 },
  'Judith':       { name: 'Judith',     slug: 'judith',     order: 68 },
  'I Maccabees':  { name: '1 Maccabées', slug: '1maccabees', order: 69 },
  'II Maccabees': { name: '2 Maccabées', slug: '2maccabees', order: 70 },
  'Wisdom':       { name: 'Sagesse',    slug: 'sagesse',    order: 71 },
  'Sirach':       { name: 'Siracide',   slug: 'siracide',   order: 72 },
  'Baruch':       { name: 'Baruch',     slug: 'baruch',     order: 73 },
}

async function main() {
  console.log('🚀 Import des deutérocanoniques...')

  const raw = fs.readFileSync(
    path.join(__dirname, 'data', 'FreLXXGiguet.json'),
    'utf-8'
  )
  const data = JSON.parse(raw)
  const books = data.books

  for (const book of books) {
    const meta = DEUTERO_MAP[book.name]
    if (!meta) continue

    console.log(`📖 Import de ${meta.name}...`)

    const chapterCount = book.chapters.length

    const dbBook = await prisma.book.create({
      data: {
        name: meta.name,
        slug: meta.slug,
        testament: 'AT',
        orderNum: meta.order,
        chapterCount,
      }
    })

    let totalVerses = 0

    for (const chapterData of book.chapters) {
      const chapterNum = chapterData.chapter

      const chapter = await prisma.chapter.create({
        data: { bookId: dbBook.id, number: chapterNum }
      })

      for (const verseData of chapterData.verses) {
        const verseNum = verseData.verse
        const text = verseData.text.trim()
        const reference = `${meta.slug}.${chapterNum}.${verseNum}`

        const verse = await prisma.verse.create({
          data: { chapterId: chapter.id, number: verseNum, reference }
        })

        // Texte grec — on met le français comme texte source pour l'instant
        // (la Septante grecque sera ajoutée plus tard)
        await prisma.verseText.create({
          data: {
            verseId: verse.id,
            language: 'GRK',
            text,
            source: 'FreLXXGiguet',
          }
        })

        // Traduction française active
        await prisma.translation.create({
          data: {
            id: `${verse.id}-lxx`,
            verseId: verse.id,
            textFr: text,
            isActive: true,
          }
        })

        totalVerses++
      }
    }

    console.log(`✅ ${meta.name} — ${chapterCount} chapitres, ${totalVerses} versets`)
  }

  console.log('🎉 Import deutérocanoniques terminé !')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})