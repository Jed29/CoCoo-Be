import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

const categorySchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  icon: z.string().min(1, 'Icon wajib diisi'),
  color: z.string().min(1, 'Warna wajib diisi'),
  type: z.enum(['income', 'expense']),
});

// Semua anggota keluarga bisa lihat semua kategori
export const getCategories = async (_req: AuthRequest, res: Response): Promise<void> => {
  const categories = await prisma.category.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });

  res.json({ success: true, data: categories });
};

export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const category = await prisma.category.create({
    data: { ...parsed.data, createdBy: req.user!.userId },
  });

  res.status(201).json({ success: true, data: category });
};

export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    return;
  }

  if (existing.isDefault) {
    res.status(403).json({ success: false, message: 'Kategori default tidak bisa diubah' });
    return;
  }

  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const category = await prisma.category.update({ where: { id }, data: parsed.data });
  res.json({ success: true, data: category });
};

export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    return;
  }

  if (existing.isDefault) {
    res.status(403).json({ success: false, message: 'Kategori default tidak bisa dihapus' });
    return;
  }

  await prisma.category.delete({ where: { id } });
  res.json({ success: true, message: 'Kategori berhasil dihapus' });
};
