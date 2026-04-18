import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const username = "admin";
  const newPassword = "admin123";

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const ownerRole = await prisma.role.findUnique({
    where: { name: "Chủ cửa hàng" },
  });
  if (!ownerRole) throw new Error("Owner role not found. Run db:seed first.");

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      passwordHash,
      isActive: true,
      isDeleted: false,
      failedAttempts: 0,
      lockedUntil: null,
    },
    create: {
      username,
      passwordHash,
      fullName: "Chủ cửa hàng",
      role: { connect: { id: ownerRole.id } },
    },
  });

  console.log(`✓ Reset password for user: ${user.username}`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${newPassword}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
