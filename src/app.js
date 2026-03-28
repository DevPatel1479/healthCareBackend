import express from 'express'
import cors from 'cors'
import userRoutes from './routes/user.routes.js'
import { errorHandler } from './middlewares/error.middleware.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/users', userRoutes)

app.use(errorHandler)

export default app