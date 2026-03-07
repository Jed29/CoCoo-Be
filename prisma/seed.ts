import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Memulai seeding...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const jed = await prisma.user.upsert({
    where: { email: 'jed@coco.com' },
    update: {},
    create: {
      name: 'Jed',
      email: 'jed@coco.com',
      password: hashedPassword,
      role: 'admin',
    },
  });

  const licia = await prisma.user.upsert({
    where: { email: 'licia@coco.com' },
    update: {},
    create: {
      name: 'Licia',
      email: 'licia@coco.com',
      password: hashedPassword,
      role: 'member',
    },
  });

  console.log('User dibuat:', jed.email, licia.email);

  // Kategori default - Pemasukan
  const incomeCategories = [
    { name: 'Gaji', icon: 'briefcase', color: '#10B981' },
    { name: 'Freelance', icon: 'laptop', color: '#3B82F6' },
    { name: 'Investasi', icon: 'trending-up', color: '#8B5CF6' },
    { name: 'Lainnya', icon: 'plus-circle', color: '#6B7280' },
  ];

  // Kategori default - Pengeluaran
  const expenseCategories = [
    { name: 'Makanan & Minuman', icon: 'utensils', color: '#EF4444' },
    { name: 'Transportasi', icon: 'car', color: '#F97316' },
    { name: 'Belanja', icon: 'shopping-bag', color: '#EC4899' },
    { name: 'Tagihan', icon: 'file-text', color: '#EAB308' },
    { name: 'Kesehatan', icon: 'heart', color: '#14B8A6' },
    { name: 'Pendidikan', icon: 'book', color: '#6366F1' },
    { name: 'Hiburan', icon: 'film', color: '#8B5CF6' },
    { name: 'Lainnya', icon: 'more-horizontal', color: '#6B7280' },
  ];

  for (const cat of incomeCategories) {
    await prisma.category.upsert({
      where: { id: `default-income-${cat.name}` },
      update: {},
      create: { id: `default-income-${cat.name}`, ...cat, type: 'income', isDefault: true },
    });
  }

  for (const cat of expenseCategories) {
    await prisma.category.upsert({
      where: { id: `default-expense-${cat.name}` },
      update: {},
      create: { id: `default-expense-${cat.name}`, ...cat, type: 'expense', isDefault: true },
    });
  }

  console.log('Kategori default dibuat');

  // Dompet default untuk Jed
  await prisma.wallet.upsert({
    where: { id: 'wallet-cash-jed' },
    update: {},
    create: {
      id: 'wallet-cash-jed',
      name: 'Kas',
      type: 'cash',
      balance: 500000,
      icon: 'wallet',
      color: '#10B981',
      isDefault: true,
      userId: jed.id,
    },
  });

  await prisma.wallet.upsert({
    where: { id: 'wallet-bank-jed' },
    update: {},
    create: {
      id: 'wallet-bank-jed',
      name: 'Bank BCA',
      type: 'bank',
      balance: 5000000,
      icon: 'building',
      color: '#3B82F6',
      isDefault: false,
      userId: jed.id,
    },
  });

  console.log('Dompet default dibuat');

  // Quest: Misi Periode (recurring tiap tanggal 3, durasi 2 minggu)
  await prisma.quest.upsert({
    where: { id: 'quest-misi-periode' },
    update: {
      recurringDay: 3,
      durationDays: 14,
    },
    create: {
      id: 'quest-misi-periode',
      title: 'Misi Periode',
      isRecurring: true,
      recurringDay: 3,
      durationDays: 14,
      createdBy: jed.id,
      items: {
        create: [
          {
            id: 'qi-rajin-mencatat',
            name: 'Rajin Mencatat',
            description: 'Catat minimal 15 transaksi',
            type: 'transaction_count',
            targetValue: 15,
          },
          {
            id: 'qi-investasi-masa-depan',
            name: 'Investasi Masa Depan',
            description: 'Selisih masuk-keluar minimal Rp 500 rb',
            type: 'income_expense_diff',
            targetValue: 500000,
          },
          {
            id: 'qi-panen-rezeki',
            name: 'Panen Rezeki',
            description: 'Dana masuk periode ini capai Rp 1 jt',
            type: 'total_income',
            targetValue: 1000000,
          },
        ],
      },
    },
  });

  console.log('Quest seed dibuat');
  console.log('Seeding selesai!');
  console.log('');
  console.log('Akun untuk login:');
  console.log('  Admin : jed@coco.com / password123');
  console.log('  Member: licia@coco.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
