import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const DEUTERO_FILES = [
  { file: '20.Judith.txt',             slug: 'judith'     },
  { file: '21.Tobias.txt',             slug: 'tobie'      },
  { file: '23.Machabaeorum_i.txt',     slug: '1maccabees' },
  { file: '24.Machabaeorum_ii.txt',    slug: '2maccabees' },
  { file: '33.Sapientia_Salomonis.txt',slug: 'sagesse'    },
  { file: '34.Ecclesiasticus.txt',     slug: 'siracide'   },
  { file: '50.Baruch.txt',             slug: 'baruch'     },
]

function parseSweteFile(content: string): Map<string, string[]> {
  // Retourne une Map : "chapitre.verset" → [mots]
  const verseMap = new Map<string, string[]>()

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Format : "1.1.1 MOT" → livre.chapitre.verset MOT
    const spaceIdx = trimmed.indexOf(' ')
    if (spaceIdx === -1) continue

    const ref = trimmed.substring(0, spaceIdx)
    const word = trimmed.substring(spaceIdx + 1).trim()
    if (!word) continue

    const parts = ref.split('.')
    if (parts.length < 3) continue

    const chapterVerse = `${parts[1]}.${parts[2]}`

    if (!verseMap.has(chapterVerse)) {
      verseMap.set(chapterVerse, [])
    }
    verseMap.get(chapterVerse)!.push(word)
  }

  return verseMap
}

async function fixBook(meta: typeof DEUTERO_FILES[0]) {
  const filePath = path.join(__dirname, '..', 'data', 'lxx-swete', meta.file)

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier non trouvé : ${meta.file}`)
    return
  }

  console.log(`📖 Correction de ${meta.slug}...`)

  const content = fs.readFileSync(filePath, 'utf-8')
  const verseMap = parseSweteFile(content)

  // Trouver le livre en base
  const book = await prisma.book.findUnique({ where: { slug: meta.slug } })
  if (!book) {
    console.log(`⚠️  Livre non trouvé en base : ${meta.slug}`)
    return
  }

  const chapters = await prisma.chapter.findMany({ where: { bookId: book.id } })

  let updated = 0

  for (const chapter of chapters) {
    const verses = await prisma.verse.findMany({ where: { chapterId: chapter.id } })

    for (const verse of verses) {
      const key = `${chapter.number}.${verse.number}`
      const words = verseMap.get(key)

      if (!words || words.length === 0) continue

      const greekText = words.join(' ')

      // Mettre à jour le VerseText existant
      await prisma.verseText.updateMany({
        where: { verseId: verse.id },
        data: {
          text: greekText,
          source: 'LXX-Swete',
        }
      })

      // Supprimer les anciens WordTokens
      const verseTexts = await prisma.verseText.findMany({ where: { verseId: verse.id } })
      for (const vt of verseTexts) {
        await prisma.wordToken.deleteMany({ where: { verseTextId: vt.id } })

        // Recréer les WordTokens avec les vrais mots grecs
        for (let wi = 0; wi < words.length; wi++) {
          await prisma.wordToken.create({
            data: {
              verseTextId: vt.id,
              position: wi,
              word: words[wi],
              lemma: words[wi],
            }
          })
        }
      }

      updated++
    }
  }

  console.log(`✅ ${meta.slug} — ${updated} versets mis à jour`)
}

async function main() {
  console.log('🚀 Correction du texte grec des deutérocanoniques...')

  for (const meta of DEUTERO_FILES) {
    await fixBook(meta)
  }

  console.log('🎉 Correction terminée !')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})