/**
 * Safely parse an error message from a Response whose body may be empty,
 * non-JSON, or a Zod fieldErrors object.
 *
 * Returns a user-facing error string — never throws.
 */
export async function parseApiError(
  res: Response,
  fallback = "Đã xảy ra lỗi"
): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return `${fallback} (HTTP ${res.status})`;

  try {
    const data = JSON.parse(text);
    if (typeof data.error === "string") return data.error;
    if (data.error && typeof data.error === "object") {
      const flat = Object.values(data.error).flat().filter(Boolean);
      if (flat.length) return flat.join(", ");
    }
    if (typeof data.message === "string") return data.message;
  } catch {
    // Non-JSON response (e.g. HTML error page)
  }
  return `${fallback} (HTTP ${res.status})`;
}
