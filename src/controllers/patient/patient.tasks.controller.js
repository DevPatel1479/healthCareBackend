

import { date } from "zod";
import prisma from "../../lib/prisma.js";
import { io } from "../../server.js";
// import { assignTaskToCaregiver } from "../task_assignment/assign.task.controller.js";

// export const getPatientTasks = async (req, res) => {
//   try {
//     const patientId = parseInt(req.params.id); // ✅ dynamic

//     const assignments = await prisma.task_assignments.findMany({
//       where: {
//         patient_id: patientId,
//       },
//       include: {
//         care_tasks: true,
//         users: {
//           select: {
//             full_name: true,
//             phone_number: true,
//           },
//         },
//         patients: {
//           include: {
//             users: {
//               select: {
//                 full_name: true,
//               },
//             },
//           },

//         },
//       },

//     });
//     const activeCaregiverShift =
//       await prisma.caregiver_shifts.findFirst({

//         where: {
//           patient_id: patientId,
//           verified: true,
//         },

//         orderBy: {
//           start_time: "desc",
//         },

//         include: {
//           users: {
//             select: {
//               full_name: true,
//               phone_number: true,
//             },
//           },

//           shifts: true,
//         },
//       });

//     const result = assignments.map((a) => ({
//       assignment_id: a.assignment_id,
//       status: a.status,
//       time_done: a.time_done,
//       flag_level: a.flag_level,
//       observation: a.observation,

//       task: a.care_tasks,

//       patient: a.patients?.users
//         ? {
//           name: a.patients.users.full_name,
//         }
//         : null,
//     }));

//     return res.json({
//       success: true,

//       caregiver: activeCaregiverShift?.users
//         ? {
//           name: activeCaregiverShift.users.full_name,
//           phone: activeCaregiverShift.users.phone_number,
//           shift: activeCaregiverShift.shifts?.shift_name,
//         }
//         : null,

//       data: result,
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };


const getIndiaDateString = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

// Use UTC midnight for date-only MySQL fields.
const getTodayDateOnly = () =>
  new Date(`${getIndiaDateString()}T00:00:00.000Z`);

const getDateBoundaries = (dateString) => {
  const selectedDate = dateString || getIndiaDateString();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  const dateCheck = new Date(`${selectedDate}T00:00:00.000Z`);

  if (
    Number.isNaN(dateCheck.getTime()) ||
    dateCheck.toISOString().slice(0, 10) !== selectedDate
  ) {
    throw new Error("Invalid date");
  }

  // Start of the selected day in India, represented as an instant.
  const startOfDay = new Date(
    `${selectedDate}T00:00:00.000+05:30`
  );

  // Exclusive end boundary: midnight of the following IST day.
  const nextDayStart = new Date(
    `${selectedDate}T00:00:00.000+05:30`
  );

  nextDayStart.setUTCDate(nextDayStart.getUTCDate() + 1);

  const endOfDay = new Date(
    nextDayStart.getTime() - 1
  );

  // Date-only field: preserve the requested YYYY-MM-DD value.
  const assignmentDate = new Date(
    `${selectedDate}T00:00:00.000Z`
  );

  return {
    startOfDay,
    nextDayStart,
    endOfDay,
    assignmentDate,
    selectedDate,
  };
};



export const getPatientTasks = async (req, res) => {
  try {
    const patientId = Number(req.params.id);

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient id",
      });
    }

    const requestedDate = req.query.date;

    if (
      requestedDate !== undefined &&
      typeof requestedDate !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Date must be in YYYY-MM-DD format",
      });
    }
    let dateInfo;
    // // IST date boundaries
    // const nowIST = new Date(
    //   new Date().toLocaleString("en-US", {
    //     timeZone: "Asia/Kolkata",
    //   })
    // );
    // const now = new Date();
    // const startOfDay = new Date(nowIST);
    // startOfDay.setHours(0, 0, 0, 0);

    // const endOfDay = new Date(nowIST);
    // endOfDay.setHours(23, 59, 59, 999);
    // const today = getTodayDateOnly();

    try {
      dateInfo = getDateBoundaries(requestedDate);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const {
      startOfDay,
      nextDayStart,
      endOfDay,
      assignmentDate,
      selectedDate,
    } = dateInfo;

    // -----------------------------------------
    // Is requested date today?
    // -----------------------------------------

    const todayIST = new Date().toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Kolkata",
      }
    );

    const isToday = selectedDate === todayIST;

    const now = new Date();
    const [
      assignments,
      completedToday,
      activeCaregiverShift,
    ] = await Promise.all([

      prisma.task_assignments.findMany({
        where: {
          patient_id: patientId,
        },

        include: {
          care_tasks: true,

          patients: {
            include: {
              users: {
                select: {
                  full_name: true,
                },
              },
            },
          },
        },

        orderBy: {
          assignment_id: "asc",
        },
      }),

      prisma.completed_tasks.findMany({
        // where: {
        //   patient_id: patientId,
        // },
        where: {
          patient_id: patientId,
          actual_time_done: {
            lt: nextDayStart,
          },
        },
        orderBy: {
          actual_time_done: "desc",
        },
        select: {
          task_id: true,
          status: true,
          actual_time_done: true,
          flag_level: true,
          observation: true,
          photo_evidence: true,
        },
      }),

      prisma.caregiver_shifts.findFirst({
        where: {
          patient_id: patientId,
          verified: true,
          assignment_date: assignmentDate,
          // start_time: {
          //   lte: now,
          // },
          // OR: [
          //   { end_time: null },
          //   { end_time: { gte: now } },
          // ],
          ...(isToday
            ? {
              start_time: {
                lte: now,
              },

              OR: [
                {
                  end_time: null,
                },
                {
                  end_time: {
                    gte: now,
                  },
                },
              ],
            }
            : {}),
        },

        orderBy: {
          start_time: "desc",
        },

        include: {
          users: {
            select: {
              full_name: true,
              phone_number: true,
            },
          },

          shifts: true,
        },
      }),
    ]);


    // task_id -> completion row
    // const completedMap = new Map();

    // completedToday.forEach((row) => {
    //   completedMap.set(row.task_id, row);
    // });

    const filteredAssignments = assignments.filter(
      (assignment) => {

        const isDailyRoutine =
          assignment.care_tasks?.task_category ===
          "Daily_Routine";

        // Daily routines keep existing behavior
        if (isDailyRoutine) {
          return true;
        }

        // For non-daily tasks:
        // only show tasks that existed on
        // or before the selected date.
        if (
          assignment.created_at &&
          assignment.created_at > endOfDay
        ) {
          return false;
        }

        return true;
      }
    );

    // const todayCompletedMap = new Map();
    // const allCompletedMap = new Map();

    // completedToday.forEach((row) => {

    //   // latest completion for task
    //   allCompletedMap.set(row.task_id, row);

    //   // completion done today
    //   if (
    //     row.actual_time_done >= startOfDay &&
    //     row.actual_time_done <= endOfDay
    //   ) {
    //     todayCompletedMap.set(row.task_id, row);
    //   }
    // });

    const todayCompletedMap = new Map();
    const allCompletedMap = new Map();

    completedToday.forEach((row) => {
      if (row.task_id == null || !row.actual_time_done) {
        return;
      }

      // Rows are ordered newest first, so retain the first completion.
      if (!allCompletedMap.has(row.task_id)) {
        allCompletedMap.set(row.task_id, row);
      }

      // Daily routines must be completed on the selected IST date.
      if (
        row.actual_time_done >= startOfDay &&
        row.actual_time_done < nextDayStart &&
        !todayCompletedMap.has(row.task_id)
      ) {
        todayCompletedMap.set(row.task_id, row);
      }
    });

    const result = filteredAssignments.map((assignment) => {

      const isDailyRoutine =
        assignment.care_tasks?.task_category ===
        "Daily_Routine";

      const completedRow = isDailyRoutine
        ? todayCompletedMap.get(assignment.task_id)
        : allCompletedMap.get(assignment.task_id);

      return {
        assignment_id: assignment.assignment_id,
        date: selectedDate,
        task_id: assignment.task_id,

        status: completedRow
          ? completedRow.status
          : "pending",

        time_done: completedRow
          ? completedRow.actual_time_done
          : null,

        flag_level: completedRow
          ? completedRow.flag_level
          : "green",

        observation: completedRow
          ? completedRow.observation
          : null,

        photo_evidence: completedRow
          ? completedRow.photo_evidence
          : null,

        task: assignment.care_tasks,

        patient: assignment.patients?.users
          ? {
            name:
              assignment.patients.users.full_name,
          }
          : null,
      };
    });

    return res.status(200).json({
      success: true,

      caregiver: activeCaregiverShift?.users
        ? {
          name:
            activeCaregiverShift.users.full_name,

          phone:
            activeCaregiverShift.users.phone_number,

          shift:
            activeCaregiverShift.shifts?.shift_name,
        }
        : null,

      data: result,
    });

  } catch (err) {

    console.error(
      "Get Patient Tasks Error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};






// export const createPatientTask = async (req, res) => {
//   try {

//     const { patient_id, description, scheduled_time, task_category } = req.body;

//     if (!patient_id || !description) {
//       return res.status(400).json({
//         success: false,
//         message: "patient_id and description are required",
//       });
//     }

//     const patient = await prisma.patients.findUnique({
//       where: {
//         patient_id: Number(patient_id),
//       },
//     });

//     if (!patient) {
//       return res.status(404).json({
//         success: false,
//         message: "Patient not found",
//       });
//     }
//     const activeShift = await prisma.caregiver_shifts.findFirst({
//       where: {
//         patient_id: Number(patient_id),

//         // active shift
//         end_time: null,

//         verified: true,
//       },

//       orderBy: {
//         start_time: "desc",
//       },
//     });

//     // ✅ no caregiver assigned
//     if (!activeShift) {
//       return res.status(404).json({
//         success: false,
//         message: "No active caregiver shift found for this patient",
//       });
//     }

//     const caregiver_id = activeShift.caregiver_id;
//     const shift_id = activeShift.shift_id;


//     // 1️⃣ Create task
//     const newTask = await prisma.care_tasks.create({
//       data: {
//         description,
//         task_category: task_category || "Daily_Routine",
//         scheduled_time: scheduled_time || null,
//       },
//     });


//     req.body = {
//       task_id: newTask.task_id,
//       patient_id: Number(patient_id),
//       caregiver_id: caregiver_id,
//       shift_id: shift_id,
//       status: "pending",
//     };

//     // call existing controller (this will also emit socket)
//     return await assignTaskToCaregiver(req, res);

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };





export const createPatientTask = async (req, res) => {
  try {

    const {
      patient_id,
      description,
      scheduled_time,
      task_category,
    } = req.body;

    // ✅ Validation
    if (!patient_id || !description) {
      return res.status(400).json({
        success: false,
        message: "patient_id and description are required",
      });
    }

    const numericPatientId = Number(patient_id);
    const now = new Date();


    const today = getTodayDateOnly();
    // const tomorrow = new Date(today);
    // tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // ✅ Parallel queries (FASTER)
    const [patient, activeShift] = await Promise.all([

      prisma.patients.findUnique({
        where: {
          patient_id: numericPatientId,
        },

        select: {
          patient_id: true,
        },
      }),

      prisma.caregiver_shifts.findFirst({
        where: {
          patient_id: numericPatientId,
          // end_time: null,
          verified: true,
          // ✅ FIX: timezone-safe date range
          assignment_date: today,

          // ✅ Keep the OLD behavior:
          // shift must already have started
          start_time: {
            lte: now,
          },
          OR: [
            {
              end_time: null,
            },
            {
              end_time: {
                gte: now,
              },
            },
          ],
        },

        orderBy: {
          start_time: "desc",
        },

        select: {
          caregiver_id: true,
          shift_id: true,
        },
      }),
    ]);

    // ✅ Patient not found
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // ✅ No active caregiver
    if (!activeShift) {
      return res.status(404).json({
        success: false,
        message: "No active caregiver shift found for this patient",
      });
    }

    // ✅ SINGLE TRANSACTION (FAST)
    const result = await prisma.$transaction(async (tx) => {

      // 1️⃣ Create care task
      const newTask = await tx.care_tasks.create({
        data: {
          description,
          task_category: task_category || "Daily_Routine",
          scheduled_time: scheduled_time || null,
        },

        select: {
          task_id: true,
          description: true,
          task_category: true,
          scheduled_time: true,
        },
      });

      // 2️⃣ Create assignment
      const newAssignment = await tx.task_assignments.create({
        data: {
          task_id: newTask.task_id,
          patient_id: numericPatientId,
          caregiver_id: activeShift.caregiver_id,
          shift_id: activeShift.shift_id,
          status: "pending",
        },

        select: {
          assignment_id: true,
          task_id: true,
          patient_id: true,
          caregiver_id: true,
          shift_id: true,
          status: true,
          time_done: true,
          observation: true,
          photo_evidence: true,
          flag_level: true,
        },
      });

      // ✅ SAME RESPONSE STRUCTURE AS BEFORE
      return {
        ...newAssignment,

        care_tasks: newTask,
      };
    });

    // ✅ SOCKET PAYLOAD
    const socketPayload = {
      assignment_id: result.assignment_id,
      caregiver_id: result.caregiver_id,
      status: result.status,
      time_done: result.time_done || new Date(),
      observation: result.observation,
      photo_evidence: result.photo_evidence,
      flag_level: result.flag_level,

      task: result.care_tasks,
    };

    // ✅ SOCKET EMIT
    io.to(`caregiver_${activeShift.caregiver_id}`).emit(
      "task_assigned",
      socketPayload
    );

    // ✅ SAME API RESPONSE
    return res.status(201).json({
      success: true,
      message: "Task assigned successfully",
      data: result,
    });

  } catch (error) {

    console.error("Create Patient Task Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};