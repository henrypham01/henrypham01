import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THU PHÁP - Phần mềm kế toán",
  description: "Phần mềm kế toán Kho và Bán hàng",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
