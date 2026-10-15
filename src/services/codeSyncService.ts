import { Product, Customer } from '../types';

/**
 * Normalizes code by removing all whitespace/spaces and converting to UPPERCASE.
 * Example: "TBD-Keg2 " -> "TBD-KEG2"
 * Example: " kh001 " -> "KH001"
 */
export function normalizeCode(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw).replace(/\s+/g, '').toUpperCase();
}

export type CodeSyncStatus = 'synced_matched' | 'exact_matched' | 'not_in_catalog';

export interface CodeSyncDetail {
  rawCode: string;
  normalizedCode: string;
  syncedCode: string;
  matchedName: string;
  status: CodeSyncStatus;
  isAdjusted: boolean;
  occurrences: number;
  extra?: string; // saleUnit for product, phone/tax for customer
}

export interface OrderImportSyncSummary {
  productSyncList: CodeSyncDetail[];
  customerSyncList: CodeSyncDetail[];
  totalAdjustedProducts: number;
  totalNotInCatalogProducts: number;
  totalAdjustedCustomers: number;
  totalNotInCatalogCustomers: number;
}

/**
 * Matches a raw product code against the products catalog.
 * If found, returns the exact catalog product and code.
 * If not found, returns the normalized code (trimmed, no space, uppercase).
 */
export function matchProductCode(
  rawCode: string | undefined | null,
  products: Product[]
): {
  matchedProduct: Product | null;
  syncedCode: string;
  normalizedCode: string;
  status: CodeSyncStatus;
  isAdjusted: boolean;
} {
  const raw = String(rawCode || '').trim();
  const normalized = normalizeCode(rawCode);

  if (!raw && !normalized) {
    return {
      matchedProduct: null,
      syncedCode: 'PROD',
      normalizedCode: 'PROD',
      status: 'not_in_catalog',
      isAdjusted: false,
    };
  }

  // 1. Exact match with catalog code
  const exact = products.find((p) => p.code === raw);
  if (exact) {
    return {
      matchedProduct: exact,
      syncedCode: exact.code,
      normalizedCode: normalized,
      status: 'exact_matched',
      isAdjusted: false,
    };
  }

  // 2. Case-insensitive trimmed match
  const caseMatch = products.find((p) => p.code.trim().toUpperCase() === raw.toUpperCase());
  if (caseMatch) {
    return {
      matchedProduct: caseMatch,
      syncedCode: caseMatch.code,
      normalizedCode: normalized,
      status: 'synced_matched',
      isAdjusted: true,
    };
  }

  // 3. Normalized match (without internal whitespace, uppercase)
  const normMatch = products.find((p) => normalizeCode(p.code) === normalized);
  if (normMatch) {
    return {
      matchedProduct: normMatch,
      syncedCode: normMatch.code,
      normalizedCode: normalized,
      status: 'synced_matched',
      isAdjusted: true,
    };
  }

  // 4. Not in catalog - normalize code by stripping spaces and uppercase
  return {
    matchedProduct: null,
    syncedCode: normalized,
    normalizedCode: normalized,
    status: 'not_in_catalog',
    isAdjusted: raw !== normalized,
  };
}

/**
 * Matches a raw customer code against the customers catalog.
 * If found, returns the exact catalog customer and code.
 * If not found, returns the normalized code without wrongly overriding to another customer.
 */
export function matchCustomerCode(
  rawCode: string | undefined | null,
  customers: Customer[]
): {
  matchedCustomer: Customer | null;
  syncedCode: string;
  normalizedCode: string;
  status: CodeSyncStatus;
  isAdjusted: boolean;
} {
  const raw = String(rawCode || '').trim();
  const normalized = normalizeCode(rawCode);

  if (!raw && !normalized) {
    return {
      matchedCustomer: null,
      syncedCode: 'KH001',
      normalizedCode: 'KH001',
      status: 'not_in_catalog',
      isAdjusted: false,
    };
  }

  // 1. Exact match
  const exact = customers.find((c) => c.code === raw);
  if (exact) {
    return {
      matchedCustomer: exact,
      syncedCode: exact.code,
      normalizedCode: normalized,
      status: 'exact_matched',
      isAdjusted: false,
    };
  }

  // 2. Case-insensitive trimmed match
  const caseMatch = customers.find((c) => c.code.trim().toUpperCase() === raw.toUpperCase());
  if (caseMatch) {
    return {
      matchedCustomer: caseMatch,
      syncedCode: caseMatch.code,
      normalizedCode: normalized,
      status: 'synced_matched',
      isAdjusted: true,
    };
  }

  // 3. Normalized match
  const normMatch = customers.find((c) => normalizeCode(c.code) === normalized);
  if (normMatch) {
    return {
      matchedCustomer: normMatch,
      syncedCode: normMatch.code,
      normalizedCode: normalized,
      status: 'synced_matched',
      isAdjusted: true,
    };
  }

  // 4. Not in catalog
  return {
    matchedCustomer: null,
    syncedCode: normalized,
    normalizedCode: normalized,
    status: 'not_in_catalog',
    isAdjusted: raw !== normalized,
  };
}

/**
 * Generates synchronization details for all products and customers present in Excel rows.
 */
export function analyzeOrderImportCodes(
  rows: any[],
  products: Product[],
  customers: Customer[]
): OrderImportSyncSummary {
  const productMap = new Map<string, CodeSyncDetail>();
  const customerMap = new Map<string, CodeSyncDetail>();

  rows.forEach((row) => {
    // Product code in row
    const rawP = String(row['Mã HH'] || row['Mã hàng hóa'] || '').trim();
    if (rawP) {
      const match = matchProductCode(rawP, products);
      const existing = productMap.get(rawP);
      if (existing) {
        existing.occurrences += 1;
      } else {
        productMap.set(rawP, {
          rawCode: rawP,
          normalizedCode: match.normalizedCode,
          syncedCode: match.syncedCode,
          matchedName: match.matchedProduct?.name || String(row['Tên HH'] || row['Tên hàng hóa'] || 'Mặt hàng chưa khai báo'),
          status: match.status,
          isAdjusted: match.isAdjusted,
          occurrences: 1,
          extra: match.matchedProduct?.saleUnit || String(row['ĐVT'] || row['ĐVT_Bán'] || row['Đơn vị tính'] || 'Cái'),
        });
      }
    }

    // Customer code in row
    const rawC = String(row['Mã KH'] || row['Mã khách hàng'] || '').trim();
    if (rawC) {
      const match = matchCustomerCode(rawC, customers);
      const existing = customerMap.get(rawC);
      if (existing) {
        existing.occurrences += 1;
      } else {
        customerMap.set(rawC, {
          rawCode: rawC,
          normalizedCode: match.normalizedCode,
          syncedCode: match.syncedCode,
          matchedName: match.matchedCustomer?.name || String(row['Tên khách hàng'] || 'Khách hàng chưa khai báo'),
          status: match.status,
          isAdjusted: match.isAdjusted,
          occurrences: 1,
          extra: match.matchedCustomer?.phone || match.matchedCustomer?.taxCode || String(row['Số điện thoại'] || row['MST'] || ''),
        });
      }
    }
  });

  const productSyncList = Array.from(productMap.values()).sort((a, b) => {
    // Put adjusted first, then not_in_catalog, then exact
    const score = (item: CodeSyncDetail) => (item.isAdjusted ? 0 : item.status === 'not_in_catalog' ? 1 : 2);
    return score(a) - score(b);
  });

  const customerSyncList = Array.from(customerMap.values()).sort((a, b) => {
    const score = (item: CodeSyncDetail) => (item.isAdjusted ? 0 : item.status === 'not_in_catalog' ? 1 : 2);
    return score(a) - score(b);
  });

  const totalAdjustedProducts = productSyncList.filter((p) => p.isAdjusted).length;
  const totalNotInCatalogProducts = productSyncList.filter((p) => p.status === 'not_in_catalog').length;
  const totalAdjustedCustomers = customerSyncList.filter((c) => c.isAdjusted).length;
  const totalNotInCatalogCustomers = customerSyncList.filter((c) => c.status === 'not_in_catalog').length;

  return {
    productSyncList,
    customerSyncList,
    totalAdjustedProducts,
    totalNotInCatalogProducts,
    totalAdjustedCustomers,
    totalNotInCatalogCustomers,
  };
}
