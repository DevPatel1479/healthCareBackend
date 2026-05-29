-- CreateIndex
CREATE INDEX `otp_verifications_phone_created_at_idx` ON `otp_verifications`(`phone`, `created_at`);
