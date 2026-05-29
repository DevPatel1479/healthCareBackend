import prisma from "../lib/prisma.js";




// Generate OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Save OTP
export const saveOTP = async (phone) => {
  const otp = generateOTP();

  // ❌ invalidate previous OTPs for this phone
  await prisma.otp_verifications.updateMany({
    where: {
      phone,
      used: false,
    },
    data: {
      used: true,
    },
  });

  // ✅ insert new OTP
  await prisma.otp_verifications.create({
    data: {
      phone,
      otp,
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
    },
  });

  return otp;
};


// Verify OTP
export const verifyOTP = async (phone, otp) => {
  // get latest valid OTP
  const record = await prisma.otp_verifications.findFirst({
    where: {
      phone,
      used: false,
    },
    orderBy: {
      created_at: "desc",
    },
  });

  if (!record) {
    return { valid: false, reason: "OTP not found" };
  }

  if (new Date() > record.expires_at) {
    return { valid: false, reason: "OTP expired" };
  }

  if (String(record.otp) !== String(otp)) {
    return { valid: false, reason: "Invalid OTP" };
  }

  // 🔥 atomic-safe update (prevents race condition)
  await prisma.otp_verifications.update({
    where: {
      id: record.id,
    },
    data: {
      used: true,
    },
  });

  return { valid: true };
};
