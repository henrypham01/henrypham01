// Minimal chromeless layout for receipt / invoice print pages.
// Intentionally has NO sidebar, header, or app shell — the page fills the
// whole viewport so that Electron's silent print and the browser print
// preview capture only the receipt itself.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-white text-black">{children}</div>;
}
