import { z } from 'zod'
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticateJWT, AuthRequest } from '../middlewares/auth'
import { logAction } from '../lib/audit'

const router = Router()

// GET /api/settings — public
router.get('/settings', async (_req, res: Response) => {
  try {
    const settings = await prisma.setting.findMany()
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    // defaults if not seeded
    res.json({
      vote_threshold_accept: Number(map['vote_threshold_accept'] ?? 5),
      vote_threshold_reject: Number(map['vote_threshold_reject'] ?? -3),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

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
                wordTokens: {
                  include: {
                    translations: { where: { isValidated: true }, take: 1, select: { id: true } }
                  }
                }
              }
            },
            translations: { where: { isActive: true }, take: 1, select: { id: true, textFr: true, isActive: true, isReference: true } },
            _count: {
              select: {
                comments: true,
                translations: true,
              }
            }
          }
        }
      }
    })
    if (!chapter) { res.status(404).json({ error: 'Chapitre non trouvé' }); return }

    // Enrichir avec le compte de propositions actives par verset
    const verseIds = chapter.verses.map((v: { id: string }) => v.id)

    // Étape 1 : récupérer les translations actives du chapitre (requête simple, sans filtre imbriqué)
    const chapterTranslations = await prisma.translation.findMany({
      where: { verseId: { in: verseIds } },
      select: { id: true, verseId: true }
    })
    const translationIdToVerseId: Record<string, string> = {}
    for (const t of chapterTranslations) {
      translationIdToVerseId[t.id] = t.verseId
    }

    // Étape 2 : compter les proposals PENDING/ACCEPTED sur ces translations (requête simple)
    const activeProposals = await prisma.proposal.findMany({
      where: {
        translationId: { in: Object.keys(translationIdToVerseId) },
        status: { in: ['PENDING', 'ACCEPTED'] }
      },
      select: { translationId: true }
    })
    const proposalCountByVerse = new Map<string, number>()
    for (const p of activeProposals) {
      const verseId = translationIdToVerseId[p.translationId]
      if (verseId) {
        proposalCountByVerse.set(verseId, (proposalCountByVerse.get(verseId) || 0) + 1)
      }
    }

    // Étape 3 : vérifier quels versets ont au moins une traduction communautaire (non référence)
    const communityTranslations = await prisma.translation.findMany({
      where: { verseId: { in: verseIds }, isReference: false },
      select: { verseId: true }
    })
    const versesWithCommunityTranslation = new Set(communityTranslations.map((t: { verseId: string }) => t.verseId))

    const enriched = {
      ...chapter,
      verses: chapter.verses.map((v: { id: string; _count: { comments: number; translations: number } }) => ({
        ...v,
        proposalCount: proposalCountByVerse.get(v.id) || 0,
        hasContributions: proposalCountByVerse.has(v.id) || v._count.comments > 0,
        hasCommunityTranslation: versesWithCommunityTranslation.has(v.id) || proposalCountByVerse.has(v.id)
      }))
    }

    res.json(enriched)
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
    await logAction('TRANSLATION_ADDED', req.user!.id, { word: word.word, translation: newTranslation.translation }, req.ip)
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
    await logAction('TRANSLATION_DELETED', req.user!.id, { translationId: id }, req.ip)

    // Notifier le créateur si c'est un expert qui supprime
    if (isExpertOrAdmin && translation.createdBy && translation.createdBy !== req.user!.id) {
      const wordToken = await prisma.wordToken.findUnique({
        where: { id: translation.wordTokenId },
        include: { verseText: { include: { verse: { include: { chapter: { include: { book: true } } } } } } }
      })
      if (wordToken) {
        const verse = wordToken.verseText.verse
        const link = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?word=${wordToken.id}&tab=word#v${verse.number}`
        await prisma.notification.create({
          data: {
            userId: translation.createdBy,
            type: 'PROPOSAL_REJECTED',
            message: `Traduction "${translation.translation}" supprimée`,
            link,
          }
        })
      }
    }

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
    await logAction('TRANSLATION_VALIDATED', req.user!.id, { translationId: id }, req.ip)

    // Notifier le créateur
    const wordTranslation = await prisma.wordTranslation.findUnique({
      where: { id },
      include: {
        wordToken: {
          include: {
            verseText: {
              include: { verse: { include: { chapter: { include: { book: true } } } } }
            }
          }
        }
      }
    })
    if (wordTranslation?.createdBy && wordTranslation.createdBy !== req.user!.id) {
      const verse = wordTranslation.wordToken.verseText.verse
      const link = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?word=${wordTranslation.wordTokenId}&tab=word#v${verse.number}`
      await prisma.notification.create({
        data: {
          userId: wordTranslation.createdBy,
          type: 'PROPOSAL_ACCEPTED',
          message: `Traduction "${wordTranslation.translation}" validée`,
          link,
        }
      })
    }
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
        reactions: { select: { userId: true, emoji: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            creator: { select: { username: true, role: true } },
            reactions: { select: { userId: true, emoji: true } }
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
    await logAction('COMMENT_ADDED', req.user!.id, { verseId: id }, req.ip)
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
        proposalId: parent.proposalId ?? undefined,
      },
      include: {
        creator: { select: { username: true, role: true } }
      }
    })

    // Notifier le créateur du commentaire parent
    if (parent.createdBy && parent.createdBy !== req.user!.id) {
      let link: string | undefined = undefined
      if (parent.verseId) {
        const verse = await prisma.verse.findUnique({
          where: { id: parent.verseId },
          include: { chapter: { include: { book: true } } }
        })
        if (verse) link = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${verse.id}&tab=comments#v${verse.number}`
      } else if (parent.proposalId) {
        const prop = await prisma.proposal.findUnique({
          where: { id: parent.proposalId },
          include: { translation: { include: { verse: { include: { chapter: { include: { book: true } } } } } } }
        })
        if (prop) {
          const verse = prop.translation.verse
          link = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${verse.id}&tab=verse#v${verse.number}`
        }
      }
      const replier = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { username: true } })
      await prisma.notification.create({
        data: {
          userId: parent.createdBy,
          type: 'COMMENT_REPLY',
          message: `@${replier?.username ?? 'quelqu\'un'} : ${text.length > 70 ? text.slice(0, 70) + '…' : text}`,
          link,
        }
      })
    }

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

// GET /api/proposals/:id/comments
router.get('/proposals/:id/comments', async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id as string
    const comments = await prisma.comment.findMany({
      where: { proposalId, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        creator: { select: { username: true, role: true } },
        reactions: { select: { userId: true, emoji: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            creator: { select: { username: true, role: true } },
            reactions: { select: { userId: true, emoji: true } }
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

// POST /api/proposals/:id/comments
router.post('/proposals/:id/comments', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const proposalId = req.params.id as string
    const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(req.body)

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { creator: { select: { id: true, username: true } } }
    })
    if (!proposal) { res.status(404).json({ error: 'Proposition non trouvée' }); return }

    const comment = await prisma.comment.create({
      data: {
        text,
        proposalId,
        createdBy: req.user!.id,
      },
      include: {
        creator: { select: { username: true, role: true } },
        reactions: { select: { userId: true, emoji: true } },
        replies: { include: { creator: { select: { username: true, role: true } }, reactions: { select: { userId: true, emoji: true } } } }
      }
    })

    // Notifier le créateur de la proposition
    if (proposal.createdBy && proposal.createdBy !== req.user!.id) {
      const commenter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { username: true } })
      await prisma.notification.create({
        data: {
          userId: proposal.createdBy,
          type: 'PROPOSAL_COMMENT',
          message: `@${commenter?.username ?? 'quelqu\'un'} a commenté votre proposition`,
        }
      })
    }

    await logAction('COMMENT_ADDED', req.user!.id, { proposalId }, req.ip)
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
    await logAction('COMMENT_DELETED', req.user!.id, { commentId: id }, req.ip)
    res.json({ message: 'Commentaire supprimé' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/comments/:id/react
router.post('/comments/:id/react', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const commentId = req.params.id as string
    const userId = req.user!.id
    const { emoji } = z.object({ emoji: z.string() }).parse(req.body)

    const ALLOWED = ['👍', '❤️', '🙏', '💡']
    if (!ALLOWED.includes(emoji)) {
      res.status(400).json({ error: 'Emoji non autorisé' }); return
    }

    const existing = await prisma.commentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId, emoji } }
    })

    if (existing) {
      await prisma.commentReaction.delete({ where: { id: existing.id } })
    } else {
      await prisma.commentReaction.create({ data: { commentId, userId, emoji } })
    }

    const reactions = await prisma.commentReaction.findMany({
      where: { commentId },
      select: { userId: true, emoji: true }
    })

    res.json({ reactions })
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
        _count: { select: { comments: true, versions: true } },
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
    const { proposedText, reason } = z.object({
      proposedText: z.string().min(1).max(5000),
      reason: z.string().max(500).optional(),
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
        reason: reason || null,
        createdBy: req.user!.id,
      },
      include: {
        creator: { select: { username: true, role: true } }
      }
    })
    await logAction('PROPOSAL_ADDED', req.user!.id, { verseId: id }, req.ip)
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
router.patch('/proposals/:id/accept', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }
    const id = req.params.id as string
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { translation: true }
    })
    if (!proposal) { res.status(404).json({ error: 'Proposition non trouvée' }); return }

    // Réinitialiser les votes pour repartir à zéro après changement de statut
    await prisma.vote.deleteMany({ where: { proposalId: id } })
    // Juste marquer la proposition comme acceptée, sans changer isActive
    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: 'ACCEPTED', reviewedBy: req.user!.id }
    })
    await logAction('PROPOSAL_ACCEPTED', req.user!.id, { proposalId: id }, req.ip)

    // Notifier le créateur et les votants
    const proposalWithVotes = await prisma.proposal.findUnique({
      where: { id },
      include: { votes: true, creator: true, translation: { include: { verse: { include: { chapter: { include: { book: true } } } } } } }
    })
    if (proposalWithVotes) {
      const verse = proposalWithVotes.translation.verse
      const link = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${verse.id}&tab=verse#v${verse.number}`
      const usersToNotify = new Set<string>()
      if (proposalWithVotes.createdBy) usersToNotify.add(proposalWithVotes.createdBy)
      proposalWithVotes.votes.forEach(v => usersToNotify.add(v.userId))
      usersToNotify.delete(req.user!.id) // pas de notif pour celui qui a accepté
      await Promise.all([...usersToNotify].map(userId =>
        prisma.notification.create({
          data: {
            userId,
            type: 'PROPOSAL_ACCEPTED',
            message: `Proposition acceptée`,
            link,
          }
        })
      ))
    }
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/proposals/:id/reopen — remettre en attente (ADMIN)
router.patch('/proposals/:id/reopen', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }
    const id = req.params.id as string
    const proposal = await prisma.proposal.findUnique({ where: { id } })
    if (!proposal) { res.status(404).json({ error: 'Proposition non trouvée' }); return }
    if (proposal.status !== 'ACCEPTED') { res.status(400).json({ error: 'La proposition n\'est pas acceptée' }); return }

    await prisma.vote.deleteMany({ where: { proposalId: id } })
    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: 'PENDING', reviewedBy: null }
    })
    await logAction('PROPOSAL_ACCEPTED', req.user!.id, { proposalId: id, action: 'reopen' }, req.ip)
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

    // Notifier le créateur
    const proposalWithInfo = await prisma.proposal.findUnique({
      where: { id },
      include: { translation: { include: { verse: { include: { chapter: { include: { book: true } } } } } } }
    })
    if (proposalWithInfo?.createdBy && proposalWithInfo.createdBy !== req.user!.id) {
      const verse = proposalWithInfo.translation.verse
      const link = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${verse.id}&tab=verse#v${verse.number}`
      await prisma.notification.create({
        data: {
          userId: proposalWithInfo.createdBy,
          type: 'PROPOSAL_ACCEPTED',
          message: `Proposition activée comme traduction officielle`,
          link,
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
    if (!['ADMIN'].includes(req.user!.role)) {
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
    await logAction('PROPOSAL_REJECTED', req.user!.id, { proposalId: id, reason }, req.ip)

    // Notifier le créateur et les votants
    const proposalWithVotes = await prisma.proposal.findUnique({
      where: { id },
      include: { votes: true, translation: { include: { verse: { include: { chapter: { include: { book: true } } } } } } }
    })
    if (proposalWithVotes) {
      const verse = proposalWithVotes.translation.verse
      const link = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${verse.id}&tab=verse#v${verse.number}`
      const usersToNotify = new Set<string>()
      if (proposalWithVotes.createdBy) usersToNotify.add(proposalWithVotes.createdBy)
      proposalWithVotes.votes.forEach((v: { userId: string }) => usersToNotify.add(v.userId))
      usersToNotify.delete(req.user!.id)
      await Promise.all([...usersToNotify].map(userId =>
        prisma.notification.create({
          data: { userId, type: 'PROPOSAL_REJECTED', message: `Proposition rejetée : ${reason.length > 40 ? reason.slice(0, 40) + '…' : reason}`, link }
        })
      ))
    }
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
    if (!['INTERMEDIATE', 'EXPERT', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Vous devez être au moins Intermédiaire pour voter' }); return
    }
    const id = req.params.id as string
    const userId = req.user!.id
    const { value } = z.object({ value: z.union([z.literal(1), z.literal(-1)]) }).parse(req.body)

    // Fetch thresholds from settings
    const [acceptSetting, rejectSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'vote_threshold_accept' } }),
      prisma.setting.findUnique({ where: { key: 'vote_threshold_reject' } }),
    ])
    const THRESHOLD_ACCEPT = Number(acceptSetting?.value ?? 5)
    const THRESHOLD_REJECT = Number(rejectSetting?.value ?? -3)

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { translation: { include: { verse: { include: { chapter: { include: { book: true } } } } } } }
    })
    if (!proposal) { res.status(404).json({ error: 'Proposition non trouvée' }); return }
    if (proposal.status === 'REJECTED') { res.status(400).json({ error: 'Impossible de voter sur une proposition rejetée' }); return }

    const existingVote = await prisma.vote.findFirst({ where: { proposalId: id, userId } })

    // Avant de voter : compter les votes existants (hors créateur) pour détecter "premier vote"
    const isNewVote = !existingVote
    const isRemoval = !!existingVote && existingVote.value === value
    const prevVoteCount = proposal.createdBy
      ? await prisma.vote.count({ where: { proposalId: id, userId: { not: proposal.createdBy } } })
      : 0

    if (existingVote) {
      if (existingVote.value === value) {
        // Même valeur → annuler le vote
        await prisma.vote.delete({ where: { id: existingVote.id } })
      } else {
        // Valeur différente → changer le vote
        await prisma.vote.update({ where: { id: existingVote.id }, data: { value } })
      }
    } else {
      await prisma.vote.create({ data: { proposalId: id, userId, value } })
    }

    // Recalculer le score
    const allVotes = await prisma.vote.findMany({ where: { proposalId: id } })
    const netScore = allVotes.reduce((sum: number, v: { value: number }) => sum + v.value, 0)

    let newStatus: string = proposal.status

    if (proposal.status === 'PENDING') {
      if (netScore >= THRESHOLD_ACCEPT) {
        await prisma.proposal.update({ where: { id }, data: { status: 'ACCEPTED' } })
        newStatus = 'ACCEPTED'
        if (proposal.createdBy) {
          await prisma.notification.create({
            data: {
              userId: proposal.createdBy,
              type: 'PROPOSAL_ACCEPTED',
              message: `Votre proposition a été acceptée automatiquement par la communauté (score : +${netScore})`,
            }
          })
        }
        await logAction('PROPOSAL_ACCEPTED', userId, { proposalId: id, auto: true, netScore }, req.ip)
        await prisma.vote.deleteMany({ where: { proposalId: id } })
      } else if (netScore <= THRESHOLD_REJECT) {
        await prisma.proposal.update({ where: { id }, data: { status: 'REJECTED', reason: `Rejetée automatiquement par la communauté (score : ${netScore})` } })
        newStatus = 'REJECTED'
        if (proposal.createdBy) {
          await prisma.notification.create({
            data: {
              userId: proposal.createdBy,
              type: 'PROPOSAL_REJECTED',
              message: `Votre proposition a été rejetée automatiquement par la communauté (score : ${netScore})`,
            }
          })
        }
        await logAction('PROPOSAL_REJECTED', userId, { proposalId: id, auto: true, netScore }, req.ip)
        await prisma.vote.deleteMany({ where: { proposalId: id } })
      }
    } else if (proposal.status === 'ACCEPTED') {
      if (netScore <= THRESHOLD_REJECT) {
        await prisma.proposal.update({ where: { id }, data: { status: 'PENDING' } })
        newStatus = 'PENDING'
        if (proposal.createdBy) {
          await prisma.notification.create({
            data: {
              userId: proposal.createdBy,
              type: 'PROPOSAL_REJECTED',
              message: `Votre proposition acceptée a été remise en discussion par la communauté (score : ${netScore})`,
            }
          })
        }
        await prisma.vote.deleteMany({ where: { proposalId: id } })
      }
    }

    const statusChanged = newStatus !== proposal.status

    // Notifier le créateur sur le premier vote (non-créateur, non-annulation, pas de changement de statut)
    if (!statusChanged && !isRemoval && proposal.createdBy && proposal.createdBy !== userId) {
      const isFirstVote = isNewVote && prevVoteCount === 0
      if (isFirstVote) {
        const verse = proposal.translation.verse
        const verseLink = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${verse.id}&tab=verse#v${verse.number}`
        const voter = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
        await prisma.notification.create({
          data: {
            userId: proposal.createdBy,
            type: 'PROPOSAL_VOTE',
            message: `@${voter?.username ?? 'quelqu\'un'} a voté ${value === 1 ? 'pour' : 'contre'} votre proposition`,
            link: verseLink,
          }
        })
      }
    }

    res.json({
      netScore: statusChanged ? 0 : netScore,
      status: newStatus,
      votes: statusChanged ? [] : allVotes.map((v: { userId: string; value: number }) => ({ userId: v.userId, value: v.value }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Valeur de vote invalide' }); return
    }
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/proposals/:id — modifier une proposition (créateur, PENDING uniquement)
router.patch('/proposals/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { proposedText, reason } = z.object({
      proposedText: z.string().min(1).max(5000),
      reason: z.string().max(500).optional(),
    }).parse(req.body)

    const proposal = await prisma.proposal.findUnique({ where: { id } })
    if (!proposal) { res.status(404).json({ error: 'Proposition non trouvée' }); return }
    if (proposal.createdBy !== req.user!.id) { res.status(403).json({ error: 'Accès refusé' }); return }
    if (proposal.status !== 'PENDING') { res.status(400).json({ error: 'Seules les propositions en attente peuvent être modifiées' }); return }

    // Count existing versions then snapshot current text
    const versionCount = await prisma.proposalVersion.count({ where: { proposalId: id } })
    await prisma.proposalVersion.create({
      data: {
        proposalId: id,
        proposedText: proposal.proposedText,
        changeReason: reason ?? null,
        versionNumber: versionCount + 1,
      }
    })

    const updated = await prisma.proposal.update({
      where: { id },
      data: { proposedText, reason: reason ?? null },
    })

    await logAction('PROPOSAL_UPDATED', req.user!.id, { proposalId: id }, req.ip)
    res.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Données invalides', details: error.issues }); return }
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/proposals/:id/versions
router.get('/proposals/:id/versions', async (req: Request, res: Response) => {
  try {
    const versions = await prisma.proposalVersion.findMany({
      where: { proposalId: req.params.id as string },
      orderBy: { versionNumber: 'asc' },
      select: { id: true, proposedText: true, changeReason: true, versionNumber: true, createdAt: true }
    })
    res.json(versions)
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
      await logAction('PROPOSAL_DELETED', req.user!.id, { proposalId: id }, req.ip)
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
      await logAction('PROPOSAL_REJECTED', req.user!.id, { proposalId: id, reason: 'Supprimée par un expert' }, req.ip)
      const proposalWithVotes = await prisma.proposal.findUnique({
        where: { id },
        include: { votes: true, translation: { include: { verse: { include: { chapter: { include: { book: true } } } } } } }
      })
      if (proposalWithVotes) {
        const verse = proposalWithVotes.translation.verse
        const link = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${verse.id}&tab=verse#v${verse.number}`
        const usersToNotify = new Set<string>()
        if (proposalWithVotes.createdBy) usersToNotify.add(proposalWithVotes.createdBy)
        proposalWithVotes.votes.forEach((v: { userId: string }) => usersToNotify.add(v.userId))
        usersToNotify.delete(req.user!.id)
        await Promise.all([...usersToNotify].map(userId =>
          prisma.notification.create({
            data: { userId, type: 'PROPOSAL_REJECTED', message: `Proposition rejetée`, link }
          })
        ))
      }
    } else {
      // Créateur → suppression définitive
      await prisma.proposal.delete({ where: { id } })
      await logAction('PROPOSAL_DELETED', req.user!.id, { proposalId: id }, req.ip)
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

// GET /api/bible/pending — éléments en attente pour experts/admins
router.get('/pending', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['EXPERT', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }

    const [proposals, wordTranslations] = await Promise.all([
      prisma.proposal.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          creator: { select: { username: true, role: true } },
          translation: {
            include: {
              verse: {
                select: {
                  id: true,
                  number: true,
                  chapter: { include: { book: true } }
                }
              }
            }
          }
        }
      }),
      prisma.wordTranslation.findMany({
        where: { isValidated: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          creator: { select: { username: true, role: true } },
          wordToken: {
            select: {
              id: true,
              word: true,
              verseText: {
                include: {
                  verse: {
                    select: {
                      id: true,
                      number: true,
                      chapter: { include: { book: true } }
                    }
                  }
                }
              }
            }
          }
        }
      })
    ])

    res.json({ proposals, wordTranslations })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/search?q=...
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim()
    if (!q || q.length < 2) { res.json([]); return }

    const results = await prisma.verse.findMany({
      where: {
        OR: [
          // Texte original
          {
            texts: {
              some: {
                text: { contains: q, mode: 'insensitive' }
              }
            }
          },
          // Traduction active
          {
            translations: {
              some: {
                isActive: true,
                textFr: { contains: q, mode: 'insensitive' }
              }
            }
          },
          // Traductions acceptées
          {
            translations: {
              some: {
                proposals: {
                  some: {
                    status: 'ACCEPTED',
                    proposedText: { contains: q, mode: 'insensitive' }
                  }
                }
              }
            }
          },
        ]
      },
      take: 20,
      include: {
        texts: { where: { language: { in: ['HEB', 'GRK'] } }, take: 1 },
        translations: { where: { isActive: true }, take: 1 },
        chapter: { include: { book: true } }
      }
    })

    res.json(results)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router