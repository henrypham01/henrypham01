export function formatVND(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("vi-VN").format(Math.round(num));
}

export function parseVND(formatted: string): number {
  return parseInt(formatted.replace(/\./g, "").replace(/,/g, ""), 10) || 0;
}

const ones = [
  "", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín",
];

const groups = ["", "nghìn", "triệu", "tỷ"];

function readThreeDigits(n: number, showZeroHundred: boolean): string {
  const hundred = Math.floor(n / 100);
  const ten = Math.floor((n % 100) / 10);
  const unit = n % 10;
  let result = "";

  if (hundred > 0) {
    result += ones[hundred] + " trăm";
  } else if (showZeroHundred) {
    result += "không trăm";
  }

  if (ten > 1) {
    result += " " + ones[ten] + " mươi";
    if (unit === 1) result += " mốt";
    else if (unit === 5) result += " lăm";
    else if (unit > 0) result += " " + ones[unit];
  } else if (ten === 1) {
    result += " mười";
    if (unit === 5) result += " lăm";
    else if (unit > 0) result += " " + ones[unit];
  } else if (unit > 0) {
    if (hundred > 0 || showZeroHundred) result += " lẻ";
    result += " " + ones[unit];
  }

  return result.trim();
}

export function amountInWords(amount: number): string {
  if (amount === 0) return "Không đồng";

  const absAmount = Math.abs(Math.round(amount));
  const str = absAmount.toString();
  const chunks: number[] = [];

  for (let i = str.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    chunks.unshift(parseInt(str.slice(start, i), 10));
  }

  const parts: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i] === 0) continue;
    const groupIndex = chunks.length - 1 - i;
    const text = readThreeDigits(chunks[i], i > 0);
    parts.push(text + (groups[groupIndex] ? " " + groups[groupIndex] : ""));
  }

  let result = parts.join(" ").replace(/\s+/g, " ").trim();
  result = result.charAt(0).toUpperCase() + result.slice(1) + " đồng";

  if (amount < 0) result = "Âm " + result;
  return result;
}
