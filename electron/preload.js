/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

// Bridge exposed to the renderer as `window.electronAPI`.
// Kept intentionally narrow — only the surface the sales module needs for
// silent receipt printing.
contextBridge.exposeInMainWorld("electronAPI", {
  isAvailable: true,

  // Returns a list of installed printers from the Electron main process:
  //   [{ name, displayName, description, status, isDefault }, ...]
  listPrinters: () => ipcRenderer.invoke("list-printers"),

  /**
   * Silently print an invoice by URL. Main process opens a hidden window
   * pointed at `/vi/invoices/<id>/print?size=<size>` (same Electron session,
   * so the user's auth cookie is shared), waits for the page to finish
   * rendering its data (`window.__kioPrintReady === true`), then calls
   * webContents.print({ silent: true, deviceName }).
   *
   * Preferred over the legacy `printInvoice({ html })` path because the
   * chromeless print page is a client component — its SSR shell does NOT
   * include the invoice content; only the live DOM after data-fetch does.
   *
   * @param {{ invoiceId: string, size: "k80" | "a6", deviceName?: string }} args
   * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
   */
  printInvoiceById: (args) =>
    ipcRenderer.invoke("print-invoice-url", args),

  /**
   * Legacy: print pre-rendered HTML. Kept for custom/raw print jobs such as
   * the "In thử" button in Settings. NOT used for full invoices.
   * @param {{ html: string, size: "k80" | "a6", deviceName?: string }} args
   */
  printInvoice: (args) => ipcRenderer.invoke("print-invoice", args),

  // Optional: ping the bridge to confirm it's wired (handy for debug UI).
  ping: () => ipcRenderer.invoke("ping"),
});
