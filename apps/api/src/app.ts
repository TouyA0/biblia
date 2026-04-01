import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth'
import bibleRouter from './routes/bible'
import profileRouter from './routes/profile'
import adminRouter from './routes/admin'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))

app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Biblia API is running' })
})

app.use('/api/auth', authRouter)
app.use('/api/profile', profileRouter)
app.use('/api/admin', adminRouter)
app.use('/api', bibleRouter)

export default app