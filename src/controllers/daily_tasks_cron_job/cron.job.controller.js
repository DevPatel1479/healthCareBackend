import prisma from "../../lib/prisma.js";

export const generateDailyTasks = async (req, res) => {
    try {

        // =====================================================
        // 1. MOVE completed/skipped/refused daily tasks
        //    INTO completed_tasks (HISTORY TABLE)
        // =====================================================

        await prisma.$executeRaw`

            INSERT INTO completed_tasks (
                task_id,
                patient_id,
                caregiver_id,
                shift_id,
                assignment_id,
                scheduled_time,
                actual_time_done,
                status,
                flag_level,
                observation,
                photo_evidence
            )

            SELECT
                ta.task_id,
                ta.patient_id,
                ta.caregiver_id,
                ta.shift_id,
                ta.assignment_id,
                NULL,
                ta.time_done,
                ta.status,
                ta.flag_level,
                ta.observation,
                ta.photo_evidence

            FROM task_assignments ta

            JOIN care_tasks ct
              ON ta.task_id = ct.task_id

            WHERE ct.task_category = 'Daily/Routine'
              AND ta.status IN ('completed', 'skipped', 'refused')
        `;

        // =====================================================
        // 2. DELETE ALL OLD DAILY/Routine assignments
        // =====================================================

        await prisma.$executeRaw`

            DELETE ta

            FROM task_assignments ta

            JOIN care_tasks ct
              ON ta.task_id = ct.task_id

            WHERE ct.task_category = 'Daily/Routine'
        `;

        // =====================================================
        // 3. REGENERATE FRESH DAILY TASKS
        // =====================================================

        await prisma.$executeRaw`

            INSERT INTO task_assignments (
                task_id,
                patient_id,
                caregiver_id,
                shift_id,
                status,
                time_done,
                flag_level,
                observation,
                photo_evidence,
                supervisor_val
            )

            SELECT
                ct.task_id,
                cs.patient_id,
                cs.caregiver_id,
                cs.shift_id,
                'pending',
                NULL,
                'green',
                NULL,
                NULL,
                0

            FROM care_tasks ct

            JOIN caregiver_shifts cs

            WHERE ct.task_category = 'Daily/Routine'
        `;

        return res.status(200).json({
            success: true,
            message: "Daily tasks regenerated successfully"
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            error: "Failed to regenerate daily tasks"
        });
    }
};