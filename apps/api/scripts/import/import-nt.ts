import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const BOOKS_NT = [
  { name: 'Matthieu', slug: 'matthieu', file: 'Matt.xml', order: 40 },
  { name: 'Marc', slug: 'marc', file: 'Mark.xml', order: 41 },
  { name: 'Luc', slug: 'luc', file: 'Luke.xml', order: 42 },
  { name: 'Jean', slug: 'jean', file: 'John.xml', order: 43 },
  { name: 'Actes', slug: 'actes', file: 'Acts.xml', order: 44 },
  { name: 'Romains', slug: 'romains', file: 'Rom.xml', order: 45 },
  { name: '1 Corinthiens', slug: '1corinthiens', file: '1Cor.xml', order: 46 },
  { name: '2 Corinthiens', slug: '2corinthiens', file: '2Cor.xml', order: 47 },
  { name: 'Galates', slug: 'galates', file: 'Gal.xml', order: 48 },
  { name: 'Éphésiens', slug: 'ephesiens', file: 'Eph.xml', order: 49 },
  { name: 'Philippiens', slug: 'philippiens', file: 'Phil.xml', order: 50 },
  { name: 'Colossiens', slug: 'colossiens', file: 'Col.xml', order: 51 },
  { name: '1 Thessaloniciens', slug: '1thessaloniciens', file: '1Thess.xml', order: 52 },
  { name: '2 Thessaloniciens', slug: '2thessaloniciens', file: '2Thess.xml', order: 53 },
  { name: '1 Timothée', slug: '1timothee', file: '1Tim.xml', order: 54 },
  { name: '2 Timothée', slug: '2timothee', file: '2Tim.xml', order: 55 },
  { name: 'Tite', slug: 'tite', file: 'Titus.xml', order: 56 },
  { name: 'Philémon', slug: 'philemon', file: 'Phlm.xml', order: 57 },
  { name: 'Hébreux', slug: 'hebreux', file: 'Heb.xml', order: 58 },
  { name: 'Jacques', slug: 'jacques', file: 'Jas.xml', order: 59 },
  { name: '1 Pierre', slug: '1pierre', file: '1Pet.xml', order: 60 },
  { name: '2 Pierre', slug: '2pierre', file: '2Pet.xml', order: 61 },
  { name: '1 Jean', slug: '1jean', file: '1John.xml', order: 62 },
  { name: '2 Jean', slug: '2jean', file: '2John.xml', order: 63 },
  { name: '3 Jean', slug: '3jean', file: '3John.xml', order: 64 },
  { name: 'Jude', slug: 'jude', file: 'Jude.xml', order: 65 },
  { name: 'Apocalypse', slug: 'apocalypse', file: 'Rev.xml', order: 66 },
]

interface VerseData {
  id: string
  words: string[]
}

function parseBook(xml: string): { chapters: Map<number, Map<number, string[]>> } {
  const chapters = new Map<number, Map<number, string[]>>()

  // Extraire tous les versets avec leurs mots
  // Format: <verse-number id="Matthew 1:1"> ... mots ... <verse-number id="Matthew 1:2">
  const lines = xml.split('\n')
  
  let currentChapter = 0
  let currentVerse = 0
  let currentWords: string[] = []
  let inVerse = false

  for (const line of lines) {
    const verseMatch = line.match(/verse-number[^>]+id="[^"]+\s+(\d+):(\d+)"/)
    const wMatch = line.match(/<w>([^<]+)<\/w>/)

    if (verseMatch) {
      // Sauvegarder le verset précédent
      if (inVerse && currentWords.length > 0) {
        if (!chapters.has(currentChapter)) {
          chapters.set(currentChapter, new Map())
        }
        chapters.get(currentChapter)!.set(currentVerse, [...currentWords])
      }

      currentChapter = parseInt(verseMatch[1])
      currentVerse = parseInt(verseMatch[2])
      currentWords = []
      inVerse = true
    } else if (wMatch && inVerse) {
      currentWords.push(wMatch[1])
    }
  }

  // Sauvegarder le dernier verset
  if (inVerse && currentWords.length > 0) {
    if (!chapters.has(currentChapter)) {
      chapters.set(currentChapter, new Map())
    }
    chapters.get(currentChapter)!.set(currentVerse, currentWords)
  }

  return { chapters }
}

async function importBook(bookMeta: typeof BOOKS_NT[0]) {
  const filePath = path.join(
    __dirname, 'data', 'SBLGNT-master', 'data', 'sblgnt', 'xml', bookMeta.file
  )

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier non trouvé : ${bookMeta.file}`)
    return
  }

  console.log(`📖 Import de ${bookMeta.name}...`)

  const xml = fs.readFileSync(filePath, 'utf-8')
  const { chapters } = parseBook(xml)

  const book = await prisma.book.create({
    data: {
      name: bookMeta.name,
      slug: bookMeta.slug,
      testament: 'NT',
      orderNum: bookMeta.order,
      chapterCount: chapters.size,
    }
  })

  for (const [chapterNum, verses] of chapters) {
    const chapter = await prisma.chapter.create({
      data: { bookId: book.id, number: chapterNum }
    })

    for (const [verseNum, words] of verses) {
      const reference = `${bookMeta.slug}.${chapterNum}.${verseNum}`
      const greekText = words.join(' ')

      const verse = await prisma.verse.create({
        data: { chapterId: chapter.id, number: verseNum, reference }
      })

      const verseText = await prisma.verseText.create({
        data: {
          verseId: verse.id,
          language: 'GRK',
          text: greekText,
          source: 'SBLGNT',
        }
      })

      for (let wi = 0; wi < words.length; wi++) {
        await prisma.wordToken.create({
          data: {
            verseTextId: verseText.id,
            position: wi,
            word: words[wi],
            lemma: words[wi],
          }
        })
      }
    }
  }

  console.log(`✅ ${bookMeta.name} — ${chapters.size} chapitres`)
}

async function main() {
  console.log('🚀 Import du Nouveau Testament (SBLGNT)...')

  for (const book of BOOKS_NT) {
    await importBook(book)
  }

  console.log('🎉 Import NT terminé !')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})