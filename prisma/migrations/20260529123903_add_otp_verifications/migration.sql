/*
  Warnings:

  - You are about to alter the column `last_processed_date` on the `scheduler_state` table. The data in that column could be lost. The data in that column will be cast from `VarChar(50)` to `Date`.

*/
-- AlterTable
ALTER TABLE `scheduler_state` MODIFY `last_processed_date` DATE NOT NULL;

-- CreateTable
CREATE TABLE `otp_verifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(20) NOT NULL,
    `otp` VARCHAR(10) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `used` BOOLEAN NOT NULL DEFAULT false,

    INDEX `otp_verifications_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
