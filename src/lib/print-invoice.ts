"use client";

import { getElectron } from "./electron-bridge";

/**
 * Trigger printing of an invoice.
 *
 * Flow:
 * 1. If running in Electron — IPC the main process with `invoiceId + size`.
 *    Main opens a hidden BrowserWindow on the chromeless /print route
 *    (sharing the main window's session so the user's auth cookie is
 *    available), waits for the page to signal `__kioPrintReady`, then
 *    silently prints to the configured deviceName.
 * 2. Otherwise — open the chromeless print URL in a new tab with `?auto=1`
 *    so the page fetches data and invokes `window.print()` itself, showing
 *    the browser's native print dialog.
 *
 * Correctness note: we CANNOT fetch the print URL and send its HTML to
 * Electron — the print page is "use client" so the server-rendered shell
 * has no invoice data in it, and that's what would get printed. The hidden
 * BrowserWindow must load the URL itself to execute the client-side fetch.
 *
 * @param id    invoice id
 * @param size  paper size, default "k80"
 * @returns `true` when the print job was dispatched; `false` when the user
 *          is not in Electron and popups are blocked.
 */
export async function printInvoice(
  id: string,
  size: "k80" | "a6" = "k80",
  opts: { locale?: string } = {}
): Promise<boolean> {
  const locale = opts.locale || "vi";
  const printUrl = `/${locale}/invoices/${id}/print?size=${size}`;

  const api = getElectron();

  if (api) {
    try {
      const r = await api.printInvoiceById({ invoiceId: id, size });
      if (!r.ok) throw new Error(r.error);
      return true;
    } catch (err) {
      console.error("Electron silent print failed:", err);
      // fall through to browser fallback
    }
  }

  // Browser fallback: open the chromeless print route in a new tab; page
  // will auto-invoke window.print() once loaded.
  const w = window.open(`${printUrl}&auto=1`, "_blank", "noopener");
  return !!w;
}
