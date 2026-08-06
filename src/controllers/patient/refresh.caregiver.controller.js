
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
 *
 * assignment_date is MySQL DATE through Prisma DateTime @db.Date.
 */
const getToday = () => {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return today;
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
 * 5. Get current caregiver from external API
 * 6. Resolve/create local caregiver
 * 7. Check today's local assignment
 * 8. If same caregiver -> keep assignment
 * 9. If different caregiver -> UPDATE today's assignment
 * 10. If no assignment -> CREATE today's assignment
 * 11. Return CURRENT caregiver
 */
export const refreshCaregiverController = async (req, res) => {
    try {

        // =========================================================
        // 1. GET AUTHENTICATED USER
        // =========================================================

        const userId = req.user?.user_id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }


        // =========================================================
        // 2. FIND PATIENT
        // =========================================================

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


        // =========================================================
        // 3. PHONE NUMBER
        // =========================================================

        const phoneNumber = patient.users?.phone_number;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Patient phone number is missing",
            });
        }


        // =========================================================
        // 4. CALL EXTERNAL API FIRST
        // =========================================================

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
                        Authorization: `Bearer ${EXTERNAL_API_TOKEN} `,
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


        // =========================================================
        // 5. VALIDATE EXTERNAL RESPONSE
        // =========================================================

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


        // =========================================================
        // 6. FIRST EXTERNAL RECORD
        // =========================================================

        const record = externalData.records[0];


        // =========================================================
        // 7. VALIDATE EXTERNAL PATIENT
        // =========================================================

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


        // =========================================================
        // 8. GET CURRENT EXTERNAL CAREGIVER
        // =========================================================

        const caregiverData = record.caregivers?.[0];


        if (!caregiverData) {
            return res.status(404).json({
                success: false,
                message: "No caregiver is currently assigned",

                data: {
                    caregiver: null,
                },
            });
        }


        // =========================================================
        // 9. VALIDATE CAREGIVER DATA
        // =========================================================

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


        // =========================================================
        // 10. TODAY
        // =========================================================

        const today = getToday();


        console.log("=================================");
        console.log(
            "Current IST date:",
            new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }).format(new Date())
        );

        console.log(
            "Date being sent to Prisma:",
            today
        );

        console.log(
            "Date being stored:",
            today.toISOString().slice(0, 10)
        );

        console.log("External caregiver:", {
            id: caregiverData.caregiver_id,
            name: caregiverData.caregiver_name,
            phone: caregiverData.caregiver_phone,
        });

        console.log("=================================");


        // =========================================================
        // 11. RESOLVE SHIFT
        // =========================================================

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
                    `Caregiver shift configuration is missing: ${shiftName} `,
            });
        }


        // =========================================================
        // 12. PARSE SERVICE DATES
        // =========================================================

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


        // =========================================================
        // 13. TRANSACTION
        // =========================================================

        const result = await prisma.$transaction(
            async (tx) => {

                // -------------------------------------------------
                // A. FIND OR CREATE LOCAL CAREGIVER
                // -------------------------------------------------

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

                    console.log(
                        "Created new local caregiver:",
                        caregiver.user_id
                    );
                }


                // -------------------------------------------------
                // B. CREATE OR UPDATE CAREGIVER MASTER
                // -------------------------------------------------

                const externalCaregiverId =
                    Number(caregiverData.caregiver_id);


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
                                externalCaregiverId,

                            is_active: true,
                        },
                    });

                } else if (
                    Number(existingMaster.external_caregiver_id) !==
                    externalCaregiverId
                ) {

                    await tx.caregiver_master.update({
                        where: {
                            caregiver_id:
                                caregiver.user_id,
                        },

                        data: {
                            external_caregiver_id:
                                externalCaregiverId,

                            is_active: true,
                        },
                    });
                }


                // -------------------------------------------------
                // C. FIND TODAY'S EXISTING ASSIGNMENT
                // -------------------------------------------------

                const existingAssignment =
                    await tx.caregiver_shifts.findFirst({
                        where: {
                            patient_id:
                                patient.patient_id,

                            assignment_date:
                                today,
                        },

                        orderBy: {
                            shift_assignment_id:
                                "asc",
                        },

                        select: {
                            shift_assignment_id: true,

                            caregiver_id: true,

                            shift_id: true,

                            users: {
                                select: {
                                    user_id: true,
                                    full_name: true,
                                    phone_number: true,
                                },
                            },
                        },
                    });


                // -------------------------------------------------
                // D. NO ASSIGNMENT TODAY
                // -------------------------------------------------

                if (!existingAssignment) {

                    console.log(
                        "No caregiver assignment found for today."
                    );

                    await tx.caregiver_shifts.create({
                        data: {
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
                    });

                    console.log(
                        "Created today's caregiver assignment:",
                        caregiver.user_id
                    );

                    return caregiver;
                }


                // -------------------------------------------------
                // E. SAME CAREGIVER
                // -------------------------------------------------

                if (
                    existingAssignment.caregiver_id ===
                    caregiver.user_id
                ) {

                    console.log(
                        "Same caregiver already assigned:",
                        caregiver.user_id
                    );

                    return caregiver;
                }


                // -------------------------------------------------
                // F. DIFFERENT CAREGIVER
                // -------------------------------------------------

                console.log(
                    "Caregiver changed!"
                );

                console.log(
                    "Old local caregiver:",
                    existingAssignment.caregiver_id
                );

                console.log(
                    "New local caregiver:",
                    caregiver.user_id
                );


                // IMPORTANT:
                //
                // We UPDATE today's assignment rather than returning
                // the old caregiver.
                //
                // This makes createPatientTask find the NEW caregiver
                // when it queries today's active caregiver shift.

                await tx.caregiver_shifts.update({
                    where: {
                        shift_assignment_id:
                            existingAssignment.shift_assignment_id,
                    },

                    data: {
                        caregiver_id:
                            caregiver.user_id,

                        shift_id:
                            shift.shift_id,

                        start_time:
                            startDateTime,

                        end_time:
                            endDateTime,

                        verified:
                            true,
                    },
                });


                console.log(
                    "Updated today's caregiver assignment."
                );

                console.log(
                    "New caregiver:",
                    caregiver.user_id
                );


                // VERY IMPORTANT:
                //
                // Return the NEW caregiver.
                //
                // Do NOT return existingAssignment.users here.

                return caregiver;
            },

            {
                timeout: 10000,
                maxWait: 5000,
            }
        );


        // =========================================================
        // 14. ALWAYS RETURN CURRENT CAREGIVER
        // =========================================================

        return res.status(200).json({
            success: true,

            message: "Caregiver refreshed successfully",

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


        // =========================================================
        // HANDLE CONCURRENT REQUEST
        // =========================================================

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
                            shift_assignment_id:
                                "asc",
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

                        message:
                            "Caregiver found",

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

