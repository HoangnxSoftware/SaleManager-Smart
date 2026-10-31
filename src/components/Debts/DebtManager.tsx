import React, { useState, useMemo } from 'react';
import { Customer, Supplier, Order, PurchaseBill, DebtPayment } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { DebtPaymentModal } from './DebtPaymentModal';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Wallet,
  Users,
  Building2,
  Plus,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  History,
  FileText,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  Trash2,
  Upload,
  Download,
  Filter,
  Check,
  RotateCcw,
  ChevronRight,
  UserCheck,
  Eye,
  X
} from 'lucide-react';
import {
  parseExcelFile,
  downloadCustomerDebtTemplate,
  downloadSupplierDebtTemplate,
  exportDebtSummaryToExcel,
  exportEntityDebtDetailToExcel,
} from '../../services/excelService';

interface DebtManagerProps {
  customers: Customer[];
  suppliers: Supplier[];
  orders: Order[];
  purchases: PurchaseBill[];
  debtPayments: DebtPayment[];
  onSaveDebtPayment: (payment: DebtPayment) => void;
  onDeleteDebtPayment: (paymentId: string) => void;
  onBatchUpdateDebtPayments?: (payments: DebtPayment[]) => void;
}

export const DebtManager: React.FC<DebtManagerProps> = ({
  customers,
  suppliers,
  orders,
  purchases,
  debtPayments,
  onSaveDebtPayment,
  onDeleteDebtPayment,
  onBatchUpdateDebtPayments,
}) => {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>('customer');
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');
  const [searchTerm, setSearchTerm] = useState('');

  // Date range filter for Debts
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected entity for detailed drilldown
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Debt filter mode for summary view: all | has_debt | zero_debt
  const [debtFilterMode, setDebtFilterMode] = useState<'all' | 'has_debt' | 'zero_debt'>('all');

  // Smart Search Window modal for Detail View
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalDebtOnly, setModalDebtOnly] = useState(false);

  // Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [preSelectedId, setPreSelectedId] = useState<string | undefined>(undefined);

  // Excel Import for Debts
  const handleExcelImportDebts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // REQUIREMENT: Khi up dữ liệu từ excel ở tất cả dữ liệu, xuất hiện thông báo xác nhận xem có thực hiện hay không
    const ok = await confirm({
      title: activeTab === 'customer' ? 'Xác nhận nhập thu nợ khách hàng từ Excel' : 'Xác nhận nhập chi trả nợ NCC từ Excel',
      message: `Bạn có chắc chắn muốn tải lên và nhập dữ liệu từ file "${file.name}" vào sổ công nợ không?`,
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

      if (activeTab === 'customer') {
        const newPayments: DebtPayment[] = [];
        let totalAmt = 0;

        rows.forEach((r: any, idx: number) => {
          const custCode = String(r['Mã KH'] || '').trim();
          const custName = String(r['Tên khách hàng'] || '').trim();
          const matchedCust = customers.find(
            (c) =>
              (custCode && c.code.toLowerCase() === custCode.toLowerCase()) ||
              (custName && c.name.toLowerCase() === custName.toLowerCase()) ||
              (custCode && c.taxCode && c.taxCode === custCode)
          );

          if (!matchedCust) return;

          const amount = Number(r['Số tiền thu'] || r['Số tiền'] || 0);
          if (amount <= 0) return;

          const methodStr = String(r['Phương thức thanh toán'] || r['Hình thức TT'] || '').toLowerCase();
          const paymentMethod = methodStr.includes('chuyển') || methodStr.includes('transfer')
            ? 'transfer'
            : methodStr.includes('thẻ') || methodStr.includes('card')
            ? 'card'
            : 'cash';

          const date = r['Ngày thu (YYYY-MM-DD)'] || r['Ngày thu'] || new Date().toISOString().slice(0, 10);
          const notes = String(r['Ghi chú'] || 'Thu nợ khách hàng từ Excel').trim();
          const pCode = String(r['Mã phiếu'] || `PT-${Date.now().toString().slice(-4)}-${idx + 1}`).trim();

          totalAmt += amount;
          newPayments.push({
            id: `dp-cust-${Date.now()}-${idx}-${Math.random()}`,
            code: pCode,
            type: 'customer',
            entityId: matchedCust.id,
            entityCode: matchedCust.code,
            entityName: matchedCust.name,
            date: date.toString().slice(0, 10),
            amount,
            paymentMethod,
            notes,
            createdAt: new Date().toISOString(),
          });
        });

        if (newPayments.length === 0) {
          alert('Không tìm thấy dòng dữ liệu thu nợ hợp lệ. Vui lòng kiểm tra Mã KH và Số tiền thu.');
          return;
        }

        const ok = await confirm({
          title: 'Xác nhận nhập dữ liệu Excel thu tiền nợ KH',
          message: `Bạn đang chuẩn bị nhập ${newPayments.length} phiếu thu nợ cho ${new Set(newPayments.map((p) => p.entityCode)).size} khách hàng với tổng số tiền ${formatCurrency(totalAmt)}. Bạn có chắc chắn muốn thực hiện không?`,
          confirmText: 'Xác nhận nhập',
          type: 'info',
        });

        if (ok) {
          if (onBatchUpdateDebtPayments) {
            onBatchUpdateDebtPayments(newPayments);
          } else {
            newPayments.forEach(onSaveDebtPayment);
          }
          alert(`Đã nhập thành công ${newPayments.length} phiếu thu tiền nợ khách hàng từ Excel!`);
        }
      } else {
        const newPayments: DebtPayment[] = [];
        let totalAmt = 0;

        rows.forEach((r: any, idx: number) => {
          const supCode = String(r['Mã NCC'] || '').trim();
          const supName = String(r['Tên nhà cung cấp'] || r['Tên NCC'] || '').trim();
          const matchedSup = suppliers.find(
            (s) =>
              (supCode && s.code.toLowerCase() === supCode.toLowerCase()) ||
              (supName && s.name.toLowerCase() === supName.toLowerCase()) ||
              (supCode && s.taxCode && s.taxCode === supCode)
          );

          if (!matchedSup) return;

          const amount = Number(r['Số tiền chi'] || r['Số tiền'] || 0);
          if (amount <= 0) return;

          const methodStr = String(r['Phương thức thanh toán'] || r['Hình thức TT'] || '').toLowerCase();
          const paymentMethod = methodStr.includes('chuyển') || methodStr.includes('transfer')
            ? 'transfer'
            : methodStr.includes('thẻ') || methodStr.includes('card')
            ? 'card'
            : 'cash';

          const date = r['Ngày chi (YYYY-MM-DD)'] || r['Ngày chi'] || new Date().toISOString().slice(0, 10);
          const notes = String(r['Ghi chú'] || 'Chi trả tiền nợ NCC từ Excel').trim();
          const pCode = String(r['Mã phiếu'] || `PC-${Date.now().toString().slice(-4)}-${idx + 1}`).trim();

          totalAmt += amount;
          newPayments.push({
            id: `dp-sup-${Date.now()}-${idx}-${Math.random()}`,
            code: pCode,
            type: 'supplier',
            entityId: matchedSup.id,
            entityCode: matchedSup.code,
            entityName: matchedSup.name,
            date: date.toString().slice(0, 10),
            amount,
            paymentMethod,
            notes,
            createdAt: new Date().toISOString(),
          });
        });

        if (newPayments.length === 0) {
          alert('Không tìm thấy dòng dữ liệu chi trả nợ NCC hợp lệ. Vui lòng kiểm tra Mã NCC và Số tiền chi.');
          return;
        }

        const ok = await confirm({
          title: 'Xác nhận nhập dữ liệu Excel chi trả tiền nợ NCC',
          message: `Bạn đang chuẩn bị nhập ${newPayments.length} phiếu chi trả tiền nợ cho ${new Set(newPayments.map((p) => p.entityCode)).size} nhà cung cấp với tổng số tiền ${formatCurrency(totalAmt)}. Bạn có chắc chắn muốn thực hiện không?`,
          confirmText: 'Xác nhận nhập',
          type: 'info',
        });

        if (ok) {
          if (onBatchUpdateDebtPayments) {
            onBatchUpdateDebtPayments(newPayments);
          } else {
            newPayments.forEach(onSaveDebtPayment);
          }
          alert(`Đã nhập thành công ${newPayments.length} phiếu chi trả tiền nợ NCC từ Excel!`);
        }
      }

      e.target.value = '';
    } catch (err: any) {
      alert(`Lỗi đọc file Excel: ${err.message}`);
    }
  };

  // Customer debt summaries
  const customerDebtsSummary = useMemo(() => {
    return customers.map((c) => {
      // Sum order amounts and order paid (match by customerId or customerCode)
      const custOrders = orders.filter(
        (o) =>
          (o.customerId === c.id || (o.customerCode && o.customerCode.trim().toLowerCase() === c.code.trim().toLowerCase())) &&
          o.deliveryStatus !== 'cancelled' &&
          (!startDate || o.orderDate >= startDate) &&
          (!endDate || o.orderDate <= endDate)
      );
      const totalOrderAmount = custOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const totalOrderPaid = custOrders.reduce((sum, o) => sum + o.paidAmount, 0);

      // Sum debt payments (match by entityId or entityCode)
      const directPayments = debtPayments
        .filter(
          (dp) =>
            dp.type === 'customer' &&
            (dp.entityId === c.id || (dp.entityCode && dp.entityCode.trim().toLowerCase() === c.code.trim().toLowerCase())) &&
            (!startDate || dp.date >= startDate) &&
            (!endDate || dp.date <= endDate)
        )
        .reduce((sum, dp) => sum + dp.amount, 0);

      const totalPaid = totalOrderPaid + directPayments;
      const currentDebt = Math.max(0, totalOrderAmount - totalPaid);

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        taxCode: c.taxCode,
        phone: c.phone,
        address: c.address,
        totalSales: totalOrderAmount,
        totalPaid,
        currentDebt,
        ordersCount: custOrders.length,
      };
    });
  }, [customers, orders, debtPayments, startDate, endDate]);

  // Supplier debt summaries
  const supplierDebtsSummary = useMemo(() => {
    return suppliers.map((s) => {
      const supPurchases = purchases.filter(
        (p) =>
          ((p.supplierCode && p.supplierCode.trim().toLowerCase() === s.code.trim().toLowerCase()) ||
            (p.supplierTaxCode && s.taxCode && p.supplierTaxCode.trim() === s.taxCode.trim()) ||
            ((p as any).supplierId === s.id)) &&
          (!startDate || p.purchaseDate >= startDate) &&
          (!endDate || p.purchaseDate <= endDate)
      );
      const totalPurchaseAmount = supPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
      const totalPurchasePaid = supPurchases.reduce((sum, p) => sum + p.paidAmount, 0);

      const directPayments = debtPayments
        .filter(
          (dp) =>
            dp.type === 'supplier' &&
            (dp.entityId === s.id || (dp.entityCode && dp.entityCode.trim().toLowerCase() === s.code.trim().toLowerCase())) &&
            (!startDate || dp.date >= startDate) &&
            (!endDate || dp.date <= endDate)
        )
        .reduce((sum, dp) => sum + dp.amount, 0);

      const totalPaid = totalPurchasePaid + directPayments;
      const currentDebt = Math.max(0, totalPurchaseAmount - totalPaid);

      return {
        id: s.id,
        code: s.code,
        name: s.name,
        taxCode: s.taxCode,
        phone: s.phone,
        address: s.address,
        totalPurchases: totalPurchaseAmount,
        totalPaid,
        currentDebt,
        purchasesCount: supPurchases.length,
      };
    });
  }, [suppliers, purchases, debtPayments, startDate, endDate]);

  // Overall totals
  const totalCustomerDebt = useMemo(() => {
    return customerDebtsSummary.reduce((sum, c) => sum + c.currentDebt, 0);
  }, [customerDebtsSummary]);

  const totalSupplierDebt = useMemo(() => {
    return supplierDebtsSummary.reduce((sum, s) => sum + s.currentDebt, 0);
  }, [supplierDebtsSummary]);

  const customerDebtCounts = useMemo(() => {
    const total = customerDebtsSummary.length;
    const hasDebt = customerDebtsSummary.filter((c) => c.currentDebt > 0).length;
    const zeroDebt = total - hasDebt;
    return { total, hasDebt, zeroDebt };
  }, [customerDebtsSummary]);

  const supplierDebtCounts = useMemo(() => {
    const total = supplierDebtsSummary.length;
    const hasDebt = supplierDebtsSummary.filter((s) => s.currentDebt > 0).length;
    const zeroDebt = total - hasDebt;
    return { total, hasDebt, zeroDebt };
  }, [supplierDebtsSummary]);

  const currentSummaryList = activeTab === 'customer' ? customerDebtsSummary : supplierDebtsSummary;

  // Filtered Summary List based on searchTerm and debtFilterMode
  const filteredSummaryList = useMemo(() => {
    return currentSummaryList.filter((item) => {
      // Debt filter mode
      if (debtFilterMode === 'has_debt' && item.currentDebt <= 0) return false;
      if (debtFilterMode === 'zero_debt' && item.currentDebt > 0) return false;

      // Search term filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchCode = item.code.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchTax = item.taxCode ? item.taxCode.toLowerCase().includes(q) : false;
        const matchPhone = item.phone ? item.phone.toLowerCase().includes(q) : false;
        if (!matchCode && !matchName && !matchTax && !matchPhone) return false;
      }

      return true;
    });
  }, [currentSummaryList, searchTerm, debtFilterMode]);

  const summaryTotals = useMemo(() => {
    return filteredSummaryList.reduce(
      (acc, item) => {
        const totalDocAmt = activeTab === 'customer' ? (item as any).totalSales : (item as any).totalPurchases;
        return {
          totalAmount: acc.totalAmount + (totalDocAmt || 0),
          totalPaid: acc.totalPaid + (item.totalPaid || 0),
          totalDebt: acc.totalDebt + (item.currentDebt || 0),
        };
      },
      { totalAmount: 0, totalPaid: 0, totalDebt: 0 }
    );
  }, [filteredSummaryList, activeTab]);

  // Selected entity details
  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return null;
    if (activeTab === 'customer') {
      return customers.find((c) => c.id === selectedEntityId) || null;
    }
    return suppliers.find((s) => s.id === selectedEntityId) || null;
  }, [selectedEntityId, activeTab, customers, suppliers]);

  const selectedEntityDebtInfo = useMemo(() => {
    if (!selectedEntityId) return null;
    if (activeTab === 'customer') {
      return customerDebtsSummary.find((c) => c.id === selectedEntityId) || null;
    }
    return supplierDebtsSummary.find((s) => s.id === selectedEntityId) || null;
  }, [selectedEntityId, activeTab, customerDebtsSummary, supplierDebtsSummary]);

  // Filtered entities for the smart search modal
  const modalFilteredEntities = useMemo(() => {
    const list = activeTab === 'customer' ? customerDebtsSummary : supplierDebtsSummary;
    return list.filter((item) => {
      if (modalDebtOnly && item.currentDebt <= 0) return false;
      if (!modalSearchTerm.trim()) return true;
      const q = modalSearchTerm.toLowerCase().trim();
      return (
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.taxCode && item.taxCode.toLowerCase().includes(q)) ||
        (item.phone && item.phone.toLowerCase().includes(q))
      );
    });
  }, [activeTab, customerDebtsSummary, supplierDebtsSummary, modalDebtOnly, modalSearchTerm]);

  // Detail history for selected entity
  const detailHistory = useMemo(() => {
    if (!selectedEntityId || !selectedEntity) return [];

    const timeline: any[] = [];

    if (activeTab === 'customer') {
      const custOrders = orders.filter(
        (o) =>
          (o.customerId === selectedEntityId ||
            (o.customerCode && o.customerCode.trim().toLowerCase() === selectedEntity.code.trim().toLowerCase())) &&
          o.deliveryStatus !== 'cancelled'
      );
      custOrders.forEach((o) => {
        timeline.push({
          type: 'order',
          date: o.orderDate,
          code: o.orderCode,
          description: `Đơn hàng bán: ${o.orderCode} (${o.items.length} mặt hàng)`,
          increase: o.totalAmount, // Increases debt
          decrease: o.paidAmount, // Immediate payment decreases debt
          debtDelta: o.debtAmount,
        });
      });

      const payments = debtPayments.filter(
        (dp) =>
          dp.type === 'customer' &&
          (dp.entityId === selectedEntityId ||
            (dp.entityCode && dp.entityCode.trim().toLowerCase() === selectedEntity.code.trim().toLowerCase()))
      );
      payments.forEach((p) => {
        timeline.push({
          type: 'payment',
          date: p.date,
          code: p.code,
          description: `Thu nợ: ${p.notes || 'Phiếu thu công nợ'} (${p.paymentMethod})`,
          increase: 0,
          decrease: p.amount,
          debtDelta: -p.amount,
          paymentId: p.id,
        });
      });
    } else {
      const supPurchases = purchases.filter(
        (p) =>
          (p.supplierCode && p.supplierCode.trim().toLowerCase() === selectedEntity.code.trim().toLowerCase()) ||
          (p.supplierTaxCode && selectedEntity.taxCode && p.supplierTaxCode.trim() === selectedEntity.taxCode.trim()) ||
          ((p as any).supplierId === selectedEntityId)
      );
      supPurchases.forEach((p) => {
        timeline.push({
          type: 'purchase',
          date: p.purchaseDate,
          code: p.billNo,
          description: `Phiếu nhập hàng: ${p.billNo} (${p.items.length} mặt hàng)`,
          increase: p.totalAmount,
          decrease: p.paidAmount,
          debtDelta: p.totalAmount - p.paidAmount,
        });
      });

      const payments = debtPayments.filter(
        (dp) =>
          dp.type === 'supplier' &&
          (dp.entityId === selectedEntityId ||
            (dp.entityCode && dp.entityCode.trim().toLowerCase() === selectedEntity.code.trim().toLowerCase()))
      );
      payments.forEach((p) => {
        timeline.push({
          type: 'payment',
          date: p.date,
          code: p.code,
          description: `Chi trả nợ NCC: ${p.notes || 'Phiếu chi trả nợ'} (${p.paymentMethod})`,
          increase: 0,
          decrease: p.amount,
          debtDelta: -p.amount,
          paymentId: p.id,
        });
      });
    }

    const filteredTimeline = timeline.filter(
      (item) => (!startDate || item.date >= startDate) && (!endDate || item.date <= endDate)
    );
    return filteredTimeline.sort((a, b) => b.date.localeCompare(a.date));
  }, [activeTab, selectedEntityId, selectedEntity, orders, purchases, debtPayments, startDate, endDate]);

  // Handle Excel Export for Summary Debts (Công nợ tổng hợp)
  const handleExportSummaryDebt = () => {
    if (filteredSummaryList.length === 0) {
      alert('Không có dữ liệu công nợ phù hợp để xuất Excel.');
      return;
    }
    exportDebtSummaryToExcel(activeTab, filteredSummaryList, startDate, endDate);
  };

  // Handle Excel Export for Detailed Debt of a specific entity (Công nợ chi tiết từng đối tượng)
  const handleExportEntityDebt = (entityId: string) => {
    const isCustomer = activeTab === 'customer';
    const entity = isCustomer
      ? customers.find((c) => c.id === entityId)
      : suppliers.find((s) => s.id === entityId);

    if (!entity) return;

    const summary = isCustomer
      ? customerDebtsSummary.find((c) => c.id === entityId)
      : supplierDebtsSummary.find((s) => s.id === entityId);

    if (!summary) return;

    // Build timeline for this specific entity
    const timeline: any[] = [];

    if (isCustomer) {
      const custOrders = orders.filter(
        (o) =>
          (o.customerId === entityId ||
            (o.customerCode && o.customerCode.trim().toLowerCase() === entity.code.trim().toLowerCase())) &&
          o.deliveryStatus !== 'cancelled'
      );
      custOrders.forEach((o) => {
        timeline.push({
          type: 'order',
          date: o.orderDate,
          code: o.orderCode,
          description: `Đơn hàng bán: ${o.orderCode} (${o.items.length} mặt hàng)`,
          increase: o.totalAmount,
          decrease: o.paidAmount,
          debtDelta: o.debtAmount,
        });
      });

      const payments = debtPayments.filter(
        (dp) =>
          dp.type === 'customer' &&
          (dp.entityId === entityId ||
            (dp.entityCode && dp.entityCode.trim().toLowerCase() === entity.code.trim().toLowerCase()))
      );
      payments.forEach((p) => {
        timeline.push({
          type: 'payment',
          date: p.date,
          code: p.code,
          description: `Thu nợ: ${p.notes || 'Phiếu thu công nợ'} (${p.paymentMethod})`,
          increase: 0,
          decrease: p.amount,
          debtDelta: -p.amount,
          paymentId: p.id,
        });
      });
    } else {
      const supPurchases = purchases.filter(
        (p) =>
          (p.supplierCode && p.supplierCode.trim().toLowerCase() === entity.code.trim().toLowerCase()) ||
          (p.supplierTaxCode && entity.taxCode && p.supplierTaxCode.trim() === entity.taxCode.trim()) ||
          ((p as any).supplierId === entityId)
      );
      supPurchases.forEach((p) => {
        timeline.push({
          type: 'purchase',
          date: p.purchaseDate,
          code: p.billNo,
          description: `Phiếu nhập hàng: ${p.billNo} (${p.items.length} mặt hàng)`,
          increase: p.totalAmount,
          decrease: p.paidAmount,
          debtDelta: p.totalAmount - p.paidAmount,
        });
      });

      const payments = debtPayments.filter(
        (dp) =>
          dp.type === 'supplier' &&
          (dp.entityId === entityId ||
            (dp.entityCode && dp.entityCode.trim().toLowerCase() === entity.code.trim().toLowerCase()))
      );
      payments.forEach((p) => {
        timeline.push({
          type: 'payment',
          date: p.date,
          code: p.code,
          description: `Chi trả nợ NCC: ${p.notes || 'Phiếu chi trả nợ'} (${p.paymentMethod})`,
          increase: 0,
          decrease: p.amount,
          debtDelta: -p.amount,
          paymentId: p.id,
        });
      });
    }

    const filteredTimeline = timeline.filter(
      (item) => (!startDate || item.date >= startDate) && (!endDate || item.date <= endDate)
    );

    exportEntityDebtDetailToExcel(
      activeTab,
      entity,
      summary,
      filteredTimeline,
      startDate,
      endDate
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Quản lý Công nợ Phải thu & Phải trả
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Theo dõi công nợ tổng hợp, chi tiết lịch sử mua bán và phiếu thu/chi trả nợ
          </p>
        </div>

        {/* Payment Button */}
        <button
          type="button"
          onClick={() => {
            setPreSelectedId(selectedEntityId || undefined);
            setIsPaymentModalOpen(true);
          }}
          className={`inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-white font-bold text-sm sm:text-base shadow-lg transition-all cursor-pointer ${
            activeTab === 'customer'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 shadow-blue-500/25'
              : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 shadow-teal-500/25'
          }`}
        >
          <Plus className="w-5 h-5" />
          <span>{activeTab === 'customer' ? 'THU TIỀN NỢ KHÁCH HÀNG' : 'CHI TRẢ TIỀN NỢ NCC'}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={() => {
            setActiveTab('customer');
            setSelectedEntityId(null);
          }}
          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
            activeTab === 'customer'
              ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Công nợ Khách hàng (Phải thu)
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                {formatCurrency(totalCustomerDebt)}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('customer');
                setSelectedEntityId(null);
                setDebtFilterMode((prev) => (prev === 'has_debt' && activeTab === 'customer' ? 'all' : 'has_debt'));
              }}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'customer' && debtFilterMode === 'has_debt'
                  ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400'
                  : 'bg-blue-100 hover:bg-blue-200 text-blue-800'
              }`}
              title="Nhấn để lọc nhanh các khách hàng còn dư nợ"
            >
              {customerDebtCounts.hasDebt} khách còn nợ
            </button>
          </div>
        </div>

        <div
          onClick={() => {
            setActiveTab('supplier');
            setSelectedEntityId(null);
          }}
          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
            activeTab === 'supplier'
              ? 'bg-teal-50/70 border-teal-500 shadow-md ring-2 ring-teal-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                Công nợ Nhà cung cấp (Phải trả)
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                {formatCurrency(totalSupplierDebt)}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('supplier');
                setSelectedEntityId(null);
                setDebtFilterMode((prev) => (prev === 'has_debt' && activeTab === 'supplier' ? 'all' : 'has_debt'));
              }}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'supplier' && debtFilterMode === 'has_debt'
                  ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400'
                  : 'bg-teal-100 hover:bg-teal-200 text-teal-800'
              }`}
              title="Nhấn để lọc nhanh các nhà cung cấp còn dư nợ"
            >
              {supplierDebtCounts.hasDebt} NCC còn nợ
            </button>
          </div>
        </div>
      </div>

      {/* View Switch, Date Filter & Excel Import Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Buttons */}
          <button
            type="button"
            onClick={() => {
              setViewMode('summary');
              setSelectedEntityId(null);
            }}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              viewMode === 'summary'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tổng hợp Công nợ
          </button>
          <button
            type="button"
            onClick={() => setViewMode('detail')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              viewMode === 'detail'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Chi tiết Lịch sử
          </button>

          <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Date range filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-600">Từ:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-0.5 border border-slate-300 rounded text-xs bg-white font-medium"
            />
            <span className="font-semibold text-slate-600">Đến:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-0.5 border border-slate-300 rounded text-xs bg-white font-medium"
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Debt Filter Pills for Summary View */}
          {viewMode === 'summary' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDebtFilterMode('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  debtFilterMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({activeTab === 'customer' ? customerDebtCounts.total : supplierDebtCounts.total})
              </button>
              <button
                type="button"
                onClick={() => setDebtFilterMode('has_debt')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  debtFilterMode === 'has_debt'
                    ? 'bg-rose-600 text-white shadow-xs font-bold'
                    : 'text-rose-700 hover:bg-rose-100/50'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                Chỉ còn nợ ({activeTab === 'customer' ? customerDebtCounts.hasDebt : supplierDebtCounts.hasDebt})
              </button>
              <button
                type="button"
                onClick={() => setDebtFilterMode('zero_debt')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  debtFilterMode === 'zero_debt'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-emerald-700 hover:bg-emerald-100/50'
                }`}
              >
                Đã hết nợ ({activeTab === 'customer' ? customerDebtCounts.zeroDebt : supplierDebtCounts.zeroDebt})
              </button>
            </div>
          )}

          {/* Excel Export Summary Debt */}
          {viewMode === 'summary' && (
            <button
              type="button"
              onClick={handleExportSummaryDebt}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer transition-all"
              title={`Xuất ${filteredSummaryList.length} dòng công nợ tổng hợp ra file Excel`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel công nợ tổng hợp</span>
            </button>
          )}

          {/* Excel Export Detail for current entity */}
          {viewMode === 'detail' && selectedEntityId && (
            <button
              type="button"
              onClick={() => handleExportEntityDebt(selectedEntityId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer transition-all"
              title="Xuất chi tiết lịch sử công nợ của đối tượng này ra file Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel chi tiết</span>
            </button>
          )}

          {/* Excel Import for Debts */}
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{activeTab === 'customer' ? 'Nhập Excel Thu nợ KH' : 'Nhập Excel Chi trả NCC'}</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleExcelImportDebts}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={activeTab === 'customer' ? downloadCustomerDebtTemplate : downloadSupplierDebtTemplate}
            className="text-xs text-slate-500 hover:text-indigo-600 underline cursor-pointer"
          >
            Tải mẫu Excel
          </button>

          {/* Search */}
          <div className="relative w-48 sm:w-60">
            <input
              type="text"
              placeholder="Tìm theo Mã, Tên, MST, SĐT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 border border-slate-300 rounded-xl text-xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'summary' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] sm:text-xs">
                <tr>
                  <th className="p-3 w-10 text-center">STT</th>
                  <th className="p-3">{activeTab === 'customer' ? 'Mã KH' : 'Mã NCC'}</th>
                  <th className="p-3 min-w-44">{activeTab === 'customer' ? 'Tên Khách hàng' : 'Tên Nhà cung cấp'}</th>
                  <th className="p-3">Mã số thuế</th>
                  <th className="p-3">Số điện thoại</th>
                  <th className="p-3 text-right">
                    {activeTab === 'customer' ? 'Tổng tiền bán' : 'Tổng tiền nhập'}
                  </th>
                  <th className="p-3 text-right text-emerald-700">Đã thanh toán</th>
                  <th className="p-3 text-right text-rose-700 font-black">Công nợ còn lại</th>
                  <th className="p-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummaryList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400">
                      <div className="max-w-md mx-auto space-y-2">
                        <p className="font-semibold text-slate-600">
                          Không tìm thấy {activeTab === 'customer' ? 'khách hàng' : 'nhà cung cấp'} nào phù hợp với bộ lọc hiện tại.
                        </p>
                        <p className="text-xs text-slate-400">
                          Thử xóa từ khóa tìm kiếm hoặc đổi sang xem tất cả đối tượng.
                        </p>
                        {(searchTerm || debtFilterMode !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchTerm('');
                              setDebtFilterMode('all');
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Xóa bộ lọc & Đặt lại</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSummaryList.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-blue-700">{row.code}</td>
                      <td className="p-3 font-semibold text-slate-900">{row.name}</td>
                      <td className="p-3 font-mono text-slate-600">{row.taxCode || '—'}</td>
                      <td className="p-3 text-slate-700">{row.phone || '—'}</td>
                      <td className="p-3 text-right font-medium text-slate-800">
                        {formatCurrency(activeTab === 'customer' ? (row as any).totalSales : (row as any).totalPurchases)}
                      </td>
                      <td className="p-3 text-right font-semibold text-emerald-600">
                        {formatCurrency(row.totalPaid)}
                      </td>
                      <td className="p-3 text-right font-black">
                        {row.currentDebt > 0 ? (
                          <span className="text-rose-600">{formatCurrency(row.currentDebt)}</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">0 đ</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEntityId(row.id);
                              setViewMode('detail');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors"
                          >
                            Xem chi tiết
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportEntityDebt(row.id)}
                            className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer transition-colors"
                            title={`Xuất sổ công nợ chi tiết của ${row.name} ra Excel`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPreSelectedId(row.id);
                              setIsPaymentModalOpen(true);
                            }}
                            className={`px-2.5 py-1 text-xs font-bold text-white rounded-lg shadow-xs cursor-pointer transition-all ${
                              activeTab === 'customer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-teal-600 hover:bg-teal-700'
                            }`}
                          >
                            {activeTab === 'customer' ? 'Thu nợ' : 'Trả nợ'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredSummaryList.length > 0 && (
                <tfoot className="bg-slate-100/90 text-slate-800 font-bold border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={5} className="p-3 text-right uppercase text-xs tracking-wider font-extrabold text-slate-700">
                      Tổng cộng ({filteredSummaryList.length} {activeTab === 'customer' ? 'khách hàng' : 'nhà cung cấp'}):
                    </td>
                    <td className="p-3 text-right font-black text-slate-900 text-sm">
                      {formatCurrency(summaryTotals.totalAmount)}
                    </td>
                    <td className="p-3 text-right font-black text-emerald-700 text-sm">
                      {formatCurrency(summaryTotals.totalPaid)}
                    </td>
                    <td className="p-3 text-right font-black text-rose-700 text-sm">
                      {formatCurrency(summaryTotals.totalDebt)}
                    </td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* Detail View with Smart Search Window */
        <div className="space-y-4">
          {!selectedEntityId ? (
            /* Prompt to open Smart Search Window */
            <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-blue-50/40 to-indigo-50/40 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Chọn {activeTab === 'customer' ? 'Khách hàng' : 'Nhà cung cấp'} để xem chi tiết công nợ
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mở cửa sổ tìm kiếm thông minh theo Mã, Tên, Mã số thuế, SĐT với hiển thị số dư nợ trực quan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalSearchTerm('');
                  setModalDebtOnly(false);
                  setIsSearchModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition-all shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>Mở cửa sổ tìm kiếm thông minh</span>
              </button>
            </div>
          ) : (
            /* Selected Entity Card with Smart Change Trigger */
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-xs shrink-0 ${
                    activeTab === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'
                  }`}
                >
                  {activeTab === 'customer' ? <Users className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-xs">
                      {selectedEntity?.code}
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">{selectedEntity?.name}</h2>
                    {selectedEntityDebtInfo && (
                      selectedEntityDebtInfo.currentDebt > 0 ? (
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                          Còn nợ: {formatCurrency(selectedEntityDebtInfo.currentDebt)}
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Đã hết nợ (0 đ)
                        </span>
                      )
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {selectedEntity?.taxCode && (
                      <span>
                        MST: <strong className="font-mono text-slate-700">{selectedEntity.taxCode}</strong>
                      </span>
                    )}
                    {selectedEntity?.phone && (
                      <span>
                        SĐT: <strong className="font-mono text-slate-700">{selectedEntity.phone}</strong>
                      </span>
                    )}
                    {selectedEntity?.address && (
                      <span className="text-slate-600 line-clamp-1">Đ/C: {selectedEntity.address}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleExportEntityDebt(selectedEntityId)}
                  className="px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Xuất toàn bộ sổ chi tiết công nợ của đối tượng này ra file Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Xuất Excel chi tiết</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalSearchTerm('');
                    setModalDebtOnly(false);
                    setIsSearchModalOpen(true);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Mở cửa sổ tìm kiếm để đổi sang đối tượng khác"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Đổi đối tượng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEntityId(null)}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-all cursor-pointer"
                  title="Bỏ chọn đối tượng"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreSelectedId(selectedEntityId);
                    setIsPaymentModalOpen(true);
                  }}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'customer'
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                      : 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>{activeTab === 'customer' ? 'Lập phiếu thu nợ' : 'Lập phiếu trả nợ'}</span>
                </button>
              </div>
            </div>
          )}

          {!selectedEntityId ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
              <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">Vui lòng bấm nút mở cửa sổ tìm kiếm ở trên để chọn đối tượng xem chi tiết lịch sử.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-800">
                    Lịch sử phát sinh công nợ & thanh toán ({detailHistory.length} giao dịch)
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleExportEntityDebt(selectedEntityId)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer transition-colors shadow-2xs"
                    title="Xuất file Excel sổ chi tiết công nợ này"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất Excel</span>
                  </button>
                </div>
                {selectedEntityDebtInfo && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-600">
                      Tổng phát sinh: <strong className="text-slate-900">{formatCurrency('totalSales' in selectedEntityDebtInfo ? selectedEntityDebtInfo.totalSales : selectedEntityDebtInfo.totalPurchases)}</strong>
                    </span>
                    <span className="text-slate-600">
                      Đã thanh toán: <strong className="text-emerald-700">{formatCurrency(selectedEntityDebtInfo.totalPaid)}</strong>
                    </span>
                    <span className="text-slate-600">
                      Dư nợ: <strong className={selectedEntityDebtInfo.currentDebt > 0 ? 'text-rose-700 font-black' : 'text-emerald-700 font-bold'}>{formatCurrency(selectedEntityDebtInfo.currentDebt)}</strong>
                    </span>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] sm:text-xs">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">Ngày</th>
                      <th className="p-3">Số chứng từ</th>
                      <th className="p-3">Diễn giải</th>
                      <th className="p-3 text-right text-slate-900">Phát sinh nợ (+)</th>
                      <th className="p-3 text-right text-emerald-600">Đã thanh toán (-)</th>
                      <th className="p-3 text-center w-16">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          Chưa có giao dịch phát sinh nào trong khoảng thời gian đã chọn.
                        </td>
                      </tr>
                    ) : (
                      detailHistory.map((item, idx) => (
                        <tr key={`${item.code}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-3 text-slate-600">{formatDate(item.date)}</td>
                          <td className="p-3 font-mono font-bold text-blue-700">{item.code}</td>
                          <td className="p-3 text-slate-800 font-medium">{item.description}</td>
                          <td className="p-3 text-right font-bold text-slate-900">
                            {item.increase > 0 ? formatCurrency(item.increase) : '—'}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-600">
                            {item.decrease > 0 ? formatCurrency(item.decrease) : '—'}
                          </td>
                          <td className="p-3 text-center">
                            {item.paymentId ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Xác nhận xóa phiếu thanh toán',
                                    message: 'Bạn có chắc chắn muốn xóa phiếu thanh toán này?',
                                    confirmText: 'Xóa phiếu',
                                    type: 'danger',
                                  });
                                  if (ok) {
                                    onDeleteDebtPayment(item.paymentId);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                                title="Xóa phiếu thanh toán"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {detailHistory.length > 0 && (
                    <tfoot className="bg-slate-100 font-bold border-t border-slate-200 text-slate-800">
                      <tr>
                        <td colSpan={4} className="p-3 text-right uppercase text-xs">
                          Tổng cộng ({detailHistory.length} giao dịch):
                        </td>
                        <td className="p-3 text-right text-slate-900 font-black">
                          {formatCurrency(detailHistory.reduce((sum, item) => sum + item.increase, 0))}
                        </td>
                        <td className="p-3 text-right text-emerald-700 font-black">
                          {formatCurrency(detailHistory.reduce((sum, item) => sum + item.decrease, 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Smart Search Window Dialog for Entity Selection */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl text-white ${
                  activeTab === 'customer' ? 'bg-blue-600' : 'bg-teal-600'
                }`}>
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900">
                    Tìm kiếm & Chọn {activeTab === 'customer' ? 'Khách hàng' : 'Nhà cung cấp'} thông minh
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tra cứu nhanh theo Mã, Tên, Mã số thuế, Số điện thoại và xem trực tiếp dư nợ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar & Filters */}
            <div className="p-4 border-b border-slate-200 bg-white space-y-3">
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  placeholder={`Nhập Mã, Tên, MST hoặc SĐT của ${activeTab === 'customer' ? 'khách hàng' : 'nhà cung cấp'}...`}
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm font-medium transition-all"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                {modalSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setModalSearchTerm('')}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-3 top-2.5 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalDebtOnly(false)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    !modalDebtOnly
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({activeTab === 'customer' ? customerDebtCounts.total : supplierDebtCounts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setModalDebtOnly(true)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    modalDebtOnly
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Chỉ đối tượng còn nợ ({activeTab === 'customer' ? customerDebtCounts.hasDebt : supplierDebtCounts.hasDebt})
                </button>
              </div>
            </div>

            {/* Modal Results List */}
            <div className="overflow-y-auto p-4 flex-1 divide-y divide-slate-100">
              {modalFilteredEntities.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600">Không tìm thấy đối tượng nào</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Không có kết quả khớp với từ khóa "{modalSearchTerm}".
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setModalSearchTerm('');
                      setModalDebtOnly(false);
                    }}
                    className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Xem tất cả danh sách
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {modalFilteredEntities.map((ent, idx) => {
                    const isSelected = selectedEntityId === ent.id;
                    return (
                      <div
                        key={ent.id}
                        onClick={() => {
                          setSelectedEntityId(ent.id);
                          setIsSearchModalOpen(false);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/70 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-blue-700 text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                {ent.code}
                              </span>
                              <span className="font-bold text-slate-900 text-sm">{ent.name}</span>
                              {isSelected && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                                  Đang chọn
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                              {ent.taxCode && (
                                <span>
                                  MST: <strong className="font-mono text-slate-700">{ent.taxCode}</strong>
                                </span>
                              )}
                              {ent.phone && (
                                <span>
                                  SĐT: <strong className="font-mono text-slate-700">{ent.phone}</strong>
                                </span>
                              )}
                              {ent.address && (
                                <span className="line-clamp-1 text-slate-500 max-w-xs">{ent.address}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="text-right">
                            <div className="text-[11px] text-slate-400 font-medium">Dư nợ hiện tại:</div>
                            <div className={`text-sm font-black ${
                              ent.currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600'
                            }`}>
                              {formatCurrency(ent.currentDebt)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEntityId(ent.id);
                              setIsSearchModalOpen(false);
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-900 hover:bg-blue-600 text-white shadow-xs'
                            }`}
                          >
                            {isSelected ? 'Đang chọn' : 'Chọn'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <span>Hiển thị {modalFilteredEntities.length} kết quả</span>
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(false)}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-300 rounded-xl cursor-pointer transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <DebtPaymentModal
          type={activeTab}
          customers={customers}
          suppliers={suppliers}
          preSelectedEntityId={preSelectedId}
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onSavePayment={onSaveDebtPayment}
        />
      )}
    </div>
  );
};
