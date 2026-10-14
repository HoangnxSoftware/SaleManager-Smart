import React from 'react';
import { MainTab } from './Sidebar';
import { AppUser } from '../../types';
import { ShoppingCart, Package, Boxes, Wallet, BarChart3, Menu, Settings } from 'lucide-react';

interface MobileNavProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  currentUser: AppUser;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
      <button
        type="button"
        onClick={() => onSelectTab('sales')}
        className={`flex flex-col items-center p-1.5 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer ${
          currentTab === 'sales' ? 'text-blue-600 font-bold' : 'text-slate-500'
        }`}
      >
        <ShoppingCart className="w-5 h-5 mb-0.5" />
        <span>Bán hàng</span>
      </button>

      {currentUser.role !== 'salesperson' && (
        <button
          type="button"
          onClick={() => onSelectTab('inventory')}
          className={`flex flex-col items-center p-1.5 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer ${
            currentTab === 'inventory' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span>Kho hàng</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => onSelectTab('products')}
        className={`flex flex-col items-center p-1.5 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer ${
          currentTab === 'products' ? 'text-blue-600 font-bold' : 'text-slate-500'
        }`}
      >
        <Boxes className="w-5 h-5 mb-0.5" />
        <span>Sản phẩm</span>
      </button>

      {currentUser.role !== 'salesperson' && (
        <button
          type="button"
          onClick={() => onSelectTab('debts')}
          className={`flex flex-col items-center p-1.5 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer ${
            currentTab === 'debts' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Wallet className="w-5 h-5 mb-0.5" />
          <span>Công nợ</span>
        </button>
      )}

      {currentUser.role !== 'salesperson' && (
        <button
          type="button"
          onClick={() => onSelectTab('reports')}
          className={`flex flex-col items-center p-1.5 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer ${
            currentTab === 'reports' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span>Báo cáo</span>
        </button>
      )}

      {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          className={`flex flex-col items-center p-1.5 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer ${
            currentTab === 'settings' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span>Cài đặt</span>
        </button>
      )}
    </nav>
  );
};
