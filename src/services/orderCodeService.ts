import { Order, OrderCodeRule, OrderCodePatternType } from '../types';

export const DEFAULT_ORDER_CODE_RULES: OrderCodeRule[] = [
  {
    id: 'rule-dh',
    name: 'Đơn bán hàng (DH-)',
    patternType: 'prefix_only',
    prefix: 'DH',
    separator: '-',
    minDigits: 1,
    isDefault: true,
  },
  {
    id: 'rule-nb',
    name: 'Đơn nội bộ (NB-)',
    patternType: 'prefix_only',
    prefix: 'NB',
    separator: '-',
    minDigits: 1,
    isDefault: false,
  },
  {
    id: 'rule-date',
    name: 'Đơn theo ngày (DH-YYYYMMDD-)',
    patternType: 'prefix_and_date',
    prefix: 'DH',
    separator: '-',
    dateFormat: 'YYYYMMDD',
    minDigits: 1,
    isDefault: false,
  },
];

/**
 * Formats a date string (YYYY-MM-DD) into specified format
 */
export function formatDateForCode(dateStr: string, format: string = 'YYYYMMDD'): string {
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr.replace(/-/g, '');
  const [yyyy, mm, dd] = parts;
  const yy = yyyy.slice(-2);

  switch (format) {
    case 'YYMMDD':
      return `${yy}${mm}${dd}`;
    case 'DDMMYYYY':
      return `${dd}${mm}${yyyy}`;
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'YYYYMMDD':
    default:
      return `${yyyy}${mm}${dd}`;
  }
}

/**
 * Builds an order code from a rule, sequence number, and order date
 */
export function formatOrderCode(rule: OrderCodeRule, seq: number, orderDate?: string): string {
  const padSeq = String(seq).padStart(rule.minDigits || 1, '0');
  const sep = rule.separator ?? '-';
  const prefix = (rule.prefix || '').trim();

  if (rule.patternType === 'prefix_only') {
    if (!prefix) return padSeq;
    return `${prefix}${sep}${padSeq}`;
  }

  const dStr = formatDateForCode(orderDate || new Date().toISOString().slice(0, 10), rule.dateFormat || 'YYYYMMDD');

  if (rule.patternType === 'date_only') {
    if (!sep) return `${dStr}${padSeq}`;
    return `${dStr}${sep}${padSeq}`;
  }

  if (rule.patternType === 'prefix_and_date') {
    if (!prefix) {
      return `${dStr}${sep}${padSeq}`;
    }
    return `${prefix}${sep}${dStr}${sep}${padSeq}`;
  }

  return `${prefix}${sep}${padSeq}`;
}

/**
 * Extracts sequence number from an order code given a rule
 */
export function extractSequenceNumber(code: string, rule: OrderCodeRule, orderDate?: string): number | null {
  if (!code) return null;
  const sep = rule.separator ?? '-';
  const prefix = (rule.prefix || '').trim();

  if (rule.patternType === 'prefix_only') {
    const expectedStart = prefix ? `${prefix}${sep}` : '';
    if (expectedStart && !code.startsWith(expectedStart)) return null;
    const numPart = expectedStart ? code.slice(expectedStart.length) : code;
    const n = parseInt(numPart, 10);
    return isNaN(n) ? null : n;
  }

  if (rule.patternType === 'date_only') {
    // If date format is in rule, try matching that
    const parts = sep ? code.split(sep) : [code.slice(0, 8), code.slice(8)];
    if (parts.length >= 2) {
      const n = parseInt(parts[parts.length - 1], 10);
      return isNaN(n) ? null : n;
    }
    const match = code.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  if (rule.patternType === 'prefix_and_date') {
    const expectedStart = prefix ? `${prefix}${sep}` : '';
    if (expectedStart && !code.startsWith(expectedStart)) return null;
    const rest = expectedStart ? code.slice(expectedStart.length) : code;
    const parts = sep ? rest.split(sep) : [rest];
    const lastPart = parts[parts.length - 1];
    const n = parseInt(lastPart, 10);
    return isNaN(n) ? null : n;
  }

  return null;
}

/**
 * Checks whether an order belongs to a specific rule
 */
export function orderMatchesRule(order: Order, rule: OrderCodeRule): boolean {
  if (order.orderCodeRuleId && order.orderCodeRuleId === rule.id) {
    return true;
  }
  const seq = extractSequenceNumber(order.orderCode, rule, order.orderDate);
  return seq !== null;
}

/**
 * Matches an order to the best fitting rule among a list of rules
 */
export function matchOrderToRule(order: Order, rules: OrderCodeRule[]): OrderCodeRule | null {
  if (order.orderCodeRuleId) {
    const found = rules.find((r) => r.id === order.orderCodeRuleId);
    if (found) return found;
  }

  // Otherwise match by pattern: check most specific rule first (prefix_and_date, then prefix_only, then date_only)
  const sortedRules = [...rules].sort((a, b) => {
    const priority = (r: OrderCodeRule) => (r.patternType === 'prefix_and_date' ? 3 : r.patternType === 'prefix_only' ? 2 : 1);
    return priority(b) - priority(a);
  });

  for (const rule of sortedRules) {
    if (orderMatchesRule(order, rule)) {
      return rule;
    }
  }

  return null;
}

/**
 * Generates the next sequential order code for a rule
 */
export function generateNextOrderCode(
  rule: OrderCodeRule,
  orderDate: string,
  existingOrders: Order[],
  excludeOrderId?: string
): string {
  const filtered = existingOrders.filter((o) => o.id !== excludeOrderId);

  let maxSeq = 0;
  for (const ord of filtered) {
    if (orderMatchesRule(ord, rule)) {
      // If rule is prefix_and_date or date_only with per-day reset
      if (rule.patternType === 'prefix_and_date' || rule.patternType === 'date_only') {
        const ordDatePart = formatDateForCode(ord.orderDate, rule.dateFormat || 'YYYYMMDD');
        const targetDatePart = formatDateForCode(orderDate, rule.dateFormat || 'YYYYMMDD');
        if (ordDatePart !== targetDatePart) {
          continue;
        }
      }

      const seq = extractSequenceNumber(ord.orderCode, rule, ord.orderDate);
      if (seq !== null && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return formatOrderCode(rule, nextSeq, orderDate);
}

/**
 * Resequences order codes for each rule in chronological order.
 * 
 * Requirement / Example:
 * "Ví dụ: Trong danh sách tạo mã đơn Đơn vị có 2 dãy ký tự đặt đơn là DH và NB, dấu ngăn cách là dấu (-), ký hiệu DH- làm mặc định;
 *  Ngày 01/01/2026 có mã đơn là DH-1, DH-2,
 *  ngày 02/01/2026 có mã đơn DH-3, DH-4, NB-1, NB-2, DH-5,
 *  ngày 03/01/2026 có mã đơn NB-3, DH-6,
 *  khi xóa đơn DH-2 của ngày 01/01/2026 thì các mã đơn ngày 02/01/2026 được đánh lại thành DH-2, DH-3, NB-1, NB-2, DH-4
 *  và ngày 03/01/2026 được đánh lại thành NB-3, DH-5;"
 */
export function resequenceOrders(orders: Order[], rules: OrderCodeRule[]): Order[] {
  if (!orders || orders.length === 0) return [];
  const rulesList = rules && rules.length > 0 ? rules : DEFAULT_ORDER_CODE_RULES;

  // Create a map of rule -> list of orders matching that rule
  const ruleOrdersMap = new Map<string, Order[]>();
  const unmatchedOrders: Order[] = [];

  for (const rule of rulesList) {
    ruleOrdersMap.set(rule.id, []);
  }

  // Classify each order into its rule
  for (const ord of orders) {
    const matched = matchOrderToRule(ord, rulesList);
    if (matched) {
      ruleOrdersMap.get(matched.id)!.push(ord);
    } else {
      unmatchedOrders.push(ord);
    }
  }

  // Create lookup for new codes: orderId -> newOrderCode
  const newCodeMap = new Map<string, string>();

  for (const rule of rulesList) {
    const ruleOrders = ruleOrdersMap.get(rule.id) || [];
    if (ruleOrders.length === 0) continue;

    // For rule with date in code (prefix_and_date or date_only), we can group by date
    if (rule.patternType === 'prefix_and_date' || rule.patternType === 'date_only') {
      // Group by date formatted
      const dateMap = new Map<string, Order[]>();
      for (const ord of ruleOrders) {
        const dKey = formatDateForCode(ord.orderDate, rule.dateFormat || 'YYYYMMDD');
        if (!dateMap.has(dKey)) dateMap.set(dKey, []);
        dateMap.get(dKey)!.push(ord);
      }

      for (const [, dateOrders] of dateMap.entries()) {
        // Sort chronologically within the date (by existing sequence number or createdAt)
        dateOrders.sort((a, b) => {
          const seqA = extractSequenceNumber(a.orderCode, rule, a.orderDate) ?? 0;
          const seqB = extractSequenceNumber(b.orderCode, rule, b.orderDate) ?? 0;
          if (seqA !== seqB) return seqA - seqB;
          return (a.createdAt || '').localeCompare(b.createdAt || '');
        });

        dateOrders.forEach((ord, index) => {
          const newCode = formatOrderCode(rule, index + 1, ord.orderDate);
          newCodeMap.set(ord.id, newCode);
        });
      }
    } else {
      // prefix_only: Sequence continues across dates, ordered by orderDate ascending
      ruleOrders.sort((a, b) => {
        const dateComp = a.orderDate.localeCompare(b.orderDate);
        if (dateComp !== 0) return dateComp;
        // Same date: order by their previous sequence number or creation time
        const seqA = extractSequenceNumber(a.orderCode, rule, a.orderDate) ?? 0;
        const seqB = extractSequenceNumber(b.orderCode, rule, b.orderDate) ?? 0;
        if (seqA !== seqB) return seqA - seqB;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });

      ruleOrders.forEach((ord, index) => {
        const newCode = formatOrderCode(rule, index + 1, ord.orderDate);
        newCodeMap.set(ord.id, newCode);
      });
    }
  }

  // Update order codes in the returned list
  return orders.map((ord) => {
    const updatedCode = newCodeMap.get(ord.id);
    if (updatedCode && updatedCode !== ord.orderCode) {
      return {
        ...ord,
        orderCode: updatedCode,
      };
    }
    return ord;
  });
}

/**
 * Sinh mã gốc quy chiếu tự tăng dần cho đơn hàng mới: DH-ROOT-00001, DH-ROOT-00002...
 * Mã này là bất biến khi thêm, sửa, xóa, đánh số lại mã đơn hiển thị.
 */
export function generateNextRootCode(allOrders: Order[] = []): string {
  let maxNum = 0;
  for (const o of allOrders) {
    if (o.rootCode) {
      const match = o.rootCode.match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }
  }
  const nextNum = maxNum + 1;
  return `DH-ROOT-${String(nextNum).padStart(5, '0')}`;
}

/**
 * Đảm bảo mọi đơn hàng đều có mã gốc quy chiếu để đồng bộ chuẩn xác
 */
export function ensureOrdersHaveRootCode(orders: Order[] = []): Order[] {
  let nextNum = 0;
  // Tìm số max hiện có
  for (const o of orders) {
    if (o.rootCode) {
      const match = o.rootCode.match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > nextNum) {
          nextNum = n;
        }
      }
    }
  }

  return orders.map((ord) => {
    if (ord.rootCode && ord.rootCode.trim()) {
      return ord;
    }
    nextNum += 1;
    return {
      ...ord,
      rootCode: `DH-ROOT-${String(nextNum).padStart(5, '0')}`,
    };
  });
}

/**
 * Hợp nhất thông minh danh sách đơn hàng giữa các thiết bị (Máy tính & Điện thoại)
 * theo Mã gốc quy chiếu (rootCode).
 * - Tuyệt đối không làm mất đơn hàng mới tạo từ thiết bị khác.
 * - Bảo toàn vẹn toàn Người tạo đơn (createdById, createdByName) của nhân viên tạo đơn.
 * - Khi cùng đơn hàng bị chỉnh sửa trên nhiều máy: lấy bản ghi có thời gian updatedAt mới nhất.
 */
export function mergeOrdersByRootCode(localOrders: Order[] = [], remoteOrders: Order[] = []): Order[] {
  const map = new Map<string, Order>();

  // 1. Đưa local orders vào map theo key quy chiếu (rootCode -> id -> orderCode)
  for (const lo of localOrders) {
    const key = lo.rootCode || lo.id || lo.orderCode;
    map.set(key, lo);
  }

  // 2. Đối chiếu với remote orders
  for (const ro of remoteOrders) {
    // Tìm key tương ứng
    let matchedKey: string | null = null;

    if (ro.rootCode && map.has(ro.rootCode)) {
      matchedKey = ro.rootCode;
    } else if (ro.id && map.has(ro.id)) {
      matchedKey = ro.id;
    } else if (ro.orderCode && map.has(ro.orderCode)) {
      matchedKey = ro.orderCode;
    }

    if (!matchedKey) {
      // Đơn mới từ thiết bị khác -> Thêm vào map
      const key = ro.rootCode || ro.id || ro.orderCode;
      map.set(key, ro);
    } else {
      // Đơn đã tồn tại trên cả 2 thiết bị -> Quy chiếu theo mã gốc
      const localItem = map.get(matchedKey)!;

      const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
      const remoteTime = new Date(ro.updatedAt || ro.createdAt || 0).getTime();

      // Quyết định bản ghi mới nhất
      const isRemoteNewer = remoteTime > localTime;
      const base = isRemoteNewer ? ro : localItem;
      const other = isRemoteNewer ? localItem : ro;

      // Bảo toàn mã gốc và thông tin người tạo đơn gốc
      const rootCode = base.rootCode || other.rootCode || `DH-ROOT-${Date.now()}`;
      
      // Người tạo đơn gốc: ưu tiên giữ người tạo ban đầu (đặc biệt nếu là nhân viên bán hàng hoặc tên cụ thể)
      let finalCreatedById = other.createdById || base.createdById;
      let finalCreatedByName = other.createdByName || base.createdByName;

      // Nếu other là bản gốc ban đầu (có createdAt sớm hơn), ưu tiên người tạo của other
      const otherCreatedTime = new Date(other.createdAt || 0).getTime();
      const baseCreatedTime = new Date(base.createdAt || 0).getTime();
      if (otherCreatedTime > 0 && (baseCreatedTime === 0 || otherCreatedTime <= baseCreatedTime)) {
        finalCreatedById = other.createdById || base.createdById;
        finalCreatedByName = other.createdByName || base.createdByName;
      }

      // Tránh việc người tạo bị rơi vào fallback Admin nếu có nhân viên tạo
      if (finalCreatedByName === 'Admin' && other.createdByName && other.createdByName !== 'Admin') {
        finalCreatedByName = other.createdByName;
        finalCreatedById = other.createdById;
      } else if (finalCreatedByName === 'Admin' && base.createdByName && base.createdByName !== 'Admin') {
        finalCreatedByName = base.createdByName;
        finalCreatedById = base.createdById;
      }

      const merged: Order = {
        ...base,
        rootCode,
        createdById: finalCreatedById,
        createdByName: finalCreatedByName,
        createdAt: other.createdAt && base.createdAt
          ? (new Date(other.createdAt).getTime() < new Date(base.createdAt).getTime() ? other.createdAt : base.createdAt)
          : (other.createdAt || base.createdAt || new Date().toISOString()),
        updatedAt: isRemoteNewer ? (ro.updatedAt || new Date().toISOString()) : (localItem.updatedAt || new Date().toISOString()),
        updatedById: isRemoteNewer ? ro.updatedById : localItem.updatedById,
        updatedByName: isRemoteNewer ? ro.updatedByName : localItem.updatedByName,
      };

      // Cập nhật lại trong map
      map.set(matchedKey, merged);
      if (rootCode !== matchedKey) {
        map.delete(matchedKey);
        map.set(rootCode, merged);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.createdAt.localeCompare(a.createdAt));
}
