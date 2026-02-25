import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

const walletSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  type: z.enum(['cash', 'bank', 'e_wallet', 'credit_card']),
  balance: z.number().default(0),
  icon: z.string().min(1, 'Icon wajib diisi'),
  color: z.string().min(1, 'Warna wajib diisi'),
  isDefault: z.boolean().optional().default(false),
});

// Semua anggota keluarga bisa lihat semua dompet
export const getWallets = async (_req: AuthRequest, res: Response): Promise<void> => {
  const wallets = await prisma.wallet.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  res.json({ success: true, data: wallets });
};

export const createWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = walletSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const wallet = await prisma.wallet.create({
    data: { ...parsed.data, userId: req.user!.userId },
  });

  res.status(201).json({ success: true, data: wallet });
};

// Semua anggota keluarga bisa edit dompet manapun
export const updateWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.wallet.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Dompet tidak ditemukan' });
    return;
  }

  const parsed = walletSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const wallet = await prisma.wallet.update({ where: { id }, data: parsed.data });
  res.json({ success: true, data: wallet });
};

export const deleteWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.wallet.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Dompet tidak ditemukan' });
    return;
  }

  await prisma.wallet.delete({ where: { id } });
  res.json({ success: true, message: 'Dompet berhasil dihapus' });
};
