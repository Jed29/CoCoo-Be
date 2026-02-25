import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

export const getDashboard = async (_req: AuthRequest, res: Response): Promise<void> => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  const [wallets, monthlyIncome, monthlyExpense, recentTransactions, budgets, categoryExpenses] =
    await Promise.all([
      // Total saldo semua dompet
      prisma.wallet.findMany(),

      // Total pemasukan bulan ini
      prisma.transaction.aggregate({
        where: { type: 'income', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),

      // Total pengeluaran bulan ini
      prisma.transaction.aggregate({
        where: { type: 'expense', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),

      // 5 transaksi terbaru
      prisma.transaction.findMany({
        include: {
          category: { select: { id: true, name: true, icon: true, color: true } },
          wallet: { select: { id: true, name: true, icon: true, color: true } },
        },
        orderBy: { date: 'desc' },
        take: 5,
      }),

      // Budget bulan ini
      prisma.budget.findMany({
        where: { month: month + 1, year },
        include: { category: { select: { id: true, name: true, icon: true, color: true } } },
      }),

      // Pengeluaran per kategori bulan ini
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { type: 'expense', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
    ]);

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalMonthlyIncome = monthlyIncome._sum.amount ?? 0;
  const totalMonthlyExpense = monthlyExpense._sum.amount ?? 0;

  // Budget alerts (>= 80% terpakai)
  const budgetAlerts = await Promise.all(
    budgets.map(async (budget) => {
      const spent = categoryExpenses.find((e) => e.categoryId === budget.categoryId)?._sum.amount ?? 0;
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      return { ...budget, spent, percentage };
    })
  );

  // Trend 6 bulan terakhir
  const trendData = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
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
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        income: inc._sum.amount ?? 0,
        expense: exp._sum.amount ?? 0,
      }));
    })
  );

  res.json({
    success: true,
    data: {
      totalBalance,
      monthlyIncome: totalMonthlyIncome,
      monthlyExpense: totalMonthlyExpense,
      monthlyBalance: totalMonthlyIncome - totalMonthlyExpense,
      wallets,
      recentTransactions,
      budgetAlerts: budgetAlerts.filter((b) => b.percentage >= 80),
      trend: trendData.reverse(),
    },
  });
};
