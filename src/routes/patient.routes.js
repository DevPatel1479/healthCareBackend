// user.routes.js
import express from 'express'

import { getPatientTasks, createPatientTask } from '../controllers/patient/patient.tasks.controller.js';
import { getPatientDailyReport } from '../controllers/patient/patient.daily.report.controller.js';
import { createPatientWithQR } from '../controllers/patient/patient.create.controller.js';
const router = express.Router()

router.get("/patient/:id/tasks", getPatientTasks);
router.post("/patient/create-task", createPatientTask);
router.post("/patient/daily-report", getPatientDailyReport);
router.post('/patient/create/with-qr', createPatientWithQR);


export default router