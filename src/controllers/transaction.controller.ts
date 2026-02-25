import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Jumlah harus lebih dari 0'),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  walletId: z.string().min(1, 'Dompet wajib dipilih'),
  description: z.string().min(1, 'Deskripsi wajib diisi'),
  date: z.string().min(1, 'Tanggal wajib diisi'),
  notes: z.string().optional(),
  attachmentUrl: z.string().optional(),
});

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  const { startDate, endDate, categoryId, walletId, type, search, page = '1', limit = '20' } = req.query;

  // Semua anggota keluarga bisa lihat semua transaksi
  const where: Record<string, unknown> = {};

  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (walletId) where.walletId = walletId;

  if (startDate || endDate) {
    where.date = {};
    if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate as string);
    if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate as string);
  }

  if (search) {
    where.description = { contains: search as string, mode: 'insensitive' };
  }

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        wallet: { select: { id: true, name: true, icon: true, color: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.transaction.count({ where }),
  ]);

  res.json({
    success: true,
    data: transactions,
    meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  });
};

export const createTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const { type, amount, walletId, date, ...rest } = parsed.data;

  const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!wallet) {
    res.status(404).json({ success: false, message: 'Dompet tidak ditemukan' });
    return;
  }

  const balanceDelta = type === 'income' ? amount : -amount;

  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        ...rest,
        type,
        amount,
        walletId,
        date: new Date(date),
        createdBy: req.user!.userId,
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        wallet: { select: { id: true, name: true, icon: true, color: true } },
      },
    }),
    prisma.wallet.update({
      where: { id: walletId },
      data: { balance: { increment: balanceDelta } },
    }),
  ]);

  res.status(201).json({ success: true, data: transaction });
};

export const updateTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    return;
  }

  const parsed = transactionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const { date, amount, type, walletId, ...rest } = parsed.data;

  // Revert saldo lama
  const oldBalanceDelta = existing.type === 'income' ? -existing.amount : existing.amount;
  const newType = type ?? existing.type;
  const newAmount = amount ?? existing.amount;
  const newWalletId = walletId ?? existing.walletId;
  const newBalanceDelta = newType === 'income' ? newAmount : -newAmount;

  const updateData: Record<string, unknown> = { ...rest };
  if (date) updateData.date = new Date(date);
  if (amount !== undefined) updateData.amount = amount;
  if (type) updateData.type = type;
  if (walletId) updateData.walletId = walletId;

  const ops = [
    prisma.transaction.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        wallet: { select: { id: true, name: true, icon: true, color: true } },
      },
    }),
    // Revert dompet lama
    prisma.wallet.update({
      where: { id: existing.walletId },
      data: { balance: { increment: oldBalanceDelta } },
    }),
  ];

  if (newWalletId !== existing.walletId) {
    ops.push(
      prisma.wallet.update({
        where: { id: newWalletId },
        data: { balance: { increment: newBalanceDelta } },
      })
    );
  } else {
    ops.push(
      prisma.wallet.update({
        where: { id: existing.walletId },
        data: { balance: { increment: newBalanceDelta } },
      })
    );
  }

  const [transaction] = await prisma.$transaction(ops);

  res.json({ success: true, data: transaction });
};

export const deleteTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    return;
  }

  const balanceDelta = existing.type === 'income' ? -existing.amount : existing.amount;

  await prisma.$transaction([
    prisma.transaction.delete({ where: { id } }),
    prisma.wallet.update({
      where: { id: existing.walletId },
      data: { balance: { increment: balanceDelta } },
    }),
  ]);

  res.json({ success: true, message: 'Transaksi berhasil dihapus' });
};
