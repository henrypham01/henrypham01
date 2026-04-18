# Building KioViet Desktop (Windows)

This project is an **offline Windows desktop app** built on Electron + Next.js + SQLite.

## Stack

- **Electron** wraps the app in a native window
- **Next.js standalone** server runs inside Electron (`fork`ed as child process)
- **SQLite** via `@prisma/adapter-better-sqlite3` — no DB server required
- DB + uploaded files live in `%APPDATA%\KioViet\` (user-writable path)

## One-time dev setup (any OS)

```bash
npm install
npm run db:push        # Apply schema to prisma/dev.db
npm run db:seed        # Seed units/categories/settings
npm run db:seed:users  # Seed roles + admin/admin123
```

## Dev workflow

```bash
# Pure web dev (no Electron)
npm run dev

# Electron shell + Next dev server
npm run electron:dev
```

Default login: `admin` / `admin123`

## Building the Windows installer (.exe)

**Recommended**: run on a Windows machine (or Windows CI like GitHub Actions).

```bash
npm run electron:build:win
```

This command:
1. `db:template` — builds `resources/template.db` pre-seeded with roles + admin user
2. `next build` — produces `.next/standalone/` + `.next/static/`
3. `electron-builder --win --x64` — packages into `dist/KioViet Setup X.X.X.exe` (NSIS installer)

### Output

- `dist/KioViet Setup 0.1.0.exe` — NSIS installer (user picks install dir, creates shortcuts)
- Install target: `C:\Program Files\KioViet\` (default)
- Data dir (runtime): `%APPDATA%\KioViet\`
  - `kioviet.db` (SQLite DB, copied from `template.db` on first run)
  - `uploads/products/` (uploaded product images)

## Cross-compiling from macOS / Linux

`better-sqlite3` ships a **native binary** — building for Windows from macOS requires prebuilt binaries. If it fails, use:
- A Windows machine, or
- GitHub Actions with `runs-on: windows-latest` (free for public repos)

## Architecture notes

- **Electron main** (`electron/main.js`):
  1. Sets `DATABASE_URL=file:<userData>/kioviet.db`, `UPLOAD_DIR=<userData>/uploads`
  2. Copies `template.db` → userData on first launch
  3. `fork()`s `.next/standalone/server.js` on `127.0.0.1:3000`
  4. Waits for the server (via `wait-on`), then loads it into a BrowserWindow

- **Uploads** served via `/api/uploads/[...path]` route that reads from `UPLOAD_DIR`

- **Prisma Client** is pre-generated to `src/generated/prisma/` and bundled via `outputFileTracingIncludes` in `next.config.ts`. `better-sqlite3.node` is unpacked from asar for native loading.

## Resetting the admin password

```bash
npx tsx prisma/reset-admin.ts
```

## Uninstalling

Control Panel → Programs & Features → KioViet → Uninstall

> The installer removes `C:\Program Files\KioViet\` but **keeps** `%APPDATA%\KioViet\` (your data). Delete that folder manually if you want a clean wipe.
