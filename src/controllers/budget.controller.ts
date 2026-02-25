import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

const budgetSchema = z.object({
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  amount: z.number().positive('Jumlah harus lebih dari 0'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
});

// Semua anggota keluarga bisa lihat semua budget
export const getBudgets = async (req: AuthRequest, res: Response): Promise<void> => {
  const { month, year } = req.query;

  const where: Record<string, unknown> = {};
  if (month) where.month = parseInt(month as string);
  if (year) where.year = parseInt(year as string);

  const budgets = await prisma.budget.findMany({
    where,
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Hitung spent (semua transaksi keluarga, bukan per user)
  const budgetsWithSpent = await Promise.all(
    budgets.map(async (budget) => {
      const result = await prisma.transaction.aggregate({
        where: {
          categoryId: budget.categoryId,
          type: 'expense',
          date: {
            gte: new Date(budget.year, budget.month - 1, 1),
            lt: new Date(budget.year, budget.month, 1),
          },
        },
        _sum: { amount: true },
      });

      return { ...budget, spent: result._sum.amount ?? 0 };
    })
  );

  res.json({ success: true, data: budgetsWithSpent });
};

export const createBudget = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = budgetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const existing = await prisma.budget.findUnique({
    where: {
      categoryId_month_year: {
        categoryId: parsed.data.categoryId,
        month: parsed.data.month,
        year: parsed.data.year,
      },
    },
  });

  if (existing) {
    res.status(409).json({ success: false, message: 'Budget untuk kategori dan bulan ini sudah ada' });
    return;
  }

  const budget = await prisma.budget.create({
    data: { ...parsed.data, createdBy: req.user!.userId },
    include: { category: { select: { id: true, name: true, icon: true, color: true } } },
  });

  res.status(201).json({ success: true, data: budget });
};

export const updateBudget = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.budget.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Budget tidak ditemukan' });
    return;
  }

  const parsed = budgetSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const budget = await prisma.budget.update({
    where: { id },
    data: parsed.data,
    include: { category: { select: { id: true, name: true, icon: true, color: true } } },
  });

  res.json({ success: true, data: budget });
};

export const deleteBudget = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.budget.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Budget tidak ditemukan' });
    return;
  }

  await prisma.budget.delete({ where: { id } });
  res.json({ success: true, message: 'Budget berhasil dihapus' });
};
