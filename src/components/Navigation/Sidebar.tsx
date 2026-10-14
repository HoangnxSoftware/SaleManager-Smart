import React from 'react';
import { AppUser } from '../../types';
import {
  ShoppingCart,
  Package,
  Boxes,
  Wallet,
  BarChart3,
  Users,
  Settings,
  ShieldAlert
} from 'lucide-react';

export type MainTab =
  | 'sales'
  | 'inventory'
  | 'products'
  | 'debts'
  | 'reports'
  | 'users'
  | 'settings';

interface SidebarProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  currentUser: AppUser;
  ordersCount: number;
  purchasesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  ordersCount,
  purchasesCount,
}) => {
  const navItems = [
    {
      id: 'sales' as MainTab,
      label: '3.1 Bán hàng',
      sublabel: 'Tạo đơn & Quản lý đơn hàng',
      icon: ShoppingCart,
      badge: ordersCount > 0 ? ordersCount : undefined,
      allowed: true,
    },
    {
      id: 'inventory' as MainTab,
      label: '3.2 Kho hàng',
      sublabel: 'Nhập hàng & Nhà cung cấp',
      icon: Package,
      badge: purchasesCount > 0 ? purchasesCount : undefined,
      allowed: currentUser.role !== 'salesperson',
    },
    {
      id: 'products' as MainTab,
      label: '3.3 Danh mục sản phẩm',
      sublabel: 'Hàng hóa, ĐVT, Tỷ suất LN',
      icon: Boxes,
      allowed: true,
    },
    {
      id: 'debts' as MainTab,
      label: '3.4 Công nợ',
      sublabel: 'Khách hàng & Nhà cung cấp',
      icon: Wallet,
      allowed: currentUser.role !== 'salesperson',
    },
    {
      id: 'reports' as MainTab,
      label: '3.5 Báo cáo',
      sublabel: 'Xuất nhập kho & Lợi nhuận FIFO',
      icon: BarChart3,
      allowed: currentUser.role !== 'salesperson',
    },
    {
      id: 'users' as MainTab,
      label: '3.6 Phân quyền & Người dùng',
      sublabel: 'Admin, Quản lý, Bán hàng',
      icon: Users,
      allowed: currentUser.role === 'admin',
    },
    {
      id: 'settings' as MainTab,
      label: '3.7 Cài đặt & Drive / Sheets',
      sublabel: 'Số thập phân & Sao lưu',
      icon: Settings,
      allowed: currentUser.role === 'admin' || currentUser.role === 'manager',
    },
  ];

  return (
    <aside className="w-64 xl:w-72 shrink-0 hidden md:block py-6 space-y-6">
      <div className="space-y-1">
        {navItems.map((item) => {
          if (!item.allowed) return null;
          const isActive = currentTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs sm:text-sm tracking-tight leading-snug">
                    {item.label}
                  </div>
                  <div
                    className={`text-[11px] truncate ${
                      isActive ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {item.sublabel}
                  </div>
                </div>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ml-1 ${
                    isActive
                      ? 'bg-white text-blue-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
};
