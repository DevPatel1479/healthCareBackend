const otpStore = new Map();

// Generate OTP
export   const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Save OTP
export const saveOTP = (phone, otp) => {
  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
  });
};

// Verify OTP
export const verifyOTP = (phone, otp) => {
  const record = otpStore.get(phone);

  if (!record) return { valid: false, reason: 'OTP not found' };

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return { valid: false, reason: 'OTP expired' };
  }

  if (record.otp !== otp) {
    return { valid: false, reason: 'Invalid OTP' };
  }

  otpStore.delete(phone); // one-time use

  return { valid: true };
};

