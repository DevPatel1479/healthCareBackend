// // controllers/login/login.controller.js

// import prisma from "../../lib/prisma.js";

// export const loginController = async (req, res) => {
//     try {
//         const { phone_number } = req.body;

//         // Validation
//         if (!phone_number) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Phone number is required",
//             });
//         }

//         // Find user by phone number
//         const user = await prisma.users.findFirst({
//             where: {
//                 phone_number,
//             },
//             select: {
//                 user_id: true,
//                 role: true,
//                 full_name: true,
//                 is_verified: true,
//                 caregiver_master: {
//                     select: {
//                         caregiver_id: true,
//                     },
//                 },
//                 patients: {
//                     select: {
//                         patient_id: true,
//                     },
//                     take: 1,
//                 },
//             },
//         });

//         // User not found
//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found",
//             });
//         }

//         let reference_id = null;

//         // Role based ID mapping
//         switch (user.role) {
//             case "family_lead":
//                 reference_id = user.patients?.[0]?.patient_id || null;
//                 break;

//             case "caregiver":
//                 reference_id = user.caregiver_master?.caregiver_id || null;
//                 break;

//             case "admin":
//             case "doctor":
//                 reference_id = user.user_id;
//                 break;

//             default:
//                 reference_id = user.user_id;
//         }

//         // Update last login asynchronously
//         prisma.users.update({
//             where: {
//                 user_id: user.user_id,
//             },
//             data: {
//                 last_login: new Date(),
//             },
//         }).catch((err) => {
//             console.error("Last login update failed:", err);
//         });

//         return res.status(200).json({
//             success: true,
//             message: "Login successful",
//             data: {
//                 user_id: user.user_id,
//                 role: user.role,
//                 reference_id,
//                 full_name: user.full_name,
//                 is_verified: user.is_verified,
//             },
//         });

//     } catch (error) {
//         console.error("Login Error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//         });
//     }
// };





// controllers/login/login.controller.js

import prisma from "../../lib/prisma.js";
import axios from "axios";
import crypto from "crypto";

const EXTERNAL_API_URL = process.env.FAMILY_MEMBER_API_URL;
const EXTERNAL_API_TOKEN = process.env.FAMILY_MEMBER_API_TOKEN;

/**
 * Convert:
 * 12:00am
 * 11:59pm
 * etc
 * into JS Date using supplied date
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
 * Determine shift dynamically
 */
const resolveShiftName = (startTime, endTime) => {
    const start = startTime?.toLowerCase();
    const end = endTime?.toLowerCase();

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

export const loginController = async (req, res) => {
    try {
        const { phone_number } = req.body;

        if (!phone_number) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required",
            });
        }

        /**
         * =========================================================
         * 1. CHECK LOCAL DATABASE FIRST
         * =========================================================
         */

        let user = await prisma.users.findFirst({
            where: {
                phone_number,
            },
            select: {
                user_id: true,
                role: true,
                full_name: true,
                is_verified: true,

                caregiver_master: {
                    select: {
                        caregiver_id: true,
                    },
                },

                patients: {
                    select: {
                        patient_id: true,
                    },
                    take: 1,
                },
            },
        });

        /**
         * =========================================================
         * 2. IF USER NOT FOUND -> CALL EXTERNAL API
         * =========================================================
         */

        if (!user) {
            const currentDate = new Date()
                .toISOString()
                .split("T")[0];

            let externalResponse;

            try {
                externalResponse = await axios.post(
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
            } catch (apiError) {
                const responseData = apiError?.response?.data;

                console.error(
                    "External API Error:",
                    responseData || apiError.message
                );

                // External API explicitly says user not found
                if (
                    responseData?.success === false &&
                    responseData?.message?.toLowerCase().includes("user not found")
                ) {
                    return res.status(404).json({
                        success: false,
                        message: "User not found",
                    });
                }

                return res.status(500).json({
                    success: false,
                    message: "External API request failed",
                });
            }

            const externalData = externalResponse.data;

            if (
                !externalData?.success ||
                !externalData?.records?.length
            ) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            /**
             * =========================================================
             * DECISION MAKER FLOW
             * =========================================================
             */

            if (externalData.role === "decision_maker") {
                const record = externalData.records[0];

                await prisma.$transaction(
                    async (tx) => {

                        /**
                         * -----------------------------------------------------
                         * CREATE FAMILY LEAD USER
                         * matched_phone -> users.phone_number
                         * patient_name -> users.full_name
                         * -----------------------------------------------------
                         */

                        let familyLead = await tx.users.findFirst({
                            where: {
                                phone_number,
                            },
                        });

                        if (!familyLead) {
                            familyLead = await tx.users.create({
                                data: {
                                    role: "family_lead",
                                    full_name:
                                        record.patient_name || "Family Lead",
                                    phone_number,
                                    is_verified: true,
                                },
                            });
                        }

                        /**
                         * -----------------------------------------------------
                         * FAMILY LEAD CONTACT
                         * decision_maker_name goes here
                         * -----------------------------------------------------
                         */

                        const contactExists =
                            await tx.family_lead_contacts.findFirst({
                                where: {
                                    user_id: familyLead.user_id,
                                    phone_number:
                                        record.decision_maker_phone_1,
                                },
                            });

                        if (!contactExists) {
                            await tx.family_lead_contacts.create({
                                data: {
                                    user_id: familyLead.user_id,
                                    contact_name:
                                        record.decision_maker_name,
                                    phone_number:
                                        record.decision_maker_phone_1,
                                    priority: 1,
                                },
                            });
                        }

                        /**
                         * -----------------------------------------------------
                         * UPSERT PATIENT
                         * -----------------------------------------------------
                         */

                        let patient = await tx.patients.findFirst({
                            where: {
                                external_patient_id: Number(
                                    record.patient_id
                                ),
                            },
                        });

                        if (!patient) {
                            patient = await tx.patients.create({
                                data: {
                                    external_patient_id: Number(
                                        record.patient_id
                                    ),

                                    family_lead_id:
                                        familyLead.user_id,

                                    category: "C",

                                    qr_code_hash:
                                        crypto.randomUUID(),
                                },
                            });
                        } else {
                            await tx.patients.update({
                                where: {
                                    patient_id:
                                        patient.patient_id,
                                },
                                data: {
                                    family_lead_id:
                                        familyLead.user_id,
                                },
                            });
                        }

                        /**
                         * -----------------------------------------------------
                         * CAREGIVERS
                         * -----------------------------------------------------
                         */

                        const caregiverData =
                            record.caregivers?.[0];

                        if (caregiverData) {

                            /**
                             * CAREGIVER USER
                             */

                            let caregiver =
                                await tx.users.findFirst({
                                    where: {
                                        phone_number:
                                            caregiverData.caregiver_phone,
                                    },
                                });

                            if (!caregiver) {
                                caregiver =
                                    await tx.users.create({
                                        data: {
                                            role: "caregiver",
                                            full_name:
                                                caregiverData.caregiver_name,
                                            phone_number:
                                                caregiverData.caregiver_phone,
                                            is_verified: true,
                                        },
                                    });
                            }

                            /**
                             * CAREGIVER MASTER
                             */

                            const caregiverMaster =
                                await tx.caregiver_master.findFirst({
                                    where: {
                                        caregiver_id:
                                            caregiver.user_id,
                                    },
                                });

                            if (!caregiverMaster) {
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
                             * DETERMINE SHIFT
                             */

                            const shiftName =
                                resolveShiftName(
                                    caregiverData.service_starttime,
                                    caregiverData.service_endtime
                                );

                            const shift =
                                await tx.shifts.findFirst({
                                    where: {
                                        shift_name: shiftName,
                                    },
                                });

                            /**
                             * SHIFT DATES
                             */

                            const startDateTime =
                                parseDateTime(
                                    caregiverData.service_startdate,
                                    caregiverData.service_starttime
                                );

                            const endDateTime =
                                parseDateTime(
                                    caregiverData.service_enddate,
                                    caregiverData.service_endtime
                                );

                            /**
                             * CHECK EXISTING SHIFT
                             */

                            const existingShift =
                                await tx.caregiver_shifts.findFirst({
                                    where: {
                                        patient_id:
                                            patient.patient_id,

                                        caregiver_id:
                                            caregiver.user_id,
                                    },
                                });

                            /**
                             * INSERT SHIFT ONLY IF NOT EXISTS
                             */

                            if (!existingShift && shift) {
                                await tx.caregiver_shifts.create({
                                    data: {
                                        patient_id:
                                            patient.patient_id,

                                        caregiver_id:
                                            caregiver.user_id,

                                        shift_id:
                                            shift.shift_id,

                                        start_time:
                                            startDateTime,

                                        end_time:
                                            endDateTime,

                                        verified: true,
                                    },
                                });
                            }
                        }
                    },
                    {
                        timeout: 20000,
                        maxWait: 20000,
                    }

                );
            }

            /**
             * =========================================================
             * CAREGIVER FLOW
             * =========================================================
             */

            else if (externalData.role === "caregiver") {
                const record = externalData.records[0];

                await prisma.$transaction(
                    async (tx) => {

                        /**
                         * CREATE CAREGIVER USER
                         */

                        let caregiver = await tx.users.findFirst({
                            where: {
                                phone_number,
                            },
                        });

                        if (!caregiver) {
                            caregiver = await tx.users.create({
                                data: {
                                    role: "caregiver",
                                    full_name:
                                        record.caregiver_name,
                                    phone_number,
                                    is_verified: true,
                                },
                            });
                        }

                        /**
                         * CAREGIVER MASTER
                         */

                        const caregiverMaster =
                            await tx.caregiver_master.findFirst({
                                where: {
                                    caregiver_id:
                                        caregiver.user_id,
                                },
                            });

                        if (!caregiverMaster) {
                            await tx.caregiver_master.create({
                                data: {
                                    caregiver_id:
                                        caregiver.user_id,

                                    external_caregiver_id:
                                        Number(
                                            record.caregiver_id
                                        ),

                                    is_active: true,
                                },
                            });
                        }

                        /**
                         * FIRST PATIENT ONLY
                         */

                        const patientData =
                            record.patients?.[0];

                        if (patientData) {

                            /**
                             * FAMILY LEAD USER
                             */

                            let familyLead =
                                await tx.users.findFirst({
                                    where: {
                                        phone_number:
                                            patientData.decision_maker_phone_1,
                                    },
                                });

                            if (!familyLead) {
                                familyLead =
                                    await tx.users.create({
                                        data: {
                                            role: "family_lead",

                                            full_name:
                                                patientData.patient_name,

                                            phone_number:
                                                patientData.decision_maker_phone_1,

                                            is_verified: true,
                                        },
                                    });
                            }

                            /**
                             * FAMILY LEAD CONTACT
                             */

                            const contactExists =
                                await tx.family_lead_contacts.findFirst({
                                    where: {
                                        user_id:
                                            familyLead.user_id,

                                        phone_number:
                                            patientData.decision_maker_phone_1,
                                    },
                                });

                            if (!contactExists) {
                                await tx.family_lead_contacts.create({
                                    data: {
                                        user_id:
                                            familyLead.user_id,

                                        contact_name:
                                            patientData.decision_maker_name,

                                        phone_number:
                                            patientData.decision_maker_phone_1,

                                        priority: 1,
                                    },
                                });
                            }

                            /**
                             * UPSERT PATIENT
                             */

                            let patient =
                                await tx.patients.findFirst({
                                    where: {
                                        external_patient_id:
                                            Number(
                                                patientData.patient_id
                                            ),
                                    },
                                });

                            if (!patient) {
                                patient =
                                    await tx.patients.create({
                                        data: {
                                            external_patient_id:
                                                Number(
                                                    patientData.patient_id
                                                ),

                                            family_lead_id:
                                                familyLead.user_id,

                                            category: "C",

                                            qr_code_hash:
                                                crypto.randomUUID(),
                                        },
                                    });
                            } else {
                                await tx.patients.update({
                                    where: {
                                        patient_id:
                                            patient.patient_id,
                                    },
                                    data: {
                                        family_lead_id:
                                            familyLead.user_id,
                                    },
                                });
                            }

                            /**
                             * ASSIGNMENT
                             */

                            const assignment =
                                patientData.assignment;

                            const shiftName =
                                resolveShiftName(
                                    assignment.service_starttime,
                                    assignment.service_endtime
                                );

                            const shift =
                                await tx.shifts.findFirst({
                                    where: {
                                        shift_name: shiftName,
                                    },
                                });

                            const startDateTime =
                                parseDateTime(
                                    assignment.service_startdate,
                                    assignment.service_starttime
                                );

                            const endDateTime =
                                parseDateTime(
                                    assignment.service_enddate,
                                    assignment.service_endtime
                                );

                            /**
                             * CHECK EXISTING SHIFT
                             */

                            const existingShift =
                                await tx.caregiver_shifts.findFirst({
                                    where: {
                                        patient_id:
                                            patient.patient_id,

                                        caregiver_id:
                                            caregiver.user_id,
                                    },
                                });

                            if (!existingShift && shift) {
                                await tx.caregiver_shifts.create({
                                    data: {
                                        patient_id:
                                            patient.patient_id,

                                        caregiver_id:
                                            caregiver.user_id,

                                        shift_id:
                                            shift.shift_id,

                                        start_time:
                                            startDateTime,

                                        end_time:
                                            endDateTime,

                                        verified: true,
                                    },
                                });
                            }
                        }
                    });
            }

            /**
             * =========================================================
             * REFETCH USER AFTER INSERTION
             * =========================================================
             */

            user = await prisma.users.findFirst({
                where: {
                    phone_number,
                },
                select: {
                    user_id: true,
                    role: true,
                    full_name: true,
                    is_verified: true,

                    caregiver_master: {
                        select: {
                            caregiver_id: true,
                        },
                    },

                    patients: {
                        select: {
                            patient_id: true,
                        },
                        take: 1,
                    },
                },
            }, {
                timeout: 20000,
                maxWait: 20000,
            }

            );

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }
        }

        /**
         * =========================================================
         * LOGIN RESPONSE
         * =========================================================
         */

        let reference_id = null;

        switch (user.role) {
            case "family_lead":
                reference_id =
                    user.patients?.[0]?.patient_id || null;
                break;

            case "caregiver":
                reference_id =
                    user.caregiver_master?.caregiver_id || null;
                break;

            case "admin":
            case "doctor":
                reference_id = user.user_id;
                break;

            default:
                reference_id = user.user_id;
        }

        /**
         * UPDATE LAST LOGIN ASYNC
         */

        prisma.users
            .update({
                where: {
                    user_id: user.user_id,
                },
                data: {
                    last_login: new Date(),
                },
            })
            .catch((err) => {
                console.error(
                    "Last login update failed:",
                    err
                );
            });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user_id: user.user_id,
                role: user.role,
                reference_id,
                full_name: user.full_name,
                is_verified: user.is_verified,
            },
        });

    } catch (error) {
        console.error("Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

