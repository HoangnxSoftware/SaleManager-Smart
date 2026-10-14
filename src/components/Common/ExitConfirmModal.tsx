import React, { useState } from 'react';
import { AppData } from '../../types';
import { LogOut, Cloud, RefreshCw, X, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExitWithoutSync: () => void;
  onConfirmSyncAndExit: () => Promise<void>;
  data: AppData;
  isSyncing: boolean;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmExitWithoutSync,
  onConfirmSyncAndExit,
  data,
  isSyncing,
}) => {
  const [internalSyncing, setInternalSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSyncAndExit = async () => {
    try {
      setInternalSyncing(true);
      setErrorMessage(null);
      await onConfirmSyncAndExit();
      // On success, parent will handle logout
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Lỗi khi đồng bộ dữ liệu trước khi thoát.');
      setInternalSyncing(false);
    }
  };

  const isBusy = isSyncing || internalSyncing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-4.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <LogOut className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Xác nhận thoát chương trình</h3>
              <p className="text-xs text-slate-300">Quản lý phiên làm việc & Bảo toàn dữ liệu</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-slate-900 mb-1">
                Bạn có muốn đồng bộ dữ liệu lên Google Sheets trước khi thoát hay không?
              </p>
              <p className="text-xs text-amber-800 leading-relaxed">
                Đồng bộ trước khi thoát giúp lưu trữ dữ liệu an toàn trên Google Drive và chia sẻ ngay lập tức đến các thiết bị máy tính, điện thoại khác đang cùng sử dụng.
              </p>
            </div>
          </div>

          {/* Database Context */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Cơ sở dữ liệu:</span>
              <span className="font-bold text-slate-800 truncate max-w-[240px]">
                {data.databaseName || data.settings.companyName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Mã số thuế / Đơn vị:</span>
              <span className="font-semibold text-slate-700">
                {data.settings.taxCode || 'Chưa cập nhật'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Lần đồng bộ gần nhất:</span>
              <span className="text-blue-700 font-semibold">
                {data.lastSyncedAt ? formatDate(data.lastSyncedAt) : 'Chưa từng đồng bộ'}
              </span>
            </div>
            {data.isDemo && (
              <div className="pt-1 text-rose-600 font-sans font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Đang dùng CSDL mẫu (Demo) - tính năng đồng bộ sẽ được bỏ qua.</span>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ / Ở lại
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={onConfirmExitWithoutSync}
              className="px-4 py-2.5 rounded-xl border border-rose-300 text-rose-700 font-bold text-xs sm:text-sm hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
              title="Thoát trực tiếp về màn hình đăng nhập không đồng bộ"
            >
              Thoát không đồng bộ
            </button>

            <button
              type="button"
              disabled={isBusy || data.isDemo}
              onClick={handleSyncAndExit}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer disabled:opacity-50"
            >
              {isBusy ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang đồng bộ...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>Đồng bộ & Thoát</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
