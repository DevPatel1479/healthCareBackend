import axios from "axios";
import { generateOTP, saveOTP } from "../../services/otp.service.js";




export const sendOTP = async (req, res) => {
  try {
    const { phone, type } = req.body; // type = 'sms' | 'whatsapp'

    // Validation
    if (!phone || !type) {
      return res.status(400).json({
        success: false,
        message: 'Phone and type (sms/whatsapp) are required',
      });
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number',
      });
    }

    if (!['sms', 'whatsapp'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Use sms or whatsapp',
      });
    }

    const otp = generateOTP();

    await saveOTP(phone, otp);

    let apiUrl = '';

    // 📩 SMS FLOW
    if (type === 'sms') {
      const message = encodeURIComponent(
        `Dear Member, Login using your mobile number and One Time Password ${otp}. Do Not disclose it to anyone - TFMLAB`
      );

      apiUrl = `${process.env.SMS_BASE_URL}?APIkey=${process.env.SMS_API_KEY}&SenderID=${process.env.SMS_SENDER_ID}&SMSType=${process.env.SMS_TYPE}&Mobile=${phone}&MsgText=${message}&EntityID=${process.env.SMS_ENTITY_ID}&TemplateID=${process.env.SMS_TEMPLATE_ID}`;
    }

    // 💬 WHATSAPP FLOW
    if (type === 'whatsapp') {
      apiUrl = `${process.env.WT_BASE_URL}?authTkn=${process.env.WT_AUTHTOKEN}&templateName=${process.env.WT_TEMPLATE_NAME}&mobileNo=${phone}&otp=${otp}`;
    }

    // Call API
    await axios.get(apiUrl, { timeout: 5000 });

    return res.status(200).json({
      success: true,
      message: `OTP sent via ${type}`,
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