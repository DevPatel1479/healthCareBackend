import prisma from "../../lib/prisma.js";

// export const getCaregiverTasks = async (req, res) => {
//   try {
//     const caregiverId = Number(req.params.id);

//     if (!caregiverId || isNaN(caregiverId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid caregiver id",
//       });
//     }

//     const now = new Date();

//     // ==============================
//     // 1. GET ACTIVE SHIFT (SOURCE OF TRUTH)
//     // ==============================
//     const activeShift = await prisma.caregiver_shifts.findFirst({
//       where: {
//         caregiver_id: caregiverId,
//         verified: true,
//         start_time: { lte: now },
//         OR: [
//           { end_time: null },
//           { end_time: { gte: now } },
//         ],
//       },
//       orderBy: {
//         start_time: "desc",
//       },
//       include: {
//         patients: {
//           include: {
//             users: {
//               select: {
//                 user_id: true,
//                 full_name: true,
//                 phone_number: true,
//               },
//             },
//           },
//         },
//         shifts: true,
//       },
//     });

//     // ==============================
//     // 2. FALLBACK SHIFT (if no active shift exists)
//     // ==============================
//     let fallbackShift = null;

//     if (!activeShift) {
//       fallbackShift = await prisma.caregiver_shifts.findFirst({
//         where: {
//           caregiver_id: caregiverId,
//           verified: true,
//         },
//         orderBy: {
//           start_time: "desc",
//         },
//         include: {
//           patients: {
//             include: {
//               users: {
//                 select: {
//                   user_id: true,
//                   full_name: true,
//                   phone_number: true,
//                 },
//               },
//             },
//           },
//           shifts: true,
//         },
//       });
//     }

//     const shiftToUse = activeShift || fallbackShift;

//     // ==============================
//     // 3. BUILD CURRENT PATIENT
//     // ==============================
//     const patientInfo = shiftToUse?.patients
//       ? {
//         id: shiftToUse.patients.users.user_id,
//         name: shiftToUse.patients.users.full_name,
//         phone: shiftToUse.patients.users.phone_number,
//         patient_id: shiftToUse.patients.patient_id,
//         category: shiftToUse.patients.category,
//         shift: shiftToUse.shifts?.shift_name || null,
//       }
//       : null;

//     // ==============================
//     // 4. GET TASKS
//     // ==============================
//     const assignments = await prisma.task_assignments.findMany({
//       where: {
//         caregiver_id: caregiverId,
//       },
//       include: {
//         care_tasks: true,
//         users: {
//           select: {
//             user_id: true,
//             full_name: true,
//             phone_number: true,
//           },
//         },
//       },
//       orderBy: {
//         assignment_id: "desc",
//       },
//     });

//     // ==============================
//     // 5. MAP RESPONSE
//     // ==============================
//     const result = assignments.map((a) => ({
//       assignment_id: a.assignment_id,
//       status: a.status,
//       time_done: a.time_done,
//       flag_level: a.flag_level,
//       observation: a.observation,

//       task: a.care_tasks,

//       caregiver: a.users
//         ? {
//           id: a.users.user_id,
//           name: a.users.full_name,
//           phone: a.users.phone_number,
//         }
//         : null,

//       // SAME CURRENT PATIENT FOR ALL TASKS
//       patient: patientInfo,
//     }));

//     // ==============================
//     // 6. RESPONSE
//     // ==============================
//     return res.json({
//       success: true,
//       patient: patientInfo,
//       data: result,
//     });

//   } catch (err) {
//     console.error(err);

//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };


const getTodayDateOnly = () => {
  const d = new Date();

  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );
};

/**
 * Get date boundaries.
 *
 * No date:
 *   Uses today's IST date.
 *
 * Date provided:
 *   Expects YYYY-MM-DD.
 */
const getDateBoundaries = (dateString) => {
  // =========================================
  // NO DATE
  // Preserve existing TODAY behavior
  // =========================================
  if (!dateString) {
    const nowIST = new Date(
      new Date().toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
      })
    );

    const startOfDay = new Date(nowIST);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nowIST);
    endOfDay.setHours(23, 59, 59, 999);

    return {
      startOfDay,
      endOfDay,

      // Preserve original caregiver controller behavior
      assignmentDate: getTodayDateOnly(),

      selectedDate: new Date().toLocaleDateString(
        "en-CA",
        {
          timeZone: "Asia/Kolkata",
        }
      ),
    };
  }

  // =========================================
  // DATE PROVIDED
  // =========================================
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    dateString
  );

  if (!match) {
    throw new Error(
      "Invalid date format. Use YYYY-MM-DD"
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // =========================================
  // VALIDATE DATE
  // =========================================
  const validationDate = new Date(
    year,
    month - 1,
    day
  );

  if (
    validationDate.getFullYear() !== year ||
    validationDate.getMonth() !== month - 1 ||
    validationDate.getDate() !== day
  ) {
    throw new Error("Invalid date");
  }

  // =========================================
  // SELECTED DATE RANGE
  // =========================================
  const startOfDay = new Date(
    year,
    month - 1,
    day
  );

  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(
    year,
    month - 1,
    day
  );

  endOfDay.setHours(23, 59, 59, 999);

  const assignmentDate = new Date(
    year,
    month - 1,
    day
  );

  return {
    startOfDay,
    endOfDay,
    assignmentDate,
    selectedDate: dateString,
  };
};


export const getCaregiverTasks = async (req, res) => {
  try {
    const caregiverId = Number(req.params.id);

    if (!caregiverId || isNaN(caregiverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid caregiver id",
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
      endOfDay,
      assignmentDate,
      selectedDate,
    } = dateInfo;
    // =========================================
    // IS SELECTED DATE TODAY?
    // =========================================

    const todayIST = new Date().toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Kolkata",
      }
    );

    const isToday = selectedDate === todayIST;

    const now = new Date();
    // const now = new Date();
    // const today = new Date();
    // today.setHours(0, 0, 0, 0);
    // ==================================
    // TODAY RANGE
    // ==================================
    // const startOfDay = new Date(now);
    // startOfDay.setHours(0, 0, 0, 0);

    // const endOfDay = new Date(now);
    // endOfDay.setHours(23, 59, 59, 999);

    // ==================================
    // ACTIVE SHIFT
    // ==================================

    // =========================================
    // ACTIVE SHIFT
    // =========================================

    let activeShift = null;
    /*
        * IMPORTANT:
        *
        * For TODAY:
        * preserve existing behavior:
        *
        * start_time <= now
        *
        * AND
        *
        * end_time >= now OR end_time is null
        *
        * For HISTORICAL DATE:
        * do NOT apply the current-time conditions.
        *
        * We only need the verified shift assigned
        * to that historical date.
        */
    if (isToday) {
      activeShift = await prisma.caregiver_shifts.findFirst({
        where: {
          caregiver_id: caregiverId,
          verified: true,
          assignment_date: assignmentDate,
          start_time: { lte: now },
          OR: [
            { end_time: null },
            { end_time: { gte: now } },
          ],
        },
        orderBy: {
          start_time: "desc",
        },
        include: {
          patients: {
            include: {
              users: {
                select: {
                  user_id: true,
                  full_name: true,
                  phone_number: true,
                },
              },
            },
          },
          shifts: true,
        },
      });

    }


    // ==================================
    // FALLBACK SHIFT
    // ==================================
    let fallbackShift = null;
    /*
        * TODAY:
        * If no active shift was found,
        * preserve existing fallback behavior.
        *
        * HISTORICAL:
        * Directly find the shift for that date.
        */
    if (!activeShift) {
      fallbackShift = await prisma.caregiver_shifts.findFirst({
        where: {
          caregiver_id: caregiverId,
          verified: true,
          assignment_date: assignmentDate,
        },
        orderBy: {
          start_time: "desc",
        },
        include: {
          patients: {
            include: {
              users: {
                select: {
                  user_id: true,
                  full_name: true,
                  phone_number: true,
                },
              },
            },
          },
          shifts: true,
        },
      });
    }

    const shiftToUse = activeShift || fallbackShift;

    const patientInfo = shiftToUse?.patients
      ? {
        id: shiftToUse.patients.users.user_id,
        name: shiftToUse.patients.users.full_name,
        phone: shiftToUse.patients.users.phone_number,
        patient_id: shiftToUse.patients.patient_id,
        category: shiftToUse.patients.category,
        shift: shiftToUse.shifts?.shift_name || null,
      }
      : null;

    if (!shiftToUse?.patients?.patient_id) {
      return res.status(404).json({
        success: false,
        message: "No patient assigned to caregiver",
      });
    }
    // ==================================
    // GET MASTER TASKS
    // ==================================

    const assignments = await prisma.task_assignments.findMany({
      where: {
        patient_id: patientInfo?.patient_id,
      },
      include: {
        care_tasks: true,
        users: {
          select: {
            user_id: true,
            full_name: true,
            phone_number: true,
          },
        },
      },
      orderBy: {
        assignment_id: "desc",
      },
    });

    if (!shiftToUse?.patients?.patient_id) {
      return res.status(404).json({
        success: false,
        message: "No patient assigned to caregiver",
      });
    }
    const filteredAssignments =
      assignments.filter((assignment) => {
        const isDailyRoutine =
          assignment.care_tasks?.task_category ===
          "Daily_Routine";

        // -----------------------------------------
        // Daily routines:
        // Preserve existing behavior
        // -----------------------------------------
        if (isDailyRoutine) {
          return true;
        }

        // -----------------------------------------
        // Non-daily tasks:
        // Don't show tasks that didn't exist yet
        // on the selected date.
        // -----------------------------------------

        if (
          assignment.created_at &&
          assignment.created_at > endOfDay
        ) {
          return false;
        }

        return true;
      });


    // ==================================
    // GET TODAY COMPLETIONS
    // ==================================
    const completedToday = await prisma.completed_tasks.findMany({
      where: {
        patient_id: patientInfo?.patient_id,
        actual_time_done: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    // ==================================
    // FAST LOOKUP MAP
    // task_id -> completed row
    // ==================================


    const completedAll = await prisma.completed_tasks.findMany({
      where: {
        patient_id: patientInfo?.patient_id,
      },
      orderBy: {
        actual_time_done: "desc",
      },
    });
    const dailyMap = new Map();
    const allMap = new Map();


    // today's completion map
    completedToday.forEach((task) => {
      if (task.assignment_id) {
        dailyMap.set(task.assignment_id, task);
      }
    });

    // latest completion map
    completedAll.forEach((task) => {
      if (
        task.assignment_id &&
        !allMap.has(task.assignment_id)
      ) {
        allMap.set(task.assignment_id, task);
      }
    });


    // ==================================
    // BUILD RESPONSE
    // ==================================
    const result = filteredAssignments.map((a) => {
      const isDaily =
        a.care_tasks?.task_category === "Daily_Routine";
      const completedRecord = isDaily
        ? dailyMap.get(a.assignment_id)
        : allMap.get(a.assignment_id);



      return {
        assignment_id: a.assignment_id,

        date: selectedDate,

        // TODAY'S STATUS
        status: completedRecord
          ? completedRecord.status
          : "pending",

        time_done: completedRecord
          ? completedRecord.actual_time_done
          : null,

        flag_level: completedRecord
          ? completedRecord.flag_level
          : a.flag_level,

        observation: completedRecord
          ? completedRecord.observation
          : null,

        photo_evidence: completedRecord
          ? completedRecord.photo_evidence
          : null,

        task: a.care_tasks,

        caregiver: a.users
          ? {
            id: a.users.user_id,
            name: a.users.full_name,
            phone: a.users.phone_number,
          }
          : null,

        patient: patientInfo,
      };
    });

    return res.json({
      success: true,
      patient: patientInfo,
      data: result,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};