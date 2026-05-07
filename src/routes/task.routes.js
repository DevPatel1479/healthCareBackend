
import express from 'express'
import { io } from "../server.js";
import { recreateDailyRoutineTasks } from '../services/recreate.daily.routine.tasks.js';


const router = express.Router()
router.post(
    "/recreate-daily-routine-tasks",
    async (req, res) => {

        try {

            const result =
                await recreateDailyRoutineTasks(io);

            return res.status(200).json({
                success: true,
                result
            });

        } catch (error) {

            console.error(error);

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }
    }
);


export default router