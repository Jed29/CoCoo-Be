import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

export const getMonthlyReport = async (req: AuthRequest, res: Response): Promise<void> => {
  const now = new Date();
  const month = parseInt(req.query.month as string) || now.getMonth() + 1;
  const year = parseInt(req.query.year as string) || now.getFullYear();

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const [income, expense, byCategory, transactions] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: 'income', date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'expense', date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        wallet: { select: { id: true, name: true, icon: true } },
      },
      orderBy: { date: 'desc' },
    }),
  ]);

  const totalIncome = income._sum.amount ?? 0;
  const totalExpense = expense._sum.amount ?? 0;

  // Ambil detail kategori
  const categoryIds = [...new Set(byCategory.map((b) => b.categoryId))];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, icon: true, color: true },
  });

  const byCategoryWithDetail = byCategory.map((b) => ({
    ...b,
    category: categories.find((c) => c.id === b.categoryId),
    total: b._sum.amount ?? 0,
    percentage:
      b.type === 'expense' && totalExpense > 0
        ? ((b._sum.amount ?? 0) / totalExpense) * 100
        : b.type === 'income' && totalIncome > 0
        ? ((b._sum.amount ?? 0) / totalIncome) * 100
        : 0,
  }));

  res.json({
    success: true,
    data: {
      month,
      year,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      byCategory: byCategoryWithDetail,
      transactions,
    },
  });
};

export const getYearlyReport = async (req: AuthRequest, res: Response): Promise<void> => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const monthlyData = await Promise.all(
    Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const start = new Date(year, i, 1);
      const end = new Date(year, i + 1, 0, 23, 59, 59);

      return Promise.all([
        prisma.transaction.aggregate({
          where: { type: 'income', date: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { type: 'expense', date: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
      ]).then(([inc, exp]) => ({
        month,
        year,
        income: inc._sum.amount ?? 0,
        expense: exp._sum.amount ?? 0,
        balance: (inc._sum.amount ?? 0) - (exp._sum.amount ?? 0),
      }));
    })
  );

  const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
  const totalExpense = monthlyData.reduce((sum, m) => sum + m.expense, 0);

  res.json({
    success: true,
    data: {
      year,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      monthly: monthlyData,
    },
  });
};
