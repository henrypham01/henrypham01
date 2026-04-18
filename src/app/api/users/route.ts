import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";

const createSchema = z.object({
  username: z
    .string()
    .min(4, "Tối thiểu 4 ký tự")
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Chỉ cho phép chữ, số, _ . -"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  fullName: z.string().min(1, "Họ tên là bắt buộc").max(255),
  phone: z.string().optional().nullable(),
  roleId: z.string().min(1, "Vai trò là bắt buộc"),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { isDeleted: false },
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });

  // Strip passwordHash
  const safe = users.map((u) => {
    const { passwordHash, ...rest } = u as typeof u & { passwordHash: string };
    void passwordHash;
    return rest;
  });

  return NextResponse.json(safe);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { username: parsed.data.username },
    });
    if (existing) {
      return NextResponse.json(
        { error: { username: ["Tên đăng nhập đã tồn tại"] } },
        { status: 400 }
      );
    }

    // Verify role exists before attempting to connect
    const role = await prisma.role.findUnique({
      where: { id: parsed.data.roleId },
      select: { id: true },
    });
    if (!role) {
      return NextResponse.json(
        { error: { roleId: ["Vai trò không tồn tại"] } },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        passwordHash,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone || null,
        role: { connect: { id: parsed.data.roleId } },
        createdBy: { connect: { id: session.userId } },
      },
      include: { role: true },
    });

    const { passwordHash: _ph, ...safe } = user as typeof user & {
      passwordHash: string;
    };
    void _ph;
    return NextResponse.json(safe, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi máy chủ";
    console.error("POST /api/users failed:", err);
    return NextResponse.json(
      { error: `Không thể tạo tài khoản: ${msg}` },
      { status: 500 }
    );
  }
}
