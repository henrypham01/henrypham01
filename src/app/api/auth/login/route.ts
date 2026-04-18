import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Tên đăng nhập là bắt buộc"),
  password: z.string().min(1, "Mật khẩu là bắt buộc"),
});

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { username },
    include: { role: true },
  });

  if (!user || user.isDeleted) {
    return NextResponse.json(
      { error: "Tên đăng nhập hoặc mật khẩu không đúng" },
      { status: 401 }
    );
  }

  // Check if locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return NextResponse.json(
      { error: `Tài khoản tạm khóa. Thử lại sau ${mins} phút.` },
      { status: 403 }
    );
  }

  if (!user.isActive) {
    return NextResponse.json(
      { error: "Tài khoản đã bị vô hiệu hóa, liên hệ quản lý" },
      { status: 403 }
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const nextAttempts = user.failedAttempts + 1;
    const updates: { failedAttempts: number; lockedUntil?: Date } = {
      failedAttempts: nextAttempts,
    };
    if (nextAttempts >= MAX_ATTEMPTS) {
      updates.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      updates.failedAttempts = 0;
    }
    await prisma.user.update({ where: { id: user.id }, data: updates });
    return NextResponse.json(
      { error: "Tên đăng nhập hoặc mật khẩu không đúng" },
      { status: 401 }
    );
  }

  // Reset failed attempts + update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const token = await signToken({
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    roleId: user.roleId,
    roleName: user.role.name,
  });

  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    },
  });

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return res;
}
