import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';
import { QuestItem, QuestItemType } from '@prisma/client';

function getRecurringPeriod(
  recurringDay: number,
  durationDays: number
): { startDate: Date; endDate: Date } | null {
  const now = new Date();

  // Cek bulan ini
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), recurringDay);
  const endThisMonth = new Date(startThisMonth);
  endThisMonth.setDate(endThisMonth.getDate() + durationDays);
  if (now >= startThisMonth && now <= endThisMonth) {
    return { startDate: startThisMonth, endDate: endThisMonth };
  }

  // Cek bulan lalu (kalau misi masih berjalan melewati bulan)
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, recurringDay);
  const endPrevMonth = new Date(prevMonthDate);
  endPrevMonth.setDate(endPrevMonth.getDate() + durationDays);
  if (now >= prevMonthDate && now <= endPrevMonth) {
    return { startDate: prevMonthDate, endDate: endPrevMonth };
  }

  return null;
}

async function calculateProgress(
  item: QuestItem,
  startDate: Date,
  endDate: Date,
  userId: string
): Promise<{ currentValue: number; percentage: number }> {
  const dateFilter = { gte: startDate, lte: endDate };

  switch (item.type as QuestItemType) {
    case 'transaction_count': {
      const count = await prisma.transaction.count({
        where: { createdBy: userId, date: dateFilter },
      });
      return {
        currentValue: count,
        percentage: Math.min((count / item.targetValue) * 100, 100),
      };
    }

    case 'income_expense_diff': {
      const [income, expense] = await Promise.all([
        prisma.transaction.aggregate({
          where: { type: 'income', createdBy: userId, date: dateFilter },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { type: 'expense', createdBy: userId, date: dateFilter },
          _sum: { amount: true },
        }),
      ]);
      const diff = (income._sum.amount ?? 0) - (expense._sum.amount ?? 0);
      return {
        currentValue: Math.max(diff, 0),
        percentage: Math.min((Math.max(diff, 0) / item.targetValue) * 100, 100),
      };
    }

    case 'total_income': {
      const income = await prisma.transaction.aggregate({
        where: { type: 'income', createdBy: userId, date: dateFilter },
        _sum: { amount: true },
      });
      const val = income._sum.amount ?? 0;
      return {
        currentValue: val,
        percentage: Math.min((val / item.targetValue) * 100, 100),
      };
    }

    case 'total_expense': {
      const expense = await prisma.transaction.aggregate({
        where: { type: 'expense', createdBy: userId, date: dateFilter },
        _sum: { amount: true },
      });
      const val = expense._sum.amount ?? 0;
      return {
        currentValue: val,
        percentage: Math.min((val / item.targetValue) * 100, 100),
      };
    }

    default:
      return { currentValue: 0, percentage: 0 };
  }
}

export const getActiveQuests = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const now = new Date();

  const quests = await prisma.quest.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  const result = await Promise.all(
    quests.map(async (quest) => {
      let startDate: Date;
      let endDate: Date;

      if (quest.isRecurring && quest.recurringDay && quest.durationDays) {
        const period = getRecurringPeriod(quest.recurringDay, quest.durationDays);
        if (!period) return null; // Belum/sudah tidak aktif bulan ini
        startDate = period.startDate;
        endDate = period.endDate;
      } else if (quest.startDate && quest.endDate) {
        startDate = quest.startDate;
        endDate = quest.endDate;
        if (now < startDate || now > endDate) return null; // Tidak aktif
      } else {
        return null;
      }

      const items = await Promise.all(
        quest.items.map(async (item) => {
          const progress = await calculateProgress(item, startDate, endDate, userId);
          return {
            id: item.id,
            name: item.name,
            description: item.description,
            type: item.type,
            targetValue: item.targetValue,
            currentValue: progress.currentValue,
            percentage: Math.round(progress.percentage * 10) / 10,
            isCompleted: progress.percentage >= 100,
          };
        })
      );

      const completedCount = items.filter((i) => i.isCompleted).length;
      const daysLeft = Math.max(
        Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        0
      );

      return {
        id: quest.id,
        title: quest.title,
        startDate,
        endDate,
        daysLeft,
        isRecurring: quest.isRecurring,
        progress: {
          completed: completedCount,
          total: items.length,
          percentage: items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0,
        },
        items,
      };
    })
  );

  res.json({
    success: true,
    data: result.filter(Boolean),
  });
};
