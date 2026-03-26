import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/books', async (req: Request, res: Response) => {
  try {
    const books = await prisma.book.findMany({
      orderBy: { orderNum: 'asc' },
      select: { id: true, name: true, slug: true, testament: true, orderNum: true, chapterCount: true }
    })
    res.json(books)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.get('/books/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string
    const book = await prisma.book.findUnique({
      where: { slug },
      include: {
        chapters: { orderBy: { number: 'asc' }, select: { id: true, number: true } }
      }
    })
    if (!book) { res.status(404).json({ error: 'Livre non trouvé' }); return }
    res.json(book)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.get('/books/:slug/chapters/:number', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string
    const number = parseInt(req.params.number as string)

    const book = await prisma.book.findUnique({ where: { slug } })
    if (!book) { res.status(404).json({ error: 'Livre non trouvé' }); return }

    const chapter = await prisma.chapter.findFirst({
      where: { bookId: book.id, number },
      include: {
        verses: {
          orderBy: { number: 'asc' },
          include: {
            texts: {
              include: {
                wordTokens: { orderBy: { position: 'asc' } }
              }
            },
            translations: { where: { isActive: true }, take: 1 }
          }
        }
      }
    })
    if (!chapter) { res.status(404).json({ error: 'Chapitre non trouvé' }); return }
    res.json(chapter)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.get('/words/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const word = await prisma.wordToken.findUnique({
      where: { id },
      include: {
        translations: { orderBy: { voteCount: 'desc' } },
        comments: {
          include: { creator: { select: { username: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    if (!word) { res.status(404).json({ error: 'Mot non trouvé' }); return }
    res.json(word)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.get('/words/:id/occurrences', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const word = await prisma.wordToken.findUnique({ where: { id } })
    if (!word) { res.status(404).json({ error: 'Mot non trouvé' }); return }

    const occurrences = await prisma.wordToken.findMany({
      where: { lemma: word.lemma, id: { not: id } },
      take: 20,
      include: {
        verseText: {
          include: {
            verse: {
              include: {
                translations: { where: { isActive: true }, take: 1 },
                chapter: { include: { book: true } }
              }
            }
          }
        }
      }
    })
    res.json(occurrences)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.get('/verses/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const verse = await prisma.verse.findUnique({
      where: { id },
      include: {
        texts: { include: { wordTokens: { orderBy: { position: 'asc' } } } },
        translations: { where: { isActive: true }, take: 1 },
        comments: {
          include: { creator: { select: { username: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    if (!verse) { res.status(404).json({ error: 'Verset non trouvé' }); return }
    res.json(verse)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router