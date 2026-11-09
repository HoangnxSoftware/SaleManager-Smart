import React, { useState, useMemo } from 'react';
import { Customer, Order, Product, PurchaseBill, AppUser, AppSettings, DebtPayment, DeliveryStatus } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  exportOrdersToExcel,
  exportOrderDetailsToExcel,
  downloadOrderTemplate,
  parseExcelFile,
  exportCustomersToExcel,
  downloadCustomerTemplate,
} from '../../services/excelService';
import { OrderFormModal } from './OrderFormModal';
import { OrderDetailModal } from './OrderDetailModal';
import { RecalculatePricesModal } from './RecalculatePricesModal';
import { CustomerModal } from './CustomerModal';
import { OrderImportCheckModal } from './OrderImportCheckModal';
import {
  matchProductCode,
  matchCustomerCode,
  analyzeOrderImportCodes,
  CodeSyncDetail,
} from '../../services/codeSyncService';
import { generateNextRootCode, deduplicateOrders } from '../../services/orderCodeService';
import { OrderPrintModal } from '../Print/OrderPrintModal';
import { OrderDetailsTab } from './OrderDetailsTab';
import { ExcelDuplicateConflictModal, ConflictItem } from '../Common/ExcelDuplicateConflictModal';
import { ManualSyncBar } from '../Common/ManualSyncBar';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Plus,
  Search,
  Printer,
  FileSpreadsheet,
  Download,
  Upload,
  Copy,
  CheckCircle,
  Eye,
  Edit,
  Trash2,
  Users,
  ShoppingCart,
  Calculator,
  Filter,
  CheckSquare,
  Square,
  AlertTriangle,
  ChevronDown,
  Layers,
  UserCheck,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Ban,
  RotateCcw,
} from 'lucide-react';

interface SalesManagerProps {
  orders: Order[];
  customers: Customer[];
  products: Product[];
  purchases: PurchaseBill[];
  debtPayments: DebtPayment[];
  currentUser: AppUser;
  settings: AppSettings;
  users?: AppUser[];
  onSaveOrder: (order: Order) => void;
  onBatchUpdateOrders: (orders: Order[]) => void;
  onDeleteOrder: (orderId: string) => void;
  onBatchDeleteOrders?: (orderIds: string[]) => void;
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onBatchUpdateCustomers?: (customers: Customer[]) => void;
  onAddNewProduct?: (product: Product) => void;
  onBatchUpdateProducts?: (products: Product[]) => void;
  // Sync props
  isSyncing?: boolean;
  isAutoSyncing?: boolean;
  autoSyncEnabled?: boolean;
  lastSyncedAt?: string;
  spreadsheetId?: string;
  isDemo?: boolean;
  currentDeviceName?: string;
  onManualReset?: () => void;
  onManualPush?: () => void;
  onManualPull?: () => void;
  onManualSync2Way?: () => void;
  onOpenSyncModal?: () => void;
}

export const SalesManager: React.FC<SalesManagerProps> = ({
  orders,
  customers,
  products,
  purchases,
  debtPayments,
  currentUser,
  settings,
  users = [],
  onSaveOrder,
  onBatchUpdateOrders,
  onDeleteOrder,
  onBatchDeleteOrders,
  onSaveCustomer,
  onDeleteCustomer,
  onBatchUpdateCustomers,
  onAddNewProduct,
  onBatchUpdateProducts,
  isSyncing = false,
  isAutoSyncing = false,
  autoSyncEnabled = true,
  lastSyncedAt,
  spreadsheetId,
  isDemo = false,
  currentDeviceName = 'Thiết bị này',
  onManualReset = () => {},
  onManualPush = () => {},
  onManualPull = () => {},
  onManualSync2Way = () => {},
  onOpenSyncModal = () => {},
}) => {
  const confirm = useConfirm();
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'order-details' | 'customers'>('orders');

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [salespersonFilter, setSalespersonFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeDatePreset, setActiveDatePreset] = useState<string>('all');

  const handleApplyDatePreset = (preset: string) => {
    setActiveDatePreset(preset);
    const now = new Date();
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === 'today') {
      const today = formatYMD(now);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatYMD(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === 'last_7_days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(now));
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (preset === 'this_year') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Helper tra cứu chính xác người tạo đơn từ danh mục tài khoản / nhân viên
  const getOrderCreator = (order: Order) => {
    const matched = users.find(
      (u) =>
        u.id === order.createdById ||
        (order.createdByName &&
          (u.fullName.toLowerCase() === order.createdByName.toLowerCase() ||
            u.username.toLowerCase() === order.createdByName.toLowerCase()))
    );

    const displayName =
      order.createdByName?.trim() ||
      matched?.fullName ||
      matched?.username ||
      (order.createdById ? `ID: ${order.createdById}` : 'Chưa xác định');

    const role = matched?.role;
    return {
      name: displayName,
      role,
      user: matched,
    };
  };

  // Extract unique salespeople (bao gồm cả users hệ thống và tên trong đơn hàng)
  const salespeople = useMemo(() => {
    const set = new Set<string>();
    // Thêm nhân viên từ hệ thống
    users.forEach((u) => {
      if (u.fullName) set.add(u.fullName.trim());
      else if (u.username) set.add(u.username.trim());
    });
    // Thêm người tạo từ các đơn hàng
    orders.forEach((o) => {
      const info = getOrderCreator(o);
      if (info.name && info.name !== 'Chưa xác định') {
        set.add(info.name);
      }
    });
    return Array.from(set).sort();
  }, [orders, users]);

  // Selected orders for batch actions
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Modals state
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  const [isRecalcModalOpen, setIsRecalcModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [ordersToPrint, setOrdersToPrint] = useState<Order[]>([]);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilterDuplicateTax, setCustomerFilterDuplicateTax] = useState(false);
  const [customerSortField, setCustomerSortField] = useState<'default' | 'code' | 'taxCode' | 'type'>('default');
  const [customerSortDirection, setCustomerSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filtered orders (strictly deduplicated so 1 rootCode/orderCode appears only once)
  const uniqueOrders = useMemo(() => deduplicateOrders(orders), [orders]);

  const filteredOrders = useMemo(() => {
    return uniqueOrders.filter((o) => {
      const creatorInfo = getOrderCreator(o);

      const matchSearch =
        !searchTerm.trim() ||
        o.orderCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.createdByName && o.createdByName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        creatorInfo.name.toLowerCase().includes(searchTerm.toLowerCase());

      const isCustomerUncataloged = !customers.some(
        (c) => c.code.trim().toUpperCase() === o.customerCode?.trim().toUpperCase() || c.id === o.customerId
      );
      const hasUncatalogedProds = o.items.some(
        (it) => !products.some((p) => p.code.trim().toUpperCase() === it.productCode?.trim().toUpperCase())
      );
      const isRedFlagged = isCustomerUncataloged || hasUncatalogedProds;

      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'red_flagged'
          ? isRedFlagged
          : o.deliveryStatus === statusFilter;

      const matchDate =
        (!startDate || o.orderDate >= startDate) && (!endDate || o.orderDate <= endDate);
      const matchSalesperson =
        salespersonFilter === 'all' ||
        creatorInfo.name === salespersonFilter ||
        o.createdByName === salespersonFilter;

      return matchSearch && matchStatus && matchDate && matchSalesperson;
    }).sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.createdAt.localeCompare(a.createdAt));
  }, [uniqueOrders, searchTerm, statusFilter, startDate, endDate, salespersonFilter, customers, products, users]);

  // Duplicate tax codes check for customers (REQUIREMENT: nếu trong danh mục có trùng mã số thuế thì bôi đỏ)
  const duplicateTaxCodes = useMemo(() => {
    const counts = new Map<string, number>();
    customers.forEach((c) => {
      const t = c.taxCode?.trim();
      if (t) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    });
    const dupes = new Set<string>();
    counts.forEach((count, tax) => {
      if (count > 1) dupes.add(tax);
    });
    return dupes;
  }, [customers]);

  const duplicateCustomerCount = useMemo(() => {
    return customers.filter((c) => c.taxCode && duplicateTaxCodes.has(c.taxCode.trim())).length;
  }, [customers, duplicateTaxCodes]);

  // Filtered & sorted customers
  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.shortName.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.taxCode.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
      );
    }

    if (customerFilterDuplicateTax) {
      list = list.filter((c) => c.taxCode && duplicateTaxCodes.has(c.taxCode.trim()));
    }

    if (customerSortField !== 'default') {
      list = [...list].sort((a, b) => {
        let valA = '';
        let valB = '';
        if (customerSortField === 'code') {
          valA = a.code || '';
          valB = b.code || '';
        } else if (customerSortField === 'taxCode') {
          valA = a.taxCode || '';
          valB = b.taxCode || '';
        } else if (customerSortField === 'type') {
          valA = a.type === 'organization' ? 'Tổ chức' : 'Cá nhân';
          valB = b.type === 'organization' ? 'Tổ chức' : 'Cá nhân';
        }

        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
        if (!valA && !valB) return 0;

        const cmp = valA.localeCompare(valB, 'vi', { numeric: true, sensitivity: 'base' });
        return customerSortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [customers, customerSearch, customerFilterDuplicateTax, duplicateTaxCodes, customerSortField, customerSortDirection]);

  const handleCustomerSort = (field: 'code' | 'taxCode' | 'type') => {
    if (customerSortField === field) {
      setCustomerSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setCustomerSortField(field);
      setCustomerSortDirection('asc');
    }
  };

  // Customer Excel Import State
  const [customerConflictModalOpen, setCustomerConflictModalOpen] = useState(false);
  const [pendingCustomerConflicts, setPendingCustomerConflicts] = useState<ConflictItem[]>([]);
  const [pendingNewCustomers, setPendingNewCustomers] = useState<Customer[]>([]);
  const [pendingOverwrittenCustomers, setPendingOverwrittenCustomers] = useState<Customer[]>([]);
  const [totalCustomerImportedCount, setTotalCustomerImportedCount] = useState(0);

  const handleCustomerExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // REQUIREMENT: Khi up dữ liệu từ excel ở tất cả dữ liệu, xuất hiện thông báo xác nhận xem có thực hiện hay không
    const ok = await confirm({
      title: 'Xác nhận nhập danh sách khách hàng từ Excel',
      message: `Bạn có chắc chắn muốn tải lên và nhập danh mục khách hàng từ file "${file.name}" vào hệ thống không?`,
      confirmText: 'Xác nhận nhập',
      type: 'info',
    });
    if (!ok) {
      e.target.value = '';
      return;
    }

    try {
      const rows = await parseExcelFile(file);
      if (!rows || rows.length === 0) {
        alert('File Excel rỗng.');
        return;
      }

      const importedCustomers: Customer[] = rows.map((r: any, idx: number) => {
        const cCode = String(r['Mã KH'] || `KH-IMP-${Date.now()}-${idx}`).trim().toUpperCase();
        const rawName = String(r['Tên khách hàng'] || r['Tên KH'] || 'KHÁCH HÀNG MỚI').trim();
        // REQUIREMENT: Tên trong danh sách khách hàng mặc định viết hoa
        const cName = rawName.toUpperCase();
        const rawShort = String(r['Tên gợi nhớ'] || cName).trim();
        const cShort = rawShort.toUpperCase();
        const cTax = String(r['Mã số thuế'] || r['MST'] || '').trim();
        const cPhone = String(r['Số điện thoại'] || r['SĐT'] || '').trim();
        const cAddr = String(r['Địa chỉ'] || '').trim();
        const rawType = String(r['Loại KH'] || r['Loại KH (Cá nhân/Tổ chức)'] || '').toLowerCase();
        const cType = rawType.includes('tổ chức') ? 'organization' : 'personal';
        const cIdCard = String(r['Số CCCD'] || (cType === 'personal' ? cTax : '')).trim();
        const cNotes = String(r['Ghi chú'] || '').trim();

        return {
          id: `cust-imp-${Date.now()}-${idx}`,
          code: cCode,
          name: cName,
          shortName: cShort,
          taxCode: cTax,
          phone: cPhone,
          address: cAddr,
          type: cType,
          idCard: cIdCard,
          notes: cNotes,
          createdAt: new Date().toISOString().slice(0, 10),
        };
      });

      // Check duplicate codes
      const conflicts: ConflictItem[] = [];
      const newItems: Customer[] = [];
      const existingMap = new Map<string, Customer>();
      customers.forEach((c) => existingMap.set(c.code.toUpperCase(), c));

      importedCustomers.forEach((item) => {
        const existing = existingMap.get(item.code.toUpperCase());
        if (existing) {
          conflicts.push({
            code: item.code,
            name: existing.name,
            oldInfo: `Tên: ${existing.name}\nMST: ${existing.taxCode || '—'} | SĐT: ${existing.phone || '—'}\nĐ/C: ${existing.address || '—'}`,
            newInfo: `Tên: ${item.name}\nMST: ${item.taxCode || '—'} | SĐT: ${item.phone || '—'}\nĐ/C: ${item.address || '—'}`,
          });
        } else {
          newItems.push(item);
        }
      });

      if (conflicts.length > 0) {
        setTotalCustomerImportedCount(importedCustomers.length);
        setPendingCustomerConflicts(conflicts);
        setPendingNewCustomers(newItems);
        // Overwrite list: existing customers not in excel + new excel versions
        const merged = customers.map((c) => {
          const match = importedCustomers.find((imp) => imp.code.toUpperCase() === c.code.toUpperCase());
          return match ? { ...match, id: c.id } : c;
        });
        const brandNew = newItems.filter(
          (ni) => !merged.some((m) => m.code.toUpperCase() === ni.code.toUpperCase())
        );
        setPendingOverwrittenCustomers([...merged, ...brandNew]);
        setCustomerConflictModalOpen(true);
      } else {
        if (onBatchUpdateCustomers) {
          onBatchUpdateCustomers([...customers, ...importedCustomers]);
        } else {
          importedCustomers.forEach(onSaveCustomer);
        }
        alert(`Đã nhập thành công ${importedCustomers.length} khách hàng từ Excel!`);
      }

      e.target.value = '';
    } catch (err: any) {
      alert(`Lỗi đọc file Excel: ${err.message}`);
    }
  };

  const handleSkipCustomerDuplicates = () => {
    if (onBatchUpdateCustomers) {
      onBatchUpdateCustomers([...customers, ...pendingNewCustomers]);
    } else {
      pendingNewCustomers.forEach(onSaveCustomer);
    }
    setCustomerConflictModalOpen(false);
    alert(`Đã bỏ qua các mã trùng. Đã thêm thành công ${pendingNewCustomers.length} khách hàng mới từ Excel!`);
  };

  const handleOverwriteCustomerDuplicates = () => {
    if (onBatchUpdateCustomers) {
      onBatchUpdateCustomers(pendingOverwrittenCustomers);
    } else {
      pendingOverwrittenCustomers.forEach(onSaveCustomer);
    }
    setCustomerConflictModalOpen(false);
    alert(`Đã cập nhật/thêm thành công danh mục khách hàng từ Excel!`);
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map((o) => o.id));
    }
  };

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Single Order Copy
  const handleCopyOrder = (src: Order) => {
    const today = new Date().toISOString().slice(0, 10);
    const datePart = today.replace(/-/g, '');
    const newCode = `DH-${datePart}-${Math.floor(100 + Math.random() * 900)}`;

    const copied: Order = {
      ...src,
      id: `ord-${Date.now()}`,
      rootCode: generateNextRootCode(orders),
      orderCode: newCode,
      orderDate: today,
      deliveryStatus: 'pending', // Mặc định: Chờ giao
      paidAmount: 0,
      debtAmount: src.totalAmount,
      createdById: currentUser.id,
      createdByName: currentUser.fullName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveOrder(copied);
    alert(`Đã sao chép thành công đơn hàng mới với mã: ${newCode}`);
  };

  // Batch Complete Orders
  const handleBatchComplete = () => {
    if (selectedOrderIds.length === 0) {
      alert('Vui lòng tích chọn các đơn hàng cần hoàn thành.');
      return;
    }
    const updated = orders
      .filter((o) => selectedOrderIds.includes(o.id))
      .map((o) => ({
        ...o,
        deliveryStatus: 'completed' as DeliveryStatus,
        updatedAt: new Date().toISOString(),
      }));

    onBatchUpdateOrders(updated);
    setSelectedOrderIds([]);
    alert(`Đã hoàn thành ${updated.length} đơn hàng.`);
  };

  // Batch Copy Orders
  const handleBatchCopy = () => {
    if (selectedOrderIds.length === 0) {
      alert('Vui lòng tích chọn các đơn hàng cần sao chép.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const datePart = today.replace(/-/g, '');

    const newOrders: Order[] = [];
    selectedOrderIds.forEach((id, idx) => {
      const src = orders.find((o) => o.id === id);
      if (src) {
        newOrders.push({
          ...src,
          id: `ord-${Date.now()}-${idx}`,
          rootCode: generateNextRootCode([...orders, ...newOrders]),
          orderCode: `DH-${datePart}-${Math.floor(100 + Math.random() * 900)}`,
          orderDate: today,
          deliveryStatus: 'pending',
          paidAmount: 0,
          debtAmount: src.totalAmount,
          createdById: currentUser.id,
          createdByName: currentUser.fullName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    onBatchUpdateOrders(newOrders);
    setSelectedOrderIds([]);
    alert(`Đã sao chép thành công ${newOrders.length} đơn hàng hàng loạt.`);
  };

  // Batch Delete Orders (Requirement 6)
  const handleBatchDeleteOrders = async () => {
    if (selectedOrderIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đơn hàng để xóa.');
      return;
    }
    const ok = await confirm({
      title: 'Xác nhận xóa đơn hàng hàng loạt',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedOrderIds.length} đơn hàng đã chọn không? Thao tác này không thể hoàn tác!`,
      confirmText: 'Xác nhận xóa',
      type: 'danger',
    });
    if (ok) {
      if (onBatchDeleteOrders) {
        onBatchDeleteOrders(selectedOrderIds);
      } else {
        selectedOrderIds.forEach((id) => onDeleteOrder(id));
      }
      setSelectedOrderIds([]);
    }
  };

  // Toggle Cancel Order (Đánh dấu đơn hàng bị hủy / Khôi phục)
  const handleToggleCancelOrder = async (order: Order) => {
    const isCancelled = order.deliveryStatus === 'cancelled';
    if (!isCancelled) {
      const ok = await confirm({
        title: 'Xác nhận hủy đơn hàng',
        message: `Bạn có chắc chắn muốn ĐÁNH DẤU HỦY đơn hàng ${order.orderCode} (Khách: ${order.customerName})? Đơn hàng bị hủy sẽ không trừ tồn kho hàng hóa và không tính vào công nợ khách hàng.`,
        confirmText: 'Đánh dấu hủy',
        type: 'danger',
      });
      if (ok) {
        const updatedOrder: Order = {
          ...order,
          deliveryStatus: 'cancelled',
          debtAmount: 0,
          updatedById: currentUser.id,
          updatedByName: currentUser.fullName,
          updatedAt: new Date().toISOString(),
        };
        onSaveOrder(updatedOrder);
        if (viewingOrder?.id === order.id) {
          setViewingOrder(updatedOrder);
        }
      }
    } else {
      const ok = await confirm({
        title: 'Khôi phục đơn hàng',
        message: `Bạn có muốn KHÔI PHỤC đơn hàng ${order.orderCode}? Đơn hàng sẽ trở lại trạng thái Chờ giao và kích hoạt lại tính công nợ.`,
        confirmText: 'Khôi phục đơn',
        type: 'info',
      });
      if (ok) {
        const updatedOrder: Order = {
          ...order,
          deliveryStatus: 'pending',
          debtAmount: Math.max(0, order.totalAmount - order.paidAmount),
          updatedById: currentUser.id,
          updatedByName: currentUser.fullName,
          updatedAt: new Date().toISOString(),
        };
        onSaveOrder(updatedOrder);
        if (viewingOrder?.id === order.id) {
          setViewingOrder(updatedOrder);
        }
      }
    }
  };

  // Batch Cancel Orders (Đánh dấu hủy hàng loạt)
  const handleBatchCancel = async () => {
    if (selectedOrderIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đơn hàng để đánh dấu hủy.');
      return;
    }
    const ok = await confirm({
      title: 'Xác nhận hủy đơn hàng hàng loạt',
      message: `Bạn có chắc chắn muốn ĐÁNH DẤU HỦY ${selectedOrderIds.length} đơn hàng đã chọn? Các đơn bị hủy sẽ không tính vào công nợ và không xuất kho.`,
      confirmText: 'Đánh dấu hủy hàng loạt',
      type: 'danger',
    });
    if (ok) {
      const updated = orders
        .filter((o) => selectedOrderIds.includes(o.id))
        .map((o) => ({
          ...o,
          deliveryStatus: 'cancelled' as DeliveryStatus,
          debtAmount: 0,
          updatedById: currentUser.id,
          updatedByName: currentUser.fullName,
          updatedAt: new Date().toISOString(),
        }));
      onBatchUpdateOrders(updated);
      setSelectedOrderIds([]);
      alert(`Đã đánh dấu hủy ${updated.length} đơn hàng.`);
    }
  };

  // Batch Restore Orders (Khôi phục đơn hàng loạt)
  const handleBatchRestore = () => {
    if (selectedOrderIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đơn hàng để khôi phục.');
      return;
    }
    const updated = orders
      .filter((o) => selectedOrderIds.includes(o.id))
      .map((o) => ({
        ...o,
        deliveryStatus: 'pending' as DeliveryStatus,
        debtAmount: Math.max(0, o.totalAmount - o.paidAmount),
        updatedById: currentUser.id,
        updatedByName: currentUser.fullName,
        updatedAt: new Date().toISOString(),
      }));
    onBatchUpdateOrders(updated);
    setSelectedOrderIds([]);
    alert(`Đã khôi phục ${updated.length} đơn hàng.`);
  };

  // Batch Print Orders
  const handleOpenBatchPrint = () => {
    if (selectedOrderIds.length === 0) {
      // If none selected, offer printing all filtered orders or by date
      if (filteredOrders.length > 0) {
        setOrdersToPrint(filteredOrders);
        setIsPrintModalOpen(true);
      } else {
        alert('Không có đơn hàng nào để in.');
      }
    } else {
      const selected = orders.filter((o) => selectedOrderIds.includes(o.id));
      setOrdersToPrint(selected);
      setIsPrintModalOpen(true);
    }
  };

  // Order Excel Import Check Modal State
  const [isOrderImportCheckModalOpen, setIsOrderImportCheckModalOpen] = useState(false);
  const [pendingImportOrders, setPendingImportOrders] = useState<Order[]>([]);
  const [pendingProductSync, setPendingProductSync] = useState<CodeSyncDetail[]>([]);
  const [pendingCustomerSync, setPendingCustomerSync] = useState<CodeSyncDetail[]>([]);

  const handleConfirmImportOrders = (options: {
    finalOrders: Order[];
    newCustomersToAdd: Customer[];
    newProductsToAdd: Product[];
  }) => {
    const { finalOrders, newCustomersToAdd, newProductsToAdd } = options;

    if (newCustomersToAdd.length > 0 && onBatchUpdateCustomers) {
      onBatchUpdateCustomers(newCustomersToAdd);
    }
    if (newProductsToAdd.length > 0 && onBatchUpdateProducts) {
      onBatchUpdateProducts(newProductsToAdd);
    }

    onBatchUpdateOrders(finalOrders);
    setIsOrderImportCheckModalOpen(false);
    setPendingImportOrders([]);
    setPendingProductSync([]);
    setPendingCustomerSync([]);

    const adjustedProds = pendingProductSync.filter((p) => p.isAdjusted).length;
    const adjustedCusts = pendingCustomerSync.filter((c) => c.isAdjusted).length;
    let msg = `Đã nhập thành công ${finalOrders.length} đơn hàng từ Excel vào phần mềm!`;
    if (newCustomersToAdd.length > 0) {
      msg += `\n+ Đã thêm ${newCustomersToAdd.length} khách hàng mới vào Danh mục khách hàng`;
    }
    if (newProductsToAdd.length > 0) {
      msg += `\n+ Đã thêm ${newProductsToAdd.length} mã hàng mới vào Danh mục sản phẩm`;
    }
    if (adjustedProds > 0 || adjustedCusts > 0) {
      msg += `\n(Đã tự động chuẩn hóa & đồng bộ ${adjustedProds} mã hàng hóa và ${adjustedCusts} mã khách hàng)`;
    }
    alert(msg);
  };

  // Import orders from Excel
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // REQUIREMENT: Khi up dữ liệu từ excel ở tất cả dữ liệu, xuất hiện thông báo xác nhận xem có thực hiện hay không
    const ok = await confirm({
      title: 'Xác nhận nhập danh sách đơn hàng từ Excel',
      message: `Bạn có chắc chắn muốn tải lên và kiểm tra dữ liệu đơn hàng từ file "${file.name}" vào hệ thống không?`,
      confirmText: 'Xác nhận nhập',
      type: 'info',
    });
    if (!ok) {
      e.target.value = '';
      return;
    }

    try {
      const rows = await parseExcelFile(file);
      if (!rows || rows.length === 0) {
        alert('File Excel rỗng hoặc không đúng định dạng mẫu.');
        return;
      }

      // REQUIREMENT: Đồng bộ mã hàng hóa và mã khách hàng (loại bỏ dấu cách thừa, viết hoa để khớp với phần mềm)
      // Thu thập thông tin cảnh báo đồng bộ mã trước khi đẩy dữ liệu vào phần mềm
      const syncSummary = analyzeOrderImportCodes(rows, products, customers);
      setPendingProductSync(syncSummary.productSyncList);
      setPendingCustomerSync(syncSummary.customerSyncList);

      // Group rows by Order code
      const orderGroups = new Map<string, any[]>();
      rows.forEach((r: any) => {
        const code = String(r['Mã đơn'] || r['Mã đơn hàng'] || `DH-IMP-${Date.now()}`).trim();
        const list = orderGroups.get(code) || [];
        list.push(r);
        orderGroups.set(code, list);
      });

      const newOrdersList: Order[] = [];

      for (const [code, itemsList] of orderGroups.entries()) {
        const first = itemsList[0];
        const rawCustCode = String(first['Mã KH'] || first['Mã khách hàng'] || 'KH001');
        
        // Đồng bộ Mã khách hàng: loại bỏ dấu cách thừa, viết hoa, tìm khớp với danh mục
        const custMatch = matchCustomerCode(rawCustCode, customers);
        const cust = custMatch.matchedCustomer;
        const syncedCustCode = custMatch.syncedCode;
        const custName = cust
          ? cust.name
          : String(first['Tên khách hàng'] || `Khách hàng ${syncedCustCode}`).trim().toUpperCase();

        let totalPreTax = 0;
        let totalVat = 0;
        let totalDiscount = 0;

        const orderItems = itemsList.map((row: any, idx: number) => {
          const rawPCode = String(row['Mã HH'] || row['Mã hàng hóa'] || 'PROD');
          
          // Đồng bộ Mã hàng hóa: loại bỏ dấu cách thừa, viết hoa, tìm khớp với danh mục
          const prodMatch = matchProductCode(rawPCode, products);
          const prod = prodMatch.matchedProduct;
          const syncedPCode = prodMatch.syncedCode;

          // REQUIREMENT: Cho phép nhập phiếu có số lượng và đơn giá trước thuế = 0.
          // Tuyệt đối không được chuyển số lượng 0 thành 1, không được chuyển đơn giá trước thuế 0 thành 100.000!
          const rawQty =
            row['Số lượng'] !== undefined && row['Số lượng'] !== '' && row['Số lượng'] !== null
              ? Number(row['Số lượng'])
              : (row['SL'] !== undefined && row['SL'] !== '' && row['SL'] !== null ? Number(row['SL']) : 0);
          const qty = isNaN(rawQty) ? 0 : rawQty;

          const rawPrePrice =
            row['Đơn giá trước thuế'] !== undefined && row['Đơn giá trước thuế'] !== '' && row['Đơn giá trước thuế'] !== null
              ? Number(row['Đơn giá trước thuế'])
              : (row['Đơn giá'] !== undefined && row['Đơn giá'] !== '' && row['Đơn giá'] !== null ? Number(row['Đơn giá']) : 0);
          const prePrice = isNaN(rawPrePrice) ? 0 : rawPrePrice;

          const vat = Number(row['Thuế suất (%)'] ?? row['Thuế suất'] ?? row['VAT'] ?? 10) || 0;
          const itemDisc = Number(row['Chiết khấu mặt hàng'] ?? row['Chiết khấu'] ?? 0) || 0;

          const sub = qty * prePrice;
          const vatAmt = ((sub - itemDisc) * vat) / 100;
          const tot = sub - itemDisc + vatAmt;

          totalPreTax += sub;
          totalVat += vatAmt;
          totalDiscount += itemDisc;

          return {
            id: `oi-imp-${Date.now()}-${idx}-${Math.random()}`,
            productCode: syncedPCode,
            productName: prod?.name || String(row['Tên HH'] || row['Tên hàng hóa'] || syncedPCode),
            saleUnit: prod?.saleUnit || String(row['Đơn vị tính'] || row['ĐVT'] || row['ĐVT_Bán'] || 'Cái'),
            quantity: qty,
            preTaxPrice: prePrice,
            postTaxPrice: prePrice * (1 + vat / 100),
            itemDiscount: itemDisc,
            vatRate: vat,
            vatAmount: vatAmt,
            subtotal: sub,
            totalAmount: tot,
          };
        });

        const ordDiscount = Number(first['Chiết khấu tổng đơn']) || 0;
        const grandTotal = Math.max(0, totalPreTax - totalDiscount - ordDiscount) + totalVat;
        const paid = Number(first['Đã thanh toán']) || 0;

        // Extract and map creator from Excel
        const rawCreator = String(
          first['Người tạo đơn/Bán hàng'] ||
          first['Người tạo đơn'] ||
          first['Người bán hàng'] ||
          first['Nhân viên bán hàng'] ||
          first['NV bán hàng'] ||
          first['Người tạo'] ||
          ''
        ).trim();

        let impCreatedById = currentUser.id;
        let impCreatedByName = currentUser.fullName || currentUser.username || 'Admin';

        if (rawCreator) {
          const matchedUser = users.find(
            (u) =>
              (u.fullName && u.fullName.toLowerCase() === rawCreator.toLowerCase()) ||
              (u.username && u.username.toLowerCase() === rawCreator.toLowerCase()) ||
              u.id === rawCreator
          );
          if (matchedUser) {
            impCreatedById = matchedUser.id;
            impCreatedByName = matchedUser.fullName || matchedUser.username;
          } else {
            impCreatedByName = rawCreator;
          }
        }

        newOrdersList.push({
          id: `ord-imp-${Date.now()}-${Math.random()}`,
          rootCode: generateNextRootCode([...orders, ...newOrdersList]),
          orderCode: code,
          orderDate: first['Ngày (YYYY-MM-DD)'] || new Date().toISOString().slice(0, 10),
          customerId: cust?.id || `cust-imp-${syncedCustCode}`,
          customerCode: syncedCustCode,
          customerName: custName,
          customerTaxCode: cust?.taxCode || String(first['Mã số thuế'] || first['MST'] || ''),
          customerIdCard: cust?.idCard || String(first['Số CCCD'] || first['CCCD'] || ''),
          customerAddress: cust?.address || String(first['Địa chỉ'] || ''),
          items: orderItems,
          itemDiscountTotal: totalDiscount,
          orderDiscount: ordDiscount,
          orderDiscountPercent: 0,
          totalPreTax,
          totalVat,
          totalAmount: grandTotal,
          paymentMethod: 'cash',
          paidAmount: paid,
          debtAmount: Math.max(0, grandTotal - paid),
          deliveryStatus: 'pending',
          notes: String(first['Ghi chú'] || 'Nhập từ file Excel'),
          createdById: impCreatedById,
          createdByName: impCreatedByName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // REQUIREMENT: Khi up đơn bán hàng, có phần kiểm tra, chọn quy tắc tạo mã trong danh sách quy tắc tạo mã, phần mềm tự động đánh lại số đơn hàng theo thứ tự tăng dần
      setPendingImportOrders(newOrdersList);
      setIsOrderImportCheckModalOpen(true);
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      alert(`Lỗi khi đọc file Excel: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Quản lý Bán hàng & Đơn hàng
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tạo đơn, theo dõi giao hàng, công nợ khách hàng và tính toán giá bán thông minh
          </p>
        </div>

        {/* Nút Tạo đơn hàng - cực kỳ dễ nhận diện trên cả mobile & desktop */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingOrder(null);
              setIsOrderFormOpen(true);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/30 transition-all transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>TẠO ĐƠN HÀNG MỚI</span>
          </button>
        </div>
      </div>

      {/* Manual Sync Bar: Làm mới, Cập nhật, Đẩy dữ liệu, Nhận dữ liệu thủ công tại màn hình chính */}
      <ManualSyncBar
        isSyncing={isSyncing}
        isAutoSyncing={isAutoSyncing}
        autoSyncEnabled={autoSyncEnabled}
        lastSyncedAt={lastSyncedAt}
        spreadsheetId={spreadsheetId}
        companyName={settings.companyName}
        taxCode={settings.taxCode}
        isDemo={isDemo}
        currentDeviceName={currentDeviceName}
        onManualReset={onManualReset}
        onManualPush={onManualPush}
        onManualPull={onManualPull}
        onManualSync2Way={onManualSync2Way}
        onOpenSyncModal={onOpenSyncModal}
      />

      {/* Tabs: Đơn hàng vs Chi tiết đơn hàng vs Khách hàng */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar max-w-full pb-0.5">
        <button
          type="button"
          onClick={() => setActiveSubTab('orders')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'orders'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Danh sách Đơn hàng ({uniqueOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('order-details')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'order-details'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>
            Chi tiết đơn hàng (
            {uniqueOrders.reduce((sum, o) => sum + (o.items ? o.items.length : 0), 0)})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('customers')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'customers'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Danh mục Khách hàng ({customers.length})</span>
        </button>
      </div>

      {activeSubTab === 'orders' ? (
        <div className="space-y-4">
          {/* Controls & Batch Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            {/* Top filter row: Search, Status, Salesperson */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              {/* Search */}
              <div className="sm:col-span-2 lg:col-span-6 relative">
                <input
                  type="text"
                  placeholder="Tìm theo Mã đơn, Tên KH, Mã KH, Người tạo đơn..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status filter */}
              <div className="lg:col-span-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white cursor-pointer shadow-2xs font-medium text-slate-700"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="red_flagged">🚨 Báo đỏ (Chưa có trong danh mục)</option>
                  <option value="pending">⏳ Chờ giao (Mặc định)</option>
                  <option value="delivering">🚚 Đang giao</option>
                  <option value="completed">✅ Hoàn thành</option>
                  <option value="cancelled">❌ Đã hủy</option>
                </select>
              </div>

              {/* Salesperson filter */}
              <div className="lg:col-span-3">
                <select
                  value={salespersonFilter}
                  onChange={(e) => setSalespersonFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white cursor-pointer shadow-2xs font-medium text-slate-700"
                  title="Lọc theo người tạo đơn/bán hàng"
                >
                  <option value="all">Tất cả người tạo đơn</option>
                  {salespeople.map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Redesigned Date Filter Strip: Presets & Custom Date Range */}
            <div className="p-3 bg-gradient-to-r from-slate-50 via-blue-50/30 to-indigo-50/20 rounded-xl border border-slate-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              {/* Presets Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mr-1 shrink-0">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Thời gian:</span>
                </div>
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'today', label: 'Hôm nay' },
                  { id: 'yesterday', label: 'Hôm qua' },
                  { id: 'last_7_days', label: '7 ngày qua' },
                  { id: 'this_month', label: 'Tháng này' },
                  { id: 'last_month', label: 'Tháng trước' },
                  { id: 'this_year', label: 'Năm nay' },
                ].map((p) => {
                  const isSelected = activeDatePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyDatePreset(p.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs font-bold ring-2 ring-blue-500/20'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Exact Date Inputs + Reset + Count indicator - Responsive for mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full min-w-0">
                <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 w-full sm:w-auto min-w-0">
                  <div className="min-w-0 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">
                      Từ ngày:
                    </label>
                    <div className="flex items-center bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 shadow-2xs min-w-0">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setActiveDatePreset('custom');
                        }}
                        className="w-full min-w-0 text-xs font-semibold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                        title="Chọn ngày bắt đầu"
                      />
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Đến ngày:
                      </label>
                      {(startDate || endDate) && (
                        <button
                          type="button"
                          onClick={() => {
                            setStartDate('');
                            setEndDate('');
                            setActiveDatePreset('all');
                          }}
                          className="text-[10px] text-rose-600 hover:underline font-semibold cursor-pointer"
                          title="Xóa lọc ngày"
                        >
                          Xóa lọc
                        </button>
                      )}
                    </div>
                    <div className="flex items-center bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 shadow-2xs min-w-0">
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setActiveDatePreset('custom');
                        }}
                        className="w-full min-w-0 text-xs font-semibold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                        title="Chọn ngày kết thúc"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                        setActiveDatePreset('all');
                      }}
                      className="text-xs text-rose-600 font-semibold hover:underline sm:hidden cursor-pointer"
                    >
                      Xóa lọc ngày
                    </button>
                  )}
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-slate-700 shadow-2xs shrink-0 ml-auto sm:ml-0">
                    <span className="text-slate-400 font-normal">Đang xem:</span>
                    <span className="text-blue-700 font-bold font-mono">{filteredOrders.length}</span>
                    <span className="text-slate-500 font-normal">/ {uniqueOrders.length} đơn</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Batch actions & Buttons toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                {/* Select All Checkbox */}
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {selectedOrderIds.length > 0 && selectedOrderIds.length === filteredOrders.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Chọn tất cả ({selectedOrderIds.length}/{filteredOrders.length})</span>
                </button>

                {/* Batch Complete */}
                <button
                  type="button"
                  disabled={selectedOrderIds.length === 0}
                  onClick={handleBatchComplete}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Hoàn thành hàng loạt</span>
                </button>

                {/* Batch Copy */}
                <button
                  type="button"
                  disabled={selectedOrderIds.length === 0}
                  onClick={handleBatchCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy đơn hàng loạt</span>
                </button>

                {/* Batch Cancel Orders (Đánh dấu hủy đơn) */}
                <button
                  type="button"
                  disabled={selectedOrderIds.length === 0}
                  onClick={handleBatchCancel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Đánh dấu các đơn đã chọn là ĐÃ HỦY (không tính công nợ, không xuất kho)"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Đánh dấu Hủy ({selectedOrderIds.length})</span>
                </button>

                {/* Batch Restore Orders (Khôi phục đơn) */}
                {selectedOrderIds.some((id) => orders.find((o) => o.id === id)?.deliveryStatus === 'cancelled') && (
                  <button
                    type="button"
                    onClick={handleBatchRestore}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 cursor-pointer"
                    title="Khôi phục các đơn đã hủy về trạng thái Chờ giao"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Khôi phục đơn đã hủy</span>
                  </button>
                )}

                {/* Batch Delete Orders - CHỈ CHO TÀI KHOẢN ADMIN XÓA ĐƠN HÀNG */}
                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    disabled={selectedOrderIds.length === 0}
                    onClick={handleBatchDeleteOrders}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-800 hover:bg-red-200 border border-red-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Chỉ tài khoản Admin mới có quyền xóa đơn hàng"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>Xóa các đơn đã chọn ({selectedOrderIds.length})</span>
                  </button>
                )}

                {/* Recalculate Prices Advanced Modal Button */}
                <button
                  type="button"
                  onClick={() => setIsRecalcModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 shadow-2xs cursor-pointer"
                  title="Mở bảng xem trước chi tiết tính lại giá bán theo khoảng ngày"
                >
                  <Calculator className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Tùy chỉnh tính giá</span>
                </button>
              </div>

              {/* Excel & Print Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Batch Print */}
                <button
                  type="button"
                  onClick={handleOpenBatchPrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In đơn hàng ({selectedOrderIds.length || 'Tất cả'})</span>
                </button>

                {/* Export Excel */}
                <button
                  type="button"
                  onClick={() => exportOrdersToExcel(filteredOrders)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất Excel</span>
                </button>

                {/* Import Excel */}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Nhập Excel</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelImport}
                    className="hidden"
                  />
                </label>

                {/* Shortcut to view order details from date to date */}
                <button
                  type="button"
                  onClick={() => setActiveSubTab('order-details')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                  title="Chuyển sang xem bảng chi tiết từng mặt hàng của các đơn hàng trong khoảng thời gian này"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    Xem chi tiết mặt hàng
                    {startDate || endDate ? ` (${filteredOrders.length} đơn)` : ''}
                  </span>
                </button>

                {/* Template download */}
                <button
                  type="button"
                  onClick={downloadOrderTemplate}
                  className="text-xs text-slate-500 hover:text-blue-600 underline cursor-pointer"
                >
                  Tải mẫu Excel
                </button>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden max-w-full">
            <div className="overflow-x-auto max-w-full overscroll-x-contain">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] sm:text-xs tracking-wider">
                  <tr>
                    <th className="p-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.length > 0 && selectedOrderIds.length === filteredOrders.length}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="p-3 text-left">Mã đơn</th>
                    <th className="p-3 text-left">Ngày tháng</th>
                    <th className="p-3 text-left min-w-44">Khách hàng</th>
                    <th className="p-3 text-left min-w-40">Người tạo đơn/Bán hàng</th>
                    <th className="p-3 text-left">Tổng tiền TT</th>
                    <th className="p-3 text-left">Đã trả</th>
                    <th className="p-3 text-left">Còn nợ</th>
                    <th className="p-3 text-left">Phương thức TT</th>
                    <th className="p-3 text-left">Trạng thái giao</th>
                    <th className="p-3 text-left min-w-32">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-slate-400">
                        Không có đơn hàng nào phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const isSelected = selectedOrderIds.includes(order.id);
                      const isCustomerUncataloged = !customers.some(
                        (c) => c.code.trim().toUpperCase() === order.customerCode?.trim().toUpperCase() || c.id === order.customerId
                      );
                      const uncatalogedItemCodes = order.items
                        .filter((it) => !products.some((p) => p.code.trim().toUpperCase() === it.productCode?.trim().toUpperCase()))
                        .map((it) => it.productCode);
                      const hasUncatalogedProds = uncatalogedItemCodes.length > 0;
                      const isOrderRedFlagged = isCustomerUncataloged || hasUncatalogedProds;
                      const isCancelled = order.deliveryStatus === 'cancelled';

                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-blue-50/40 transition-colors ${
                            isCancelled
                              ? 'bg-slate-50/80 opacity-75 hover:bg-slate-100/80 border-l-4 border-l-rose-400'
                              : isOrderRedFlagged
                              ? 'bg-rose-50/50 hover:bg-rose-50/80 border-l-4 border-l-rose-500'
                              : isSelected
                              ? 'bg-blue-50/60'
                              : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOrder(order.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingOrder(order);
                                  setIsDetailModalOpen(true);
                                }}
                                className={`inline-flex items-center gap-1 hover:text-blue-900 hover:underline cursor-pointer group text-left ${
                                  isCancelled ? 'line-through text-slate-500' : ''
                                }`}
                                title="Bấm để xem chi tiết đơn hàng"
                              >
                                <span>{order.orderCode}</span>
                                <Eye className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-700 opacity-60 group-hover:opacity-100 transition-opacity" />
                              </button>
                              {isCancelled && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded font-black bg-rose-600 text-white shadow-2xs"
                                  title="Đơn hàng này đã bị hủy: không trừ tồn kho và không tính vào công nợ"
                                >
                                  <Ban className="w-2.5 h-2.5 shrink-0" />
                                  ĐÃ HỦY
                                </span>
                              )}
                              {order.rootCode && (
                                <span
                                  className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded font-mono font-normal bg-slate-100 text-slate-600 border border-slate-200"
                                  title="Mã gốc quy chiếu tự sinh để đồng bộ chuẩn xác giữa các thiết bị"
                                >
                                  Gốc: {order.rootCode}
                                </span>
                              )}
                              {isOrderRedFlagged && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-black bg-rose-600 text-white shadow-2xs animate-pulse"
                                  title={`Đơn hàng có thông tin chưa trong danh mục: ${isCustomerUncataloged ? 'Khách hàng mới chưa có trong DM. ' : ''}${hasUncatalogedProds ? `Mã hàng chưa có trong DM: ${uncatalogedItemCodes.join(', ')}` : ''}`}
                                >
                                  <AlertTriangle className="w-3 h-3 text-rose-200 shrink-0" />
                                  Báo đỏ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-600 whitespace-nowrap">
                            {formatDate(order.orderDate)}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-900">{order.customerName}</div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span>{order.customerCode} {order.customerTaxCode && `• MST: ${order.customerTaxCode}`}</span>
                              {isCustomerUncataloged && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                  KH chưa có trong DM
                                </span>
                              )}
                            </div>
                            {hasUncatalogedProds && (
                              <div className="mt-0.5 text-[10px] text-rose-700 font-bold flex items-center gap-1 flex-wrap">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                <span>Mã chưa có trong DM:</span>
                                {uncatalogedItemCodes.slice(0, 3).map((code, cIdx) => (
                                  <span key={cIdx} className="font-mono bg-rose-100 text-rose-800 px-1 py-0.2 rounded border border-rose-200">
                                    {code}
                                  </span>
                                ))}
                                {uncatalogedItemCodes.length > 3 && (
                                  <span>+{uncatalogedItemCodes.length - 3}</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            {(() => {
                              const creatorInfo = getOrderCreator(order);
                              return (
                                <div className="space-y-0.5">
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                    <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>{creatorInfo.name}</span>
                                    {creatorInfo.role && (
                                      <span
                                        className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                                          creatorInfo.role === 'admin'
                                            ? 'bg-purple-100 text-purple-700'
                                            : creatorInfo.role === 'manager'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-emerald-100 text-emerald-700'
                                        }`}
                                      >
                                        {creatorInfo.role === 'admin' ? 'Admin' : creatorInfo.role === 'manager' ? 'Quản lý' : 'Bán hàng'}
                                      </span>
                                    )}
                                  </div>
                                  {order.updatedByName && (
                                    <div className="text-[10px] text-slate-400 pl-1">
                                      Sửa: <span className="font-medium text-slate-600">{order.updatedByName}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="p-3 text-right font-black text-slate-900">
                            {isCancelled ? (
                              <span className="line-through text-slate-400 font-semibold" title="Đơn hàng đã hủy - không tính doanh thu">
                                {formatCurrency(order.totalAmount)}
                              </span>
                            ) : (
                              formatCurrency(order.totalAmount)
                            )}
                          </td>
                          <td className="p-3 text-right font-semibold text-emerald-600">
                            {formatCurrency(order.paidAmount)}
                          </td>
                          <td className="p-3 text-right font-semibold">
                            {isCancelled ? (
                              <span className="text-slate-400 font-medium text-xs bg-slate-100 px-2 py-0.5 rounded">
                                0 đ (Đã hủy)
                              </span>
                            ) : (
                              <span className={order.debtAmount > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                                {formatCurrency(order.debtAmount)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                              {order.paymentMethod === 'cash' ? 'Tiền mặt' : order.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thẻ'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                order.deliveryStatus === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : order.deliveryStatus === 'delivering'
                                  ? 'bg-blue-100 text-blue-800'
                                  : order.deliveryStatus === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {order.deliveryStatus === 'pending'
                                ? 'Chờ giao'
                                : order.deliveryStatus === 'delivering'
                                ? 'Đang giao'
                                : order.deliveryStatus === 'completed'
                                ? 'Hoàn thành'
                                : 'Đã hủy'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* View detail */}
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingOrder(order);
                                  setIsDetailModalOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Xem chi tiết đơn hàng"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOrder(order);
                                  setIsOrderFormOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Chỉnh sửa đơn hàng"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* Copy */}
                              <button
                                type="button"
                                onClick={() => handleCopyOrder(order)}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Copy đơn hàng"
                              >
                                <Copy className="w-4 h-4" />
                              </button>

                              {/* Toggle Cancel / Restore */}
                              <button
                                type="button"
                                onClick={() => handleToggleCancelOrder(order)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isCancelled
                                    ? 'text-amber-600 hover:text-emerald-600 hover:bg-emerald-50'
                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                                title={isCancelled ? 'Khôi phục đơn hàng' : 'Đánh dấu hủy đơn hàng (không trừ kho, không tính nợ)'}
                              >
                                {isCancelled ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                              </button>

                              {/* Print */}
                              <button
                                type="button"
                                onClick={() => {
                                  setOrdersToPrint([order]);
                                  setIsPrintModalOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                title="In phiếu bán hàng"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Delete - CHỈ CHO PHÉP TÀI KHOẢN ADMIN XÓA */}
                              {currentUser.role === 'admin' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: 'Xác nhận xóa đơn hàng',
                                      message: `Bạn có chắc chắn muốn xóa đơn hàng ${order.orderCode} của khách hàng "${order.customerName}"?`,
                                      confirmText: 'Xóa đơn hàng',
                                      type: 'danger',
                                    });
                                    if (ok) {
                                      onDeleteOrder(order.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Xóa đơn hàng (Chỉ Admin)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
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
      ) : activeSubTab === 'order-details' ? (
        <OrderDetailsTab
          orders={uniqueOrders}
          initialStartDate={startDate}
          initialEndDate={endDate}
          onSaveOrder={onSaveOrder}
          onViewOrder={(order) => {
            setViewingOrder(order);
            setIsDetailModalOpen(true);
          }}
          onEditOrder={(order) => {
            setEditingOrder(order);
            setIsOrderFormOpen(true);
          }}
        />
      ) : (
        /* Customers Tab */
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Tìm khách hàng (Tên, Mã, MST, SĐT)..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>

              {/* Duplicate Tax Filter Toggle */}
              <button
                type="button"
                onClick={() => setCustomerFilterDuplicateTax(!customerFilterDuplicateTax)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  customerFilterDuplicateTax
                    ? 'bg-rose-100 text-rose-800 border-rose-300 ring-2 ring-rose-400 shadow-xs'
                    : duplicateTaxCodes.size > 0
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title="Lọc danh sách các khách hàng có mã số thuế bị trùng nhau"
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${customerFilterDuplicateTax || duplicateTaxCodes.size > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Lọc trùng MST</span>
                {duplicateTaxCodes.size > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    customerFilterDuplicateTax ? 'bg-rose-600 text-white' : 'bg-rose-200 text-rose-800'
                  }`}>
                    {duplicateCustomerCount} KH
                  </span>
                )}
              </button>

              {/* Sort selector */}
              <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
                <span className="text-slate-500 font-medium whitespace-nowrap">Sắp xếp:</span>
                <select
                  value={customerSortField}
                  onChange={(e) => setCustomerSortField(e.target.value as any)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="default">Mặc định</option>
                  <option value="code">Mã khách hàng</option>
                  <option value="taxCode">Mã số thuế</option>
                  <option value="type">Loại khách hàng</option>
                </select>
                {customerSortField !== 'default' && (
                  <button
                    type="button"
                    onClick={() => setCustomerSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                    className="p-1 hover:bg-slate-200 rounded text-blue-700 font-bold cursor-pointer transition-colors"
                    title={customerSortDirection === 'asc' ? 'Đang tăng dần (A-Z). Bấm chuyển giảm dần (Z-A)' : 'Đang giảm dần (Z-A). Bấm chuyển tăng dần (A-Z)'}
                  >
                    {customerSortDirection === 'asc' ? (
                      <span className="inline-flex items-center gap-0.5 text-[11px]">↑ A-Z</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[11px]">↓ Z-A</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Download Excel Template */}
              <button
                type="button"
                onClick={downloadCustomerTemplate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                title="Tải file mẫu Excel nhập danh mục khách hàng"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Mẫu Excel</span>
              </button>

              {/* Export to Excel */}
              <button
                type="button"
                onClick={() => exportCustomersToExcel(customers)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs transition-colors cursor-pointer"
                title="Xuất danh sách khách hàng ra Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Xuất Excel</span>
              </button>

              {/* Import from Excel */}
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs transition-colors cursor-pointer">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>Nhập Excel</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleCustomerExcelImport}
                  className="hidden"
                />
              </label>

              {/* Add New Customer */}
              <button
                type="button"
                onClick={() => {
                  setEditingCustomer(null);
                  setIsCustomerModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm mới</span>
              </button>
            </div>
          </div>

          {/* DUPLICATE TAX CODE ALERT BANNER */}
          {duplicateTaxCodes.size > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Cảnh báo trùng mã số thuế:</strong> Phát hiện <strong>{duplicateTaxCodes.size}</strong> mã số thuế bị trùng giữa <strong>{duplicateCustomerCount}</strong> khách hàng trong danh mục (các mục được bôi đỏ nổi bật bên dưới).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCustomerFilterDuplicateTax(!customerFilterDuplicateTax)}
                className="shrink-0 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                {customerFilterDuplicateTax ? 'Xem toàn bộ khách hàng' : 'Lọc chỉ xem KH trùng MST'}
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] sm:text-xs">
                  <tr>
                    <th className="p-3 w-10 text-left">STT</th>
                    <th
                      onClick={() => handleCustomerSort('code')}
                      className="p-3 text-left cursor-pointer select-none hover:bg-slate-200 transition-colors group"
                      title="Bấm để sắp xếp theo Mã khách hàng"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Mã KH</span>
                        {customerSortField === 'code' ? (
                          customerSortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 text-left">Tên khách hàng</th>
                    <th className="p-3 text-left">Tên gợi nhớ</th>
                    <th
                      onClick={() => handleCustomerSort('taxCode')}
                      className="p-3 text-left cursor-pointer select-none hover:bg-slate-200 transition-colors group"
                      title="Bấm để sắp xếp theo Mã số thuế"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Mã số thuế</span>
                        {customerSortField === 'taxCode' ? (
                          customerSortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 text-left">Số CCCD</th>
                    <th className="p-3 text-left">Điện thoại</th>
                    <th className="p-3 text-left">Địa chỉ</th>
                    <th
                      onClick={() => handleCustomerSort('type')}
                      className="p-3 text-center cursor-pointer select-none hover:bg-slate-200 transition-colors group"
                      title="Bấm để sắp xếp theo Loại khách hàng (Tổ chức / Cá nhân)"
                    >
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>Loại KH</span>
                        {customerSortField === 'type' ? (
                          customerSortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 text-left">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-10 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="w-8 h-8 text-slate-300" />
                          <p className="font-semibold text-slate-600">
                            {customerFilterDuplicateTax
                              ? 'Không tìm thấy khách hàng nào trùng mã số thuế.'
                              : 'Không tìm thấy khách hàng nào phù hợp.'}
                          </p>
                          {customerFilterDuplicateTax && (
                            <button
                              type="button"
                              onClick={() => setCustomerFilterDuplicateTax(false)}
                              className="text-xs text-blue-600 hover:text-blue-800 underline font-semibold mt-1 cursor-pointer"
                            >
                              Bỏ lọc trùng MST và hiển thị tất cả khách hàng
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((cust, idx) => {
                      const isDupTax = cust.taxCode && duplicateTaxCodes.has(cust.taxCode.trim());
                      return (
                        <tr
                          key={cust.id}
                          className={`transition-colors ${
                            isDupTax
                              ? 'bg-rose-50/70 hover:bg-rose-100/70 border-l-4 border-l-rose-500'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-blue-700">{cust.code}</td>
                          <td className="p-3 font-semibold text-slate-900">{cust.name}</td>
                          <td className="p-3 text-slate-600">{cust.shortName}</td>
                          <td className="p-3">
                            {isDupTax ? (
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>{cust.taxCode}</span>
                                <span className="text-[10px] text-rose-800 font-semibold">(Trùng MST)</span>
                              </span>
                            ) : (
                              <span className="font-mono text-slate-700">{cust.taxCode || '—'}</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-700">{cust.idCard || '—'}</td>
                          <td className="p-3 text-slate-700">{cust.phone || '—'}</td>
                          <td className="p-3 text-slate-600">{cust.address || '—'}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              cust.type === 'organization' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {cust.type === 'organization' ? 'Tổ chức' : 'Cá nhân'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCustomer(cust);
                                  setIsCustomerModalOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                title="Sửa khách hàng"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Xác nhận xóa khách hàng',
                                    message: `Bạn có chắc muốn xóa khách hàng "${cust.name}" (Mã: ${cust.code})?`,
                                    confirmText: 'Xóa khách hàng',
                                    type: 'danger',
                                  });
                                  if (ok) {
                                    onDeleteCustomer(cust.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Xóa khách hàng"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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

      {/* Customer Excel Duplicate Conflict Modal */}
      {customerConflictModalOpen && (
        <ExcelDuplicateConflictModal
          isOpen={customerConflictModalOpen}
          entityTitle="Khách hàng"
          totalImportedCount={totalCustomerImportedCount}
          newItemsCount={pendingNewCustomers.length}
          conflicts={pendingCustomerConflicts}
          onSkipDuplicates={handleSkipCustomerDuplicates}
          onOverwriteDuplicates={handleOverwriteCustomerDuplicates}
          onCancel={() => setCustomerConflictModalOpen(false)}
        />
      )}


      {/* Order Creation / Edit Modal */}
      {isOrderFormOpen && (
        <OrderFormModal
          isOpen={isOrderFormOpen}
          onClose={() => setIsOrderFormOpen(false)}
          onSave={onSaveOrder}
          initialOrder={editingOrder}
          customers={customers}
          products={products}
          purchases={purchases}
          allOrders={uniqueOrders}
          debtPayments={debtPayments}
          currentUser={currentUser}
          settings={settings}
          users={users}
          onAddNewCustomer={onSaveCustomer}
        />
      )}

      {/* Order Detail Modal */}
      {isDetailModalOpen && viewingOrder && (
        <OrderDetailModal
          order={viewingOrder}
          settings={settings}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onEdit={(ord) => {
            setEditingOrder(ord);
            setIsOrderFormOpen(true);
          }}
          onCopy={handleCopyOrder}
          onPrint={(ord) => {
            setOrdersToPrint([ord]);
            setIsPrintModalOpen(true);
          }}
          onToggleCancel={handleToggleCancelOrder}
        />
      )}

      {/* Recalculate Prices Modal */}
      {isRecalcModalOpen && (
        <RecalculatePricesModal
          orders={uniqueOrders}
          selectedOrderIds={selectedOrderIds}
          products={products}
          purchases={purchases}
          settings={settings}
          isOpen={isRecalcModalOpen}
          onClose={() => setIsRecalcModalOpen(false)}
          onApplyRecalculation={onBatchUpdateOrders}
        />
      )}

      {/* Batch Print Modal */}
      {isPrintModalOpen && (
        <OrderPrintModal
          orders={ordersToPrint}
          settings={settings}
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}

      {/* Customer Modal */}
      {isCustomerModalOpen && (
        <CustomerModal
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          onSave={onSaveCustomer}
          initialCustomer={editingCustomer}
          existingCustomersCount={customers.length}
          existingCustomers={customers}
        />
      )}

      {/* Customer Excel Duplicate Conflict Modal */}
      {customerConflictModalOpen && (
        <ExcelDuplicateConflictModal
          isOpen={customerConflictModalOpen}
          entityTitle="Khách hàng"
          totalImportedCount={totalCustomerImportedCount}
          newItemsCount={pendingNewCustomers.length}
          conflicts={pendingCustomerConflicts}
          onSkipDuplicates={handleSkipCustomerDuplicates}
          onOverwriteDuplicates={handleOverwriteCustomerDuplicates}
          onCancel={() => setCustomerConflictModalOpen(false)}
        />
      )}

      {/* Order Excel Import Check & Rule Selection Modal */}
      {isOrderImportCheckModalOpen && (
        <OrderImportCheckModal
          isOpen={isOrderImportCheckModalOpen}
          importedOrders={pendingImportOrders}
          existingOrders={orders}
          existingProducts={products}
          existingCustomers={customers}
          rules={settings.orderCodeRules && settings.orderCodeRules.length > 0 ? settings.orderCodeRules : [
            {
              id: 'rule-dh',
              name: 'Đơn bán hàng (DH-)',
              patternType: 'prefix_only',
              prefix: 'DH',
              separator: '-',
              minDigits: 1,
              isDefault: true,
            }
          ]}
          defaultRuleId={settings.defaultOrderCodeRuleId || 'rule-dh'}
          productSyncList={pendingProductSync}
          customerSyncList={pendingCustomerSync}
          onConfirmImport={handleConfirmImportOrders}
          onCancel={() => {
            setIsOrderImportCheckModalOpen(false);
            setPendingImportOrders([]);
            setPendingProductSync([]);
            setPendingCustomerSync([]);
          }}
        />
      )}
    </div>
  );
};
