import prisma from "../../lib/prisma.js";

// Auth middleware may expose the authenticated user as
// req.user or req.auth. Adjust this helper if your middleware
// uses a different property.
const getAuthUser = (req) => {
    const user = req.user ?? req.auth ?? {};

    return {
        userId: Number(
            user.user_id ??
            user.id ??
            req.userId
        ),
        role: user.role ?? user.user_role,
    };
};

const isPositiveInteger = (value) =>
    Number.isSafeInteger(value) && value > 0;

const getFeedbackSide = (role) => {
    if (role === "family_lead") return "patient_side";
    if (role === "caregiver") return "caregiver_side";

    return null;
};

const VALID_CATEGORIES = [
    "overall_care",
    "caregiver_performance",
    "communication",
    "punctuality",
    "task_clarity",
    "app_experience",
    "other",
];

const hasCareRelationship = async (patientId, caregiverId) => {
    const [assignment, shift] = await Promise.all([
        prisma.task_assignments.findFirst({
            where: {
                patient_id: patientId,
                caregiver_id: caregiverId,
            },
            select: {
                assignment_id: true,
            },
        }),

        prisma.caregiver_shifts.findFirst({
            where: {
                patient_id: patientId,
                caregiver_id: caregiverId,
            },
            select: {
                shift_assignment_id: true,
            },
        }),
    ]);

    return Boolean(assignment || shift);
};

// ----------------------------------------------------
// POST /api/feedback
// Create patient-side or caregiver-side feedback
// ----------------------------------------------------

export const createFeedback = async (req, res) => {
    try {
        const { userId, role } = getAuthUser(req);
        const side = getFeedbackSide(role);

        if (!isPositiveInteger(userId) || !side) {
            return res.status(403).json({
                success: false,
                message:
                    "Only authenticated family leads and caregivers can submit feedback.",
            });
        }

        const patientId = Number(req.body.patient_id);
        const rating = req.body.rating;

        const category =
            req.body.category ?? "overall_care";

        const assignmentId =
            req.body.assignment_id == null
                ? null
                : Number(req.body.assignment_id);

        const requestedCaregiverId =
            req.body.caregiver_id == null
                ? null
                : Number(req.body.caregiver_id);

        if (
            req.body.comments != null &&
            typeof req.body.comments !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Comments must be text.",
            });
        }

        const comments =
            req.body.comments?.trim() || null;

        // Validate patient ID
        if (!isPositiveInteger(patientId)) {
            return res.status(400).json({
                success: false,
                message: "A valid patient_id is required.",
            });
        }

        // Validate star rating
        if (
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Rating must be an integer between 1 and 5.",
            });
        }

        if (!VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Invalid feedback category.",
            });
        }

        if (comments && comments.length > 5000) {
            return res.status(400).json({
                success: false,
                message:
                    "Comments cannot exceed 5000 characters.",
            });
        }

        if (
            assignmentId !== null &&
            !isPositiveInteger(assignmentId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid assignment_id.",
            });
        }

        if (
            requestedCaregiverId !== null &&
            !isPositiveInteger(requestedCaregiverId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid caregiver_id.",
            });
        }

        // Caregiver-side feedback is about their experience,
        // not a review of another caregiver.
        if (
            side === "caregiver_side" &&
            requestedCaregiverId !== null
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Do not specify caregiver_id for caregiver-side feedback.",
            });
        }

        // Check that the patient exists.
        const patient = await prisma.patients.findUnique({
            where: {
                patient_id: patientId,
            },
            select: {
                patient_id: true,
                family_lead_id: true,
            },
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient not found.",
            });
        }

        // Your current schema associates patients with family leads.
        if (
            side === "patient_side" &&
            patient.family_lead_id !== userId
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not authorized to submit feedback for this patient.",
            });
        }

        // Validate an optional task assignment.
        let assignment = null;

        if (assignmentId !== null) {
            assignment =
                await prisma.task_assignments.findUnique({
                    where: {
                        assignment_id: assignmentId,
                    },
                    select: {
                        assignment_id: true,
                        patient_id: true,
                        caregiver_id: true,
                    },
                });

            if (!assignment) {
                return res.status(404).json({
                    success: false,
                    message: "Task assignment not found.",
                });
            }

            if (assignment.patient_id !== patientId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "The assignment does not belong to this patient.",
                });
            }

            if (
                side === "caregiver_side" &&
                assignment.caregiver_id !== userId
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "You are not assigned to this task.",
                });
            }

            if (
                side === "patient_side" &&
                requestedCaregiverId !== null &&
                assignment.caregiver_id !==
                requestedCaregiverId
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "The caregiver does not match the task assignment.",
                });
            }
        }

        // For patient-side feedback, associate the review
        // with the chosen caregiver or assignment's caregiver.
        const targetCaregiverId =
            side === "patient_side"
                ? requestedCaregiverId ??
                assignment?.caregiver_id ??
                null
                : null;

        // When a caregiver provides general patient feedback
        // without an assignment_id, check their relationship
        // with the patient.
        if (
            side === "caregiver_side" &&
            assignment === null
        ) {
            const related = await hasCareRelationship(
                patientId,
                userId
            );

            if (!related) {
                return res.status(403).json({
                    success: false,
                    message:
                        "You are not assigned to this patient.",
                });
            }
        }

        // Validate the caregiver being reviewed.
        if (targetCaregiverId !== null) {
            const caregiver = await prisma.users.findFirst({
                where: {
                    user_id: targetCaregiverId,
                    role: "caregiver",
                },
                select: {
                    user_id: true,
                },
            });

            if (!caregiver) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid caregiver.",
                });
            }

            // If no assignment was supplied, confirm that
            // the caregiver has a relationship with the patient.
            if (assignment === null) {
                const related = await hasCareRelationship(
                    patientId,
                    targetCaregiverId
                );

                if (!related) {
                    return res.status(403).json({
                        success: false,
                        message:
                            "This caregiver is not associated with this patient.",
                    });
                }
            }
        }

        if (
            side === "patient_side" &&
            category === "caregiver_performance" &&
            targetCaregiverId === null
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A caregiver must be selected for caregiver-performance feedback.",
            });
        }

        const feedback = await prisma.feedback.create({
            data: {
                submitted_by_user_id: userId,
                submitted_by_side: side,
                patient_id: patientId,
                caregiver_id: targetCaregiverId,
                assignment_id: assignmentId,
                rating,
                category,
                comments,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Feedback submitted successfully.",
            data: feedback,
        });
    } catch (error) {
        console.error("Create feedback error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to submit feedback.",
        });
    }
};

// ----------------------------------------------------
// GET /api/feedback/mine
// Retrieve feedback submitted by the logged-in user
// ----------------------------------------------------

export const getMyFeedback = async (req, res) => {
    try {
        const { userId } = getAuthUser(req);

        if (!isPositiveInteger(userId)) {
            return res.status(401).json({
                success: false,
                message: "Invalid authenticated user.",
            });
        }

        const feedback = await prisma.feedback.findMany({
            where: {
                submitted_by_user_id: userId,
            },
            include: {
                patient: {
                    select: {
                        patient_id: true,
                        family_lead_id: true,
                    },
                },
                caregiver: {
                    select: {
                        user_id: true,
                        full_name: true,
                    },
                },
                task_assignment: {
                    select: {
                        assignment_id: true,
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            count: feedback.length,
            data: feedback,
        });
    } catch (error) {
        console.error("Get my feedback error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve your feedback.",
        });
    }
};

// ----------------------------------------------------
// GET /api/feedback/caregivers/:caregiverId/summary
// Calculate a caregiver's patient-side rating
// ----------------------------------------------------

export const getCaregiverFeedbackSummary = async (
    req,
    res
) => {
    try {
        const { userId, role } = getAuthUser(req);
        const caregiverId = Number(req.params.caregiverId);

        if (!isPositiveInteger(caregiverId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid caregiver ID.",
            });
        }

        if (
            role !== "admin" &&
            !(role === "caregiver" && userId === caregiverId)
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not authorized to view this rating summary.",
            });
        }

        const caregiver = await prisma.users.findFirst({
            where: {
                user_id: caregiverId,
                role: "caregiver",
            },
            select: {
                user_id: true,
                full_name: true,
            },
        });

        if (!caregiver) {
            return res.status(404).json({
                success: false,
                message: "Caregiver not found.",
            });
        }

        const summary = await prisma.feedback.aggregate({
            where: {
                caregiver_id: caregiverId,
                submitted_by_side: "patient_side",
            },
            _avg: {
                rating: true,
            },
            _count: {
                rating: true,
            },
        });

        return res.status(200).json({
            success: true,
            data: {
                caregiver_id: caregiver.user_id,
                caregiver_name: caregiver.full_name,
                average_rating:
                    summary._avg.rating === null
                        ? null
                        : Number(
                            summary._avg.rating.toFixed(2)
                        ),
                total_reviews: summary._count.rating,
            },
        });
    } catch (error) {
        console.error(
            "Get caregiver feedback summary error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve caregiver rating summary.",
        });
    }
};

// ----------------------------------------------------
// GET /api/feedback/admin
// Admin-only feedback listing
// Optional query filters: patient_id, caregiver_id, side
// ----------------------------------------------------

export const getAllFeedbackForAdmin = async (req, res) => {
    try {
        const { role } = getAuthUser(req);

        if (role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Administrator access required.",
            });
        }

        const where = {};

        if (req.query.patient_id !== undefined) {
            const patientId = Number(req.query.patient_id);

            if (!isPositiveInteger(patientId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid patient_id filter.",
                });
            }

            where.patient_id = patientId;
        }

        if (req.query.caregiver_id !== undefined) {
            const caregiverId = Number(
                req.query.caregiver_id
            );

            if (!isPositiveInteger(caregiverId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid caregiver_id filter.",
                });
            }

            where.caregiver_id = caregiverId;
        }

        if (req.query.side !== undefined) {
            const allowedSides = [
                "patient_side",
                "caregiver_side",
            ];

            if (!allowedSides.includes(req.query.side)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid feedback side filter.",
                });
            }

            where.submitted_by_side = req.query.side;
        }

        const feedback = await prisma.feedback.findMany({
            where,
            include: {
                submitter: {
                    select: {
                        user_id: true,
                        full_name: true,
                        role: true,
                    },
                },
                patient: {
                    select: {
                        patient_id: true,
                        family_lead_id: true,
                    },
                },
                caregiver: {
                    select: {
                        user_id: true,
                        full_name: true,
                    },
                },
                task_assignment: {
                    select: {
                        assignment_id: true,
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
            take: 100,
        });

        return res.status(200).json({
            success: true,
            count: feedback.length,
            data: feedback,
        });
    } catch (error) {
        console.error("Get admin feedback error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve feedback.",
        });
    }
};