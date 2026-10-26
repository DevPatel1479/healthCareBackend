import express from "express";

import {
    createFeedback,
    getMyFeedback,
    getCaregiverFeedbackSummary,
    getAllFeedbackForAdmin,
} from "../../controllers/feedback/feedback.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

// Submit patient-side or caregiver-side feedback
router.post("/", createFeedback);

// View feedback submitted by the logged-in user
router.get("/mine", getMyFeedback);

// Get a caregiver's average rating and review count
router.get(
    "/caregivers/:caregiverId/summary",
    getCaregiverFeedbackSummary
);

// Admin-only feedback listing
router.get("/admin", getAllFeedbackForAdmin);

export default router;