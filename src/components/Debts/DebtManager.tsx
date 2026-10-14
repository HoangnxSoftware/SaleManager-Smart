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
  Calendar,
  CheckCircle2,
  Trash2,
  Upload,
  Download,
  X
} from 'lucide-react';
import {
  parseExcelFile,
  downloadCustomerDebtTemplate,
  downloadSupplierDebtTemplate,
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
      // Sum order amounts and order paid
      const custOrders = orders.filter(
        (o) =>
          o.customerId === c.id &&
          o.deliveryStatus !== 'cancelled' &&
          (!startDate || o.orderDate >= startDate) &&
          (!endDate || o.orderDate <= endDate)
      );
      const totalOrderAmount = custOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const totalOrderPaid = custOrders.reduce((sum, o) => sum + o.paidAmount, 0);

      // Sum debt payments
      const directPayments = debtPayments
        .filter(
          (dp) =>
            dp.type === 'customer' &&
            dp.entityId === c.id &&
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
          p.supplierCode === s.code &&
          (!startDate || p.purchaseDate >= startDate) &&
          (!endDate || p.purchaseDate <= endDate)
      );
      const totalPurchaseAmount = supPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
      const totalPurchasePaid = supPurchases.reduce((sum, p) => sum + p.paidAmount, 0);

      const directPayments = debtPayments
        .filter(
          (dp) =>
            dp.type === 'supplier' &&
            dp.entityId === s.id &&
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

  // Detail history for selected entity
  const detailHistory = useMemo(() => {
    if (!selectedEntityId) return [];

    const timeline: any[] = [];

    if (activeTab === 'customer') {
      const custOrders = orders.filter(
        (o) => o.customerId === selectedEntityId && o.deliveryStatus !== 'cancelled'
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
        (dp) => dp.type === 'customer' && dp.entityId === selectedEntityId
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
      const sup = suppliers.find((s) => s.id === selectedEntityId);
      if (sup) {
        const supPurchases = purchases.filter((p) => p.supplierCode === sup.code);
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
          (dp) => dp.type === 'supplier' && dp.entityId === selectedEntityId
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
    }

    const filteredTimeline = timeline.filter(
      (item) => (!startDate || item.date >= startDate) && (!endDate || item.date <= endDate)
    );
    return filteredTimeline.sort((a, b) => b.date.localeCompare(a.date));
  }, [activeTab, selectedEntityId, orders, purchases, debtPayments, suppliers, startDate, endDate]);

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
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
              {customerDebtsSummary.filter((c) => c.currentDebt > 0).length} khách còn nợ
            </span>
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
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-100 text-teal-800">
              {supplierDebtsSummary.filter((s) => s.currentDebt > 0).length} NCC còn nợ
            </span>
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
              placeholder="Tìm theo Mã hoặc Tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
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
                {(activeTab === 'customer' ? customerDebtsSummary : supplierDebtsSummary)
                  .filter((item) =>
                    !searchTerm.trim() ||
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.code.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
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
                      <td className="p-3 text-right font-black text-rose-600">
                        {formatCurrency(row.currentDebt)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEntityId(row.id);
                              setViewMode('detail');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                          >
                            Xem chi tiết
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPreSelectedId(row.id);
                              setIsPaymentModalOpen(true);
                            }}
                            className={`px-2.5 py-1 text-xs font-bold text-white rounded-lg shadow-xs cursor-pointer ${
                              activeTab === 'customer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-teal-600 hover:bg-teal-700'
                            }`}
                          >
                            {activeTab === 'customer' ? 'Thu nợ' : 'Trả nợ'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Detail View */
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 uppercase">
                Chọn đối tượng xem chi tiết:
              </label>
              <select
                value={selectedEntityId || ''}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white font-medium"
              >
                <option value="">-- Chọn {activeTab === 'customer' ? 'Khách hàng' : 'Nhà cung cấp'} --</option>
                {(activeTab === 'customer' ? customers : suppliers).map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.name} ({ent.code})
                  </option>
                ))}
              </select>
            </div>

            {selectedEntityId && (
              <button
                type="button"
                onClick={() => {
                  setPreSelectedId(selectedEntityId);
                  setIsPaymentModalOpen(true);
                }}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs cursor-pointer ${
                  activeTab === 'customer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                + Lập phiếu thu / chi nợ cho đối tượng này
              </button>
            )}
          </div>

          {!selectedEntityId ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
              Vui lòng chọn một đối tượng ở trên để xem chi tiết lịch sử mua bán, trả nợ và số dư công nợ lũy kế.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-800">
                  Lịch sử phát sinh công nợ & thanh toán ({detailHistory.length} giao dịch)
                </h3>
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
                    {detailHistory.map((item, idx) => (
                      <tr key={`${item.code}-${idx}`} className="hover:bg-slate-50/70">
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
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Xóa phiếu thanh toán"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
