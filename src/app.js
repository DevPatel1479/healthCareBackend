import express from 'express'
import cors from 'cors'
import userRoutes from './routes/user.routes.js'
import otpRoutes from './routes/otp.routes.js';
import caregiverRoutes from './routes/caregiver.routes.js';
import patientRoutes from './routes/patient.routes.js';
import { errorHandler } from './middlewares/error.middleware.js'
import taskAssignmentRoutes from './routes/task_assignment.routes.js';
import loginRoutes from './routes/login.routes.js';
import systemRoutes from './routes/system.routes.js';
import uploadRoutes from "./routes/file.upload.routes.js";


const app = express()

app.use(cors())
app.use(express.json())


const healthCheck = (req, res) => {
    res.status(200).json({
        message: 'Server is running',
        timestamp: new Date()
    });
}


app.get('/health', healthCheck);
app.use('/api/users', userRoutes)
app.use('/api', otpRoutes);
app.use('/api', caregiverRoutes);
app.use('/api', patientRoutes);
app.use('/api/admin', taskAssignmentRoutes);
app.use('/api', loginRoutes);
app.use('/api/system', systemRoutes);
app.use("/api", uploadRoutes);

app.use(errorHandler)


export default app