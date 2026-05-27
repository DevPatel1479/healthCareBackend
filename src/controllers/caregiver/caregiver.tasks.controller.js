import prisma from "../../lib/prisma.js";

export const getCaregiverTasks = async (req, res) => {

  try {
    const caregiverId = Number(req.params.id);

    if (!caregiverId || isNaN(caregiverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid caregiver id",
      });
    }

    // =========================
    // TASKS
    // =========================

    const assignments = await prisma.task_assignments.findMany({
      where: {
        caregiver_id: caregiverId,
      },

      include: {
        care_tasks: true,
      },

      orderBy: {
        assignment_id: "desc",
      },
    });

    // =========================
    // CAREGIVER INFO
    // =========================

    const caregiverInfo = await prisma.users.findUnique({
      where: {
        user_id: caregiverId,
      },

      select: {
        user_id: true,
        full_name: true,
        phone_number: true,
      },
    });

    // =========================
    // ASSIGNED PATIENTS
    // =========================

    const assignedPatients = await prisma.caregiver_shifts.findMany({
      where: {
        caregiver_id: caregiverId,
        verified: true,
        end_time: null,
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

    // =========================
    // TASK RESULT
    // =========================

    const tasks = assignments.map((a) => ({
      assignment_id: a.assignment_id,
      patient_id: a.patient_id,
      shift_id: a.shift_id,

      status: a.status,
      time_done: a.time_done,
      flag_level: a.flag_level,
      observation: a.observation,

      task: a.care_tasks,
    }));

    // =========================
    // PATIENT RESULT
    // =========================

    const patients = assignedPatients.map((p) => ({
      patient_id: p.patients.patient_id,

      name: p.patients.users.full_name,

      phone: p.patients.users.phone_number,

      category: p.patients.category,

      shift: p.shifts?.shift_name,

      shift_start: p.start_time,
    }));

    return res.json({
      success: true,

      caregiver: caregiverInfo
        ? {
          id: caregiverInfo.user_id,
          name: caregiverInfo.full_name,
          phone: caregiverInfo.phone_number,
        }
        : null,

      patients,

      data: tasks,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};