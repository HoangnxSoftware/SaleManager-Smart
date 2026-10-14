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
import { OrderPrintModal } from '../Print/OrderPrintModal';
import { OrderDetailsTab } from './OrderDetailsTab';
import { ExcelDuplicateConflictModal, ConflictItem } from '../Common/ExcelDuplicateConflictModal';
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
  X
} from 'lucide-react';

interface SalesManagerProps {
  orders: Order[];
  customers: Customer[];
  products: Product[];
  purchases: PurchaseBill[];
  debtPayments: DebtPayment[];
  currentUser: AppUser;
  settings: AppSettings;
  onSaveOrder: (order: Order) => void;
  onBatchUpdateOrders: (orders: Order[]) => void;
  onDeleteOrder: (orderId: string) => void;
  onBatchDeleteOrders?: (orderIds: string[]) => void;
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onBatchUpdateCustomers?: (customers: Customer[]) => void;
}

export const SalesManager: React.FC<SalesManagerProps> = ({
  orders,
  customers,
  products,
  purchases,
  debtPayments,
  currentUser,
  settings,
  onSaveOrder,
  onBatchUpdateOrders,
  onDeleteOrder,
  onBatchDeleteOrders,
  onSaveCustomer,
  onDeleteCustomer,
  onBatchUpdateCustomers,
}) => {
  const confirm = useConfirm();
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'order-details' | 'customers'>('orders');

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [salespersonFilter, setSalespersonFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Extract unique salespeople
  const salespeople = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.createdByName && o.createdByName.trim()) {
        set.add(o.createdByName.trim());
      }
    });
    return Array.from(set).sort();
  }, [orders]);

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

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        !searchTerm.trim() ||
        o.orderCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.createdByName && o.createdByName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'all' || o.deliveryStatus === statusFilter;
      const matchDate =
        (!startDate || o.orderDate >= startDate) && (!endDate || o.orderDate <= endDate);
      const matchSalesperson =
        salespersonFilter === 'all' || o.createdByName === salespersonFilter;

      return matchSearch && matchStatus && matchDate && matchSalesperson;
    }).sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.createdAt.localeCompare(a.createdAt));
  }, [orders, searchTerm, statusFilter, startDate, endDate, salespersonFilter]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.taxCode.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

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

  const handleConfirmImportOrders = (finalOrders: Order[]) => {
    onBatchUpdateOrders(finalOrders);
    setIsOrderImportCheckModalOpen(false);
    setPendingImportOrders([]);
    alert(`Đã nhập thành công ${finalOrders.length} đơn hàng từ Excel theo thứ tự tăng dần!`);
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
        const custCode = String(first['Mã KH'] || 'KH001').trim();
        const cust = customers.find((c) => c.code === custCode) || customers[0];

        let totalPreTax = 0;
        let totalVat = 0;
        let totalDiscount = 0;

        const orderItems = itemsList.map((row: any, idx: number) => {
          const pCode = String(row['Mã HH'] || 'PROD').trim();
          const prod = products.find((p) => p.code === pCode);
          const qty = Number(row['Số lượng']) || 1;
          const prePrice = Number(row['Đơn giá trước thuế']) || 100000;
          const vat = Number(row['Thuế suất (%)']) || 10;
          const itemDisc = Number(row['Chiết khấu mặt hàng']) || 0;

          const sub = qty * prePrice;
          const vatAmt = ((sub - itemDisc) * vat) / 100;
          const tot = sub - itemDisc + vatAmt;

          totalPreTax += sub;
          totalVat += vatAmt;
          totalDiscount += itemDisc;

          return {
            id: `oi-imp-${Date.now()}-${idx}-${Math.random()}`,
            productCode: pCode,
            productName: prod?.name || pCode,
            saleUnit: prod?.saleUnit || 'Cái',
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

        newOrdersList.push({
          id: `ord-imp-${Date.now()}-${Math.random()}`,
          orderCode: code,
          orderDate: first['Ngày (YYYY-MM-DD)'] || new Date().toISOString().slice(0, 10),
          customerId: cust?.id || 'cust-1',
          customerCode: cust?.code || custCode,
          customerName: cust?.name || first['Tên khách hàng'] || 'Khách hàng Excel',
          customerTaxCode: cust?.taxCode || '',
          customerIdCard: cust?.idCard || '',
          customerAddress: cust?.address || '',
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
          createdById: currentUser.id,
          createdByName: currentUser.fullName,
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

      {/* Tabs: Đơn hàng vs Chi tiết đơn hàng vs Khách hàng */}
      <div className="flex flex-wrap items-center gap-1 sm:gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('orders')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'orders'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Danh sách Đơn hàng ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('order-details')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'order-details'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>
            Chi tiết đơn hàng (
            {orders.reduce((sum, o) => sum + (o.items ? o.items.length : 0), 0)})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('customers')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="sm:col-span-2 relative">
                <input
                  type="text"
                  placeholder="Tìm theo Mã đơn, Tên KH, Mã KH, Người tạo đơn..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>

              {/* Status filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white cursor-pointer"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="pending">⏳ Chờ giao (Mặc định)</option>
                  <option value="delivering">🚚 Đang giao</option>
                  <option value="completed">✅ Hoàn thành</option>
                  <option value="cancelled">❌ Đã hủy</option>
                </select>
              </div>

              {/* Salesperson filter */}
              <div>
                <select
                  value={salespersonFilter}
                  onChange={(e) => setSalespersonFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white cursor-pointer"
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

              {/* Date range filter */}
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-300">
                <span className="text-[11px] font-semibold text-slate-500 pl-1">Từ:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                  title="Từ ngày"
                />
                <span className="text-[11px] font-semibold text-slate-500">Đến:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                  title="Đến ngày"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    title="Xóa lọc ngày"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
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

                {/* Batch Delete Orders - Requirement 6 */}
                <button
                  type="button"
                  disabled={selectedOrderIds.length === 0}
                  onClick={handleBatchDeleteOrders}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Xóa các đơn hàng đã chọn cùng một lúc"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa các đơn đã chọn ({selectedOrderIds.length})</span>
                </button>

                {/* Recalculate Prices Button */}
                <button
                  type="button"
                  onClick={() => setIsRecalcModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 shadow-xs cursor-pointer"
                  title="Tự động tính lại đơn giá bán theo Giá vốn cao nhất và Tỷ suất lợi nhuận"
                >
                  <Calculator className="w-3.5 h-3.5 text-amber-600" />
                  <span>Tính lại giá bán tự động</span>
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
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
                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-blue-50/40 transition-colors ${
                            isSelected ? 'bg-blue-50/60' : ''
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
                          <td className="p-3 font-mono font-bold text-blue-700">
                            {order.orderCode}
                          </td>
                          <td className="p-3 text-slate-600">
                            {formatDate(order.orderDate)}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-900">{order.customerName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {order.customerCode} {order.customerTaxCode && `• MST: ${order.customerTaxCode}`}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                              {order.createdByName || '—'}
                            </span>
                          </td>
                          <td className="p-3 text-right font-black text-slate-900">
                            {formatCurrency(order.totalAmount)}
                          </td>
                          <td className="p-3 text-right font-semibold text-emerald-600">
                            {formatCurrency(order.paidAmount)}
                          </td>
                          <td className="p-3 text-right font-semibold">
                            <span className={order.debtAmount > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                              {formatCurrency(order.debtAmount)}
                            </span>
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

                              {/* Delete */}
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
                                title="Xóa đơn hàng"
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
      ) : activeSubTab === 'order-details' ? (
        <OrderDetailsTab
          orders={orders}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Tìm khách hàng (Tên, Mã, MST, SĐT)..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
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
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center gap-2 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Cảnh báo trùng mã số thuế:</strong> Phát hiện <strong>{duplicateTaxCodes.size}</strong> mã số thuế bị trùng giữa nhiều khách hàng trong danh mục (các mục được bôi đỏ nổi bật bên dưới).
              </span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] sm:text-xs">
                  <tr>
                    <th className="p-3 w-10 text-left">STT</th>
                    <th className="p-3 text-left">Mã KH</th>
                    <th className="p-3 text-left">Tên khách hàng</th>
                    <th className="p-3 text-left">Tên gợi nhớ</th>
                    <th className="p-3 text-left">Mã số thuế</th>
                    <th className="p-3 text-left">Số CCCD</th>
                    <th className="p-3 text-left">Điện thoại</th>
                    <th className="p-3 text-left">Địa chỉ</th>
                    <th className="p-3 text-left">Loại KH</th>
                    <th className="p-3 text-left">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((cust, idx) => {
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
                  })}
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
          allOrders={orders}
          debtPayments={debtPayments}
          currentUser={currentUser}
          settings={settings}
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
        />
      )}

      {/* Recalculate Prices Modal */}
      {isRecalcModalOpen && (
        <RecalculatePricesModal
          orders={orders}
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
          onConfirmImport={handleConfirmImportOrders}
          onCancel={() => {
            setIsOrderImportCheckModalOpen(false);
            setPendingImportOrders([]);
          }}
        />
      )}
    </div>
  );
};
