import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

export interface AuthRequest extends Request {
  user?: {
    id: string
    role: string
  }
}

export const authenticateJWT = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    res.status(401).json({ error: 'Token manquant' })
    return
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string }
    
    // Vérifier que l'utilisateur est toujours actif
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, isActive: true }
    })
    
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Compte désactivé ou introuvable' })
      return
    }

    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide' })
  }
}

export const checkRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Accès refusé' })
      return
    }
    next()
  }
}