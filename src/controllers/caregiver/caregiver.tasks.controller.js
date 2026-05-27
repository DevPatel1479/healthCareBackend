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

    const now = new Date();

    // ==============================
    // 1. GET ACTIVE SHIFT (SOURCE OF TRUTH)
    // ==============================
    const activeShift = await prisma.caregiver_shifts.findFirst({
      where: {
        caregiver_id: caregiverId,
        verified: true,
        start_time: { lte: now },
        OR: [
          { end_time: null },
          { end_time: { gte: now } },
        ],
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

    // ==============================
    // 2. FALLBACK SHIFT (if no active shift exists)
    // ==============================
    let fallbackShift = null;

    if (!activeShift) {
      fallbackShift = await prisma.caregiver_shifts.findFirst({
        where: {
          caregiver_id: caregiverId,
          verified: true,
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
    }

    const shiftToUse = activeShift || fallbackShift;

    // ==============================
    // 3. BUILD CURRENT PATIENT
    // ==============================
    const patientInfo = shiftToUse?.patients
      ? {
        id: shiftToUse.patients.users.user_id,
        name: shiftToUse.patients.users.full_name,
        phone: shiftToUse.patients.users.phone_number,
        patient_id: shiftToUse.patients.patient_id,
        category: shiftToUse.patients.category,
        shift: shiftToUse.shifts?.shift_name || null,
      }
      : null;

    // ==============================
    // 4. GET TASKS
    // ==============================
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

    // ==============================
    // 5. MAP RESPONSE
    // ==============================
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

      // SAME CURRENT PATIENT FOR ALL TASKS
      patient: patientInfo,
    }));

    // ==============================
    // 6. RESPONSE
    // ==============================
    return res.json({
      success: true,
      patient: patientInfo,
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