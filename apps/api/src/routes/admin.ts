import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticateJWT, AuthRequest, checkRole } from '../middlewares/auth'
import { z } from 'zod'
import { logAction } from '../lib/audit'

const router = Router()

// Middleware — toutes les routes admin nécessitent le rôle ADMIN
router.use(authenticateJWT)
router.use(checkRole(['ADMIN']))

// GET /api/admin/stats
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [users, books, verses, wordTranslations, proposals, comments] = await Promise.all([
      prisma.user.count(),
      prisma.book.count(),
      prisma.verse.count(),
      prisma.wordTranslation.count(),
      prisma.proposal.count(),
      prisma.comment.count(),
    ])

    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    })

    const recentUsers = await prisma.user.findMany({
			orderBy: { createdAt: 'desc' },
			take: 5,
			select: { id: true, username: true, role: true, createdAt: true }
		})

		const recentProposals = await prisma.proposal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
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
    })

		const recentWordTranslations = await prisma.wordTranslation.findMany({
			orderBy: { createdAt: 'desc' },
			take: 5,
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

		const recentComments = await prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        creator: { select: { username: true, role: true } },
        verse: {
          select: {
            id: true,
            number: true,
            chapter: { include: { book: true } }
          }
        }
      }
    })

		res.json({ users, books, verses, wordTranslations, proposals, comments, usersByRole, recentUsers, recentProposals, recentWordTranslations, recentComments })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/admin/users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        isActive: true,
        forcePasswordReset: true,
        _count: {
          select: {
            wordTranslations: true,
            proposals: true,
            comments: true,
          }
        }
      }
    })
    res.json(users)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { role } = z.object({
      role: z.enum(['VISITOR', 'NOVICE', 'INTERMEDIATE', 'EXPERT', 'ADMIN'])
    }).parse(req.body)

    if (id === req.user!.id) {
      res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' })
      return
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, username: true, role: true }
    })

    await logAction('ROLE_CHANGE', id, { newRole: role, changedBy: req.user!.id })

    res.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Rôle invalide' })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string

    if (id === req.user!.id) {
      res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' })
      return
    }

    // Anonymiser les contributions plutôt que de tout supprimer
    await prisma.user.update({
      where: { id },
      data: {
        email: `deleted_${id}@deleted.com`,
        username: `[supprimé]`,
        passwordHash: '',
        role: 'VISITOR',
      }
    })

    res.json({ message: 'Compte anonymisé' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/admin/users/:id/kick — déconnecter tous les appareils
router.patch('/users/:id/kick', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (id === req.user!.id) { res.status(400).json({ error: 'Impossible de vous kick vous-même' }); return }

    // Invalider tous les refresh tokens
    await prisma.session.deleteMany({ where: { userId: id } })
    await logAction('ROLE_CHANGE', id, { action: 'KICK', by: req.user!.id }, req.ip)
    res.json({ message: 'Utilisateur déconnecté de tous ses appareils' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/admin/users/:id/force-reset — forcer réinitialisation mdp
router.patch('/users/:id/force-reset', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    await prisma.user.update({
      where: { id },
      data: { forcePasswordReset: true }
    })
    await prisma.session.deleteMany({ where: { userId: id } })
    await logAction('PASSWORD_CHANGE', id, { forced: 'true', by: req.user!.id }, req.ip)
    res.json({ message: 'Réinitialisation du mot de passe forcée' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/admin/users/:id/deactivate — désactiver le compte
router.patch('/users/:id/deactivate', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (id === req.user!.id) { res.status(400).json({ error: 'Impossible de désactiver votre propre compte' }); return }

    await prisma.user.update({
      where: { id },
      data: { isActive: false }
    })
    await prisma.session.deleteMany({ where: { userId: id } })
    await logAction('ACCOUNT_SUSPENDED', id, { by: req.user!.id }, req.ip)
    res.json({ message: 'Compte désactivé' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/admin/users/:id/reactivate — réactiver le compte
router.patch('/users/:id/reactivate', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    await prisma.user.update({
      where: { id },
      data: { isActive: true }
    })
    await logAction('ACCOUNT_SUSPENDED', id, { action: 'REACTIVATED', by: req.user!.id }, req.ip)
    res.json({ message: 'Compte réactivé' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/admin/logs
router.get('/logs', async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { username: true, role: true } }
      }
    })
    res.json(logs)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/admin/contributions
router.get('/contributions', async (req: AuthRequest, res: Response) => {
  try {
    const { testament, book, chapter, verse } = req.query

    const bookFilter = book ? { slug: book as string } : testament ? { testament: testament as string } : undefined
    const chapterFilter = chapter ? { number: Number(chapter) } : undefined
    const verseFilter = verse ? { number: Number(verse) } : undefined

    const whereVerse = {
      ...(verseFilter && chapterFilter && bookFilter ? {
        number: verseFilter.number,
        chapter: { number: chapterFilter.number, book: bookFilter }
      } : chapterFilter && bookFilter ? {
        chapter: { number: chapterFilter.number, book: bookFilter }
      } : bookFilter ? {
        chapter: { book: bookFilter }
      } : {})
    }

    const [wordTranslations, proposals, comments] = await Promise.all([
      prisma.wordTranslation.findMany({
        where: {
          wordToken: {
            verseText: {
              verse: whereVerse
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
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
      }),
      prisma.proposal.findMany({
        where: {
          translation: {
            verse: whereVerse
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          creator: { select: { username: true, role: true } },
          reviewer: { select: { username: true, role: true } },
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
      prisma.comment.findMany({
        where: {
          verse: whereVerse
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          creator: { select: { username: true, role: true } },
          verse: {
            select: {
              id: true,
              number: true,
              chapter: { include: { book: true } }
            }
          }
        }
      }),
    ])

    res.json({ wordTranslations, proposals, comments })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router