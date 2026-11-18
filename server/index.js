import express from 'express'
import cookieParser from 'cookie-parser'
import { attachUser } from './auth.js'
import authRoutes from './routes/authRoutes.js'
import taskRoutes from './routes/taskRoutes.js'
import userRoutes from './routes/userRoutes.js'
import teamRoutes from './routes/teamRoutes.js'

const app = express()
const port = process.env.PORT ?? 3001

app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.use(attachUser)

app.use('/api/auth', authRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/users', userRoutes)
app.use('/api/teams', teamRoutes)

// Unknown API routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
