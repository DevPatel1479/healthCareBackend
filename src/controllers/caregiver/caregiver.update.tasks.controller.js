import prisma from "../../lib/prisma.js";
import { io } from "../../server.js"; // 🔥 IMPORT SOCKET


const VALID_STATUSES = new Set([
  "completed",
  "skipped",
  "refused",
  "pending",
]);

export const updateTaskStatus = async (req, res) => {
  try {
    const {
      assignment_id,
      caregiver_id,
      status,
      observation,
      photo_evidence,
    } = req.body;

    // 🔹 Validation
    if (!assignment_id || !caregiver_id || !status) {
      return res.status(400).json({
        success: false,
        message: "assignment_id, caregiver_id and status are required",
      });
    }

    // 🔹 Validate status enum
    // const validStatuses = ["completed", "skipped", "refused", "pending"];
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    // 🔹 Check ownership
    // const existingTask = await prisma.task_assignments.findFirst({
    //   where: {
    //     assignment_id,
    //     caregiver_id,
    //   },
    //   include: {
    //     care_tasks: true, // include for emit payload
    //   },
    // });

    const existingTask = await prisma.task_assignments.findFirst({
      where: {
        assignment_id,
        caregiver_id,
      },
      select: {
        assignment_id: true,
        patient_id: true,
        task_id: true,
        shift_id: true,
        caregiver_id: true,
        flag_level: true,
      },
    });


    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found or not assigned to this caregiver",
      });
    }
    // const nowIST = new Date(
    //   new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    // );

    const nowIST = new Date(Date.now() + 19800000);

    // const updatedTask = await prisma.$transaction(async (tx) => {
    //   // 🔹 Update task
    //   const updatedTask = await tx.task_assignments.update({
    //     where: { assignment_id },
    //     data: {
    //       status,
    //       observation: observation ?? null,
    //       photo_evidence: photo_evidence ?? null,
    //       time_done: nowIST
    //     },
    //     include: {
    //       care_tasks: true, // 🔥 include for frontend
    //     },
    //   });
    //   if (
    //     status === "completed" ||
    //     status === "skipped" ||
    //     status === "refused"
    //   ) {

    //     await tx.completed_tasks.upsert({
    //       where: {
    //         assignment_id: updatedTask.assignment_id,
    //       },

    //       update: {
    //         status: status,
    //         actual_time_done: updatedTask.time_done,
    //         observation: updatedTask.observation,
    //         photo_evidence: updatedTask.photo_evidence,
    //         flag_level: updatedTask.flag_level,
    //       },

    //       create: {
    //         task_id: updatedTask.task_id,
    //         patient_id: updatedTask.patient_id,
    //         caregiver_id: updatedTask.caregiver_id,
    //         shift_id: updatedTask.shift_id,
    //         assignment_id: updatedTask.assignment_id,

    //         scheduled_time: null,

    //         actual_time_done: updatedTask.time_done,

    //         status: status,

    //         flag_level: updatedTask.flag_level,

    //         observation: updatedTask.observation,

    //         photo_evidence: updatedTask.photo_evidence,
    //       },

    //     });
    //   }
    //   return updatedTask;
    // });

    await prisma.$transaction(async (tx) => {

      await tx.task_assignments.update({
        where: { assignment_id },
        data: {
          status,
          observation: observation ?? null,
          photo_evidence: photo_evidence ?? null,
          time_done: nowIST,
        },
      });

      if (
        status === "completed" ||
        status === "skipped" ||
        status === "refused"
      ) {
        await tx.completed_tasks.upsert({
          where: {
            assignment_id,
          },

          update: {
            status,
            actual_time_done: nowIST,
            observation: observation ?? null,
            photo_evidence: photo_evidence ?? null,
            flag_level: existingTask.flag_level,
          },

          create: {
            task_id: existingTask.task_id,
            patient_id: existingTask.patient_id,
            caregiver_id: existingTask.caregiver_id,
            shift_id: existingTask.shift_id,
            assignment_id,

            scheduled_time: null,
            actual_time_done: nowIST,

            status,

            flag_level: existingTask.flag_level,

            observation: observation ?? null,
            photo_evidence: photo_evidence ?? null,
          },
        });
      }
    });

    const updatedTask = await prisma.task_assignments.findUnique({
      where: {
        assignment_id,
      },
      include: {
        care_tasks: true,
      },
    });

    const socketPayload = {
      assignment_id: updatedTask.assignment_id,
      status: updatedTask.status,
      time_done: updatedTask.time_done,
      observation: updatedTask.observation,
      photo_evidence: updatedTask.photo_evidence,
      flag_level: updatedTask.flag_level,
      task: updatedTask.care_tasks,
    };

    // 🔥 IMPORTANT: Emit ONLY AFTER SUCCESS
    io.to(`caregiver_${caregiver_id}`).emit("task_updated",
      // assignment_id: updatedTask.assignment_id,
      // status: updatedTask.status,
      // time_done: updatedTask.time_done,
      // observation: updatedTask.observation,
      // photo_evidence: updatedTask.photo_evidence,
      // flag_level: updatedTask.flag_level,
      // task: updatedTask.care_tasks,
      socketPayload
    );
    io.to(`patient_${existingTask.patient_id}`).emit("task_updated",
      // {
      //   assignment_id: updatedTask.assignment_id,
      //   status: updatedTask.status,
      //   time_done: updatedTask.time_done,
      //   observation: updatedTask.observation,
      //   photo_evidence: updatedTask.photo_evidence,
      //   flag_level: updatedTask.flag_level,
      //   task: updatedTask.care_tasks,
      // }
      socketPayload
    );
    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: updatedTask,
    });

  } catch (error) {
    console.error("Update Task Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};