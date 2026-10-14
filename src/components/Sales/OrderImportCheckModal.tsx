import React, { useState, useMemo } from 'react';
import { Order, OrderCodeRule } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { generateNextOrderCode, formatOrderCode, extractSequenceNumber } from '../../services/orderCodeService';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Hash,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  Ban
} from 'lucide-react';

interface OrderImportCheckModalProps {
  isOpen: boolean;
  importedOrders: Order[];
  existingOrders: Order[];
  rules: OrderCodeRule[];
  defaultRuleId?: string;
  onConfirmImport: (finalOrders: Order[]) => void;
  onCancel: () => void;
}

export const OrderImportCheckModal: React.FC<OrderImportCheckModalProps> = ({
  isOpen,
  importedOrders,
  existingOrders,
  rules,
  defaultRuleId,
  onConfirmImport,
  onCancel,
}) => {
  // Option: 'rule' (apply selected rule) or 'keep_excel' (keep original Excel codes)
  const initialRule = useMemo(() => {
    return (
      rules.find((r) => r.id === defaultRuleId) ||
      rules.find((r) => r.isDefault) ||
      rules[0]
    );
  }, [rules, defaultRuleId]);

  const [codeMode, setCodeMode] = useState<'rule' | 'keep_excel'>('rule');
  const [selectedRuleId, setSelectedRuleId] = useState<string>(initialRule?.id || '');

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

    // Find starting sequence number for this rule from existing orders
    let startingSeq = 0;
    for (const ex of existingOrders) {
      const seq = extractSequenceNumber(ex.orderCode, currentRule, ex.orderDate);
      if (seq !== null && seq > startingSeq) {
        startingSeq = seq;
      }
    }

    // Assign sequential numbers ascending
    let currentSeq = startingSeq;

    // If rule has date reset per day
    const isPerDateRule = currentRule.patternType === 'prefix_and_date' || currentRule.patternType === 'date_only';

    // Map by orderId to new code
    const renumberedMap = new Map<string, string>();

    if (isPerDateRule) {
      // Group by date
      const dateMap = new Map<string, typeof sorted>();
      sorted.forEach((item) => {
        const d = item.ord.orderDate;
        if (!dateMap.has(d)) dateMap.set(d, []);
        dateMap.get(d)!.push(item);
      });

      for (const [dateStr, itemsForDate] of dateMap.entries()) {
        // Calculate max existing for this specific date
        let maxForDate = 0;
        for (const ex of existingOrders) {
          if (ex.orderDate === dateStr) {
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
      // Prefix only: sequence numbers continue strictly in ascending order across all dates
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

  if (!isOpen) return null;

  const totalAmountSum = computedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalItemsSum = computedOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-900/85 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Kiểm tra & Cập nhật mã đơn hàng nhập từ Excel
              </h2>
              <p className="text-blue-100 text-xs">
                Chọn quy tắc tạo mã đơn để hệ thống tự động đánh lại số đơn theo thứ tự tăng dần
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
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-emerald-700 uppercase">Tổng tiền thanh toán</div>
              <div className="text-xl font-black text-emerald-900 mt-0.5">{formatCurrency(totalAmountSum)}</div>
            </div>
            <div className={`p-3 rounded-xl text-center border ${duplicateCodeSet.size > 0 ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
              <div className="text-[11px] font-semibold uppercase">Trùng mã đơn cũ</div>
              <div className={`text-xl font-black mt-0.5 ${duplicateCodeSet.size > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                {duplicateCodeSet.size}
              </div>
            </div>
          </div>

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
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5">STT</th>
                    <th className="p-2.5">Mã đơn trong Excel</th>
                    <th className="p-2.5">Mã đơn mới áp dụng</th>
                    <th className="p-2.5">Ngày đặt</th>
                    <th className="p-2.5">Khách hàng</th>
                    <th className="p-2.5 text-center">Số MH</th>
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
                        <td className="p-2.5 text-slate-800 max-w-xs truncate">
                          <span className="font-semibold">{ord.customerName}</span>
                          <span className="text-slate-400 text-[11px] ml-1">({ord.customerCode})</span>
                        </td>
                        <td className="p-2.5 text-center font-semibold text-slate-600">
                          {ord.items.length}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
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

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0">
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
            <span>Xác nhận nhập {computedOrders.length} đơn hàng</span>
          </button>
        </div>
      </div>
    </div>
  );
};
