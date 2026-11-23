import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Order, OrderItem, Product, PaymentMethod, DeliveryStatus, AppUser, AppSettings, DebtPayment, PurchaseBill, DeletedOrderRecord } from '../../types';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { CustomerModal } from './CustomerModal';
import { useConfirm } from '../../context/ConfirmContext';
import { calculateCurrentInventory, calculateSuggestedPrices } from '../../services/fifo';
import {
  X,
  Plus,
  Trash2,
  Search,
  UserPlus,
  Clock,
  CreditCard,
  Banknote,
  Building,
  CheckCircle2,
  HelpCircle,
  Percent,
  Receipt,
  ShoppingCart,
  History,
  AlertCircle,
  Edit,
  RefreshCw,
  Sparkles,
  Lock,
  ArrowLeftRight,
  MapPin,
  Package,
  Filter,
} from 'lucide-react';
import { DEFAULT_ORDER_CODE_RULES, generateNextOrderCode, matchOrderToRule, generateNextRootCode } from '../../services/orderCodeService';
import { ChangeProductModal } from './ChangeProductModal';

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: Order) => void;
  initialOrder?: Order | null;
  customers: Customer[];
  products: Product[];
  purchases?: PurchaseBill[];
  allOrders: Order[];
  deletedOrders?: DeletedOrderRecord[];
  debtPayments: DebtPayment[];
  currentUser: AppUser;
  settings: AppSettings;
  users?: AppUser[];
  onAddNewCustomer: (customer: Customer) => void;
}

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialOrder,
  customers,
  products,
  purchases = [],
  allOrders,
  deletedOrders = [],
  debtPayments,
  currentUser,
  settings,
  users = [],
  onAddNewCustomer,
}) => {
  const confirm = useConfirm();
  const [orderCode, setOrderCode] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomerForModal, setEditingCustomerForModal] = useState<Customer | null>(null);
  const [changingItemIndex, setChangingItemIndex] = useState<number | null>(null);

  // Available order code rules (locked rules are hidden when creating new orders)
  const rulesList = useMemo(() => {
    return settings.orderCodeRules && settings.orderCodeRules.length > 0
      ? settings.orderCodeRules
      : DEFAULT_ORDER_CODE_RULES;
  }, [settings.orderCodeRules]);

  const unlockedRules = useMemo(() => {
    const active = rulesList.filter((r) => !r.isLocked);
    return active.length > 0 ? active : rulesList;
  }, [rulesList]);

  const selectableRules = useMemo(() => {
    if (!initialOrder) {
      return unlockedRules;
    }
    const matched = matchOrderToRule(initialOrder, rulesList);
    const currentId = initialOrder.orderCodeRuleId || matched?.id;
    return rulesList.filter((r) => !r.isLocked || r.id === currentId);
  }, [initialOrder, rulesList, unlockedRules]);

  // Handler for rule change: auto-update order code with next sequential number
  const handleRuleChange = (newRuleId: string) => {
    setSelectedRuleId(newRuleId);
    const rule = rulesList.find((r) => r.id === newRuleId);
    if (rule) {
      const nextCode = generateNextOrderCode(rule, orderDate, allOrders, initialOrder?.id);
      setOrderCode(nextCode);
    }
  };

  // Handler for date change: auto-update order code if rule depends on date
  const handleDateChange = (newDate: string) => {
    setOrderDate(newDate);
    const rule = rulesList.find((r) => r.id === selectedRuleId);
    if (rule && (rule.patternType === 'prefix_and_date' || rule.patternType === 'date_only')) {
      const nextCode = generateNextOrderCode(rule, newDate, allOrders, initialOrder?.id);
      setOrderCode(nextCode);
    }
  };

  // Re-generate order code according to the current rule
  const handleRegenerateCode = () => {
    const rule = rulesList.find((r) => r.id === selectedRuleId) || rulesList[0];
    if (rule) {
      const nextCode = generateNextOrderCode(rule, orderDate, allOrders, initialOrder?.id);
      setOrderCode(nextCode);
    }
  };

  // Items & Product Tabs
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [activeProductTab, setActiveProductTab] = useState<'order_items' | 'inventory_list'>('order_items');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  // Inventory tab filters & planned quantity drafts
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [stockFilterType, setStockFilterType] = useState<'all' | 'in_stock' | 'zero_stock' | 'negative_stock' | 'planned'>('all');
  const [minStockFilter, setMinStockFilter] = useState('');
  const [maxStockFilter, setMaxStockFilter] = useState('');
  const [plannedQtyDrafts, setPlannedQtyDrafts] = useState<Record<string, string>>({});

  // Refs for click outside handling
  const productSearchRef = useRef<HTMLDivElement>(null);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Stock calculations for all products up to the selected orderDate
  const inventoryStockMap = useMemo(() => {
    return calculateCurrentInventory(products, purchases, allOrders, orderDate, initialOrder?.id);
  }, [products, purchases, allOrders, orderDate, initialOrder?.id]);

  // Discount & Payment
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [orderDiscountInput, setOrderDiscountInput] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('pending');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [createdByName, setCreatedByName] = useState<string>('');
  const [notes, setNotes] = useState('');

  const salePriceDecimals = settings.salePriceDecimals ?? 2;

  // Session ref to prevent re-initialization on background sync/poll intervals
  const initializedSessionKeyRef = useRef<string | null>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const draftStorageKey = `salemanager_order_draft_${currentUser.id || 'default'}`;

  // Reset session key when modal is closed
  useEffect(() => {
    if (!isOpen) {
      initializedSessionKeyRef.current = null;
      setHasRestoredDraft(false);
      setDraftSavedAt(null);
      setSelectedItemIds([]);
      setActiveProductTab('order_items');
      setInventorySearchTerm('');
      setStockFilterType('all');
      setMinStockFilter('');
      setMaxStockFilter('');
      setPlannedQtyDrafts({});
    }
  }, [isOpen]);

  // Initialize or reset form ONLY ONCE when modal is opened for a given order or create mode
  useEffect(() => {
    if (!isOpen) return;

    const currentSessionKey = initialOrder ? `edit_${initialOrder.id}` : 'create_new';
    if (initializedSessionKeyRef.current === currentSessionKey) {
      // Already initialized for this modal opening.
      // Prevent background polling, active sessions sync, or prop array reference changes from wiping data!
      return;
    }
    initializedSessionKeyRef.current = currentSessionKey;
    setSelectedItemIds([]);
    setActiveProductTab('order_items');
    setPlannedQtyDrafts({});

    if (initialOrder) {
      setHasRestoredDraft(false);
      setDraftSavedAt(null);
      const matched = matchOrderToRule(initialOrder, rulesList);
      const activeRuleId =
        initialOrder.orderCodeRuleId ||
        matched?.id ||
        settings.defaultOrderCodeRuleId ||
        rulesList[0]?.id ||
        '';
      setSelectedRuleId(activeRuleId);
      setOrderCode(initialOrder.orderCode);
      setOrderDate(initialOrder.orderDate);
      const cust = customers.find((c) => c.id === initialOrder.customerId) || {
        id: initialOrder.customerId,
        code: initialOrder.customerCode,
        name: initialOrder.customerName,
        shortName: initialOrder.customerName,
        taxCode: initialOrder.customerTaxCode,
        phone: '',
        address: initialOrder.customerAddress,
        type: 'personal',
        idCard: initialOrder.customerIdCard,
        notes: '',
        createdAt: '',
      };
      setSelectedCustomer(cust);
      setCustomerSearchTerm(`${cust.name} (${cust.code})`);
      setItems([...initialOrder.items]);
      setPaymentMethod(initialOrder.paymentMethod);
      setPaidAmount(initialOrder.paidAmount);
      setDeliveryStatus(initialOrder.deliveryStatus);

      // Match creator user
      const creatorUser = users.find(
        (u) =>
          u.id === initialOrder.createdById ||
          (initialOrder.createdByName && u.fullName.toLowerCase() === initialOrder.createdByName.toLowerCase())
      );
      if (creatorUser) {
        setSelectedUserId(creatorUser.id);
        setCreatedByName(initialOrder.createdByName || creatorUser.fullName);
      } else if (initialOrder.createdByName) {
        setSelectedUserId('custom');
        setCreatedByName(initialOrder.createdByName);
      } else {
        setSelectedUserId(currentUser.id);
        setCreatedByName(currentUser.fullName || '');
      }

      setNotes(initialOrder.notes || '');

      if (initialOrder.orderDiscountPercent > 0) {
        setDiscountType('percent');
        setOrderDiscountInput(initialOrder.orderDiscountPercent);
      } else {
        setDiscountType('amount');
        setOrderDiscountInput(initialOrder.orderDiscount);
      }
    } else {
      // Create mode: Check for existing un-submitted draft first
      let draftRestored = false;
      try {
        const rawDraft = localStorage.getItem(draftStorageKey);
        if (rawDraft) {
          const draft = JSON.parse(rawDraft);
          const hasDraftItems = Array.isArray(draft.items) && draft.items.length > 0;
          const hasDraftCustomer = Boolean(draft.customer);
          const hasDraftNotes = Boolean(draft.notes && draft.notes.trim() !== '');

          if (hasDraftItems || hasDraftCustomer || hasDraftNotes) {
            const draftRule = unlockedRules.find((r) => r.id === draft.selectedRuleId);
            const fallbackRule =
              unlockedRules.find((r) => r.id === settings.defaultOrderCodeRuleId) ||
              unlockedRules.find((r) => r.isDefault) ||
              unlockedRules[0];
            setSelectedRuleId(draftRule?.id || fallbackRule?.id || '');
            setOrderCode(draft.orderCode || '');
            setOrderDate(draft.orderDate || new Date().toISOString().slice(0, 10));
            setSelectedCustomer(draft.customer || null);
            setCustomerSearchTerm(
              draft.customerSearchTerm ||
                (draft.customer ? `${draft.customer.name} (${draft.customer.code})` : '')
            );
            setItems(hasDraftItems ? draft.items : []);
            setDiscountType(draft.discountType || 'amount');
            setOrderDiscountInput(draft.orderDiscountInput || 0);
            setPaymentMethod(draft.paymentMethod || 'cash');
            setPaidAmount(draft.paidAmount || 0);
            setDeliveryStatus(draft.deliveryStatus || 'pending');
            setSelectedUserId(draft.selectedUserId || currentUser.id);
            setCreatedByName(draft.createdByName || currentUser.fullName || '');
            setNotes(draft.notes || '');
            setHasRestoredDraft(true);
            setDraftSavedAt(draft.savedAt || null);
            draftRestored = true;
          }
        }
      } catch (err) {
        console.warn('Could not read order draft from localStorage:', err);
      }

      if (!draftRestored) {
        setHasRestoredDraft(false);
        setDraftSavedAt(null);
        const defaultRule =
          unlockedRules.find((r) => r.id === settings.defaultOrderCodeRuleId) ||
          unlockedRules.find((r) => r.isDefault) ||
          unlockedRules[0];
        const activeRuleId = defaultRule?.id || '';
        setSelectedRuleId(activeRuleId);

        const today = new Date().toISOString().slice(0, 10);
        setOrderDate(today);

        if (defaultRule) {
          const nextCode = generateNextOrderCode(defaultRule, today, allOrders);
          setOrderCode(nextCode);
        } else {
          const datePart = today.replace(/-/g, '');
          const countToday = allOrders.filter((o) => o.orderDate === today).length + 1;
          setOrderCode(`DH-${datePart}-${String(countToday).padStart(3, '0')}`);
        }

        // Bỏ trống thông tin khách hàng mặc định khi tạo mới để tìm kiếm nhanh
        setSelectedCustomer(null);
        setCustomerSearchTerm('');
        setItems([]);
        setDiscountType('amount');
        setOrderDiscountInput(0);
        setPaymentMethod('cash');
        setPaidAmount(0);
        setDeliveryStatus('pending'); // Default "Chờ giao"
        setSelectedUserId(currentUser.id);
        setCreatedByName(currentUser.fullName || '');
        setNotes('');
      }
    }
  }, [isOpen, initialOrder, customers, allOrders, currentUser, rulesList, settings.defaultOrderCodeRuleId, users, draftStorageKey]);

  // Auto-save draft whenever user enters or changes data in create mode
  useEffect(() => {
    if (!isOpen || initialOrder) return;
    if (initializedSessionKeyRef.current !== 'create_new') return;

    const hasData = items.length > 0 || selectedCustomer || (notes && notes.trim() !== '');
    if (hasData) {
      try {
        const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const draftData = {
          orderCode,
          orderDate,
          selectedRuleId,
          customer: selectedCustomer,
          customerSearchTerm,
          items,
          discountType,
          orderDiscountInput,
          paymentMethod,
          paidAmount,
          deliveryStatus,
          selectedUserId,
          createdByName,
          notes,
          savedAt: nowStr,
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(draftData));
      } catch (err) {
        console.warn('Error saving order draft:', err);
      }
    }
  }, [
    isOpen,
    initialOrder,
    orderCode,
    orderDate,
    selectedRuleId,
    selectedCustomer,
    customerSearchTerm,
    items,
    discountType,
    orderDiscountInput,
    paymentMethod,
    paidAmount,
    deliveryStatus,
    selectedUserId,
    createdByName,
    notes,
    draftStorageKey,
  ]);

  // Clear draft to start completely blank
  const handleClearDraft = async () => {
    const ok = await confirm({
      title: 'Xóa bản nháp và làm mới?',
      message: 'Bạn có chắc chắn muốn xóa toàn bộ thông tin khách hàng và mặt hàng đang tạo để bắt đầu đơn hàng mới?',
      confirmText: 'Xóa bản nháp',
      cancelText: 'Giữ lại',
      type: 'danger',
    });
    if (!ok) return;

    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore
    }

    setHasRestoredDraft(false);
    setDraftSavedAt(null);
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
    setItems([]);
    setDiscountType('amount');
    setOrderDiscountInput(0);
    setPaymentMethod('cash');
    setPaidAmount(0);
    setDeliveryStatus('pending');
    setNotes('');

    const defaultRule =
      unlockedRules.find((r) => r.id === settings.defaultOrderCodeRuleId) ||
      unlockedRules.find((r) => r.isDefault) ||
      unlockedRules[0];
    if (defaultRule) {
      setSelectedRuleId(defaultRule.id);
    }
    const today = new Date().toISOString().slice(0, 10);
    setOrderDate(today);
    if (defaultRule) {
      setOrderCode(generateNextOrderCode(defaultRule, today, allOrders));
    }
  };

  // Safe close handler that warns if there are unsaved items
  const handleClose = async () => {
    if (!initialOrder && (items.length > 0 || selectedCustomer)) {
      const ok = await confirm({
        title: 'Đóng đơn hàng đang tạo?',
        message: 'Bạn đang có thông tin đơn hàng chưa lưu. Dữ liệu đã được lưu thành bản nháp an toàn, bạn có thể quay lại tiếp tục bất cứ lúc nào.',
        confirmText: 'Đóng (giữ bản nháp)',
        cancelText: 'Tiếp tục soạn',
        type: 'info',
      });
      if (!ok) return;
    }
    onClose();
  };

  // Filter customers by Name, Short name, Tax code, Phone, Code, Address
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm.trim()) return customers.slice(0, 8);
    const q = customerSearchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.softwareCode && c.softwareCode.toLowerCase().includes(q)) ||
        (c.reconciliationName && c.reconciliationName.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        c.taxCode.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [customers, customerSearchTerm]);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm.trim()) return products.slice(0, 15);
    const q = productSearchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.reconciliationCode && p.reconciliationCode.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [products, productSearchTerm]);

  // Customer debt and recent orders history
  const customerHistory = useMemo(() => {
    if (!selectedCustomer) return { priorDebt: 0, recentOrders: [] };

    // Sum all prior unpaid orders for this customer (excluding current one if editing)
    const custOrders = allOrders.filter(
      (o) => o.customerId === selectedCustomer.id && o.id !== initialOrder?.id && o.deliveryStatus !== 'cancelled'
    );

    const totalOrdersDebt = custOrders.reduce((sum, o) => sum + (o.debtAmount || 0), 0);

    // Sum debt payment receipts
    const directPayments = debtPayments
      .filter((dp) => dp.type === 'customer' && dp.entityId === selectedCustomer.id)
      .reduce((sum, dp) => sum + dp.amount, 0);

    const priorDebt = Math.max(0, totalOrdersDebt - directPayments);

    const recentOrders = [...custOrders]
      .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
      .slice(0, 5);

    return { priorDebt, recentOrders };
  }, [selectedCustomer, allOrders, debtPayments, initialOrder]);

  // Order item computations
  const totals = useMemo(() => {
    let subtotalPreTax = 0;
    let itemDiscountSum = 0;
    let vatSum = 0;

    items.forEach((item) => {
      subtotalPreTax += item.subtotal;
      itemDiscountSum += item.itemDiscount || 0;
      vatSum += item.vatAmount;
    });

    // Order level discount
    let finalOrderDiscount = 0;
    let orderDiscountPercent = 0;
    if (discountType === 'percent') {
      orderDiscountPercent = orderDiscountInput;
      finalOrderDiscount = ((subtotalPreTax - itemDiscountSum) * orderDiscountInput) / 100;
    } else {
      finalOrderDiscount = orderDiscountInput;
    }

    const netPreTax = Math.max(0, subtotalPreTax - itemDiscountSum - finalOrderDiscount);
    const grandTotal = netPreTax + vatSum;
    const currentOrderDebt = Math.max(0, grandTotal - paidAmount);
    const remainingOverallDebt = (customerHistory.priorDebt || 0) + currentOrderDebt;

    return {
      subtotalPreTax,
      itemDiscountSum,
      finalOrderDiscount,
      orderDiscountPercent,
      vatSum,
      grandTotal,
      currentOrderDebt,
      remainingOverallDebt,
    };
  }, [items, discountType, orderDiscountInput, paidAmount, customerHistory.priorDebt]);

  // Precompute suggested post-tax prices for products when the inventory tab is active
  const inventorySuggestedPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!isOpen || activeProductTab !== 'inventory_list') return map;

    const postTaxDecimals = settings.postTaxSalePriceDecimals ?? -2;
    const preTaxDecimals = settings.salePriceDecimals ?? 2;

    products.forEach((prod) => {
      const sp = calculateSuggestedPrices(
        prod,
        orderDate,
        products,
        purchases,
        allOrders,
        postTaxDecimals,
        preTaxDecimals,
        initialOrder?.id
      );
      let suggestedPostTax = 0;
      if (sp.priceByMargin > 0) {
        suggestedPostTax = sp.priceByMargin;
      } else if (sp.hasDefaultPrice) {
        suggestedPostTax = sp.defaultPrice;
      }
      map.set(prod.code, suggestedPostTax);
    });
    return map;
  }, [
    isOpen,
    activeProductTab,
    products,
    orderDate,
    purchases,
    allOrders,
    settings.postTaxSalePriceDecimals,
    settings.salePriceDecimals,
    initialOrder?.id,
  ]);

  // Quick lookup of current order items aggregated by productCode
  const orderItemsByProductCode = useMemo(() => {
    const map = new Map<string, { totalQty: number; totalAmount: number; unitPostTaxPrice: number }>();
    items.forEach((it) => {
      const existing = map.get(it.productCode);
      if (!existing) {
        map.set(it.productCode, {
          totalQty: Number(it.quantity) || 0,
          totalAmount: Number(it.totalAmount) || 0,
          unitPostTaxPrice: Number(it.postTaxPrice) || 0,
        });
      } else {
        existing.totalQty += Number(it.quantity) || 0;
        existing.totalAmount += Number(it.totalAmount) || 0;
      }
    });
    return map;
  }, [items]);

  // Filtered product rows for the 'Danh sách mặt hàng tồn' tab
  const filteredInventoryProducts = useMemo(() => {
    const q = inventorySearchTerm.trim().toLowerCase();
    const minVal = minStockFilter.trim() !== '' ? parseFloat(minStockFilter) : null;
    const maxVal = maxStockFilter.trim() !== '' ? parseFloat(maxStockFilter) : null;

    return products.filter((p) => {
      if (q) {
        const matchText =
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.reconciliationCode && p.reconciliationCode.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q));
        if (!matchText) return false;
      }

      const stock = inventoryStockMap.get(p.code)?.inStock ?? 0;

      if (stockFilterType === 'in_stock' && stock <= 0) return false;
      if (stockFilterType === 'zero_stock' && stock !== 0) return false;
      if (stockFilterType === 'negative_stock' && stock >= 0) return false;
      if (stockFilterType === 'planned') {
        const plannedQty = orderItemsByProductCode.get(p.code)?.totalQty ?? 0;
        if (plannedQty <= 0) return false;
      }

      if (minVal !== null && !isNaN(minVal) && stock < minVal) return false;
      if (maxVal !== null && !isNaN(maxVal) && stock > maxVal) return false;

      return true;
    });
  }, [
    products,
    inventorySearchTerm,
    stockFilterType,
    minStockFilter,
    maxStockFilter,
    inventoryStockMap,
    orderItemsByProductCode,
  ]);

  // Summary counters for stock filter & planned exports
  const inventoryTabStats = useMemo(() => {
    let inStockCount = 0;
    let zeroStockCount = 0;
    let negativeStockCount = 0;
    let plannedProductCount = 0;
    let plannedTotalQty = 0;
    let plannedTotalAmount = 0;

    products.forEach((p) => {
      const stock = inventoryStockMap.get(p.code)?.inStock ?? 0;
      if (stock > 0) inStockCount++;
      else if (stock === 0) zeroStockCount++;
      else negativeStockCount++;

      const itemInfo = orderItemsByProductCode.get(p.code);
      if (itemInfo && itemInfo.totalQty > 0) {
        plannedProductCount++;
        plannedTotalQty += itemInfo.totalQty;
        plannedTotalAmount += itemInfo.totalAmount;
      }
    });

    return {
      totalProducts: products.length,
      inStockCount,
      zeroStockCount,
      negativeStockCount,
      plannedProductCount,
      plannedTotalQty,
      plannedTotalAmount,
    };
  }, [products, inventoryStockMap, orderItemsByProductCode]);

  if (!isOpen) return null;

  // Tự động tính lại đơn giá sau thuế cho tất cả các mặt hàng hiện có theo Giá vốn cao nhất (FIFO) và Tỷ suất lợi nhuận
  const handleAutoRecalculateCurrentOrder = () => {
    if (items.length === 0) return;
    const factor = Math.pow(10, salePriceDecimals);
    const updatedItems = items.map((item) => {
      const prod = products.find((p) => p.code === item.productCode);
      if (!prod) return item;

      const sp = calculateSuggestedPrices(
        prod,
        orderDate,
        products,
        purchases,
        allOrders,
        settings.postTaxSalePriceDecimals ?? -2,
        salePriceDecimals,
        initialOrder?.id
      );

      let newPostTax = item.postTaxPrice;
      if (sp.priceByMargin > 0) {
        newPostTax = sp.priceByMargin;
      } else if (sp.hasDefaultPrice) {
        newPostTax = sp.defaultPrice;
      } else if (sp.hasInputCost && sp.maxCostPerSaleUnit === 0) {
        newPostTax = 0;
      }

      const vatRate = item.vatRate;
      const preTax = Number((newPostTax / (1 + vatRate / 100)).toFixed(salePriceDecimals));
      const subtotal = item.quantity * preTax;
      const net = Math.max(0, subtotal - (item.itemDiscount || 0));
      const vatAmount = Math.round(((net * vatRate) / 100) * factor) / factor;
      const totalAmount = net + vatAmount;

      return {
        ...item,
        postTaxPrice: newPostTax,
        preTaxPrice: preTax,
        subtotal,
        vatAmount,
        totalAmount,
      };
    });

    setItems(updatedItems);
  };

  // Add product to items
  const handleAddProduct = (prod: Product, customPrice?: number) => {
    const sp = calculateSuggestedPrices(
      prod,
      orderDate,
      products,
      purchases,
      allOrders,
      settings.postTaxSalePriceDecimals ?? -2,
      settings.salePriceDecimals ?? 2,
      initialOrder?.id
    );

    let postTax = customPrice;
    if (postTax === undefined) {
      if (sp.priceByMargin > 0) {
        postTax = sp.priceByMargin;
      } else if (sp.hasDefaultPrice) {
        postTax = sp.defaultPrice;
      } else {
        postTax = 0;
      }
    }

    const vat = prod.vatRate ?? 10;
    const rate = 1 + vat / 100;
    const qty = 1;
    // Cột Tổng tiền = Số lượng * Đơn giá sau thuế
    const totalAmount = Math.round(qty * postTax);
    // Tổng tiền trước thuế = Tổng tiền/(1+ thuế suất) làm tròn đến hàng đơn vị
    const subtotal = rate > 0 ? Math.round(totalAmount / rate) : totalAmount;
    // thuế GTGT = Tổng tiền - Tổng tiền trước thuế
    const vatAmount = totalAmount - subtotal;
    const preTax = qty > 0 ? Number((subtotal / qty).toFixed(salePriceDecimals)) : 0;

    const newItem: OrderItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      productCode: prod.code,
      productName: prod.name,
      saleUnit: prod.saleUnit,
      quantity: qty,
      preTaxPrice: preTax,
      postTaxPrice: postTax,
      itemDiscount: 0,
      vatRate: vat,
      vatAmount,
      subtotal,
      totalAmount,
    };

    setItems([...items, newItem]);
    setProductSearchTerm('');
    setIsProductDropdownOpen(false);
  };

  const handleSwapItemProduct = (
    index: number,
    newProd: Product,
    options: { keepQuantity: boolean; keepPrice: boolean; customPrice?: number }
  ) => {
    const updated = [...items];
    const oldItem = updated[index];
    if (!oldItem) return;

    const qty = options.keepQuantity ? (oldItem.quantity > 0 ? oldItem.quantity : 1) : 1;
    let postTax = options.customPrice;

    if (postTax === undefined) {
      if (options.keepPrice) {
        postTax = oldItem.postTaxPrice;
      } else {
        const sp = calculateSuggestedPrices(
          newProd,
          orderDate,
          products,
          purchases,
          allOrders,
          settings.postTaxSalePriceDecimals ?? -2,
          settings.salePriceDecimals ?? 2,
          initialOrder?.id
        );
        if (sp.priceByMargin > 0) {
          postTax = sp.priceByMargin;
        } else if (sp.hasDefaultPrice) {
          postTax = sp.defaultPrice;
        } else {
          postTax = 0;
        }
      }
    }

    const vat = newProd.vatRate ?? 10;
    const rate = 1 + vat / 100;
    const itemDiscount = oldItem.itemDiscount || 0;
    const rawTotal = qty * postTax - itemDiscount;
    const totalAmount = Math.round(Math.max(0, rawTotal));
    const subtotal = rate > 0 ? Math.round(totalAmount / rate) : totalAmount;
    const vatAmount = totalAmount - subtotal;
    const preTax = qty > 0 ? Number((subtotal / qty).toFixed(salePriceDecimals)) : 0;

    updated[index] = {
      ...oldItem,
      productCode: newProd.code,
      productName: newProd.name,
      saleUnit: newProd.saleUnit,
      quantity: qty,
      preTaxPrice: preTax,
      postTaxPrice: postTax,
      vatRate: vat,
      vatAmount,
      subtotal,
      totalAmount,
    };

    setItems(updated);
    setChangingItemIndex(null);
  };

  const handleUpdateItem = (
    index: number,
    field: 'quantity' | 'preTaxPrice' | 'postTaxPrice' | 'itemDiscount' | 'vatRate',
    val: number
  ) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'quantity') {
      item.quantity = Math.max(0, val);
    } else if (field === 'itemDiscount') {
      item.itemDiscount = Math.max(0, val);
    } else if (field === 'vatRate') {
      item.vatRate = Math.max(0, val);
    } else if (field === 'postTaxPrice') {
      item.postTaxPrice = val;
    } else if (field === 'preTaxPrice') {
      item.preTaxPrice = val;
      const rate = 1 + (item.vatRate ?? 0) / 100;
      item.postTaxPrice = Number((val * rate).toFixed(salePriceDecimals));
    }

    // Formula requested by user:
    // Cột Tổng tiền = Số lượng * Đơn giá sau thuế (sau chiết khấu nếu có)
    const rawTotal = item.quantity * item.postTaxPrice - (item.itemDiscount || 0);
    const totalAmount = Math.round(Math.max(0, rawTotal));
    // Tổng tiền trước thuế = Tổng tiền/(1+ thuế suất) làm tròn đến hàng đơn vị
    const rate = 1 + (item.vatRate || 0) / 100;
    const subtotal = rate > 0 ? Math.round(totalAmount / rate) : totalAmount;
    // thuế GTGT = Tổng tiền - Tổng tiền trước thuế
    const vatAmount = totalAmount - subtotal;

    item.totalAmount = totalAmount;
    item.subtotal = subtotal;
    item.vatAmount = vatAmount;

    // Cập nhật đơn giá bán trước thuế = subtotal / quantity
    if (field !== 'preTaxPrice') {
      item.preTaxPrice = item.quantity > 0 ? Number((subtotal / item.quantity).toFixed(salePriceDecimals)) : 0;
    }

    updated[index] = item;
    setItems(updated);
  };

  const validSelectedItemIds = useMemo(() => {
    const idSet = new Set(items.map((it) => it.id));
    return selectedItemIds.filter((id) => idSet.has(id));
  }, [items, selectedItemIds]);

  const handleToggleSelectItem = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleToggleSelectAllItems = () => {
    if (items.length === 0) return;
    if (validSelectedItemIds.length === items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map((it) => it.id));
    }
  };

  const handleRemoveItem = async (index: number) => {
    const item = items[index];
    const itemName = item ? `"${item.productName}"` : 'mặt hàng này';
    const ok = await confirm({
      title: 'Xác nhận xóa mặt hàng',
      message: `Bạn có chắc muốn xóa ${itemName} khỏi đơn hàng?`,
      confirmText: 'Xóa mặt hàng',
      type: 'danger',
    });
    if (ok) {
      setItems((prev) => prev.filter((_, i) => i !== index));
      if (item?.id) {
        setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
      }
    }
  };

  const handleBatchRemoveSelectedItems = async () => {
    if (validSelectedItemIds.length === 0) return;
    const count = validSelectedItemIds.length;
    const ok = await confirm({
      title: 'Xác nhận xóa nhiều mặt hàng',
      message: `Bạn có chắc chắn muốn xóa ${count} mặt hàng đã chọn khỏi đơn hàng này không?`,
      confirmText: `Xóa ${count} mặt hàng`,
      type: 'danger',
    });
    if (ok) {
      const selectedSet = new Set(validSelectedItemIds);
      setItems((prev) => prev.filter((it) => !selectedSet.has(it.id)));
      setSelectedItemIds([]);
    }
  };

  const isAdmin = currentUser.role === 'admin';
  const isLockedCompleted = Boolean(initialOrder && initialOrder.deliveryStatus === 'completed' && !isAdmin);

  // Sync a product's planned export quantity from the 'Danh sách mặt hàng tồn' tab directly into 'items'
  const syncProductPlannedQuantity = (prod: Product, qty: number) => {
    if (isLockedCompleted) return;
    const cleanQty = isNaN(qty) || qty <= 0 ? 0 : qty;

    if (cleanQty <= 0) {
      setItems((prev) => {
        const removedIds = new Set(prev.filter((it) => it.productCode === prod.code).map((it) => it.id));
        if (removedIds.size > 0) {
          setSelectedItemIds((sel) => sel.filter((id) => !removedIds.has(id)));
        }
        return prev.filter((it) => it.productCode !== prod.code);
      });
      return;
    }

    setItems((prev) => {
      const firstIdx = prev.findIndex((it) => it.productCode === prod.code);
      if (firstIdx !== -1) {
        const existing = prev[firstIdx];
        const postTax = existing.postTaxPrice;
        const vat = existing.vatRate ?? (prod.vatRate ?? 10);
        const rate = 1 + vat / 100;
        const discount = existing.itemDiscount || 0;
        const totalAmount = Math.round(Math.max(0, cleanQty * postTax - discount));
        const subtotal = rate > 0 ? Math.round(totalAmount / rate) : totalAmount;
        const vatAmount = totalAmount - subtotal;
        const preTax = cleanQty > 0 ? Number((subtotal / cleanQty).toFixed(salePriceDecimals)) : 0;

        const updatedFirst: OrderItem = {
          ...existing,
          quantity: cleanQty,
          preTaxPrice: preTax,
          vatAmount,
          subtotal,
          totalAmount,
        };

        // Keep single consolidated row for this productCode when updated from inventory tab
        const next: OrderItem[] = [];
        prev.forEach((it, idx) => {
          if (idx === firstIdx) {
            next.push(updatedFirst);
          } else if (it.productCode !== prod.code) {
            next.push(it);
          }
        });
        return next;
      }

      // Product not yet in order items: create new OrderItem using auto-suggested post-tax price
      let postTax = inventorySuggestedPriceMap.get(prod.code);
      if (postTax === undefined) {
        const sp = calculateSuggestedPrices(
          prod,
          orderDate,
          products,
          purchases,
          allOrders,
          settings.postTaxSalePriceDecimals ?? -2,
          salePriceDecimals,
          initialOrder?.id
        );
        postTax = sp.priceByMargin > 0 ? sp.priceByMargin : sp.hasDefaultPrice ? sp.defaultPrice : 0;
      }

      const vat = prod.vatRate ?? 10;
      const rate = 1 + vat / 100;
      const totalAmount = Math.round(cleanQty * postTax);
      const subtotal = rate > 0 ? Math.round(totalAmount / rate) : totalAmount;
      const vatAmount = totalAmount - subtotal;
      const preTax = cleanQty > 0 ? Number((subtotal / cleanQty).toFixed(salePriceDecimals)) : 0;

      const newItem: OrderItem = {
        id: `item-${Date.now()}-${Math.random()}`,
        productCode: prod.code,
        productName: prod.name,
        saleUnit: prod.saleUnit,
        quantity: cleanQty,
        preTaxPrice: preTax,
        postTaxPrice: postTax,
        itemDiscount: 0,
        vatRate: vat,
        vatAmount,
        subtotal,
        totalAmount,
      };
      return [...prev, newItem];
    });
  };

  const handlePlannedQtyChange = (prod: Product, rawValue: string) => {
    if (isLockedCompleted) return;
    setPlannedQtyDrafts((prev) => ({ ...prev, [prod.code]: rawValue }));

    if (rawValue.trim() === '') {
      return;
    }

    const parsed = parseFloat(rawValue);
    if (!isNaN(parsed)) {
      syncProductPlannedQuantity(prod, Math.max(0, parsed));
    }
  };

  const handlePlannedQtyBlur = (prod: Product) => {
    const raw = plannedQtyDrafts[prod.code];
    if (raw === undefined) return;

    const trimmed = raw.trim();
    const parsed = parseFloat(trimmed);
    if (trimmed === '' || isNaN(parsed) || parsed <= 0) {
      syncProductPlannedQuantity(prod, 0);
    } else {
      syncProductPlannedQuantity(prod, parsed);
    }

    setPlannedQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[prod.code];
      return next;
    });
  };

  const handleSwitchProductTab = (nextTab: 'order_items' | 'inventory_list') => {
    if (nextTab === activeProductTab) return;

    // Flush any uncommitted draft inputs before switching away from inventory tab
    if (activeProductTab === 'inventory_list' && Object.keys(plannedQtyDrafts).length > 0) {
      Object.entries(plannedQtyDrafts).forEach(([code, raw]) => {
        const prod = products.find((p) => p.code === code);
        if (!prod) return;
        const trimmed = String(raw).trim();
        const parsed = parseFloat(trimmed);
        if (trimmed === '' || isNaN(parsed) || parsed <= 0) {
          syncProductPlannedQuantity(prod, 0);
        } else {
          syncProductPlannedQuantity(prod, parsed);
        }
      });
      setPlannedQtyDrafts({});
    }

    setActiveProductTab(nextTab);
  };

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedCompleted) {
      alert('Đơn hàng đã hoàn thành. Chỉ tài khoản Admin mới được phép chỉnh sửa!');
      return;
    }
    if (deliveryStatus === 'completed' && initialOrder?.deliveryStatus !== 'completed' && !isAdmin) {
      alert('Chỉ tài khoản Admin mới được phép tích hoàn thành đơn hàng!');
      return;
    }
    if (!selectedCustomer) {
      alert('Vui lòng chọn thông tin khách hàng.');
      return;
    }
    if (items.length === 0) {
      alert('Vui lòng thêm ít nhất một mặt hàng vào đơn hàng.');
      return;
    }

    // 1. Mã gốc quy chiếu (rootCode): ROOT-[ngày tạo]-[STT], bất biến khi thêm, sửa, xóa
    const nowIso = new Date().toISOString();
    const creationRef = initialOrder?.createdAt || nowIso;
    const finalRootCode =
      initialOrder?.rootCode || generateNextRootCode(allOrders, deletedOrders, creationRef);

    // 2. Bảo toàn vẹn toàn Người tạo đơn gốc ban đầu
    let finalCreatedById = initialOrder?.createdById;
    let finalCreatedByName = initialOrder?.createdByName;

    if (!finalCreatedById || !finalCreatedByName) {
      if (selectedUserId && selectedUserId !== 'custom') {
        finalCreatedById = selectedUserId;
        const matchedUser = users.find((u) => u.id === selectedUserId);
        finalCreatedByName = matchedUser?.fullName || matchedUser?.username || currentUser.fullName || 'Admin';
      } else {
        finalCreatedById = currentUser.id;
        finalCreatedByName = createdByName.trim() || currentUser.fullName || 'Admin';
      }
    } else if (selectedUserId && selectedUserId !== 'custom' && selectedUserId !== initialOrder?.createdById) {
      // Chỉ khi người dùng chủ động chọn đổi nhân viên tạo đơn khác
      const matchedUser = users.find((u) => u.id === selectedUserId);
      if (matchedUser) {
        finalCreatedById = selectedUserId;
        finalCreatedByName = matchedUser.fullName || matchedUser.username;
      }
    }

    const newOrder: Order = {
      id: initialOrder ? initialOrder.id : `ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      rootCode: finalRootCode,
      orderCode: orderCode.trim() || `DH-${Date.now()}`,
      orderDate,
      customerId: selectedCustomer.id,
      customerCode: selectedCustomer.code,
      customerName: selectedCustomer.name,
      customerTaxCode: selectedCustomer.taxCode,
      customerIdCard: selectedCustomer.idCard,
      customerAddress: selectedCustomer.address,
      items,
      itemDiscountTotal: totals.itemDiscountSum,
      orderDiscount: totals.finalOrderDiscount,
      orderDiscountPercent: totals.orderDiscountPercent,
      totalPreTax: totals.subtotalPreTax,
      totalVat: totals.vatSum,
      totalAmount: totals.grandTotal,
      paymentMethod,
      paidAmount,
      debtAmount: deliveryStatus === 'cancelled' ? 0 : totals.currentOrderDebt,
      deliveryStatus,
      notes,
      orderCodeRuleId: selectedRuleId,
      createdById: finalCreatedById,
      createdByName: finalCreatedByName,
      updatedById: currentUser.id,
      updatedByName: currentUser.fullName || currentUser.username || 'Admin',
      createdAt: initialOrder ? initialOrder.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore
    }
    setHasRestoredDraft(false);
    setDraftSavedAt(null);

    onSave(newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-hidden sm:overflow-y-auto">
      <div className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[95vh] max-w-full sm:max-w-6xl xl:max-w-7xl bg-white rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 flex flex-col overflow-hidden my-0 sm:my-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 px-3.5 py-3 sm:p-5 text-white flex items-center justify-between shrink-0 rounded-none sm:rounded-t-2xl z-20">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="p-2 sm:p-2.5 rounded-xl bg-white/20 shadow-inner shrink-0">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold truncate">
                {initialOrder ? `Chỉnh sửa Đơn hàng: ${initialOrder.orderCode}` : 'Tạo mới Đơn hàng'}
              </h2>
              <p className="text-blue-100 text-[11px] sm:text-xs truncate">
                Mã đơn: <span className="font-mono font-semibold">{orderCode}</span> • Ngày: {formatDate(orderDate)}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            type="button"
            className="p-2 -mr-1 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer shrink-0"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Completed Order Lock Banner for Non-Admin */}
        {isLockedCompleted && (
          <div className="bg-amber-50 border-b border-amber-300 px-3.5 py-2.5 flex items-center gap-2 text-xs text-amber-950 font-semibold shrink-0">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Đơn hàng này đã ở trạng thái <strong>Hoàn thành</strong>. Chỉ tài khoản <strong>Admin</strong> mới được phép chỉnh sửa nội dung đơn hàng.
            </span>
          </div>
        )}

        {/* Restored Draft Notice Banner */}
        {hasRestoredDraft && (
          <div className="bg-amber-50 border-b border-amber-200 px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 text-xs text-amber-900 font-medium min-w-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold shrink-0 text-[11px]">
                i
              </span>
              <span className="truncate">
                Đã tự động khôi phục dữ liệu đơn hàng đang soạn dở{draftSavedAt ? ` (lưu lúc ${draftSavedAt})` : ''}.
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearDraft}
              className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-300 rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              Xóa bản nháp này
            </button>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="p-3 sm:p-6 overflow-y-auto overflow-x-hidden space-y-4 sm:space-y-6 flex-1 overscroll-contain">
          {/* Top Bar: Order Code & Rule & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 min-w-0">
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Quy tắc tạo mã:
              </label>
              <select
                value={selectedRuleId}
                onChange={(e) => handleRuleChange(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer"
                title="Thay đổi quy tắc tạo mã đơn, mã đơn sẽ tự cập nhật số thứ tự tăng dần"
              >
                {selectableRules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.isDefault ? '★' : ''} {r.isLocked ? '(Đã khóa)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Mã đơn hàng:
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                  title="Tự động tính lại số thứ tự tiếp theo của quy tắc đã chọn"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Tạo lại</span>
                </button>
              </div>
              <input
                type="text"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Ngày đặt hàng:
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Người tạo đơn / Bán hàng:
              </label>
              <div className="space-y-1.5">
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedUserId(val);
                    if (val === 'custom') {
                      // Keep current name or reset
                    } else {
                      const u = users.find((item) => item.id === val);
                      if (u) {
                        setCreatedByName(u.fullName || u.username);
                      }
                    }
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.username} ({u.role === 'admin' ? 'Quản trị' : u.role === 'manager' ? 'Quản lý' : 'Bán hàng'})
                    </option>
                  ))}
                  <option value="custom">✏️ Nhập tên khác...</option>
                </select>

                {selectedUserId === 'custom' && (
                  <input
                    type="text"
                    value={createdByName}
                    onChange={(e) => setCreatedByName(e.target.value)}
                    placeholder="Nhập họ tên nhân viên..."
                    className="w-full px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400"
                    autoFocus
                  />
                )}
              </div>
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Trạng thái giao hàng (Mặc định: Chờ giao):
              </label>
              <select
                value={deliveryStatus}
                disabled={isLockedCompleted}
                onChange={(e) => {
                  const next = e.target.value as DeliveryStatus;
                  if (next === 'completed' && !isAdmin) {
                    alert('Chỉ tài khoản Admin mới được phép tích hoàn thành đơn hàng!');
                    return;
                  }
                  setDeliveryStatus(next);
                }}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                title={!isAdmin ? 'Chỉ tài khoản Admin mới được phép chọn trạng thái Hoàn thành' : undefined}
              >
                <option value="pending">⏳ Chờ giao (Mặc định)</option>
                <option value="delivering">🚚 Đang giao</option>
                <option value="completed" disabled={!isAdmin}>
                  {isAdmin ? '✅ Hoàn thành' : '🔒 Hoàn thành (Chỉ Admin)'}
                </option>
                <option value="cancelled">❌ Đã hủy</option>
              </select>
            </div>
          </div>

          {/* Section 1: Customer Information & Quick Search */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                  Thông tin người mua / Khách hàng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCustomerForModal(null);
                  setIsCustomerModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Thêm mới khách hàng</span>
              </button>
            </div>

            {/* Quick search input */}
            <div ref={customerSearchRef} className="relative">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tìm kiếm khách hàng (theo Tên, Tên gợi nhớ, MST, SĐT, Mã KH, Địa chỉ):
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Bỏ trống để tìm kiếm nhanh theo Tên, Tên nhớ, MST, SĐT, Mã KH, Địa chỉ..."
                  value={customerSearchTerm}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                  onChange={(e) => {
                    setCustomerSearchTerm(e.target.value);
                    setIsCustomerDropdownOpen(true);
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>

              {/* Autocomplete dropdown */}
              {isCustomerDropdownOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">
                      Không tìm thấy khách hàng. Bấm "+ Thêm mới khách hàng" để tạo nhanh.
                    </div>
                  ) : (
                    filteredCustomers.map((cust) => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(cust);
                          setCustomerSearchTerm(`${cust.name} (${cust.code})`);
                          setIsCustomerDropdownOpen(false);
                        }}
                        className="w-full text-left p-3 hover:bg-blue-50/70 border-b border-slate-100 last:border-none flex items-start justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs sm:text-sm text-slate-900">
                            {cust.name}{' '}
                            {cust.shortName && cust.shortName !== cust.name && (
                              <span className="text-slate-500 font-normal">({cust.shortName})</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            <span className="font-mono text-blue-600">{cust.code}</span>
                            {cust.softwareCode && (
                              <span className="font-mono text-indigo-600">Mã PM: {cust.softwareCode}</span>
                            )}
                            {cust.reconciliationName && (
                              <span>Đ/C tên: {cust.reconciliationName}</span>
                            )}
                            {cust.phone && <span>SĐT: {cust.phone}</span>}
                            {cust.taxCode && <span>MST: {cust.taxCode}</span>}
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-start gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">
                              Địa chỉ:{' '}
                              <span className={cust.address ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}>
                                {cust.address || 'Chưa cập nhật'}
                              </span>
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          {cust.type === 'organization' ? 'Tổ chức' : 'Cá nhân'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected customer quick summary & Debt glance */}
            {selectedCustomer ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-blue-50/50 rounded-xl border border-blue-200/80 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-blue-950 text-sm flex items-center gap-2">
                    <span>{selectedCustomer.name}</span>
                    <span className="font-mono text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                      {selectedCustomer.code}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    <span className="font-medium">MST / CCCD:</span>{' '}
                    {selectedCustomer.taxCode || selectedCustomer.idCard || 'Chưa có'}
                    {selectedCustomer.phone && ` • SĐT: ${selectedCustomer.phone}`}
                  </div>
                  <div className="text-slate-600">
                    <span className="font-medium">Địa chỉ:</span> {selectedCustomer.address || 'Chưa cập nhật'}
                  </div>

                  {/* Actions on selected customer: Cập nhật thông tin KH & Đổi khách hàng */}
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCustomerForModal(selectedCustomer);
                        setIsCustomerModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-white hover:bg-blue-100 border border-blue-300 shadow-2xs transition-colors cursor-pointer"
                      title="Cập nhật hoặc chỉnh sửa thông tin khách hàng này"
                    >
                      <Edit className="w-3.5 h-3.5 text-blue-600" />
                      <span>Cập nhật thông tin khách hàng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearchTerm('');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 transition-colors cursor-pointer"
                      title="Bỏ chọn để tìm kiếm khách hàng khác"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Đổi KH</span>
                    </button>
                  </div>
                </div>

                {/* Customer debt and history preview */}
                <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Công nợ cũ của khách:
                    </span>
                    <span className="font-bold text-sm text-rose-600">
                      {formatCurrency(customerHistory.priorDebt)}
                    </span>
                  </div>

                  {/* Recent orders preview */}
                  <div>
                    <span className="text-[11px] font-medium text-slate-500">Đơn hàng đã lấy gần đây:</span>
                    {customerHistory.recentOrders.length === 0 ? (
                      <span className="text-[11px] text-slate-400 ml-2">Chưa có đơn trước đó</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {customerHistory.recentOrders.map((ro) => (
                          <span
                            key={ro.id}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            <span className="font-mono">{ro.orderCode}</span>
                            <span className="text-slate-400">({formatDate(ro.orderDate)})</span>
                            <span className="font-semibold text-slate-900">{formatCurrency(ro.totalAmount)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-600 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Chưa chọn khách hàng. Gõ vào ô tìm kiếm ở trên để tìm kiếm nhanh theo Tên, Tên nhớ, MST, SĐT, Mã KH hoặc bấm thêm mới.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCustomerForModal(null);
                    setIsCustomerModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg font-semibold text-xs shrink-0 cursor-pointer transition-colors"
                >
                  + Thêm KH mới
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Product selection, Inventory tab & Items table */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              {/* Tab Switcher: Danh sách mặt hàng bán | Danh sách mặt hàng tồn */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start overflow-x-auto max-w-full">
                <button
                  type="button"
                  onClick={() => handleSwitchProductTab('order_items')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    activeProductTab === 'order_items'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Receipt className="w-4 h-4 shrink-0" />
                  <span>Danh sách mặt hàng bán ({items.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchProductTab('inventory_list')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    activeProductTab === 'inventory_list'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Package className="w-4 h-4 shrink-0" />
                  <span>Danh sách mặt hàng tồn ({products.length})</span>
                </button>
              </div>

              {/* Quick product search input (when on Danh sách mặt hàng bán tab) */}
              {activeProductTab === 'order_items' && (
                <div ref={productSearchRef} className="relative w-full lg:flex-1 lg:min-w-0">
                  <input
                    type="text"
                    placeholder="Gõ mã hàng, mã đối chiếu hoặc tên mặt hàng để tìm và thêm..."
                    value={productSearchTerm}
                    onFocus={() => setIsProductDropdownOpen(true)}
                    onChange={(e) => {
                      setProductSearchTerm(e.target.value);
                      setIsProductDropdownOpen(true);
                    }}
                    className="w-full pl-9 pr-3 py-1.5 md:py-2 border border-slate-300 rounded-lg md:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

                  {isProductDropdownOpen && (
                    <div className="absolute z-30 left-0 right-0 min-w-full sm:min-w-[520px] mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto divide-y divide-slate-100">
                      <div className="px-3 py-1.5 bg-slate-100 text-[11px] text-slate-700 flex items-center justify-between font-medium border-b border-slate-200 sticky top-0 z-10">
                        <span>Tồn kho tính đến ngày: <strong className="text-indigo-700">{formatDate(orderDate)}</strong></span>
                        <span className="text-[10px] text-slate-500">({filteredProducts.length} mặt hàng)</span>
                      </div>
                      {filteredProducts.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          Không tìm thấy mặt hàng nào phù hợp với &quot;{productSearchTerm}&quot;
                        </div>
                      ) : (
                        filteredProducts.map((p) => {
                          const stock = inventoryStockMap.get(p.code)?.inStock ?? 0;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleAddProduct(p)}
                              className="w-full text-left p-2.5 hover:bg-indigo-50/80 flex flex-col gap-1 transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-xs text-slate-900 group-hover:text-indigo-900 line-clamp-1">
                                  {p.name}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                                    stock > 0
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : stock === 0
                                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                  title={`Số lượng tồn kho đến ngày ${formatDate(orderDate)}: ${formatNumber(stock)} ${p.saleUnit}`}
                                >
                                  <span className="text-[10px] font-medium text-slate-500">Tồn:</span>
                                  <span>{formatNumber(stock)}</span>
                                  <span className="text-[10px] font-normal text-slate-500">{p.saleUnit}</span>
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-indigo-600 font-semibold bg-indigo-50 px-1 rounded">
                                    {p.code}
                                  </span>
                                  {p.reconciliationCode && (
                                    <span className="font-mono text-slate-600 bg-slate-100 px-1 rounded">
                                      ĐC: {p.reconciliationCode}
                                    </span>
                                  )}
                                  {p.category && (
                                    <span className="text-slate-400">({p.category})</span>
                                  )}
                                  <span>ĐVT: <strong className="text-slate-700">{p.saleUnit}</strong></span>
                                  <span>Thuế: {p.vatRate}%</span>
                                </div>
                                <span className="text-xs font-semibold text-blue-600 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white px-2 py-0.5 rounded transition-colors shrink-0 ml-2">
                                  + Thêm
                                </span>
                              </div>

                              {/* Suggested prices preview */}
                              {(() => {
                                const sp = calculateSuggestedPrices(
                                  p,
                                  orderDate,
                                  products,
                                  purchases,
                                  allOrders,
                                  settings.postTaxSalePriceDecimals ?? -2,
                                  settings.salePriceDecimals ?? 2,
                                  initialOrder?.id
                                );
                                const hasSuggestions =
                                  sp.priceByMargin > 0 ||
                                  sp.hasInputCost ||
                                  sp.defaultPrice > 0 ||
                                  sp.hasDefaultPrice ||
                                  sp.priceMinusVariance > 0 ||
                                  sp.pricePlusVariance > 0;
                                if (!hasSuggestions) return null;
                                return (
                                  <div className="text-[10px] text-slate-600 flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                                    <span className="text-slate-400 font-medium">Giá gợi ý:</span>
                                    {(sp.priceByMargin > 0 || (sp.hasInputCost && sp.maxCostPerSaleUnit === 0)) && (
                                      <span className="bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded border border-indigo-200">
                                        TSLN: {formatNumber(sp.priceByMargin)}₫
                                      </span>
                                    )}
                                    {(sp.defaultPrice > 0 || sp.hasDefaultPrice) && (
                                      <span className="bg-blue-50 text-blue-700 font-bold px-1.5 py-0.2 rounded border border-blue-200">
                                        Mặc định: {formatNumber(sp.defaultPrice)}₫
                                      </span>
                                    )}
                                    {sp.priceMinusVariance > 0 && (
                                      <span className="bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">
                                        (-): {formatNumber(sp.priceMinusVariance)}₫
                                      </span>
                                    )}
                                    {sp.pricePlusVariance > 0 && (
                                      <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
                                        (+): {formatNumber(sp.pricePlusVariance)}₫
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tab 2: Danh sách mặt hàng tồn */}
            {activeProductTab === 'inventory_list' ? (
              <div className="space-y-3">
                {/* Filter & Search Toolbar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="text"
                        placeholder="Tìm kiếm trong toàn bộ mặt hàng tồn theo tên, mã HH, mã đối chiếu, nhóm hàng..."
                        value={inventorySearchTerm}
                        onChange={(e) => setInventorySearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      {inventorySearchTerm && (
                        <button
                          type="button"
                          onClick={() => setInventorySearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          title="Xóa từ khóa tìm kiếm"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Numeric stock range filter */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                        <Filter className="w-3.5 h-3.5 text-slate-500" />
                        <span>Lọc tồn:</span>
                      </span>
                      <input
                        type="number"
                        step="any"
                        placeholder="Tồn từ"
                        value={minStockFilter}
                        onChange={(e) => setMinStockFilter(e.target.value)}
                        className="w-24 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 tabular-nums focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-400">—</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="Đến"
                        value={maxStockFilter}
                        onChange={(e) => setMaxStockFilter(e.target.value)}
                        className="w-24 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 tabular-nums focus:ring-1 focus:ring-blue-500"
                      />
                      {(minStockFilter || maxStockFilter) && (
                        <button
                          type="button"
                          onClick={() => {
                            setMinStockFilter('');
                            setMaxStockFilter('');
                          }}
                          className="text-[11px] font-semibold text-rose-600 hover:underline px-1 cursor-pointer"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick segmented stock status filter + inventory date info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { id: 'all' as const, label: `Tất cả (${inventoryTabStats.totalProducts})` },
                        { id: 'in_stock' as const, label: `Còn tồn > 0 (${inventoryTabStats.inStockCount})` },
                        { id: 'zero_stock' as const, label: `Hết hàng = 0 (${inventoryTabStats.zeroStockCount})` },
                        { id: 'negative_stock' as const, label: `Âm kho < 0 (${inventoryTabStats.negativeStockCount})` },
                        { id: 'planned' as const, label: `Đã nhập SL xuất (${inventoryTabStats.plannedProductCount})` },
                      ].map((tabOpt) => (
                        <button
                          key={tabOpt.id}
                          type="button"
                          onClick={() => setStockFilterType(tabOpt.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            stockFilterType === tabOpt.id
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {tabOpt.label}
                        </button>
                      ))}
                    </div>
                    <div className="text-[11px] text-slate-500 whitespace-nowrap">
                      Tồn tính đến: <strong className="text-indigo-700">{formatDate(orderDate)}</strong> · Hiển thị{' '}
                      <strong className="text-slate-800 tabular-nums">{filteredInventoryProducts.length}</strong>/{products.length}
                    </div>
                  </div>
                </div>

                {/* Inventory Table (Desktop) & Cards (Mobile) */}
                {filteredInventoryProducts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                    Không có mặt hàng nào khớp với điều kiện lọc hiện tại.
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto max-h-[420px] overflow-y-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="p-2.5 text-center w-10">#</th>
                            <th className="p-2.5 text-left min-w-56">Tên mặt hàng</th>
                            <th className="p-2.5 text-center w-20">ĐVT</th>
                            <th className="p-2.5 text-right w-28">Số lượng tồn</th>
                            <th className="p-2.5 text-center w-36 bg-blue-50/70 text-blue-900">Số lượng xuất dự kiến</th>
                            <th className="p-2.5 text-right w-40">Tổng thanh toán dự kiến</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredInventoryProducts.map((p, idx) => {
                            const stock = inventoryStockMap.get(p.code)?.inStock ?? 0;
                            const existingInfo = orderItemsByProductCode.get(p.code);
                            const draftVal = plannedQtyDrafts[p.code];
                            const inputDisplayValue =
                              draftVal !== undefined
                                ? draftVal
                                : existingInfo && existingInfo.totalQty > 0
                                ? String(existingInfo.totalQty)
                                : '';

                            const effectiveQty =
                              draftVal !== undefined
                                ? Math.max(0, parseFloat(draftVal) || 0)
                                : existingInfo?.totalQty ?? 0;

                            const unitPostTaxPrice =
                              existingInfo?.unitPostTaxPrice ?? inventorySuggestedPriceMap.get(p.code) ?? 0;

                            const expectedPayment =
                              draftVal !== undefined
                                ? Math.round(effectiveQty * unitPostTaxPrice)
                                : existingInfo && existingInfo.totalQty > 0
                                ? existingInfo.totalAmount
                                : Math.round(effectiveQty * unitPostTaxPrice);

                            const hasPlanned = effectiveQty > 0;

                            return (
                              <tr
                                key={p.id}
                                className={`transition-colors ${
                                  hasPlanned ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
                                }`}
                              >
                                <td className="p-2.5 text-center text-slate-400 font-semibold tabular-nums">
                                  {idx + 1}
                                </td>
                                <td className="p-2.5">
                                  <div className="font-semibold text-slate-900 leading-snug">{p.name}</div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="font-mono text-indigo-700 font-semibold">{p.code}</span>
                                    {p.reconciliationCode && (
                                      <span className="font-mono text-slate-600">ĐC: {p.reconciliationCode}</span>
                                    )}
                                    {p.category && <span>· {p.category}</span>}
                                    <span>· Thuế {p.vatRate}%</span>
                                    <span>
                                      · ĐG sau thuế:{' '}
                                      <strong className="text-slate-700 font-mono tabular-nums">
                                        {formatNumber(unitPostTaxPrice)}₫
                                      </strong>
                                    </span>
                                  </div>
                                </td>
                                <td className="p-2.5 text-center font-medium text-slate-700">
                                  {p.saleUnit}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold tabular-nums">
                                  <span
                                    className={
                                      stock > 0
                                        ? 'text-emerald-700'
                                        : stock === 0
                                        ? 'text-slate-500'
                                        : 'text-rose-600'
                                    }
                                  >
                                    {formatNumber(stock)}
                                  </span>
                                </td>
                                <td className="p-2.5 text-center bg-blue-50/20">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="0"
                                    disabled={isLockedCompleted}
                                    value={inputDisplayValue}
                                    onChange={(e) => handlePlannedQtyChange(p, e.target.value)}
                                    onBlur={() => handlePlannedQtyBlur(p)}
                                    className={`w-28 px-2.5 py-1.5 text-center font-bold rounded-lg border text-xs tabular-nums focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed ${
                                      hasPlanned
                                        ? 'bg-white border-blue-500 text-blue-900 shadow-2xs'
                                        : 'bg-white border-slate-300 text-slate-800'
                                    }`}
                                  />
                                </td>
                                <td className="p-2.5 text-right font-mono tabular-nums">
                                  <span
                                    className={
                                      hasPlanned
                                        ? 'font-bold text-blue-900 text-sm'
                                        : 'text-slate-400 font-medium'
                                    }
                                  >
                                    {formatCurrency(expectedPayment)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="block md:hidden space-y-2.5 max-h-[420px] overflow-y-auto pr-0.5">
                      {filteredInventoryProducts.map((p, idx) => {
                        const stock = inventoryStockMap.get(p.code)?.inStock ?? 0;
                        const existingInfo = orderItemsByProductCode.get(p.code);
                        const draftVal = plannedQtyDrafts[p.code];
                        const inputDisplayValue =
                          draftVal !== undefined
                            ? draftVal
                            : existingInfo && existingInfo.totalQty > 0
                            ? String(existingInfo.totalQty)
                            : '';

                        const effectiveQty =
                          draftVal !== undefined
                            ? Math.max(0, parseFloat(draftVal) || 0)
                            : existingInfo?.totalQty ?? 0;

                        const unitPostTaxPrice =
                          existingInfo?.unitPostTaxPrice ?? inventorySuggestedPriceMap.get(p.code) ?? 0;

                        const expectedPayment =
                          draftVal !== undefined
                            ? Math.round(effectiveQty * unitPostTaxPrice)
                            : existingInfo && existingInfo.totalQty > 0
                            ? existingInfo.totalAmount
                            : Math.round(effectiveQty * unitPostTaxPrice);

                        const hasPlanned = effectiveQty > 0;

                        return (
                          <div
                            key={p.id}
                            className={`rounded-xl border p-3 space-y-2 transition-colors ${
                              hasPlanned ? 'bg-blue-50/40 border-blue-300' : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                                  {idx + 1}. {p.name}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                                  <span className="font-mono text-indigo-700 font-semibold">{p.code}</span>
                                  <span>ĐVT: <strong className="text-slate-700">{p.saleUnit}</strong></span>
                                  <span>ĐG: <strong className="font-mono tabular-nums">{formatNumber(unitPostTaxPrice)}₫</strong></span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[10px] text-slate-500 block">Số lượng tồn</span>
                                <span
                                  className={`font-mono font-bold text-xs tabular-nums ${
                                    stock > 0
                                      ? 'text-emerald-700'
                                      : stock === 0
                                      ? 'text-slate-500'
                                      : 'text-rose-600'
                                  }`}
                                >
                                  {formatNumber(stock)} {p.saleUnit}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100 items-end">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                  SL xuất dự kiến ({p.saleUnit}):
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="0"
                                  disabled={isLockedCompleted}
                                  value={inputDisplayValue}
                                  onChange={(e) => handlePlannedQtyChange(p, e.target.value)}
                                  onBlur={() => handlePlannedQtyBlur(p)}
                                  className={`w-full px-2.5 py-1.5 text-center font-bold rounded-lg border text-xs tabular-nums focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 ${
                                    hasPlanned ? 'bg-white border-blue-500 text-blue-900' : 'bg-white border-slate-300 text-slate-800'
                                  }`}
                                />
                              </div>
                              <div className="text-right">
                                <span className="block text-[10px] text-slate-500 mb-1">Tổng TT dự kiến:</span>
                                <span
                                  className={`font-mono text-xs sm:text-sm tabular-nums ${
                                    hasPlanned ? 'font-bold text-blue-900' : 'text-slate-400 font-medium'
                                  }`}
                                >
                                  {formatCurrency(expectedPayment)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Bottom summary & quick switch back to 'Danh sách mặt hàng bán' */}
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
                    <span>
                      Đã điền xuất dự kiến:{' '}
                      <strong className="text-blue-800 tabular-nums">{inventoryTabStats.plannedProductCount}</strong> mặt hàng
                    </span>
                    <span>
                      Tổng SL dự kiến:{' '}
                      <strong className="text-blue-800 tabular-nums">{formatNumber(inventoryTabStats.plannedTotalQty)}</strong>
                    </span>
                    <span>
                      Tổng thanh toán dự kiến:{' '}
                      <strong className="text-blue-900 font-mono tabular-nums">
                        {formatCurrency(inventoryTabStats.plannedTotalAmount)}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSwitchProductTab('order_items')}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Xem danh sách mặt hàng bán ({items.length})</span>
                  </button>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                Chưa có mặt hàng nào trong đơn. Tìm kiếm sản phẩm ở trên hoặc chuyển sang tab{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchProductTab('inventory_list')}
                  className="text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  Danh sách mặt hàng tồn
                </button>{' '}
                để điền số lượng xuất dự kiến.
              </div>
            ) : (
              <>
                {/* Header with selection controls, batch delete & quick auto-recalculate prices */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && validSelectedItemIds.length === items.length}
                        onChange={handleToggleSelectAllItems}
                        disabled={isLockedCompleted || items.length === 0}
                        className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer disabled:opacity-50"
                      />
                      <span>Danh sách mặt hàng ({items.length})</span>
                    </label>

                    <button
                      type="button"
                      disabled={isLockedCompleted || validSelectedItemIds.length === 0}
                      onClick={handleBatchRemoveSelectedItems}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        validSelectedItemIds.length > 0 && !isLockedCompleted
                          ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 shadow-2xs cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      }`}
                      title="Tích chọn nhiều mặt hàng bên dưới rồi bấm để xóa hàng loạt"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa mặt hàng đã chọn ({validSelectedItemIds.length})</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoRecalculateCurrentOrder}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 transition-colors shadow-2xs cursor-pointer"
                    title="Tự động tính lại đơn giá sau thuế cho tất cả các mặt hàng theo Giá vốn cao nhất (FIFO) và Tỷ suất lợi nhuận của từng sản phẩm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>⚡ Tự động tính lại giá bán tất cả mặt hàng</span>
                  </button>
                </div>

                {/* Desktop View: Full detailed table with align-top */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2 text-center w-9">
                          <input
                            type="checkbox"
                            checked={items.length > 0 && validSelectedItemIds.length === items.length}
                            onChange={handleToggleSelectAllItems}
                            disabled={isLockedCompleted || items.length === 0}
                            title="Chọn / Bỏ chọn tất cả mặt hàng"
                            className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer disabled:opacity-50"
                          />
                        </th>
                        <th className="p-2 text-center w-8">#</th>
                        <th className="p-2 text-left min-w-44">Tên mặt hàng</th>
                        <th className="p-2 text-center w-16">ĐVT</th>
                        <th className="p-2 text-center w-20">Số lượng</th>
                        <th className="p-2 text-left min-w-36 text-blue-900 bg-blue-50/40">Đơn giá sau thuế</th>
                        <th className="p-2 text-left min-w-28">Đơn giá trước thuế</th>
                        <th className="p-2 text-left min-w-24">Chiết khấu</th>
                        <th className="p-2 text-center w-16">Thuế %</th>
                        <th className="p-2 text-right min-w-28">Tiền trước thuế</th>
                        <th className="p-2 text-right min-w-24">Thuế GTGT</th>
                        <th className="p-2 text-right min-w-28">Tổng tiền</th>
                        <th className="p-2 text-center w-12">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => {
                        const isItemSelected = validSelectedItemIds.includes(item.id);
                        return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isItemSelected ? 'bg-rose-50/60 hover:bg-rose-50/90' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* 0. Checkbox chọn xóa hàng loạt */}
                          <td className="p-2 text-center align-top pt-2.5">
                            <input
                              type="checkbox"
                              checked={isItemSelected}
                              onChange={() => handleToggleSelectItem(item.id)}
                              disabled={isLockedCompleted}
                              aria-label={`Chọn mặt hàng ${item.productName}`}
                              className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer disabled:opacity-50"
                            />
                          </td>

                          {/* 1. STT - Top aligned */}
                          <td className="p-2 text-center text-slate-400 align-top pt-2.5 font-semibold">
                            {idx + 1}
                          </td>

                          {/* 2. Tên mặt hàng & Đổi hàng - Top aligned */}
                          <td className="p-2 align-top">
                            <div className="font-semibold text-slate-800 leading-snug">{item.productName}</div>
                            <div className="font-mono text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="font-semibold text-indigo-700 bg-indigo-50/80 px-1 py-0.2 rounded border border-indigo-100">
                                {item.productCode}
                              </span>
                              {(() => {
                                const stock = inventoryStockMap.get(item.productCode)?.inStock;
                                if (stock === undefined) return null;
                                return (
                                  <span
                                    className={`text-[10px] px-1 py-0.2 rounded font-semibold ${
                                      stock > 0
                                        ? 'text-emerald-700 bg-emerald-50'
                                        : stock === 0
                                        ? 'text-slate-600 bg-slate-100'
                                        : 'text-rose-700 bg-rose-50'
                                    }`}
                                    title={`Số lượng tồn kho đến ngày ${formatDate(orderDate)}: ${formatNumber(stock)} ${item.saleUnit}`}
                                  >
                                    (Tồn: {formatNumber(stock)} {item.saleUnit})
                                  </span>
                                );
                              })()}
                            </div>
                            {/* Nút Đổi mặt hàng đã chọn */}
                            <div className="mt-1.5">
                              <button
                                type="button"
                                onClick={() => setChangingItemIndex(idx)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                                title="Đổi mặt hàng này sang hàng khác trong danh mục"
                              >
                                <RefreshCw className="w-3 h-3 text-indigo-600" />
                                <span>Đổi hàng</span>
                              </button>
                            </div>
                          </td>

                          {/* 3. ĐVT - Top aligned */}
                          <td className="p-2 text-center text-slate-600 align-top pt-2.5 font-medium">
                            {item.saleUnit}
                          </td>

                          {/* 4. Số lượng - Top aligned */}
                          <td className="p-2 align-top">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-center font-bold text-slate-900 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </td>

                          {/* 5. Đơn giá sau thuế (CHUYỂN LÊN TRƯỚC theo yêu cầu) - Top aligned */}
                          <td className="p-2 min-w-44 align-top bg-blue-50/20">
                            <input
                              type="number"
                              step="any"
                              value={item.postTaxPrice}
                              onChange={(e) => handleUpdateItem(idx, 'postTaxPrice', parseFloat(e.target.value) || 0)}
                              title="Sửa đơn giá sau thuế sẽ tự động tính lại đơn giá trước thuế"
                              className="w-full px-2 py-1 text-right font-bold text-blue-900 bg-blue-50/60 border border-blue-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                            />
                            {/* Gợi ý giá nhanh */}
                            {(() => {
                              const prod = products.find((p) => p.code === item.productCode);
                              if (!prod) return null;
                              const sp = calculateSuggestedPrices(
                                prod,
                                orderDate,
                                products,
                                purchases,
                                allOrders,
                                settings.postTaxSalePriceDecimals ?? -2,
                                settings.salePriceDecimals ?? 2,
                                initialOrder?.id
                              );
                              const hasSuggestions =
                                sp.priceByMargin > 0 ||
                                sp.hasInputCost ||
                                sp.defaultPrice > 0 ||
                                sp.hasDefaultPrice ||
                                sp.priceMinusVariance > 0 ||
                                sp.pricePlusVariance > 0;
                              if (!hasSuggestions) return null;

                              return (
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  {(sp.priceByMargin > 0 || (sp.hasInputCost && sp.maxCostPerSaleUnit === 0)) && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItem(idx, 'postTaxPrice', sp.priceByMargin)}
                                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                                        Math.abs(item.postTaxPrice - sp.priceByMargin) < 0.01
                                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'
                                      }`}
                                      title={`Giá theo TSLN ${prod.profitMargin}% (Đơn giá MAX tồn: ${formatNumber(sp.maxCostPerPurchaseUnit)} ₫)`}
                                    >
                                      TSLN: {formatNumber(sp.priceByMargin)}
                                    </button>
                                  )}
                                  {sp.priceMinusVariance > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItem(idx, 'postTaxPrice', sp.priceMinusVariance)}
                                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border transition-colors cursor-pointer ${
                                        Math.abs(item.postTaxPrice - sp.priceMinusVariance) < 0.01
                                          ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
                                      }`}
                                      title="Giá biên độ (-)"
                                    >
                                      (-) {formatNumber(sp.priceMinusVariance)}
                                    </button>
                                  )}
                                  {(sp.defaultPrice > 0 || sp.hasDefaultPrice) && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItem(idx, 'postTaxPrice', sp.defaultPrice)}
                                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                                        Math.abs(item.postTaxPrice - sp.defaultPrice) < 0.01
                                          ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                                      }`}
                                      title="Giá bán mặc định"
                                    >
                                      MĐ: {formatNumber(sp.defaultPrice)}
                                    </button>
                                  )}
                                  {sp.pricePlusVariance > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItem(idx, 'postTaxPrice', sp.pricePlusVariance)}
                                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border transition-colors cursor-pointer ${
                                        Math.abs(item.postTaxPrice - sp.pricePlusVariance) < 0.01
                                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200'
                                      }`}
                                      title="Giá biên độ (+)"
                                    >
                                      (+) {formatNumber(sp.pricePlusVariance)}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* 6. Đơn giá trước thuế (CHUYỂN RA SAU) - Top aligned */}
                          <td className="p-2 align-top">
                            <input
                              type="number"
                              step="any"
                              value={item.preTaxPrice}
                              onChange={(e) => handleUpdateItem(idx, 'preTaxPrice', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 text-right text-slate-800 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </td>

                          {/* 7. Chiết khấu - Top aligned */}
                          <td className="p-2 align-top">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.itemDiscount}
                              onChange={(e) => handleUpdateItem(idx, 'itemDiscount', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 text-right text-slate-700 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </td>

                          {/* 8. Thuế suất % - Top aligned */}
                          <td className="p-2 text-center align-top">
                            <input
                              type="number"
                              min="0"
                              value={item.vatRate}
                              onChange={(e) => handleUpdateItem(idx, 'vatRate', parseFloat(e.target.value) || 0)}
                              className="w-12 px-1 py-1 text-center text-slate-700 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </td>

                          {/* 9. Tiền trước thuế - Top aligned */}
                          <td className="p-2 text-right text-slate-700 font-mono align-top pt-2.5">
                            {formatCurrency(item.subtotal)}
                          </td>

                          {/* 10. Tiền thuế GTGT - Top aligned */}
                          <td className="p-2 text-right text-slate-700 font-mono align-top pt-2.5">
                            {formatCurrency(item.vatAmount)}
                          </td>

                          {/* 11. Tổng tiền - Top aligned */}
                          <td className="p-2 text-right font-bold text-slate-900 font-mono align-top pt-2.5">
                            {formatCurrency(item.totalAmount)}
                          </td>

                          {/* 12. Nút Xóa - Top aligned */}
                          <td className="p-2 text-center align-top pt-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                              title="Xóa dòng mặt hàng này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View: Clean, intuitive, touch-friendly Card Layout for phones */}
                <div className="block md:hidden space-y-3">
                  {items.map((item, idx) => {
                    const prod = products.find((p) => p.code === item.productCode);
                    const stock = inventoryStockMap.get(item.productCode)?.inStock;
                    const sp = prod
                      ? calculateSuggestedPrices(
                          prod,
                          orderDate,
                          products,
                          purchases,
                          allOrders,
                          settings.postTaxSalePriceDecimals ?? -2,
                          settings.salePriceDecimals ?? 2,
                          initialOrder?.id
                        )
                      : null;

                    const isItemSelected = validSelectedItemIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-3 shadow-2xs space-y-2.5 transition-colors ${
                          isItemSelected
                            ? 'bg-rose-50/50 border-rose-300'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        {/* Header card: Checkbox, Index, Name, Code, Stock, Action buttons */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isItemSelected}
                              onChange={() => handleToggleSelectItem(item.id)}
                              disabled={isLockedCompleted}
                              aria-label={`Chọn mặt hàng ${item.productName}`}
                              className="w-4 h-4 mt-1 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer shrink-0 disabled:opacity-50"
                            />
                            <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-sm leading-snug">
                                {item.productName}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs">
                                <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                                  {item.productCode}
                                </span>
                                <span className="text-slate-500 text-[11px]">
                                  ĐVT: <strong className="text-slate-800">{item.saleUnit}</strong>
                                </span>
                                {stock !== undefined && (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                      stock > 0
                                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                        : stock === 0
                                        ? 'text-slate-600 bg-slate-100 border border-slate-200'
                                        : 'text-rose-700 bg-rose-50 border border-rose-200'
                                    }`}
                                  >
                                    Tồn: {formatNumber(stock)} {item.saleUnit}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setChangingItemIndex(idx)}
                              className="px-2 py-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors active:scale-95 shadow-2xs"
                              title="Đổi mặt hàng này sang hàng khác"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Đổi hàng</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Xóa mặt hàng này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Input Rows */}
                        <div className="space-y-2">
                          {/* Row 1: Số lượng & Đơn giá sau thuế (Có VAT - Placed FIRST) */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Số lượng ({item.saleUnit}):
                              </label>
                              <input
                                type="number"
                                min="1"
                                step="any"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 text-center font-bold text-slate-900 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-blue-900 mb-1 flex items-center justify-between">
                                <span>ĐG sau thuế:</span>
                                <span className="text-[10px] text-blue-600 font-semibold bg-blue-100/60 px-1 py-0.2 rounded">Có VAT</span>
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={item.postTaxPrice}
                                onChange={(e) => handleUpdateItem(idx, 'postTaxPrice', parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 text-right font-black text-blue-800 bg-blue-50/60 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          {/* Quick suggested price chips for mobile */}
                          {sp && (sp.priceByMargin > 0 || sp.hasInputCost || sp.defaultPrice > 0 || sp.hasDefaultPrice || sp.priceMinusVariance > 0 || sp.pricePlusVariance > 0) && (
                            <div className="flex flex-wrap items-center gap-1 text-[11px] bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                              <span className="text-[10px] text-slate-400 font-semibold pl-1">Gợi ý:</span>
                              {(sp.priceByMargin > 0 || (sp.hasInputCost && sp.maxCostPerSaleUnit === 0)) && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(idx, 'postTaxPrice', sp.priceByMargin)}
                                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                                    Math.abs(item.postTaxPrice - sp.priceByMargin) < 0.01
                                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'
                                  }`}
                                  title={`Giá theo TSLN ${prod?.profitMargin}%`}
                                >
                                  TSLN: {formatNumber(sp.priceByMargin)}
                                </button>
                              )}
                              {(sp.defaultPrice > 0 || sp.hasDefaultPrice) && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(idx, 'postTaxPrice', sp.defaultPrice)}
                                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                                    Math.abs(item.postTaxPrice - sp.defaultPrice) < 0.01
                                      ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                                  }`}
                                >
                                  MĐ: {formatNumber(sp.defaultPrice)}
                                </button>
                              )}
                              {sp.priceMinusVariance > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(idx, 'postTaxPrice', sp.priceMinusVariance)}
                                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border transition-colors cursor-pointer ${
                                    Math.abs(item.postTaxPrice - sp.priceMinusVariance) < 0.01
                                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
                                  }`}
                                >
                                  (-) {formatNumber(sp.priceMinusVariance)}
                                </button>
                              )}
                              {sp.pricePlusVariance > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(idx, 'postTaxPrice', sp.pricePlusVariance)}
                                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border transition-colors cursor-pointer ${
                                    Math.abs(item.postTaxPrice - sp.pricePlusVariance) < 0.01
                                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200'
                                  }`}
                                >
                                  (+) {formatNumber(sp.pricePlusVariance)}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Row 2: Đơn giá trước thuế (Placed AFTER), Chiết khấu, Thuế VAT */}
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                ĐG trước thuế:
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={item.preTaxPrice}
                                onChange={(e) => handleUpdateItem(idx, 'preTaxPrice', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-right text-slate-800 border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Chiết khấu:
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.itemDiscount}
                                onChange={(e) => handleUpdateItem(idx, 'itemDiscount', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-right text-slate-700 border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Thuế GTGT:
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.vatRate}
                                  onChange={(e) => handleUpdateItem(idx, 'vatRate', parseFloat(e.target.value) || 0)}
                                  className="w-full pl-2 pr-5 py-1 text-center text-slate-700 border border-slate-300 rounded-lg text-xs"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">%</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card Summary footer */}
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/70 flex items-center justify-between text-xs">
                          <div className="text-[11px] text-slate-600 space-y-0.5">
                            <div>Trước thuế: <strong className="font-mono text-slate-800">{formatCurrency(item.subtotal)}</strong></div>
                            <div>Thuế: <strong className="font-mono text-slate-800">{formatCurrency(item.vatAmount)}</strong></div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 font-medium block">Tổng tiền:</span>
                            <span className="font-black text-sm text-blue-900 font-mono">
                              {formatCurrency(item.totalAmount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Section 3: Discounts, Payment Methods & Live Summary Calculation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Discounts & Payment Methods */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                Hình thức thanh toán & Giảm giá đơn
              </h4>

              {/* Discount inputs - Redesigned for mobile clarity */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Chiết khấu giảm giá tổng đơn hàng:</span>
                  </label>
                  {totals.finalOrderDiscount > 0 && (
                    <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full shrink-0">
                      -{formatCurrency(totals.finalOrderDiscount)}
                    </span>
                  )}
                </div>

                {/* 2 Tab chọn loại chiết khấu: Rõ ràng, to bản, không co chữ trên điện thoại */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setDiscountType('amount')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      discountType === 'amount'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5 shrink-0" />
                    <span>Số tiền (VNĐ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('percent');
                      if (orderDiscountInput > 100) {
                        setOrderDiscountInput(0);
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      discountType === 'percent'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5 shrink-0" />
                    <span>% Phần trăm</span>
                  </button>
                </div>

                {/* Ô nhập số tiền / % nằm ở dòng riêng rộng 100% với nhãn đơn vị rõ ràng */}
                <div className="space-y-1.5">
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      max={discountType === 'percent' ? 100 : undefined}
                      step="any"
                      value={orderDiscountInput === 0 ? '' : orderDiscountInput}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setOrderDiscountInput(isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      placeholder={
                        discountType === 'percent'
                          ? 'Nhập số % giảm (ví dụ: 5, 10...)'
                          : 'Nhập số tiền giảm giá (VNĐ)'
                      }
                      className="w-full pl-3 pr-14 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl text-sm font-bold text-right text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs"
                    />
                    <div className="absolute right-2.5 px-2 py-1 rounded-md text-xs font-black bg-slate-200/90 text-slate-700 pointer-events-none select-none border border-slate-300/70">
                      {discountType === 'percent' ? '%' : 'VNĐ'}
                    </div>
                  </div>

                  {/* Thanh chọn nhanh mức % hoặc xem số tiền quy đổi */}
                  {discountType === 'percent' ? (
                    <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px] text-slate-500 font-medium">Gợi ý nhanh:</span>
                        {[5, 10, 15, 20].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setOrderDiscountInput(pct)}
                            className={`text-[11px] px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer border ${
                              orderDiscountInput === pct
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      {orderDiscountInput > 0 && (
                        <button
                          type="button"
                          onClick={() => setOrderDiscountInput(0)}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer ml-auto"
                        >
                          Xóa giảm giá
                        </button>
                      )}
                    </div>
                  ) : (
                    orderDiscountInput > 0 && (
                      <div className="flex items-center justify-between text-[11px] pt-0.5">
                        <span className="text-slate-600">
                          Bằng chữ: <strong className="text-rose-600 font-mono">{formatCurrency(orderDiscountInput)}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setOrderDiscountInput(0)}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Xóa giảm giá
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Phương thức thanh toán:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tiền mặt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'transfer'
                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Chuyển khoản</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-purple-600 bg-purple-50 text-purple-800 ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>Thẻ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('debt_offset')}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'debt_offset'
                        ? 'border-amber-600 bg-amber-50 text-amber-800 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Cấn trừ công nợ</span>
                  </button>
                </div>
              </div>

              {/* Paid Amount */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Số tiền khách thanh toán đợt này:
                  </label>
                  <button
                    type="button"
                    onClick={() => setPaidAmount(totals.grandTotal)}
                    className="text-[11px] text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    Trả đủ toàn bộ
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-base font-bold text-emerald-700 text-right"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú đơn hàng:</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Yêu cầu giao hàng, thời gian nhận..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Right: Summary & Customer Debt Balance */}
            <div className="bg-blue-50/40 rounded-xl border border-blue-200 p-4 space-y-3 flex flex-col justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-blue-900 border-b border-blue-200/60 pb-2">
                Tổng kết thanh toán & Công nợ
              </h4>

              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Tổng tiền hàng (trước thuế):</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(totals.subtotalPreTax)}</span>
                </div>
                {(() => {
                  const subtotalMap = new Map<number, number>();
                  items.forEach((it) => {
                    const r = it.vatRate || 0;
                    subtotalMap.set(r, (subtotalMap.get(r) || 0) + (it.subtotal || 0));
                  });
                  if (subtotalMap.size <= 0) return null;
                  return (
                    <div className="pl-2.5 py-1 space-y-0.5 border-l-2 border-blue-400 text-[11px] text-slate-600 bg-white/70 rounded-r-md">
                      <div className="font-semibold text-blue-900 text-[10px] uppercase">Thành tiền theo từng thuế suất:</div>
                      {Array.from(subtotalMap.entries()).sort((a, b) => a[0] - b[0]).map(([rate, amt]) => (
                        <div key={rate} className="flex justify-between pr-1">
                          <span>• Thuế {rate}%:</span>
                          <span className="font-semibold text-blue-800">{formatCurrency(amt)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {totals.itemDiscountSum > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Chiết khấu từng mặt hàng:</span>
                    <span>-{formatCurrency(totals.itemDiscountSum)}</span>
                  </div>
                )}
                {totals.finalOrderDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Giảm giá tổng đơn hàng:</span>
                    <span>-{formatCurrency(totals.finalOrderDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Tổng tiền thuế GTGT:</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(totals.vatSum)}</span>
                </div>
                {(() => {
                  const taxMap = new Map<number, number>();
                  items.forEach((it) => {
                    const r = it.vatRate || 0;
                    taxMap.set(r, (taxMap.get(r) || 0) + (it.vatAmount || 0));
                  });
                  if (taxMap.size <= 0) return null;
                  return (
                    <div className="pl-2.5 py-1 space-y-0.5 border-l-2 border-amber-400 text-[11px] text-slate-600 bg-white/70 rounded-r-md">
                      <div className="font-semibold text-amber-900 text-[10px] uppercase">Thuế GTGT theo từng thuế suất:</div>
                      {Array.from(taxMap.entries()).sort((a, b) => a[0] - b[0]).map(([rate, amt]) => (
                        <div key={rate} className="flex justify-between pr-1">
                          <span>• Thuế {rate}%:</span>
                          <span className="font-semibold text-amber-800">{formatCurrency(amt)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div className="flex justify-between text-base font-black text-blue-900 border-t border-blue-200 pt-2">
                  <span>Tổng tiền thanh toán:</span>
                  <span className="text-lg text-blue-700">{formatCurrency(totals.grandTotal)}</span>
                </div>
              </div>

              {/* Customer Debt breakdown */}
              <div className="bg-white p-3 rounded-xl border border-blue-200/80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>1. Công nợ cũ của khách hàng:</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(customerHistory.priorDebt)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>2. Thanh toán đợt này:</span>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>3. Công nợ phát sinh đơn này:</span>
                  <span className={totals.currentOrderDebt > 0 ? 'font-bold text-rose-600' : 'text-slate-600'}>
                    {formatCurrency(totals.currentOrderDebt)}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                  <span className="text-rose-700">➔ TỔNG CÔNG NỢ CÒN LẠI:</span>
                  <span className={totals.remainingOverallDebt > 0 ? 'text-rose-700 font-black' : 'text-slate-700'}>
                    {formatCurrency(totals.remainingOverallDebt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 rounded-none sm:rounded-b-2xl z-20">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 transition-colors cursor-pointer shrink-0"
          >
            Đóng / Hủy
          </button>
          <div className="flex items-center gap-2">
            {isLockedCompleted ? (
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold text-amber-900 bg-amber-100 border border-amber-300 rounded-xl cursor-not-allowed opacity-85"
                title="Đơn hàng đã hoàn thành — Chỉ tài khoản Admin mới được phép chỉnh sửa"
              >
                <Lock className="w-4 h-4 shrink-0" />
                <span>Đã hoàn thành (Chỉ Admin sửa)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveOrder}
                className="flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span>{initialOrder ? 'Cập nhật đơn hàng' : 'Lưu đơn hàng'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Customer Creation / Edit Modal */}
      {isCustomerModalOpen && (
        <CustomerModal
          isOpen={isCustomerModalOpen}
          onClose={() => {
            setIsCustomerModalOpen(false);
            setEditingCustomerForModal(null);
          }}
          initialCustomer={editingCustomerForModal}
          existingCustomersCount={customers.length}
          existingCustomers={customers}
          onSave={(cust) => {
            onAddNewCustomer(cust);
            setSelectedCustomer(cust);
            setCustomerSearchTerm(`${cust.name} (${cust.code})`);
            setIsCustomerModalOpen(false);
            setEditingCustomerForModal(null);
          }}
        />
      )}

      {/* Modal Đổi Mặt Hàng */}
      {changingItemIndex !== null && items[changingItemIndex] && (
        <ChangeProductModal
          isOpen={changingItemIndex !== null}
          onClose={() => setChangingItemIndex(null)}
          currentItem={items[changingItemIndex]}
          itemIndex={changingItemIndex}
          products={products}
          inventoryStockMap={inventoryStockMap}
          orderDate={orderDate}
          purchases={purchases}
          allOrders={allOrders}
          settings={settings}
          initialOrderId={initialOrder?.id}
          onSelectProduct={(newProduct, options) => {
            if (changingItemIndex === null) return;
            handleSwapItemProduct(changingItemIndex, newProduct, options);
          }}
        />
      )}
    </div>
  );
};
