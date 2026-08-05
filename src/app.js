import path from "path";
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


// V2 routes


import otpV2Routes from "./routes/v2/otp.routes.js";
import caregiverV2Routes from "./routes/v2/caregiver.routes.js";
import patientV2Routes from "./routes/v2/patient.routes.js";
import taskAssignmentV2Routes from "./routes/v2/task_assignment.routes.js";
import loginV2Routes from "./routes/v2/login.routes.js";
import systemV2Routes from "./routes/v2/system.routes.js";
import uploadV2Routes from "./routes/v2/file.upload.routes.js";


const app = express()

app.use(cors())
app.use(express.json())

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const healthCheck = (req, res) => {
    res.status(200).json({
        message: 'Server is running',
        timestamp: new Date()
    });
}

app.get('/health', healthCheck);

/*
 * =========================================================
 * Legacy API
 * =========================================================
 * Existing endpoints.
 * Do not modify these routes while introducing API v2.
 */


app.use('/api/users', userRoutes)
app.use('/api', otpRoutes);
app.use('/api', caregiverRoutes);
app.use('/api', patientRoutes);
app.use('/api/admin', taskAssignmentRoutes);
app.use('/api', loginRoutes);
app.use('/api/system', systemRoutes);
app.use("/api", uploadRoutes);


/*
 * =========================================================
 * API V2
 * =========================================================
 * New RESTful and versioned API endpoints.
 */


app.use("/api/v2", otpV2Routes);
app.use("/api/v2", loginV2Routes);
app.use("/api/v2/admin", taskAssignmentV2Routes);
app.use("/api/v2/system", systemV2Routes);
app.use("/api/v2", caregiverV2Routes);
app.use("/api/v2", patientV2Routes);
app.use("/api/v2", uploadV2Routes);



app.use(errorHandler)




export default app
