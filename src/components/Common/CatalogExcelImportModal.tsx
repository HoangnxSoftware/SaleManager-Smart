import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  Search,
  PlusCircle,
  RefreshCw,
  ArrowRight,
  Ban,
  FileSpreadsheet,
  Equal,
  CheckSquare,
  Square,
} from 'lucide-react';

export interface CatalogImportFieldDiff {
  label: string;
  oldValue: string;
  newValue: string;
}

export interface CatalogImportCheckItem<T = any> {
  code: string;
  name: string;
  status: 'new' | 'changed' | 'unchanged';
  diffs: CatalogImportFieldDiff[];
  previewFields: Array<{ label: string; value: string }>;
  incomingItem: T;
  existingId?: string;
}

interface CatalogExcelImportModalProps<T = any> {
  isOpen: boolean;
  entityTitle: string;
  fileName?: string;
  items: CatalogImportCheckItem<T>[];
  onConfirm: (selectedNew: T[], selectedUpdates: T[]) => void;
  onCancel: () => void;
}

type StatusFilter = 'all' | 'new' | 'changed' | 'unchanged';

export function CatalogExcelImportModal<T = any>({
  isOpen,
  entityTitle,
  fileName,
  items,
  onConfirm,
  onCancel,
}: CatalogExcelImportModalProps<T>) {
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Reset selections when modal opens with a new batch of items:
  // Default: select all NEW items, keep CHANGED/UNCHANGED unchecked until user confirms/checks
  useEffect(() => {
    if (!isOpen) return;
    const initialSelected = new Set<string>();
    items.forEach((it) => {
      if (it.status === 'new') {
        initialSelected.add(it.code.toUpperCase());
      }
    });
    setSelectedCodes(initialSelected);
    setStatusFilter('all');
    setSearchTerm('');
  }, [isOpen, items]);

  const counts = useMemo(() => {
    let newCount = 0;
    let changedCount = 0;
    let unchangedCount = 0;
    items.forEach((it) => {
      if (it.status === 'new') newCount += 1;
      else if (it.status === 'changed') changedCount += 1;
      else unchangedCount += 1;
    });
    return { total: items.length, newCount, changedCount, unchangedCount };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter !== 'all' && it.status !== statusFilter) return false;
      if (q) {
        return (
          it.code.toLowerCase().includes(q) ||
          it.name.toLowerCase().includes(q) ||
          it.diffs.some(
            (d) =>
              d.oldValue.toLowerCase().includes(q) ||
              d.newValue.toLowerCase().includes(q) ||
              d.label.toLowerCase().includes(q)
          ) ||
          it.previewFields.some(
            (f) => f.value.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)
          )
        );
      }
      return true;
    });
  }, [items, statusFilter, searchTerm]);

  const selectedCounts = useMemo(() => {
    let newSelected = 0;
    let updateSelected = 0;
    items.forEach((it) => {
      if (selectedCodes.has(it.code.toUpperCase())) {
        if (it.status === 'new') newSelected += 1;
        else updateSelected += 1;
      }
    });
    return {
      newSelected,
      updateSelected,
      totalSelected: newSelected + updateSelected,
    };
  }, [items, selectedCodes]);

  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((it) => selectedCodes.has(it.code.toUpperCase()));

  if (!isOpen) return null;

  const toggleCode = (code: string) => {
    const key = code.toUpperCase();
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredItems.forEach((it) => next.delete(it.code.toUpperCase()));
      } else {
        filteredItems.forEach((it) => next.add(it.code.toUpperCase()));
      }
      return next;
    });
  };

  const selectByStatus = (targetStatus: 'new' | 'changed' | 'all') => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      items.forEach((it) => {
        if (targetStatus === 'all' || it.status === targetStatus) {
          next.add(it.code.toUpperCase());
        }
      });
      return next;
    });
  };

  const clearAllSelections = () => {
    setSelectedCodes(new Set());
  };

  const handleConfirm = () => {
    const selectedNew: T[] = [];
    const selectedUpdates: T[] = [];
    items.forEach((it) => {
      if (!selectedCodes.has(it.code.toUpperCase())) return;
      if (it.status === 'new') {
        selectedNew.push(it.incomingItem);
      } else {
        selectedUpdates.push(it.incomingItem);
      }
    });
    onConfirm(selectedNew, selectedUpdates);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-2 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-blue-700 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-white/15 border border-white/20 shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg truncate">
                Kiểm tra & Đối chiếu dữ liệu nhập Excel ({entityTitle})
              </h3>
              <p className="text-xs text-blue-100 truncate">
                {fileName ? `Tệp: ${fileName} • ` : ''}
                Tổng {counts.total} mã ({counts.newCount} mã mới, {counts.changedCount} mã trùng có thay đổi, {counts.unchangedCount} mã giống hệt)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs sm:text-sm">
          {/* Summary Filter Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className={`text-[11px] font-semibold uppercase ${statusFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                Tất cả mã trong Excel
              </div>
              <div className="text-xl font-black mt-0.5">{counts.total}</div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('new')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'new'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <div className={`text-[11px] font-semibold uppercase ${statusFilter === 'new' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                Mã mới (Chưa có)
              </div>
              <div className="text-xl font-black mt-0.5">{counts.newCount}</div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('changed')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'changed'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                  : 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <div className={`text-[11px] font-semibold uppercase ${statusFilter === 'changed' ? 'text-rose-100' : 'text-rose-700'}`}>
                Trùng mã - Khác thông tin
              </div>
              <div className="text-xl font-black mt-0.5">{counts.changedCount}</div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('unchanged')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'unchanged'
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className={`text-[11px] font-semibold uppercase ${statusFilter === 'unchanged' ? 'text-indigo-100' : 'text-slate-500'}`}>
                Trùng mã - Giống hệt
              </div>
              <div className="text-xl font-black mt-0.5">{counts.unchangedCount}</div>
            </button>
          </div>

          {/* Warning Alert when there are changed duplicates */}
          {counts.changedCount > 0 ? (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900">
                  Cảnh báo: Phát hiện {counts.changedCount} mã đã có trong danh mục nhưng có thông tin khác biệt so với file Excel!
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Các mã mới đã được tích chọn sẵn để thêm. Các mã trùng có thông tin khác <strong>đang tạm bỏ tích</strong> để bảo vệ dữ liệu cũ — vui lòng kiểm tra chi tiết cột so sánh bên dưới và tích chọn những mã bạn muốn <strong>cập nhật lại</strong> hoặc bấm <em>"Chọn tất cả mã khác thông tin"</em>.
                </p>
              </div>
            </div>
          ) : counts.unchangedCount > 0 ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Tìm thấy {counts.newCount} mã mới (đã tích chọn sẵn) và {counts.unchangedCount} mã trùng khớp hoàn toàn thông tin với danh mục hiện tại.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-2">
              <PlusCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Tất cả {counts.newCount} mã trong file Excel đều là mã mới chưa có trong danh mục. Kiểm tra lại thông tin và bấm xác nhận để thêm vào hệ thống.
              </span>
            </div>
          )}

          {/* Quick Selection & Search Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5">
              {counts.newCount > 0 && (
                <button
                  type="button"
                  onClick={() => selectByStatus('new')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Chọn tất cả mã mới ({counts.newCount})</span>
                </button>
              )}
              {counts.changedCount > 0 && (
                <button
                  type="button"
                  onClick={() => selectByStatus('changed')}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Chọn tất cả mã khác thông tin ({counts.changedCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => selectByStatus('all')}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={clearAllSelections}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Bỏ chọn hết
              </button>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo mã, tên, nội dung..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Detailed Comparison Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="max-h-[44vh] overflow-x-auto overflow-y-auto table-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 text-[11px] font-bold uppercase shadow-xs">
                  <tr>
                    <th className="p-2.5 w-10 text-center bg-slate-100">
                      <button
                        type="button"
                        onClick={toggleAllVisible}
                        className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer inline-flex items-center justify-center"
                        title={allVisibleSelected ? 'Bỏ chọn các dòng đang hiển thị' : 'Chọn tất cả dòng đang hiển thị'}
                      >
                        {allVisibleSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    </th>
                    <th className="p-2.5 min-w-[150px] bg-slate-100">Mã & Trạng thái</th>
                    <th className="p-2.5 min-w-[180px] bg-slate-100">Tên trong Excel</th>
                    <th className="p-2.5 min-w-[340px] bg-slate-100">So sánh thông tin chi tiết (Danh mục ↔ Excel)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        Không có dòng nào phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isChecked = selectedCodes.has(item.code.toUpperCase());
                      const rowClass =
                        item.status === 'changed'
                          ? isChecked
                            ? 'bg-rose-50/90 border-l-4 border-l-rose-600'
                            : 'bg-amber-50/40 hover:bg-amber-50/80 border-l-4 border-l-amber-500'
                          : item.status === 'new'
                          ? isChecked
                            ? 'bg-emerald-50/60 hover:bg-emerald-50 border-l-4 border-l-emerald-500'
                            : 'bg-white hover:bg-slate-50 border-l-4 border-l-slate-300'
                          : 'bg-slate-50/40 hover:bg-slate-100/60 border-l-4 border-l-slate-300';

                      return (
                        <tr
                          key={item.code}
                          onClick={() => toggleCode(item.code)}
                          className={`cursor-pointer transition-colors ${rowClass}`}
                        >
                          <td className="p-2.5 text-center align-top" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCode(item.code)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-0.5"
                            />
                          </td>

                          <td className="p-2.5 align-top">
                            <div className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                              {item.code}
                            </div>
                            {item.status === 'new' && (
                              <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <PlusCircle className="w-3 h-3" />
                                MÃ MỚI
                              </span>
                            )}
                            {item.status === 'changed' && (
                              <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <AlertTriangle className="w-3 h-3" />
                                TRÙNG - CÓ THAY ĐỔI
                              </span>
                            )}
                            {item.status === 'unchanged' && (
                              <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                                <Equal className="w-3 h-3" />
                                TRÙNG - GIỐNG HỆT
                              </span>
                            )}
                          </td>

                          <td className="p-2.5 align-top font-semibold text-slate-900">
                            {item.name}
                          </td>

                          <td className="p-2.5 align-top">
                            {item.status === 'changed' ? (
                              <div className="space-y-1.5">
                                {item.diffs.map((d, idx) => (
                                  <div
                                    key={idx}
                                    className="flex flex-wrap items-center gap-1.5 text-[11px] bg-white/90 px-2 py-1 rounded-lg border border-rose-200/80"
                                  >
                                    <span className="font-bold text-slate-700">{d.label}:</span>
                                    <span className="line-through text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                                      {d.oldValue || '(Trống)'}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="font-bold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded">
                                      {d.newValue || '(Trống)'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : item.status === 'new' ? (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-700">
                                {item.previewFields.map((f, idx) => (
                                  <span key={idx}>
                                    <span className="text-slate-500">{f.label}:</span>{' '}
                                    <span className="font-semibold text-slate-900">{f.value || '—'}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-slate-600">
                                  Thông tin trùng khớp hoàn toàn với danh mục hiện tại.
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                                  {item.previewFields.map((f, idx) => (
                                    <span key={idx}>
                                      {f.label}: <span className="font-medium text-slate-700">{f.value || '—'}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
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

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-700 flex flex-wrap items-center gap-2">
            <span className="font-semibold">Đã tích chọn:</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
              +{selectedCounts.newSelected} mã mới
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">
              ↻ {selectedCounts.updateSelected} mã cập nhật
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
              disabled={selectedCounts.totalSelected === 0}
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Xác nhận ({selectedCounts.newSelected} thêm mới, {selectedCounts.updateSelected} cập nhật)
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
