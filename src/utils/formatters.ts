export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

/**
 * Formats a number with Vietnamese numbering standard:
 * - Thousands separator: '.'
 * - Decimal separator: ','
 * - Strips trailing zeros after comma if clean
 */
export function formatVietnameseNumber(
  val: number | undefined | null,
  decimals: number = 0,
  fallback: string = '0'
): string {
  if (val === undefined || val === null || isNaN(val)) return fallback;
  const maxDec = Math.max(0, decimals);
  const fixedStr = Math.abs(val).toFixed(maxDec);
  const parts = fixedStr.split('.');
  const intFormatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decFormatted = parts[1] ? parts[1].replace(/0+$/, '') : '';
  const sign = val < 0 ? '-' : '';

  if (decFormatted && decFormatted.length > 0) {
    return `${sign}${intFormatted},${decFormatted}`;
  }
  return `${sign}${intFormatted}` || fallback;
}

/**
 * Parses user input in Vietnamese format ("1.000.000", "1.250,5", "10,5")
 * or standard format into a JavaScript number.
 */
export function parseVietnameseNumber(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 0;
  if (typeof input === 'number') return isNaN(input) ? 0 : input;
  let s = String(input).trim();
  if (!s) return 0;

  // Handle both Vietnamese format ("1.234.567,89") and raw numbers ("1234567.89")
  if (s.includes(',')) {
    // Has comma -> comma is decimal separator, dots are thousand separators
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // No comma. Check dots:
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Multiple dots -> dots are thousand separators
      s = s.replace(/\./g, '');
    } else if (dotCount === 1) {
      // Single dot: e.g. "1.000" (thousand) vs "1.5" (decimal)
      const parts = s.split('.');
      if (parts[1].length === 3 && parts[0].length >= 1) {
        // e.g. 1.000 or 50.000 -> thousand separator
        s = s.replace(/\./g, '');
      }
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function formatNumber(
  val: number | undefined | null,
  decimals: number = 0,
  fallback: string = '0'
): string {
  if (val === undefined || val === null || isNaN(val)) return fallback;
  return formatVietnameseNumber(val, decimals, fallback);
}

/**
 * Rounds a price value according to decimal configuration.
 * Negative numbers round to powers of 10:
 * -2: làm tròn đến hàng chục (VD: 5.743,83 -> 5.740, 5.791,5 -> 5.790)
 * -1: làm tròn đến hàng chục (10)
 * -3: làm tròn đến hàng trăm (100) (VD: 5.743,83 -> 5.700)
 * -4: làm tròn đến hàng nghìn (1.000) (VD: 5.743,83 -> 6.000)
 * 0: làm tròn đến số nguyên (hàng đơn vị)
 * > 0: làm tròn đến số chữ số thập phân tương ứng (VD: 2 -> 5.743,83)
 */
export function roundPrice(val: number | undefined | null, decimals: number = 0): number {
  if (val === undefined || val === null || isNaN(val)) return 0;
  if (decimals === -2 || decimals === -1) {
    return Math.round(val / 10) * 10;
  }
  if (decimals === -3) {
    return Math.round(val / 100) * 100;
  }
  if (decimals === -4) {
    return Math.round(val / 1000) * 1000;
  }
  if (decimals <= 0) {
    return Math.round(val);
  }
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function formatPrecise(val: number | undefined | null, decimals: number = 10): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return formatVietnameseNumber(val, decimals);
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}
