-- CreateTable
CREATE TABLE "archivedChannels" (
    "channelId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,

    PRIMARY KEY ("ticketId", "channelId"),
    CONSTRAINT "archivedChannels_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "archivedMessages" (
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "id" TEXT NOT NULL PRIMARY KEY,
    "external" BOOLEAN NOT NULL DEFAULT false,
    "ticketId" TEXT NOT NULL,
    CONSTRAINT "archivedMessages_ticketId_authorId_fkey" FOREIGN KEY ("ticketId", "authorId") REFERENCES "archivedUsers" ("ticketId", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "archivedMessages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "archivedRoles" (
    "colour" TEXT NOT NULL DEFAULT '5865F2',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,

    PRIMARY KEY ("ticketId", "roleId"),
    CONSTRAINT "archivedRoles_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "archivedUsers" (
    "avatar" TEXT,
    "bot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discriminator" TEXT,
    "displayName" TEXT,
    "roleId" TEXT,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,

    PRIMARY KEY ("ticketId", "userId"),
    CONSTRAINT "archivedUsers_ticketId_roleId_fkey" FOREIGN KEY ("ticketId", "roleId") REFERENCES "archivedRoles" ("ticketId", "roleId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "archivedUsers_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categories" (
    "channelName" TEXT NOT NULL,
    "claiming" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cooldown" INTEGER,
    "customTopic" TEXT,
    "description" TEXT NOT NULL,
    "discordCategory" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "enableFeedback" BOOLEAN NOT NULL DEFAULT false,
    "guildId" TEXT NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "image" TEXT,
    "memberLimit" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "openingMessage" TEXT NOT NULL,
    "pingRoles" TEXT NOT NULL DEFAULT '[]',
    "ratelimit" INTEGER,
    "requiredRoles" TEXT NOT NULL DEFAULT '[]',
    "requireTopic" BOOLEAN NOT NULL DEFAULT false,
    "staffRoles" TEXT NOT NULL,
    "totalLimit" INTEGER NOT NULL DEFAULT 50,
    CONSTRAINT "categories_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedback" (
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guildId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "ticketId" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    CONSTRAINT "feedback_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "feedback_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "guilds" (
    "autoClose" INTEGER NOT NULL DEFAULT 43200000,
    "autoTag" TEXT NOT NULL DEFAULT '[]',
    "archive" BOOLEAN NOT NULL DEFAULT true,
    "blocklist" TEXT NOT NULL DEFAULT '[]',
    "claimButton" BOOLEAN NOT NULL DEFAULT false,
    "closeButton" BOOLEAN NOT NULL DEFAULT false,
	"addUserButton" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorColour" TEXT NOT NULL DEFAULT 'Red',
    "footer" TEXT DEFAULT 'Discord Tickets by eartharoid',
    "id" TEXT NOT NULL PRIMARY KEY,
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "logChannel" TEXT,
    "primaryColour" TEXT NOT NULL DEFAULT '#009999',
    "staleAfter" INTEGER,
    "successColour" TEXT NOT NULL DEFAULT 'Green',
    "workingHours" TEXT NOT NULL DEFAULT '["UTC", ["00:00","23:59"], ["00:00","23:59"], ["00:00","23:59"], ["00:00","23:59"], ["00:00","23:59"], ["00:00","23:59"], ["00:00","23:59"]]'
);

-- CreateTable
CREATE TABLE "questions" (
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "maxLength" INTEGER DEFAULT 4000,
    "minLength" INTEGER DEFAULT 0,
    "options" TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL,
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "style" INTEGER NOT NULL DEFAULT 2,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "value" TEXT,
    CONSTRAINT "questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "questionAnswers" (
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" TEXT,
    CONSTRAINT "questionAnswers_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "questionAnswers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "questionAnswers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guildId" TEXT NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "regex" TEXT,
    CONSTRAINT "tags_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tickets" (
    "categoryId" INTEGER,
    "claimedById" TEXT,
    "closedAt" DATETIME,
    "closedById" TEXT,
    "closedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "firstResponseAt" DATETIME,
    "guildId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastMessageAt" DATETIME,
    "messageCount" INTEGER,
    "number" INTEGER NOT NULL,
    "open" BOOLEAN NOT NULL DEFAULT true,
    "openingMessageId" TEXT NOT NULL,
    "pinnedMessageIds" TEXT NOT NULL DEFAULT '[]',
    "priority" TEXT,
    "referencesMessageId" TEXT,
    "referencesTicketId" TEXT,
    "topic" TEXT,
    CONSTRAINT "tickets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tickets_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tickets_referencesTicketId_fkey" FOREIGN KEY ("referencesTicketId") REFERENCES "tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageCount" INTEGER NOT NULL DEFAULT 0
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
