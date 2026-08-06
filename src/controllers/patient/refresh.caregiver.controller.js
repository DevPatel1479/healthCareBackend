// controllers/patient/refresh.caregiver.controller.js

import prisma from "../../lib/prisma.js";
import axios from "axios";

const EXTERNAL_API_URL = process.env.FAMILY_MEMBER_API_URL;
const EXTERNAL_API_TOKEN = process.env.FAMILY_MEMBER_API_TOKEN;

/**
 * Convert:
 *
 * 05:00am -> Date
 * 01:00pm -> Date
 */
const parseDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;

    const match = timeStr
        .trim()
        .toLowerCase()
        .match(/^(\d{1,2}):(\d{2})(am|pm)$/);

    if (!match) return null;

    let [, hour, minute, meridian] = match;

    hour = Number(hour);
    minute = Number(minute);

    if (meridian === "pm" && hour !== 12) {
        hour += 12;
    }

    if (meridian === "am" && hour === 12) {
        hour = 0;
    }

    const date = new Date(dateStr);

    date.setHours(hour);
    date.setMinutes(minute);
    date.setSeconds(0);
    date.setMilliseconds(0);

    return date;
};


/**
 * Determine shift name from external API.
 */
const resolveShiftName = (startTime, endTime) => {
    const start = startTime?.trim().toLowerCase();
    const end = endTime?.trim().toLowerCase();

    if (start === "05:00am" && end === "01:00pm") {
        return "Morning Shift";
    }

    if (start === "01:00pm" && end === "10:00pm") {
        return "Afternoon";
    }

    if (start === "10:00pm" && end === "05:00am") {
        return "Night";
    }

    return "Full Day";
};


/**
 * Get today's date at local midnight.
 */
const getToday = () => {
    return new Date();

};
/**
 * GET /api/patient/refresh-caregiver
 *
 * Flow:
 *
 * 1. Get authenticated user
 * 2. Find patient
 * 3. Call external API FIRST
 * 4. Get first external record
 * 5. Get first caregiver
 * 6. Check local DB
 * 7. If today's caregiver assignment exists -> return it
 * 8. Otherwise create caregiver + master + shift
 * 9. Return caregiver
 */
export const refreshCaregiverController = async (req, res) => {
    try {
        /**
         * =========================================================
         * 1. GET AUTHENTICATED USER
         * =========================================================
         *
         * DO NOT take userId from req.body.
         *
         * authMiddleware should decode the JWT and put the user
         * information inside req.user.
         */

        const userId = req.user?.user_id;

        console.log(userId);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }


        /**
         * =========================================================
         * 2. FIND PATIENT
         * =========================================================
         *
         * patients.family_lead_id -> users.user_id
         */
        const patient = await prisma.patients.findFirst({
            where: {
                family_lead_id: userId,
                status: "active",
            },

            select: {
                patient_id: true,
                external_patient_id: true,

                users: {
                    select: {
                        phone_number: true,
                    },
                },
            },
        });


        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient not found for logged-in user",
            });
        }


        /**
         * =========================================================
         * 3. PHONE NUMBER
         * =========================================================
         */
        const phoneNumber = patient.users?.phone_number;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Patient phone number is missing",
            });
        }


        /**
         * =========================================================
         * 4. CALL EXTERNAL API FIRST
         * =========================================================
         */
        const currentDate = new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata",
        });

        let externalResponse;

        try {
            externalResponse = await axios.post(
                EXTERNAL_API_URL,
                {
                    date: currentDate,
                    phone_number: phoneNumber,
                },
                {
                    headers: {
                        Authorization: `Bearer ${EXTERNAL_API_TOKEN}`,
                        "Content-Type": "application/json",
                    },

                    timeout: 8000,
                }
            );
        } catch (apiError) {
            const responseData = apiError?.response?.data;

            console.error(
                "External caregiver API error:",
                responseData || apiError.message
            );

            if (
                responseData?.success === false &&
                responseData?.message
                    ?.toLowerCase()
                    .includes("user not found")
            ) {
                return res.status(404).json({
                    success: false,
                    message: "Patient was not found in external system",
                });
            }

            return res.status(502).json({
                success: false,
                message: "Unable to fetch caregiver information",
            });
        }


        /**
         * =========================================================
         * 5. VALIDATE EXTERNAL RESPONSE
         * =========================================================
         */
        const externalData = externalResponse.data;

        if (
            !externalData?.success ||
            !Array.isArray(externalData.records) ||
            externalData.records.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message: "Patient record not found in external system",
            });
        }


        /**
         * =========================================================
         * 6. FIRST RECORD
         * =========================================================
         */
        const record = externalData.records[0];


        /**
         * Make sure the external patient matches
         * our logged-in patient.
         */
        if (
            patient.external_patient_id &&
            Number(record.patient_id) !==
            Number(patient.external_patient_id)
        ) {
            return res.status(409).json({
                success: false,
                message: "External patient does not match logged-in patient",
            });
        }


        /**
         * =========================================================
         * 7. FIRST CAREGIVER
         * =========================================================
         */
        const caregiverData = record.caregivers?.[0];


        /**
         * No caregiver currently assigned.
         */
        if (!caregiverData) {
            return res.status(404).json({
                success: false,
                message: "No caregiver is currently assigned",
                data: {
                    caregiver: null,
                },
            });
        }


        /**
         * Validate caregiver information.
         */
        if (
            !caregiverData.caregiver_id ||
            !caregiverData.caregiver_name ||
            !caregiverData.caregiver_phone
        ) {
            return res.status(502).json({
                success: false,
                message: "External caregiver data is incomplete",
            });
        }


        /**
         * =========================================================
         * 8. TODAY
         * =========================================================
         */

        const today = getToday();
        today.setHours(0, 0, 0, 0);



        /**
         * =========================================================
         * 9. CHECK EXISTING PATIENT ASSIGNMENT
         * =========================================================
         *
         * IMPORTANT:
         *
         * We check AFTER external API, as requested.
         *
         * We only care whether the patient already has a caregiver
         * assignment today.
         */


        const existingAssignment =
            await prisma.caregiver_shifts.findFirst({
                where: {
                    patient_id: patient.patient_id,
                    assignment_date: today
                },

                orderBy: {
                    shift_assignment_id: "asc",
                },

                select: {
                    caregiver_id: true,

                    users: {
                        select: {
                            user_id: true,
                            full_name: true,
                            phone_number: true,
                        },
                    },
                },
            });


        /**
         * =========================================================
         * 10. ALREADY ASSIGNED
         * =========================================================
         */
        if (existingAssignment?.users) {
            return res.status(200).json({
                success: true,
                message: "Caregiver found",
                data: {
                    caregiver: {
                        caregiver_id:
                            existingAssignment.users.user_id,

                        name:
                            existingAssignment.users.full_name,

                        phone_number:
                            existingAssignment.users.phone_number,
                    },
                },
            });
        }


        /**
         * =========================================================
         * 11. RESOLVE SHIFT BEFORE TRANSACTION
         * =========================================================
         */
        const shiftName = resolveShiftName(
            caregiverData.service_starttime,
            caregiverData.service_endtime
        );


        const shift = await prisma.shifts.findFirst({
            where: {
                shift_name: shiftName,
            },

            select: {
                shift_id: true,
            },
        });


        if (!shift) {
            return res.status(500).json({
                success: false,
                message:
                    `Caregiver shift configuration is missing: ${shiftName}`,
            });
        }


        /**
         * =========================================================
         * 12. PARSE DATES
         * =========================================================
         */
        const startDateTime = parseDateTime(
            caregiverData.service_startdate,
            caregiverData.service_starttime
        );

        const endDateTime = parseDateTime(
            caregiverData.service_enddate,
            caregiverData.service_endtime
        );


        if (!startDateTime) {
            return res.status(502).json({
                success: false,
                message: "Invalid caregiver service start time",
            });
        }


        /**
         * =========================================================
         * 13. CREATE / FIND CAREGIVER
         * =========================================================
         */


        console.log("=================================");
        console.log("Current IST date:", new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(new Date()));

        console.log("Date being sent to Prisma:", today);
        console.log("Date being stored:", today.toISOString().slice(0, 10));
        console.log("=================================");
        const result = await prisma.$transaction(
            async (tx) => {

                /**
                 * ---------------------------------------------
                 * CAREGIVER USER
                 * ---------------------------------------------
                 */
                let caregiver = await tx.users.findFirst({
                    where: {
                        phone_number:
                            caregiverData.caregiver_phone,
                    },

                    select: {
                        user_id: true,
                        full_name: true,
                        phone_number: true,
                    },
                });


                if (!caregiver) {

                    caregiver = await tx.users.create({
                        data: {
                            role: "caregiver",

                            full_name:
                                caregiverData.caregiver_name,

                            phone_number:
                                caregiverData.caregiver_phone,

                            is_verified: true,
                        },

                        select: {
                            user_id: true,
                            full_name: true,
                            phone_number: true,
                        },
                    });
                }


                /**
                 * ---------------------------------------------
                 * CAREGIVER MASTER
                 * ---------------------------------------------
                 */
                const existingMaster =
                    await tx.caregiver_master.findUnique({
                        where: {
                            caregiver_id:
                                caregiver.user_id,
                        },

                        select: {
                            caregiver_id: true,
                            external_caregiver_id: true,
                        },
                    });


                if (!existingMaster) {
                    await tx.caregiver_master.create({
                        data: {
                            caregiver_id:
                                caregiver.user_id,

                            external_caregiver_id:
                                Number(
                                    caregiverData.caregiver_id
                                ),

                            is_active: true,
                        },
                    });
                }


                /**
                 * ---------------------------------------------
                 * CREATE SHIFT ASSIGNMENT
                 * ---------------------------------------------
                 *
                 * Your Prisma schema has:
                 *
                 * @@unique([
                 *   patient_id,
                 *   caregiver_id,
                 *   shift_id,
                 *   assignment_date
                 * ])
                 *
                 * Prisma therefore generates this compound
                 * unique selector:
                 *
                 * patient_id_caregiver_id_shift_id_assignment_date
                 */
                const assignment =
                    await tx.caregiver_shifts.upsert({
                        where: {
                            patient_id_caregiver_id_shift_id_assignment_date:
                            {
                                patient_id:
                                    patient.patient_id,

                                caregiver_id:
                                    caregiver.user_id,

                                shift_id:
                                    shift.shift_id,

                                assignment_date:
                                    today,
                            },
                        },

                        /**
                         * If another request already created
                         * the exact same assignment, don't modify it.
                         */
                        update: {},

                        /**
                         * Otherwise create it.
                         */
                        create: {
                            patient_id:
                                patient.patient_id,

                            caregiver_id:
                                caregiver.user_id,

                            shift_id:
                                shift.shift_id,

                            assignment_date:
                                today,

                            start_time:
                                startDateTime,

                            end_time:
                                endDateTime,

                            check_in_method:
                                "qr",

                            verified:
                                true,
                        },

                        select: {
                            shift_assignment_id: true,
                        },
                    });


                return caregiver;
            },

            {
                timeout: 10000,
                maxWait: 5000,
            }
        );


        /**
         * =========================================================
         * 14. RETURN CAREGIVER
         * =========================================================
         */
        return res.status(200).json({
            success: true,
            message: "Caregiver found successfully",

            data: {
                caregiver: {
                    caregiver_id:
                        result.user_id,

                    name:
                        result.full_name,

                    phone_number:
                        result.phone_number,
                },
            },
        });

    } catch (error) {

        console.error(
            "Refresh caregiver error:",
            error
        );


        /**
         * =========================================================
         * HANDLE CONCURRENT REQUEST
         * =========================================================
         *
         * Example:
         *
         * Refresh #1 -> INSERT
         * Refresh #2 -> INSERT
         *
         * Refresh #2 gets P2002.
         *
         * Instead of returning an error to the patient,
         * retrieve the assignment that Refresh #1 just created.
         */
        if (error?.code === "P2002") {

            try {
                const userId = req.user?.user_id;

                if (!userId) {
                    return res.status(401).json({
                        success: false,
                        message: "Authentication required",
                    });
                }


                const patient =
                    await prisma.patients.findFirst({
                        where: {
                            family_lead_id: userId,
                            status: "active",
                        },

                        select: {
                            patient_id: true,
                        },
                    });


                if (!patient) {
                    return res.status(404).json({
                        success: false,
                        message: "Patient not found",
                    });
                }


                const today = getToday();


                const assignment =
                    await prisma.caregiver_shifts.findFirst({
                        where: {
                            patient_id:
                                patient.patient_id,

                            assignment_date:
                                today,
                        },

                        orderBy: {
                            shift_assignment_id: "asc",
                        },

                        select: {
                            users: {
                                select: {
                                    user_id: true,
                                    full_name: true,
                                    phone_number: true,
                                },
                            },
                        },
                    });


                if (assignment?.users) {
                    return res.status(200).json({
                        success: true,
                        message: "Caregiver found",

                        data: {
                            caregiver: {
                                caregiver_id:
                                    assignment.users.user_id,

                                name:
                                    assignment.users.full_name,

                                phone_number:
                                    assignment.users.phone_number,
                            },
                        },
                    });
                }

            } catch (raceError) {
                console.error(
                    "Concurrent assignment recovery failed:",
                    raceError
                );
            }


            return res.status(409).json({
                success: false,
                message:
                    "Caregiver assignment already exists",
            });
        }


        return res.status(500).json({
            success: false,
            message:
                "Failed to refresh caregiver information",
        });
    }
};