import React, { useState, useMemo } from 'react';
import { Order, OrderCodeRule, Product, Customer } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { formatOrderCode, extractSequenceNumber } from '../../services/orderCodeService';
import { CodeSyncDetail } from '../../services/codeSyncService';
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
  ArrowRightLeft
} from 'lucide-react';

interface OrderImportCheckModalProps {
  isOpen: boolean;
  importedOrders: Order[];
  existingOrders: Order[];
  rules: OrderCodeRule[];
  defaultRuleId?: string;
  productSyncList?: CodeSyncDetail[];
  customerSyncList?: CodeSyncDetail[];
  onConfirmImport: (finalOrders: Order[]) => void;
  onCancel: () => void;
}

export const OrderImportCheckModal: React.FC<OrderImportCheckModalProps> = ({
  isOpen,
  importedOrders,
  existingOrders,
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
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'customers'>('orders');

  // Search & Filters for Products tab
  const [productSearch, setProductSearch] = useState('');
  const [productFilterStatus, setProductFilterStatus] = useState<'all' | 'adjusted' | 'exact' | 'missing'>('all');

  // Search & Filters for Customers tab
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilterStatus, setCustomerFilterStatus] = useState<'all' | 'adjusted' | 'exact' | 'missing'>('all');

  // Counts
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

  const hasAnySyncWarning =
    adjustedProductCount > 0 ||
    missingProductCount > 0 ||
    adjustedCustomerCount > 0 ||
    missingCustomerCount > 0;

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

  // Filtered Products List
  const filteredProductSyncList = useMemo(() => {
    return productSyncList.filter((item) => {
      // Status filter
      if (productFilterStatus === 'adjusted' && !item.isAdjusted) return false;
      if (productFilterStatus === 'exact' && (item.isAdjusted || item.status !== 'exact_matched')) return false;
      if (productFilterStatus === 'missing' && item.status !== 'not_in_catalog') return false;

      // Search
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

  // Filtered Customers List
  const filteredCustomerSyncList = useMemo(() => {
    return customerSyncList.filter((item) => {
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

  if (!isOpen) return null;

  const totalAmountSum = computedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalItemsSum = computedOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-900/85 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Kiểm tra & Cảnh báo đồng bộ dữ liệu đơn hàng Excel
              </h2>
              <p className="text-blue-100 text-xs">
                Tự động chuẩn hóa mã sản phẩm, mã khách hàng (loại bỏ dấu cách, viết hoa) & đánh lại số đơn theo thứ tự
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
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-blue-700 uppercase">Số lượng đơn hàng</div>
              <div className="text-xl font-black text-blue-900 mt-0.5">{computedOrders.length}</div>
            </div>
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-indigo-700 uppercase">Tổng mặt hàng</div>
              <div className="text-xl font-black text-indigo-900 mt-0.5">{totalItemsSum}</div>
            </div>
            <div className={`p-3 rounded-xl text-center border ${adjustedProductCount > 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
              <div className="text-[11px] font-semibold uppercase">Đồng bộ Mã hàng hóa</div>
              <div className="text-xl font-black text-emerald-700 mt-0.5 flex items-center justify-center gap-1">
                <span>{productSyncList.length}</span>
                {adjustedProductCount > 0 && (
                  <span className="text-xs bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded-full font-bold">
                    +{adjustedProductCount} đã sửa
                  </span>
                )}
              </div>
            </div>
            <div className={`p-3 rounded-xl text-center border ${adjustedCustomerCount > 0 ? 'bg-violet-50 border-violet-300 text-violet-900' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
              <div className="text-[11px] font-semibold uppercase">Đồng bộ Mã khách hàng</div>
              <div className="text-xl font-black text-violet-700 mt-0.5 flex items-center justify-center gap-1">
                <span>{customerSyncList.length}</span>
                {adjustedCustomerCount > 0 && (
                  <span className="text-xs bg-violet-200 text-violet-900 px-1.5 py-0.5 rounded-full font-bold">
                    +{adjustedCustomerCount} đã sửa
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* CẢNH BÁO ĐỒNG BỘ MÃ HÀNG HÓA & MÃ KHÁCH HÀNG (PROMINENT WARNING BANNER) */}
          {hasAnySyncWarning && (
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 border border-amber-300 rounded-2xl shadow-xs space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                    CẢNH BÁO ĐỒNG BỘ MÃ SẢN PHẨM & MÃ KHÁCH HÀNG TỰ ĐỘNG
                  </h4>
                  <p className="text-slate-700 text-xs mt-0.5 leading-relaxed">
                    Hệ thống đã tự động xử lý loại bỏ dấu cách thừa và viết hoa các mã chưa đồng bộ trong file Excel để khớp chính xác với danh mục trong phần mềm (ví dụ: mã <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 text-amber-900 font-bold">"TBD-Keg2 "</span> đã được tự động chuẩn hóa thành <span className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-900 font-bold">"TBD-KEG2"</span>).
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60 text-xs">
                {adjustedProductCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('products')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold border border-emerald-300 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{adjustedProductCount} mã hàng hóa đã chuẩn hóa</span>
                  </button>
                )}
                {missingProductCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('products')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold border border-rose-300 transition-colors cursor-pointer"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                    <span>{missingProductCount} mã hàng hóa chưa có trong DM</span>
                  </button>
                )}
                {adjustedCustomerCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-900 font-bold border border-violet-300 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-700" />
                    <span>{adjustedCustomerCount} mã khách hàng đã chuẩn hóa</span>
                  </button>
                )}
                {missingCustomerCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold border border-amber-300 transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                    <span>{missingCustomerCount} mã khách hàng chưa có trong DM</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-500 italic ml-auto">
                  Nhấp vào các thẻ tab bên dưới để kiểm tra chi tiết từng mã
                </span>
              </div>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer inline-flex items-center gap-2 ${
                activeTab === 'orders'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>1. Xem trước Đơn hàng ({computedOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer inline-flex items-center gap-2 ${
                activeTab === 'products'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>2. Đồng bộ Mã hàng hóa ({productSyncList.length})</span>
              {adjustedProductCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white font-black">
                  {adjustedProductCount} đã sửa
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer inline-flex items-center gap-2 ${
                activeTab === 'customers'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>3. Đồng bộ Mã khách hàng ({customerSyncList.length})</span>
              {adjustedCustomerCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-violet-500 text-white font-black">
                  {adjustedCustomerCount} đã sửa
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: ORDERS PREVIEW & RULE SELECTION */}
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

                <p className="text-[11px] text-slate-600 italic">
                  {codeMode === 'rule'
                    ? '★ Phần mềm tự động sắp xếp đơn hàng theo ngày tháng tăng dần và đánh lại số thứ tự tiếp nối liên tục (tránh trùng lặp đơn hàng).'
                    : 'Lưu ý: Giữ nguyên mã đơn từ Excel có thể gây trùng lặp nếu mã đã tồn tại trong phần mềm.'}
                </p>
              </div>

              {/* Duplicate warning if any */}
              {duplicateCodeSet.size > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Cảnh báo trùng mã: </span>
                    Phát hiện {duplicateCodeSet.size} mã đơn trùng với cơ sở dữ liệu hiện tại (các dòng viền đỏ bên dưới). Khuyến nghị chuyển sang <strong>"Áp dụng Quy tắc tạo mã"</strong> để tự động đánh lại số thứ tự tăng dần an toàn.
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
                  <span>Xem trước danh sách {computedOrders.length} đơn hàng sẽ nhập:</span>
                  <span className="text-[11px] text-slate-500 font-normal">Sắp xếp theo thứ tự ngày tăng dần</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="p-2.5 text-center">STT</th>
                        <th className="p-2.5">Mã đơn Excel</th>
                        <th className="p-2.5">Mã đơn áp dụng</th>
                        <th className="p-2.5">Ngày đặt</th>
                        <th className="p-2.5">Khách hàng</th>
                        <th className="p-2.5 text-center">Số MH</th>
                        <th className="p-2.5">Mã hàng trong đơn</th>
                        <th className="p-2.5 text-right">Tổng tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {computedOrders.map((ord, idx) => {
                        const original = importedOrders.find((io) => io.id === ord.id);
                        const isDupe = duplicateCodeSet.has(ord.orderCode.trim().toUpperCase());
                        const isCodeChanged = original && original.orderCode !== ord.orderCode;

                        return (
                          <tr
                            key={ord.id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isDupe ? 'bg-rose-50/80 border-l-4 border-l-rose-600' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                            }`}
                          >
                            <td className="p-2.5 font-semibold text-slate-500 text-center">{idx + 1}</td>
                            <td className="p-2.5 font-mono text-slate-500">
                              {original?.orderCode || '—'}
                            </td>
                            <td className="p-2.5 font-mono font-bold">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${
                                  isDupe
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300 font-black'
                                    : isCodeChanged
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {ord.orderCode}
                                {isDupe && <span className="text-[10px] text-rose-700">(TRÙNG)</span>}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-700 whitespace-nowrap">{formatDate(ord.orderDate)}</td>
                            <td className="p-2.5 text-slate-800 max-w-xs">
                              <div className="font-semibold truncate">{ord.customerName}</div>
                              <div className="text-slate-500 text-[11px] font-mono flex items-center gap-1">
                                <span>Mã: {ord.customerCode}</span>
                              </div>
                            </td>
                            <td className="p-2.5 text-center font-semibold text-slate-600">
                              {ord.items.length}
                            </td>
                            <td className="p-2.5 max-w-[200px]">
                              <div className="flex flex-wrap gap-1">
                                {ord.items.slice(0, 3).map((it, iIdx) => (
                                  <span
                                    key={iIdx}
                                    className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-700"
                                  >
                                    {it.productCode}
                                  </span>
                                ))}
                                {ord.items.length > 3 && (
                                  <span className="text-[10px] text-slate-400 self-center">
                                    +{ord.items.length - 3}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                              {formatCurrency(ord.totalAmount)}
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

          {/* TAB 2: PRODUCT CODE SYNCHRONIZATION DETAIL */}
          {activeTab === 'products' && (
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                {/* Search */}
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

                {/* Filter chips */}
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
                                  title={
                                    hasSpace
                                      ? 'Có dấu cách thừa'
                                      : hasLowerCase
                                      ? 'Có ký tự chữ thường'
                                      : 'Mã gốc từ Excel'
                                  }
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
                                    <AlertCircle className="w-3 h-3 text-amber-600" />
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

          {/* TAB 3: CUSTOMER CODE SYNCHRONIZATION DETAIL */}
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
                                  title={
                                    hasSpace
                                      ? 'Có dấu cách thừa'
                                      : hasLowerCase
                                      ? 'Có ký tự chữ thường'
                                      : 'Mã gốc từ Excel'
                                  }
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
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {hasAnySyncWarning
                ? `Đã đồng bộ ${adjustedProductCount} mã hàng hóa & ${adjustedCustomerCount} mã khách hàng theo chuẩn phần mềm`
                : 'Tất cả mã hàng hóa và khách hàng đều khớp chuẩn'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Ban className="w-4 h-4 text-slate-500" />
              <span>Hủy bỏ</span>
            </button>

            <button
              type="button"
              onClick={() => onConfirmImport(computedOrders)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {hasAnySyncWarning
                  ? `Xác nhận đồng bộ & nhập ${computedOrders.length} đơn hàng`
                  : `Xác nhận nhập ${computedOrders.length} đơn hàng`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
