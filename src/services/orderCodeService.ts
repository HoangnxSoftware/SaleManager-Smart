import { Order, OrderCodeRule, OrderCodePatternType, DeletedOrderRecord } from '../types';

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
  const nowIso = new Date().toISOString();
  return orders.map((ord) => {
    const updatedCode = newCodeMap.get(ord.id);
    if (updatedCode && updatedCode !== ord.orderCode) {
      return {
        ...ord,
        orderCode: updatedCode,
        updatedAt: nowIso,
      };
    }
    return ord;
  });
}

/**
 * Sinh mã gốc quy chiếu tự tăng dần cho đơn hàng mới: DH-ROOT-00001, DH-ROOT-00002...
 * Mã này là bất biến khi thêm, sửa, xóa, đánh số lại mã đơn hiển thị.
 */
export function generateNextRootCode(
  allOrders: Order[] = [],
  deletedOrders: DeletedOrderRecord[] = []
): string {
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
  for (const d of deletedOrders) {
    if (d.rootCode) {
      const match = d.rootCode.match(/(\d+)$/);
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
 * Hợp nhất 2 bản ghi của cùng 1 đơn hàng (trùng mã gốc hoặc trùng mã đơn):
 * - Ưu tiên bản có updatedAt mới nhất cho dữ liệu bán hàng (tiền, items, trạng thái)
 * - Luôn bảo toàn người tạo đơn ban đầu (createdAt sớm nhất, createdByName của nhân viên tạo đơn)
 * - Luôn giữ rootCode chuẩn
 */
function mergeTwoOrderRecords(existing: Order, incoming: Order): Order {
  const existingUpdated = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
  const incomingUpdated = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
  const isIncomingNewer = incomingUpdated >= existingUpdated;

  const base = isIncomingNewer ? incoming : existing;
  const other = isIncomingNewer ? existing : incoming;

  // Root code: ưu tiên mã gốc đã có định dạng chuẩn
  const rootCode = base.rootCode || other.rootCode || existing.rootCode || incoming.rootCode || '';

  // Created by & Created at: bảo toàn người tạo đơn ban đầu
  const existingCreated = new Date(existing.createdAt || 0).getTime();
  const incomingCreated = new Date(incoming.createdAt || 0).getTime();
  const earliestRecord =
    existingCreated > 0 && incomingCreated > 0 && incomingCreated < existingCreated
      ? incoming
      : existing;

  let finalCreatedById = earliestRecord.createdById || existing.createdById || incoming.createdById;
  let finalCreatedByName = earliestRecord.createdByName || existing.createdByName || incoming.createdByName;

  // Tránh việc fallback "Admin" đè lên tên nhân viên thực tế
  if (
    (!finalCreatedByName || finalCreatedByName === 'Admin') &&
    incoming.createdByName &&
    incoming.createdByName !== 'Admin'
  ) {
    finalCreatedByName = incoming.createdByName;
    finalCreatedById = incoming.createdById;
  }
  if (
    (!finalCreatedByName || finalCreatedByName === 'Admin') &&
    existing.createdByName &&
    existing.createdByName !== 'Admin'
  ) {
    finalCreatedByName = existing.createdByName;
    finalCreatedById = existing.createdById;
  }

  const finalCreatedAt =
    earliestRecord.createdAt || other.createdAt || base.createdAt || new Date().toISOString();
  const finalUpdatedAt =
    (isIncomingNewer ? incoming.updatedAt : existing.updatedAt) || new Date().toISOString();
  const finalUpdatedById = isIncomingNewer ? incoming.updatedById : existing.updatedById;
  const finalUpdatedByName = isIncomingNewer ? incoming.updatedByName : existing.updatedByName;

  return {
    ...base,
    id: existing.id || incoming.id,
    rootCode,
    orderCode: base.orderCode || other.orderCode,
    createdById: finalCreatedById,
    createdByName: finalCreatedByName,
    createdAt: finalCreatedAt,
    updatedAt: finalUpdatedAt,
    updatedById: finalUpdatedById,
    updatedByName: finalUpdatedByName,
  };
}

/**
 * Khử trùng đơn hàng tuyệt đối:
 * Không cho phép 2 đơn hàng có cùng Mã gốc (rootCode) hoặc cùng Mã đơn (orderCode) cùng tồn tại.
 * Nếu phát hiện trùng, hợp nhất thông minh thành 1 đơn duy nhất.
 */
export function deduplicateOrders(orders: Order[] = []): Order[] {
  if (!orders || orders.length === 0) return [];

  const result: Order[] = [];

  for (const ord of orders) {
    if (!ord) continue;

    // Tìm xem đã có đơn nào trong result trùng:
    // 1. rootCode (nếu cả 2 đều có rootCode)
    // 2. orderCode (không phân biệt hoa thường)
    // 3. id
    const matchIdx = result.findIndex((item) => {
      const ordRoot = ord.rootCode?.trim().toUpperCase();
      const itemRoot = item.rootCode?.trim().toUpperCase();
      const matchRoot = Boolean(ordRoot && itemRoot && ordRoot === itemRoot);
      const differentRoots = Boolean(ordRoot && itemRoot && ordRoot !== itemRoot);
      const matchCode =
        Boolean(ord.orderCode && item.orderCode && ord.orderCode.trim().toLowerCase() === item.orderCode.trim().toLowerCase());
      const matchId = Boolean(ord.id && item.id && ord.id === item.id);
      return matchRoot || matchId || (!differentRoots && matchCode);
    });

    if (matchIdx === -1) {
      result.push({ ...ord });
    } else {
      // Đã có bản ghi trùng -> Hợp nhất ngay thành 1 đơn duy nhất
      result[matchIdx] = mergeTwoOrderRecords(result[matchIdx], ord);
    }
  }

  return result;
}

/**
 * Hợp nhất danh sách đánh dấu đơn hàng đã xóa (tombstones) giữa local và remote
 */
export function mergeDeletedOrders(
  localDeleted: DeletedOrderRecord[] = [],
  remoteDeleted: DeletedOrderRecord[] = []
): DeletedOrderRecord[] {
  const map = new Map<string, DeletedOrderRecord>();
  const combined = [...(localDeleted || []), ...(remoteDeleted || [])];

  for (const rec of combined) {
    if (!rec) continue;
    const key =
      rec.rootCode && rec.rootCode.trim()
        ? `root:${rec.rootCode.trim().toUpperCase()}`
        : rec.id && rec.id.trim()
        ? `id:${rec.id.trim()}`
        : rec.orderCode && rec.orderCode.trim()
        ? `code:${rec.orderCode.trim().toLowerCase()}`
        : '';
    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...rec });
    } else {
      const existingTime = new Date(existing.deletedAt || 0).getTime();
      const recTime = new Date(rec.deletedAt || 0).getTime();
      if (recTime >= existingTime) {
        map.set(key, { ...existing, ...rec });
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime())
    .slice(0, 1500);
}

/**
 * Loại bỏ các đơn hàng đã bị Admin xóa theo danh sách đánh dấu (tombstones)
 */
export function filterDeletedOrders(
  orders: Order[] = [],
  deletedOrders: DeletedOrderRecord[] = []
): Order[] {
  if (!orders || orders.length === 0) return [];
  if (!deletedOrders || deletedOrders.length === 0) return orders;

  return orders.filter((ord) => {
    if (!ord) return false;
    const ordCreated = new Date(ord.createdAt || 0).getTime();
    const ordRoot = ord.rootCode?.trim().toUpperCase();
    const ordId = ord.id?.trim();
    const ordCode = ord.orderCode?.trim().toLowerCase();

    const isDeleted = deletedOrders.some((del) => {
      if (!del) return false;
      const delTime = new Date(del.deletedAt || 0).getTime();
      if (delTime > 0 && ordCreated > delTime + 5000) {
        // Đơn mới được tạo sau thời điểm xóa (không phải đơn bị xóa)
        return false;
      }

      const delRoot = del.rootCode?.trim().toUpperCase();
      const delId = del.id?.trim();
      const delCode = del.orderCode?.trim().toLowerCase();

      if (delRoot && ordRoot) {
        return delRoot === ordRoot;
      }
      if (delId && ordId && delId === ordId) {
        return true;
      }
      // Fallback theo mã đơn chỉ áp dụng khi ít nhất 1 bên chưa có rootCode (legacy)
      if ((!delRoot || !ordRoot) && delCode && ordCode && delCode === ordCode) {
        return true;
      }
      return false;
    });

    return !isDeleted;
  });
}

/**
 * Hợp nhất thông minh danh sách đơn hàng giữa các thiết bị (Máy tính & Điện thoại)
 * theo Mã gốc quy chiếu (rootCode) và Mã đơn (orderCode).
 * - Loại bỏ tuyệt đối các đơn hàng nằm trong danh sách đã xóa (deletedOrders) để không bị đồng bộ ngược lại.
 * - Tuyệt đối không để xảy ra trùng lặp đơn hàng hoặc trùng mã gốc.
 * - Bảo toàn vẹn toàn Người tạo đơn (createdById, createdByName) của nhân viên tạo đơn.
 * - Khi cùng đơn hàng bị chỉnh sửa trên nhiều máy: lấy bản ghi có thời gian updatedAt mới nhất.
 */
export function mergeOrdersByRootCode(
  localOrders: Order[] = [],
  remoteOrders: Order[] = [],
  deletedOrders: DeletedOrderRecord[] = []
): Order[] {
  // 1. Lọc bỏ các đơn đã bị xóa trên cả 2 danh sách
  const activeLocal = filterDeletedOrders(localOrders, deletedOrders);
  const activeRemote = filterDeletedOrders(remoteOrders, deletedOrders);

  // 2. Khử trùng nội bộ từng danh sách trước
  const cleanLocal = deduplicateOrders(activeLocal);
  const cleanRemote = deduplicateOrders(activeRemote);

  // 3. Gộp 2 danh sách và khử trùng toàn diện
  const merged = deduplicateOrders([...cleanLocal, ...cleanRemote]);

  // 4. Đảm bảo mọi đơn đều có rootCode và sắp xếp theo ngày mới nhất
  const ensured = ensureOrdersHaveRootCode(merged);
  return deduplicateOrders(ensured).sort(
    (a, b) => b.orderDate.localeCompare(a.orderDate) || b.createdAt.localeCompare(a.createdAt)
  );
}

/**
 * Đối soát đơn hàng khi tải dữ liệu mới từ Google Sheets về máy:
 * - Áp dụng danh sách đơn hàng đã xóa (tombstones) từ cả 2 phía.
 * - Nếu một đơn hàng ở máy cục bộ đã tồn tại từ trước lần đồng bộ cuối (localLastSyncedAt)
 *   nhưng không còn trên Google Sheets (đã bị Admin xóa trên máy khác), không giữ lại để tránh đồng bộ ngược.
 * - Chỉ giữ lại đơn hàng cục bộ nếu đơn đó mới được tạo hoặc chỉnh sửa cục bộ SAU localLastSyncedAt.
 */
export function reconcileRemoteOrdersWithLocal(
  localOrders: Order[] = [],
  remoteOrders: Order[] = [],
  deletedOrders: DeletedOrderRecord[] = [],
  localLastSyncedAt?: string
): Order[] {
  const activeRemote = filterDeletedOrders(remoteOrders, deletedOrders);
  const activeLocal = filterDeletedOrders(localOrders, deletedOrders);

  const localSyncTime = localLastSyncedAt ? new Date(localLastSyncedAt).getTime() : 0;
  if (!localSyncTime || isNaN(localSyncTime)) {
    return mergeOrdersByRootCode(activeLocal, activeRemote, deletedOrders);
  }

  const remoteRootSet = new Set(
    activeRemote.map((o) => o.rootCode?.trim().toUpperCase()).filter(Boolean) as string[]
  );
  const remoteIdSet = new Set(activeRemote.map((o) => o.id).filter(Boolean));
  const remoteCodeSet = new Set(
    activeRemote.map((o) => o.orderCode?.trim().toLowerCase()).filter(Boolean) as string[]
  );

  const survivingLocal = activeLocal.filter((ord) => {
    const ordRoot = ord.rootCode?.trim().toUpperCase();
    const ordCode = ord.orderCode?.trim().toLowerCase();
    const existsInRemote =
      (ordRoot && remoteRootSet.has(ordRoot)) ||
      (ord.id && remoteIdSet.has(ord.id)) ||
      (!ordRoot && ordCode && remoteCodeSet.has(ordCode));

    if (existsInRemote) return true;

    // Không có trên bản mới từ Sheets: chỉ giữ lại nếu đơn mới được tạo/sửa offline sau lần sync cuối
    const createdT = new Date(ord.createdAt || 0).getTime();
    const updatedT = new Date(ord.updatedAt || ord.createdAt || 0).getTime();
    return createdT > localSyncTime || updatedT > localSyncTime;
  });

  return mergeOrdersByRootCode(survivingLocal, activeRemote, deletedOrders);
}
