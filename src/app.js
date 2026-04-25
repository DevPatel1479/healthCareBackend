import express from 'express'
import cors from 'cors'
import userRoutes from './routes/user.routes.js'
import otpRoutes from './routes/otp.routes.js';
import caregiverRoutes from './routes/caregiver.routes.js';
import patientRoutes from './routes/patient.routes.js';
import { errorHandler } from './middlewares/error.middleware.js'
import taskAssignmentRoutes from './routes/task_assignment.routes.js';

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/users', userRoutes)
app.use('/api', otpRoutes);
app.use('/api', caregiverRoutes);
app.use('/api', patientRoutes);
app.use('/api/admin', taskAssignmentRoutes);

app.use(errorHandler)


export default app