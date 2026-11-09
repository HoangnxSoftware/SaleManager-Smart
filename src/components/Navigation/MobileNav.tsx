import React, { useState } from 'react';
import { MainTab } from './Sidebar';
import { AppUser } from '../../types';
import {
  ShoppingCart,
  Package,
  Boxes,
  Wallet,
  BarChart3,
  Users,
  Settings,
  MoreHorizontal,
  X,
  Cloud,
  ShieldCheck,
  UserCheck,
  History,
  LogOut,
  ChevronRight
} from 'lucide-react';

interface MobileNavProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  currentUser: AppUser;
  ordersCount: number;
  purchasesCount: number;
  onOpenSyncModal?: () => void;
  onOpenLoginModal?: () => void;
  onLogout?: () => void;
  onOpenAuditLog?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  ordersCount,
  purchasesCount,
  onOpenSyncModal,
  onOpenLoginModal,
  onLogout,
  onOpenAuditLog,
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const mainTabs = [
    {
      id: 'sales' as MainTab,
      label: 'Bán hàng',
      icon: ShoppingCart,
      badge: ordersCount > 0 ? ordersCount : undefined,
      allowed: true,
    },
    {
      id: 'inventory' as MainTab,
      label: 'Kho hàng',
      icon: Package,
      badge: purchasesCount > 0 ? purchasesCount : undefined,
      allowed: currentUser.role !== 'salesperson',
    },
    {
      id: 'products' as MainTab,
      label: 'Sản phẩm',
      icon: Boxes,
      allowed: true,
    },
    {
      id: 'debts' as MainTab,
      label: 'Công nợ',
      icon: Wallet,
      allowed: currentUser.role !== 'salesperson',
    },
  ];

  const moreTabs = [
    {
      id: 'reports' as MainTab,
      label: '3.5 Báo cáo & Lợi nhuận',
      icon: BarChart3,
      allowed: currentUser.role !== 'salesperson',
    },
    {
      id: 'users' as MainTab,
      label: '3.6 Phân quyền & Người dùng',
      icon: Users,
      allowed: currentUser.role === 'admin',
    },
    {
      id: 'settings' as MainTab,
      label: '3.7 Cài đặt & Sao lưu Drive',
      icon: Settings,
      allowed: currentUser.role === 'admin' || currentUser.role === 'manager',
    },
  ].filter((t) => t.allowed);

  const isMoreActive = moreTabs.some((t) => t.id === currentTab);

  return (
    <>
      {/* Popover menu for "More" tabs and Quick Actions on mobile */}
      {isMoreMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end md:hidden animate-fade-in"
          onClick={() => setIsMoreMenuOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl p-4 shadow-2xl border-t border-slate-200 max-h-[85vh] overflow-y-auto space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="font-bold text-slate-900 text-sm">Chức năng & Tiện ích</span>
                <p className="text-[11px] text-slate-500">
                  {currentUser.fullName} ({currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'manager' ? 'Quản lý' : 'Bán hàng'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub Tabs Navigation Links */}
            {moreTabs.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Mục quản lý
                </span>
                <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                  {moreTabs.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(item.id);
                          setIsMoreMenuOpen(false);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="text-xs">{item.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 opacity-50" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Actions Group: Đồng bộ, Kiểm tra tài khoản, Nhật ký, Thoát */}
            <div className="space-y-1 pt-1 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                Tiện ích & Tài khoản
              </span>
              <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                {/* Đồng bộ Sheets */}
                {onOpenSyncModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onOpenSyncModal();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/70 hover:bg-blue-100 text-blue-800 font-semibold text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Đồng bộ Google Drive & Sheets</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-blue-400" />
                  </button>
                )}

                {/* Kiểm tra tài khoản */}
                {onOpenLoginModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onOpenLoginModal();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {currentUser.role === 'admin' ? (
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                      <span>Tài khoản: {currentUser.fullName} (@{currentUser.username})</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                )}

                {/* Nhật ký thao tác */}
                {onOpenAuditLog && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onOpenAuditLog();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <History className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Nhật ký thao tác dữ liệu</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                )}

                {/* Đăng xuất / Thoát */}
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onLogout();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Đăng xuất khỏi hệ thống</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-rose-400" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 md:hidden shadow-lg shadow-slate-900/10 px-1 py-1 flex items-center justify-around">
        {mainTabs
          .filter((t) => t.allowed)
          .map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onSelectTab(tab.id);
                }}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer relative min-w-14 ${
                  isActive
                    ? 'text-blue-700 font-bold scale-105'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  {tab.badge !== undefined && (
                    <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[9px] font-black rounded-full px-1 min-w-3.5 h-3.5 flex items-center justify-center leading-none">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight leading-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}

        {/* Nút Thêm... luôn hiển thị cho mọi vai trò */}
        <button
          type="button"
          onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer relative min-w-14 ${
            isMoreActive || isMoreMenuOpen
              ? 'text-blue-700 font-bold scale-105'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight leading-tight">Thêm...</span>
        </button>
      </nav>
    </>
  );
};
