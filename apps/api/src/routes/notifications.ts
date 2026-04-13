import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticateJWT, AuthRequest } from '../middlewares/auth'

const router = Router()

// GET /api/notifications
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    res.json(notifications)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    await prisma.notification.update({
      where: { id: id as string, userId: req.user!.id },
      data: { isRead: true }
    })
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PATCH /api/notifications/read-all
router.patch('/read-all', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true }
    })
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router