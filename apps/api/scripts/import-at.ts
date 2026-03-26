import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { XMLParser } from 'fast-xml-parser'

const prisma = new PrismaClient()

const BOOKS_AT = [
  { name: 'Genèse', slug: 'genese', file: 'Gen.xml', order: 1 },
  { name: 'Exode', slug: 'exode', file: 'Exod.xml', order: 2 },
  { name: 'Lévitique', slug: 'levitique', file: 'Lev.xml', order: 3 },
  { name: 'Nombres', slug: 'nombres', file: 'Num.xml', order: 4 },
  { name: 'Deutéronome', slug: 'deuteronome', file: 'Deut.xml', order: 5 },
  { name: 'Josué', slug: 'josue', file: 'Josh.xml', order: 6 },
  { name: 'Juges', slug: 'juges', file: 'Judg.xml', order: 7 },
  { name: 'Ruth', slug: 'ruth', file: 'Ruth.xml', order: 8 },
  { name: '1 Samuel', slug: '1samuel', file: '1Sam.xml', order: 9 },
  { name: '2 Samuel', slug: '2samuel', file: '2Sam.xml', order: 10 },
  { name: '1 Rois', slug: '1rois', file: '1Kgs.xml', order: 11 },
  { name: '2 Rois', slug: '2rois', file: '2Kgs.xml', order: 12 },
  { name: '1 Chroniques', slug: '1chroniques', file: '1Chr.xml', order: 13 },
  { name: '2 Chroniques', slug: '2chroniques', file: '2Chr.xml', order: 14 },
  { name: 'Esdras', slug: 'esdras', file: 'Ezra.xml', order: 15 },
  { name: 'Néhémie', slug: 'nehemie', file: 'Neh.xml', order: 16 },
  { name: 'Esther', slug: 'esther', file: 'Esth.xml', order: 17 },
  { name: 'Job', slug: 'job', file: 'Job.xml', order: 18 },
  { name: 'Psaumes', slug: 'psaumes', file: 'Ps.xml', order: 19 },
  { name: 'Proverbes', slug: 'proverbes', file: 'Prov.xml', order: 20 },
  { name: 'Ecclésiaste', slug: 'ecclesiaste', file: 'Eccl.xml', order: 21 },
  { name: 'Cantique', slug: 'cantique', file: 'Song.xml', order: 22 },
  { name: 'Ésaïe', slug: 'esaie', file: 'Isa.xml', order: 23 },
  { name: 'Jérémie', slug: 'jeremie', file: 'Jer.xml', order: 24 },
  { name: 'Lamentations', slug: 'lamentations', file: 'Lam.xml', order: 25 },
  { name: 'Ézéchiel', slug: 'ezechiel', file: 'Ezek.xml', order: 26 },
  { name: 'Daniel', slug: 'daniel', file: 'Dan.xml', order: 27 },
  { name: 'Osée', slug: 'osee', file: 'Hos.xml', order: 28 },
  { name: 'Joël', slug: 'joel', file: 'Joel.xml', order: 29 },
  { name: 'Amos', slug: 'amos', file: 'Amos.xml', order: 30 },
  { name: 'Abdias', slug: 'abdias', file: 'Obad.xml', order: 31 },
  { name: 'Jonas', slug: 'jonas', file: 'Jonah.xml', order: 32 },
  { name: 'Michée', slug: 'michee', file: 'Mic.xml', order: 33 },
  { name: 'Nahoum', slug: 'nahoum', file: 'Nah.xml', order: 34 },
  { name: 'Habacuc', slug: 'habacuc', file: 'Hab.xml', order: 35 },
  { name: 'Sophonie', slug: 'sophonie', file: 'Zeph.xml', order: 36 },
  { name: 'Aggée', slug: 'aggee', file: 'Hag.xml', order: 37 },
  { name: 'Zacharie', slug: 'zacharie', file: 'Zech.xml', order: 38 },
  { name: 'Malachie', slug: 'malachie', file: 'Mal.xml', order: 39 },
]

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

function extractStrongNumber(lemma: string): string | null {
  if (!lemma) return null
  const parts = lemma.split('/')
  const last = parts[parts.length - 1].trim()
  const num = last.split(' ')[0].trim()
  if (/^\d+$/.test(num)) return `H${num}`
  return null
}

async function importBook(bookMeta: typeof BOOKS_AT[0]) {
  const filePath = path.join(__dirname, 'data', 'morphhb-master', 'wlc', bookMeta.file)

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier non trouvé : ${filePath}`)
    return
  }

  console.log(`📖 Import de ${bookMeta.name}...`)

  const xml = fs.readFileSync(filePath, 'utf-8')
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    isArray: () => false,
  })

  const result = parser.parse(xml)
  const osisText = result?.osis?.osisText
  const div = osisText?.div
  const chapters = toArray(div?.chapter)

  const book = await prisma.book.upsert({
    where: { slug: bookMeta.slug },
    update: { chapterCount: chapters.length },
    create: {
      name: bookMeta.name,
      slug: bookMeta.slug,
      testament: 'AT',
      orderNum: bookMeta.order,
      chapterCount: chapters.length,
    }
  })

  for (let ci = 0; ci < chapters.length; ci++) {
    const chapterRaw = chapters[ci]
    const chapterNum = ci + 1

    const chapter = await prisma.chapter.create({
      data: { bookId: book.id, number: chapterNum }
    })

    const verses = toArray(chapterRaw?.verse)

    for (let vi = 0; vi < verses.length; vi++) {
      const verseRaw = verses[vi]
      const verseNum = vi + 1
      const reference = `${bookMeta.slug}.${chapterNum}.${verseNum}`

      const verse = await prisma.verse.create({
        data: { chapterId: chapter.id, number: verseNum, reference }
      })

      const words = toArray(verseRaw?.w)

      const hebrewText = words
        .map((w: any) => (typeof w === 'string' ? w : (w['#text'] || '')))
        .filter(Boolean)
        .join(' ')

      const verseText = await prisma.verseText.create({
        data: {
          verseId: verse.id,
          language: 'HEB',
          text: hebrewText,
          source: 'morphhb',
        }
      })

      for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi]
        const word = typeof w === 'string' ? w : (w['#text'] || '')
        if (!word) continue

        const lemma = w['@_lemma'] || ''
        const morphology = w['@_morph'] || null
        const strongNumber = extractStrongNumber(lemma)

        await prisma.wordToken.create({
          data: {
            verseTextId: verseText.id,
            position: wi,
            word,
            lemma,
            strongNumber,
            morphology,
          }
        })
      }
    }
  }

  console.log(`✅ ${bookMeta.name} — ${chapters.length} chapitres`)
}

async function main() {
  console.log('🚀 Début de l\'import de l\'Ancien Testament...')
  for (const book of BOOKS_AT) {
    await importBook(book)
  }
  console.log('🎉 Import terminé !')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})