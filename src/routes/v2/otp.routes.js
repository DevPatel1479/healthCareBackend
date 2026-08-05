import express from 'express'



const router = express.Router();

import { sendOTP } from '../controllers/otp/send.otp.controller.js';
import { verifyOTPController } from '../controllers/otp/verify.otp.controller.js';


// Routes
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTPController);

export default router;