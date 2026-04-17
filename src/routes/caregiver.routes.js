// user.routes.js
import express from 'express'

import { getCaregiverTasks } from '../controllers/caregiver/caregiver.tasks.controller.js';
const router = express.Router()

router.get("/caregiver/:id/tasks", getCaregiverTasks);

export default router