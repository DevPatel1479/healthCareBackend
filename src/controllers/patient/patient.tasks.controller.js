

import prisma from "../../lib/prisma.js";

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

    const { patient_id, description, scheduled_time, task_category } = req.body;

    if (!patient_id || !description) {
      return res.status(400).json({
        success: false,
        message: "patient_id and description are required",
      });
    }

    const patient = await prisma.patients.findUnique({
      where: {
        patient_id: Number(patient_id),
      },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }
    const activeShift = await prisma.caregiver_shifts.findFirst({
      where: {
        patient_id: Number(patient_id),

        // active shift
        end_time: null,

        verified: true,
      },

      orderBy: {
        start_time: "desc",
      },
    });

    // ✅ no caregiver assigned
    if (!activeShift) {
      return res.status(404).json({
        success: false,
        message: "No active caregiver shift found for this patient",
      });
    }

    const caregiver_id = activeShift.caregiver_id;
    const shift_id = activeShift.shift_id;


    // 1️⃣ Create task
    const newTask = await prisma.care_tasks.create({
      data: {
        description,
        task_category: task_category || "Daily_Routine",
        scheduled_time: scheduled_time || null,
      },
    });


    req.body = {
      task_id: newTask.task_id,
      patient_id: Number(patient_id),
      caregiver_id: caregiver_id,
      shift_id: shift_id,
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