

import prisma from "../../lib/prisma.js";
import { io } from "../../server.js";
import { assignTaskToCaregiver } from "../task_assignment/assign.task.controller.js";

export const getPatientTasks = async (req, res) => {
  try {
    const patientId = parseInt(req.params.id); // ✅ dynamic

    const assignments = await prisma.task_assignments.findMany({
      where: {
        patient_id: patientId,
      },
      include: {
        care_tasks: true,
        users: {
          select: {
            full_name: true,
            phone_number: true,
          },
        },
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

    });
    const activeCaregiverShift =
      await prisma.caregiver_shifts.findFirst({

        where: {
          patient_id: patientId,
          verified: true,
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
      });

    const result = assignments.map((a) => ({
      assignment_id: a.assignment_id,
      status: a.status,
      time_done: a.time_done,
      flag_level: a.flag_level,
      observation: a.observation,

      task: a.care_tasks,

      patient: a.patients?.users
        ? {
          name: a.patients.users.full_name,
        }
        : null,
    }));

    return res.json({
      success: true,

      caregiver: activeCaregiverShift?.users
        ? {
          name: activeCaregiverShift.users.full_name,
          phone: activeCaregiverShift.users.phone_number,
          shift: activeCaregiverShift.shifts?.shift_name,
        }
        : null,

      data: result,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
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
          end_time: null,
          verified: true,
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