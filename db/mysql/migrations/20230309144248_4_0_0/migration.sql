-- CreateTable
CREATE TABLE `archivedChannels` (
    `channelId` VARCHAR(19) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `name` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(19) NOT NULL,

    UNIQUE INDEX `archivedChannels_ticketId_channelId_key`(`ticketId`, `channelId`),
    PRIMARY KEY (`ticketId`, `channelId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archivedMessages` (
    `authorId` VARCHAR(19) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `edited` BOOLEAN NOT NULL DEFAULT false,
    `external` BOOLEAN NOT NULL DEFAULT false,
    `id` VARCHAR(19) NOT NULL,
    `ticketId` VARCHAR(19) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archivedRoles` (
    `colour` CHAR(6) NOT NULL DEFAULT '5865F2',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `name` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(19) NOT NULL,
    `ticketId` VARCHAR(19) NOT NULL,

    UNIQUE INDEX `archivedRoles_ticketId_roleId_key`(`ticketId`, `roleId`),
    PRIMARY KEY (`ticketId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archivedUsers` (
    `avatar` VARCHAR(191) NULL,
    `bot` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `discriminator` CHAR(4) NULL,
    `displayName` TEXT NULL,
    `roleId` VARCHAR(19) NULL,
    `ticketId` VARCHAR(19) NOT NULL,
    `userId` VARCHAR(19) NOT NULL,
    `username` TEXT NULL,

    UNIQUE INDEX `archivedUsers_ticketId_userId_key`(`ticketId`, `userId`),
    PRIMARY KEY (`ticketId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `channelName` VARCHAR(191) NOT NULL,
    `claiming` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cooldown` INTEGER NULL,
    `customTopic` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `discordCategory` VARCHAR(19) NOT NULL,
    `emoji` VARCHAR(191) NOT NULL,
    `enableFeedback` BOOLEAN NOT NULL DEFAULT false,
    `guildId` VARCHAR(19) NOT NULL,
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `image` VARCHAR(191) NULL,
    `memberLimit` INTEGER NOT NULL DEFAULT 1,
    `name` VARCHAR(191) NOT NULL,
    `openingMessage` TEXT NOT NULL,
    `pingRoles` JSON NOT NULL,
    `ratelimit` INTEGER NULL,
    `requiredRoles` JSON NOT NULL,
    `requireTopic` BOOLEAN NOT NULL DEFAULT false,
    `staffRoles` JSON NOT NULL,
    `totalLimit` INTEGER NOT NULL DEFAULT 50,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feedback` (
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `guildId` VARCHAR(19) NOT NULL,
    `rating` INTEGER NOT NULL,
    `ticketId` VARCHAR(19) NOT NULL,
    `userId` VARCHAR(19) NULL,

    PRIMARY KEY (`ticketId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guilds` (
    `autoClose` INTEGER NOT NULL DEFAULT 43200000,
    `autoTag` JSON NOT NULL,
    `archive` BOOLEAN NOT NULL DEFAULT true,
    `blocklist` JSON NOT NULL,
    `claimButton` BOOLEAN NOT NULL DEFAULT false,
    `closeButton` BOOLEAN NOT NULL DEFAULT false,
	"addUserButton" BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `errorColour` VARCHAR(191) NOT NULL DEFAULT 'Red',
    `footer` VARCHAR(191) NULL DEFAULT 'Discord Tickets by eartharoid',
    `id` VARCHAR(19) NOT NULL,
    `locale` VARCHAR(191) NOT NULL DEFAULT 'en-GB',
    `logChannel` VARCHAR(19) NULL,
    `primaryColour` VARCHAR(191) NOT NULL DEFAULT '#009999',
    `staleAfter` INTEGER NULL,
    `successColour` VARCHAR(191) NOT NULL DEFAULT 'Green',
    `workingHours` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questions` (
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `label` VARCHAR(45) NOT NULL,
    `maxLength` INTEGER NULL DEFAULT 4000,
    `minLength` INTEGER NULL DEFAULT 0,
    `options` JSON NOT NULL,
    `order` INTEGER NOT NULL,
    `placeholder` VARCHAR(100) NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `style` INTEGER NOT NULL DEFAULT 2,
    `type` ENUM('MENU', 'TEXT') NOT NULL DEFAULT 'TEXT',
    `value` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questionAnswers` (
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` VARCHAR(19) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(19) NOT NULL,
    `value` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `guildId` VARCHAR(19) NOT NULL,
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `regex` VARCHAR(191) NULL,

    UNIQUE INDEX `tags_guildId_name_key`(`guildId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tickets` (
    `categoryId` INTEGER NULL,
    `claimedById` VARCHAR(19) NULL,
    `closedAt` DATETIME(3) NULL,
    `closedById` VARCHAR(19) NULL,
    `closedReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(19) NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `firstResponseAt` DATETIME(3) NULL,
    `guildId` VARCHAR(19) NOT NULL,
    `id` VARCHAR(19) NOT NULL,
    `lastMessageAt` DATETIME(3) NULL,
    `messageCount` INTEGER NULL,
    `number` INTEGER NOT NULL,
    `open` BOOLEAN NOT NULL DEFAULT true,
    `openingMessageId` VARCHAR(19) NOT NULL,
    `pinnedMessageIds` JSON NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH') NULL,
    `referencesMessageId` VARCHAR(19) NULL,
    `referencesTicketId` VARCHAR(19) NULL,
    `topic` TEXT NULL,

    UNIQUE INDEX `tickets_guildId_number_key`(`guildId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id` VARCHAR(19) NOT NULL,
    `messageCount` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `archivedChannels` ADD CONSTRAINT `archivedChannels_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archivedMessages` ADD CONSTRAINT `archivedMessages_ticketId_authorId_fkey` FOREIGN KEY (`ticketId`, `authorId`) REFERENCES `archivedUsers`(`ticketId`, `userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archivedMessages` ADD CONSTRAINT `archivedMessages_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archivedRoles` ADD CONSTRAINT `archivedRoles_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archivedUsers` ADD CONSTRAINT `archivedUsers_ticketId_roleId_fkey` FOREIGN KEY (`ticketId`, `roleId`) REFERENCES `archivedRoles`(`ticketId`, `roleId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archivedUsers` ADD CONSTRAINT `archivedUsers_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `guilds`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `guilds`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionAnswers` ADD CONSTRAINT `questionAnswers_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionAnswers` ADD CONSTRAINT `questionAnswers_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionAnswers` ADD CONSTRAINT `questionAnswers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tags` ADD CONSTRAINT `tags_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `guilds`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_claimedById_fkey` FOREIGN KEY (`claimedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `guilds`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_referencesTicketId_fkey` FOREIGN KEY (`referencesTicketId`) REFERENCES `tickets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
