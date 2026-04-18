import { NextResponse } from "next/server";

// Archive mode: convert action disabled. Use /invoices/new for POS flow.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Chuyển đổi đơn hàng đã bị vô hiệu hoá. Tạo hoá đơn trực tiếp tại /invoices/new.",
    },
    { status: 410 }
  );
}
