import React, { useState, useMemo, useEffect } from 'react';
import { Order, OrderCodeRule, Product, Customer } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { formatOrderCode, extractSequenceNumber } from '../../services/orderCodeService';
import { CodeSyncDetail } from '../../services/codeSyncService';
import { CustomerModal } from './CustomerModal';
import { ProductModal } from '../Products/ProductModal';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Hash,
  ArrowRight,
  Ban,
  Package,
  Users,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Sparkles,
  UserPlus,
  PackagePlus,
  ShieldAlert,
  CheckSquare,
  Square,
  Edit,
  Plus
} from 'lucide-react';

interface OrderImportCheckModalProps {
  isOpen: boolean;
  importedOrders: Order[];
  existingOrders: Order[];
  existingProducts?: Product[];
  existingCustomers?: Customer[];
  rules: OrderCodeRule[];
  defaultRuleId?: string;
  productSyncList?: CodeSyncDetail[];
  customerSyncList?: CodeSyncDetail[];
  onConfirmImport: (options: {
    finalOrders: Order[];
    newCustomersToAdd: Customer[];
    newProductsToAdd: Product[];
  }) => void;
  onCancel: () => void;
}

export const OrderImportCheckModal: React.FC<OrderImportCheckModalProps> = ({
  isOpen,
  importedOrders,
  existingOrders,
  existingProducts = [],
  existingCustomers = [],
  rules,
  defaultRuleId,
  productSyncList = [],
  customerSyncList = [],
  onConfirmImport,
  onCancel,
}) => {
  const initialRule = useMemo(() => {
    return (
      rules.find((r) => r.id === defaultRuleId) ||
      rules.find((r) => r.isDefault) ||
      rules[0]
    );
  }, [rules, defaultRuleId]);

  const [codeMode, setCodeMode] = useState<'rule' | 'keep_excel'>('rule');
  const [selectedRuleId, setSelectedRuleId] = useState<string>(initialRule?.id || '');
  const [activeTab, setActiveTab] = useState<'orders' | 'new_customers' | 'new_products' | 'products' | 'customers'>('orders');
  const [orderSubFilter, setOrderSubFilter] = useState<'all' | 'red_flagged' | 'valid'>('all');

  // Multi-select individual orders
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Checkboxes for mandatory catalog synchronization
  const [autoAddNewCustomers, setAutoAddNewCustomers] = useState<boolean>(true);
  const [autoAddNewProducts, setAutoAddNewProducts] = useState<boolean>(true);

  // Manually added / customized customers & products before import
  const [manuallyAddedCustomers, setManuallyAddedCustomers] = useState<Customer[]>([]);
  const [manuallyAddedProducts, setManuallyAddedProducts] = useState<Product[]>([]);

  // Modals for manual customer/product addition
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Search & Filters for Products tab
  const [productSearch, setProductSearch] = useState('');
  const [productFilterStatus, setProductFilterStatus] = useState<'all' | 'adjusted' | 'exact' | 'missing'>('all');

  // Search & Filters for Customers tab
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilterStatus, setCustomerFilterStatus] = useState<'all' | 'adjusted' | 'exact' | 'missing'>('all');

  // Combined Catalogs Maps (Existing + Manually Added)
  const allKnownCustomersMap = useMemo(() => {
    const map = new Map<string, Customer>();
    existingCustomers.forEach((c) => {
      map.set(c.code.trim().toUpperCase(), c);
    });
    manuallyAddedCustomers.forEach((c) => {
      map.set(c.code.trim().toUpperCase(), c);
    });
    return map;
  }, [existingCustomers, manuallyAddedCustomers]);

  const allKnownProductsMap = useMemo(() => {
    const map = new Map<string, Product>();
    existingProducts.forEach((p) => {
      map.set(p.code.trim().toUpperCase(), p);
    });
    manuallyAddedProducts.forEach((p) => {
      map.set(p.code.trim().toUpperCase(), p);
    });
    return map;
  }, [existingProducts, manuallyAddedProducts]);

  // Detect New Customers from imported orders (excluding ones already in catalog or manually added)
  const detectedNewCustomers = useMemo<Customer[]>(() => {
    const map = new Map<string, Customer>();
    importedOrders.forEach((ord) => {
      const rawCode = ord.customerCode?.trim().toUpperCase();
      if (!rawCode) return;
      if (!allKnownCustomersMap.has(rawCode) && !map.has(rawCode)) {
        map.set(rawCode, {
          id: `cust-auto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          code: rawCode,
          name: ord.customerName || `Khách hàng ${rawCode}`,
          shortName: ord.customerName || `Khách hàng ${rawCode}`,
          taxCode: ord.customerTaxCode || '',
          idCard: ord.customerIdCard || '',
          address: ord.customerAddress || '',
          phone: '',
          type: ord.customerTaxCode ? 'organization' : 'personal',
          notes: `Tự động tạo từ đơn hàng Excel (${ord.orderCode})`,
          createdAt: new Date().toISOString(),
        });
      }
    });
    return Array.from(map.values());
  }, [importedOrders, allKnownCustomersMap]);

  // Detect New Products from all items in imported orders (excluding ones already in catalog or manually added)
  const detectedNewProducts = useMemo<Product[]>(() => {
    const map = new Map<string, Product>();
    importedOrders.forEach((ord) => {
      ord.items?.forEach((it) => {
        const rawCode = it.productCode?.trim().toUpperCase();
        if (!rawCode) return;
        if (!allKnownProductsMap.has(rawCode) && !map.has(rawCode)) {
          const prePrice = it.preTaxPrice || 0;
          const vatRate = it.vatRate ?? 10;
          const postPrice = it.postTaxPrice || (prePrice > 0 ? prePrice * (1 + vatRate / 100) : 0);
          map.set(rawCode, {
            id: `prod-auto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            code: rawCode,
            name: it.productName || rawCode,
            category: 'Hàng bán Excel',
            saleUnit: it.saleUnit || 'Cái',
            purchaseUnit: it.saleUnit || 'Cái',
            conversionRate: 1,
            vatRate: vatRate,
            defaultSalePrice: postPrice,
            profitMargin: 20,
            notes: `Tự động tạo từ đơn hàng Excel (${ord.orderCode})`,
          });
        }
      });
    });
    return Array.from(map.values());
  }, [importedOrders, allKnownProductsMap]);

  // Counts of code adjustments
  const adjustedProductCount = useMemo(
    () => productSyncList.filter((p) => p.isAdjusted).length,
    [productSyncList]
  );
  const missingProductCount = useMemo(
    () => productSyncList.filter((p) => p.status === 'not_in_catalog').length,
    [productSyncList]
  );
  const adjustedCustomerCount = useMemo(
    () => customerSyncList.filter((c) => c.isAdjusted).length,
    [customerSyncList]
  );
  const missingCustomerCount = useMemo(
    () => customerSyncList.filter((c) => c.status === 'not_in_catalog').length,
    [customerSyncList]
  );

  // Recalculate orders whenever selected rule or mode changes
  const computedOrders = useMemo(() => {
    if (!importedOrders || importedOrders.length === 0) return [];

    if (codeMode === 'keep_excel') {
      return importedOrders;
    }

    const currentRule = rules.find((r) => r.id === selectedRuleId) || initialRule;
    if (!currentRule) return importedOrders;

    // Clone and sort imported orders by orderDate ascending to guarantee sequential numbering
    const sorted = [...importedOrders].map((ord, originalIdx) => ({
      ord,
      originalIdx,
    }));

    sorted.sort((a, b) => {
      const dateCmp = a.ord.orderDate.localeCompare(b.ord.orderDate);
      if (dateCmp !== 0) return dateCmp;
      return a.originalIdx - b.originalIdx;
    });

    let startingSeq = 0;
    for (const ex of existingOrders) {
      const seq = extractSequenceNumber(ex.orderCode, currentRule, ex.orderDate);
      if (seq !== null && seq > startingSeq) {
        startingSeq = seq;
      }
    }

    let currentSeq = startingSeq;
    const isPerDateRule = currentRule.patternType === 'prefix_and_date' || currentRule.patternType === 'date_only';
    const renumberedMap = new Map<string, string>();

    if (isPerDateRule) {
      const dateMap = new Map<string, typeof sorted>();
      sorted.forEach((item) => {
        const d = item.ord.orderDate;
        if (!dateMap.has(d)) dateMap.set(d, []);
        dateMap.get(d)!.push(item);
      });

      for (const [, itemsForDate] of dateMap.entries()) {
        let maxForDate = 0;
        for (const ex of existingOrders) {
          if (itemsForDate.length > 0 && ex.orderDate === itemsForDate[0].ord.orderDate) {
            const seq = extractSequenceNumber(ex.orderCode, currentRule, ex.orderDate);
            if (seq !== null && seq > maxForDate) {
              maxForDate = seq;
            }
          }
        }
        let seq = maxForDate;
        itemsForDate.forEach((item) => {
          seq += 1;
          const code = formatOrderCode(currentRule, seq, item.ord.orderDate);
          renumberedMap.set(item.ord.id, code);
        });
      }
    } else {
      sorted.forEach((item) => {
        currentSeq += 1;
        const code = formatOrderCode(currentRule, currentSeq, item.ord.orderDate);
        renumberedMap.set(item.ord.id, code);
      });
    }

    return importedOrders.map((ord) => {
      const newCode = renumberedMap.get(ord.id) || ord.orderCode;
      return {
        ...ord,
        orderCode: newCode,
        orderCodeRuleId: currentRule.id,
      };
    });
  }, [importedOrders, existingOrders, rules, selectedRuleId, initialRule, codeMode]);

  // Synchronize default selectedOrderIds when computedOrders is prepared
  useEffect(() => {
    if (computedOrders && computedOrders.length > 0) {
      setSelectedOrderIds(computedOrders.map((o) => o.id));
    }
  }, [computedOrders]);

  // Analyze each order against all known customers & products (including manually added ones)
  const orderCatalogAnalysis = useMemo(() => {
    return computedOrders.map((ord) => {
      const custCodeUpper = ord.customerCode?.trim().toUpperCase();
      const isCustomerUncataloged = !allKnownCustomersMap.has(custCodeUpper);
      const isCustomerManuallyAdded = manuallyAddedCustomers.some(
        (c) => c.code.trim().toUpperCase() === custCodeUpper
      );

      const uncatalogedItems =
        ord.items?.filter((it) => !allKnownProductsMap.has(it.productCode?.trim().toUpperCase())) || [];
      const hasUncatalogedProducts = uncatalogedItems.length > 0;
      const isRedFlagged = isCustomerUncataloged || hasUncatalogedProducts;

      return {
        ord,
        isCustomerUncataloged,
        isCustomerManuallyAdded,
        hasUncatalogedProducts,
        uncatalogedItems,
        isRedFlagged,
      };
    });
  }, [computedOrders, allKnownCustomersMap, allKnownProductsMap, manuallyAddedCustomers]);

  // Red-flagged orders
  const redFlaggedOrders = useMemo(
    () => orderCatalogAnalysis.filter((item) => item.isRedFlagged),
    [orderCatalogAnalysis]
  );

  // Valid orders
  const validOrders = useMemo(
    () => orderCatalogAnalysis.filter((item) => !item.isRedFlagged).map((item) => item.ord),
    [orderCatalogAnalysis]
  );

  // Filtered orders in preview table based on sub-filter
  const displayedOrdersAnalysis = useMemo(() => {
    if (orderSubFilter === 'red_flagged') {
      return orderCatalogAnalysis.filter((item) => item.isRedFlagged);
    }
    if (orderSubFilter === 'valid') {
      return orderCatalogAnalysis.filter((item) => !item.isRedFlagged);
    }
    return orderCatalogAnalysis;
  }, [orderCatalogAnalysis, orderSubFilter]);

  // Check for duplicate codes against existing orders
  const duplicateCodeSet = useMemo(() => {
    const existingCodeSet = new Set(existingOrders.map((o) => o.orderCode.trim().toUpperCase()));
    const dupes = new Set<string>();
    computedOrders.forEach((o) => {
      const codeUpper = o.orderCode.trim().toUpperCase();
      if (existingCodeSet.has(codeUpper)) {
        dupes.add(codeUpper);
      }
    });
    return dupes;
  }, [computedOrders, existingOrders]);

  // Filtered Products List for tab 4
  const filteredProductSyncList = useMemo(() => {
    return productSyncList.filter((item: CodeSyncDetail) => {
      if (productFilterStatus === 'adjusted' && !item.isAdjusted) return false;
      if (productFilterStatus === 'exact' && (item.isAdjusted || item.status !== 'exact_matched')) return false;
      if (productFilterStatus === 'missing' && item.status !== 'not_in_catalog') return false;

      if (productSearch.trim()) {
        const q = productSearch.trim().toLowerCase();
        const mRaw = item.rawCode.toLowerCase().includes(q);
        const mSync = item.syncedCode.toLowerCase().includes(q);
        const mName = item.matchedName.toLowerCase().includes(q);
        return mRaw || mSync || mName;
      }
      return true;
    });
  }, [productSyncList, productFilterStatus, productSearch]);

  // Filtered Customers List for tab 5
  const filteredCustomerSyncList = useMemo(() => {
    return customerSyncList.filter((item: CodeSyncDetail) => {
      if (customerFilterStatus === 'adjusted' && !item.isAdjusted) return false;
      if (customerFilterStatus === 'exact' && (item.isAdjusted || item.status !== 'exact_matched')) return false;
      if (customerFilterStatus === 'missing' && item.status !== 'not_in_catalog') return false;

      if (customerSearch.trim()) {
        const q = customerSearch.trim().toLowerCase();
        const mRaw = item.rawCode.toLowerCase().includes(q);
        const mSync = item.syncedCode.toLowerCase().includes(q);
        const mName = item.matchedName.toLowerCase().includes(q);
        return mRaw || mSync || mName;
      }
      return true;
    });
  }, [customerSyncList, customerFilterStatus, customerSearch]);

  // Individual Order Selection Handlers
  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAllOrders = () => {
    setSelectedOrderIds(computedOrders.map((o) => o.id));
  };

  const handleDeselectAllOrders = () => {
    setSelectedOrderIds([]);
  };

  const handleSelectRedFlaggedOnly = () => {
    const redIds = redFlaggedOrders.map((item) => item.ord.id);
    setSelectedOrderIds(redIds);
    setOrderSubFilter('red_flagged');
  };

  const handleSelectValidOnly = () => {
    const validIds = validOrders.map((o) => o.id);
    setSelectedOrderIds(validIds);
    setOrderSubFilter('valid');
  };

  // Manual Customer Creation & Edit Handlers
  const handleOpenManualCustomerModal = (initial?: Customer) => {
    if (initial) {
      setEditingCustomer(initial);
    } else {
      setEditingCustomer({
        id: `cust-manual-${Date.now()}`,
        code: `KH${String(existingCustomers.length + manuallyAddedCustomers.length + 1).padStart(3, '0')}`,
        name: '',
        shortName: '',
        taxCode: '',
        phone: '',
        address: '',
        type: 'personal',
        idCard: '',
        notes: 'Thêm thủ công khi nhập đơn hàng Excel',
        createdAt: new Date().toISOString(),
      });
    }
    setIsCustomerModalOpen(true);
  };

  const handleSaveManualCustomer = (savedCust: Customer) => {
    setManuallyAddedCustomers((prev) => {
      const next = prev.filter((c) => c.code.trim().toUpperCase() !== savedCust.code.trim().toUpperCase());
      return [...next, savedCust];
    });
    setIsCustomerModalOpen(false);
    setEditingCustomer(null);
  };

  // Manual Product Creation & Edit Handlers
  const handleOpenManualProductModal = (initial?: Product) => {
    if (initial) {
      setEditingProduct(initial);
    } else {
      setEditingProduct({
        id: `prod-manual-${Date.now()}`,
        code: `HH${String(existingProducts.length + manuallyAddedProducts.length + 1).padStart(3, '0')}`,
        name: '',
        category: 'Hàng bán Excel',
        saleUnit: 'Cái',
        purchaseUnit: 'Cái',
        conversionRate: 1,
        vatRate: 10,
        defaultSalePrice: 0,
        profitMargin: 20,
        notes: 'Thêm thủ công khi nhập đơn hàng Excel',
      });
    }
    setIsProductModalOpen(true);
  };

  const handleSaveManualProduct = (savedProd: Product) => {
    setManuallyAddedProducts((prev) => {
      const next = prev.filter((p) => p.code.trim().toUpperCase() !== savedProd.code.trim().toUpperCase());
      return [...next, savedProd];
    });
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  // Selected orders list
  const selectedOrdersList = useMemo(() => {
    return computedOrders.filter((o) => selectedOrderIds.includes(o.id));
  }, [computedOrders, selectedOrderIds]);

  // Selected orders catalog status analysis
  const selectedAnalysis = useMemo(() => {
    return orderCatalogAnalysis.filter((item) => selectedOrderIds.includes(item.ord.id));
  }, [orderCatalogAnalysis, selectedOrderIds]);

  const selectedRedFlagged = useMemo(() => {
    return selectedAnalysis.filter((item) => item.isRedFlagged);
  }, [selectedAnalysis]);

  // Check if selected orders violate mandatory catalog addition
  const hasUncatalogedCustomersInSelected = selectedAnalysis.some((item) => item.isCustomerUncataloged);
  const hasUncatalogedProductsInSelected = selectedAnalysis.some((item) => item.hasUncatalogedProducts);

  const isSelectedImportBlocked =
    selectedRedFlagged.length > 0 &&
    ((hasUncatalogedCustomersInSelected && !autoAddNewCustomers) ||
      (hasUncatalogedProductsInSelected && !autoAddNewProducts));

  // Confirm Import Handler
  const handleConfirmSelectedImport = () => {
    if (selectedOrdersList.length === 0) {
      alert('Vui lòng tích chọn ít nhất 1 đơn hàng để nhập vào phần mềm!');
      return;
    }

    if (isSelectedImportBlocked) {
      alert(
        `KHÔNG THỂ NHẬP ĐƠN HÀNG!\n\nTrong số ${selectedOrdersList.length} đơn hàng đã chọn, có ${selectedRedFlagged.length} đơn chứa Khách hàng mới hoặc Mã hàng mới chưa có trong danh mục.\n\nTheo quy định: BẮT BUỘC phải thêm thông tin vào danh sách trước khi nhập.\n\nVui lòng bấm "Thêm thủ công" hoặc tích chọn "Tự động thêm vào Danh mục" bên trên.`
      );
      return;
    }

    // Filter only new customers needed for the selected orders + any manually added
    const neededNewCusts = autoAddNewCustomers
      ? detectedNewCustomers.filter((c) =>
          selectedOrdersList.some((o) => o.customerCode?.trim().toUpperCase() === c.code.trim().toUpperCase())
        )
      : [];
    const finalCustomersToAdd = [...manuallyAddedCustomers, ...neededNewCusts];

    // Filter only new products needed for the selected orders + any manually added
    const neededNewProds = autoAddNewProducts
      ? detectedNewProducts.filter((p) =>
          selectedOrdersList.some((o) =>
            o.items?.some((it) => it.productCode?.trim().toUpperCase() === p.code.trim().toUpperCase())
          )
        )
      : [];
    const finalProductsToAdd = [...manuallyAddedProducts, ...neededNewProds];

    onConfirmImport({
      finalOrders: selectedOrdersList,
      newCustomersToAdd: finalCustomersToAdd,
      newProductsToAdd: finalProductsToAdd,
    });
  };

  const handleEnableAllAndImportSelected = () => {
    if (selectedOrdersList.length === 0) {
      alert('Vui lòng tích chọn ít nhất 1 đơn hàng để nhập!');
      return;
    }

    setAutoAddNewCustomers(true);
    setAutoAddNewProducts(true);

    const neededNewCusts = detectedNewCustomers.filter((c) =>
      selectedOrdersList.some((o) => o.customerCode?.trim().toUpperCase() === c.code.trim().toUpperCase())
    );
    const neededNewProds = detectedNewProducts.filter((p) =>
      selectedOrdersList.some((o) =>
        o.items?.some((it) => it.productCode?.trim().toUpperCase() === p.code.trim().toUpperCase())
      )
    );

    onConfirmImport({
      finalOrders: selectedOrdersList,
      newCustomersToAdd: [...manuallyAddedCustomers, ...neededNewCusts],
      newProductsToAdd: [...manuallyAddedProducts, ...neededNewProds],
    });
  };

  if (!isOpen) return null;

  const totalAmountSum = computedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const selectedAmountSum = selectedOrdersList.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalItemsSum = computedOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-900/85 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>Kiểm tra, Tích chọn & Thêm mã thủ công trước khi Nhập Đơn hàng Excel</span>
                {redFlaggedOrders.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white animate-pulse border border-rose-300">
                    🚨 {redFlaggedOrders.length} đơn báo đỏ
                  </span>
                )}
              </h2>
              <p className="text-blue-100 text-xs">
                Tích chọn từng đơn để cập nhật • Thêm KH mới & Mã hàng mới thủ công hoặc tự động trước khi nhập
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-blue-700 uppercase">Tổng đơn hàng</div>
              <div className="text-xl font-black text-blue-900 mt-0.5">{computedOrders.length}</div>
              <div className="text-[11px] font-bold text-blue-600 mt-0.5">
                Đã chọn: {selectedOrderIds.length}
              </div>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-indigo-700 uppercase">Tổng mặt hàng</div>
              <div className="text-xl font-black text-indigo-900 mt-0.5">{totalItemsSum}</div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                {formatCurrency(totalAmountSum)}
              </div>
            </div>

            <div
              className={`p-3 rounded-xl text-center border cursor-pointer transition-all ${
                redFlaggedOrders.length > 0
                  ? 'bg-rose-50 border-rose-300 text-rose-900 ring-2 ring-rose-400/50'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
              onClick={() => {
                setActiveTab('orders');
                setOrderSubFilter('red_flagged');
              }}
              title="Bấm để lọc xem danh sách đơn hàng báo đỏ"
            >
              <div className="text-[11px] font-semibold uppercase flex items-center justify-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Đơn báo đỏ</span>
              </div>
              <div className="text-xl font-black text-rose-700 mt-0.5">{redFlaggedOrders.length}</div>
              <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
                Chưa có trong DM
              </div>
            </div>

            <div
              className={`p-3 rounded-xl text-center border cursor-pointer transition-all ${
                detectedNewCustomers.length > 0 || manuallyAddedCustomers.length > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
              onClick={() => setActiveTab('new_customers')}
              title="Bấm để xem & thêm thủ công khách hàng mới"
            >
              <div className="text-[11px] font-semibold uppercase flex items-center justify-center gap-1">
                <UserPlus className="w-3.5 h-3.5 text-amber-600" />
                <span>Khách hàng mới</span>
              </div>
              <div className="text-xl font-black text-amber-700 mt-0.5">
                {detectedNewCustomers.length}
                {manuallyAddedCustomers.length > 0 && (
                  <span className="text-xs text-emerald-700 font-bold ml-1">
                    (+{manuallyAddedCustomers.length} đã thêm)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-amber-700 font-bold mt-0.5 underline">
                + Thêm thủ công
              </div>
            </div>

            <div
              className={`p-3 rounded-xl text-center border cursor-pointer transition-all ${
                detectedNewProducts.length > 0 || manuallyAddedProducts.length > 0
                  ? 'bg-purple-50 border-purple-300 text-purple-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
              onClick={() => setActiveTab('new_products')}
              title="Bấm để xem & thêm thủ công mã hàng mới"
            >
              <div className="text-[11px] font-semibold uppercase flex items-center justify-center gap-1">
                <PackagePlus className="w-3.5 h-3.5 text-purple-600" />
                <span>Mã hàng mới</span>
              </div>
              <div className="text-xl font-black text-purple-700 mt-0.5">
                {detectedNewProducts.length}
                {manuallyAddedProducts.length > 0 && (
                  <span className="text-xs text-emerald-700 font-bold ml-1">
                    (+{manuallyAddedProducts.length} đã thêm)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-purple-700 font-bold mt-0.5 underline">
                + Thêm thủ công
              </div>
            </div>
          </div>

          {/* CẢNH BÁO BÁO ĐỎ NỔI BẬT: BẮT BUỘC PHẢI THÊM THÔNG TIN VÀO DANH SÁCH TRƯỚC KHI NHẬP ĐƠN HÀNG */}
          {(detectedNewCustomers.length > 0 || detectedNewProducts.length > 0) && (
            <div className="p-4 bg-gradient-to-r from-rose-50 via-red-50 to-rose-50 border-2 border-rose-400 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5 animate-pulse">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-black text-rose-950 text-sm sm:text-base flex items-center gap-1.5">
                      <span>🚨 BÁO ĐỎ: PHÁT HIỆN ĐƠN HÀNG CHỨA KHÁCH HÀNG HOẶC MÃ HÀNG CHƯA CÓ TRONG DANH MỤC!</span>
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenManualCustomerModal()}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Thêm KH thủ công</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenManualProductModal()}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer"
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        <span>+ Thêm Mã HH thủ công</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-rose-900 text-xs sm:text-sm mt-1 leading-relaxed">
                    <strong>Quy định:</strong> Bắt buộc phải thêm thông tin <strong>khách hàng mới</strong> ({detectedNewCustomers.length} KH) và <strong>mã hàng mới</strong> ({detectedNewProducts.length} mặt hàng) vào danh mục trước khi nhập đơn hàng. Bạn có thể <strong>tích chọn từng đơn hàng để nhập</strong>, hoặc <strong>thêm mã thủ công</strong> ngay bên dưới.
                  </p>
                </div>
              </div>

              {/* Tùy chọn Tự động thêm vào danh mục */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-rose-200">
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-rose-300 shadow-xs cursor-pointer hover:bg-rose-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoAddNewCustomers}
                    onChange={(e) => setAutoAddNewCustomers(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        Tự động thêm {detectedNewCustomers.length} khách hàng mới vào Danh mục
                      </span>
                      {detectedNewCustomers.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveTab('new_customers');
                          }}
                          className="text-[11px] font-bold text-blue-600 hover:underline"
                        >
                          Xem & Sửa thủ công ➔
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Lưu Mã KH, Tên KH, MST, CCCD, Địa chỉ từ file Excel vào Danh mục Khách hàng.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-rose-300 shadow-xs cursor-pointer hover:bg-rose-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoAddNewProducts}
                    onChange={(e) => setAutoAddNewProducts(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        Tự động thêm {detectedNewProducts.length} mã hàng mới vào Danh mục
                      </span>
                      {detectedNewProducts.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveTab('new_products');
                          }}
                          className="text-[11px] font-bold text-blue-600 hover:underline"
                        >
                          Xem & Sửa thủ công ➔
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Lưu Mã HH, Tên hàng, ĐVT_Bán, Đơn giá bán, Thuế VAT vào Danh mục Sản phẩm.
                    </p>
                  </div>
                </label>
              </div>

              {/* Status indicator when blocked */}
              {isSelectedImportBlocked && (
                <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-900 font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>
                      ⚠️ Cảnh báo bắt buộc: Có {selectedRedFlagged.length} đơn hàng đã chọn chứa thông tin chưa có trong danh mục. Bạn cần thêm thủ công hoặc tích chọn tự động thêm trước khi nhập!
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnableAllAndImportSelected}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    ⚡ Bật thêm tất cả vào DM & Nhập
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 ${
                activeTab === 'orders'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>1. Tích chọn Đơn hàng ({selectedOrderIds.length}/{computedOrders.length})</span>
              {redFlaggedOrders.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                  {redFlaggedOrders.length} báo đỏ
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('new_customers')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 ${
                activeTab === 'new_customers'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>2. Khách hàng mới ({detectedNewCustomers.length})</span>
              {manuallyAddedCustomers.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-black">
                  +{manuallyAddedCustomers.length} thủ công
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('new_products')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 ${
                activeTab === 'new_products'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              <span>3. Mã hàng mới ({detectedNewProducts.length})</span>
              {manuallyAddedProducts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-black">
                  +{manuallyAddedProducts.length} thủ công
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 ${
                activeTab === 'products'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>4. Chuẩn hóa Mã HH ({adjustedProductCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 ${
                activeTab === 'customers'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>5. Chuẩn hóa Mã KH ({adjustedCustomerCount})</span>
            </button>
          </div>

          {/* TAB 1: ORDERS PREVIEW & RULE SELECTION & RED FLAGGED FILTER & ROW SELECTION */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Rule Selection Box */}
              <div className="p-4 bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-indigo-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                  <Hash className="w-4 h-4 text-indigo-600" />
                  <span>Quy tắc đánh mã đơn hàng tự động:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Chế độ mã đơn:
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-slate-200 flex-1 cursor-pointer hover:bg-slate-50">
                        <input
                          type="radio"
                          name="codeMode"
                          value="rule"
                          checked={codeMode === 'rule'}
                          onChange={() => setCodeMode('rule')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold text-slate-800 text-xs">Áp dụng Quy tắc tạo mã</span>
                      </label>
                      <label className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-slate-200 flex-1 cursor-pointer hover:bg-slate-50">
                        <input
                          type="radio"
                          name="codeMode"
                          value="keep_excel"
                          checked={codeMode === 'keep_excel'}
                          onChange={() => setCodeMode('keep_excel')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold text-slate-800 text-xs">Giữ mã gốc từ Excel</span>
                      </label>
                    </div>
                  </div>

                  {codeMode === 'rule' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Chọn quy tắc tạo mã trong danh sách:
                      </label>
                      <select
                        value={selectedRuleId}
                        onChange={(e) => setSelectedRuleId(e.target.value)}
                        className="w-full p-2 bg-white border border-indigo-300 rounded-xl text-xs sm:text-sm font-semibold text-indigo-950 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {rules.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} {r.isDefault ? '(Mặc định ★)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-filter chips & Selection Actions Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                {/* Filter and Selection buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Lọc đơn:</span>
                  <button
                    type="button"
                    onClick={() => setOrderSubFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      orderSubFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Tất cả ({computedOrders.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderSubFilter('red_flagged')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      orderSubFilter === 'red_flagged'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : redFlaggedOrders.length > 0
                        ? 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
                        : 'bg-white text-slate-400 border border-slate-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>🚨 Báo đỏ ({redFlaggedOrders.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderSubFilter('valid')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      orderSubFilter === 'valid'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-300'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Hợp lệ ({validOrders.length})</span>
                  </button>

                  <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

                  {/* Batch Selection Controls */}
                  <span className="text-xs font-bold text-slate-600">Tích chọn:</span>
                  <button
                    type="button"
                    onClick={handleSelectAllOrders}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="Chọn tất cả các đơn hàng"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Tất cả</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeselectAllOrders}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="Bỏ chọn tất cả đơn hàng"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Bỏ chọn</span>
                  </button>

                  {redFlaggedOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectRedFlaggedOnly}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 border border-rose-300 hover:bg-rose-200 text-rose-800 cursor-pointer"
                      title="Chỉ chọn các đơn hàng bị báo đỏ để xử lý"
                    >
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      <span>Chỉ chọn đơn đỏ ({redFlaggedOrders.length})</span>
                    </button>
                  )}

                  {validOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectValidOnly}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 text-emerald-800 cursor-pointer"
                      title="Chỉ chọn các đơn hàng hợp lệ đã khớp danh mục"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Chỉ chọn đơn hợp lệ ({validOrders.length})</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto text-xs font-bold">
                  <span className="px-3 py-1 rounded-xl bg-blue-100 text-blue-900 border border-blue-200">
                    Đã chọn: {selectedOrderIds.length}/{computedOrders.length} đơn ({formatCurrency(selectedAmountSum)})
                  </span>
                </div>
              </div>

              {/* Duplicate code warning if any */}
              {duplicateCodeSet.size > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Cảnh báo trùng mã: </span>
                    Phát hiện {duplicateCodeSet.size} mã đơn trùng với cơ sở dữ liệu hiện tại. Khuyến nghị áp dụng Quy tắc tạo mã để tự động đánh lại số thứ tự tiếp nối liên tục.
                  </div>
                </div>
              )}

              {/* Preview Table with Selection Checkboxes & Quick Add Buttons */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="max-h-84 overflow-y-auto divide-y divide-slate-100">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="p-2.5 text-center w-10">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.length > 0 && selectedOrderIds.length === computedOrders.length}
                            onChange={(e) => (e.target.checked ? handleSelectAllOrders() : handleDeselectAllOrders())}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            title="Chọn / Bỏ chọn tất cả đơn hàng"
                          />
                        </th>
                        <th className="p-2.5 text-center w-10">STT</th>
                        <th className="p-2.5">Mã đơn Excel</th>
                        <th className="p-2.5">Mã đơn áp dụng</th>
                        <th className="p-2.5">Ngày đặt</th>
                        <th className="p-2.5">Khách hàng</th>
                        <th className="p-2.5 text-center">Số MH</th>
                        <th className="p-2.5">Mặt hàng trong đơn</th>
                        <th className="p-2.5 text-right">Tổng tiền</th>
                        <th className="p-2.5 text-center">Trạng thái danh mục</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedOrdersAnalysis.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                            Không có đơn hàng nào phù hợp với bộ lọc hiện tại.
                          </td>
                        </tr>
                      ) : (
                        displayedOrdersAnalysis.map((item, idx) => {
                          const { ord, isCustomerUncataloged, isCustomerManuallyAdded, hasUncatalogedProducts, isRedFlagged } = item;
                          const original = importedOrders.find((io) => io.id === ord.id);
                          const isSelected = selectedOrderIds.includes(ord.id);
                          const isDupe = duplicateCodeSet.has(ord.orderCode.trim().toUpperCase());
                          const isCodeChanged = original && original.orderCode !== ord.orderCode;

                          return (
                            <tr
                              key={ord.id}
                              className={`transition-colors ${
                                isRedFlagged
                                  ? isSelected
                                    ? 'bg-rose-100/70 hover:bg-rose-100 border-l-4 border-l-rose-600'
                                    : 'bg-rose-50/40 hover:bg-rose-50/80 border-l-4 border-l-rose-300 opacity-70'
                                  : isSelected
                                  ? idx % 2 === 0
                                    ? 'bg-blue-50/50 hover:bg-blue-50/80'
                                    : 'bg-white hover:bg-blue-50/40'
                                  : 'bg-slate-50/30 hover:bg-slate-100/50 opacity-60'
                              }`}
                            >
                              {/* Row Checkbox */}
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectOrder(ord.id)}
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>

                              <td className="p-2.5 font-semibold text-slate-500 text-center">{idx + 1}</td>
                              <td className="p-2.5 font-mono text-slate-500">{original?.orderCode || '—'}</td>
                              <td className="p-2.5 font-mono font-bold whitespace-nowrap">
                                <div className="flex flex-col gap-0.5">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs w-fit ${
                                      isRedFlagged
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300 font-black'
                                        : isDupe
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300 font-bold'
                                        : isCodeChanged
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-blue-50 text-blue-800 border border-blue-200'
                                    }`}
                                  >
                                    {ord.orderCode}
                                  </span>
                                  {isRedFlagged && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600">
                                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                                      Báo đỏ
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5 text-slate-700 whitespace-nowrap">{formatDate(ord.orderDate)}</td>

                              {/* Khách hàng + Nút Thêm thủ công */}
                              <td className="p-2.5 text-slate-800 max-w-xs">
                                <div className="font-semibold">{ord.customerName}</div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-slate-500 text-[11px] font-mono">
                                    Mã: {ord.customerCode}
                                  </span>
                                  {isCustomerUncataloged ? (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                                        <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                        KH chưa có trong DM
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenManualCustomerModal({
                                            id: `cust-auto-${Date.now()}`,
                                            code: ord.customerCode?.trim().toUpperCase(),
                                            name: ord.customerName || `Khách hàng ${ord.customerCode}`,
                                            shortName: ord.customerName || `Khách hàng ${ord.customerCode}`,
                                            taxCode: ord.customerTaxCode || '',
                                            idCard: ord.customerIdCard || '',
                                            address: ord.customerAddress || '',
                                            phone: '',
                                            type: ord.customerTaxCode ? 'organization' : 'personal',
                                            notes: 'Thêm thủ công từ đơn hàng Excel',
                                            createdAt: new Date().toISOString(),
                                          })
                                        }
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-colors cursor-pointer"
                                        title="Thêm hoặc sửa thông tin khách hàng này vào danh mục ngay"
                                      >
                                        <UserPlus className="w-2.5 h-2.5" />
                                        <span>+ Thêm KH thủ công</span>
                                      </button>
                                    </div>
                                  ) : isCustomerManuallyAdded ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                      Đã thêm thủ công vào DM
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                      Đã có trong DM
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-2.5 text-center font-semibold text-slate-600">
                                {ord.items.length}
                              </td>

                              {/* Mặt hàng trong đơn + Nút Thêm mã thủ công */}
                              <td className="p-2.5 max-w-[280px]">
                                <div className="flex flex-wrap gap-1">
                                  {ord.items.map((it, iIdx) => {
                                    const codeUpper = it.productCode.trim().toUpperCase();
                                    const isItemUncataloged = !allKnownProductsMap.has(codeUpper);
                                    const isItemManuallyAdded = manuallyAddedProducts.some(
                                      (p) => p.code.trim().toUpperCase() === codeUpper
                                    );

                                    return (
                                      <span
                                        key={iIdx}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono inline-flex items-center gap-1 ${
                                          isItemUncataloged
                                            ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
                                            : isItemManuallyAdded
                                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold'
                                            : 'bg-slate-100 border border-slate-200 text-slate-700'
                                        }`}
                                        title={
                                          isItemUncataloged
                                            ? `Mã hàng "${it.productCode}" chưa có trong danh mục! Bấm để thêm thủ công`
                                            : `Mã hàng "${it.productCode}" đã có trong danh mục`
                                        }
                                      >
                                        {isItemUncataloged && (
                                          <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                        )}
                                        {isItemManuallyAdded && (
                                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                        )}
                                        <span>{it.productCode}</span>

                                        {isItemUncataloged && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleOpenManualProductModal({
                                                id: `prod-auto-${Date.now()}`,
                                                code: it.productCode?.trim().toUpperCase(),
                                                name: it.productName || it.productCode,
                                                category: 'Hàng bán Excel',
                                                saleUnit: it.saleUnit || 'Cái',
                                                purchaseUnit: it.saleUnit || 'Cái',
                                                conversionRate: 1,
                                                vatRate: it.vatRate ?? 10,
                                                defaultSalePrice: it.postTaxPrice || (it.preTaxPrice ? it.preTaxPrice * 1.1 : 0),
                                                profitMargin: 20,
                                                notes: 'Thêm thủ công từ đơn hàng Excel',
                                              })
                                            }
                                            className="px-1 py-0.2 rounded bg-rose-600 hover:bg-rose-700 text-white font-sans text-[9px] cursor-pointer"
                                            title="Thêm mã hàng này vào danh mục ngay"
                                          >
                                            + Thêm
                                          </button>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>

                              <td className="p-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                {formatCurrency(ord.totalAmount)}
                              </td>

                              <td className="p-2.5 text-center whitespace-nowrap">
                                {isRedFlagged ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-2xs">
                                    <AlertTriangle className="w-3 h-3 text-rose-200 shrink-0" />
                                    Báo đỏ: Có thông tin mới
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                    Hợp lệ
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KHÁCH HÀNG MỚI PHÁT HIỆN & THÊM THỦ CÔNG */}
          {activeTab === 'new_customers' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50/70 border border-amber-300 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                      Danh sách khách hàng mới phát hiện từ file Excel ({detectedNewCustomers.length} chưa thêm, {manuallyAddedCustomers.length} đã thêm thủ công)
                    </h4>
                    <p className="text-slate-600 text-[11px]">
                      Bạn có thể bấm "Sửa / Thêm thủ công" từng khách hàng hoặc tích chọn tự động thêm tất cả vào danh mục.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenManualCustomerModal()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm khách hàng thủ công</span>
                  </button>

                  <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-300 rounded-xl shadow-2xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoAddNewCustomers}
                      onChange={(e) => setAutoAddNewCustomers(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Tự động thêm vào Danh mục khách hàng
                    </span>
                  </label>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="p-2.5 text-center w-12">STT</th>
                      <th className="p-2.5">Mã khách hàng</th>
                      <th className="p-2.5">Tên khách hàng</th>
                      <th className="p-2.5">Mã số thuế / CCCD</th>
                      <th className="p-2.5">Địa chỉ</th>
                      <th className="p-2.5">Loại</th>
                      <th className="p-2.5 text-center">Trạng thái xử lý</th>
                      <th className="p-2.5 text-center w-28">Thao tác thủ công</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Render manually added customers first */}
                    {manuallyAddedCustomers.map((cust, idx) => (
                      <tr key={`manual-${cust.code}-${idx}`} className="bg-emerald-50/50 hover:bg-emerald-50 transition-colors">
                        <td className="p-2.5 text-center font-semibold text-emerald-700">{idx + 1}</td>
                        <td className="p-2.5 font-mono font-bold text-emerald-950">
                          <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 rounded">
                            {cust.code}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{cust.name}</td>
                        <td className="p-2.5 font-mono text-slate-700">
                          {cust.taxCode ? `MST: ${cust.taxCode}` : cust.idCard ? `CCCD: ${cust.idCard}` : '—'}
                        </td>
                        <td className="p-2.5 text-slate-600 max-w-xs truncate">{cust.address || '—'}</td>
                        <td className="p-2.5">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-700">
                            {cust.type === 'organization' ? 'Tổ chức' : 'Cá nhân'}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã thêm thủ công vào DM
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenManualCustomerModal(cust)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 cursor-pointer"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Sửa</span>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Render detected new customers not yet manually added */}
                    {detectedNewCustomers.map((cust, idx) => (
                      <tr key={cust.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="p-2.5 text-center font-semibold text-slate-500">
                          {manuallyAddedCustomers.length + idx + 1}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-amber-900">
                          <span className="px-2 py-0.5 bg-amber-100 border border-amber-300 rounded">
                            {cust.code}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{cust.name}</td>
                        <td className="p-2.5 font-mono text-slate-700">
                          {cust.taxCode ? `MST: ${cust.taxCode}` : cust.idCard ? `CCCD: ${cust.idCard}` : '—'}
                        </td>
                        <td className="p-2.5 text-slate-600 max-w-xs truncate">{cust.address || '—'}</td>
                        <td className="p-2.5">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-700">
                            {cust.type === 'organization' ? 'Tổ chức' : 'Cá nhân'}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          {autoAddNewCustomers ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Sẽ tự động thêm vào DM
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Chưa được thêm (Báo đỏ)
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenManualCustomerModal(cust)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm thủ công</span>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {manuallyAddedCustomers.length === 0 && detectedNewCustomers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                          Không có khách hàng mới nào. Tất cả khách hàng trong đơn đều đã có trong danh mục.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MÃ HÀNG MỚI PHÁT HIỆN & THÊM THỦ CÔNG */}
          {activeTab === 'new_products' && (
            <div className="space-y-3">
              <div className="p-3 bg-purple-50/70 border border-purple-300 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-purple-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-purple-950 text-xs sm:text-sm">
                      Danh sách mã hàng mới phát hiện từ file Excel ({detectedNewProducts.length} chưa thêm, {manuallyAddedProducts.length} đã thêm thủ công)
                    </h4>
                    <p className="text-slate-600 text-[11px]">
                      Bạn có thể bấm "Sửa / Thêm thủ công" từng mã hàng hoặc tích chọn tự động thêm tất cả vào danh mục sản phẩm.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenManualProductModal()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm mã hàng thủ công</span>
                  </button>

                  <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-purple-300 rounded-xl shadow-2xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoAddNewProducts}
                      onChange={(e) => setAutoAddNewProducts(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Tự động thêm vào Danh mục sản phẩm
                    </span>
                  </label>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="p-2.5 text-center w-12">STT</th>
                      <th className="p-2.5">Mã hàng hóa</th>
                      <th className="p-2.5">Tên hàng hóa</th>
                      <th className="p-2.5 text-center">ĐVT_Bán</th>
                      <th className="p-2.5 text-right">Đơn giá bán</th>
                      <th className="p-2.5 text-center">Thuế VAT</th>
                      <th className="p-2.5 text-center">Trạng thái xử lý</th>
                      <th className="p-2.5 text-center w-28">Thao tác thủ công</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Render manually added products first */}
                    {manuallyAddedProducts.map((prod, idx) => (
                      <tr key={`manual-prod-${prod.code}-${idx}`} className="bg-emerald-50/50 hover:bg-emerald-50 transition-colors">
                        <td className="p-2.5 text-center font-semibold text-emerald-700">{idx + 1}</td>
                        <td className="p-2.5 font-mono font-bold text-emerald-950">
                          <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 rounded">
                            {prod.code}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{prod.name}</td>
                        <td className="p-2.5 text-center font-semibold text-slate-700">{prod.saleUnit}</td>
                        <td className="p-2.5 text-right font-black text-slate-900">
                          {formatCurrency(prod.defaultSalePrice || 0)}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">{prod.vatRate}%</td>
                        <td className="p-2.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã thêm thủ công vào DM
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenManualProductModal(prod)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 cursor-pointer"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Sửa</span>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Render detected new products not yet manually added */}
                    {detectedNewProducts.map((prod, idx) => (
                      <tr key={prod.id} className="hover:bg-purple-50/30 transition-colors">
                        <td className="p-2.5 text-center font-semibold text-slate-500">
                          {manuallyAddedProducts.length + idx + 1}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-purple-900">
                          <span className="px-2 py-0.5 bg-purple-100 border border-purple-300 rounded">
                            {prod.code}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{prod.name}</td>
                        <td className="p-2.5 text-center font-semibold text-slate-700">{prod.saleUnit}</td>
                        <td className="p-2.5 text-right font-black text-slate-900">
                          {formatCurrency(prod.defaultSalePrice || 0)}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">{prod.vatRate}%</td>
                        <td className="p-2.5 text-center">
                          {autoAddNewProducts ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Sẽ tự động thêm vào DM
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Chưa được thêm (Báo đỏ)
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenManualProductModal(prod)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm thủ công</span>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {manuallyAddedProducts.length === 0 && detectedNewProducts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                          Không có mã hàng mới nào. Tất cả sản phẩm trong đơn đều đã có trong danh mục.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PRODUCT CODE SYNCHRONIZATION DETAIL */}
          {activeTab === 'products' && (
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Tìm theo Mã trong Excel, Mã đồng bộ, Tên hàng hóa..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setProductFilterStatus('all')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      productFilterStatus === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Tất cả ({productSyncList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductFilterStatus('adjusted')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      productFilterStatus === 'adjusted'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                    }`}
                  >
                    Đã chuẩn hóa ({adjustedProductCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductFilterStatus('exact')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      productFilterStatus === 'exact'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Khớp sẵn ({productSyncList.filter((p) => !p.isAdjusted && p.status === 'exact_matched').length})
                  </button>
                  {missingProductCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setProductFilterStatus('missing')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        productFilterStatus === 'missing'
                          ? 'bg-rose-600 text-white'
                          : 'bg-white border border-rose-300 text-rose-800 hover:bg-rose-50'
                      }`}
                    >
                      Chưa có trong DM ({missingProductCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Product Sync Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="p-2.5 text-center w-12">STT</th>
                        <th className="p-2.5">Mã trong file Excel (Gốc)</th>
                        <th className="p-2.5 text-center w-8">➔</th>
                        <th className="p-2.5">Mã đồng bộ phần mềm</th>
                        <th className="p-2.5">Tên sản phẩm khớp</th>
                        <th className="p-2.5 text-center">ĐVT</th>
                        <th className="p-2.5 text-center">Số dòng</th>
                        <th className="p-2.5 text-center">Trạng thái đồng bộ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProductSyncList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                            Không có mã hàng nào phù hợp bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        filteredProductSyncList.map((item, idx) => {
                          const hasSpace = /\s/.test(item.rawCode);
                          const hasLowerCase = /[a-z]/.test(item.rawCode);

                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                item.isAdjusted
                                  ? 'bg-emerald-50/40'
                                  : item.status === 'not_in_catalog'
                                  ? 'bg-amber-50/40'
                                  : 'bg-white'
                              }`}
                            >
                              <td className="p-2.5 text-center font-semibold text-slate-500">{idx + 1}</td>
                              <td className="p-2.5">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded font-mono text-xs ${
                                    item.isAdjusted
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                      : 'bg-slate-100 text-slate-700 font-medium'
                                  }`}
                                >
                                  "{item.rawCode}"
                                </span>
                                {(hasSpace || hasLowerCase) && (
                                  <div className="text-[10px] text-amber-700 mt-0.5">
                                    {hasSpace && hasLowerCase
                                      ? '• Có dấu cách & chữ thường'
                                      : hasSpace
                                      ? '• Có khoảng trắng thừa'
                                      : '• Có chữ thường'}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-center text-slate-400 font-bold">
                                <ArrowRight className="w-3.5 h-3.5 inline text-indigo-500" />
                              </td>
                              <td className="p-2.5 font-mono font-black text-indigo-950">
                                <span className="inline-block px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded">
                                  {item.syncedCode}
                                </span>
                              </td>
                              <td className="p-2.5 font-medium text-slate-800 max-w-xs truncate">
                                {item.matchedName}
                              </td>
                              <td className="p-2.5 text-center text-slate-600 font-semibold">
                                {item.extra || '—'}
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-700">
                                {item.occurrences}
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                {item.isAdjusted ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Đã đồng bộ & khớp DM
                                  </span>
                                ) : item.status === 'exact_matched' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                                    <CheckCircle className="w-3 h-3 text-blue-600" />
                                    Khớp sẵn
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    <HelpCircle className="w-3 h-3 text-amber-600" />
                                    Chưa có trong DM
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CUSTOMER CODE SYNCHRONIZATION DETAIL */}
          {activeTab === 'customers' && (
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Tìm theo Mã trong Excel, Mã đồng bộ, Tên khách hàng..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-violet-500"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCustomerFilterStatus('all')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      customerFilterStatus === 'all'
                        ? 'bg-violet-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Tất cả ({customerSyncList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerFilterStatus('adjusted')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      customerFilterStatus === 'adjusted'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                    }`}
                  >
                    Đã chuẩn hóa ({adjustedCustomerCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerFilterStatus('exact')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      customerFilterStatus === 'exact'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Khớp sẵn ({customerSyncList.filter((c) => !c.isAdjusted && c.status === 'exact_matched').length})
                  </button>
                  {missingCustomerCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setCustomerFilterStatus('missing')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        customerFilterStatus === 'missing'
                          ? 'bg-amber-600 text-white'
                          : 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-50'
                      }`}
                    >
                      Chưa có trong DM ({missingCustomerCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Sync Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="p-2.5 text-center w-12">STT</th>
                        <th className="p-2.5">Mã KH trong file Excel (Gốc)</th>
                        <th className="p-2.5 text-center w-8">➔</th>
                        <th className="p-2.5">Mã KH đồng bộ phần mềm</th>
                        <th className="p-2.5">Tên khách hàng khớp</th>
                        <th className="p-2.5">MST / SĐT</th>
                        <th className="p-2.5 text-center">Số đơn</th>
                        <th className="p-2.5 text-center">Trạng thái đồng bộ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCustomerSyncList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                            Không có mã khách hàng nào phù hợp bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        filteredCustomerSyncList.map((item, idx) => {
                          const hasSpace = /\s/.test(item.rawCode);
                          const hasLowerCase = /[a-z]/.test(item.rawCode);

                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                item.isAdjusted
                                  ? 'bg-emerald-50/40'
                                  : item.status === 'not_in_catalog'
                                  ? 'bg-amber-50/40'
                                  : 'bg-white'
                              }`}
                            >
                              <td className="p-2.5 text-center font-semibold text-slate-500">{idx + 1}</td>
                              <td className="p-2.5">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded font-mono text-xs ${
                                    item.isAdjusted
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                      : 'bg-slate-100 text-slate-700 font-medium'
                                  }`}
                                >
                                  "{item.rawCode}"
                                </span>
                                {(hasSpace || hasLowerCase) && (
                                  <div className="text-[10px] text-amber-700 mt-0.5">
                                    {hasSpace && hasLowerCase
                                      ? '• Có dấu cách & chữ thường'
                                      : hasSpace
                                      ? '• Có khoảng trắng thừa'
                                      : '• Có chữ thường'}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-center text-slate-400 font-bold">
                                <ArrowRight className="w-3.5 h-3.5 inline text-violet-500" />
                              </td>
                              <td className="p-2.5 font-mono font-black text-violet-950">
                                <span className="inline-block px-2 py-0.5 bg-violet-50 border border-violet-200 text-violet-900 rounded">
                                  {item.syncedCode}
                                </span>
                              </td>
                              <td className="p-2.5 font-semibold text-slate-800 max-w-xs truncate">
                                {item.matchedName}
                              </td>
                              <td className="p-2.5 text-slate-600 font-mono text-[11px]">
                                {item.extra || '—'}
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-700">
                                {item.occurrences}
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                {item.isAdjusted ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Đã đồng bộ & khớp DM
                                  </span>
                                ) : item.status === 'exact_matched' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                                    <CheckCircle className="w-3 h-3 text-blue-600" />
                                    Khớp sẵn
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    <HelpCircle className="w-3 h-3 text-amber-600" />
                                    Chưa có trong DM
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                redFlaggedOrders.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
              }`}
            ></span>
            <span>
              {selectedOrdersList.length === 0 ? (
                <span className="text-rose-600 font-bold">Chưa chọn đơn hàng nào để nhập</span>
              ) : selectedRedFlagged.length > 0 ? (
                <span>
                  Đã chọn {selectedOrdersList.length}/{computedOrders.length} đơn ({selectedRedFlagged.length} đơn báo đỏ) • KH mới: {detectedNewCustomers.length} • Mã mới: {detectedNewProducts.length}
                </span>
              ) : (
                <span className="text-emerald-700 font-bold">
                  Đã chọn {selectedOrdersList.length}/{computedOrders.length} đơn hàng hợp lệ để nhập
                </span>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Ban className="w-4 h-4 text-slate-500" />
              <span>Hủy bỏ</span>
            </button>

            {/* Quick button to only select and import valid orders */}
            {redFlaggedOrders.length > 0 && validOrders.length > 0 && selectedRedFlagged.length > 0 && (
              <button
                type="button"
                onClick={handleSelectValidOnly}
                className="px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs sm:text-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
                title="Bỏ chọn các đơn báo đỏ, chỉ chọn các đơn hợp lệ"
              >
                <CheckCircle className="w-4 h-4 text-amber-600" />
                <span>Chỉ chọn {validOrders.length} đơn hợp lệ</span>
              </button>
            )}

            {/* If blocked, provide quick enable all button */}
            {isSelectedImportBlocked ? (
              <button
                type="button"
                onClick={handleEnableAllAndImportSelected}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-black text-xs sm:text-sm cursor-pointer inline-flex items-center justify-center gap-2 shadow-md shadow-rose-500/25 animate-pulse"
                title="Tự động thêm tất cả KH & SP mới của các đơn đã chọn vào danh mục và tiến hành nhập"
              >
                <Sparkles className="w-4 h-4 text-rose-200" />
                <span>⚡ Thêm tất cả vào DM & Nhập {selectedOrdersList.length} đơn đã chọn</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={selectedOrdersList.length === 0}
                onClick={handleConfirmSelectedImport}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Xác nhận nhập {selectedOrdersList.length} đơn hàng đã chọn
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Manual Customer Modal */}
      {isCustomerModalOpen && (
        <CustomerModal
          isOpen={isCustomerModalOpen}
          onClose={() => {
            setIsCustomerModalOpen(false);
            setEditingCustomer(null);
          }}
          onSave={handleSaveManualCustomer}
          initialCustomer={editingCustomer}
          existingCustomersCount={existingCustomers.length + manuallyAddedCustomers.length}
          existingCustomers={[...existingCustomers, ...manuallyAddedCustomers]}
        />
      )}

      {/* Manual Product Modal */}
      {isProductModalOpen && (
        <ProductModal
          isOpen={isProductModalOpen}
          onClose={() => {
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
          onSave={handleSaveManualProduct}
          initialProduct={editingProduct}
          existingCount={existingProducts.length + manuallyAddedProducts.length}
          existingProducts={[...existingProducts, ...manuallyAddedProducts]}
        />
      )}
    </div>
  );
};
