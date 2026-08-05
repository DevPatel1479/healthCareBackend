
import express from 'express'
import { loginController } from '../controllers/login/login.controller.js'

const router = express.Router()
router.post("/auth/login", loginController);



export default router