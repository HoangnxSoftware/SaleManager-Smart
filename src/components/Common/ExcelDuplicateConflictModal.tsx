import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, X, ShieldAlert, ArrowRight, Ban } from 'lucide-react';

export interface ConflictItem {
  code: string;
  name: string;
  oldInfo: string;
  newInfo: string;
}

interface ExcelDuplicateConflictModalProps {
  isOpen: boolean;
  entityTitle: string; // e.g. "Khách hàng", "Nhà cung cấp", "Sản phẩm"
  totalImportedCount: number;
  newItemsCount: number;
  conflicts: ConflictItem[];
  onSkipDuplicates: () => void;
  onOverwriteDuplicates: () => void;
  onCancel: () => void;
}

export const ExcelDuplicateConflictModal: React.FC<ExcelDuplicateConflictModalProps> = ({
  isOpen,
  entityTitle,
  totalImportedCount,
  newItemsCount,
  conflicts,
  onSkipDuplicates,
  onOverwriteDuplicates,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/20 shadow-inner">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Phát hiện mã trùng lặp khi nhập Excel ({entityTitle})
              </h3>
              <p className="text-xs text-amber-100">
                Tìm thấy {conflicts.length} mã đã tồn tại trong danh mục hệ thống
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
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
          {/* Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Tổng dòng đọc từ Excel</div>
              <div className="text-xl font-black text-slate-800 mt-0.5">{totalImportedCount}</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-emerald-700 uppercase">Mã mới sẵn sàng thêm</div>
              <div className="text-xl font-black text-emerald-700 mt-0.5">{newItemsCount}</div>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-rose-700 uppercase">Mã trùng cần xử lý</div>
              <div className="text-xl font-black text-rose-700 mt-0.5">{conflicts.length}</div>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              Để đảm bảo tính toàn vẹn dữ liệu, vui lòng chọn cách xử lý bên dưới: <strong>Bỏ qua mã trùng</strong> (giữ nguyên thông tin cũ) hoặc <strong>Cập nhật thông tin</strong> (ghi đè theo file Excel).
            </span>
          </div>

          {/* Conflict List Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
              Danh sách chi tiết {conflicts.length} mã bị trùng lặp:
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold">
                  <tr>
                    <th className="p-2.5">Mã</th>
                    <th className="p-2.5">Thông tin hiện tại trong CSDL</th>
                    <th className="p-2.5">Thông tin mới trong file Excel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {conflicts.map((c) => (
                    <tr key={c.code} className="hover:bg-rose-100/60 bg-rose-50/70 border-l-4 border-l-rose-600">
                      <td className="p-2.5 font-mono font-bold text-rose-700 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-black text-rose-800">{c.code}</span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-800 border border-rose-300 w-fit">
                            TRÙNG MÃ
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5 text-slate-700 align-top max-w-xs">
                        <div className="font-semibold text-slate-800">{c.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-line">
                          {c.oldInfo}
                        </div>
                      </td>
                      <td className="p-2.5 text-blue-900 align-top max-w-xs bg-blue-50/60">
                        <div className="font-semibold text-blue-950">{c.newInfo.split('\n')[0]}</div>
                        <div className="text-[11px] text-blue-700 mt-0.5 whitespace-pre-line">
                          {c.newInfo}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Ban className="w-4 h-4 text-slate-500" />
            <span>Hủy bỏ (Không nhập)</span>
          </button>

          <button
            type="button"
            onClick={onSkipDuplicates}
            className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs sm:text-sm cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs"
            title="Giữ nguyên dữ liệu cũ trong phần mềm, chỉ nhập các mã mới chưa có"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-700" />
            <span>Bỏ qua mã trùng ({newItemsCount} mã mới)</span>
          </button>

          <button
            type="button"
            onClick={onOverwriteDuplicates}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
            title="Cập nhật ghi đè thông tin mới từ file Excel vào các mã trùng và thêm mã mới"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Cập nhật thông tin (Ghi đè)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
