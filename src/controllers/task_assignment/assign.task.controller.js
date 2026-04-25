
import prisma from "../../lib/prisma.js";
import { io } from "../../server.js";

export const assignTaskToCaregiver = async (req, res) => {
  try {
    const {
      task_id,
      patient_id,
      caregiver_id,
      shift_id,
      status = "pending",
    } = req.body;

    // 🔹 validation
    if (!task_id || !patient_id || !caregiver_id) {
      return res.status(400).json({
        success: false,
        message: "task_id, patient_id, caregiver_id required",
      });
    }

    // 🔹 create assignment
    const newAssignment = await prisma.task_assignments.create({
      data: {
        task_id,
        patient_id,
        caregiver_id,
        shift_id: shift_id || null,
        status,
      },
      include: {
        care_tasks: true,
      },
    });

    // 🔥 SOCKET EMIT (IMPORTANT)
    io.to(`caregiver_${caregiver_id}`).emit("task_assigned", {
        assignment_id: newAssignment.assignment_id,
        caregiver_id: newAssignment.caregiver_id, // 🔥 FIXED
        status: newAssignment.status,
        time_done: newAssignment.time_done || new Date(),
        observation: newAssignment.observation,
        flag_level: newAssignment.flag_level,
        task: newAssignment.care_tasks,
    });

    return res.status(201).json({
      success: true,
      message: "Task assigned successfully",
      data: newAssignment,
    });

  } catch (error) {
    console.error("Assign Task Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};