-- CreateIndex
CREATE INDEX `caregiver_shifts_patient_id_end_time_verified_idx` ON `caregiver_shifts`(`patient_id`, `end_time`, `verified`);
