import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth'
import bibleRouter from './routes/bible'
import profileRouter from './routes/profile'
import adminRouter from './routes/admin'
import usersRouter from './routes/users'
import notificationsRouter from './routes/notifications'
import { apiLimiter, authLimiter } from './middlewares/rateLimits'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))

app.use(express.json())

// Limite globale : 200 req/min par IP sur toutes les routes API
app.use('/api', apiLimiter)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Biblia API is running' })
})

// authLimiter plus strict sur login/register (10 req / 15 min)
app.use('/api/auth', authLimiter, authRouter)
app.use('/api/profile', profileRouter)
app.use('/api/admin', adminRouter)
app.use('/api/users', usersRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api', bibleRouter)

export default app