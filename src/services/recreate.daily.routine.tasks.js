import prisma from "../lib/prisma.js";



// export async function recreateDailyRoutineTasks(io = null) {

//     // today start
//     const todayStart = new Date();
//     todayStart.setHours(0, 0, 0, 0);

//     // tomorrow start
//     const tomorrowStart = new Date(todayStart);
//     tomorrowStart.setDate(tomorrowStart.getDate() + 1);

//     // yesterday start
//     const yesterdayStart = new Date(todayStart);
//     yesterdayStart.setDate(yesterdayStart.getDate() - 1);

//     // yesterday tasks
//     const yesterdayTasks = await prisma.task_assignments.findMany({
//         where: {
//             created_at: {
//                 gte: yesterdayStart,
//                 lt: todayStart
//             },

//             care_tasks: {
//                 task_category: "Daily_Routine"
//             }
//         },
//         select: {
//             patient_id: true,
//             task_id: true,
//             caregiver_id: true,
//             shift_id: true
//         }
//     });

//     // today tasks
//     const todayTasks = await prisma.task_assignments.findMany({
//         where: {
//             created_at: {
//                 gte: todayStart,
//                 lt: tomorrowStart
//             }
//         },
//         select: {
//             patient_id: true,
//             task_id: true
//         }
//     });

//     const todaySet = new Set(
//         todayTasks.map(
//             item => `${item.patient_id}-${item.task_id}`
//         )
//     );

//     const insertData = [];

//     for (const task of yesterdayTasks) {

//         const key = `${task.patient_id}-${task.task_id}`;

//         // already recreated today
//         if (!todaySet.has(key)) {

//             insertData.push({
//                 patient_id: task.patient_id,
//                 task_id: task.task_id,
//                 caregiver_id: task.caregiver_id,
//                 shift_id: task.shift_id,

//                 status: "pending",

//                 time_done: null,
//                 observation: null,
//                 photo_evidence: null,
//                 supervisor_val: false,
//                 flag_level: "green"
//             });

//         }
//     }

//     if (insertData.length > 0) {

//         await prisma.task_assignments.createMany({
//             data: insertData
//         });

//         console.log(
//             `${insertData.length} daily routine tasks recreated`
//         );

//         // realtime emit
//         if (io) {

//             for (const task of insertData) {

//                 io.to(`patient_${task.patient_id}`).emit(
//                     "daily_tasks_recreated",
//                     {
//                         patient_id: task.patient_id,
//                         task_id: task.task_id,
//                         status: "pending"
//                     }
//                 );

//                 if (task.caregiver_id) {

//                     io.to(`caregiver_${task.caregiver_id}`).emit(
//                         "daily_tasks_recreated",
//                         {
//                             patient_id: task.patient_id,
//                             task_id: task.task_id,
//                             status: "pending"
//                         }
//                     );

//                 }
//             }
//         }

//         return {
//             success: true,
//             count: insertData.length
//         };

//     }

//     return {
//         success: true,
//         count: 0,
//         message: "Already recreated"
//     };
// }




// testing ******************


export async function recreateDailyRoutineTasks(io = null) {

    // current time
    const now = new Date();

    // current minute start
    const currentMinuteStart = new Date(now);
    currentMinuteStart.setSeconds(0, 0);

    // next minute start
    const nextMinuteStart = new Date(currentMinuteStart);
    nextMinuteStart.setMinutes(
        nextMinuteStart.getMinutes() + 1
    );

    // previous minute start
    const previousMinuteStart = new Date(currentMinuteStart);
    previousMinuteStart.setMinutes(
        previousMinuteStart.getMinutes() - 1
    );

    // previous minute tasks
    const previousMinuteTasks =
        await prisma.task_assignments.findMany({
            where: {
                created_at: {
                    gte: previousMinuteStart,
                    lt: currentMinuteStart
                },

                care_tasks: {
                    task_category: "Daily_Routine"
                }
            },

            select: {
                patient_id: true,
                task_id: true,
                caregiver_id: true,
                shift_id: true
            }
        });

    // current minute tasks
    const currentMinuteTasks =
        await prisma.task_assignments.findMany({
            where: {
                created_at: {
                    gte: currentMinuteStart,
                    lt: nextMinuteStart
                }
            },

            select: {
                patient_id: true,
                task_id: true
            }
        });

    const currentSet = new Set(
        currentMinuteTasks.map(
            item => `${item.patient_id}-${item.task_id}`
        )
    );

    const insertData = [];

    for (const task of previousMinuteTasks) {

        const key =
            `${task.patient_id}-${task.task_id}`;

        // prevent duplicate in same minute
        if (!currentSet.has(key)) {

            insertData.push({

                patient_id: task.patient_id,
                task_id: task.task_id,
                caregiver_id: task.caregiver_id,
                shift_id: task.shift_id,

                status: "pending",

                time_done: null,
                observation: null,
                photo_evidence: null,
                supervisor_val: false,
                flag_level: "green"
            });

        }
    }

    if (insertData.length > 0) {

        await prisma.task_assignments.createMany({
            data: insertData
        });

        console.log(
            `${insertData.length} tasks recreated for testing`
        );

        // realtime emit
        if (io) {

            for (const task of insertData) {

                io.to(
                    `patient_${task.patient_id}`
                ).emit(
                    "daily_tasks_recreated",
                    {
                        patient_id: task.patient_id,
                        task_id: task.task_id,
                        status: "pending"
                    }
                );

                if (task.caregiver_id) {

                    io.to(
                        `caregiver_${task.caregiver_id}`
                    ).emit(
                        "daily_tasks_recreated",
                        {
                            patient_id: task.patient_id,
                            task_id: task.task_id,
                            status: "pending"
                        }
                    );
                }
            }
        }

        return {
            success: true,
            count: insertData.length
        };
    }

    return {
        success: true,
        count: 0,
        message: "Already recreated this minute"
    };
}