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

    // ✅ GET ACTIVE PATIENT ASSIGNED TO CAREGIVER
    const activeShift = await prisma.caregiver_shifts.findFirst({
      where: {
        caregiver_id: caregiverId,
        verified: true,
        end_time: null,
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

    // ✅ GET TASKS
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

    // ✅ SINGLE PATIENT INFO FROM caregiver_shifts
    const patientInfo = activeShift?.patients
      ? {
        id: activeShift.patients.users.user_id,
        name: activeShift.patients.users.full_name,
        phone: activeShift.patients.users.phone_number,
        patient_id: activeShift.patients.patient_id,
        category: activeShift.patients.category,
        shift: activeShift.shifts?.shift_name || null,
      }
      : null;

    const result = assignments.map((a) => ({
      assignment_id: a.assignment_id,
      status: a.status,
      time_done: a.time_done,
      flag_level: a.flag_level,
      observation: a.observation,

      task: a.care_tasks,

      caregiver: a.users
        ? {
          id: a.users.user_id,
          name: a.users.full_name,
          phone: a.users.phone_number,
        }
        : null,

      // ✅ SAME ASSIGNED PATIENT FOR THIS CAREGIVER
      patient: patientInfo,
    }));

    return res.json({
      success: true,
      patient: patientInfo, // ✅ separate patient object
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