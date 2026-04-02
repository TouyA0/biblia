import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticateJWT, AuthRequest, checkRole } from '../middlewares/auth'

const router = Router()

// GET /api/users/:username — profil public
router.get('/:username', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username as string },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            wordTranslations: true,
            proposals: true,
            comments: true,
            votes: true,
          }
        }
      }
    })
    if (!user) { res.status(404).json({ error: 'Utilisateur non trouvé' }); return }
    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/users/:username/contributions — contributions publiques
router.get('/:username/contributions', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username as string } })
    if (!user) { res.status(404).json({ error: 'Utilisateur non trouvé' }); return }

    const [wordTranslations, proposals, comments, activity] = await Promise.all([
      prisma.wordTranslation.findMany({
        where: { createdBy: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          wordToken: {
            include: {
              verseText: {
                include: {
                  verse: { include: { chapter: { include: { book: true } } } }
                }
              }
            }
          }
        }
      }),
      prisma.proposal.findMany({
        where: { createdBy: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          translation: {
            include: {
              verse: { include: { chapter: { include: { book: true } } } }
            }
          }
        }
      }),
      prisma.comment.findMany({
        where: { createdBy: user.id, parentId: null },
        orderBy: { createdAt: 'desc' },
        include: {
          verse: { include: { chapter: { include: { book: true } } } }
        }
      }),
      // Activité par jour sur 12 mois pour le graphique
      prisma.$queryRaw<{ date: string; count: string }[]>`
        SELECT 
          DATE("createdAt")::text as date,
          COUNT(*)::text as count
        FROM (
          SELECT "createdAt" FROM "WordTranslation" WHERE "createdBy" = ${user.id}
          UNION ALL
          SELECT "createdAt" FROM "Proposal" WHERE "createdBy" = ${user.id}
          UNION ALL
          SELECT "createdAt" FROM "Comment" WHERE "createdBy" = ${user.id}
        ) as contributions
        WHERE "createdAt" > NOW() - INTERVAL '12 months'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `
    ])

    res.json({ wordTranslations, proposals, comments, activity })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/users/:username/admin — infos admin (Admin seulement)
router.get('/:username/admin', authenticateJWT, checkRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username as string },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        isActive: true,
        forcePasswordReset: true,
        lastLoginAt: true,
      }
    })
    if (!user) { res.status(404).json({ error: 'Utilisateur non trouvé' }); return }

    const logs = await prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    res.json({ user, logs })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router