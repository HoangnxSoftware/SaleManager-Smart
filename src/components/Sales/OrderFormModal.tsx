import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Order, OrderItem, Product, PaymentMethod, DeliveryStatus, AppUser, AppSettings, DebtPayment, PurchaseBill } from '../../types';
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
} from 'lucide-react';
import { DEFAULT_ORDER_CODE_RULES, generateNextOrderCode, matchOrderToRule } from '../../services/orderCodeService';
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
  debtPayments: DebtPayment[];
  currentUser: AppUser;
  settings: AppSettings;
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
  debtPayments,
  currentUser,
  settings,
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

  // Available order code rules
  const rulesList = useMemo(() => {
    return settings.orderCodeRules && settings.orderCodeRules.length > 0
      ? settings.orderCodeRules
      : DEFAULT_ORDER_CODE_RULES;
  }, [settings.orderCodeRules]);

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

  // Items
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

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
  const [createdByName, setCreatedByName] = useState<string>('');
  const [notes, setNotes] = useState('');

  const salePriceDecimals = settings.salePriceDecimals ?? 2;

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) return;

    if (initialOrder) {
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
      setCreatedByName(initialOrder.createdByName || currentUser.fullName || '');
      setNotes(initialOrder.notes || '');

      if (initialOrder.orderDiscountPercent > 0) {
        setDiscountType('percent');
        setOrderDiscountInput(initialOrder.orderDiscountPercent);
      } else {
        setDiscountType('amount');
        setOrderDiscountInput(initialOrder.orderDiscount);
      }
    } else {
      const defaultRule =
        rulesList.find((r) => r.id === settings.defaultOrderCodeRuleId) ||
        rulesList.find((r) => r.isDefault) ||
        rulesList[0];
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

      // REQUIREMENT: Bỏ trống thông tin khách hàng mặc định khi tạo mới để tìm kiếm nhanh
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
      setItems([]);
      setDiscountType('amount');
      setOrderDiscountInput(0);
      setPaymentMethod('cash');
      setPaidAmount(0);
      setDeliveryStatus('pending'); // Default "Chờ giao"
      setCreatedByName(currentUser.fullName || '');
      setNotes('');
    }
  }, [isOpen, initialOrder, customers, allOrders, currentUser, rulesList, settings.defaultOrderCodeRuleId]);

  // Filter customers by Name, Short name, Tax code, Phone, Code
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm.trim()) return customers.slice(0, 8);
    const q = customerSearchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
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

  if (!isOpen) return null;

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
    if (!postTax || postTax <= 0) {
      if (sp.priceByMargin > 0) {
        postTax = sp.priceByMargin;
      } else if (sp.defaultPrice > 0) {
        postTax = sp.defaultPrice;
      } else {
        postTax = 100000;
      }
    }

    const vat = prod.vatRate || 10;
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

    if (postTax === undefined || postTax <= 0) {
      if (options.keepPrice && oldItem.postTaxPrice > 0) {
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
        } else if (sp.defaultPrice > 0) {
          postTax = sp.defaultPrice;
        } else {
          postTax = oldItem.postTaxPrice > 0 ? oldItem.postTaxPrice : 100000;
        }
      }
    }

    const vat = newProd.vatRate !== undefined ? newProd.vatRate : 10;
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
      const rate = 1 + (item.vatRate || 10) / 100;
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
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('Vui lòng chọn thông tin khách hàng.');
      return;
    }
    if (items.length === 0) {
      alert('Vui lòng thêm ít nhất một mặt hàng vào đơn hàng.');
      return;
    }

    const newOrder: Order = {
      id: initialOrder ? initialOrder.id : `ord-${Date.now()}`,
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
      debtAmount: totals.currentOrderDebt,
      deliveryStatus,
      notes,
      orderCodeRuleId: selectedRuleId,
      createdById: initialOrder ? initialOrder.createdById : currentUser.id,
      createdByName: createdByName.trim() || (initialOrder ? initialOrder.createdByName : currentUser.fullName) || 'Admin',
      createdAt: initialOrder ? initialOrder.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-6xl xl:max-w-7xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/20 shadow-inner">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">
                {initialOrder ? `Chỉnh sửa Đơn hàng: ${initialOrder.orderCode}` : 'Tạo mới Đơn hàng'}
              </h2>
              <p className="text-blue-100 text-xs">
                Mã đơn: <span className="font-mono font-semibold">{orderCode}</span> • Ngày: {formatDate(orderDate)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Top Bar: Order Code & Rule & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Quy tắc tạo mã:
              </label>
              <select
                value={selectedRuleId}
                onChange={(e) => handleRuleChange(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer"
                title="Thay đổi quy tắc tạo mã đơn, mã đơn sẽ tự cập nhật số thứ tự tăng dần"
              >
                {rulesList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.isDefault ? '★' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
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
            <div>
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
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Người tạo đơn / Bán hàng:
              </label>
              <input
                type="text"
                value={createdByName}
                onChange={(e) => setCreatedByName(e.target.value)}
                placeholder="Tên nhân viên..."
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Trạng thái giao hàng (Mặc định: Chờ giao):
              </label>
              <select
                value={deliveryStatus}
                onChange={(e) => setDeliveryStatus(e.target.value as DeliveryStatus)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 cursor-pointer"
              >
                <option value="pending">⏳ Chờ giao (Mặc định)</option>
                <option value="delivering">🚚 Đang giao</option>
                <option value="completed">✅ Hoàn thành</option>
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
                Tìm kiếm khách hàng (theo Tên, Tên gợi nhớ, MST, SĐT, Mã KH):
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Bỏ trống để tìm kiếm nhanh theo Tên, Tên nhớ, MST, SĐT, Mã KH..."
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
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
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
                        className="w-full text-left p-3 hover:bg-blue-50/70 border-b border-slate-100 last:border-none flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-xs sm:text-sm text-slate-900">
                            {cust.name}{' '}
                            {cust.shortName && cust.shortName !== cust.name && (
                              <span className="text-slate-500 font-normal">({cust.shortName})</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                            <span className="font-mono text-blue-600">{cust.code}</span>
                            {cust.phone && <span>SĐT: {cust.phone}</span>}
                            {cust.taxCode && <span>MST: {cust.taxCode}</span>}
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
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

          {/* Section 2: Product selection & Items table */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <span>Danh sách mặt hàng bán ({items.length} mặt hàng)</span>
              </h3>

              {/* Quick product search input */}
              <div ref={productSearchRef} className="relative w-full sm:w-96">
                <input
                  type="text"
                  placeholder="Gõ mã hoặc tên HH để thêm..."
                  value={productSearchTerm}
                  onFocus={() => setIsProductDropdownOpen(true)}
                  onChange={(e) => {
                    setProductSearchTerm(e.target.value);
                    setIsProductDropdownOpen(true);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />

                {isProductDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 sm:left-auto sm:right-0 sm:w-[480px] mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100">
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
                                sp.defaultPrice > 0 ||
                                sp.priceMinusVariance > 0 ||
                                sp.pricePlusVariance > 0;
                              if (!hasSuggestions) return null;
                              return (
                                <div className="text-[10px] text-slate-600 flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                                  <span className="text-slate-400 font-medium">Giá gợi ý:</span>
                                  {sp.priceByMargin > 0 && (
                                    <span className="bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded border border-indigo-200">
                                      TSLN: {formatNumber(sp.priceByMargin)}₫
                                    </span>
                                  )}
                                  {sp.defaultPrice > 0 && (
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
            </div>

            {/* Items Table */}
            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                Chưa có mặt hàng nào trong đơn. Tìm kiếm sản phẩm ở trên hoặc bấm vào danh mục để thêm.
              </div>
            ) : (
              <>
                {/* Desktop View: Full detailed table with align-top */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                      <tr>
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
                      {items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
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
                                sp.defaultPrice > 0 ||
                                sp.priceMinusVariance > 0 ||
                                sp.pricePlusVariance > 0;
                              if (!hasSuggestions) return null;

                              return (
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  {sp.priceByMargin > 0 && (
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
                                  {sp.defaultPrice > 0 && (
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
                      ))}
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

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2.5"
                      >
                        {/* Header card: Index, Name, Code, Stock, Action buttons */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-start gap-2 min-w-0">
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
                          {sp && (sp.priceByMargin > 0 || sp.defaultPrice > 0 || sp.priceMinusVariance > 0 || sp.pricePlusVariance > 0) && (
                            <div className="flex flex-wrap items-center gap-1 text-[11px] bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                              <span className="text-[10px] text-slate-400 font-semibold pl-1">Gợi ý:</span>
                              {sp.priceByMargin > 0 && (
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
                              {sp.defaultPrice > 0 && (
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

              {/* Discount inputs */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Chiết khấu giảm giá tổng đơn hàng:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setDiscountType('amount')}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        discountType === 'amount' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Số tiền (VNĐ)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        discountType === 'percent' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      % Phần trăm
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={orderDiscountInput}
                    onChange={(e) => setOrderDiscountInput(parseFloat(e.target.value) || 0)}
                    placeholder={discountType === 'percent' ? '% giảm giá' : 'Số tiền giảm'}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-right font-medium"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Phương thức thanh toán:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>Tiền mặt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'transfer'
                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building className="w-4 h-4 text-blue-600" />
                    <span>Chuyển khoản</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-purple-600 bg-purple-50 text-purple-800 ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-purple-600" />
                    <span>Thẻ</span>
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
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Đóng / Hủy
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveOrder}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{initialOrder ? 'Cập nhật đơn hàng' : 'Lưu đơn hàng'}</span>
            </button>
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
