import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role.name === "Chủ cửa hàng") {
    return NextResponse.json(
      { error: "Không thể khoá Chủ cửa hàng" },
      { status: 400 }
    );
  }
  const updated = await prisma.user.update({
    where: { id },
    data: {
      isActive: !user.isActive,
      failedAttempts: 0,
      lockedUntil: null,
    },
    include: { role: true },
  });
  const { passwordHash: _ph, ...safe } = updated as typeof updated & { passwordHash: string };
  void _ph;
  return NextResponse.json(safe);
}
