

import prisma from "../../lib/prisma.js";

import { assignTaskToCaregiver } from "../task_assignment/assign.task.controller.js";

export const getPatientTasks = async (req, res) => {
  try {
    const patientId = parseInt(req.params.id); // ✅ dynamic

    const assignments = await prisma.task_assignments.findMany({
      where: {
        patient_id: patientId, // 🔥 filter by patient
      },
      include: {
        care_tasks: true,
        users: {
    select: {
      full_name: true,
      phone_number: true,
    },
  },
      },
    });

    const result = assignments.map((a) => ({
      assignment_id: a.assignment_id,
      status: a.status,
      time_done: a.time_done,
      flag_level: a.flag_level,
      observation: a.observation,
      task: a.care_tasks,
        caregiver: a.users
    ? {
        name: a.users.full_name,
        phone: a.users.phone_number,
      }
    : null,
    }));

    res.json({
      success: true,
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







export const createPatientTask = async (req, res) => {
  try {
    const { description, scheduled_time } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Task description is required",
      });
    }

    // 1️⃣ Create task
    const newTask = await prisma.care_tasks.create({
  data: {
    description,
    task_category: "Daily_Routine", // ✅ FIXED
    scheduled_time: scheduled_time || null,
  },
});

    // 2️⃣ Reuse assignment logic (🔥 THIS IS KEY)
    req.body = {
      task_id: newTask.task_id,
      patient_id: 5,
      caregiver_id: 4,
      shift_id: 23,
      status: "pending",
    };

    // call existing controller (this will also emit socket)
    return await assignTaskToCaregiver(req, res);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};