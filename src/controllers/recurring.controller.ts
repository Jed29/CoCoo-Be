import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

const recurringSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Jumlah harus lebih dari 0'),
  categoryId: z.string().min(1),
  walletId: z.string().min(1),
  description: z.string().min(1),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  nextDueDate: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

// Semua anggota keluarga bisa lihat semua recurring
export const getRecurring = async (_req: AuthRequest, res: Response): Promise<void> => {
  const recurring = await prisma.recurringTransaction.findMany({
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      wallet: { select: { id: true, name: true, icon: true, color: true } },
    },
    orderBy: { nextDueDate: 'asc' },
  });

  res.json({ success: true, data: recurring });
};

export const createRecurring = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = recurringSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const { startDate, endDate, nextDueDate, ...rest } = parsed.data;

  const recurring = await prisma.recurringTransaction.create({
    data: {
      ...rest,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      nextDueDate: new Date(nextDueDate),
      createdBy: req.user!.userId,
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      wallet: { select: { id: true, name: true, icon: true, color: true } },
    },
  });

  res.status(201).json({ success: true, data: recurring });
};

export const updateRecurring = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.recurringTransaction.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Transaksi berulang tidak ditemukan' });
    return;
  }

  const parsed = recurringSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const { startDate, endDate, nextDueDate, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (startDate) updateData.startDate = new Date(startDate);
  if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
  if (nextDueDate) updateData.nextDueDate = new Date(nextDueDate);

  const recurring = await prisma.recurringTransaction.update({
    where: { id },
    data: updateData,
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      wallet: { select: { id: true, name: true, icon: true, color: true } },
    },
  });

  res.json({ success: true, data: recurring });
};

export const deleteRecurring = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.recurringTransaction.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Transaksi berulang tidak ditemukan' });
    return;
  }

  await prisma.recurringTransaction.delete({ where: { id } });
  res.json({ success: true, message: 'Transaksi berulang berhasil dihapus' });
};
