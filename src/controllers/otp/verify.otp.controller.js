import { verifyOTP } from "../../services/otp.service.js";
// const jwt = require('jsonwebtoken'); // optional

export const verifyOTPController = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // Validation
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone and OTP are required',
      });
    }

    const result = verifyOTP(phone, otp);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.reason,
      });
    }

    // ✅ OPTIONAL: Generate JWT
    /*
    const token = jwt.sign(
      { phone },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    */

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      // token, // if using JWT
    });

  } catch (error) {
    console.error('Verify OTP Error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'OTP verification failed',
    });
  }
};

