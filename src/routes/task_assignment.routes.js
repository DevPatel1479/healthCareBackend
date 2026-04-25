
import express from 'express'



const router = express.Router();

import { assignTaskToCaregiver } from "../controllers/task_assignment/assign.task.controller.js";

router.post("/tasks/assign", assignTaskToCaregiver);

export default router;