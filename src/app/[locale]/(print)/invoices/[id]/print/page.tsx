"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { formatVND, amountInWords } from "@/lib/formatting";

type Invoice = {
  id: string;
  documentNumber: string;
  issueDate: string;
  notes: string | null;
  subtotal: string;
  discountAmount: string;
  vatAmount: string;
  shippingFee: string;
  totalAmount: string;
  paidAmount: string;
  customer: { id: string; name: string; code: string; phone: string | null };
  lineItems: {
    id: string;
    quantity: string;
    unitPrice: string;
    discountPercent: string;
    vatRate: string;
    lineTotal: string;
    product: { id: string; sku: string; name: string };
  }[];
};

type Settings = Record<string, string>;

type Size = "k80" | "a6";

// Paper sizes for @page CSS. K80 is 80mm thermal receipt, A6 is a small label.
// "auto" height lets the printer feed exactly as much paper as the content
// needs — critical for continuous thermal rolls.
const SIZE_CSS: Record<Size, string> = {
  k80: "80mm auto",
  a6: "A6",
};

export default function InvoicePrintPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const sizeParam = searchParams.get("size") === "a6" ? "a6" : "k80";
  const autoStart = searchParams.get("auto") === "1";
  const size: Size = sizeParam;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [error, setError] = useState<string | null>(null);

  // Fetch invoice + settings in parallel
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [iRes, sRes] = await Promise.all([
          fetch(`/api/invoices/${id}`, { credentials: "include" }),
          fetch(`/api/settings`, { credentials: "include" }),
        ]);
        if (cancelled) return;
        if (!iRes.ok) {
          setError("Không tải được hoá đơn");
          return;
        }
        setInvoice(await iRes.json());
        if (sRes.ok) setSettings(await sRes.json());
      } catch {
        if (!cancelled) setError("Không tải được hoá đơn");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Mark the page as render-ready once the invoice data is in the DOM.
  // The Electron main process polls for this flag before calling
  // webContents.print() so it doesn't capture an empty React shell.
  useEffect(() => {
    if (!invoice) return;
    // Give React a frame to commit the DOM before flipping the flag.
    const t = setTimeout(() => {
      (window as typeof window & { __kioPrintReady?: boolean }).__kioPrintReady =
        true;
    }, 100);
    return () => clearTimeout(t);
  }, [invoice]);

  // Browser fallback: when the URL has ?auto=1 and we're NOT in Electron,
  // trigger the native print dialog from the page itself. In Electron the
  // main process drives printing — the page just needs to be ready.
  useEffect(() => {
    if (!invoice || !autoStart) return;
    if (typeof window !== "undefined" && window.electronAPI) return;

    const t = setTimeout(() => {
      window.print();
    }, 250);
    return () => clearTimeout(t);
  }, [invoice, autoStart]);

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">{error}</div>
    );
  }
  if (!invoice) {
    return (
      <div className="p-8 text-center text-gray-500">Đang tải hoá đơn...</div>
    );
  }

  const company = {
    name: settings.company_name || "",
    address: settings.company_address || "",
    phone: settings.company_phone || "",
    taxId: settings.company_tax_id || "",
  };
  const footer =
    settings.print_footer_message || "Cảm ơn Quý khách và hẹn gặp lại!";

  // K80 (80mm thermal) layout — narrow, single column, monospace-ish
  if (size === "k80") {
    return (
      <>
        <style jsx global>{`
          @page {
            size: ${SIZE_CSS.k80};
            margin: 3mm;
          }
          @media print {
            html,
            body {
              background: white !important;
            }
          }
        `}</style>
        <div
          className="mx-auto bg-white text-black"
          style={{
            width: "74mm",
            fontSize: "11px",
            lineHeight: 1.35,
            fontFamily:
              "'Helvetica Neue', Arial, 'Liberation Sans', sans-serif",
          }}
        >
          {/* Header */}
          <div className="text-center">
            <img
              src="/logo.png"
              alt=""
              style={{
                width: 48,
                height: 48,
                objectFit: "contain",
                margin: "0 auto 2px",
              }}
            />
            {company.name && (
              <div className="font-bold uppercase" style={{ fontSize: "13px" }}>
                {company.name}
              </div>
            )}
            {company.address && <div>{company.address}</div>}
            {(company.phone || company.taxId) && (
              <div>
                {company.phone && <>ĐT: {company.phone}</>}
                {company.phone && company.taxId && " · "}
                {company.taxId && <>MST: {company.taxId}</>}
              </div>
            )}
          </div>

          <div
            className="my-1.5 border-t border-dashed border-black"
            style={{ marginTop: 6, marginBottom: 6 }}
          />

          <div className="text-center">
            <div
              className="font-bold uppercase"
              style={{ fontSize: "14px", letterSpacing: "0.5px" }}
            >
              Hoá đơn bán hàng
            </div>
            <div>Số: {invoice.documentNumber}</div>
            <div>
              {format(new Date(invoice.issueDate), "dd/MM/yyyy HH:mm")}
            </div>
          </div>

          <div
            className="my-1.5 border-t border-dashed border-black"
            style={{ marginTop: 6, marginBottom: 6 }}
          />

          <div>
            <div>
              <b>KH:</b> {invoice.customer?.name || "Khách lẻ"}
            </div>
            {invoice.customer?.phone && <div>SĐT: {invoice.customer.phone}</div>}
          </div>

          <div
            className="my-1.5 border-t border-dashed border-black"
            style={{ marginTop: 6, marginBottom: 6 }}
          />

          {/* Items — compact table */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px dashed black" }}>
                <th
                  className="text-left"
                  style={{ padding: "2px 0", fontSize: "10px" }}
                >
                  Tên hàng
                </th>
                <th
                  className="text-right"
                  style={{
                    padding: "2px 0",
                    fontSize: "10px",
                    width: "24mm",
                  }}
                >
                  T.Tiền
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((li, idx) => (
                <tr key={li.id}>
                  <td colSpan={2} style={{ paddingTop: idx === 0 ? 3 : 4 }}>
                    <div className="font-medium">{li.product.name}</div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "10.5px",
                      }}
                    >
                      <span>
                        {Number(li.quantity).toLocaleString("vi-VN")} ×{" "}
                        {formatVND(li.unitPrice)}
                      </span>
                      <span>{formatVND(li.lineTotal)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            className="my-1.5 border-t border-dashed border-black"
            style={{ marginTop: 6, marginBottom: 6 }}
          />

          {/* Totals */}
          <div style={{ display: "grid", rowGap: 2 }}>
            <Row
              label="Tổng tiền hàng"
              value={formatVND(invoice.subtotal)}
            />
            {Number(invoice.discountAmount) > 0 && (
              <Row
                label="Chiết khấu"
                value={`- ${formatVND(invoice.discountAmount)}`}
              />
            )}
            {Number(invoice.vatAmount) > 0 && (
              <Row label="Thuế GTGT" value={formatVND(invoice.vatAmount)} />
            )}
            {Number(invoice.shippingFee) > 0 && (
              <Row label="Phí ship" value={formatVND(invoice.shippingFee)} />
            )}
            <div
              style={{
                borderTop: "1px dashed black",
                marginTop: 3,
                paddingTop: 3,
              }}
            >
              <Row
                label="TỔNG THANH TOÁN"
                value={formatVND(invoice.totalAmount)}
                bold
                large
              />
            </div>
            <div style={{ fontSize: "10.5px", fontStyle: "italic" }}>
              {amountInWords(Number(invoice.totalAmount))}
            </div>
          </div>

          <div
            className="my-1.5 border-t border-dashed border-black"
            style={{ marginTop: 6, marginBottom: 6 }}
          />

          {/* Footer */}
          <div className="text-center" style={{ fontSize: "10.5px" }}>
            <div style={{ fontStyle: "italic" }}>
              Quý khách kiểm tra hàng trước khi thanh toán!
            </div>
            <div style={{ fontStyle: "italic", marginTop: 3 }}>{footer}</div>
          </div>
        </div>
      </>
    );
  }

  // A6 layout — wider, two-column addressable, shows item table like a mini
  // invoice (no stamp area).
  return (
    <>
      <style jsx global>{`
        @page {
          size: ${SIZE_CSS.a6};
          margin: 6mm;
        }
        @media print {
          html,
          body {
            background: white !important;
          }
        }
      `}</style>
      <div
        className="mx-auto bg-white text-black"
        style={{
          width: "93mm",
          fontSize: "10.5px",
          lineHeight: 1.35,
          fontFamily:
            "'Helvetica Neue', Arial, 'Liberation Sans', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <img
            src="/logo.png"
            alt=""
            style={{
              width: 36,
              height: 36,
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            {company.name && (
              <div
                className="font-bold uppercase"
                style={{ fontSize: "13px" }}
              >
                {company.name}
              </div>
            )}
            {company.address && (
              <div style={{ fontSize: "9.5px" }}>{company.address}</div>
            )}
            {(company.phone || company.taxId) && (
              <div style={{ fontSize: "9.5px" }}>
                {company.phone && <>ĐT: {company.phone}</>}
                {company.phone && company.taxId && " · "}
                {company.taxId && <>MST: {company.taxId}</>}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 5,
            marginBottom: 5,
            borderTop: "1px solid black",
          }}
        />

        <div className="text-center">
          <div
            className="font-bold uppercase"
            style={{ fontSize: "15px", letterSpacing: "0.5px" }}
          >
            Hoá đơn bán hàng
          </div>
          <div style={{ fontSize: "10px" }}>
            Số: <b>{invoice.documentNumber}</b>
            {"  ·  "}
            {format(new Date(invoice.issueDate), "dd/MM/yyyy HH:mm")}
          </div>
        </div>

        <div style={{ marginTop: 5 }}>
          <div>
            <b>Khách hàng:</b> {invoice.customer?.name || "Khách lẻ"}
            {invoice.customer?.phone ? `  ·  SĐT: ${invoice.customer.phone}` : ""}
          </div>
        </div>

        {/* Items table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 5,
            fontSize: "10px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid black", borderTop: "1px solid black" }}>
              <th style={cellTh}>#</th>
              <th style={{ ...cellTh, textAlign: "left" }}>Tên hàng</th>
              <th style={{ ...cellTh, textAlign: "right" }}>SL</th>
              <th style={{ ...cellTh, textAlign: "right" }}>Đơn giá</th>
              <th style={{ ...cellTh, textAlign: "right" }}>T.Tiền</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((li, idx) => (
              <tr key={li.id}>
                <td style={cellTd}>{idx + 1}</td>
                <td style={{ ...cellTd, textAlign: "left" }}>
                  {li.product.name}
                </td>
                <td style={{ ...cellTd, textAlign: "right" }}>
                  {Number(li.quantity).toLocaleString("vi-VN")}
                </td>
                <td style={{ ...cellTd, textAlign: "right" }}>
                  {formatVND(li.unitPrice)}
                </td>
                <td style={{ ...cellTd, textAlign: "right" }}>
                  {formatVND(li.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals block aligned right */}
        <div style={{ marginTop: 6, display: "grid", rowGap: 1 }}>
          <Row label="Tổng tiền hàng" value={formatVND(invoice.subtotal)} />
          {Number(invoice.discountAmount) > 0 && (
            <Row
              label="Chiết khấu"
              value={`- ${formatVND(invoice.discountAmount)}`}
            />
          )}
          {Number(invoice.vatAmount) > 0 && (
            <Row label="Thuế GTGT" value={formatVND(invoice.vatAmount)} />
          )}
          {Number(invoice.shippingFee) > 0 && (
            <Row label="Phí ship" value={formatVND(invoice.shippingFee)} />
          )}
          <div
            style={{
              borderTop: "1px solid black",
              marginTop: 3,
              paddingTop: 3,
            }}
          >
            <Row
              label="TỔNG THANH TOÁN"
              value={formatVND(invoice.totalAmount)}
              bold
              large
            />
          </div>
          <div style={{ fontSize: "9.5px", fontStyle: "italic" }}>
            {amountInWords(Number(invoice.totalAmount))}
          </div>
        </div>

        {/* Signatures area */}
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            textAlign: "center",
            fontSize: "10px",
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>Người mua hàng</div>
            <div style={{ fontStyle: "italic", fontSize: "9px" }}>
              (Ký, ghi rõ họ tên)
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Người bán hàng</div>
            <div style={{ fontStyle: "italic", fontSize: "9px" }}>
              (Ký, ghi rõ họ tên)
            </div>
          </div>
        </div>

        <div
          className="text-center"
          style={{ marginTop: 8, fontStyle: "italic", fontSize: "9.5px" }}
        >
          {footer}
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  bold,
  large,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontWeight: bold ? 700 : 400,
        fontSize: large ? "13px" : undefined,
      }}
    >
      <span>{label}:</span>
      <span>{value}</span>
    </div>
  );
}

const cellTh: React.CSSProperties = {
  padding: "2px 3px",
  fontWeight: 600,
  textAlign: "center",
};
const cellTd: React.CSSProperties = {
  padding: "2px 3px",
  verticalAlign: "top",
};
