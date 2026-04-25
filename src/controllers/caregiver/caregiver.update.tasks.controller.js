import prisma from "../../lib/prisma.js";
import { io } from "../../server.js"; // 🔥 IMPORT SOCKET

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
    const validStatuses = ["completed", "skipped", "refused", "pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    // 🔹 Check ownership
    const existingTask = await prisma.task_assignments.findFirst({
      where: {
        assignment_id,
        caregiver_id,
      },
      include: {
        care_tasks: true, // include for emit payload
      },
    });

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found or not assigned to this caregiver",
      });
    }
const nowIST = new Date(
  new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
);
    // 🔹 Update task
    const updatedTask = await prisma.task_assignments.update({
      where: { assignment_id },
      data: {
        status,
        observation: observation ?? null,
        photo_evidence: photo_evidence ?? null,
        time_done: nowIST
      },
      include: {
        care_tasks: true, // 🔥 include for frontend
      },
    });

    // 🔥 IMPORTANT: Emit ONLY AFTER SUCCESS
    io.to(`caregiver_${caregiver_id}`).emit("task_updated", {
      assignment_id: updatedTask.assignment_id,
      status: updatedTask.status,
      time_done: updatedTask.time_done,
      observation: updatedTask.observation,
      photo_evidence: updatedTask.photo_evidence,
      flag_level: updatedTask.flag_level,
      task: updatedTask.care_tasks,
    });
    io.to(`patient_${existingTask.patient_id}`).emit("task_updated", {
      assignment_id: updatedTask.assignment_id,
      status: updatedTask.status,
      time_done: updatedTask.time_done,
      observation: updatedTask.observation,
      photo_evidence: updatedTask.photo_evidence,
      flag_level: updatedTask.flag_level,
      task: updatedTask.care_tasks,
    });
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