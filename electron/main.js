/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");

const isDev = !app.isPackaged;
const PORT = process.env.PORT || "3000";
const HOSTNAME = "127.0.0.1";

let mainWindow;
let nextServer;

/**
 * Prepare writable data paths for the packaged app.
 * In Program Files, the install dir is read-only on Windows, so DB + uploads
 * must live under app.getPath('userData').
 *
 * On first launch, copy the bundled template.db into userData.
 */
function setupUserData() {
  const userData = app.getPath("userData");
  const dbPath = path.join(userData, "kioviet.db");
  const uploadDir = path.join(userData, "uploads");

  console.log(`[kioviet] User data path: ${userData}`);
  console.log(`[kioviet] Database path: ${dbPath}`);

  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true });
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  if (!fs.existsSync(dbPath)) {
    const templatePath = isDev
      ? path.join(__dirname, "..", "resources", "template.db")
      : path.join(process.resourcesPath, "template.db");
    
    console.log(`[kioviet] Looking for template at: ${templatePath}`);
    console.log(`[kioviet] Resources path: ${process.resourcesPath}`);
    console.log(`[kioviet] Template exists: ${fs.existsSync(templatePath)}`);
    
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, dbPath);
      console.log(`[kioviet] ✓ Copied template DB → ${dbPath}`);
    } else {
      console.error(`[kioviet] ✗ Template DB not found: ${templatePath}`);
    }
  } else {
    console.log(`[kioviet] Database already exists: ${dbPath}`);
  }

  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.UPLOAD_DIR = uploadDir;
  process.env.NODE_ENV = "production";
  process.env.PORT = PORT;
  process.env.HOSTNAME = HOSTNAME;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "thu-phap-cosmetic-dev-secret-change-in-production-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456";
  console.log(`[kioviet] Set DATABASE_URL=${process.env.DATABASE_URL}`);
}

function startNextServer() {
  // In packaged app, standalone server is bundled under resources/app.
  // In dev, we expect `next dev` to be running externally (via electron:dev script).
  if (isDev) {
    console.log("[kioviet] Development mode - skipping server start");
    return;
  }

  const serverJs = path.join(
    process.resourcesPath,
    "app",
    ".next",
    "standalone",
    "server.js"
  );

  console.log(`[kioviet] Starting Next.js server...`);
  console.log(`[kioviet] Server path: ${serverJs}`);
  console.log(`[kioviet] Server exists: ${fs.existsSync(serverJs)}`);

  if (!fs.existsSync(serverJs)) {
    console.error(`[kioviet] ✗ Standalone server not found: ${serverJs}`);
    return;
  }

  // Use fork so the child runs in a Node.js process (Electron provides node runtime)
  nextServer = fork(serverJs, [], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],  // Capture stdout/stderr
    cwd: path.dirname(serverJs),
  });

  // Capture server output
  if (nextServer.stdout) {
    nextServer.stdout.on("data", (data) => {
      console.log(`[server] ${data}`);
    });
  }
  if (nextServer.stderr) {
    nextServer.stderr.on("data", (data) => {
      console.error(`[server-err] ${data}`);
    });
  }

  console.log(`[kioviet] ✓ Server process started (PID: ${nextServer.pid})`);

  nextServer.on("exit", (code, signal) => {
    console.log(`[kioviet] Server exited (code=${code}, signal=${signal})`);
  });
  nextServer.on("error", (err) => {
    console.error(`[kioviet] Server error: ${err.message}`);
  });
}

// ─── Printing helpers ─────────────────────────────────────────────────────

/**
 * Fetch a single setting value via the Next.js API. We keep the main process
 * free of DB deps — the renderer's cookies aren't available here so we call
 * with a fresh request against localhost and rely on the settings endpoint
 * being auth-gated; during silent print the renderer window is already
 * authenticated and calls printInvoice from there, so we instead pass the
 * deviceName in from the renderer side.
 *
 * NOTE: We read settings by asking the renderer (printSettings is loaded in
 * the calling page). This helper is kept for future use.
 */
async function fetchSetting(key) {
  try {
    const res = await fetch(
      `http://${HOSTNAME}:${PORT}/api/settings?key=${encodeURIComponent(key)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data && data[key]) || null;
  } catch {
    return null;
  }
}

function getPrinters() {
  if (!mainWindow) return [];
  try {
    // Electron ≥ 18: getPrintersAsync on webContents
    const wc = mainWindow.webContents;
    if (typeof wc.getPrintersAsync === "function") {
      return wc.getPrintersAsync();
    }
    // Older fallback
    if (typeof wc.getPrinters === "function") {
      return Promise.resolve(wc.getPrinters());
    }
  } catch (err) {
    console.error("[kioviet] getPrinters failed:", err);
  }
  return Promise.resolve([]);
}

/**
 * Render `html` on a hidden off-screen window then print to `deviceName`.
 *
 * @param {string} html — complete HTML document (<html>...</html>)
 * @param {string} deviceName — printer name from getPrinters(); empty string
 *   falls back to the system default printer.
 * @param {"k80" | "a6"} size
 */
async function renderAndPrint(html, deviceName, size) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const cleanup = () => {
      try {
        win.close();
      } catch {}
    };

    // Encode HTML as a data URL so we don't write a temp file. Electron
    // caps data URLs at ~2MB — plenty for a receipt.
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

    win.webContents.once("did-finish-load", () => {
      // Paper size configuration. Electron expects dimensions in microns
      // (1mm = 1000 microns). K80 = 80mm wide × auto height — approximated
      // with a long page so the thermal printer cuts at its own mark.
      const pageSize =
        size === "k80"
          ? { width: 80_000, height: 297_000 } // 80 × 297 mm
          : "A6";

      win.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: deviceName || undefined,
          margins: { marginType: "none" },
          pageSize,
          copies: 1,
        },
        (success, reason) => {
          cleanup();
          if (success) {
            resolve({ ok: true });
          } else {
            reject(new Error(reason || "print failed"));
          }
        }
      );
    });

    win.webContents.once(
      "did-fail-load",
      (_e, _errorCode, errorDescription) => {
        cleanup();
        reject(new Error(`load failed: ${errorDescription}`));
      }
    );

    win.loadURL(dataUrl).catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

function registerIpcHandlers() {
  ipcMain.handle("ping", () => "pong");

  ipcMain.handle("list-printers", async () => {
    try {
      const list = await getPrinters();
      // Normalize shape so the renderer always sees { name, displayName, isDefault }
      return list.map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description || "",
        status: p.status ?? null,
        isDefault: !!p.isDefault,
      }));
    } catch (err) {
      console.error("[kioviet] list-printers failed:", err);
      return [];
    }
  });

  ipcMain.handle("print-invoice", async (_event, args) => {
    try {
      if (!args || typeof args.html !== "string") {
        return { ok: false, error: "Missing html" };
      }
      const size = args.size === "a6" ? "a6" : "k80";

      // Which printer? Try the size-specific one from settings; fall back to
      // the other; finally fall back to the system default.
      let deviceName = args.deviceName || "";
      if (!deviceName) {
        const keyPrimary =
          size === "k80" ? "print_k80_printer" : "print_a6_printer";
        const primary = await fetchSetting(keyPrimary);
        if (primary) deviceName = primary;
      }

      await renderAndPrint(args.html, deviceName, size);
      return { ok: true };
    } catch (err) {
      console.error("[kioviet] print-invoice failed:", err);
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  /**
   * Print an invoice by id. Opens the chromeless /print route in a hidden
   * window (same session, so auth cookie is shared), waits for the page to
   * finish rendering data, then silently prints.
   */
  ipcMain.handle("print-invoice-url", async (_event, args) => {
    try {
      if (!args || typeof args.invoiceId !== "string") {
        return { ok: false, error: "Missing invoiceId" };
      }
      const size = args.size === "a6" ? "a6" : "k80";

      // Resolve printer device name from settings when not explicitly given.
      let deviceName = args.deviceName || "";
      if (!deviceName) {
        const keyPrimary =
          size === "k80" ? "print_k80_printer" : "print_a6_printer";
        const primary = await fetchSetting(keyPrimary);
        if (primary) deviceName = primary;
      }

      const url = `http://${HOSTNAME}:${PORT}/vi/invoices/${encodeURIComponent(
        args.invoiceId
      )}/print?size=${size}`;

      await new Promise((resolve, reject) => {
        // Share session so the auth cookie set on the main window is
        // available inside the print window.
        const win = new BrowserWindow({
          show: false,
          webPreferences: {
            session: mainWindow && mainWindow.webContents.session,
            partition: undefined,
            contextIsolation: true,
            nodeIntegration: false,
          },
        });

        const cleanup = () => {
          try {
            win.close();
          } catch {}
        };

        win.webContents.once("did-finish-load", async () => {
          try {
            // Wait until the React page signals it has the data rendered.
            // The print page sets `window.__kioPrintReady = true` after
            // fetch+paint. 10s cap prevents hanging on unexpected errors.
            await win.webContents.executeJavaScript(
              `new Promise((resolve, reject) => {
                 const deadline = Date.now() + 10000;
                 const poll = () => {
                   if (window.__kioPrintReady) return resolve(true);
                   if (Date.now() > deadline) return reject(new Error('print-ready timeout'));
                   setTimeout(poll, 80);
                 };
                 poll();
               })`
            );
          } catch (err) {
            cleanup();
            return reject(err);
          }

          const pageSize =
            size === "k80"
              ? { width: 80_000, height: 297_000 }
              : "A6";

          win.webContents.print(
            {
              silent: true,
              printBackground: true,
              deviceName: deviceName || undefined,
              margins: { marginType: "none" },
              pageSize,
              copies: 1,
            },
            (success, reason) => {
              cleanup();
              if (success) resolve();
              else reject(new Error(reason || "print failed"));
            }
          );
        });

        win.webContents.once("did-fail-load", (_e, _code, description) => {
          cleanup();
          reject(new Error(`load failed: ${description}`));
        });

        win.loadURL(url).catch((err) => {
          cleanup();
          reject(err);
        });
      });

      return { ok: true };
    } catch (err) {
      console.error("[kioviet] print-invoice-url failed:", err);
      return { ok: false, error: String((err && err.message) || err) };
    }
  });
}

// ─── Window lifecycle ─────────────────────────────────────────────────────

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Expose the electronAPI bridge (list/print) to the renderer.
      preload: path.join(__dirname, "preload.js"),
    },
    title: "KioViet - Phần mềm kế toán",
    autoHideMenuBar: true,
  });

  // Wait for the server to accept connections
  const waitForServer = async (maxRetries = 120, interval = 1000) => {
    console.log(`[kioviet] Waiting for server at http://${HOSTNAME}:${PORT}...`);
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`http://${HOSTNAME}:${PORT}/`, {
          method: "GET",
          timeout: 5000,
        });
        console.log(`[kioviet] Server is ready (attempt ${i + 1})`);
        return true;
      } catch (err) {
        if (i % 10 === 0) {
          console.log(`[kioviet] Waiting for server... (${i}/${maxRetries}) - ${i * interval / 1000}s`);
        }
        if (i === maxRetries - 1) {
          console.error(`[kioviet] Server did not start after ${maxRetries * interval / 1000}s`);
          const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
    h1 { color: #d32f2f; }
    .error-box { background: #ffebee; border: 1px solid #d32f2f; padding: 15px; border-radius: 5px; }
    .tips { margin-top: 20px; }
    ul { margin: 10px 0; }
    li { margin: 5px 0; }
    .code { background: #f5f5f5; padding: 2px 6px; font-family: monospace; }
  </style>
</head>
<body>
  <h1>Lỗi - Server không khởi động được</h1>
  <div class="error-box">
    <p>Ứng dụng không thể kết nối tới server sau ${maxRetries * interval / 1000}s.</p>
  </div>
  <div class="tips">
    <h2>Hãy kiểm tra:</h2>
    <ul>
      <li>Port <span class="code">3000</span> có bị một ứng dụng khác sử dụng không?</li>
      <li>Thư mục cài đặt có quyền truy cập không?</li>
      <li>Database cấu hình có chính xác không?</li>
    </ul>
    <h2>Cách khắc phục:</h2>
    <ul>
      <li>Đóng các ứng dụng khác đang sử dụng port 3000</li>
      <li>Gỡ cài đặt hoàn toàn rồi cài lại</li>
      <li>Chạy lại ứng dụng</li>
    </ul>
  </div>
</body>
</html>
          `;
          mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
          return false;
        }
        await new Promise((r) => setTimeout(r, interval));
      }
    }
    return false;
  };

  const serverReady = await waitForServer();
  
  if (serverReady) {
    mainWindow.loadURL(`http://${HOSTNAME}:${PORT}/vi`);
  }
  
  // Add 2s delay before showing to ensure UI renders
  await new Promise(r => setTimeout(r, 2000));

  if (isDev) mainWindow.webContents.openDevTools();

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (!url.startsWith(`http://${HOSTNAME}`)) {
        shell.openExternal(url);
        return { action: "deny" };
      }
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  console.log("[kioviet] App ready - initializing...");
  setupUserData();
  console.log("[kioviet] User data setup complete");
  startNextServer();
  console.log("[kioviet] Server startup initiated");
  registerIpcHandlers();
  console.log("[kioviet] IPC handlers registered");
  await createWindow();
  console.log("[kioviet] Window created");
});

app.on("window-all-closed", () => {
  if (nextServer) {
    try {
      nextServer.kill();
    } catch {}
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

app.on("before-quit", () => {
  if (nextServer) {
    try {
      nextServer.kill();
    } catch {}
  }
});
