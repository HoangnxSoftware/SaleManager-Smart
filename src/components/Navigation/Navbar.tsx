import React from 'react';
import { AppUser, AppSettings } from '../../types';
import {
  ShoppingBag,
  Cloud,
  RefreshCw,
  Plus,
  ShieldCheck,
  UserCheck,
  LogOut,
  Laptop,
  Lock,
  AlertTriangle,
  Building2,
  History,
  Edit3
} from 'lucide-react';

interface NavbarProps {
  currentUser: AppUser;
  settings: AppSettings;
  onOpenOrderModal: () => void;
  onOpenLoginModal: () => void;
  onLogout: () => void;
  onQuickSync: () => void;
  isSyncing: boolean;
  lastSyncedAt?: string;
  isDemo?: boolean;
  databaseName?: string;
  autoSyncEnabled?: boolean;
  isAutoSyncing?: boolean;
  onOpenAuditLog?: () => void;
  currentDeviceName?: string;
  onChangeDeviceName?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  settings,
  onOpenOrderModal,
  onOpenLoginModal,
  onLogout,
  onQuickSync,
  isSyncing,
  lastSyncedAt,
  isDemo = false,
  databaseName,
  autoSyncEnabled = true,
  isAutoSyncing = false,
  onOpenAuditLog,
  currentDeviceName = 'Thiết bị này',
  onChangeDeviceName,
}) => {
  const isBusy = isSyncing || isAutoSyncing;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs max-w-full">
      <div className="w-full px-2 sm:px-6 lg:px-8 xl:px-10 h-14 sm:h-16 flex items-center justify-between gap-1 sm:gap-4 max-w-full">
        {/* Brand */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="font-black text-sm sm:text-lg text-slate-900 tracking-tight truncate">
                SaleManager<span className="text-blue-600 hidden xs:inline">-Smart</span>
              </span>
              {isDemo ? (
                <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1 sm:px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 shrink-0">
                  <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                  <span>DEMO</span>
                </span>
              ) : (
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  <Building2 className="w-3 h-3" />
                  CSDL Thật
                </span>
              )}
            </div>
            <p className="hidden md:block text-[11px] text-slate-500 truncate max-w-xs font-medium">
              {settings.companyName} {settings.taxCode ? `(MST: ${settings.taxCode})` : ''}
            </p>
          </div>
        </div>

        {/* Action Group: Always fits perfectly on both Mobile and Desktop */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* 1. NÚT TẠO ĐƠN: Desktop hiển thị đầy đủ, Mobile hiển thị nút icon tiện dụng */}
          <button
            type="button"
            onClick={onOpenOrderModal}
            className="hidden sm:inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/25 ring-2 ring-blue-500/20 transition-all transform active:scale-95 cursor-pointer shrink-0"
            title="Tạo đơn hàng mới"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="whitespace-nowrap font-black tracking-wide">+ TẠO ĐƠN</span>
          </button>

          <button
            type="button"
            onClick={onOpenOrderModal}
            className="sm:hidden w-8 h-8 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-90 text-white flex items-center justify-center shadow-sm cursor-pointer shrink-0"
            title="Tạo đơn hàng mới"
            aria-label="Tạo đơn hàng"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* 2. NÚT ĐỒNG BỘ: Luôn hiển thị trên cả điện thoại và máy tính */}
          {isDemo ? (
            <button
              type="button"
              onClick={onQuickSync}
              className="p-1.5 sm:px-3 sm:py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold cursor-pointer shrink-0 flex items-center gap-1.5"
              title="Đang dùng dữ liệu mẫu (Khóa đồng bộ Sheets)"
            >
              <Lock className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="hidden lg:inline">Khóa đồng bộ (Demo)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onQuickSync}
              disabled={isBusy}
              className={`p-1.5 sm:px-3 sm:py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                isBusy
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
              }`}
              title="Đồng bộ Google Drive & Sheets (Bấm để xem và quản lý đồng bộ)"
              aria-label="Đồng bộ Google Sheets"
            >
              {isBusy ? (
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              ) : (
                <div className="relative shrink-0 flex items-center justify-center">
                  <Cloud className="w-4 h-4 text-blue-600" />
                  {autoSyncEnabled && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
              )}
              <span className="hidden sm:inline font-bold">
                {isBusy ? 'Đang đồng bộ...' : 'Đồng bộ Sheets'}
              </span>
            </button>
          )}

          {/* 3. NÚT NHẬT KÝ THAO TÁC: Dễ bấm trên cả mobile */}
          {onOpenAuditLog && (
            <button
              type="button"
              onClick={onOpenAuditLog}
              className="p-1.5 sm:px-3 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
              title="Xem nhật ký thao tác dữ liệu thời gian thực"
              aria-label="Nhật ký thao tác"
            >
              <History className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="hidden md:inline font-bold">Nhật ký</span>
            </button>
          )}

          {/* 4. TÊN THIẾT BỊ (Màn hình lớn) */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-700 text-xs font-medium">
            <Laptop className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate max-w-28 font-semibold" title={currentDeviceName}>
              {currentDeviceName}
            </span>
            {onChangeDeviceName && (
              <button
                type="button"
                onClick={onChangeDeviceName}
                className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                title="Đổi tên thiết bị này"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 5. NÚT KIỂM TRA TÀI KHOẢN: Luôn hiển thị trên cả điện thoại và máy tính */}
          <button
            type="button"
            onClick={onOpenLoginModal}
            className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 border border-slate-200/80 transition-colors cursor-pointer shrink-0"
            title={`Tài khoản: ${currentUser.fullName} (@${currentUser.username}) - Bấm để kiểm tra hoặc đổi cơ sở dữ liệu`}
            aria-label="Kiểm tra tài khoản"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser.role === 'admin' ? (
                <ShieldCheck className="w-4 h-4 text-indigo-700" />
              ) : currentUser.role === 'manager' ? (
                <UserCheck className="w-4 h-4 text-blue-700" />
              ) : (
                <ShoppingBag className="w-4 h-4 text-emerald-700" />
              )}
            </div>
            <div className="hidden md:block text-left text-xs">
              <div className="font-bold text-slate-800 leading-tight truncate max-w-28">
                {currentUser.fullName}
              </div>
              <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                <span className="font-mono text-blue-600">@{currentUser.username}</span>
                <span>•</span>
                <span>
                  {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'manager' ? 'Quản lý' : 'Bán hàng'}
                </span>
              </div>
            </div>
          </button>

          {/* 6. NÚT THOÁT / ĐĂNG XUẤT: Luôn hiển thị trực quan trên điện thoại */}
          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
            title="Đăng xuất khỏi hệ thống"
            aria-label="Đăng xuất"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline text-xs font-bold">Thoát</span>
          </button>
        </div>
      </div>
    </header>
  );
};
