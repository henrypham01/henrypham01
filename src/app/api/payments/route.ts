import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const payments = await prisma.payment.findMany({
    include: { customer: true, invoice: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(payments);
}

// POS flow: invoice is paid-on-create. Manual payment recording is archived/disabled.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Module thanh toán đã lưu trữ. Hoá đơn mới ở chế độ POS thanh toán ngay.",
    },
    { status: 410 }
  );
}
