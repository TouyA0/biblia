import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { logAction } from '../lib/audit'
import { authenticateJWT, AuthRequest } from '../middlewares/auth'
import crypto from 'crypto'

const router = Router()

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8)
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, username, password } = registerSchema.parse(req.body)

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    })
    if (existing) {
      res.status(409).json({ error: 'Email ou username déjà utilisé' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, username, passwordHash, isVerified: true }
    })

    await logAction('REGISTER', user.id, { username: user.username }, req.ip)

    res.status(201).json({
      message: 'Compte créé avec succès',
      user: { id: user.id, email: user.email, username: user.username, role: user.role }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Données invalides', details: error.issues })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' })
      return
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' })
      return
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Ce compte a été désactivé' }); return
    }

    if (user.forcePasswordReset) {
      res.status(403).json({ error: 'FORCE_PASSWORD_RESET' }); return
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    )

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: '30d' }
    )

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    })

    res.json({ 
      token, 
      refreshToken, 
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      forcePasswordReset: user.forcePasswordReset
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Données invalides', details: error.issues })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token manquant' })
      return
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as { id: string }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

    const session = await prisma.session.findUnique({ where: { tokenHash } })
    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({ error: 'Session invalide ou expirée' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } })
    if (!user) {
      res.status(401).json({ error: 'Utilisateur introuvable' })
      return
    }

    const newToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    )

    await logAction('LOGIN', user.id, { username: user.username }, req.ip)

    res.json({ token: newToken })
  } catch {
    res.status(401).json({ error: 'Refresh token invalide' })
  }
})

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
      await prisma.session.deleteMany({ where: { tokenHash } })
    }

    const authReq = req as AuthRequest
    if (authReq.user?.id) {
      await logAction('LOGOUT', authReq.user.id, {}, req.ip)
    }

    res.json({ message: 'Déconnexion réussie' })
  } catch {
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router