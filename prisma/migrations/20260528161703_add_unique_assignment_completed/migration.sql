/*
  Warnings:

  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `user`;

-- CreateTable
CREATE TABLE `care_tasks` (
    `task_id` INTEGER NOT NULL AUTO_INCREMENT,
    `description` TEXT NOT NULL,
    `task_category` ENUM('Daily/Routine', 'Periodic', 'Unplanned/As Required') NOT NULL,
    `scheduled_time` VARCHAR(50) NULL,
    `applies_to_ME` BOOLEAN NULL DEFAULT false,
    `applies_to_SE` BOOLEAN NULL DEFAULT false,
    `applies_to_BE` BOOLEAN NULL DEFAULT false,
    `applies_to_PO` BOOLEAN NULL DEFAULT false,
    `applies_to_PD` BOOLEAN NULL DEFAULT false,
    `clinical_notes` TEXT NULL,

    PRIMARY KEY (`task_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `caregiver_master` (
    `caregiver_id` INTEGER NOT NULL,
    `specialization` VARCHAR(100) NULL,
    `experience_years` INTEGER NULL DEFAULT 0,
    `assigned_area` VARCHAR(100) NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `joining_date` DATE NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`caregiver_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `caregiver_shifts` (
    `shift_assignment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `caregiver_id` INTEGER NOT NULL,
    `shift_id` INTEGER NOT NULL,
    `start_time` TIMESTAMP(0) NOT NULL,
    `end_time` TIMESTAMP(0) NULL,
    `check_in_method` VARCHAR(20) NULL DEFAULT 'qr',
    `verified` BOOLEAN NULL DEFAULT true,
    `handover_notes` TEXT NULL,

    INDEX `caregiver_shifts_patient_id_idx`(`patient_id`),
    INDEX `caregiver_shifts_caregiver_id_idx`(`caregiver_id`),
    INDEX `caregiver_shifts_shift_id_idx`(`shift_id`),
    PRIMARY KEY (`shift_assignment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `patients` (
    `patient_id` INTEGER NOT NULL AUTO_INCREMENT,
    `family_lead_id` INTEGER NOT NULL,
    `qr_code_hash` VARCHAR(255) NOT NULL,
    `category` ENUM('1A', '1B', '2', '3') NOT NULL,
    `medical_history` TEXT NULL,
    `status` ENUM('active', 'suspended', 'discharged') NULL DEFAULT 'active',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `qr_code_hash`(`qr_code_hash`),
    INDEX `fk_family_lead`(`family_lead_id`),
    PRIMARY KEY (`patient_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
    `shift_id` INTEGER NOT NULL AUTO_INCREMENT,
    `shift_name` VARCHAR(50) NULL,
    `start_time` TIME(0) NULL,
    `end_time` TIME(0) NULL,

    PRIMARY KEY (`shift_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_assignments` (
    `assignment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `task_id` INTEGER NULL,
    `patient_id` INTEGER NULL,
    `caregiver_id` INTEGER NULL,
    `shift_id` INTEGER NULL,
    `status` ENUM('completed', 'skipped', 'refused', 'pending') NOT NULL,
    `time_done` TIMESTAMP(0) NULL,
    `flag_level` ENUM('green', 'yellow', 'red') NULL DEFAULT 'green',
    `observation` TEXT NULL,
    `photo_evidence` VARCHAR(512) NULL,
    `supervisor_val` BOOLEAN NULL DEFAULT false,

    INDEX `caregiver_id`(`caregiver_id`),
    INDEX `patient_id`(`patient_id`),
    INDEX `shift_id`(`shift_id`),
    INDEX `task_id`(`task_id`),
    PRIMARY KEY (`assignment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` ENUM('admin', 'family_lead', 'caregiver', 'doctor') NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone_number` VARCHAR(20) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `is_verified` BOOLEAN NULL DEFAULT false,
    `last_login` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `email`(`email`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `completed_tasks` (
    `completed_task_id` INTEGER NOT NULL AUTO_INCREMENT,
    `task_id` INTEGER NULL,
    `patient_id` INTEGER NULL,
    `caregiver_id` INTEGER NULL,
    `shift_id` INTEGER NULL,
    `assignment_id` INTEGER NULL,
    `scheduled_time` TIMESTAMP(0) NULL,
    `actual_time_done` TIMESTAMP(0) NULL,
    `status` ENUM('completed', 'skipped', 'refused', 'partial') NOT NULL,
    `flag_level` ENUM('green', 'yellow', 'red') NULL DEFAULT 'green',
    `observation` TEXT NULL,
    `photo_evidence` VARCHAR(512) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `completed_tasks_assignment_id_key`(`assignment_id`),
    INDEX `completed_tasks_task_id_idx`(`task_id`),
    INDEX `completed_tasks_patient_id_idx`(`patient_id`),
    INDEX `completed_tasks_caregiver_id_idx`(`caregiver_id`),
    INDEX `completed_tasks_shift_id_idx`(`shift_id`),
    INDEX `completed_tasks_assignment_id_idx`(`assignment_id`),
    PRIMARY KEY (`completed_task_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `caregiver_master` ADD CONSTRAINT `fk_caregiver_user` FOREIGN KEY (`caregiver_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `caregiver_shifts` ADD CONSTRAINT `fk_caregiver_shift_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`patient_id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `caregiver_shifts` ADD CONSTRAINT `fk_caregiver_shift_user` FOREIGN KEY (`caregiver_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `caregiver_shifts` ADD CONSTRAINT `fk_caregiver_shift_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`shift_id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `patients` ADD CONSTRAINT `fk_family_lead` FOREIGN KEY (`family_lead_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `task_assignments` ADD CONSTRAINT `task_assignments_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `care_tasks`(`task_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `task_assignments` ADD CONSTRAINT `task_assignments_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`patient_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `task_assignments` ADD CONSTRAINT `task_assignments_ibfk_3` FOREIGN KEY (`caregiver_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `task_assignments` ADD CONSTRAINT `task_assignments_ibfk_4` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`shift_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `completed_tasks` ADD CONSTRAINT `completed_tasks_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `care_tasks`(`task_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `completed_tasks` ADD CONSTRAINT `completed_tasks_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`patient_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `completed_tasks` ADD CONSTRAINT `completed_tasks_caregiver_id_fkey` FOREIGN KEY (`caregiver_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `completed_tasks` ADD CONSTRAINT `completed_tasks_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`shift_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `completed_tasks` ADD CONSTRAINT `completed_tasks_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `task_assignments`(`assignment_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
