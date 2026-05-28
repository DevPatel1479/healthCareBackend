import express from "express";
import { generateDailyTasks } from "../controllers/daily_tasks_cron_job/cron.job.controller";

const router = express.Router();

router.post("/run-daily-task-generation", generateDailyTasks);

export default router;

