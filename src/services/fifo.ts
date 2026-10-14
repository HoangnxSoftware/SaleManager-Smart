import { AppData, Product, PurchaseBill, Order } from '../types';
import { roundPrice } from '../utils/formatters';

export interface PurchaseLot {
  billNo: string;
  purchaseDate: string;
  productCode: string;
  originalQty: number; // in saleUnit
  remainingQty: number; // in saleUnit
  unitCost: number; // per saleUnit
}

/**
 * Builds chronological FIFO inventory lots from all purchase bills.
 * Converts purchaseUnit quantities to saleUnit using conversionRate.
 */
export function buildFifoLots(products: Product[], purchases: PurchaseBill[]): Map<string, PurchaseLot[]> {
  const productMap = new Map<string, Product>();
  products.forEach(p => productMap.set(p.code, p));

  const lotsByProduct = new Map<string, PurchaseLot[]>();
  products.forEach(p => lotsByProduct.set(p.code, []));

  // Sort purchases chronologically
  const sortedPurchases = [...purchases].sort((a, b) => 
    new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
  );

  for (const bill of sortedPurchases) {
    for (const item of bill.items) {
      const prod = productMap.get(item.productCode);
      const conversion = prod ? (prod.conversionRate || 1) : 1;
      const qtyInSaleUnit = item.quantity * conversion;
      const costPerSaleUnit = item.unitPrice / conversion;

      const lots = lotsByProduct.get(item.productCode) || [];
      lots.push({
        billNo: bill.billNo,
        purchaseDate: bill.purchaseDate,
        productCode: item.productCode,
        originalQty: qtyInSaleUnit,
        remainingQty: qtyInSaleUnit,
        unitCost: costPerSaleUnit,
      });
      lotsByProduct.set(item.productCode, lots);
    }
  }

  return lotsByProduct;
}

/**
 * Calculates current stock quantity in sale units for each product, optionally up to a specific date (upToDate)
 * @param products List of products
 * @param purchases List of purchase bills
 * @param orders List of orders
 * @param upToDate Optional cutoff date string (YYYY-MM-DD). If provided, only purchases and orders on or before this date are included.
 * @param excludeOrderId Optional order ID to exclude from export deduction (e.g. current order being edited)
 */
export function calculateCurrentInventory(
  products: Product[],
  purchases: PurchaseBill[],
  orders: Order[],
  upToDate?: string,
  excludeOrderId?: string
) {
  const stockMap = new Map<string, { totalImport: number; totalExport: number; inStock: number }>();

  // Helper for safe YYYY-MM-DD comparison
  const toYMD = (d: string | undefined | null) => (d ? d.slice(0, 10) : '');
  const targetDate = upToDate ? toYMD(upToDate) : null;

  // Product map for conversion
  const productMap = new Map<string, Product>();
  products.forEach(p => {
    productMap.set(p.code, p);
    stockMap.set(p.code, { totalImport: 0, totalExport: 0, inStock: 0 });
  });

  // Add purchases (on or before upToDate if provided)
  for (const bill of purchases) {
    if (targetDate && toYMD(bill.purchaseDate) > targetDate) {
      continue;
    }
    for (const item of bill.items) {
      const prod = productMap.get(item.productCode);
      const conversion = prod ? (prod.conversionRate || 1) : 1;
      const qtyInSaleUnit = item.quantity * conversion;
      const current = stockMap.get(item.productCode) || { totalImport: 0, totalExport: 0, inStock: 0 };
      current.totalImport += qtyInSaleUnit;
      current.inStock += qtyInSaleUnit;
      stockMap.set(item.productCode, current);
    }
  }

  // Deduct all non-cancelled orders (on or before upToDate if provided, excluding excludeOrderId)
  for (const ord of orders) {
    if (ord.deliveryStatus === 'cancelled') continue;
    if (excludeOrderId && ord.id === excludeOrderId) continue;
    if (targetDate && toYMD(ord.orderDate) > targetDate) {
      continue;
    }
    for (const item of ord.items) {
      const current = stockMap.get(item.productCode) || { totalImport: 0, totalExport: 0, inStock: 0 };
      current.totalExport += item.quantity;
      current.inStock -= item.quantity;
      stockMap.set(item.productCode, current);
    }
  }

  return stockMap;
}

/**
 * Finds the highest unit cost of a product among lots available up to orderDate
 * that still had remaining stock or existed up to that date.
 */
export function getHighestCostUpToDate(
  productCode: string,
  orderDate: string,
  products: Product[],
  purchases: PurchaseBill[]
): number {
  const productMap = new Map<string, Product>();
  products.forEach(p => productMap.set(p.code, p));
  const prod = productMap.get(productCode);
  const conversion = prod ? (prod.conversionRate || 1) : 1;

  let maxCost = 0;
  for (const bill of purchases) {
    // Only consider lots purchased on or before orderDate
    if (bill.purchaseDate <= orderDate) {
      for (const item of bill.items) {
        if (item.productCode === productCode) {
          const costPerSaleUnit = item.unitPrice / conversion;
          if (costPerSaleUnit > maxCost) {
            maxCost = costPerSaleUnit;
          }
        }
      }
    }
  }

  // If no lot before orderDate, take any lot available for this product
  if (maxCost === 0) {
    for (const bill of purchases) {
      for (const item of bill.items) {
        if (item.productCode === productCode) {
          const costPerSaleUnit = item.unitPrice / conversion;
          if (costPerSaleUnit > maxCost) {
            maxCost = costPerSaleUnit;
          }
        }
      }
    }
  }

  return maxCost;
}

/**
 * Finds the MAX purchase unit cost among active inventory lots that still had remaining stock
 * on the specified order date (chronological FIFO tracking).
 */
export function getMaxStockCostUpToDate(
  productCode: string,
  orderDate: string,
  products: Product[],
  purchases: PurchaseBill[],
  orders: Order[] = [],
  excludeOrderId?: string
): { maxCostPerPurchaseUnit: number; maxCostPerSaleUnit: number } {
  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.code, p));
  const prod = productMap.get(productCode);
  const conversion = prod ? prod.conversionRate || 1 : 1;

  interface LotTrack {
    billNo: string;
    purchaseDate: string;
    unitPrice: number; // per purchaseUnit
    costPerSaleUnit: number;
    remainingQty: number; // in saleUnit
  }

  // 1. Collect all purchase lots up to orderDate
  const lots: LotTrack[] = [];
  const sortedPurchases = [...purchases]
    .filter((b) => b.purchaseDate <= orderDate)
    .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));

  for (const bill of sortedPurchases) {
    for (const item of bill.items) {
      if (item.productCode === productCode) {
        const qtyInSaleUnit = item.quantity * conversion;
        lots.push({
          billNo: bill.billNo,
          purchaseDate: bill.purchaseDate,
          unitPrice: item.unitPrice,
          costPerSaleUnit: item.unitPrice / conversion,
          remainingQty: qtyInSaleUnit,
        });
      }
    }
  }

  // 2. Deduct from prior orders chronologically up to orderDate
  const priorOrders = orders
    .filter(
      (o) =>
        o.deliveryStatus !== 'cancelled' &&
        o.id !== excludeOrderId &&
        o.orderDate <= orderDate
    )
    .sort((a, b) => a.orderDate.localeCompare(b.orderDate));

  for (const ord of priorOrders) {
    for (const item of ord.items) {
      if (item.productCode === productCode) {
        let needed = item.quantity;
        for (const lot of lots) {
          if (lot.remainingQty <= 0) continue;
          const take = Math.min(needed, lot.remainingQty);
          lot.remainingQty -= take;
          needed -= take;
          if (needed <= 0) break;
        }
      }
    }
  }

  // 3. Find max cost among lots that STILL have remaining stock (> 0)
  const availableLots = lots.filter((l) => l.remainingQty > 0);
  if (availableLots.length > 0) {
    let maxPurchaseUnit = 0;
    let maxSaleUnit = 0;
    for (const l of availableLots) {
      if (l.unitPrice > maxPurchaseUnit) {
        maxPurchaseUnit = l.unitPrice;
        maxSaleUnit = l.costPerSaleUnit;
      }
    }
    return { maxCostPerPurchaseUnit: maxPurchaseUnit, maxCostPerSaleUnit: maxSaleUnit };
  }

  // Fallback 1: Any lot up to orderDate
  if (lots.length > 0) {
    let maxPurchaseUnit = 0;
    let maxSaleUnit = 0;
    for (const l of lots) {
      if (l.unitPrice > maxPurchaseUnit) {
        maxPurchaseUnit = l.unitPrice;
        maxSaleUnit = l.costPerSaleUnit;
      }
    }
    return { maxCostPerPurchaseUnit: maxPurchaseUnit, maxCostPerSaleUnit: maxSaleUnit };
  }

  // Fallback 2: Any purchase lot in the system for this product
  let fallbackPurchaseUnit = 0;
  for (const bill of purchases) {
    for (const item of bill.items) {
      if (item.productCode === productCode && item.unitPrice > fallbackPurchaseUnit) {
        fallbackPurchaseUnit = item.unitPrice;
      }
    }
  }
  return {
    maxCostPerPurchaseUnit: fallbackPurchaseUnit,
    maxCostPerSaleUnit: conversion > 0 ? fallbackPurchaseUnit / conversion : fallbackPurchaseUnit,
  };
}

export interface SuggestedPrices {
  priceByMargin: number; // Giá bán theo tỷ suất lợi nhuận (VD: 5.740 đ)
  defaultPrice: number; // Giá bán mặc định (VD: 5.580 đ)
  priceMinusVariance: number; // Giá biên độ (-) (VD: 5.480 đ)
  pricePlusVariance: number; // Giá biên độ (+) (VD: 5.680 đ)
  maxCostPerPurchaseUnit: number; // Đơn giá Max tồn kho ĐVT_Mua (VD: 120.500 đ)
  maxCostPerSaleUnit: number; // Đơn giá Max tồn kho ĐVT_Bán (VD: 5.020,83 đ)
}

/**
 * Calculates suggested prices for product:
 * 1. Giá theo tỷ suất lợi nhuận (TSLN): Đơn giá MAX tồn kho * (1 + margin) * (1 + vatRate) / conversion
 *    và làm tròn theo cấu hình postTaxSalePriceDecimals (-2 là làm tròn đến hàng chục)
 * 2. Giá mặc định (đã gồm VAT)
 * 3. Giá biên độ (-) = defaultPrice - variance
 * 4. Giá biên độ (+) = defaultPrice + variance
 */
export function calculateSuggestedPrices(
  product: Product,
  orderDate: string,
  products: Product[],
  purchases: PurchaseBill[],
  orders: Order[] = [],
  postTaxDecimals: number = -2,
  salePriceDecimals: number = 2,
  excludeOrderId?: string
): SuggestedPrices {
  const { maxCostPerPurchaseUnit, maxCostPerSaleUnit } = getMaxStockCostUpToDate(
    product.code,
    orderDate,
    products,
    purchases,
    orders,
    excludeOrderId
  );

  const profitMargin = product.profitMargin || 0;
  const vatRate = product.vatRate || 10;

  // Công thức: Đơn giá bán (Theo ĐVT_Bán) theo tỷ suất lợi nhuận (Đã bao gồm thuế GTGT)
  // = maxCostPerSaleUnit * (1 + margin / 100) * (1 + vat / 100)
  let priceByMargin = 0;
  if (maxCostPerSaleUnit > 0) {
    const rawPostTax = maxCostPerSaleUnit * (1 + profitMargin / 100) * (1 + vatRate / 100);
    priceByMargin = roundPrice(rawPostTax, postTaxDecimals);
  }

  const defaultPrice = product.defaultSalePrice || 0;
  const variance = product.priceVariance || 0;
  const priceMinusVariance = defaultPrice > 0 && variance > 0 ? Math.max(0, defaultPrice - variance) : 0;
  const pricePlusVariance = defaultPrice > 0 && variance > 0 ? defaultPrice + variance : 0;

  return {
    priceByMargin,
    defaultPrice,
    priceMinusVariance,
    pricePlusVariance,
    maxCostPerPurchaseUnit,
    maxCostPerSaleUnit,
  };
}

export interface InventoryReportRow {
  productCode: string;
  productName: string;
  saleUnit: string;
  beginningQty: number; // Tồn đầu kỳ
  periodImportQty: number; // SL nhập trong kỳ
  periodExportQty: number; // Tổng xuất trong kỳ
  endingQty: number; // Tồn cuối kỳ
  orderExports: Record<string, number>; // Mã đơn -> SL xuất
}

/**
 * Generates the Inventory Report (Báo cáo Xuất nhập kho)
 * for a specific date or date range [startDate, endDate]
 * Columns: Mã HH, tên HH, ĐVT_Bán, tồn đầu kỳ, SL nhập trong kỳ, SL xuất, tồn cuối kỳ, and dynamic order columns!
 */
export function generateInventoryReport(
  startDate: string,
  endDate: string,
  data: AppData
): { rows: InventoryReportRow[]; orderCodes: string[] } {
  const { products, purchases, orders } = data;
  const productMap = new Map<string, Product>();
  products.forEach(p => productMap.set(p.code, p));

  // Identify orders inside the selected date range
  const ordersInPeriod = orders.filter(
    ord => ord.deliveryStatus !== 'cancelled' && ord.orderDate >= startDate && ord.orderDate <= endDate
  ).sort((a, b) => a.orderDate.localeCompare(b.orderDate) || a.orderCode.localeCompare(b.orderCode));

  const orderCodes = ordersInPeriod.map(o => o.orderCode);

  // Map of order exports: orderCode -> productCode -> qty
  const orderSalesMap = new Map<string, Map<string, number>>();
  for (const ord of ordersInPeriod) {
    const pMap = new Map<string, number>();
    for (const item of ord.items) {
      const prev = pMap.get(item.productCode) || 0;
      pMap.set(item.productCode, prev + item.quantity);
    }
    orderSalesMap.set(ord.orderCode, pMap);
  }

  const rows: InventoryReportRow[] = [];

  for (const prod of products) {
    const conversion = prod.conversionRate || 1;

    // 1. Purchases before period (Import before startDate)
    let importBefore = 0;
    for (const bill of purchases) {
      if (bill.purchaseDate < startDate) {
        for (const item of bill.items) {
          if (item.productCode === prod.code) {
            importBefore += item.quantity * conversion;
          }
        }
      }
    }

    // 2. Orders before period (Export before startDate)
    let exportBefore = 0;
    for (const ord of orders) {
      if (ord.deliveryStatus !== 'cancelled' && ord.orderDate < startDate) {
        for (const item of ord.items) {
          if (item.productCode === prod.code) {
            exportBefore += item.quantity;
          }
        }
      }
    }

    const beginningQty = Math.max(0, importBefore - exportBefore);

    // 3. Purchases in period (SL nhập trong kỳ)
    let periodImportQty = 0;
    for (const bill of purchases) {
      if (bill.purchaseDate >= startDate && bill.purchaseDate <= endDate) {
        for (const item of bill.items) {
          if (item.productCode === prod.code) {
            periodImportQty += item.quantity * conversion;
          }
        }
      }
    }

    // 4. Exports in period
    let periodExportQty = 0;
    const orderExports: Record<string, number> = {};
    for (const ord of ordersInPeriod) {
      const pMap = orderSalesMap.get(ord.orderCode);
      const qty = pMap?.get(prod.code) || 0;
      orderExports[ord.orderCode] = qty;
      periodExportQty += qty;
    }

    const endingQty = beginningQty + periodImportQty - periodExportQty;

    rows.push({
      productCode: prod.code,
      productName: prod.name,
      saleUnit: prod.saleUnit,
      beginningQty,
      periodImportQty,
      periodExportQty,
      endingQty,
      orderExports,
    });
  }

  return { rows, orderCodes };
}

export interface ProfitReportItem {
  id: string;
  orderCode: string;
  orderDate: string;
  customerName: string;
  createdByName: string; // Người tạo đơn / Bán hàng
  createdById: string;
  productCode: string;
  productName: string;
  saleUnit: string;
  quantity: number; // SL bán (theo ĐVT_Bán)
  salePrice: number; // Đơn giá bán trước thuế
  revenue: number; // Doanh thu thuần = SL * Đơn giá trước thuế - Chiết khấu
  conversionRate: number; // SL quy đổi
  purchaseUnit: string; // ĐVT_Mua
  quantityInPurchaseUnit: number; // SL xuất (Theo ĐVT_Mua) = quantity / conversionRate
  unitCostFifo: number; // Giá vốn FIFO (theo ĐVT_Bán)
  unitCostFifoPurchaseUnit: number; // Giá vốn đơn vị theo ĐVT_Mua = unitCostFifo * conversionRate
  totalCostFifo: number; // Tổng giá vốn FIFO (bằng nhau theo cả 2 đơn vị vì SL_mua * Đơn_giá_mua = SL_bán * Đơn_giá_bán)
  grossProfit: number; // Lợi nhuận gộp = Doanh thu thuần - Giá vốn
  marginPercent: number; // % Tỷ suất lợi nhuận thực tế
}

export interface FifoCostDetailRow {
  id: string;
  orderCode: string; // Mã đơn hàng
  orderDate: string; // Ngày đơn hàng
  customerName: string; // Tên khách hàng
  createdByName?: string; // Người tạo đơn / Bán hàng
  productCode: string; // Mã mặt hàng
  productName: string; // Tên mặt hàng
  saleUnit: string; // ĐVT_Bán
  purchaseUnit: string; // ĐVT_Mua
  conversionRate: number; // Tỷ lệ quy đổi
  lotBillNo: string; // Số phiếu nhập nguồn (Bill No) hoặc 'Ước tính/Dự phòng'
  lotPurchaseDate: string; // Ngày nhập nguồn
  lotExportQty: number; // SL xuất kho theo ĐVT_Bán từ lô này
  lotExportQtyPurchaseUnit: number; // SL xuất theo ĐVT_Mua từ lô này
  lotUnitCost: number; // Đơn giá xuất kho (theo ĐVT_Bán)
  lotUnitCostPurchaseUnit: number; // Đơn giá xuất kho (theo ĐVT_Mua)
  lotTotalCost: number; // Thành tiền giá vốn = SL xuất * Đơn giá xuất
}

/**
 * Calculates FIFO Profit Report for orders and products within date range
 */
export function generateProfitReport(
  startDate: string,
  endDate: string,
  data: AppData
): {
  items: ProfitReportItem[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number;
} {
  const { products, purchases, orders } = data;
  const productMap = new Map<string, Product>();
  products.forEach(p => productMap.set(p.code, p));

  // Build simulated chronological FIFO ledger
  const lotsByProduct = buildFifoLots(products, purchases);

  // Chronologically sort all orders to consume lots in FIFO order
  const sortedAllOrders = [...orders]
    .filter(o => o.deliveryStatus !== 'cancelled')
    .sort((a, b) => a.orderDate.localeCompare(b.orderDate) || a.orderCode.localeCompare(b.orderCode));

  const reportItems: ProfitReportItem[] = [];

  for (const ord of sortedAllOrders) {
    const isInPeriod = ord.orderDate >= startDate && ord.orderDate <= endDate;

    for (const item of ord.items) {
      let neededQty = item.quantity;
      let totalCostForItem = 0;

      const lots = lotsByProduct.get(item.productCode) || [];

      for (const lot of lots) {
        if (neededQty <= 0) break;
        if (lot.remainingQty > 0) {
          const take = Math.min(lot.remainingQty, neededQty);
          totalCostForItem += take * lot.unitCost;
          lot.remainingQty -= take;
          neededQty -= take;
        }
      }

      // If out of lots, fallback to highest cost or 0
      if (neededQty > 0) {
        const fallbackCost = getHighestCostUpToDate(item.productCode, ord.orderDate, products, purchases);
        totalCostForItem += neededQty * fallbackCost;
      }

      const prod = productMap.get(item.productCode);
      const conversionRate = prod?.conversionRate && prod.conversionRate > 0 ? prod.conversionRate : 1;
      const purchaseUnit = prod?.purchaseUnit || item.saleUnit;
      const quantityInPurchaseUnit = item.quantity / conversionRate;

      const unitCostFifo = item.quantity > 0 ? totalCostForItem / item.quantity : 0;
      const unitCostFifoPurchaseUnit = unitCostFifo * conversionRate;
      const netRevenue = (item.quantity * item.preTaxPrice) - (item.itemDiscount || 0);
      const grossProfit = netRevenue - totalCostForItem;
      const marginPercent = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

      if (isInPeriod) {
        reportItems.push({
          id: `${ord.id}-${item.id}`,
          orderCode: ord.orderCode,
          orderDate: ord.orderDate,
          customerName: ord.customerName,
          createdByName: ord.createdByName || '—',
          createdById: ord.createdById || '',
          productCode: item.productCode,
          productName: item.productName,
          saleUnit: item.saleUnit,
          quantity: item.quantity,
          salePrice: item.preTaxPrice,
          revenue: netRevenue,
          conversionRate,
          purchaseUnit,
          quantityInPurchaseUnit,
          unitCostFifo,
          unitCostFifoPurchaseUnit,
          totalCostFifo: totalCostForItem,
          grossProfit,
          marginPercent,
        });
      }
    }
  }

  const totalRevenue = reportItems.reduce((acc, r) => acc + r.revenue, 0);
  const totalCost = reportItems.reduce((acc, r) => acc + r.totalCostFifo, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    items: reportItems,
    totalRevenue,
    totalCost,
    totalProfit,
    avgMargin,
  };
}

/**
 * Generates detailed FIFO Cost Breakdown per order, per product, with exact lot source and export unit cost.
 * Thẻ báo cáo chi tiết giá vốn theo từng đơn hàng, mặt hàng, đơn giá xuất kho (Theo phương pháp FIFO)
 */
export function generateFifoCostDetailsReport(
  startDate: string,
  endDate: string,
  data: AppData
): {
  rows: FifoCostDetailRow[];
  totalExportQtySaleUnit: number;
  totalExportQtyPurchaseUnit: number;
  totalCostAmount: number;
} {
  const { products, purchases, orders } = data;
  const productMap = new Map<string, Product>();
  products.forEach(p => productMap.set(p.code, p));

  // Build fresh lots
  const lotsByProduct = buildFifoLots(products, purchases);

  const sortedAllOrders = [...orders]
    .filter(o => o.deliveryStatus !== 'cancelled')
    .sort((a, b) => a.orderDate.localeCompare(b.orderDate) || a.orderCode.localeCompare(b.orderCode));

  const rows: FifoCostDetailRow[] = [];
  let rowIdx = 1;

  for (const ord of sortedAllOrders) {
    const isInPeriod = ord.orderDate >= startDate && ord.orderDate <= endDate;

    for (const item of ord.items) {
      let neededQty = item.quantity;
      const prod = productMap.get(item.productCode);
      const conversionRate = prod?.conversionRate && prod.conversionRate > 0 ? prod.conversionRate : 1;
      const purchaseUnit = prod?.purchaseUnit || item.saleUnit;

      const lots = lotsByProduct.get(item.productCode) || [];

      for (const lot of lots) {
        if (neededQty <= 0) break;
        if (lot.remainingQty > 0) {
          const take = Math.min(lot.remainingQty, neededQty);
          lot.remainingQty -= take;
          neededQty -= take;

          if (isInPeriod) {
            rows.push({
              id: `${ord.id}-${item.id}-${lot.billNo}-${rowIdx++}`,
              orderCode: ord.orderCode,
              orderDate: ord.orderDate,
              customerName: ord.customerName,
              createdByName: ord.createdByName || '—',
              productCode: item.productCode,
              productName: item.productName,
              saleUnit: item.saleUnit,
              purchaseUnit,
              conversionRate,
              lotBillNo: lot.billNo,
              lotPurchaseDate: lot.purchaseDate,
              lotExportQty: take,
              lotExportQtyPurchaseUnit: take / conversionRate,
              lotUnitCost: lot.unitCost,
              lotUnitCostPurchaseUnit: lot.unitCost * conversionRate,
              lotTotalCost: take * lot.unitCost,
            });
          }
        }
      }

      // If out of lots, fallback to highest cost
      if (neededQty > 0) {
        const fallbackCost = getHighestCostUpToDate(item.productCode, ord.orderDate, products, purchases);
        if (isInPeriod) {
          rows.push({
            id: `${ord.id}-${item.id}-fallback-${rowIdx++}`,
            orderCode: ord.orderCode,
            orderDate: ord.orderDate,
            customerName: ord.customerName,
            createdByName: ord.createdByName || '—',
            productCode: item.productCode,
            productName: item.productName,
            saleUnit: item.saleUnit,
            purchaseUnit,
            conversionRate,
            lotBillNo: 'Giá vốn ước tính (hết tồn)',
            lotPurchaseDate: '—',
            lotExportQty: neededQty,
            lotExportQtyPurchaseUnit: neededQty / conversionRate,
            lotUnitCost: fallbackCost,
            lotUnitCostPurchaseUnit: fallbackCost * conversionRate,
            lotTotalCost: neededQty * fallbackCost,
          });
        }
      }
    }
  }

  const totalExportQtySaleUnit = rows.reduce((acc, r) => acc + r.lotExportQty, 0);
  const totalExportQtyPurchaseUnit = rows.reduce((acc, r) => acc + r.lotExportQtyPurchaseUnit, 0);
  const totalCostAmount = rows.reduce((acc, r) => acc + r.lotTotalCost, 0);

  return {
    rows,
    totalExportQtySaleUnit,
    totalExportQtyPurchaseUnit,
    totalCostAmount,
  };
}
