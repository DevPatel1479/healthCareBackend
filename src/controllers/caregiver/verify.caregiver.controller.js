import axios from "axios";
import prisma from "../../lib/prisma.js";


const EXTERNAL_API_URL = process.env.FAMILY_MEMBER_API_URL;
const EXTERNAL_API_TOKEN = process.env.FAMILY_MEMBER_API_TOKEN;




export const verifyCaregiverQr = async (req, res) => {
    try {
        const {
            phone_number,
            caregiver_id,
            patient_id,
        } = req.body;

        if (
            !phone_number ||
            !caregiver_id ||
            !patient_id
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "phone_number, caregiver_id and patient_id are required",
            });
        }

        const currentDate = new Date()
            .toISOString()
            .split("T")[0];

        /**
         * -----------------------------------------
         * STEP 1 : CALL EXTERNAL API
         * -----------------------------------------
         */
        const externalResponse = await axios.post(
            EXTERNAL_API_URL,
            {
                date: currentDate,
                phone_number,
            },
            {
                headers: {
                    Authorization: `Bearer ${EXTERNAL_API_TOKEN}`,
                    "Content-Type": "application/json",
                },
                timeout: 15000,
            }
        );

        const externalData = externalResponse.data;

        if (!externalData?.success) {
            return res.status(400).json({
                success: false,
                message:
                    externalData?.message ||
                    "Verification failed",
            });
        }

        if (externalData.role !== "caregiver") {
            return res.status(403).json({
                success: false,
                message:
                    "Phone number does not belong to a caregiver",
            });
        }

        const caregiverRecord =
            externalData.records?.[0];

        if (!caregiverRecord) {
            return res.status(404).json({
                success: false,
                message:
                    "No caregiver assignment found for today",
            });
        }

        /**
         * -----------------------------------------
         * STEP 2 : VERIFY PATIENT EXISTS
         * -----------------------------------------
         */
        const dbPatient = await prisma.patients.findUnique({
            where: {
                patient_id: Number(patient_id),
            },
            select: {
                patient_id: true,
                external_patient_id: true,
            },
        });

        if (!dbPatient) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        if (!dbPatient.external_patient_id) {
            return res.status(400).json({
                success: false,
                message:
                    "Patient is not mapped to external system",
            });
        }

        const assignedPatient =
            caregiverRecord.patients?.find(
                (patient) =>
                    Number(patient.patient_id) ===
                    Number(dbPatient.external_patient_id)
            );

        if (!assignedPatient) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not assigned to this patient",
            });
        }

        /**
         * -----------------------------------------
         * STEP 3 : GET SHIFT
         * -----------------------------------------
         *
         * Replace later with proper
         * service_starttime/service_endtime mapping.
         */


        const shift = await prisma.shifts.findFirst({
            orderBy: {
                shift_id: "asc",
            },
        });

        if (!shift) {
            return res.status(500).json({
                success: false,
                message:
                    "Shift configuration not found",
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        /**
         * -----------------------------------------
         * STEP 4 : CHECK ACTIVE SHIFT
         * -----------------------------------------
         */

        const now = new Date();

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const existingShift =
            await prisma.caregiver_shifts.findFirst({
                where: {
                    caregiver_id: Number(
                        caregiver_id
                    ),
                    patient_id: Number(
                        patient_id
                    ),
                    assignment_date: today,
                    start_time: {
                        lte: now,
                    },

                    OR: [
                        { end_time: null },
                        { end_time: { gte: now } },
                    ],
                },
                orderBy: {
                    start_time: "desc",
                },
            });

        if (existingShift) {
            return res.status(200).json({
                success: true,
                message:
                    "Caregiver already checked in",
                shift_created: false,
                data: existingShift,
            });
        }

        /**
         * -----------------------------------------
         * STEP 5 : CLOSE PREVIOUS ACTIVE SHIFT
         * -----------------------------------------
         *
         * If caregiver moved from
         * Patient A -> Patient B
         */
        await prisma.caregiver_shifts.updateMany({
            where: {
                caregiver_id: Number(
                    caregiver_id
                ),
                end_time: null,
                patient_id: {
                    not: Number(patient_id),
                },
            },
            data: {
                end_time: new Date(),
            },
        });

        /**
         * -----------------------------------------
         * STEP 6 : CREATE NEW SHIFT
         * -----------------------------------------
         */
        const newShift =
            await prisma.caregiver_shifts.create({
                data: {
                    caregiver_id: Number(
                        caregiver_id
                    ),

                    patient_id: Number(
                        patient_id
                    ),

                    shift_id: shift.shift_id,

                    assignment_date: today,

                    start_time: new Date(),

                    verified: true,

                    check_in_method: "qr",
                },
            });

        return res.status(200).json({
            success: true,
            message:
                "Caregiver verified successfully",

            patient: {
                patient_id:
                    assignedPatient.patient_id,
                patient_name:
                    assignedPatient.patient_name,
            },

            shift_created: true,

            shift: newShift,
        });
    } catch (error) {
        console.error(
            "verifyCaregiverQr error:",
            error?.response?.data || error
        );

        return res.status(
            error?.response?.status || 500
        ).json({
            success: false,
            message:
                error?.response?.data?.message ||
                "Internal server error",
        });
    }
};

