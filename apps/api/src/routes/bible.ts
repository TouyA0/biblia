import { z } from 'zod'
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticateJWT, AuthRequest, checkRole } from '../middlewares/auth'
import { logAction } from '../lib/audit'

const router = Router()

// Helper : envoyer des notifications aux @mentions dans un texte
async function notifyMentions(text: string, authorId: string) {
  const rawMentions = [...text.matchAll(/@([A-Za-z0-9_-]{2,30})/g)].map(m => m[1])
  if (rawMentions.length === 0) return
  const unique = [...new Set(rawMentions)]
  const [mentionedUsers, author] = await Promise.all([
    prisma.user.findMany({
      where: { username: { in: unique, mode: 'insensitive' }, isActive: true, NOT: { id: authorId } },
      select: { id: true }
    }),
    prisma.user.findUnique({ where: { id: authorId }, select: { username: true } })
  ])
  if (mentionedUsers.length === 0) return
  await prisma.notification.createMany({
    data: mentionedUsers.map(u => ({
      userId: u.id,
      type: 'MENTION',
      message: `@${author?.username ?? 'quelqu\'un'} vous a mentionné dans un commentaire`,
    })),
    skipDuplicates: true,
  })
}

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
      include: {
        creator:  { select: { username: true, role: true } },
        reviewer: { select: { username: true } },
        votes:    { select: { userId: true, value: true } },
        _count:   { select: { comments: true, versions: true } },
      }
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
    const { translation, reason, tags } = z.object({
      translation: z.string().min(1).max(200),
      reason: z.string().max(500).optional(),
      tags: z.array(z.string()).max(5).optional(),
    }).parse(req.body)
    const word = await prisma.wordToken.findUnique({ where: { id } })
    if (!word) { res.status(404).json({ error: 'Mot non trouvé' }); return }

    // Vérifier doublon
    const existing = await prisma.wordTranslation.findFirst({
      where: { wordTokenId: id, translation: { equals: translation, mode: 'insensitive' }, status: { not: 'REJECTED' } }
    })
    if (existing) {
      res.status(409).json({ error: 'Cette traduction existe déjà pour ce mot' }); return
    }

    const newTranslation = await prisma.wordTranslation.create({
      data: { wordTokenId: id, translation, reason: reason ?? null, tags: tags ?? [], createdBy: req.user!.id },
      include: { creator: { select: { username: true, role: true } }, _count: { select: { comments: true } } }
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

// Helper : récupérer le lien vers un mot
async function wordTranslationLink(wordTranslationId: string): Promise<string | null> {
  const wt = await prisma.wordTranslation.findUnique({
    where: { id: wordTranslationId },
    include: { wordToken: { include: { verseText: { include: { verse: { include: { chapter: { include: { book: true } } } } } } } } }
  })
  if (!wt) return null
  const verse = wt.wordToken.verseText.verse
  return `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?word=${wt.wordTokenId}&tab=word#v${verse.number}`
}

// PATCH /api/word-translations/:id — modifier une traduction de mot
router.patch('/word-translations/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const wt = await prisma.wordTranslation.findUnique({ where: { id }, include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } } })
    if (!wt) { res.status(404).json({ error: 'Traduction non trouvée' }); return }
    const isOwner = wt.createdBy === req.user!.id
    const isExpertOrAdmin = ['EXPERT', 'ADMIN'].includes(req.user!.role)
    if (!isOwner && !isExpertOrAdmin) { res.status(403).json({ error: 'Accès refusé' }); return }
    if (wt.status === 'ACCEPTED' && !isExpertOrAdmin) { res.status(403).json({ error: 'Impossible de modifier une traduction validée' }); return }

    const { translation, reason, tags, changeReason } = z.object({
      translation: z.string().min(1).max(200).optional(),
      reason: z.string().max(500).optional(),
      tags: z.array(z.string()).max(5).optional(),
      changeReason: z.string().max(300).optional(),
    }).parse(req.body)

    const textChanged = translation !== undefined && translation.trim() !== wt.translation
    if (textChanged) {
      const lastVersion = wt.versions[0]
      const nextVersionNum = lastVersion ? lastVersion.versionNumber + 1 : 1
      await prisma.wordTranslationVersion.create({
        data: { wordTranslationId: id, translation: wt.translation, changeReason: changeReason ?? null, versionNumber: nextVersionNum }
      })
    }

    const updated = await prisma.wordTranslation.update({
      where: { id },
      data: {
        ...(translation !== undefined && { translation: translation.trim() }),
        ...(reason !== undefined && { reason }),
        ...(tags !== undefined && { tags }),
      },
      include: { creator: { select: { username: true, role: true } }, _count: { select: { comments: true } } }
    })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// DELETE /api/word-translations/:id
router.delete('/word-translations/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const translation = await prisma.wordTranslation.findUnique({ where: { id } })
    if (!translation) { res.status(404).json({ error: 'Traduction non trouvée' }); return }

    const isOwner = translation.createdBy === req.user!.id
    const isExpertOrAdmin = ['EXPERT', 'ADMIN'].includes(req.user!.role)
    if (!isExpertOrAdmin && !(isOwner && translation.status === 'PENDING')) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }

    await prisma.vote.deleteMany({ where: { wordTranslationId: id } })
    await prisma.wordTranslation.delete({ where: { id } })
    await logAction('TRANSLATION_DELETED', req.user!.id, { translationId: id }, req.ip)

    if (isExpertOrAdmin && translation.createdBy && translation.createdBy !== req.user!.id) {
      const link = await wordTranslationLink(id).catch(() => null)
      await prisma.notification.create({
        data: { userId: translation.createdBy, type: 'PROPOSAL_REJECTED', message: `Traduction "${translation.translation}" supprimée`, link: link ?? undefined }
      })
    }
    res.json({ message: 'Traduction supprimée' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/word-translations/:id/validate — accepter (EXPERT/ADMIN)
router.patch('/word-translations/:id/validate', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['EXPERT', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }
    const id = req.params.id as string
    // Capturer le score avant de supprimer les votes
    const votes = await prisma.vote.findMany({ where: { wordTranslationId: id }, select: { value: true } })
    const score = votes.reduce((s, v) => s + v.value, 0)
    await prisma.vote.deleteMany({ where: { wordTranslationId: id } })
    const now = new Date()
    const updated = await prisma.wordTranslation.update({
      where: { id },
      data: { isValidated: true, status: 'ACCEPTED', reviewedBy: req.user!.id, reviewedAt: now }
    })
    await prisma.wordTranslationEvent.create({
      data: { wordTranslationId: id, type: 'accepted', actorId: req.user!.id, score, createdAt: now }
    })
    await logAction('TRANSLATION_VALIDATED', req.user!.id, { translationId: id }, req.ip)

    if (updated.createdBy && updated.createdBy !== req.user!.id) {
      const link = await wordTranslationLink(id).catch(() => null)
      await prisma.notification.create({
        data: { userId: updated.createdBy, type: 'PROPOSAL_ACCEPTED', message: `Traduction "${updated.translation}" validée`, link: link ?? undefined }
      })
    }
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/word-translations/:id/reject — rejeter (EXPERT/ADMIN)
router.patch('/word-translations/:id/reject', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['EXPERT', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }
    const id = req.params.id as string
    const { reason } = z.object({ reason: z.string().min(1).max(500) }).parse(req.body)
    const votes = await prisma.vote.findMany({ where: { wordTranslationId: id }, select: { value: true } })
    const score = votes.reduce((s, v) => s + v.value, 0)
    await prisma.vote.deleteMany({ where: { wordTranslationId: id } })
    const now = new Date()
    const updated = await prisma.wordTranslation.update({
      where: { id },
      data: { status: 'REJECTED', isValidated: false, reason, reviewedBy: req.user!.id, reviewedAt: now }
    })
    await prisma.wordTranslationEvent.create({
      data: { wordTranslationId: id, type: 'rejected', actorId: req.user!.id, note: reason, score, createdAt: now }
    })
    await logAction('TRANSLATION_DELETED', req.user!.id, { translationId: id, reason }, req.ip)

    if (updated.createdBy && updated.createdBy !== req.user!.id) {
      const link = await wordTranslationLink(id).catch(() => null)
      await prisma.notification.create({
        data: { userId: updated.createdBy, type: 'PROPOSAL_REJECTED', message: `Traduction "${updated.translation}" rejetée · ${reason}`, link: link ?? undefined }
      })
    }
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/word-translations/:id/reopen — remettre en attente (EXPERT/ADMIN)
router.patch('/word-translations/:id/reopen', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['EXPERT', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Accès refusé' }); return
    }
    const id = req.params.id as string
    const updated = await prisma.wordTranslation.update({
      where: { id },
      data: { status: 'PENDING', isValidated: false, reviewedBy: null, reviewedAt: null }
    })
    await prisma.wordTranslationEvent.create({
      data: { wordTranslationId: id, type: 'reopened', actorId: req.user!.id }
    })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/word-translations/:id/comments
router.get('/word-translations/:id/comments', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const comments = await prisma.comment.findMany({
      where: { wordTranslationId: id, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        creator: { select: { username: true, role: true } },
        reactions: true,
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { creator: { select: { username: true, role: true } }, reactions: true }
        }
      }
    })
    res.json(comments)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/word-translations/:id/comments
router.post('/word-translations/:id/comments', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(req.body)
    const wt = await prisma.wordTranslation.findUnique({ where: { id } })
    if (!wt) { res.status(404).json({ error: 'Traduction non trouvée' }); return }

    const comment = await prisma.comment.create({
      data: { wordTranslationId: id, text, createdBy: req.user!.id, targetType: 'word_translation' },
      include: { creator: { select: { username: true, role: true } }, reactions: true }
    })
    await notifyMentions(text, req.user!.id)
    res.status(201).json(comment)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/word-translations/:id/versions
router.get('/word-translations/:id/versions', async (req: Request, res: Response) => {
  try {
    const versions = await prisma.wordTranslationVersion.findMany({
      where: { wordTranslationId: req.params.id as string },
      orderBy: { versionNumber: 'asc' },
      select: { id: true, translation: true, changeReason: true, versionNumber: true, createdAt: true }
    })
    res.json(versions)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/word-translations/:id/timeline
router.get('/word-translations/:id/timeline', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const wt = await prisma.wordTranslation.findUnique({
      where: { id },
      include: {
        creator:  { select: { username: true } },
        versions: { orderBy: { versionNumber: 'asc' }, select: { createdAt: true, changeReason: true, versionNumber: true } },
        votes:    { select: { value: true } },
      }
    })
    if (!wt) { res.status(404).json({ error: 'Traduction non trouvée' }); return }

    const statusEvents = await prisma.wordTranslationEvent.findMany({
      where: { wordTranslationId: id },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { username: true } } }
    })
    const firstComment = await prisma.comment.findFirst({
      where: { wordTranslationId: id }, orderBy: { createdAt: 'asc' }, select: { createdAt: true }
    })

    type Event = { type: string; date: string; [k: string]: unknown }
    const events: Event[] = []

    events.push({ type: 'created', date: wt.createdAt.toISOString(), actor: wt.creator?.username ?? null })
    for (const v of wt.versions) {
      events.push({ type: 'edited', date: v.createdAt.toISOString(), versionNumber: v.versionNumber, changeReason: v.changeReason })
    }
    if (firstComment) {
      events.push({ type: 'commented', date: firstComment.createdAt.toISOString() })
    }
    for (const ev of statusEvents) {
      // Pour accept/reject/reopened : afficher d'abord le score des votes qui ont déclenché la transition
      if (ev.score !== null && ev.score !== undefined && ev.score !== 0) {
        events.push({ type: 'votes', date: ev.createdAt.toISOString(), score: ev.score })
      }
      events.push({ type: ev.type, date: ev.createdAt.toISOString(), actor: ev.actor?.username ?? null, reason: ev.note ?? null })
    }

    const upvotes   = wt.votes.filter((v: { value: number }) => v.value > 0).length
    const downvotes = wt.votes.filter((v: { value: number }) => v.value < 0).length
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    res.json({ events, upvotes, downvotes })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/word-translations/:id/vote
router.post('/word-translations/:id/vote', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!['INTERMEDIATE', 'EXPERT', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Vous devez être au moins Intermédiaire pour voter' }); return
    }
    const id = req.params.id as string
    const userId = req.user!.id
    const { value } = z.object({ value: z.union([z.literal(1), z.literal(-1)]) }).parse(req.body)

    // Fetch thresholds
    const [acceptSetting, rejectSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'vote_threshold_accept' } }),
      prisma.setting.findUnique({ where: { key: 'vote_threshold_reject' } }),
    ])
    const THRESHOLD_ACCEPT = Number(acceptSetting?.value ?? 5)
    const THRESHOLD_REJECT = Number(rejectSetting?.value ?? -3)

    const wt = await prisma.wordTranslation.findUnique({ where: { id } })
    if (!wt) { res.status(404).json({ error: 'Traduction non trouvée' }); return }
    if (wt.status === 'REJECTED') { res.status(400).json({ error: 'Impossible de voter sur une traduction rejetée' }); return }

    const existingVote = await prisma.vote.findFirst({ where: { wordTranslationId: id, userId } })

    if (existingVote) {
      if (existingVote.value === value) {
        // Même valeur → annuler le vote
        await prisma.vote.delete({ where: { id: existingVote.id } })
      } else {
        // Valeur différente → changer le vote
        await prisma.vote.update({ where: { id: existingVote.id }, data: { value } })
      }
    } else {
      await prisma.vote.create({ data: { wordTranslationId: id, userId, value } })
    }

    // Recalculer le score
    const allVotes = await prisma.vote.findMany({ where: { wordTranslationId: id } })
    const netScore = allVotes.reduce((sum: number, v: { value: number }) => sum + v.value, 0)
    const upvotes   = allVotes.filter((v: { value: number }) => v.value > 0).length
    const downvotes = allVotes.filter((v: { value: number }) => v.value < 0).length

    let newStatus: string = wt.status

    if (wt.status === 'PENDING') {
      if (upvotes >= THRESHOLD_ACCEPT) {
        // Auto-accepter
        const score = netScore
        await prisma.vote.deleteMany({ where: { wordTranslationId: id } })
        await prisma.wordTranslation.update({ where: { id }, data: { status: 'ACCEPTED', isValidated: true, voteCount: 0 } })
        await prisma.wordTranslationEvent.create({
          data: { wordTranslationId: id, type: 'accepted', score }
        })
        newStatus = 'ACCEPTED'
        if (wt.createdBy) {
          const link = await wordTranslationLink(id).catch(() => null)
          await prisma.notification.create({
            data: { userId: wt.createdBy, type: 'PROPOSAL_ACCEPTED', message: `Traduction "${wt.translation}" acceptée automatiquement par la communauté (score : +${score})`, link: link ?? undefined }
          })
        }
        await logAction('TRANSLATION_VALIDATED', userId, { translationId: id, auto: true, netScore: score }, req.ip)
      } else if (downvotes >= Math.abs(THRESHOLD_REJECT)) {
        // Auto-rejeter
        const score = netScore
        await prisma.vote.deleteMany({ where: { wordTranslationId: id } })
        await prisma.wordTranslation.update({ where: { id }, data: { status: 'REJECTED', isValidated: false, voteCount: 0, reason: `Rejeté automatiquement par la communauté (score : ${score})` } })
        await prisma.wordTranslationEvent.create({
          data: { wordTranslationId: id, type: 'rejected', score, note: `Rejeté automatiquement par la communauté (score : ${score})` }
        })
        newStatus = 'REJECTED'
        if (wt.createdBy) {
          const link = await wordTranslationLink(id).catch(() => null)
          await prisma.notification.create({
            data: { userId: wt.createdBy, type: 'PROPOSAL_REJECTED', message: `Traduction "${wt.translation}" rejetée automatiquement par la communauté (score : ${score})`, link: link ?? undefined }
          })
        }
        await logAction('TRANSLATION_DELETED', userId, { translationId: id, auto: true, netScore: score }, req.ip)
      } else {
        // Juste mettre à jour voteCount
        await prisma.wordTranslation.update({ where: { id }, data: { voteCount: netScore } })
      }
    } else if (wt.status === 'ACCEPTED') {
      if (netScore <= THRESHOLD_REJECT) {
        // Remettre en attente — effacer les votes + créer un event
        const score = netScore
        await prisma.vote.deleteMany({ where: { wordTranslationId: id } })
        await prisma.wordTranslation.update({ where: { id }, data: { status: 'PENDING', isValidated: false, voteCount: 0 } })
        await prisma.wordTranslationEvent.create({
          data: { wordTranslationId: id, type: 'reopened', actorId: userId, score, note: `${upvotes} pour, ${downvotes} contre` }
        })
        newStatus = 'PENDING'
      } else {
        await prisma.wordTranslation.update({ where: { id }, data: { voteCount: netScore } })
      }
    }

    const statusChanged = newStatus !== wt.status
    const finalUserVote = statusChanged ? 0 : (allVotes.find((v: { userId: string; value: number }) => v.userId === userId)?.value ?? 0)

    res.json({
      netScore: statusChanged ? 0 : netScore,
      status: newStatus,
      userVote: finalUserVote,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Valeur de vote invalide' }); return
    }
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
    await notifyMentions(text, req.user!.id)
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

    await notifyMentions(text, req.user!.id)
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

    await notifyMentions(text, req.user!.id)
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
    const { proposedText, reason, tags } = z.object({
      proposedText: z.string().min(1).max(5000),
      reason: z.string().max(500).optional(),
      tags: z.array(z.string().max(50)).max(5).optional().default([]),
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
        tags: tags ?? [],
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

    // Capturer le score avant de supprimer les votes
    const votesBeforeAccept = await prisma.vote.findMany({ where: { proposalId: id }, select: { value: true } })
    const scoreBeforeAccept = votesBeforeAccept.reduce((s, v) => s + v.value, 0)
    // Réinitialiser les votes pour repartir à zéro après changement de statut
    await prisma.vote.deleteMany({ where: { proposalId: id } })
    // Juste marquer la proposition comme acceptée, sans changer isActive
    const now = new Date()
    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: 'ACCEPTED', reviewedBy: req.user!.id, reviewedAt: now }
    })
    // Journal immuable (score au moment de l'acceptation)
    await prisma.proposalEvent.create({
      data: { proposalId: id, type: 'accepted', actorId: req.user!.id, createdAt: now, score: scoreBeforeAccept }
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

    // Capturer le score avant de supprimer les votes
    const votesBeforeReopen = await prisma.vote.findMany({ where: { proposalId: id }, select: { value: true } })
    const scoreBeforeReopen = votesBeforeReopen.reduce((s, v) => s + v.value, 0)
    await prisma.vote.deleteMany({ where: { proposalId: id } })
    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: 'PENDING', reviewedBy: null, reviewedAt: null }
    })
    // Journal immuable — l'historique d'acceptation est préservé dans ProposalEvent
    await prisma.proposalEvent.create({
      data: { proposalId: id, type: 'reopened', actorId: req.user!.id, score: scoreBeforeReopen }
    })
    await logAction('PROPOSAL_REOPENED', req.user!.id, { proposalId: id }, req.ip)
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
    // Journal immuable
    await prisma.proposalEvent.create({
      data: { proposalId: id, type: 'activated', actorId: req.user!.id }
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

    // Capturer le score avant de supprimer les votes
    const votesBeforeReject = await prisma.vote.findMany({ where: { proposalId: id }, select: { value: true } })
    const scoreBeforeReject = votesBeforeReject.reduce((s, v) => s + v.value, 0)
    await prisma.vote.deleteMany({ where: { proposalId: id } })
    const now = new Date()
    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: 'REJECTED', reason, reviewedBy: req.user!.id, reviewedAt: now }
    })
    // Journal immuable
    await prisma.proposalEvent.create({
      data: { proposalId: id, type: 'rejected', actorId: req.user!.id, note: reason, createdAt: now, score: scoreBeforeReject }
    })
    await logAction('PROPOSAL_REJECTED', req.user!.id, { proposalId: id, reason }, req.ip)

    // Notifier le créateur et les votants (votes déjà supprimés, on récupère depuis la DB avec le contexte de notif)
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
    const { proposedText, reason, tags } = z.object({
      proposedText: z.string().min(1).max(5000),
      reason: z.string().max(500).optional(),
      tags: z.array(z.string().max(50)).max(5).optional(),
    }).parse(req.body)

    const proposal = await prisma.proposal.findUnique({ where: { id } })
    if (!proposal) { res.status(404).json({ error: 'Proposition non trouvée' }); return }
    if (proposal.createdBy !== req.user!.id) { res.status(403).json({ error: 'Accès refusé' }); return }
    if (proposal.status !== 'PENDING') { res.status(400).json({ error: 'Seules les propositions en attente peuvent être modifiées' }); return }

    // Snapshot uniquement si le texte a réellement changé
    const textChanged = proposedText.trim() !== proposal.proposedText.trim()
    if (textChanged) {
      const versionCount = await prisma.proposalVersion.count({ where: { proposalId: id } })
      await prisma.proposalVersion.create({
        data: {
          proposalId: id,
          proposedText: proposal.proposedText,
          changeReason: reason ?? null,
          versionNumber: versionCount + 1,
        }
      })
    }

    const updated = await prisma.proposal.update({
      where: { id },
      data: { proposedText, reason: reason ?? null, ...(tags !== undefined && { tags }) },
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

    const verseId = proposal.translation.verseId

    // Vérifier si cette proposition est la traduction active
    const activeTranslation = await prisma.translation.findFirst({
      where: { verseId, isActive: true }
    })
    const isActive = activeTranslation?.textFr === proposal.proposedText

    // Supprimer votes + proposition dans tous les cas
    await prisma.vote.deleteMany({ where: { proposalId: id } })
    await prisma.proposal.delete({ where: { id } })

    // Supprimer la traduction orpheline si elle existe
    const orphan = await prisma.translation.findFirst({
      where: { verseId, textFr: proposal.proposedText, isReference: false, isActive: false },
      include: { proposals: true }
    })
    if (orphan && orphan.proposals.length === 0) {
      await prisma.translation.delete({ where: { id: orphan.id } })
    }

    await logAction('PROPOSAL_DELETED', req.user!.id, { proposalId: id }, req.ip)

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

// GET /api/proposals/:id/timeline
router.get('/proposals/:id/timeline', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        creator:  { select: { username: true } },
        versions: { orderBy: { versionNumber: 'asc' }, select: { createdAt: true, changeReason: true, versionNumber: true } },
        votes:    { select: { value: true }, orderBy: { createdAt: 'asc' } },
      }
    })
    if (!proposal) { res.status(404).json({ error: 'Proposition non trouvée' }); return }

    // Événements de statut (journal immuable)
    const statusEvents = await prisma.proposalEvent.findMany({
      where: { proposalId: id },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { username: true } } }
    })

    // Premier commentaire
    const firstComment = await prisma.comment.findFirst({
      where: { proposalId: id }, orderBy: { createdAt: 'asc' }, select: { createdAt: true }
    })

    type Event = { type: string; date: string; [k: string]: unknown }
    const events: Event[] = []

    // Création
    events.push({ type: 'created', date: proposal.createdAt.toISOString(), actor: proposal.creator?.username ?? null })

    // Modifications (versions)
    for (const v of proposal.versions) {
      events.push({ type: 'edited', date: v.createdAt.toISOString(), versionNumber: v.versionNumber, changeReason: v.changeReason })
    }

    if (firstComment) {
      events.push({ type: 'commented', date: firstComment.createdAt.toISOString() })
    }

    // Événements de statut depuis le journal immuable
    // Pour chaque changement de statut, on injecte d'abord les votes accumulés (si ≠ 0)
    for (const ev of statusEvents) {
      if (ev.score !== null && ev.score !== undefined && ev.score !== 0) {
        // Même timestamp → apparaît juste avant grâce à l'ordre d'insertion (sort stable)
        events.push({ type: 'votes', date: ev.createdAt.toISOString(), score: ev.score })
      }
      events.push({
        type: ev.type,  // accepted | rejected | reopened | activated
        date: ev.createdAt.toISOString(),
        actor: ev.actor?.username ?? null,
        reason: ev.note ?? null,
      })
    }

    // Score actuel des votes
    const upvotes   = proposal.votes.filter((v: { value: number }) => v.value > 0).length
    const downvotes = proposal.votes.filter((v: { value: number }) => v.value < 0).length

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    res.json({ events, upvotes, downvotes })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// ── File de révision ──────────────────────────────────────────────────────────

// GET /api/review/proposals — propositions PENDING (EXPERT/ADMIN)
router.get('/review/proposals', authenticateJWT, checkRole(['EXPERT', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const proposals = await prisma.proposal.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        creator: { select: { username: true, role: true } },
        votes: { select: { id: true, userId: true, value: true } },
        _count: { select: { comments: true } },
        translation: {
          include: {
            verse: {
              include: {
                chapter: {
                  include: { book: { select: { name: true, slug: true, testament: true } } }
                }
              }
            }
          }
        }
      }
    })
    res.json(proposals)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/review/words — traductions de mots non validées (EXPERT/ADMIN)
router.get('/review/words', authenticateJWT, checkRole(['EXPERT', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const words = await prisma.wordTranslation.findMany({
      where: { isValidated: false },
      orderBy: { createdAt: 'asc' },
      include: {
        creator: { select: { username: true, role: true } },
        wordToken: {
          select: {
            id: true,
            word: true,
            lemma: true,
            verseText: {
              include: {
                verse: {
                  include: {
                    chapter: {
                      include: { book: { select: { name: true, slug: true, testament: true } } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
    res.json(words)
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