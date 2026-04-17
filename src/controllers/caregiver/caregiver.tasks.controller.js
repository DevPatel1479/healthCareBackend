import prisma from "../../lib/prisma";

export const getCaregiverTasks = async (req, res) => {
  try {
    const caregiverId = 4; // fixed as you asked

    const assignments = await prisma.task_assignments.findMany({
      where: {
        caregiver_id: caregiverId,
      },
      include: {
        care_tasks: true, // 👈 automatically fetch task details
      },
    });

    const result = assignments.map((a) => ({
      assignment_id: a.assignment_id,
      status: a.status,
      time_done: a.time_done,
      flag_level: a.flag_level,
      observation: a.observation,
      task: a.care_tasks, // 👈 full task details
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