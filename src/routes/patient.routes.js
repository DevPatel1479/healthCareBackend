// user.routes.js
import express from 'express'

import { getPatientTasks, createPatientTask } from '../controllers/patient/patient.tasks.controller.js';

const router = express.Router()

router.get("/patient/:id/tasks", getPatientTasks);
router.post("/patient/create-task", createPatientTask);

export default router