/**
 * Bootstrap an administrator (there is no public registration and no default password).
 *
 * PowerShell:
 *   $env:ADMIN_EMAIL="you@company.com"; $env:ADMIN_NAME="Your Name"; $env:ADMIN_PASSWORD="a-long-passphrase"; npm run admin:create
 * Optional: $env:ADMIN_ROLE="super_admin|moderator|support|auditor" (default super_admin)
 */
import 'dotenv/config';
import { AdminRole, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const role = (process.env.ADMIN_ROLE?.trim() || 'super_admin') as AdminRole;

  if (!email || !name) throw new Error('ADMIN_EMAIL and ADMIN_NAME are required');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  if (!Object.values(AdminRole).includes(role)) throw new Error(`ADMIN_ROLE must be one of ${Object.values(AdminRole).join(', ')}`);

  const prisma = new PrismaClient();
  try {
    if (await prisma.admin.findUnique({ where: { email } })) throw new Error(`Admin ${email} already exists`);
    const admin = await prisma.admin.create({
      data: { email, name, role, passwordHash: await bcrypt.hash(password, 12) },
    });
    await prisma.auditLog.create({
      data: { module: 'admins', action: 'admins.bootstrap', targetId: admin.id, reason: 'Created via CLI script', metadata: { email, role } },
    });
    console.log(`\n✔ Created ${role} ${email}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
