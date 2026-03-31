import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticateJWT, AuthRequest } from '../middlewares/auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const router = Router()

// GET /api/profile — infos de l'utilisateur connecté
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
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

// PATCH /api/profile — modifier le profil
router.patch('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username, email } = z.object({
      username: z.string().min(3).max(30).optional(),
      email: z.string().email().optional(),
    }).parse(req.body)

    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, id: { not: req.user!.id } }
      })
      if (existing) { res.status(409).json({ error: 'Username déjà utilisé' }); return }
    }

    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: req.user!.id } }
      })
      if (existing) { res.status(409).json({ error: 'Email déjà utilisé' }); return }
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { ...(username && { username }), ...(email && { email }) },
      select: { id: true, email: true, username: true, role: true }
    })
    res.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Données invalides', details: error.issues })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/profile/password — changer le mot de passe
router.patch('/password', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    }).parse(req.body)

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!user) { res.status(404).json({ error: 'Utilisateur non trouvé' }); return }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) { res.status(401).json({ error: 'Mot de passe actuel incorrect' }); return }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash }
    })
    res.json({ message: 'Mot de passe modifié avec succès' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Données invalides', details: error.issues })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/profile/contributions — contributions de l'utilisateur
router.get('/contributions', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const [wordTranslations, proposals, comments] = await Promise.all([
      prisma.wordTranslation.findMany({
				where: { createdBy: req.user!.id },
				orderBy: { createdAt: 'desc' },
				take: 10,
				include: {
					wordToken: {
						include: {
							verseText: {
								include: {
									verse: {
										include: { chapter: { include: { book: true } } }
									}
								}
							}
						}
					}
				}
			}),
      prisma.proposal.findMany({
        where: { createdBy: req.user!.id },
        orderBy: { createdAt: 'desc' },
        include: {
					votes: true,
          translation: {
            include: {
              verse: {
                include: { chapter: { include: { book: true } } }
              }
            }
          }
        }
      }),
      prisma.comment.findMany({
        where: { createdBy: req.user!.id },
        orderBy: { createdAt: 'desc' },
        include: {
          verse: {
            include: { chapter: { include: { book: true } } }
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