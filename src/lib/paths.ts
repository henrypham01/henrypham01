import path from "path";

/**
 * Returns the directory for saving uploaded product images.
 *
 * - In packaged Electron: set by main.js → `<userData>/uploads/products`
 * - In dev/web mode: falls back to `public/uploads/products` in project
 */
export function getUploadDir(): string {
  if (process.env.UPLOAD_DIR) {
    return path.join(process.env.UPLOAD_DIR, "products");
  }
  return path.join(process.cwd(), "public", "uploads", "products");
}
