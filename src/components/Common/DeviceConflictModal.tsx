import React from 'react';
import { DeviceSession, AppUser } from '../../types';
import { ShieldAlert, Laptop, Smartphone, AlertTriangle, LogOut, CheckCircle2, ArrowRight } from 'lucide-react';

interface DeviceConflictModalProps {
  isOpen: boolean;
  currentUser: AppUser;
  currentDeviceName: string;
  conflictingSession: DeviceSession;
  onContinueThisDevice: () => void;
  onLogout: () => void;
}

export const DeviceConflictModal: React.FC<DeviceConflictModalProps> = ({
  isOpen,
  currentUser,
  currentDeviceName,
  conflictingSession,
  onContinueThisDevice,
  onLogout,
}) => {
  if (!isOpen) return null;

  const lastActiveTime = new Date(conflictingSession.lastActiveAt).toLocaleTimeString('vi-VN');
  const lastActiveDate = new Date(conflictingSession.lastActiveAt).toLocaleDateString('vi-VN');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border-2 border-amber-400 overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 sm:p-5 text-white flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/20 shrink-0">
            <ShieldAlert className="w-7 h-7 text-white animate-bounce" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black tracking-tight">
              CẢNH BÁO: TÀI KHOẢN ĐANG ĐĂNG NHẬP Ở THIẾT BỊ KHÁC
            </h3>
            <p className="text-amber-100 text-xs mt-0.5">
              Phát hiện phiên làm việc đồng thời của cùng một tài khoản
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs sm:text-sm text-amber-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Tài khoản: <strong>{currentUser.fullName}</strong> (@{currentUser.username})
              </span>
            </div>
            <p className="text-xs text-amber-900/90 leading-relaxed">
              Hệ thống phát hiện tài khoản này vừa được ghi nhận hoạt động trên một thiết bị khác. Để tránh việc <strong>nhập liệu bị đè hoặc nhầm lẫn số liệu</strong> khi đồng bộ dữ liệu thời gian thực giữa các thiết bị, vui lòng xác nhận:
            </p>
          </div>

          {/* Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Other device */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase text-[10px]">
                <Laptop className="w-3.5 h-3.5 text-amber-600" />
                <span>Thiết bị khác đang mở:</span>
              </div>
              <div className="font-bold text-slate-800 text-sm">
                {conflictingSession.deviceName}
              </div>
              <div className="text-slate-500 text-[11px]">
                Hoạt động: {lastActiveTime} ({lastActiveDate})
              </div>
              <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                Đang trực tuyến
              </span>
            </div>

            {/* This device */}
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-blue-700 font-semibold uppercase text-[10px]">
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>Thiết bị hiện tại của bạn:</span>
              </div>
              <div className="font-bold text-blue-900 text-sm">
                {currentDeviceName}
              </div>
              <div className="text-blue-700 text-[11px]">
                Đang đăng nhập phiên này
              </div>
              <span className="inline-block px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px]">
                Thiết bị này
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 italic">
            * Khuyến nghị: Nếu bạn đang làm việc trên máy này, hãy chọn <strong>&ldquo;Tiếp tục trên thiết bị này&rdquo;</strong> để đặt thiết bị này làm phiên chính thức.
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onLogout}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer transition-all"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Đăng xuất tài khoản</span>
          </button>

          <button
            type="button"
            onClick={onContinueThisDevice}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 cursor-pointer transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Tiếp tục trên thiết bị này</span>
          </button>
        </div>
      </div>
    </div>
  );
};
