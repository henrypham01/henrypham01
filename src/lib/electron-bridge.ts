"use client";

/**
 * Thin typed wrapper around the `window.electronAPI` bridge exposed by
 * electron/preload.js. Lets client components call silent-print features
 * when running inside Electron, and gracefully no-op in browser/dev.
 */

export type ElectronPrinter = {
  name: string;
  displayName: string;
  description: string;
  status: number | null;
  isDefault: boolean;
};

type ElectronAPI = {
  isAvailable: true;
  listPrinters: () => Promise<ElectronPrinter[]>;
  /** Print a saved invoice by id — preferred path for full invoices. */
  printInvoiceById: (args: {
    invoiceId: string;
    size: "k80" | "a6";
    deviceName?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Legacy: print raw HTML (used by "In thử" in Settings). */
  printInvoice: (args: {
    html: string;
    size: "k80" | "a6";
    deviceName?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  ping?: () => Promise<string>;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.electronAPI?.isAvailable !== "undefined"
  );
}

export function getElectron(): ElectronAPI | null {
  if (typeof window === "undefined") return null;
  return window.electronAPI ?? null;
}
