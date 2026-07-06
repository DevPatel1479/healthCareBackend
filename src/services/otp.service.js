import prisma from "../lib/prisma.js";

// ===============================
// Generate Random 6-digit OTP
// ===============================
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ===============================
// Save OTP
// ===============================
export const saveOTP = async (phone) => {

  const otp = generateOTP();

  // Delete expired OTPs
  await prisma.otp_verifications.deleteMany({
    where: {
      expires_at: {
        lt: new Date(),
      },
    },
  });

  // Remove previous OTP for this phone
  await prisma.otp_verifications.deleteMany({
    where: {
      phone,
    },
  });

  // Insert new OTP
  await prisma.otp_verifications.create({
    data: {
      phone,
      otp,
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return otp;
};

// ===============================
// Verify OTP
// ===============================
export const verifyOTP = async (phone, otp) => {

  const record = await prisma.otp_verifications.findUnique({
    where: {
      phone,
    },
  });
  
  if (!record) {
    return {
      valid: false,
      reason: "OTP not found",
    };
  }

  if (record.expires_at < new Date()) {

    await prisma.otp_verifications.delete({
      where: {
        id: record.id,
      },
    });

    return {
      valid: false,
      reason: "OTP expired",
    };
  }

  if (record.otp !== otp) {
    return {
      valid: false,
      reason: "Invalid OTP",
    };
  }

  const deleted = await prisma.otp_verifications.deleteMany({
    where: {
      id: record.id,
      phone,
      otp,
    },
  });

  if (deleted.count === 0) {
    return {
      valid: false,
      reason: "OTP already used",
    };
  }

  return {
    valid: true,
  };
};