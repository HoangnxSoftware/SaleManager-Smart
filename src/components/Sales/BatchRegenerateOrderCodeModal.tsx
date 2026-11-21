import React, { useState, useMemo } from 'react';
import { Order, OrderCodeRule, AppUser } from '../../types';
import {
  DEFAULT_ORDER_CODE_RULES,
  formatOrderCode,
  regenerateOrderCodes,
} from '../../services/orderCodeService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  X,
  Hash,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  Lock,
} from 'lucide-react';

interface BatchRegenerateOrderCodeModalProps {
  isOpen: boolean;
  orders: Order[];
  filteredOrders: Order[];
  selectedOrderIds: string[];
  rules: OrderCodeRule[];
  defaultRuleId?: string;
  currentUser: AppUser;
  onClose: () => void;
  onApply: (updatedOrders: Order[]) => void;
}

export const BatchRegenerateOrderCodeModal: React.FC<BatchRegenerateOrderCodeModalProps> = ({
  isOpen,
  orders,
  filteredOrders,
  selectedOrderIds,
  rules,
  defaultRuleId,
  currentUser,
  onClose,
  onApply,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const rulesList = useMemo(() => {
    return rules && rules.length > 0 ? rules : DEFAULT_ORDER_CODE_RULES;
  }, [rules]);

  const unlockedRules = useMemo(() => {
    const active = rulesList.filter((r) => !r.isLocked);
    return active.length > 0 ? active : rulesList;
  }, [rulesList]);

  const initialRule = useMemo(() => {
    return (
      unlockedRules.find((r) => r.id === defaultRuleId) ||
      unlockedRules.find((r) => r.isDefault) ||
      unlockedRules[0]
    );
  }, [unlockedRules, defaultRuleId]);

  const [scope, setScope] = useState<'selected' | 'filtered' | 'dates' | 'all'>(() => {
    if (selectedOrderIds.length > 0) return 'selected';
    if (filteredOrders.length > 0 && filteredOrders.length < orders.length) return 'filtered';
    return 'all';
  });

  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [mode, setMode] = useState<'apply_rule' | 'auto_match'>('apply_rule');
  const [selectedRuleId, setSelectedRuleId] = useState<string>(initialRule?.id || '');
  const [strategy, setStrategy] = useState<'continue' | 'resequence_all'>('continue');

  const rawTargetOrders = useMemo(() => {
    if (scope === 'selected') {
      const idSet = new Set(selectedOrderIds);
      return orders.filter((o) => idSet.has(o.id));
    }
    if (scope === 'filtered') {
      const idSet = new Set(filteredOrders.map((o) => o.id));
      return orders.filter((o) => idSet.has(o.id));
    }
    if (scope === 'dates') {
      return orders.filter(
        (o) => (!startDate || o.orderDate >= startDate) && (!endDate || o.orderDate <= endDate)
      );
    }
    return orders;
  }, [scope, selectedOrderIds, filteredOrders, orders, startDate, endDate]);

  const skippedCompletedCount = useMemo(() => {
    if (isAdmin) return 0;
    return rawTargetOrders.filter((o) => o.deliveryStatus === 'completed').length;
  }, [rawTargetOrders, isAdmin]);

  const eligibleTargetIdSet = useMemo(() => {
    const list = isAdmin
      ? rawTargetOrders
      : rawTargetOrders.filter((o) => o.deliveryStatus !== 'completed');
    return new Set(list.map((o) => o.id));
  }, [rawTargetOrders, isAdmin]);

  const previewResults = useMemo(() => {
    if (eligibleTargetIdSet.size === 0) return [];
    const results = regenerateOrderCodes({
      allOrders: orders,
      targetOrderIds: eligibleTargetIdSet,
      rules: rulesList,
      mode,
      selectedRuleId,
      strategy,
    });

    if (isAdmin) return results;
    return results.filter((r) => r.order.deliveryStatus !== 'completed');
  }, [orders, eligibleTargetIdSet, rulesList, mode, selectedRuleId, strategy, isAdmin]);

  const changedCount = useMemo(
    () => previewResults.filter((r) => r.changed).length,
    [previewResults]
  );

  if (!isOpen || !isAdmin) return null;

  const selectedRuleObj = rulesList.find((r) => r.id === selectedRuleId) || initialRule;

  const handleConfirm = () => {
    if (!isAdmin) {
      alert('Chỉ tài khoản Admin mới được phép thực hiện chức năng Tạo lại mã đơn hàng loạt!');
      return;
    }
    if (previewResults.length === 0) {
      alert('Không có đơn hàng nào để tạo lại mã.');
      return;
    }

    const updatedOrders = previewResults.map((r) => ({
      ...r.order,
      updatedById: currentUser.id,
      updatedByName: currentUser.fullName,
    }));

    onApply(updatedOrders);
    onClose();
    alert(
      `Đã tạo lại mã đơn hàng loạt cho ${updatedOrders.length} đơn hàng theo thứ tự từ cũ nhất đến mới nhất (${changedCount} đơn được cập nhật mã mới)!`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-blue-700 to-sky-700 px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/15">
              <Hash className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Tạo lại mã đơn hàng loạt theo quy tắc tạo mã
              </h2>
              <p className="text-xs text-blue-100">
                Đánh mã tự động theo thứ tự thời gian từ đơn cũ nhất đến đơn mới nhất, giữ nguyên mã gốc (ROOT)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Config Section */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 space-y-4 shrink-0">
          {/* 1. Scope */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Phạm vi đơn hàng áp dụng:
            </label>
            <div className="flex flex-wrap gap-2">
              <label
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  scope === 'selected'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name="regenScope"
                  checked={scope === 'selected'}
                  onChange={() => setScope('selected')}
                  className="text-blue-600"
                />
                <span>Các đơn đã chọn ({selectedOrderIds.length} đơn)</span>
              </label>

              <label
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  scope === 'filtered'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name="regenScope"
                  checked={scope === 'filtered'}
                  onChange={() => setScope('filtered')}
                  className="text-blue-600"
                />
                <span>Đang lọc trên bảng ({filteredOrders.length} đơn)</span>
              </label>

              <label
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  scope === 'dates'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name="regenScope"
                  checked={scope === 'dates'}
                  onChange={() => setScope('dates')}
                  className="text-blue-600"
                />
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Theo khoảng ngày</span>
              </label>

              <label
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  scope === 'all'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name="regenScope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="text-blue-600"
                />
                <span>Toàn bộ đơn hàng ({orders.length} đơn)</span>
              </label>
            </div>

            {scope === 'dates' && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="text-xs text-slate-600 font-semibold">Từ ngày:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                />
                <span className="text-xs text-slate-600 font-semibold">Đến ngày:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                />
              </div>
            )}
          </div>

          {/* 2. Rule & Strategy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Chọn quy tắc tạo mã:
              </label>

              <label className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="regenMode"
                  checked={mode === 'apply_rule'}
                  onChange={() => setMode('apply_rule')}
                  className="mt-0.5 text-blue-600"
                />
                <div className="flex-1 space-y-1.5">
                  <span className="font-semibold block">Áp dụng theo quy tắc chọn bên dưới</span>
                  <select
                    value={selectedRuleId}
                    disabled={mode !== 'apply_rule'}
                    onChange={(e) => setSelectedRuleId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                  >
                    {unlockedRules.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.name} (VD: {formatOrderCode(rule, 1, new Date().toISOString().slice(0, 10))})
                      </option>
                    ))}
                  </select>
                  {mode === 'apply_rule' && selectedRuleObj && (
                    <p className="text-[11px] text-slate-500">
                      Mẫu: <span className="font-mono font-bold text-blue-700">{formatOrderCode(selectedRuleObj, 1, new Date().toISOString().slice(0, 10))}</span>,{' '}
                      <span className="font-mono font-bold text-blue-700">{formatOrderCode(selectedRuleObj, 2, new Date().toISOString().slice(0, 10))}</span>...
                    </p>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer pt-1 border-t border-slate-100">
                <input
                  type="radio"
                  name="regenMode"
                  checked={mode === 'auto_match'}
                  onChange={() => setMode('auto_match')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="font-semibold block">Giữ nguyên quy tắc hiện tại của từng đơn</span>
                  <span className="text-[11px] text-slate-500">
                    Tự nhận diện tiền tố/quy tắc của từng đơn (VD: DH giữ DH, NB giữ NB)
                  </span>
                </div>
              </label>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                3. Cách đánh số thứ tự:
              </label>

              <label className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="regenStrategy"
                  checked={strategy === 'continue'}
                  onChange={() => setStrategy('continue')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="font-semibold block">
                    Đánh tiếp nối sau mã lớn nhất hiện có (Khuyên dùng khi copy đơn)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Chỉ thay đổi mã của các đơn trong phạm vi đã chọn; giữ nguyên mã của các đơn khác.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer pt-1 border-t border-slate-100">
                <input
                  type="radio"
                  name="regenStrategy"
                  checked={strategy === 'resequence_all'}
                  onChange={() => setStrategy('resequence_all')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="font-semibold block">
                    Đánh số lại liên tục từ 1 cho toàn bộ các đơn thuộc quy tắc
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Sắp xếp lại toàn bộ đơn cùng quy tắc từ cũ nhất đến mới nhất và đánh số lại từ số 1.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {skippedCompletedCount > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Có <strong>{skippedCompletedCount}</strong> đơn hàng ở trạng thái <strong>Đã hoàn thành</strong> sẽ được giữ nguyên mã (chỉ Admin mới được sửa đơn đã hoàn thành).
              </span>
            </div>
          )}
        </div>

        {/* Preview List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>
                Xem trước kết quả tạo lại mã ({previewResults.length} đơn • thứ tự từ cũ nhất → mới nhất):
              </span>
            </span>
            <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              {changedCount} đơn sẽ thay đổi mã
            </span>
          </div>

          {previewResults.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
              <AlertTriangle className="w-7 h-7 mx-auto mb-2 text-amber-400" />
              Không có đơn hàng nào phù hợp trong phạm vi đã chọn.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-10 text-center">STT</th>
                    <th className="p-2.5">Ngày đơn</th>
                    <th className="p-2.5">Khách hàng</th>
                    <th className="p-2.5 text-right">Tổng tiền</th>
                    <th className="p-2.5">Mã hiện tại</th>
                    <th className="p-2.5 w-6 text-center"></th>
                    <th className="p-2.5">Mã đơn mới</th>
                    <th className="p-2.5">Quy tắc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewResults.map((res, idx) => (
                    <tr
                      key={res.order.id}
                      className={res.changed ? 'bg-blue-50/30 hover:bg-blue-50/60' : 'hover:bg-slate-50'}
                    >
                      <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-2.5 whitespace-nowrap text-slate-600">
                        {formatDate(res.order.orderDate)}
                      </td>
                      <td className="p-2.5">
                        <div className="font-semibold text-slate-900">{res.order.customerName}</div>
                        {res.order.rootCode && (
                          <div className="text-[10px] font-mono text-slate-400">
                            {res.order.rootCode}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                        {formatCurrency(res.order.totalAmount)}
                      </td>
                      <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">
                        <span className={res.changed ? 'line-through text-slate-400' : 'font-semibold'}>
                          {res.oldCode}
                        </span>
                      </td>
                      <td className="p-2.5 text-center text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5 inline" />
                      </td>
                      <td className="p-2.5 font-mono font-bold whitespace-nowrap">
                        <span
                          className={
                            res.changed
                              ? 'px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'text-slate-700'
                          }
                        >
                          {res.newCode}
                        </span>
                      </td>
                      <td className="p-2.5 text-[11px] text-slate-600">{res.ruleName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Thứ tự tạo mã: <strong className="text-slate-700">Đơn cũ nhất → Đơn mới nhất</strong>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-100 cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={previewResults.length === 0}
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Áp dụng tạo lại mã ({previewResults.length} đơn)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
