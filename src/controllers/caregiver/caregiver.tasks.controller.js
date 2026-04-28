import prisma from "../../lib/prisma.js";

export const getCaregiverTasks = async (req, res) => {
  try {
    const caregiverId = 4; // fixed as you asked

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
      },
      orderBy: {
        assignment_id: "desc",
      },
    });

    const result = assignments.map((a) => ({
      assignment_id: a.assignment_id,
      status: a.status,
      time_done: a.time_done,
      flag_level: a.flag_level,
      observation: a.observation,
      task: a.care_tasks, // 👈 full task details
      caregiver: a.users
        ? {
          id: a.users.user_id,
          name: a.users.full_name,
          phone: a.users.phone_number,
        }
        : null,
      patient: a.patients
        ? {
          id: a.patients.users.user_id,
          name: a.patients.users.full_name,
          phone: a.patients.users.phone_number,
          patient_id: a.patients.patient_id,
          category: a.patients.category,
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