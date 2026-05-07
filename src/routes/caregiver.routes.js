// user.routes.js
import express from 'express'

import { getCaregiverTasks } from '../controllers/caregiver/caregiver.tasks.controller.js';
import { updateTaskStatus } from '../controllers/caregiver/caregiver.update.tasks.controller.js';
import { getAllCaregivers } from '../controllers/caregiver/get.all.caregivers.controller.js';
import { getCaregiverOverallReport } from '../controllers/caregiver/caregiver.overall.report.controller.js';
import { getCaregiverPatientWiseReport } from '../controllers/caregiver/caregiver.patient.wise.report.controller.js';
const router = express.Router()

router.get("/caregiver/:id/tasks", getCaregiverTasks);
router.patch("/tasks/update-status", updateTaskStatus);
router.get("/caregiver/all", getAllCaregivers);
router.post(
    "/caregiver/overall",
    getCaregiverOverallReport
);

router.post(
    "/caregiver/patient-wise",
    getCaregiverPatientWiseReport
);



export default router