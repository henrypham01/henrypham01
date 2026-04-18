import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

// Default roles with permissions
const DEFAULT_ROLES = [
  {
    name: "Chủ cửa hàng",
    isSystem: true,
    permissions: {
      products: ["view", "create", "edit", "delete"],
      purchase_orders: ["view", "create", "complete", "cancel"],
      invoices: ["view", "create", "cancel"],
      reports: ["view_revenue", "view_profit", "view_inventory"],
      settings: ["view", "edit"],
      users: ["view", "create", "edit", "delete"],
    },
  },
  {
    name: "Quản lý",
    isSystem: true,
    permissions: {
      products: ["view", "create", "edit"],
      purchase_orders: ["view", "create", "complete"],
      invoices: ["view", "create"],
      reports: ["view_revenue", "view_profit", "view_inventory"],
      users: ["view", "create", "edit"],
    },
  },
  {
    name: "Thủ kho",
    isSystem: true,
    permissions: {
      products: ["view"],
      purchase_orders: ["view", "create", "complete"],
      reports: ["view_inventory"],
    },
  },
  {
    name: "Thu ngân",
    isSystem: true,
    permissions: {
      products: ["view"],
      invoices: ["view", "create"],
    },
  },
];

async function main() {
  // Seed roles (permissions stored as JSON string for SQLite compatibility)
  for (const role of DEFAULT_ROLES) {
    const data = {
      name: role.name,
      permissions: JSON.stringify(role.permissions),
      isSystem: role.isSystem,
    };
    await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: data.permissions, isSystem: data.isSystem },
      create: data,
    });
  }
  console.log("✓ Seeded roles");

  // Create owner user if not exists
  const ownerRole = await prisma.role.findUnique({
    where: { name: "Chủ cửa hàng" },
  });
  if (!ownerRole) throw new Error("Owner role not found");

  const existingOwner = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  if (!existingOwner) {
    const passwordHash = await bcrypt.hash("admin123", 12);
    await prisma.user.create({
      data: {
        username: "admin",
        passwordHash,
        fullName: "Chủ cửa hàng",
        role: { connect: { id: ownerRole.id } },
      },
    });
    console.log("✓ Created owner user: admin / admin123");
  } else {
    console.log("✓ Owner user already exists");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
