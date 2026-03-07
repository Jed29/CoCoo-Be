-- CreateEnum
CREATE TYPE "QuestItemType" AS ENUM ('transaction_count', 'income_expense_diff', 'total_income', 'total_expense');

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringDay" INTEGER,
    "durationDays" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_items" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "QuestItemType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quest_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_items" ADD CONSTRAINT "quest_items_questId_fkey" FOREIGN KEY ("questId") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex
DROP INDEX IF EXISTS "budgets_categoryId_month_year_createdBy_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "budgets_categoryId_month_year_key" ON "budgets"("categoryId", "month", "year");
