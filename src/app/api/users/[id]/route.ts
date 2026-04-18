import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";

const updateSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  phone: z.string().optional().nullable(),
  roleId: z.string().optional(),
});

async function ensureNotOwner(id: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  return u?.role.name !== "Chủ cửa hàng";
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Owner cannot have role changed
  if (parsed.data.roleId) {
    const canChange = await ensureNotOwner(id);
    if (!canChange) {
      return NextResponse.json(
        { error: "Không thể đổi vai trò của Chủ cửa hàng" },
        { status: 400 }
      );
    }
  }

  const { roleId, ...rest } = parsed.data;
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(roleId && { role: { connect: { id: roleId } } }),
    },
    include: { role: true },
  });

  const { passwordHash: _ph, ...safe } = user as typeof user & { passwordHash: string };
  void _ph;
  return NextResponse.json(safe);
}

// Soft delete — owner cannot be deleted
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const canDelete = await ensureNotOwner(id);
  if (!canDelete) {
    return NextResponse.json(
      { error: "Không thể xoá Chủ cửa hàng" },
      { status: 400 }
    );
  }
  await prisma.user.update({
    where: { id },
    data: { isDeleted: true, isActive: false },
  });
  return NextResponse.json({ success: true });
}
