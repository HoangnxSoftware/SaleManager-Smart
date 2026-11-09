import React from 'react';
import {
  Cloud,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Database,
  Smartphone,
  Laptop,
  CheckCircle2,
  Clock,
  Layers,
  Settings,
  AlertCircle
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface ManualSyncBarProps {
  isSyncing: boolean;
  isAutoSyncing: boolean;
  autoSyncEnabled: boolean;
  lastSyncedAt?: string;
  spreadsheetId?: string;
  companyName?: string;
  taxCode?: string;
  isDemo?: boolean;
  currentDeviceName?: string;
  onManualReset: () => void;
  onManualPush: () => void;
  onManualPull: () => void;
  onManualSync2Way: () => void;
  onOpenSyncModal: () => void;
}

export const ManualSyncBar: React.FC<ManualSyncBarProps> = ({
  isSyncing,
  isAutoSyncing,
  autoSyncEnabled,
  lastSyncedAt,
  spreadsheetId,
  companyName,
  taxCode,
  isDemo = false,
  currentDeviceName = 'Thiết bị này',
  onManualReset,
  onManualPush,
  onManualPull,
  onManualSync2Way,
  onOpenSyncModal,
}) => {
  // Format last synced time
  const formattedSyncTime = React.useMemo(() => {
    if (!lastSyncedAt) return 'Chưa đồng bộ';
    try {
      const date = new Date(lastSyncedAt);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffMinutes < 1) return 'Vừa xong';
      if (diffMinutes < 60) return `${diffMinutes} phút trước`;
      return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • ${formatDate(lastSyncedAt.slice(0, 10))}`;
    } catch {
      return lastSyncedAt;
    }
  }, [lastSyncedAt]);

  const isBusy = isSyncing || isAutoSyncing;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 sm:p-4 space-y-3 max-w-full overflow-hidden">
      {/* Top Status Line: Connection info & Last synced timestamp */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs text-slate-600">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-800 font-semibold shrink-0">
            <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="truncate max-w-44 sm:max-w-xs">
              {isDemo
                ? 'Dữ liệu Demo (Thử nghiệm)'
                : spreadsheetId
                ? 'Google Sheets (Đã kết nối)'
                : 'Lưu trên máy (Chưa liên kết Sheets)'}
            </span>
          </div>

          {autoSyncEnabled && !isDemo && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Tự động 2 chiều</span>
            </span>
          )}

          {currentDeviceName && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium shrink-0">
              <Smartphone className="w-3 h-3 text-slate-500" />
              <span>{currentDeviceName}</span>
            </span>
          )}
        </div>

        {/* Sync status & Last updated time */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Cập nhật:</span>
          <span className="font-semibold text-slate-800 font-mono">
            {isBusy ? (
              <span className="text-blue-600 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Đang truyền dữ liệu...
              </span>
            ) : (
              formattedSyncTime
            )}
          </span>
        </div>
      </div>

      {/* Manual Action Buttons Grid: Mobile & Desktop optimized */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-2.5">
        {/* 1. Nút Cập nhật / Làm mới tại chỗ */}
        <button
          type="button"
          onClick={onManualReset}
          disabled={isBusy}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-bold text-xs transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          title="Tải lại dữ liệu từ bộ nhớ, lọc mã trùng lặp và tính toán lại tồn kho & công nợ"
        >
          <RefreshCw className={`w-4 h-4 text-blue-600 shrink-0 ${isBusy ? 'animate-spin' : ''}`} />
          <span className="truncate">Làm mới dữ liệu</span>
        </button>

        {/* 2. Nút Đẩy dữ liệu lên Google Sheets (Push) */}
        <button
          type="button"
          onClick={onManualPush}
          disabled={isBusy}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-98 text-white font-bold text-xs transition-all cursor-pointer shadow-sm shadow-blue-500/20 disabled:opacity-50"
          title="Đẩy ngay các đơn hàng và dữ liệu vừa tạo trên máy này lên Google Sheets để các máy khác cùng thấy"
        >
          <UploadCloud className="w-4 h-4 text-white shrink-0" />
          <span className="truncate">Đẩy lên Sheets</span>
        </button>

        {/* 3. Nút Nhận dữ liệu từ Google Sheets (Pull) */}
        <button
          type="button"
          onClick={onManualPull}
          disabled={isBusy}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white font-bold text-xs transition-all cursor-pointer shadow-sm shadow-emerald-500/20 disabled:opacity-50"
          title="Tải ngay các đơn hàng và cập nhật mới nhất từ Google Sheets (do Admin hoặc máy khác tạo) về máy này"
        >
          <DownloadCloud className="w-4 h-4 text-white shrink-0" />
          <span className="truncate">Nhận từ Sheets</span>
        </button>

        {/* 4. Nút Đồng bộ 2 chiều (Sync 2 chiều) */}
        <button
          type="button"
          onClick={onManualSync2Way}
          disabled={isBusy}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 active:scale-98 text-white font-bold text-xs transition-all cursor-pointer shadow-sm shadow-purple-500/20 disabled:opacity-50"
          title="Nhận dữ liệu mới nhất từ Sheets rồi gộp và đẩy dữ liệu hoàn chỉnh 2 chiều"
        >
          <RefreshCw className={`w-4 h-4 text-white shrink-0 ${isBusy ? 'animate-spin' : ''}`} />
          <span className="truncate">Đồng bộ 2 chiều</span>
        </button>

        {/* 5. Nút Cấu hình Google Sheets (Desktop & Mobile) */}
        <button
          type="button"
          onClick={onOpenSyncModal}
          className="col-span-2 sm:col-span-4 lg:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer shadow-2xs"
          title="Mở bảng cài đặt chi tiết Google Drive & Sheets (chọn file CSDL, kiểm tra mã số thuế...)"
        >
          <Settings className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">Cấu hình Sheets</span>
        </button>
      </div>
    </div>
  );
};
