/**
 * Build a pre-seeded SQLite template database that will be bundled
 * with the Electron app and copied to the user's data directory on first run.
 *
 * Output: resources/template.db
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const RESOURCES = path.join(ROOT, "resources");
const TEMPLATE = path.join(RESOURCES, "template.db");

function run(cmd: string, env: Record<string, string>) {
  console.log(`→ ${cmd}`);
  execSync(cmd, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
}

async function main() {
  if (!fs.existsSync(RESOURCES)) fs.mkdirSync(RESOURCES, { recursive: true });
  if (fs.existsSync(TEMPLATE)) fs.unlinkSync(TEMPLATE);

  // Use an absolute path so that Prisma tooling and seed scripts agree
  const dbUrl = `file:${TEMPLATE}`;

  run("npx prisma db push --accept-data-loss", {
    DATABASE_URL: dbUrl,
  });
  run("npx tsx prisma/seed.ts", { DATABASE_URL: dbUrl });
  run("npx tsx prisma/seed-users.ts", { DATABASE_URL: dbUrl });

  const size = fs.statSync(TEMPLATE).size;
  console.log(`\n✓ Template DB written: ${TEMPLATE} (${(size / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
