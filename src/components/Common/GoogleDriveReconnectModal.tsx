import React from 'react';
import { GoogleDriveConnectionState } from '../../services/googleDriveSheets';
import { AlertTriangle, CloudOff, RefreshCw, WifiOff, CheckCircle2, X } from 'lucide-react';

interface GoogleDriveReconnectModalProps {
  isOpen: boolean;
  connectionState: GoogleDriveConnectionState;
  hasPendingSync: boolean;
  isReconnecting: boolean;
  isCheckingConnection: boolean;
  reconnectError: string | null;
  onReconnectGoogle: () => void;
  onRetryCheck: () => void;
  onDismissTemporary: () => void;
}

export const GoogleDriveReconnectModal: React.FC<GoogleDriveReconnectModalProps> = ({
  isOpen,
  connectionState,
  hasPendingSync,
  isReconnecting,
  isCheckingConnection,
  reconnectError,
  onReconnectGoogle,
  onRetryCheck,
  onDismissTemporary,
}) => {
  if (!isOpen || connectionState.isConnected) return null;

  const isInterrupted = connectionState.status === 'interrupted';
  const title = isInterrupted
    ? 'KẾT NỐI GOOGLE DRIVE BỊ GIÁN ĐOẠN'
    : 'PHIÊN KẾT NỐI GOOGLE DRIVE ĐÃ HẾT HẠN';

  const defaultDesc = isInterrupted
    ? 'Kết nối mạng hoặc đường truyền tới Google Drive tạm thời bị gián đoạn. Việc đồng bộ tự động lên Google Sheets đang bị tạm dừng.'
    : 'Phiên kết nối tài khoản Google Drive đã hết hạn hoặc bị ngắt. Vui lòng kết nối lại để việc đồng bộ dữ liệu lên Google Sheets được diễn ra liên tục.';

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-amber-400 overflow-hidden my-4">
        {/* Header */}
        <div
          className={`p-5 text-white flex items-start justify-between gap-3 ${
            isInterrupted
              ? 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700'
              : 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-600'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              {isInterrupted ? (
                <WifiOff className="w-6 h-6 text-white" />
              ) : (
                <CloudOff className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg tracking-tight leading-snug">
                {title}
              </h3>
              <p className="text-xs text-amber-100 mt-0.5">
                Cảnh báo bảo vệ đồng bộ liên tục với Google Sheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissTemporary}
            className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/15 transition-colors cursor-pointer shrink-0"
            title="Tạm ẩn hộp thoại (vẫn hiển thị thanh cảnh báo trên cùng)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm text-slate-700">
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {connectionState.errorMessage || defaultDesc}
              </p>
              {connectionState.user?.email && (
                <p className="text-xs text-amber-800 mt-1">
                  Tài khoản Google trước đó: <span className="font-bold">{connectionState.user.email}</span>
                </p>
              )}
            </div>
          </div>

          {hasPendingSync ? (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
              <RefreshCw className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Có dữ liệu mới chưa được đồng bộ lên Google Sheets!</span>
                Dữ liệu của bạn vẫn được lưu an toàn cục bộ trên thiết bị này. Ngay sau khi kết nối lại Google Drive, hệ thống sẽ tự động đẩy dữ liệu lên Google Sheets để không bị gián đoạn.
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Dữ liệu làm việc hiện tại vẫn đang được lưu tạm an toàn trên thiết bị. Hãy kết nối lại Google Drive để tiếp tục đồng bộ liên tục với các thiết bị khác.
              </span>
            </div>
          )}

          {reconnectError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {reconnectError}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              disabled={isReconnecting}
              onClick={onReconnectGoogle}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border-2 border-slate-300 hover:border-blue-500 shadow-md transition-all cursor-pointer disabled:opacity-60"
            >
              {isReconnecting ? (
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              )}
              <span>
                {isReconnecting ? 'Đang kết nối lại Google Drive...' : 'Kết nối lại Google Drive ngay'}
              </span>
            </button>

            <div className="flex flex-col sm:flex-row gap-2">
              {isInterrupted && (
                <button
                  type="button"
                  disabled={isCheckingConnection || isReconnecting}
                  onClick={onRetryCheck}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${isCheckingConnection ? 'animate-spin' : ''}`} />
                  <span>{isCheckingConnection ? 'Đang kiểm tra...' : 'Kiểm tra lại kết nối'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onDismissTemporary}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
              >
                Để sau (Giữ thanh nhắc trên cùng)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
