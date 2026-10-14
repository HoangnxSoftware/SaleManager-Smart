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
  Sparkles,
  Smartphone,
  Laptop,
  Lock,
  AlertTriangle,
  Building2
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
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg text-slate-900 tracking-tight">
                SaleManager<span className="text-blue-600">-Smart</span>
              </span>
              {isDemo ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  DEMO (Khóa đồng bộ)
                </span>
              ) : (
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Building2 className="w-3 h-3" />
                  CSDL Thật
                </span>
              )}
            </div>
            <p className="hidden sm:block text-[11px] text-slate-500 truncate max-w-xs font-medium">
              {settings.companyName} {settings.taxCode ? `(MST: ${settings.taxCode})` : ''}
            </p>
          </div>
        </div>

        {/* Central Prominent CTA: TẠO ĐƠN HÀNG (Easy to spot on both phone & PC) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenOrderModal}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/25 ring-2 ring-blue-500/20 transition-all transform active:scale-95 cursor-pointer"
            title="Tạo đơn hàng mới nhanh chóng"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            <span className="whitespace-nowrap font-black tracking-wide">+ TẠO ĐƠN HÀNG</span>
          </button>

          {/* Quick Drive Sync Status Button */}
          {isDemo ? (
            <button
              type="button"
              onClick={onQuickSync}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold cursor-pointer"
              title="Đang dùng dữ liệu mẫu: Khóa tính năng đồng bộ Google Sheets để bảo vệ dữ liệu thật"
            >
              <Lock className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden lg:inline">Khóa đồng bộ (Demo)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onQuickSync}
              disabled={isSyncing}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Đồng bộ Google Drive & Sheets (Bấm để mở Quản lý đồng bộ)"
            >
              <Cloud className="w-4 h-4 text-blue-600" />
              {isAutoSyncing || isSyncing ? (
                <span className="text-blue-700 flex items-center gap-1 font-bold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Đang đồng bộ...
                </span>
              ) : autoSyncEnabled ? (
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="hidden lg:inline font-medium">Tự động 2 chiều (Sheets)</span>
                </div>
              ) : (
                <span className="hidden lg:inline">Đồng bộ Sheets</span>
              )}
            </button>
          )}
        </div>

        {/* User Account / Role switcher & Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenLoginModal}
            className="flex items-center gap-2 p-1 sm:px-3 sm:py-1.5 rounded-xl hover:bg-slate-100 border border-slate-200/80 transition-colors cursor-pointer"
            title="Bấm để kiểm tra tài khoản hoặc đổi cơ sở dữ liệu"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              {currentUser.role === 'admin' ? (
                <ShieldCheck className="w-4 h-4 text-indigo-700" />
              ) : currentUser.role === 'manager' ? (
                <UserCheck className="w-4 h-4 text-blue-700" />
              ) : (
                <ShoppingBag className="w-4 h-4 text-emerald-700" />
              )}
            </div>
            <div className="hidden sm:block text-left text-xs">
              <div className="font-bold text-slate-800 leading-tight truncate max-w-28">
                {currentUser.fullName}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'manager' ? 'Quản lý' : 'Bán hàng'}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
            title="Đăng xuất khỏi hệ thống và lưu đường dẫn CSDL"
          >
            <LogOut className="w-4 h-4" />
            <span className="sr-only sm:not-sr-only sm:inline-block sm:text-xs sm:font-semibold sm:ml-1 text-slate-600 hover:text-rose-600">
              Thoát
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
