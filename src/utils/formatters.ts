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

export function formatDate(dateStr: string | number | Date | undefined | null): string {
  if (!dateStr) return '';
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTime(dateStr: string | number | Date | undefined | null): string {
  if (!dateStr) return '';
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

export function formatPaymentMethod(method?: string | null): string {
  if (method === 'cash') return 'Tiền mặt';
  if (method === 'transfer') return 'Chuyển khoản';
  if (method === 'card') return 'Thẻ';
  if (method === 'debt_offset') return 'Cấn trừ công nợ';
  return method ? String(method) : 'Tiền mặt';
}

export function parsePaymentMethod(raw?: string | null): 'cash' | 'transfer' | 'card' | 'debt_offset' {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'cash';
  if (s.includes('cấn trừ') || s.includes('công nợ') || s.includes('debt_offset') || s.includes('offset')) {
    return 'debt_offset';
  }
  if (s.includes('chuyển') || s.includes('transfer') || s.includes('ck')) {
    return 'transfer';
  }
  if (s.includes('thẻ') || s.includes('card')) {
    return 'card';
  }
  return 'cash';
}

const VIET_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const VIET_SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readThreeDigitBlock(num: number, readFullHundreds: boolean): string {
  const hundreds = Math.floor(num / 100);
  const tens = Math.floor((num % 100) / 10);
  const units = num % 10;
  const parts: string[] = [];

  if (hundreds > 0 || readFullHundreds) {
    parts.push(`${VIET_DIGITS[hundreds]} trăm`);
    if (tens === 0 && units > 0) {
      parts.push('linh');
    }
  }

  if (tens > 1) {
    parts.push(`${VIET_DIGITS[tens]} mươi`);
    if (units === 1) {
      parts.push('mốt');
    } else if (units === 4) {
      parts.push('tư');
    } else if (units === 5) {
      parts.push('lăm');
    } else if (units > 0) {
      parts.push(VIET_DIGITS[units]);
    }
  } else if (tens === 1) {
    parts.push('mười');
    if (units === 5) {
      parts.push('lăm');
    } else if (units > 0) {
      parts.push(VIET_DIGITS[units]);
    }
  } else if (units > 0) {
    parts.push(VIET_DIGITS[units]);
  }

  return parts.join(' ');
}

/**
 * Converts a VND amount into formal Vietnamese words (e.g. "Một triệu hai trăm năm mươi nghìn đồng").
 */
export function formatCurrencyInWords(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Không đồng';
  const rounded = Math.round(amount);
  if (rounded === 0) return 'Không đồng';

  const isNegative = rounded < 0;
  let remaining = Math.abs(rounded);

  const blocks: number[] = [];
  while (remaining > 0) {
    blocks.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block === 0) continue;
    const readFullHundreds = i < blocks.length - 1;
    const blockText = readThreeDigitBlock(block, readFullHundreds);
    const scale = VIET_SCALES[i] || '';
    words.push(scale ? `${blockText} ${scale}` : blockText);
  }

  const joined = words.join(' ').replace(/\s+/g, ' ').trim();
  const sentence = isNegative ? `âm ${joined} đồng` : `${joined} đồng`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

