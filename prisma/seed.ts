import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Seed default units
  const units = [
    { code: "CAI", name: "Cái", nameEn: "Piece" },
    { code: "KG", name: "Kilogram", nameEn: "Kilogram" },
    { code: "HOP", name: "Hộp", nameEn: "Box" },
    { code: "MET", name: "Mét", nameEn: "Meter" },
    { code: "LIT", name: "Lít", nameEn: "Liter" },
    { code: "BO", name: "Bộ", nameEn: "Set" },
    { code: "CHAI", name: "Chai", nameEn: "Bottle" },
    { code: "GOI", name: "Gói", nameEn: "Pack" },
    { code: "THUNG", name: "Thùng", nameEn: "Carton" },
  ];

  for (const unit of units) {
    await prisma.unit.upsert({
      where: { code: unit.code },
      update: unit,
      create: unit,
    });
  }
  console.log("Seeded units");

  // Seed default categories
  const categories = [
    { code: "DIEN_TU", name: "Điện tử", nameEn: "Electronics" },
    { code: "THUC_PHAM", name: "Thực phẩm", nameEn: "Food & Beverage" },
    { code: "VAN_PHONG", name: "Văn phòng phẩm", nameEn: "Office Supplies" },
    { code: "MAY_MAC", name: "May mặc", nameEn: "Clothing" },
    { code: "VAT_LIEU", name: "Vật liệu xây dựng", nameEn: "Construction Materials" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { code: cat.code },
      update: cat,
      create: cat,
    });
  }
  console.log("Seeded categories");

  // Seed default settings
  const settings = [
    { key: "company_name", value: "Công ty TNHH KioViet" },
    { key: "company_address", value: "123 Nguyễn Huệ, Q.1, TP.HCM" },
    { key: "company_tax_id", value: "0123456789" },
    { key: "company_phone", value: "028 1234 5678" },
    { key: "default_vat_rate", value: "0.10" },
    { key: "cogs_method", value: "weighted_average" },
    // Default printer device names. Leave empty until the user picks one in
    // Settings → In ấn. Exact strings come from Electron webContents.getPrinters().
    { key: "print_k80_printer", value: "" },
    { key: "print_a6_printer", value: "" },
    // Paper size auto-printed after "Thanh toán" (k80 | a6 | none)
    { key: "print_default_size", value: "k80" },
    { key: "print_footer_message", value: "Cảm ơn Quý khách và hẹn gặp lại!" },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: setting,
      create: setting,
    });
  }

  // Ensure existing installs also get the new print keys added (idempotent).
  const additionalKeys = [
    "print_k80_printer",
    "print_a6_printer",
    "print_default_size",
    "print_footer_message",
  ];
  for (const key of additionalKeys) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: {
        key,
        value:
          key === "print_default_size"
            ? "k80"
            : key === "print_footer_message"
            ? "Cảm ơn Quý khách và hẹn gặp lại!"
            : "",
      },
    });
  }
  console.log("Seeded settings");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
