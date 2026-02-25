import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['admin', 'member']).optional().default('member'),
});

const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

function generateToken(userId: string, email: string, role: string): string {
  // expiresIn dalam detik: 7 hari = 604800
  return jwt.sign({ userId, email, role }, process.env.JWT_SECRET!, { expiresIn: 604800 });
}

export const register = async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ success: false, message: 'Email sudah terdaftar' });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role },
    select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
  });

  const token = generateToken(user.id, user.email, user.role);

  res.status(201).json({ success: true, data: { user, token } });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ success: false, message: 'Email atau password salah' });
    return;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    res.status(401).json({ success: false, message: 'Email atau password salah' });
    return;
  }

  const token = generateToken(user.id, user.email, user.role);
  const { password: _, ...userWithoutPassword } = user;

  res.json({ success: true, data: { user: userWithoutPassword, token } });
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
  });

  if (!user) {
    res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    return;
  }

  res.json({ success: true, data: user });
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    avatar: z.string().optional(),
    password: z.string().min(6).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    return;
  }

  const { name, avatar, password } = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (name) updateData.name = name;
  if (avatar !== undefined) updateData.avatar = avatar;
  if (password) updateData.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
  });

  res.json({ success: true, data: user });
};
