// user.routes.js
import express from 'express'

import { getCaregiverTasks } from '../controllers/caregiver/caregiver.tasks.controller.js';
import { updateTaskStatus } from '../controllers/caregiver/caregiver.update.tasks.controller.js';
import { getAllCaregivers } from '../controllers/caregiver/get.all.caregivers.controller.js';
const router = express.Router()

router.get("/caregiver/:id/tasks", getCaregiverTasks);
router.patch("/tasks/update-status", updateTaskStatus);
router.get("/caregiver/all", getAllCaregivers);



export default router