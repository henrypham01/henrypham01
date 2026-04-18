export const VAT_RATES = [
  { value: "0", label: "0%" },
  { value: "0.05", label: "5%" },
  { value: "0.08", label: "8%" },
  { value: "0.10", label: "10%" },
];

export const DOCUMENT_PREFIXES = {
  QUOTATION: "BG",
  SALES_ORDER: "DH",
  INVOICE: "HD",
  DELIVERY_NOTE: "PXK",
  PAYMENT: "PT",
} as const;
