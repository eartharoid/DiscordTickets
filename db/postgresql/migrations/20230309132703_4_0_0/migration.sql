-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MENU', 'TEXT');

-- CreateTable
CREATE TABLE "archivedChannels" (
    "channelId" VARCHAR(19) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "ticketId" VARCHAR(19) NOT NULL,

    CONSTRAINT "archivedChannels_pkey" PRIMARY KEY ("ticketId","channelId")
);

-- CreateTable
CREATE TABLE "archivedMessages" (
    "authorId" VARCHAR(19) NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "external" BOOLEAN NOT NULL DEFAULT false,
    "id" VARCHAR(19) NOT NULL,
    "ticketId" VARCHAR(19) NOT NULL,

    CONSTRAINT "archivedMessages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archivedRoles" (
    "colour" CHAR(6) NOT NULL DEFAULT '5865F2',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "roleId" VARCHAR(19) NOT NULL,
    "ticketId" VARCHAR(19) NOT NULL,

    CONSTRAINT "archivedRoles_pkey" PRIMARY KEY ("ticketId","roleId")
);

-- CreateTable
CREATE TABLE "archivedUsers" (
    "avatar" TEXT,
    "bot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discriminator" CHAR(4),
    "displayName" TEXT,
    "roleId" VARCHAR(19),
    "ticketId" VARCHAR(19) NOT NULL,
    "userId" VARCHAR(19) NOT NULL,
    "username" TEXT,

    CONSTRAINT "archivedUsers_pkey" PRIMARY KEY ("ticketId","userId")
);

-- CreateTable
CREATE TABLE "categories" (
    "channelName" TEXT NOT NULL,
    "claiming" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cooldown" INTEGER,
    "customTopic" TEXT,
    "description" TEXT NOT NULL,
    "discordCategory" VARCHAR(19) NOT NULL,
    "emoji" TEXT NOT NULL,
    "enableFeedback" BOOLEAN NOT NULL DEFAULT false,
    "guildId" VARCHAR(19) NOT NULL,
    "id" SERIAL NOT NULL,
    "image" TEXT,
    "memberLimit" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "openingMessage" TEXT NOT NULL,
    "pingRoles" JSONB NOT NULL DEFAULT '[]',
    "ratelimit" INTEGER,
    "requiredRoles" JSONB NOT NULL DEFAULT '[]',
    "requireTopic" BOOLEAN NOT NULL DEFAULT false,
    "staffRoles" JSONB NOT NULL,
    "totalLimit" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guildId" VARCHAR(19) NOT NULL,
    "rating" INTEGER NOT NULL,
    "ticketId" VARCHAR(19) NOT NULL,
    "userId" VARCHAR(19),

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("ticketId")
);

-- CreateTable
CREATE TABLE "guilds" (
    "autoClose" INTEGER NOT NULL DEFAULT 43200000,
    "autoTag" JSONB NOT NULL DEFAULT '[]',
    "archive" BOOLEAN NOT NULL DEFAULT true,
    "blocklist" JSONB NOT NULL DEFAULT '[]',
    "claimButton" BOOLEAN NOT NULL DEFAULT false,
    "closeButton" BOOLEAN NOT NULL DEFAULT false,
	"addUserButton" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorColour" TEXT NOT NULL DEFAULT 'Red',
    "footer" TEXT DEFAULT 'Discord Tickets by eartharoid',
    "id" VARCHAR(19) NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "logChannel" VARCHAR(19),
    "primaryColour" TEXT NOT NULL DEFAULT '#009999',
    "staleAfter" INTEGER,
    "successColour" TEXT NOT NULL DEFAULT 'Green',
    "workingHours" JSONB NOT NULL DEFAULT '["UTC", ["00:00","23:59"], ["00:00","23:59"], ["00:00","23:59"], ["00:00","23:59"], ["00:00","23:59"], ["00:00","23:59"], ["00:00","23:59"]]',

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "label" VARCHAR(45) NOT NULL,
    "maxLength" INTEGER DEFAULT 4000,
    "minLength" INTEGER DEFAULT 0,
    "options" JSONB NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL,
    "placeholder" VARCHAR(100),
    "required" BOOLEAN NOT NULL DEFAULT true,
    "style" INTEGER NOT NULL DEFAULT 2,
    "type" "QuestionType" NOT NULL DEFAULT 'TEXT',
    "value" TEXT,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionAnswers" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL,
    "ticketId" VARCHAR(19) NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" VARCHAR(19) NOT NULL,
    "value" TEXT,

    CONSTRAINT "questionAnswers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guildId" VARCHAR(19) NOT NULL,
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "regex" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "categoryId" INTEGER,
    "claimedById" VARCHAR(19),
    "closedAt" TIMESTAMP(3),
    "closedById" VARCHAR(19),
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" VARCHAR(19) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "firstResponseAt" TIMESTAMP(3),
    "guildId" VARCHAR(19) NOT NULL,
    "id" VARCHAR(19) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "messageCount" INTEGER,
    "number" INTEGER NOT NULL,
    "open" BOOLEAN NOT NULL DEFAULT true,
    "openingMessageId" VARCHAR(19) NOT NULL,
    "pinnedMessageIds" JSONB NOT NULL DEFAULT '[]',
    "priority" "TicketPriority",
    "referencesMessageId" VARCHAR(19),
    "referencesTicketId" VARCHAR(19),
    "topic" TEXT,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" VARCHAR(19) NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archivedChannels_ticketId_channelId_key" ON "archivedChannels"("ticketId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "archivedRoles_ticketId_roleId_key" ON "archivedRoles"("ticketId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "archivedUsers_ticketId_userId_key" ON "archivedUsers"("ticketId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_guildId_name_key" ON "tags"("guildId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_guildId_number_key" ON "tickets"("guildId", "number");

-- AddForeignKey
ALTER TABLE "archivedChannels" ADD CONSTRAINT "archivedChannels_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivedMessages" ADD CONSTRAINT "archivedMessages_ticketId_authorId_fkey" FOREIGN KEY ("ticketId", "authorId") REFERENCES "archivedUsers"("ticketId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivedMessages" ADD CONSTRAINT "archivedMessages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivedRoles" ADD CONSTRAINT "archivedRoles_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivedUsers" ADD CONSTRAINT "archivedUsers_ticketId_roleId_fkey" FOREIGN KEY ("ticketId", "roleId") REFERENCES "archivedRoles"("ticketId", "roleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivedUsers" ADD CONSTRAINT "archivedUsers_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionAnswers" ADD CONSTRAINT "questionAnswers_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionAnswers" ADD CONSTRAINT "questionAnswers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionAnswers" ADD CONSTRAINT "questionAnswers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_referencesTicketId_fkey" FOREIGN KEY ("referencesTicketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
