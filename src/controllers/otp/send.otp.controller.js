import axios from "axios";
import { generateOTP, saveOTP } from "../../services/otp.service.js";


export const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    // Validation
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number',
      });
    }

    const otp = generateOTP();

    saveOTP(phone, otp);

    const message = encodeURIComponent(
      `Dear Member, Login using your mobile number and One Time Password ${otp}. Do Not disclose it to anyone - TFMLAB`
    );

    const smsUrl = `${process.env.SMS_BASE_URL}?APIkey=${process.env.SMS_API_KEY}&SenderID=${process.env.SMS_SENDER_ID}&SMSType=${process.env.SMS_TYPE}&Mobile=${phone}&MsgText=${message}&EntityID=${process.env.SMS_ENTITY_ID}&TemplateID=${process.env.SMS_TEMPLATE_ID}`;

    await axios.get(smsUrl, { timeout: 5000 });

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });

  } catch (error) {
    console.error('Send OTP Error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
    });
  }
};