import React, { useState, useMemo } from 'react';
import { AppData, Product, Customer } from '../../types';
import { formatDate, formatNumber } from '../../utils/formatters';
import * as XLSX from 'xlsx';
import {
  Users,
  Table as TableIcon,
  AlignJustify,
  Calendar,
  CalendarDays,
  Search,
  Filter,
  Download,
  CheckSquare,
  Square,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  FileSpreadsheet,
  Info
} from 'lucide-react';

interface CustomerSalesReportProps {
  data: AppData;
  startDate: string;
  endDate: string;
}

type ReportViewType = 'row' | 'column';

interface CustomerInfo {
  code: string;
  name: string;
  taxCode: string;
  idCard: string;
  address: string;
  phone: string;
}

interface RowReportItem {
  customer: CustomerInfo;
  isFirstOfCustomer: boolean;
  productCode: string;
  productName: string;
  saleUnit: string;
  date?: string;
  quantity: number;
}

interface ColumnReportRow {
  customer: CustomerInfo;
  isFirstOfCustomer: boolean;
  date?: string;
  productQuantities: Record<string, number>;
  totalQuantity: number;
  isSubtotalRow?: boolean;
}

export const CustomerSalesReport: React.FC<CustomerSalesReportProps> = ({
  data,
  startDate,
  endDate,
}) => {
  const [reportType, setReportType] = useState<ReportViewType>('row');
  const [showDateDetail, setShowDateDetail] = useState<boolean>(false);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [showProductFilterModal, setShowProductFilterModal] = useState<boolean>(false);

  // Selected products state
  const [selectAllProducts, setSelectAllProducts] = useState<boolean>(true);
  const [selectedProductCodes, setSelectedProductCodes] = useState<string[]>([]);

  // Customer map for rapid & accurate lookup of phone, taxCode, idCard, address
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    (data.customers || []).forEach((c) => {
      if (c.code) {
        map.set(c.code.trim().toLowerCase(), c);
        map.set(c.code.replace(/\s+/g, '').toLowerCase(), c);
      }
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [data.customers]);

  // All distinct products from product catalog + orders
  const allProducts = useMemo(() => {
    const map = new Map<string, Product>();
    (data.products || []).forEach((p) => {
      map.set(p.code, p);
    });
    // Also include any products in orders that might not be in product catalog
    (data.orders || []).forEach((o) => {
      (o.items || []).forEach((item) => {
        if (!map.has(item.productCode)) {
          map.set(item.productCode, {
            id: item.productCode,
            code: item.productCode,
            name: item.productName || item.productCode,
            saleUnit: item.saleUnit || 'Cái',
            purchaseUnit: item.saleUnit || 'Cái',
            conversionRate: 1,
            vatRate: item.vatRate || 0,
            category: 'Khác',
            profitMargin: 0,
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [data.products, data.orders]);

  // Determine active product codes
  const activeProductCodes = useMemo(() => {
    if (selectAllProducts) {
      return allProducts.map((p) => p.code);
    }
    return selectedProductCodes;
  }, [selectAllProducts, selectedProductCodes, allProducts]);

  const activeProductSet = useMemo(() => {
    return new Set(activeProductCodes);
  }, [activeProductCodes]);

  // Products filtered for the selection modal
  const filteredProductsForPicker = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [allProducts, productSearch]);

  const handleToggleProduct = (code: string) => {
    if (selectAllProducts) {
      const next = allProducts.map((p) => p.code).filter((c) => c !== code);
      setSelectAllProducts(false);
      setSelectedProductCodes(next);
    } else {
      let next: string[];
      if (selectedProductCodes.includes(code)) {
        next = selectedProductCodes.filter((c) => c !== code);
      } else {
        next = [...selectedProductCodes, code];
      }
      setSelectedProductCodes(next);
      if (next.length === allProducts.length) {
        setSelectAllProducts(true);
      }
    }
  };

  const handleSelectAllProducts = () => {
    setSelectAllProducts(true);
    setSelectedProductCodes(allProducts.map((p) => p.code));
  };

  const handleDeselectAllProducts = () => {
    setSelectAllProducts(false);
    setSelectedProductCodes([]);
  };

  // Check how many searched products are currently selected
  const searchedSelectedCount = useMemo(() => {
    return filteredProductsForPicker.filter((p) => activeProductSet.has(p.code)).length;
  }, [filteredProductsForPicker, activeProductSet]);

  const areAllSearchedSelected = useMemo(() => {
    if (filteredProductsForPicker.length === 0) return false;
    return searchedSelectedCount === filteredProductsForPicker.length;
  }, [filteredProductsForPicker, searchedSelectedCount]);

  // Select all products currently matched by search query
  const handleSelectSearchedProducts = () => {
    const currentSet = new Set(activeProductCodes);
    filteredProductsForPicker.forEach((p) => currentSet.add(p.code));
    const newSelected = Array.from(currentSet);
    if (newSelected.length === allProducts.length) {
      setSelectAllProducts(true);
      setSelectedProductCodes(allProducts.map((p) => p.code));
    } else {
      setSelectAllProducts(false);
      setSelectedProductCodes(newSelected);
    }
  };

  // Deselect all products currently matched by search query
  const handleDeselectSearchedProducts = () => {
    const searchedCodes = new Set(filteredProductsForPicker.map((p) => p.code));
    const newSelected = activeProductCodes.filter((c) => !searchedCodes.has(c));
    setSelectAllProducts(false);
    setSelectedProductCodes(newSelected);
  };

  // Toggle master searched checkbox
  const handleToggleAllSearched = () => {
    if (areAllSearchedSelected) {
      handleDeselectSearchedProducts();
    } else {
      handleSelectSearchedProducts();
    }
  };

  // Helper to extract clean customer details
  const getCustomerDetails = (order: {
    customerCode?: string;
    customerId?: string;
    customerName?: string;
    customerTaxCode?: string;
    customerIdCard?: string;
    customerAddress?: string;
  }): CustomerInfo => {
    const code = (order.customerCode || '').trim();
    const cleanCode = code.replace(/\s+/g, '').toLowerCase();
    const profile =
      customerMap.get(code.toLowerCase()) ||
      customerMap.get(cleanCode) ||
      (order.customerId ? customerMap.get(order.customerId) : undefined);

    return {
      code: code || profile?.code || 'KH-VANG-LAI',
      name: profile?.name || order.customerName || 'Khách vãng lai',
      taxCode: profile?.taxCode || order.customerTaxCode || '',
      idCard: profile?.idCard || order.customerIdCard || '',
      address: profile?.address || order.customerAddress || '',
      phone: profile?.phone || '',
    };
  };

  // Valid orders within date range
  const filteredOrders = useMemo(() => {
    return (data.orders || []).filter((o) => {
      if (o.deliveryStatus === 'cancelled') return false;
      const d = o.orderDate || '';
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }, [data.orders, startDate, endDate]);

  // Filtered by customer search if any
  const matchedOrders = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return filteredOrders;

    return filteredOrders.filter((o) => {
      const cust = getCustomerDetails(o);
      return (
        cust.code.toLowerCase().includes(q) ||
        cust.name.toLowerCase().includes(q) ||
        cust.phone.toLowerCase().includes(q) ||
        cust.taxCode.toLowerCase().includes(q) ||
        cust.idCard.toLowerCase().includes(q) ||
        cust.address.toLowerCase().includes(q)
      );
    });
  }, [filteredOrders, customerSearch, customerMap]);

  // List of products that are actually selected and will be displayed
  const displayedProducts = useMemo(() => {
    return allProducts.filter((p) => activeProductSet.has(p.code));
  }, [allProducts, activeProductSet]);

  // Product lookup map
  const productInfoMap = useMemo(() => {
    const map = new Map<string, Product>();
    allProducts.forEach((p) => map.set(p.code, p));
    return map;
  }, [allProducts]);

  // ==========================================
  // 1. DATA FOR BÁO CÁO THEO DÒNG (Row Report)
  // ==========================================
  const rowReportData = useMemo(() => {
    // Structure: Map<customerCode, { customer: CustomerInfo, itemsByProduct: Map<productCode, { totalQty: number, byDate: Map<string, number> }> }>
    const customerGroups = new Map<
      string,
      {
        customer: CustomerInfo;
        products: Map<
          string,
          {
            productCode: string;
            productName: string;
            saleUnit: string;
            totalQty: number;
            dateMap: Map<string, number>;
          }
        >;
      }
    >();

    matchedOrders.forEach((order) => {
      const cust = getCustomerDetails(order);
      const custKey = cust.code || cust.name;

      if (!customerGroups.has(custKey)) {
        customerGroups.set(custKey, {
          customer: cust,
          products: new Map(),
        });
      }

      const group = customerGroups.get(custKey)!;

      (order.items || []).forEach((item) => {
        if (!activeProductSet.has(item.productCode)) return;

        if (!group.products.has(item.productCode)) {
          const prodInfo = productInfoMap.get(item.productCode);
          group.products.set(item.productCode, {
            productCode: item.productCode,
            productName: item.productName || prodInfo?.name || item.productCode,
            saleUnit: item.saleUnit || prodInfo?.saleUnit || 'Cái',
            totalQty: 0,
            dateMap: new Map(),
          });
        }

        const prodRecord = group.products.get(item.productCode)!;
        const qty = Number(item.quantity) || 0;
        prodRecord.totalQty += qty;

        const orderDate = order.orderDate || 'Không xác định';
        prodRecord.dateMap.set(
          orderDate,
          (prodRecord.dateMap.get(orderDate) || 0) + qty
        );
      });
    });

    // Flatten to list of rows
    const rows: RowReportItem[] = [];
    const sortedCustomerKeys = Array.from(customerGroups.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    sortedCustomerKeys.forEach((custKey) => {
      const { customer, products } = customerGroups.get(custKey)!;
      if (products.size === 0) return;

      const sortedProductKeys = Array.from(products.keys()).sort((a, b) =>
        a.localeCompare(b)
      );

      let isFirstRowOfCust = true;

      sortedProductKeys.forEach((pCode) => {
        const prod = products.get(pCode)!;

        if (!showDateDetail) {
          // One summary row per product
          rows.push({
            customer,
            isFirstOfCustomer: isFirstRowOfCust,
            productCode: prod.productCode,
            productName: prod.productName,
            saleUnit: prod.saleUnit,
            quantity: prod.totalQty,
          });
          isFirstRowOfCust = false;
        } else {
          // Break down by sale dates
          const sortedDates = Array.from(prod.dateMap.keys()).sort();
          sortedDates.forEach((d) => {
            rows.push({
              customer,
              isFirstOfCustomer: isFirstRowOfCust,
              productCode: prod.productCode,
              productName: prod.productName,
              saleUnit: prod.saleUnit,
              date: d,
              quantity: prod.dateMap.get(d) || 0,
            });
            isFirstRowOfCust = false;
          });
        }
      });
    });

    return rows;
  }, [matchedOrders, activeProductSet, productInfoMap, showDateDetail]);

  // Total quantity for Row Report
  const rowReportTotalQty = useMemo(() => {
    return rowReportData.reduce((acc, r) => acc + r.quantity, 0);
  }, [rowReportData]);

  // =============================================
  // 2. DATA FOR BÁO CÁO THEO CỘT (Column Report)
  // =============================================
  const columnReportData = useMemo(() => {
    // Structure: Group by Customer -> if showDateDetail, group by Customer + Date
    const customerMapGroup = new Map<
      string,
      {
        customer: CustomerInfo;
        totalByProduct: Record<string, number>;
        byDate: Map<string, Record<string, number>>;
      }
    >();

    matchedOrders.forEach((order) => {
      const cust = getCustomerDetails(order);
      const custKey = cust.code || cust.name;

      if (!customerMapGroup.has(custKey)) {
        customerMapGroup.set(custKey, {
          customer: cust,
          totalByProduct: {},
          byDate: new Map(),
        });
      }

      const entry = customerMapGroup.get(custKey)!;
      const orderDate = order.orderDate || 'Không xác định';

      if (!entry.byDate.has(orderDate)) {
        entry.byDate.set(orderDate, {});
      }

      const dateObj = entry.byDate.get(orderDate)!;

      (order.items || []).forEach((item) => {
        if (!activeProductSet.has(item.productCode)) return;

        const qty = Number(item.quantity) || 0;
        entry.totalByProduct[item.productCode] =
          (entry.totalByProduct[item.productCode] || 0) + qty;
        dateObj[item.productCode] = (dateObj[item.productCode] || 0) + qty;
      });
    });

    const rows: ColumnReportRow[] = [];
    const sortedCustomerKeys = Array.from(customerMapGroup.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    sortedCustomerKeys.forEach((custKey) => {
      const { customer, totalByProduct, byDate } = customerMapGroup.get(custKey)!;

      // Check if this customer actually has any sales in active products
      const hasAnyQty = Object.values(totalByProduct).some((q) => q > 0);
      if (!hasAnyQty) return;

      if (!showDateDetail) {
        // 1 row per customer
        let rowSum = 0;
        const pQty: Record<string, number> = {};
        displayedProducts.forEach((p) => {
          const q = totalByProduct[p.code] || 0;
          pQty[p.code] = q;
          rowSum += q;
        });

        rows.push({
          customer,
          isFirstOfCustomer: true,
          productQuantities: pQty,
          totalQuantity: rowSum,
        });
      } else {
        // Detailed rows per date
        const sortedDates = Array.from(byDate.keys()).sort();
        let isFirstRowOfCust = true;

        sortedDates.forEach((d) => {
          const dateQtys = byDate.get(d)!;
          let dateSum = 0;
          const pQty: Record<string, number> = {};

          displayedProducts.forEach((p) => {
            const q = dateQtys[p.code] || 0;
            pQty[p.code] = q;
            dateSum += q;
          });

          // Only add row if that date had some quantities of selected products
          if (dateSum > 0) {
            rows.push({
              customer,
              isFirstOfCustomer: isFirstRowOfCust,
              date: d,
              productQuantities: pQty,
              totalQuantity: dateSum,
            });
            isFirstRowOfCust = false;
          }
        });
      }
    });

    return rows;
  }, [matchedOrders, activeProductSet, displayedProducts, showDateDetail]);

  // Totals per product column for Column Report
  const columnProductTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    let grandSum = 0;

    displayedProducts.forEach((p) => {
      totals[p.code] = 0;
    });

    columnReportData.forEach((row) => {
      displayedProducts.forEach((p) => {
        const q = row.productQuantities[p.code] || 0;
        totals[p.code] += q;
      });
      grandSum += row.totalQuantity;
    });

    return { totals, grandSum };
  }, [displayedProducts, columnReportData]);

  // Unique customer count
  const uniqueCustomerCount = useMemo(() => {
    const set = new Set<string>();
    if (reportType === 'row') {
      rowReportData.forEach((r) => set.add(r.customer.code));
    } else {
      columnReportData.forEach((r) => set.add(r.customer.code));
    }
    return set.size;
  }, [reportType, rowReportData, columnReportData]);

  // Total quantity overall
  const grandTotalQuantity = useMemo(() => {
    if (reportType === 'row') return rowReportTotalQty;
    return columnProductTotals.grandSum;
  }, [reportType, rowReportTotalQty, columnProductTotals]);

  // ==========================================
  // EXCEL EXPORT HANDLER
  // ==========================================
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (reportType === 'row') {
      // Export Row-based report
      const excelRows = rowReportData.map((r, idx) => {
        const item: Record<string, any> = {
          'STT': idx + 1,
          'Mã Khách hàng': r.isFirstOfCustomer ? r.customer.code : '',
          'Tên khách hàng': r.isFirstOfCustomer ? r.customer.name : '',
          'MST': r.isFirstOfCustomer ? r.customer.taxCode : '',
          'Số CCCD': r.isFirstOfCustomer ? r.customer.idCard : '',
          'Địa chỉ': r.isFirstOfCustomer ? r.customer.address : '',
          'Số Điện Thoại': r.isFirstOfCustomer ? r.customer.phone : '',
          'Mã HH': r.productCode,
          'Tên hàng hóa': r.productName,
          'ĐVT': r.saleUnit,
        };

        if (showDateDetail) {
          item['Ngày bán'] = r.date ? formatDate(r.date) : '';
        }

        item['Số lượng'] = r.quantity;

        return item;
      });

      // Add Total Row
      if (excelRows.length > 0) {
        const totalRow: Record<string, any> = {
          'STT': 'Tổng cộng',
          'Mã Khách hàng': '',
          'Tên khách hàng': '',
          'MST': '',
          'Số CCCD': '',
          'Địa chỉ': '',
          'Số Điện Thoại': '',
          'Mã HH': '',
          'Tên hàng hóa': '',
          'ĐVT': '',
        };
        if (showDateDetail) {
          totalRow['Ngày bán'] = '';
        }
        totalRow['Số lượng'] = rowReportTotalQty;
        excelRows.push(totalRow);
      }

      const ws = XLSX.utils.json_to_sheet(excelRows);
      XLSX.utils.book_append_sheet(wb, ws, 'BC_Theo_Dong');
      XLSX.writeFile(
        wb,
        `Bao_Cao_Ban_Hang_Theo_Dong_${showDateDetail ? 'ChiTietNgay_' : ''}${startDate}_den_${endDate}.xlsx`
      );
    } else {
      // Export Column-based report
      const excelRows = columnReportData.map((r, idx) => {
        const item: Record<string, any> = {
          'STT': idx + 1,
          'Mã Khách hàng': r.isFirstOfCustomer ? r.customer.code : '',
          'Tên khách hàng': r.isFirstOfCustomer ? r.customer.name : '',
          'MST': r.isFirstOfCustomer ? r.customer.taxCode : '',
          'Số CCCD': r.isFirstOfCustomer ? r.customer.idCard : '',
          'Địa chỉ': r.isFirstOfCustomer ? r.customer.address : '',
          'Số Điện Thoại': r.isFirstOfCustomer ? r.customer.phone : '',
        };

        if (showDateDetail) {
          item['Ngày bán'] = r.date ? formatDate(r.date) : '';
        }

        // Each individual product code column
        displayedProducts.forEach((p) => {
          item[p.code] = r.productQuantities[p.code] || 0;
        });

        item['Tổng cộng SL'] = r.totalQuantity;

        return item;
      });

      // Total Row
      if (excelRows.length > 0) {
        const totalRow: Record<string, any> = {
          'STT': 'Tổng cộng',
          'Mã Khách hàng': '',
          'Tên khách hàng': '',
          'MST': '',
          'Số CCCD': '',
          'Địa chỉ': '',
          'Số Điện Thoại': '',
        };
        if (showDateDetail) {
          totalRow['Ngày bán'] = '';
        }
        displayedProducts.forEach((p) => {
          totalRow[p.code] = columnProductTotals.totals[p.code] || 0;
        });
        totalRow['Tổng cộng SL'] = columnProductTotals.grandSum;
        excelRows.push(totalRow);
      }

      const ws = XLSX.utils.json_to_sheet(excelRows);
      XLSX.utils.book_append_sheet(wb, ws, 'BC_Theo_Cot');
      XLSX.writeFile(
        wb,
        `Bao_Cao_Ban_Hang_Theo_Cot_${showDateDetail ? 'ChiTietNgay_' : ''}${startDate}_den_${endDate}.xlsx`
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Description Banner */}
      <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Báo cáo số lượng hàng bán cho từng khách hàng
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Tổng hợp sản lượng tiêu thụ theo khách hàng với 2 phương thức hiển thị (theo dòng hoặc theo cột). Các thông tin định danh khách hàng chỉ thể hiện tại dòng đầu tiên của mỗi khách hàng.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 bg-white/80 backdrop-blur-xs px-4 py-2 rounded-xl border border-indigo-100 self-start md:self-auto">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Khách mua</div>
            <div className="text-base font-black text-indigo-700">
              {formatNumber(uniqueCustomerCount)}
            </div>
          </div>
          <div className="h-7 w-px bg-slate-200" />
          <div>
            <div className="text-[11px] font-medium text-slate-500">Tổng SL bán</div>
            <div className="text-base font-black text-emerald-700">
              {formatNumber(grandTotalQuantity)}
            </div>
          </div>
          <div className="h-7 w-px bg-slate-200" />
          <div>
            <div className="text-[11px] font-medium text-slate-500">Hàng hóa báo cáo</div>
            <div className="text-base font-black text-slate-700">
              {displayedProducts.length} <span className="text-[10px] font-normal text-slate-400">/ {allProducts.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 1. Report Type Switcher: Theo Dòng vs Theo Cột */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setReportType('row')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                reportType === 'row'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span>1. Báo cáo theo dòng</span>
            </button>
            <button
              type="button"
              onClick={() => setReportType('column')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                reportType === 'column'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>2. Báo cáo theo cột</span>
            </button>
          </div>

          {/* 2. Date Detail Toggle Button */}
          <button
            type="button"
            onClick={() => setShowDateDetail((prev) => !prev)}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              showDateDetail
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>
              {showDateDetail
                ? 'Đang hiển thị chi tiết ngày bán'
                : 'Hiển thị chi tiết ngày bán'}
            </span>
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                showDateDetail ? 'bg-emerald-300 animate-pulse' : 'bg-slate-300'
              }`}
            />
          </button>

          {/* 3. Product Selection Filter Button */}
          <button
            type="button"
            onClick={() => setShowProductFilterModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-800 hover:bg-indigo-100/80 transition-all cursor-pointer shadow-2xs"
          >
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Lựa chọn Hàng hóa</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-200 text-indigo-900 font-extrabold">
              {selectAllProducts ? 'Tất cả' : `${selectedProductCodes.length}/${allProducts.length}`}
            </span>
          </button>

          {/* 4. Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer ml-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Excel {reportType === 'row' ? 'Theo dòng' : 'Theo cột'}</span>
          </button>
        </div>

        {/* Search & Active Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Customer Search */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm mã, tên khách, SĐT, MST, CCCD..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white"
            />
            {customerSearch && (
              <button
                type="button"
                onClick={() => setCustomerSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Active Product Filter Info Tag */}
          {!selectAllProducts && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
              <Package className="w-3.5 h-3.5" />
              <span>Đang lọc {selectedProductCodes.length} mặt hàng</span>
              <button
                type="button"
                onClick={handleSelectAllProducts}
                className="text-[11px] font-bold underline hover:text-indigo-950 ml-1 cursor-pointer"
              >
                Đặt lại (Tất cả)
              </button>
            </div>
          )}

          <div className="text-[11px] text-slate-500 italic">
            * Dữ liệu từ ngày <strong className="text-slate-700">{formatDate(startDate)}</strong> đến{' '}
            <strong className="text-slate-700">{formatDate(endDate)}</strong>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. TABLE: BÁO CÁO THEO DÒNG                             */}
      {/* ======================================================== */}
      {reportType === 'row' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
              <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider shadow-xs">
                <tr>
                  <th className="p-3 w-10 text-center border-r border-slate-200 sticky left-0 bg-slate-100 z-30">
                    STT
                  </th>
                  <th className="p-3 text-left font-mono border-r border-slate-200 min-w-28">
                    Mã Khách hàng
                  </th>
                  <th className="p-3 text-left border-r border-slate-200 min-w-44">
                    Tên khách hàng
                  </th>
                  <th className="p-3 text-left font-mono border-r border-slate-200 min-w-24">
                    MST
                  </th>
                  <th className="p-3 text-left font-mono border-r border-slate-200 min-w-28">
                    Số CCCD
                  </th>
                  <th className="p-3 text-left border-r border-slate-200 min-w-44">
                    Địa chỉ
                  </th>
                  <th className="p-3 text-left font-mono border-r border-slate-200 min-w-28">
                    Số Điện Thoại
                  </th>
                  <th className="p-3 text-left font-mono border-r border-slate-200 bg-indigo-50/70 text-indigo-950 min-w-24">
                    Mã HH
                  </th>
                  <th className="p-3 text-left border-r border-slate-200 bg-indigo-50/70 text-indigo-950 min-w-44">
                    Tên hàng hóa
                  </th>
                  <th className="p-3 text-center border-r border-slate-200 bg-indigo-50/70 text-indigo-950 min-w-16">
                    ĐVT
                  </th>
                  {showDateDetail && (
                    <th className="p-3 text-center border-r border-slate-200 bg-amber-50 text-amber-950 min-w-28">
                      Ngày bán
                    </th>
                  )}
                  <th className="p-3 text-right bg-emerald-50 text-emerald-950 font-black min-w-28">
                    Số lượng
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rowReportData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showDateDetail ? 12 : 11}
                      className="p-12 text-center text-slate-400"
                    >
                      Không tìm thấy dữ liệu bán hàng phù hợp với điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  rowReportData.map((row, idx) => {
                    const isNewCust = row.isFirstOfCustomer;

                    return (
                      <tr
                        key={`${row.customer.code}-${row.productCode}-${row.date || ''}-${idx}`}
                        className={`hover:bg-indigo-50/20 transition-colors ${
                          isNewCust ? 'border-t-2 border-slate-300 bg-slate-50/30' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center text-slate-400 border-r border-slate-100 font-mono">
                          {idx + 1}
                        </td>

                        {/* Customer Information (shown only on the first row of each customer!) */}
                        <td className="p-2.5 font-mono font-bold text-indigo-700 border-r border-slate-100 whitespace-nowrap">
                          {isNewCust ? row.customer.code : ''}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-900 border-r border-slate-100">
                          {isNewCust ? row.customer.name : ''}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                          {isNewCust ? (row.customer.taxCode || '—') : ''}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                          {isNewCust ? (row.customer.idCard || '—') : ''}
                        </td>
                        <td className="p-2.5 text-slate-600 border-r border-slate-100 max-w-xs truncate" title={isNewCust ? row.customer.address : ''}>
                          {isNewCust ? (row.customer.address || '—') : ''}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                          {isNewCust ? (row.customer.phone || '—') : ''}
                        </td>

                        {/* Product Information */}
                        <td className="p-2.5 font-mono font-semibold text-indigo-900 bg-indigo-50/20 border-r border-slate-100 whitespace-nowrap">
                          {row.productCode}
                        </td>
                        <td className="p-2.5 font-medium text-slate-800 border-r border-slate-100">
                          {row.productName}
                        </td>
                        <td className="p-2.5 text-center text-slate-600 border-r border-slate-100">
                          {row.saleUnit}
                        </td>

                        {/* Date Detail Column (if enabled) */}
                        {showDateDetail && (
                          <td className="p-2.5 text-center font-mono text-amber-900 bg-amber-50/30 border-r border-slate-100 whitespace-nowrap">
                            {row.date ? formatDate(row.date) : '—'}
                          </td>
                        )}

                        {/* Quantity */}
                        <td className="p-2.5 text-right font-black text-emerald-800 bg-emerald-50/20">
                          {formatNumber(row.quantity)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {rowReportData.length > 0 && (
                <tfoot className="sticky bottom-0 z-10 bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 shadow-lg">
                  <tr>
                    <td colSpan={showDateDetail ? 11 : 10} className="p-3 text-right uppercase tracking-wider">
                      Tổng cộng số lượng hàng bán:
                    </td>
                    <td className="p-3 text-right font-black text-emerald-900 bg-emerald-100 text-sm">
                      {formatNumber(rowReportTotalQty)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. TABLE: BÁO CÁO THEO CỘT (Matrix / Pivot by Product)   */}
      {/* ======================================================== */}
      {reportType === 'column' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
              <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider shadow-xs">
                <tr>
                  <th className="p-3 w-10 text-center border-r border-slate-200 sticky left-0 bg-slate-100 z-30">
                    STT
                  </th>
                  <th className="p-3 text-left font-mono border-r border-slate-200 min-w-28">
                    Mã Khách hàng
                  </th>
                  <th className="p-3 text-left border-r border-slate-200 min-w-44">
                    Tên khách hàng
                  </th>
                  <th className="p-3 text-left font-mono border-r border-slate-200 min-w-24">
                    MST
                  </th>
                  <th className="p-3 text-left font-mono border-r border-slate-200 min-w-28">
                    Số CCCD
                  </th>
                  <th className="p-3 text-left border-r border-slate-200 min-w-44">
                    Địa chỉ
                  </th>
                  <th className="p-3 text-left font-mono border-r border-slate-200 min-w-28">
                    Số Điện Thoại
                  </th>

                  {showDateDetail && (
                    <th className="p-3 text-center border-r border-slate-200 bg-amber-50 text-amber-950 min-w-28 whitespace-nowrap">
                      Ngày bán
                    </th>
                  )}

                  {/* Individual Product Code Columns */}
                  {displayedProducts.map((p) => (
                    <th
                      key={p.code}
                      className="p-3 text-right bg-indigo-50/80 border-r border-slate-200 text-indigo-950 font-mono whitespace-nowrap min-w-28"
                      title={`${p.code} - ${p.name} (${p.saleUnit})`}
                    >
                      <div className="flex flex-col items-end">
                        <span className="font-black text-indigo-900">{p.code}</span>
                        <span className="text-[10px] font-normal text-slate-500 truncate max-w-28">
                          {p.name}
                        </span>
                      </div>
                    </th>
                  ))}

                  <th className="p-3 text-right bg-emerald-50 text-emerald-950 font-black min-w-28">
                    Tổng SL
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {columnReportData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7 + (showDateDetail ? 1 : 0) + displayedProducts.length + 1}
                      className="p-12 text-center text-slate-400"
                    >
                      Không tìm thấy dữ liệu bán hàng phù hợp với điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  columnReportData.map((row, idx) => {
                    const isNewCust = row.isFirstOfCustomer;

                    return (
                      <tr
                        key={`${row.customer.code}-${row.date || ''}-${idx}`}
                        className={`hover:bg-indigo-50/20 transition-colors ${
                          isNewCust ? 'border-t-2 border-slate-300 bg-slate-50/30' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center text-slate-400 border-r border-slate-100 font-mono">
                          {idx + 1}
                        </td>

                        {/* Customer Information (shown only on first row of each customer!) */}
                        <td className="p-2.5 font-mono font-bold text-indigo-700 border-r border-slate-100 whitespace-nowrap">
                          {isNewCust ? row.customer.code : ''}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-900 border-r border-slate-100">
                          {isNewCust ? row.customer.name : ''}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                          {isNewCust ? (row.customer.taxCode || '—') : ''}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                          {isNewCust ? (row.customer.idCard || '—') : ''}
                        </td>
                        <td className="p-2.5 text-slate-600 border-r border-slate-100 max-w-xs truncate" title={isNewCust ? row.customer.address : ''}>
                          {isNewCust ? (row.customer.address || '—') : ''}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                          {isNewCust ? (row.customer.phone || '—') : ''}
                        </td>

                        {/* Date detail if enabled */}
                        {showDateDetail && (
                          <td className="p-2.5 text-center font-mono text-amber-900 bg-amber-50/30 border-r border-slate-100 whitespace-nowrap">
                            {row.date ? formatDate(row.date) : '—'}
                          </td>
                        )}

                        {/* Each Product Column */}
                        {displayedProducts.map((p) => {
                          const qty = row.productQuantities[p.code] || 0;
                          return (
                            <td
                              key={p.code}
                              className={`p-2.5 text-right font-mono border-r border-slate-100 ${
                                qty > 0
                                  ? 'font-bold text-indigo-950 bg-indigo-50/30'
                                  : 'text-slate-300'
                              }`}
                            >
                              {qty > 0 ? formatNumber(qty) : '—'}
                            </td>
                          );
                        })}

                        {/* Total Quantity */}
                        <td className="p-2.5 text-right font-black text-emerald-800 bg-emerald-50/20">
                          {formatNumber(row.totalQuantity)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {columnReportData.length > 0 && (
                <tfoot className="sticky bottom-0 z-10 bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 shadow-lg">
                  <tr>
                    <td
                      colSpan={7 + (showDateDetail ? 1 : 0)}
                      className="p-3 text-right uppercase tracking-wider"
                    >
                      Tổng cộng theo mặt hàng:
                    </td>
                    {displayedProducts.map((p) => {
                      const totalForP = columnProductTotals.totals[p.code] || 0;
                      return (
                        <td
                          key={p.code}
                          className="p-3 text-right font-mono font-black text-indigo-950 bg-indigo-100 border-r border-indigo-200"
                        >
                          {totalForP > 0 ? formatNumber(totalForP) : '0'}
                        </td>
                      );
                    })}
                    <td className="p-3 text-right font-black text-emerald-950 bg-emerald-200 text-sm">
                      {formatNumber(columnProductTotals.grandSum)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL / DRAWER: LỰA CHỌN HÀNG HÓA CẦN BÁO CÁO             */}
      {/* ======================================================== */}
      {showProductFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Lựa chọn Hàng hóa cần đưa vào Báo cáo
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Hiển thị danh sách sản phẩm dạng list, hỗ trợ tìm kiếm và chọn nhanh toàn bộ sản phẩm tìm kiếm
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProductFilterModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Toolbar */}
            <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm mã hoặc tên hàng hóa..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {productSearch ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSelectSearchedProducts}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs cursor-pointer transition-colors"
                      title="Chọn tất cả các mặt hàng đang hiển thị trong kết quả tìm kiếm"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Chọn tất cả tìm kiếm ({filteredProductsForPicker.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectSearchedProducts}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
                      title="Bỏ chọn các mặt hàng trong kết quả tìm kiếm"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Bỏ chọn tìm kiếm</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAllProducts}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                      title="Chọn toàn bộ sản phẩm trong danh mục"
                    >
                      <span>Chọn toàn bộ kho ({allProducts.length})</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSelectAllProducts}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer transition-colors"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Chọn tất cả ({allProducts.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllProducts}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Bỏ chọn tất cả</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Product List Table (Dạng List) */}
            <div className="flex-1 overflow-y-auto max-h-[60vh]">
              {filteredProductsForPicker.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Không tìm thấy mặt hàng nào phù hợp với từ khóa "{productSearch}".
                </div>
              ) : (
                <table className="w-full text-xs text-left border-collapse min-w-[650px]">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200 shadow-2xs">
                    <tr>
                      <th className="p-2.5 w-12 text-center border-r border-slate-200">
                        <input
                          type="checkbox"
                          checked={areAllSearchedSelected}
                          onChange={handleToggleAllSearched}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          title={
                            areAllSearchedSelected
                              ? 'Bỏ chọn toàn bộ sản phẩm đang tìm kiếm'
                              : 'Chọn toàn bộ sản phẩm đang tìm kiếm'
                          }
                        />
                      </th>
                      <th className="p-2.5 w-12 text-center border-r border-slate-200">
                        STT
                      </th>
                      <th className="p-2.5 w-36 text-left border-r border-slate-200 font-mono">
                        Mã HH
                      </th>
                      <th className="p-2.5 min-w-56 text-left border-r border-slate-200">
                        Tên hàng hóa
                      </th>
                      <th className="p-2.5 w-24 text-center border-r border-slate-200">
                        ĐVT
                      </th>
                      <th className="p-2.5 w-36 text-left border-r border-slate-200">
                        Nhóm / Loại
                      </th>
                      <th className="p-2.5 w-28 text-center">
                        Trạng thái
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProductsForPicker.map((prod, idx) => {
                      const isSelected = activeProductSet.has(prod.code);

                      return (
                        <tr
                          key={prod.code}
                          onClick={() => handleToggleProduct(prod.code)}
                          className={`cursor-pointer transition-colors select-none ${
                            isSelected
                              ? 'bg-indigo-50/60 hover:bg-indigo-100/50'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <td
                            className="p-2.5 text-center border-r border-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleProduct(prod.code)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5 text-center text-slate-400 font-mono border-r border-slate-100">
                            {idx + 1}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-indigo-700 border-r border-slate-100 whitespace-nowrap">
                            {prod.code}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-900 border-r border-slate-100">
                            {prod.name}
                          </td>
                          <td className="p-2.5 text-center text-slate-600 border-r border-slate-100 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {prod.saleUnit}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-500 border-r border-slate-100 whitespace-nowrap">
                            {prod.category || '—'}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Đã chọn
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-400">
                                Chưa chọn
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Đã chọn <strong className="text-indigo-700 font-bold">{activeProductCodes.length}</strong> / {allProducts.length} mặt hàng
                {productSearch && (
                  <span className="text-slate-500 ml-1">
                    (Tìm thấy <strong>{filteredProductsForPicker.length}</strong>, đã chọn <strong>{searchedSelectedCount}</strong>)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeselectAllProducts}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                >
                  Bỏ chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductFilterModal(false)}
                  className="px-5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer transition-colors"
                >
                  Xác nhận ({activeProductCodes.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
