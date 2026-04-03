import { z } from 'zod'
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticateJWT, AuthRequest } from '../middlewares/auth'

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
            texts: { include: { wordTokens: { orderBy: { position: 'asc' } } } },
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

router.get('/words/:id/translations', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const translations = await prisma.wordTranslation.findMany({
      where: { wordTokenId: id },
      orderBy: { voteCount: 'desc' },
      include: { creator: { select: { username: true, role: true } } }
    })
    res.json(translations)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.post('/words/:id/translations', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { translation } = z.object({
      translation: z.string().min(1).max(200)
    }).parse(req.body)
    const word = await prisma.wordToken.findUnique({ where: { id } })
    if (!word) { res.status(404).json({ error: 'Mot non trouvé' }); return }

    // Vérifier doublon
    const existing = await prisma.wordTranslation.findFirst({
      where: { wordTokenId: id, translation: { equals: translation, mode: 'insensitive' } }
    })
    if (existing) {
      res.status(409).json({ error: 'Cette traduction existe déjà pour ce mot' }); return
    }

    const newTranslation = await prisma.wordTranslation.create({
      data: { wordTokenId: id, translation, createdBy: req.user!.id },
      include: { creator: { select: { username: true, role: true } } }
    })
    res.status(201).json(newTranslation)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Données invalides', details: error.issues })
      return
    }
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

router.delete('/word-translations/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const translation = await prisma.wordTranslation.findUnique({ where: { id } })
    if (!translation) { res.status(404).json({ error: 'Traduction non trouvée' }); return }

    const isOwner = translation.createdBy === req.user!.id
    const isExpertOrAdmin = ['EXPERT', 'ADMIN'].includes(req.user!.role)

    if (!isExpertOrAdmin && !(isOwner && !translation.isValidated)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }
    
    await prisma.vote.deleteMany({ where: { wordTranslationId: id } })
    await prisma.wordTranslation.delete({ where: { id } })
    res.json({ message: 'Traduction supprimée' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.patch('/word-translations/:id/validate', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['EXPERT', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }
    const id = req.params.id as string
    const translation = await prisma.wordTranslation.update({
      where: { id },
      data: { isValidated: true }
    })
    res.json(translation)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.post('/word-translations/:id/vote', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const userId = req.user!.id

    const wordTranslation = await prisma.wordTranslation.findUnique({ where: { id } })
    if (!wordTranslation) { res.status(404).json({ error: 'Traduction non trouvée' }); return }

    const existingVote = await prisma.vote.findFirst({
      where: { wordTranslationId: id, userId }
    })

    if (existingVote) {
      await prisma.vote.delete({ where: { id: existingVote.id } })
      await prisma.wordTranslation.update({
        where: { id },
        data: { voteCount: { decrement: 1 } }
      })
      res.json({ voted: false, voteCount: wordTranslation.voteCount - 1 })
    } else {
      await prisma.vote.create({
        data: { wordTranslationId: id, userId, value: 1 }
      })
      await prisma.wordTranslation.update({
        where: { id },
        data: { voteCount: { increment: 1 } }
      })
      res.json({ voted: true, voteCount: wordTranslation.voteCount + 1 })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/verses/by-ref?book=genese&chapter=1&verse=1
router.get('/verses/by-ref', async (req: Request, res: Response) => {
  try {
    const { book, chapter, verse } = req.query
    const chapterData = await prisma.chapter.findFirst({
      where: {
        number: Number(chapter),
        book: { slug: book as string }
      },
      include: {
        book: true
      }
    })
    if (!chapterData) { res.status(404).json({ error: 'Chapitre non trouvé' }); return }

    const verseData = await prisma.verse.findFirst({
      where: {
        number: Number(verse),
        chapterId: chapterData.id
      },
      include: {
        texts: true,
        translations: { where: { isActive: true }, take: 1 },
        chapter: { include: { book: true } }
      }
    })
    if (!verseData) { res.status(404).json({ error: 'Verset non trouvé' }); return }

    res.json(verseData)
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

// GET /api/verses/:id/comments
router.get('/verses/:id/comments', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const comments = await prisma.comment.findMany({
      where: { verseId: id, parentId: null }, // seulement les commentaires racines
      orderBy: { createdAt: 'asc' },
      include: {
        creator: { select: { username: true, role: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            creator: { select: { username: true, role: true } }
          }
        }
      }
    })
    res.json(comments)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/verses/:id/comments
router.post('/verses/:id/comments', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { text } = z.object({
      text: z.string().min(1).max(2000)
    }).parse(req.body)

    const verse = await prisma.verse.findUnique({ where: { id } })
    if (!verse) { res.status(404).json({ error: 'Verset non trouvé' }); return }

    const comment = await prisma.comment.create({
      data: {
        text,
        verseId: id,
        createdBy: req.user!.id,
      },
      include: {
        creator: { select: { username: true, role: true } }
      }
    })
    res.status(201).json(comment)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Données invalides', details: error.issues })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/comments/:id/reply
router.post('/comments/:id/reply', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.params.id as string
    const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(req.body)

    const parent = await prisma.comment.findUnique({ where: { id: parentId } })
    if (!parent) { res.status(404).json({ error: 'Commentaire non trouvé' }); return }
    if (parent.parentId) { res.status(400).json({ error: 'Impossible de répondre à une réponse' }); return }

    const reply = await prisma.comment.create({
      data: {
        text,
        createdBy: req.user!.id,
        verseId: parent.verseId,
        parentId,
      },
      include: {
        creator: { select: { username: true, role: true } }
      }
    })
    res.status(201).json(reply)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Texte invalide' })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// DELETE /api/comments/:id
router.delete('/comments/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const comment = await prisma.comment.findUnique({ where: { id } })
    if (!comment) { res.status(404).json({ error: 'Commentaire non trouvé' }); return }

    const isOwner = comment.createdBy === req.user!.id
    const isExpert = ['EXPERT', 'ADMIN'].includes(req.user!.role)

    if (!isOwner && !isExpert) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }

    await prisma.comment.deleteMany({ where: { parentId: id } })
    await prisma.comment.delete({ where: { id } })
    res.json({ message: 'Commentaire supprimé' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/verses/:id/proposals
router.get('/verses/:id/proposals', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    // Toutes les traductions du verset
    const translations = await prisma.translation.findMany({
      where: { verseId: id },
      orderBy: { createdAt: 'asc' }
    })

    // Toutes les propositions liées à ce verset
    const translationIds = translations.map(t => t.id)
    const proposals = await prisma.proposal.findMany({
      where: { translationId: { in: translationIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { username: true, role: true } },
        reviewer: { select: { username: true, role: true } },
        votes: true,
      }
    })

    res.json({ translations, proposals })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/verses/:id/proposals
router.post('/verses/:id/proposals', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { proposedText } = z.object({
      proposedText: z.string().min(1).max(5000)
    }).parse(req.body)

    const translation = await prisma.translation.findFirst({
      where: { verseId: id, isActive: true }
    })
    if (!translation) { res.status(404).json({ error: 'Traduction non trouvée' }); return }

    // Vérifier doublon
    const existingProposal = await prisma.proposal.findFirst({
      where: { translationId: translation.id, proposedText: { equals: proposedText, mode: 'insensitive' } }
    })
    if (existingProposal) {
      res.status(409).json({ error: 'Cette proposition existe déjà pour ce verset' }); return
    }

    const proposal = await prisma.proposal.create({
      data: {
        translationId: translation.id,
        proposedText,
        createdBy: req.user!.id,
      },
      include: {
        creator: { select: { username: true, role: true } }
      }
    })
    res.status(201).json(proposal)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Données invalides', details: error.issues })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/proposals/:id/accept
// PATCH /api/proposals/:id/accept
router.patch('/proposals/:id/accept', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['EXPERT', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }
    const id = req.params.id as string
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { translation: true }
    })
    if (!proposal) { res.status(404).json({ error: 'Proposition non trouvée' }); return }

    // Juste marquer la proposition comme acceptée, sans changer isActive
    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: 'ACCEPTED', reviewedBy: req.user!.id }
    })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/proposals/:id/activate — définir comme traduction officielle
router.patch('/proposals/:id/activate', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['EXPERT', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }
    const id = req.params.id as string
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { translation: true }
    })
    if (!proposal) { res.status(404).json({ error: 'Proposition non trouvée' }); return }

    const verseId = proposal.translation.verseId

    // Désactiver toutes les traductions du verset
    await prisma.translation.updateMany({
      where: { verseId },
      data: { isActive: false }
    })

    // Chercher si cette proposition a déjà une traduction
    const existing = await prisma.translation.findFirst({
      where: { verseId, textFr: proposal.proposedText }
    })

    if (existing) {
      // Réactiver la traduction existante
      await prisma.translation.update({
        where: { id: existing.id },
        data: { isActive: true }
      })
    } else {
      // Créer une nouvelle traduction active
      await prisma.translation.create({
        data: {
          verseId,
          textFr: proposal.proposedText,
          isActive: true,
          validatedBy: req.user!.id,
          createdBy: proposal.createdBy,
        }
      })
    }

    res.json({ message: 'Traduction officielle mise à jour' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/translations/:id/activate — remettre une traduction existante comme active
router.patch('/translations/:id/activate', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['EXPERT', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }
    const id = req.params.id as string
    const translation = await prisma.translation.findUnique({ where: { id } })
    if (!translation) { res.status(404).json({ error: 'Traduction non trouvée' }); return }

    // Désactiver toutes les traductions du verset
    await prisma.translation.updateMany({
      where: { verseId: translation.verseId },
      data: { isActive: false }
    })

    // Activer celle-ci
    await prisma.translation.update({
      where: { id },
      data: { isActive: true }
    })

    res.json({ message: 'Traduction activée' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/proposals/:id/reject
router.patch('/proposals/:id/reject', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['EXPERT', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }
    const id = req.params.id as string
    const { reason } = z.object({
      reason: z.string().min(1).max(500)
    }).parse(req.body)

    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: 'REJECTED', reason, reviewedBy: req.user!.id }
    })
    res.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Raison obligatoire' })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/proposals/:id/vote
router.post('/proposals/:id/vote', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const userId = req.user!.id

    const proposal = await prisma.proposal.findUnique({ where: { id } })
    if (!proposal) { res.status(404).json({ error: 'Proposition non trouvée' }); return }

    const existingVote = await prisma.vote.findFirst({
      where: { proposalId: id, userId }
    })

    if (existingVote) {
      await prisma.vote.delete({ where: { id: existingVote.id } })
      res.json({ voted: false })
    } else {
      await prisma.vote.create({
        data: { proposalId: id, userId, value: 1 }
      })
      res.json({ voted: true })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// DELETE /api/proposals/:id
router.delete('/proposals/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { translation: true }
    })
    if (!proposal) { res.status(404).json({ error: 'Proposition non trouvée' }); return }

    const isOwner = proposal.createdBy === req.user!.id
    const isExpertOrAdmin = ['EXPERT', 'ADMIN'].includes(req.user!.role)

    // Le créateur peut supprimer ses propres propositions en attente
    // Les experts/admins peuvent tout supprimer
    if (!isExpertOrAdmin && !(isOwner && proposal.status === 'PENDING')) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }

    // Si déjà rejetée/supprimée → supprimer définitivement
    if (proposal.status === 'REJECTED') {
      const verseId = proposal.translation.verseId
      await prisma.vote.deleteMany({ where: { proposalId: id } })
      await prisma.proposal.delete({ where: { id } })
      
      // Supprimer la traduction orpheline si elle existe
      const orphan = await prisma.translation.findFirst({
        where: {
          verseId,
          textFr: proposal.proposedText,
          isReference: false,
          isActive: false,
        },
        include: { proposals: true }
      })
      if (orphan && orphan.proposals.length === 0) {
        await prisma.translation.delete({ where: { id: orphan.id } })
      }

      res.json({ message: 'Proposition supprimée définitivement' })
      return
    }

    const verseId = proposal.translation.verseId

    // Vérifier si cette proposition est la traduction active
    const activeTranslation = await prisma.translation.findFirst({
      where: { verseId, isActive: true }
    })
    const isActive = activeTranslation?.textFr === proposal.proposedText

    await prisma.vote.deleteMany({ where: { proposalId: id } })

    if (isExpertOrAdmin) {
      // Expert/Admin → passe en REJECTED pour garder la trace
      await prisma.proposal.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reason: 'Supprimée par un expert',
          reviewedBy: req.user!.id
        }
      })
    } else {
      // Créateur → suppression définitive
      await prisma.proposal.delete({ where: { id } })
    }

    // Si c'était la proposition active, remettre la Crampon
    if (isActive) {
      await prisma.translation.updateMany({
        where: { verseId },
        data: { isActive: false }
      })
      await prisma.translation.updateMany({
        where: { verseId, isReference: true },
        data: { isActive: true }
      })
    }

    res.json({ message: 'Proposition supprimée' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router