// user.routes.js
import express from 'express'

import { getCaregiverTasks } from '../controllers/caregiver/caregiver.tasks.controller.js';
import { updateTaskStatus } from '../controllers/caregiver/caregiver.update.tasks.controller.js';
import { getAllCaregivers } from '../controllers/caregiver/get.all.caregivers.controller.js';
import { getCaregiverOverallReport, getCaregiverPatientWiseReport } from '../controllers/caregiver/caregiver.report.controller.js';
import { getCaregiverDetails } from '../controllers/caregiver/get.caregiver.details.controller.js';
import { verifyCaregiverQr } from '../controllers/caregiver/verify.caregiver.controller.js';
const router = express.Router()

router.get("/caregiver/:id/tasks", getCaregiverTasks);
router.patch("/tasks/update-status", updateTaskStatus);
router.get("/caregiver/all", getAllCaregivers);
router.get("/caregiver/details/:caregiver_id", getCaregiverDetails);
router.post(
    "/caregiver/overall",
    getCaregiverOverallReport
);

router.post(
    "/caregiver/patient-wise",
    getCaregiverPatientWiseReport
);

router.post(
    "/verify-caregiver-qr",
    verifyCaregiverQr
);


export default router