import React, { useState, useEffect } from 'react';
import {
  AppData,
  AppUser,
  AppSettings,
  Customer,
  Supplier,
  Product,
  Order,
  PurchaseBill,
  DebtPayment,
  DatabaseProfile,
} from './types';
import {
  loadData,
  loadDataAsync,
  saveData,
  loadDatabaseProfiles,
  getLastUsedDatabaseId,
  setLastUsedDatabaseId,
  getEmptyData,
  getSampleData,
  DEMO_DATABASE_ID,
} from './services/storage';
import {
  syncDataToGoogleSheets,
  loadDataFromGoogleSheets,
  fetchSpreadsheetMetadata,
  getAccessToken,
  googleSignIn,
} from './services/googleDriveSheets';
import { Navbar } from './components/Navigation/Navbar';
import { Sidebar, MainTab } from './components/Navigation/Sidebar';
import { MobileNav } from './components/Navigation/MobileNav';
import { SalesManager } from './components/Sales/SalesManager';
import { OrderFormModal } from './components/Sales/OrderFormModal';
import { InventoryManager } from './components/Inventory/InventoryManager';
import { ProductManager } from './components/Products/ProductManager';
import { DebtManager } from './components/Debts/DebtManager';
import { ReportsManager } from './components/Reports/ReportsManager';
import { UserManager } from './components/Users/UserManager';
import { SettingsManager } from './components/Settings/SettingsManager';
import { LoginModal } from './components/LoginModal';
import { ExitConfirmModal } from './components/Common/ExitConfirmModal';
import { GoogleSheetsSyncModal } from './components/Common/GoogleSheetsSyncModal';
import { AlertTriangle } from 'lucide-react';
import { resequenceOrders, DEFAULT_ORDER_CODE_RULES } from './services/orderCodeService';

export default function App() {
  // Database connection state: remember previous file / database id
  const [selectedDbId, setSelectedDbId] = useState<string>(() => getLastUsedDatabaseId());
  const [data, setData] = useState<AppData>(() => loadData(selectedDbId));

  // Authentication state: MUST show Login Window first when opening app!
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const [currentTab, setCurrentTab] = useState<MainTab>('sales');

  // Modals
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [syncModalMode, setSyncModalMode] = useState<'push' | 'pull' | null>(null);

  // Syncing state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem('SALEMANAGER_AUTOSYNC_ENABLED');
    return stored !== null ? stored === 'true' : true;
  });
  const [globalBanner, setGlobalBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Requirement: "Khi tắt trang phần mềm cũng phải hiện thông báo thoát chương trình"
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Bạn có chắc chắn muốn thoát khỏi chương trình? Hãy đảm bảo dữ liệu đã được đồng bộ lên Google Sheets!';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Auto save to persistent storage on data changes
  useEffect(() => {
    if (!data.databaseId || data.databaseId === selectedDbId) {
      saveData(data, selectedDbId);
    }
  }, [data, selectedDbId]);

  // Hydrate full dataset from IndexedDB on startup or database switch
  useEffect(() => {
    let isMounted = true;
    loadDataAsync(selectedDbId).then((fullData) => {
      if (isMounted && fullData) {
        setData((current) => {
          if (
            fullData.orders.length > current.orders.length ||
            fullData.products.length > current.products.length ||
            fullData.customers.length > current.customers.length
          ) {
            return fullData;
          }
          return current;
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedDbId]);

  // Hide sales person from restricted tabs
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'salesperson') {
      if (['inventory', 'debts', 'reports', 'users', 'settings'].includes(currentTab)) {
        setCurrentTab('sales');
      }
    } else if (currentUser.role === 'manager') {
      if (currentTab === 'users') {
        setCurrentTab('sales');
      }
    }
  }, [currentUser, currentTab]);

  // Database switch handler
  const handleSelectDatabase = async (dbId: string) => {
    setSelectedDbId(dbId);
    setLastUsedDatabaseId(dbId);
    const loaded = await loadDataAsync(dbId);
    setData(loaded);

    // Profile might have spreadsheetId even if loaded data didn't have it
    const profiles = loadDatabaseProfiles();
    const profile = profiles.find((p) => p.id === dbId);
    const targetSpreadsheetId = loaded.spreadsheetId || profile?.spreadsheetId;

    // If connected to Google Sheets, automatically sync/pull in background
    if (targetSpreadsheetId && !loaded.isDemo) {
      try {
        const token = await getAccessToken();
        if (token) {
          const freshData = await loadDataFromGoogleSheets(token, targetSpreadsheetId);
          if (freshData && (freshData.orders.length > 0 || freshData.products.length > 0)) {
            setData(freshData);
            saveData(freshData, dbId);
          }
        }
      } catch (err) {
        console.debug('Database switch background sheet sync:', err);
      }
    }
  };

  // Login success handler
  const handleLoginSuccess = async (user: AppUser, dbId: string) => {
    setSelectedDbId(dbId);
    setLastUsedDatabaseId(dbId);
    const loaded = await loadDataAsync(dbId);
    setData(loaded);
    setCurrentUser(user);
    setIsLoginModalOpen(false);

    // Profile might have spreadsheetId even if loaded data didn't have it
    const profiles = loadDatabaseProfiles();
    const profile = profiles.find((p) => p.id === dbId);
    const targetSpreadsheetId = loaded.spreadsheetId || profile?.spreadsheetId;

    // If connected to Google Sheets, automatically sync/pull to ensure fresh data
    if (targetSpreadsheetId && !loaded.isDemo) {
      try {
        const token = await getAccessToken();
        if (token) {
          const freshData = await loadDataFromGoogleSheets(token, targetSpreadsheetId);
          if (freshData && (freshData.orders.length > 0 || freshData.products.length > 0)) {
            setData(freshData);
            saveData(freshData, dbId);
          }
        }
      } catch (err) {
        console.debug('Login background sheet sync:', err);
      }
    }
  };

  // Database created handler
  const handleDatabaseCreated = async (profile: DatabaseProfile) => {
    setSelectedDbId(profile.id);
    setLastUsedDatabaseId(profile.id);
    const loaded = await loadDataAsync(profile.id);
    setData(loaded);
  };

  // Order Handlers
  const handleSaveOrder = (newOrder: Order) => {
    setData((prev) => {
      const exists = prev.orders.some((o) => o.id === newOrder.id);
      const updatedOrders = exists
        ? prev.orders.map((o) => (o.id === newOrder.id ? newOrder : o))
        : [newOrder, ...prev.orders];

      return {
        ...prev,
        orders: updatedOrders,
      };
    });
  };

  const handleBatchUpdateOrders = (newOrUpdatedOrders: Order[]) => {
    setData((prev) => {
      const orderMap = new Map<string, Order>();
      prev.orders.forEach((o) => orderMap.set(o.id, o));
      newOrUpdatedOrders.forEach((o) => orderMap.set(o.id, o));

      return {
        ...prev,
        orders: Array.from(orderMap.values()),
      };
    });
  };

  const handleDeleteOrder = (orderId: string) => {
    setData((prev) => {
      const remaining = prev.orders.filter((o) => o.id !== orderId);
      const rules =
        prev.settings.orderCodeRules && prev.settings.orderCodeRules.length > 0
          ? prev.settings.orderCodeRules
          : DEFAULT_ORDER_CODE_RULES;
      const resequenced = resequenceOrders(remaining, rules);
      return {
        ...prev,
        orders: resequenced,
      };
    });
  };

  const handleBatchDeleteOrders = (orderIds: string[]) => {
    setData((prev) => {
      const remaining = prev.orders.filter((o) => !orderIds.includes(o.id));
      const rules =
        prev.settings.orderCodeRules && prev.settings.orderCodeRules.length > 0
          ? prev.settings.orderCodeRules
          : DEFAULT_ORDER_CODE_RULES;
      const resequenced = resequenceOrders(remaining, rules);
      return {
        ...prev,
        orders: resequenced,
      };
    });
  };

  const handleResequenceOrders = () => {
    setData((prev) => {
      const rules =
        prev.settings.orderCodeRules && prev.settings.orderCodeRules.length > 0
          ? prev.settings.orderCodeRules
          : DEFAULT_ORDER_CODE_RULES;
      const resequenced = resequenceOrders(prev.orders, rules);
      return {
        ...prev,
        orders: resequenced,
      };
    });
  };

  // Customer Handlers
  const handleSaveCustomer = (customer: Customer) => {
    setData((prev) => {
      const exists = prev.customers.some((c) => c.id === customer.id);
      return {
        ...prev,
        customers: exists
          ? prev.customers.map((c) => (c.id === customer.id ? customer : c))
          : [...prev.customers, customer],
      };
    });
  };

  const handleBatchUpdateCustomers = (newOrUpdatedCustomers: Customer[]) => {
    setData((prev) => {
      const map = new Map<string, Customer>();
      prev.customers.forEach((c) => map.set(c.id, c));
      newOrUpdatedCustomers.forEach((c) => map.set(c.id, c));

      return {
        ...prev,
        customers: Array.from(map.values()),
      };
    });
  };

  const handleDeleteCustomer = (customerId: string) => {
    setData((prev) => ({
      ...prev,
      customers: prev.customers.filter((c) => c.id !== customerId),
    }));
  };

  // Inventory & Purchase Handlers
  const handleSavePurchase = (bill: PurchaseBill) => {
    setData((prev) => {
      const exists = prev.purchases.some((b) => b.id === bill.id);
      return {
        ...prev,
        purchases: exists
          ? prev.purchases.map((b) => (b.id === bill.id ? bill : b))
          : [bill, ...prev.purchases],
      };
    });
  };

  const handleBatchUpdatePurchases = (bills: PurchaseBill[]) => {
    setData((prev) => {
      const map = new Map<string, PurchaseBill>();
      prev.purchases.forEach((p) => map.set(p.id, p));
      bills.forEach((p) => map.set(p.id, p));

      return {
        ...prev,
        purchases: Array.from(map.values()),
      };
    });
  };

  const handleDeletePurchase = (billId: string) => {
    setData((prev) => ({
      ...prev,
      purchases: prev.purchases.filter((b) => b.id !== billId),
    }));
  };

  // Supplier Handlers
  const handleSaveSupplier = (supplier: Supplier) => {
    setData((prev) => {
      const exists = prev.suppliers.some((s) => s.id === supplier.id);
      return {
        ...prev,
        suppliers: exists
          ? prev.suppliers.map((s) => (s.id === supplier.id ? supplier : s))
          : [...prev.suppliers, supplier],
      };
    });
  };

  const handleBatchUpdateSuppliers = (newOrUpdatedSuppliers: Supplier[]) => {
    setData((prev) => {
      const map = new Map<string, Supplier>();
      prev.suppliers.forEach((s) => map.set(s.id, s));
      newOrUpdatedSuppliers.forEach((s) => map.set(s.id, s));

      return {
        ...prev,
        suppliers: Array.from(map.values()),
      };
    });
  };

  const handleDeleteSupplier = (supplierId: string) => {
    setData((prev) => ({
      ...prev,
      suppliers: prev.suppliers.filter((s) => s.id !== supplierId),
    }));
  };

  // Product Handlers
  const handleSaveProduct = (product: Product) => {
    setData((prev) => {
      const exists = prev.products.some((p) => p.id === product.id);
      return {
        ...prev,
        products: exists
          ? prev.products.map((p) => (p.id === product.id ? product : p))
          : [...prev.products, product],
      };
    });
  };

  const handleBatchUpdateProducts = (products: Product[]) => {
    setData((prev) => {
      const map = new Map<string, Product>();
      prev.products.forEach((p) => map.set(p.id, p));
      products.forEach((p) => map.set(p.id, p));

      return {
        ...prev,
        products: Array.from(map.values()),
      };
    });
  };

  const handleDeleteProduct = (productId: string) => {
    setData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
    }));
  };

  // Debt Payment Handlers
  const handleSaveDebtPayment = (payment: DebtPayment) => {
    setData((prev) => ({
      ...prev,
      debtPayments: [payment, ...prev.debtPayments],
    }));
  };

  const handleDeleteDebtPayment = (paymentId: string) => {
    setData((prev) => ({
      ...prev,
      debtPayments: prev.debtPayments.filter((p) => p.id !== paymentId),
    }));
  };

  const handleBatchUpdateDebtPayments = (newPayments: DebtPayment[]) => {
    setData((prev) => ({
      ...prev,
      debtPayments: [...newPayments, ...prev.debtPayments],
    }));
  };

  // User Handlers
  const handleSaveUser = (user: AppUser) => {
    setData((prev) => {
      const exists = prev.users.some((u) => u.id === user.id);
      return {
        ...prev,
        users: exists
          ? prev.users.map((u) => (u.id === user.id ? user : u))
          : [...prev.users, user],
      };
    });
  };

  const handleDeleteUser = (userId: string) => {
    setData((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.id !== userId),
    }));
  };

  // Settings & Reset Handlers
  const handleUpdateSettings = (settings: AppSettings) => {
    setData((prev) => ({
      ...prev,
      settings,
    }));
  };

  const handleResetEmptyData = () => {
    const empty = getEmptyData({
      databaseId: selectedDbId,
      companyName: data.settings.companyName,
      taxCode: data.settings.taxCode,
      address: data.settings.address,
    });
    setData(empty);
    saveData(empty, selectedDbId);
    setGlobalBanner({
      type: 'success',
      message: 'Đã tạo cơ sở dữ liệu mới trống thành công! Bạn có thể bắt đầu nhập liệu.',
    });
  };

  const handleResetSampleData = () => {
    const sample = getSampleData();
    setData(sample);
    saveData(sample, DEMO_DATABASE_ID);
    setSelectedDbId(DEMO_DATABASE_ID);
    setLastUsedDatabaseId(DEMO_DATABASE_ID);
    setGlobalBanner({
      type: 'success',
      message: 'Đã khôi phục dữ liệu mẫu thử nghiệm thành công!',
    });
  };

  // Direction 1: Auto-sync on local changes (orders, customers, purchases, suppliers, products, debts)
  const isInitialMount = React.useRef(true);
  const autoSyncTimerRef = React.useRef<any>(null);

  useEffect(() => {
    // Skip auto-push on initial load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!autoSyncEnabled || data.isDemo || !currentUser || !data.spreadsheetId) {
      return;
    }

    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }

    // Debounce 4.5 seconds after user actions to batch multiple keystrokes/actions
    autoSyncTimerRef.current = setTimeout(async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;

        setIsAutoSyncing(true);
        const res = await syncDataToGoogleSheets(data, token, data.spreadsheetId);
        setData((prev) => ({
          ...prev,
          spreadsheetId: res.spreadsheetId,
          lastSyncedAt: new Date().toISOString(),
          syncSource: 'google_drive',
        }));
      } catch (err: any) {
        console.debug('Background auto-sync push error:', err);
      } finally {
        setIsAutoSyncing(false);
      }
    }, 4500);

    return () => {
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }
    };
  }, [
    data.orders,
    data.customers,
    data.purchases,
    data.suppliers,
    data.products,
    data.debtPayments,
    autoSyncEnabled,
    data.isDemo,
    currentUser,
    data.spreadsheetId,
  ]);

  // Direction 2: Multi-device auto-sync (pull remote updates if another device made changes)
  useEffect(() => {
    if (!autoSyncEnabled || data.isDemo || !data.spreadsheetId || !currentUser) {
      return;
    }

    const intervalId = setInterval(async () => {
      if (document.hidden || isSyncing || isAutoSyncing) return;

      try {
        const token = await getAccessToken();
        if (!token) return;

        const meta = await fetchSpreadsheetMetadata(token, data.spreadsheetId!);
        if (!meta || !meta.lastSyncedAt) return;

        const remoteTime = new Date(meta.lastSyncedAt).getTime();
        const localTime = data.lastSyncedAt ? new Date(data.lastSyncedAt).getTime() : 0;

        // If remote was updated at least 4.5s AFTER our local sync, another device made changes!
        if (remoteTime > localTime + 4500) {
          console.log('Detected remote update on Google Sheets from another device. Reloading data...');
          const restored = await loadDataFromGoogleSheets(token, data.spreadsheetId!);
          if (restored) {
            setData(restored);
            saveData(restored, selectedDbId);
            setGlobalBanner({
              type: 'success',
              message: `🔄 Đã tự động cập nhật dữ liệu mới từ Google Sheets (thiết bị khác) lúc ${new Date(meta.lastSyncedAt).toLocaleTimeString('vi-VN')}!`,
            });
          }
        }
      } catch (err) {
        console.debug('Background multi-device check error:', err);
      }
    }, 25000);

    return () => clearInterval(intervalId);
  }, [
    autoSyncEnabled,
    data.isDemo,
    data.spreadsheetId,
    data.lastSyncedAt,
    currentUser,
    isSyncing,
    isAutoSyncing,
    selectedDbId,
  ]);

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem('SALEMANAGER_AUTOSYNC_ENABLED', String(enabled));
  };

  // Quick 1-Click Sync to Google Drive / Sheets (Opens selector modal with mismatch detection)
  const handleQuickSync = () => {
    if (data.isDemo) {
      setGlobalBanner({
        type: 'error',
        message: '⚠️ CẢNH BÁO: Bạn đang sử dụng dữ liệu mẫu Demo! Không cho phép đồng bộ lên Google Sheets để tránh ghi đè dữ liệu thật. Vui lòng chuyển sang hoặc tạo cơ sở dữ liệu thực tế.',
      });
      return;
    }
    setSyncModalMode('push');
  };

  // Exit & Logout handlers
  const handleOpenExitConfirm = () => {
    setIsExitModalOpen(true);
  };

  const handleDirectLogout = () => {
    setLastUsedDatabaseId(selectedDbId);
    setCurrentUser(null);
    setIsExitModalOpen(false);
  };

  const handleConfirmSyncAndExit = async () => {
    if (data.isDemo) {
      handleDirectLogout();
      return;
    }

    let token = await getAccessToken();
    if (!token) {
      const signinRes = await googleSignIn();
      token = signinRes?.accessToken || null;
    }

    if (!token) {
      throw new Error('Vui lòng kết nối tài khoản Google để thực hiện sao lưu trước khi thoát.');
    }

    await syncDataToGoogleSheets(data, token, data.spreadsheetId);
    handleDirectLogout();
  };

  // 1. REQUIREMENT: "khi mở phần mềm hiện cửa sổ đăng nhập đầu tiên"
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-3 sm:p-4">
        <LoginModal
          currentUser={null}
          users={data.users}
          currentDatabaseId={selectedDbId}
          onSelectDatabase={handleSelectDatabase}
          onLogin={handleLoginSuccess}
          onDatabaseCreated={handleDatabaseCreated}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans pb-16 md:pb-0">
      {/* 2. REQUIREMENT: "nếu đăng nhập vào dữ liệu mẫu tạo cảnh báo đỏ đang sử dụng dữ liệu mẫu Demo" */}
      {data.isDemo && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs sm:text-sm font-bold shadow-md flex items-center justify-between border-b border-rose-700 animate-pulse z-50">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-300 shrink-0" />
              <span>
                CẢNH BÁO: BẠN ĐANG SỬ DỤNG DỮ LIỆU MẪU (DEMO) — KHÔNG CHO PHÉP ĐỒNG BỘ DỮ LIỆU LÊN GOOGLE SHEETS ĐỂ TRÁNH GHI ĐÈ DỮ LIỆU THẬT!
              </span>
            </div>
            <button
              type="button"
              onClick={handleOpenExitConfirm}
              className="px-3 py-1 bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-lg shrink-0 cursor-pointer shadow-xs"
            >
              Đổi sang CSDL Thật
            </button>
          </div>
        </div>
      )}

      {/* Top Navbar with prominent Create Order CTA & Drive status */}
      <Navbar
        currentUser={currentUser}
        settings={data.settings}
        onOpenOrderModal={() => setIsOrderModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleOpenExitConfirm}
        onQuickSync={handleQuickSync}
        isSyncing={isSyncing}
        lastSyncedAt={data.lastSyncedAt}
        isDemo={data.isDemo}
        databaseName={data.databaseName || data.settings.companyName}
        autoSyncEnabled={autoSyncEnabled}
        isAutoSyncing={isAutoSyncing}
      />

      {/* Global alert banner */}
      {globalBanner && (
        <div
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between transition-all ${
            globalBanner.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 mx-auto flex items-center justify-between">
            <span>{globalBanner.message}</span>
            <button
              onClick={() => setGlobalBanner(null)}
              className="text-white/80 hover:text-white ml-3 underline cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Main Container: Expanded for Desktop to both sides */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 flex flex-1 gap-6">
        {/* Desktop / Tablet Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          currentUser={currentUser}
          ordersCount={data.orders.length}
          purchasesCount={data.purchases.length}
        />

        {/* Tab View Content */}
        <main className="flex-1 py-6 min-w-0">
          {currentTab === 'sales' && (
            <SalesManager
              orders={data.orders}
              customers={data.customers}
              products={data.products}
              purchases={data.purchases}
              debtPayments={data.debtPayments}
              currentUser={currentUser}
              settings={data.settings}
              onSaveOrder={handleSaveOrder}
              onBatchUpdateOrders={handleBatchUpdateOrders}
              onDeleteOrder={handleDeleteOrder}
              onBatchDeleteOrders={handleBatchDeleteOrders}
              onSaveCustomer={handleSaveCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onBatchUpdateCustomers={handleBatchUpdateCustomers}
            />
          )}

          {currentTab === 'inventory' && (
            <InventoryManager
              purchases={data.purchases}
              suppliers={data.suppliers}
              products={data.products}
              currentUser={currentUser}
              settings={data.settings}
              onSavePurchase={handleSavePurchase}
              onDeletePurchase={handleDeletePurchase}
              onBatchUpdatePurchases={handleBatchUpdatePurchases}
              onSaveSupplier={handleSaveSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onBatchUpdateSuppliers={handleBatchUpdateSuppliers}
              onAddNewProduct={handleSaveProduct}
            />
          )}

          {currentTab === 'products' && (
            <ProductManager
              products={data.products}
              purchases={data.purchases}
              orders={data.orders}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onBatchUpdateProducts={handleBatchUpdateProducts}
            />
          )}

          {currentTab === 'debts' && (
            <DebtManager
              customers={data.customers}
              suppliers={data.suppliers}
              orders={data.orders}
              purchases={data.purchases}
              debtPayments={data.debtPayments}
              onSaveDebtPayment={handleSaveDebtPayment}
              onDeleteDebtPayment={handleDeleteDebtPayment}
              onBatchUpdateDebtPayments={handleBatchUpdateDebtPayments}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsManager
              data={data}
              currentUser={currentUser}
              settings={data.settings}
              onSaveOrder={handleSaveOrder}
            />
          )}

          {currentTab === 'users' && (
            <UserManager
              users={data.users}
              currentUser={currentUser}
              onSaveUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsManager
              data={data}
              onUpdateSettings={handleUpdateSettings}
              onRestoreFromSheets={(restored) => {
                setData(restored);
                saveData(restored, selectedDbId);
              }}
              onResetEmptyData={handleResetEmptyData}
              onResetSampleData={handleResetSampleData}
              onResequenceOrders={handleResequenceOrders}
              onOpenSyncModal={(mode) => setSyncModalMode(mode)}
              onOpenSwitchDatabaseModal={() => setIsLoginModalOpen(true)}
              autoSyncEnabled={autoSyncEnabled}
              onToggleAutoSync={handleToggleAutoSync}
              isAutoSyncing={isAutoSyncing}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentUser={currentUser}
      />

      {/* Global Order Creation Modal triggered from Navbar or anywhere */}
      {isOrderModalOpen && (
        <OrderFormModal
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          onSave={handleSaveOrder}
          customers={data.customers}
          products={data.products}
          purchases={data.purchases}
          allOrders={data.orders}
          debtPayments={data.debtPayments}
          currentUser={currentUser}
          settings={data.settings}
          onAddNewCustomer={handleSaveCustomer}
        />
      )}

      {/* Switch Database / Account Modal */}
      {isLoginModalOpen && (
        <LoginModal
          currentUser={currentUser}
          users={data.users}
          currentDatabaseId={selectedDbId}
          onSelectDatabase={handleSelectDatabase}
          onLogin={handleLoginSuccess}
          onDatabaseCreated={handleDatabaseCreated}
          onClose={() => setIsLoginModalOpen(false)}
        />
      )}

      {/* Exit Confirmation Modal */}
      {isExitModalOpen && (
        <ExitConfirmModal
          isOpen={isExitModalOpen}
          onClose={() => setIsExitModalOpen(false)}
          onConfirmExitWithoutSync={handleDirectLogout}
          onConfirmSyncAndExit={handleConfirmSyncAndExit}
          data={data}
          isSyncing={isSyncing}
        />
      )}

      {/* Google Sheets Sync & Database Selector Modal */}
      {syncModalMode && (
        <GoogleSheetsSyncModal
          isOpen={!!syncModalMode}
          mode={syncModalMode}
          data={data}
          onClose={() => setSyncModalMode(null)}
          onSuccessPush={(spreadsheetId, webUrl) => {
            setData((prev) => ({
              ...prev,
              spreadsheetId,
              lastSyncedAt: new Date().toISOString(),
              syncSource: 'google_drive',
            }));
            setGlobalBanner({
              type: 'success',
              message: '✓ Đã đồng bộ dữ liệu toàn vẹn dạng text lên Google Sheets thành công!',
            });
          }}
          onSuccessPull={(restoredData) => {
            setData(restoredData);
            saveData(restoredData, selectedDbId);
            setGlobalBanner({
              type: 'success',
              message: '✓ Đã nạp và khôi phục dữ liệu từ Google Sheets thành công!',
            });
          }}
          onDatabaseCreated={handleDatabaseCreated}
        />
      )}
    </div>
  );
}
