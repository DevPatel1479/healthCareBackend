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



export const getCaregiverTasks = async (req, res) => {
  try {
    const caregiverId = Number(req.params.id);

    if (!caregiverId || isNaN(caregiverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid caregiver id",
      });
    }

    const now = new Date();

    // ==================================
    // TODAY RANGE
    // ==================================
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // ==================================
    // ACTIVE SHIFT
    // ==================================
    const activeShift = await prisma.caregiver_shifts.findFirst({
      where: {
        caregiver_id: caregiverId,
        verified: true,
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

    // ==================================
    // FALLBACK SHIFT
    // ==================================
    let fallbackShift = null;

    if (!activeShift) {
      fallbackShift = await prisma.caregiver_shifts.findFirst({
        where: {
          caregiver_id: caregiverId,
          verified: true,
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

    // ==================================
    // GET MASTER TASKS
    // ==================================
    const assignments = await prisma.task_assignments.findMany({
      where: {
        caregiver_id: caregiverId,
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
    // ==================================
    // GET TODAY COMPLETIONS
    // ==================================
    const completedToday = await prisma.completed_tasks.findMany({
      where: {
        caregiver_id: caregiverId,
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
        caregiver_id: caregiverId,
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
    const result = assignments.map((a) => {
      const isDaily =
        a.care_tasks?.task_category === "Daily_Routine";
      const completedRecord = isDaily
        ? dailyMap.get(a.assignment_id)
        : allMap.get(a.assignment_id);



      return {
        assignment_id: a.assignment_id,

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