-- CreateEnum
CREATE TABLE `PaymentStatus` (
  `value` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`value`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Insert enum values
INSERT INTO `PaymentStatus` (`value`) VALUES
  ('PENDING'),
  ('APPROVED'),
  ('REJECTED'),
  ('CANCELLED'),
  ('IN_PROCESS'),
  ('REFUNDED'),
  ('CHARGED_BACK');

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `mercadopagoId` VARCHAR(191) NOT NULL,
    `externalReference` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10,2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'BRL',
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'IN_PROCESS', 'REFUNDED', 'CHARGED_BACK') NOT NULL,
    `paymentMethod` VARCHAR(191) NOT NULL,
    `payerName` VARCHAR(191) NOT NULL,
    `payerEmail` VARCHAR(191) NOT NULL,
    `payerCpf` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `items` JSON NULL,
    `receiptUrl` VARCHAR(191) NULL,
    `successUrl` VARCHAR(191) NULL,
    `failureUrl` VARCHAR(191) NULL,
    `mpCreatedAt` DATETIME(3) NULL,
    `mpUpdatedAt` DATETIME(3) NULL,
    `mpStatusDetail` VARCHAR(191) NULL,
    `mpRejectionReason` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paymentId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `eventData` JSON NOT NULL,
    `processed` BOOLEAN NOT NULL DEFAULT false,
    `processedAt` DATETIME(3) NULL,
    `error` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `payments_mercadopagoId_key` ON `payments`(`mercadopagoId`);

-- CreateIndex
CREATE UNIQUE INDEX `payments_externalReference_key` ON `payments`(`externalReference`);

-- CreateIndex
CREATE INDEX `payments_status_idx` ON `payments`(`status`);

-- CreateIndex
CREATE INDEX `payments_payerEmail_idx` ON `payments`(`payerEmail`);

-- CreateIndex
CREATE INDEX `webhook_events_paymentId_idx` ON `webhook_events`(`paymentId`);

-- CreateIndex
CREATE INDEX `webhook_events_eventType_idx` ON `webhook_events`(`eventType`);

-- AddForeignKey
ALTER TABLE `webhook_events` ADD CONSTRAINT `webhook_events_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE; 