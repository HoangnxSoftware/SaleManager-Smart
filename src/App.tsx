import React, { useState, useEffect, useCallback } from 'react';
import {
  AppData,
  AppUser,
  AppSettings,
  Customer,
  Supplier,
  Product,
  Order,
  DeletedOrderRecord,
  PurchaseBill,
  DebtPayment,
  DatabaseProfile,
  AuditLogAction,
  AuditLogEntity,
  DeviceSession,
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
  hasGoogleAccessToken,
  subscribeGoogleAuthState,
  initAuth,
  getGoogleDriveConnectionState,
  verifyGoogleDriveConnection,
  markGoogleConnectionInterrupted,
  GoogleDriveConnectionState,
  GoogleDriveConnectionError,
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
import { GoogleDriveReconnectModal } from './components/Common/GoogleDriveReconnectModal';
import { AuditLogModal } from './components/Common/AuditLogModal';
import { DeviceConflictModal } from './components/Common/DeviceConflictModal';
import { AlertTriangle, CloudOff, WifiOff, RefreshCw } from 'lucide-react';
import {
  resequenceOrders,
  DEFAULT_ORDER_CODE_RULES,
  mergeOrdersByRootCode,
  deduplicateOrders,
  mergeDeletedOrders,
  filterDeletedOrders,
  reconcileRemoteOrdersWithLocal,
  generateNextRootCode,
  ensureOrdersHaveRootCode,
} from './services/orderCodeService';
import {
  getCurrentDeviceName,
  setCurrentDeviceName,
  getCurrentDeviceId,
  registerOrUpdateDeviceSession,
  checkDeviceConflict,
} from './services/deviceService';
import { createAuditLogEntry, appendAuditLog } from './services/auditLogService';

export default function App() {
  // Database connection state: remember previous file / database id
  const [selectedDbId, setSelectedDbId] = useState<string>(() => getLastUsedDatabaseId());
  const [data, setData] = useState<AppData>(() => {
    const loaded = loadData(selectedDbId);
    return {
      ...loaded,
      orders: filterDeletedOrders(deduplicateOrders(loaded.orders), loaded.deletedOrders),
    };
  });

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

  // Audit log & Device sync states
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [deviceConflictSession, setDeviceConflictSession] = useState<DeviceSession | null>(null);
  const [hasDismissedConflict, setHasDismissedConflict] = useState(false);
  const [currentDeviceNameState, setCurrentDeviceNameState] = useState(() => getCurrentDeviceName());
  const [googleConnState, setGoogleConnState] = useState<GoogleDriveConnectionState>(() =>
    getGoogleDriveConnectionState()
  );
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [hasDismissedDriveModal, setHasDismissedDriveModal] = useState(false);
  const [isReconnectingGoogle, setIsReconnectingGoogle] = useState(false);
  const [isCheckingGoogleConn, setIsCheckingGoogleConn] = useState(false);
  const [googleReconnectError, setGoogleReconnectError] = useState<string | null>(null);
  const immediateSyncRequestedRef = React.useRef(false);
  const lastDriveCheckRef = React.useRef<number>(0);
  const prevDriveStatusRef = React.useRef<string>(googleConnState.status);
  const wasDriveConnectedRef = React.useRef<boolean>(googleConnState.isConnected);
  const latestDataRef = React.useRef<AppData>(data);
  latestDataRef.current = data;

  const hasGoogleToken = googleConnState.isConnected;

  useEffect(() => {
    const unsubFirebase = initAuth();
    setGoogleConnState(getGoogleDriveConnectionState());
    const unsubDrive = subscribeGoogleAuthState((_hasToken, state) => {
      setGoogleConnState(state);
    });
    return () => {
      unsubFirebase();
      unsubDrive();
    };
  }, []);

  // Reset modal dismissal if connection status transitions to a new disconnection/interruption state
  useEffect(() => {
    if (
      !googleConnState.isConnected &&
      prevDriveStatusRef.current !== googleConnState.status
    ) {
      setHasDismissedDriveModal(false);
      setGoogleReconnectError(null);
    }
    prevDriveStatusRef.current = googleConnState.status;
  }, [googleConnState.isConnected, googleConnState.status]);

  // Monitor Google Drive connectivity during active work (offline/online, focus, 60s heartbeat)
  useEffect(() => {
    if (!currentUser) return;

    const runHealthCheck = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastDriveCheckRef.current < 15000) return;
      lastDriveCheckRef.current = now;
      await verifyGoogleDriveConnection();
    };

    const handleOffline = () => {
      markGoogleConnectionInterrupted(
        'Mất kết nối Internet. Kết nối Google Drive đang bị gián đoạn.'
      );
    };

    const handleOnline = () => {
      void runHealthCheck(true);
    };

    const handleFocusOrVisibility = () => {
      if (!document.hidden) {
        void runHealthCheck(false);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    // Check immediately if browser already reports offline or missing token
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      handleOffline();
    } else {
      void runHealthCheck(true);
    }

    const heartbeatId = setInterval(() => {
      if (!document.hidden) {
        void runHealthCheck(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      clearInterval(heartbeatId);
    };
  }, [currentUser]);

  const handleReconnectGoogleDrive = async () => {
    try {
      setIsReconnectingGoogle(true);
      setGoogleReconnectError(null);
      const res = await googleSignIn();
      if (!res?.accessToken) {
        setGoogleReconnectError('Không lấy được quyền truy cập Google Drive. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setGoogleReconnectError(
        err?.message || 'Kết nối lại Google Drive thất bại. Vui lòng thử lại.'
      );
    } finally {
      setIsReconnectingGoogle(false);
    }
  };

  const handleRetryDriveCheck = async () => {
    try {
      setIsCheckingGoogleConn(true);
      setGoogleReconnectError(null);
      const state = await verifyGoogleDriveConnection();
      if (!state.isConnected) {
        setGoogleReconnectError(
          state.errorMessage || 'Chưa thể khôi phục kết nối Google Drive. Vui lòng thử kết nối lại.'
        );
      }
    } finally {
      setIsCheckingGoogleConn(false);
    }
  };

  // Auto-resume sync immediately when Google Drive connection is restored during work
  useEffect(() => {
    const wasConnected = wasDriveConnectedRef.current;
    wasDriveConnectedRef.current = googleConnState.isConnected;

    if (!wasConnected && googleConnState.isConnected && currentUser) {
      setHasDismissedDriveModal(false);
      setGoogleReconnectError(null);

      const currentData = latestDataRef.current;
      if (!currentData.isDemo && currentData.spreadsheetId && autoSyncEnabled) {
        (async () => {
          try {
            const token = await getAccessToken();
            if (!token) return;
            setIsAutoSyncing(true);
            const res = await syncDataToGoogleSheets(
              currentData,
              token,
              currentData.spreadsheetId
            );
            setHasPendingSync(false);
            setData((prev) => {
              const updated: AppData = {
                ...prev,
                spreadsheetId: res.spreadsheetId,
                lastSyncedAt: res.lastSyncedAt,
                syncSource: 'google_drive',
              };
              saveData(updated, selectedDbId);
              return updated;
            });
            setGlobalBanner({
              type: 'success',
              message:
                '✓ Đã kết nối lại Google Drive và tiếp tục đồng bộ dữ liệu lên Google Sheets thành công!',
            });
          } catch (err) {
            console.debug('Resume sync after Google Drive reconnect failed:', err);
          } finally {
            setIsAutoSyncing(false);
          }
        })();
      } else {
        setGlobalBanner({
          type: 'success',
          message: '✓ Đã kết nối lại Google Drive thành công!',
        });
      }
    }
  }, [googleConnState.isConnected, currentUser, autoSyncEnabled, selectedDbId]);

  // Helper log hành động người dùng theo thời gian thực
  const logUserAction = useCallback(
    (action: AuditLogAction, entity: AuditLogEntity, entityName: string, details: string, entityId?: string) => {
      if (!currentUser) return;
      const entry = createAuditLogEntry(currentUser, action, entity, entityName, details, entityId);
      setData((prev) => ({
        ...prev,
        auditLogs: appendAuditLog(prev.auditLogs, entry),
      }));
    },
    [currentUser]
  );

  // Đổi tên thiết bị
  const handleChangeDeviceName = () => {
    const currentName = getCurrentDeviceName();
    const newName = prompt('Nhập tên cho thiết bị này để phân biệt khi đồng bộ (ví dụ: Máy kế toán, Laptop quản lý...):', currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      setCurrentDeviceName(newName.trim());
      setCurrentDeviceNameState(newName.trim());
      if (currentUser) {
        setData((prev) => {
          const { updatedSessions } = registerOrUpdateDeviceSession(currentUser, prev.activeSessions);
          return {
            ...prev,
            activeSessions: updatedSessions,
          };
        });
      }
    }
  };

  // Periodic device session heartbeat & conflict check (mỗi 20 giây)
  useEffect(() => {
    if (!currentUser) return;

    // Heartbeat update immediately
    setData((prev) => {
      const { updatedSessions, conflictingSession } = registerOrUpdateDeviceSession(currentUser, prev.activeSessions);
      if (conflictingSession && !hasDismissedConflict) {
        setDeviceConflictSession(conflictingSession);
      }
      return {
        ...prev,
        activeSessions: updatedSessions,
      };
    });

    const interval = setInterval(() => {
      setData((prev) => {
        const { updatedSessions, conflictingSession } = registerOrUpdateDeviceSession(currentUser, prev.activeSessions);
        if (conflictingSession && !hasDismissedConflict) {
          setDeviceConflictSession(conflictingSession);
        }
        return {
          ...prev,
          activeSessions: updatedSessions,
        };
      });
    }, 20000);

    return () => clearInterval(interval);
  }, [currentUser, hasDismissedConflict]);

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
          const mergedDeleted = mergeDeletedOrders(current.deletedOrders, fullData.deletedOrders);
          const filteredFullOrders = filterDeletedOrders(fullData.orders, mergedDeleted);
          const filteredCurrentOrders = filterDeletedOrders(current.orders, mergedDeleted);
          if (
            filteredFullOrders.length > filteredCurrentOrders.length ||
            fullData.products.length > current.products.length ||
            fullData.customers.length > current.customers.length
          ) {
            return {
              ...fullData,
              orders: filteredFullOrders,
              deletedOrders: mergedDeleted,
            };
          }
          if (mergedDeleted.length !== (current.deletedOrders?.length || 0)) {
            return {
              ...current,
              orders: filteredCurrentOrders,
              deletedOrders: mergedDeleted,
            };
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
          if (freshData) {
            const mergedDeleted = mergeDeletedOrders(loaded.deletedOrders, freshData.deletedOrders);
            const hasUnpushedDeletes =
              (loaded.deletedOrders?.length || 0) > 0 &&
              mergedDeleted.length > (freshData.deletedOrders?.length || 0);
            if (hasUnpushedDeletes) {
              immediateSyncRequestedRef.current = true;
            }
            const reconciledOrders = reconcileRemoteOrdersWithLocal(
              loaded.orders,
              freshData.orders,
              mergedDeleted,
              loaded.lastSyncedAt
            );
            const mergedData: AppData = {
              ...freshData,
              orders: reconciledOrders,
              deletedOrders: mergedDeleted,
            };
            setData(mergedData);
            saveData(mergedData, dbId);
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
    
    // Register device session & check concurrent login conflict
    setHasDismissedConflict(false);
    const { updatedSessions, conflictingSession } = registerOrUpdateDeviceSession(user, loaded.activeSessions);
    if (conflictingSession) {
      setDeviceConflictSession(conflictingSession);
    }

    // Record login audit log
    const loginLog = createAuditLogEntry(
      user,
      'create',
      'user',
      user.fullName,
      `Đăng nhập vào hệ thống từ thiết bị "${getCurrentDeviceName()}"`
    );

    const updatedData: AppData = {
      ...loaded,
      activeSessions: updatedSessions,
      auditLogs: appendAuditLog(loaded.auditLogs, loginLog),
    };

    setData(updatedData);
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
          if (freshData) {
            const mergedDeleted = mergeDeletedOrders(loaded.deletedOrders, freshData.deletedOrders);
            const hasUnpushedDeletes =
              (loaded.deletedOrders?.length || 0) > 0 &&
              mergedDeleted.length > (freshData.deletedOrders?.length || 0);
            if (hasUnpushedDeletes) {
              immediateSyncRequestedRef.current = true;
            }
            const reconciledOrders = reconcileRemoteOrdersWithLocal(
              loaded.orders,
              freshData.orders,
              mergedDeleted,
              loaded.lastSyncedAt
            );
            // Keep current session in fresh data
            const freshWithSession: AppData = {
              ...freshData,
              orders: reconciledOrders,
              deletedOrders: mergedDeleted,
              activeSessions: registerOrUpdateDeviceSession(user, freshData.activeSessions).updatedSessions,
              auditLogs: appendAuditLog(freshData.auditLogs || loaded.auditLogs, loginLog),
            };
            setData(freshWithSession);
            saveData(freshWithSession, dbId);
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

  // Users updated handler (e.g. after resetting official Admin password from LoginModal)
  const handleUsersUpdatedFromLogin = (updatedUsers: AppUser[], dbId: string) => {
    setData((prev) => {
      if (prev.databaseId === dbId || selectedDbId === dbId) {
        return { ...prev, users: updatedUsers };
      }
      return prev;
    });
  };

  // Order Handlers
  const handleSaveOrder = (newOrder: Order) => {
    const existingOrder = data.orders.find(
      (o) =>
        o.id === newOrder.id ||
        ((!o.id || !newOrder.id) &&
          newOrder.rootCode &&
          o.rootCode &&
          o.rootCode.trim().toUpperCase() === newOrder.rootCode.trim().toUpperCase())
    );

    const isAdmin = currentUser?.role === 'admin';
    if (existingOrder?.deliveryStatus === 'completed' && !isAdmin) {
      setGlobalBanner({
        type: 'error',
        message: '⚠️ BẠN KHÔNG CÓ QUYỀN: Đơn hàng đã hoàn thành, chỉ tài khoản Admin mới được phép chỉnh sửa!',
      });
      alert('Đơn hàng đã hoàn thành! Chỉ tài khoản Admin mới được phép chỉnh sửa.');
      return;
    }

    if (newOrder.deliveryStatus === 'completed' && existingOrder?.deliveryStatus !== 'completed' && !isAdmin) {
      setGlobalBanner({
        type: 'error',
        message: '⚠️ BẠN KHÔNG CÓ QUYỀN: Chỉ tài khoản Admin mới được phép tích hoàn thành đơn hàng!',
      });
      alert('Chỉ tài khoản Admin mới được phép tích hoàn thành đơn hàng!');
      return;
    }

    setData((prev) => {
      const deletedList = prev.deletedOrders || [];
      // Chỉ khớp đơn đã có theo đúng ID (tránh trường hợp trùng rootCode ghi đè nhầm đơn khác)
      const existingIdx = prev.orders.findIndex(
        (o) =>
          o.id === newOrder.id ||
          ((!o.id || !newOrder.id) &&
            newOrder.rootCode &&
            o.rootCode &&
            o.rootCode.trim().toUpperCase() === newOrder.rootCode.trim().toUpperCase())
      );

      let orderToSave = newOrder;
      const usedRootSet = new Set<string>([
        ...(deletedList.map((d) => d.rootCode?.trim().toUpperCase()).filter(Boolean) as string[]),
        ...(prev.orders
          .filter((_, idx) => idx !== existingIdx)
          .map((o) => o.rootCode?.trim().toUpperCase())
          .filter(Boolean) as string[]),
      ]);

      const currentRootUpper = orderToSave.rootCode?.trim().toUpperCase();
      if (!currentRootUpper || (existingIdx === -1 && usedRootSet.has(currentRootUpper))) {
        orderToSave = {
          ...orderToSave,
          rootCode: generateNextRootCode(
            prev.orders,
            deletedList,
            orderToSave.createdAt || orderToSave.orderDate
          ),
        };
      }

      let updatedOrders: Order[];
      if (existingIdx !== -1) {
        // Cập nhật đơn hàng đã có trong danh sách
        updatedOrders = prev.orders.map((o, idx) => (idx === existingIdx ? orderToSave : o));
      } else {
        // Thêm đơn hàng mới
        updatedOrders = [orderToSave, ...prev.orders];
      }

      // Khử trùng tuyệt đối: 1 mã gốc chỉ có duy nhất 1 đơn hàng
      const cleanOrders = deduplicateOrders(
        ensureOrdersHaveRootCode(updatedOrders, deletedList),
        deletedList
      );

      return {
        ...prev,
        orders: cleanOrders,
      };
    });

    const isExisting = Boolean(existingOrder);
    logUserAction(
      isExisting ? 'update' : 'create',
      'order',
      newOrder.orderCode,
      `${isExisting ? 'Cập nhật' : 'Tạo mới'} đơn hàng ${newOrder.orderCode} - Khách: ${newOrder.customerName} - Tổng tiền: ${newOrder.totalAmount.toLocaleString('vi-VN')} đ`,
      newOrder.id
    );
  };

  const handleBatchUpdateOrders = (newOrUpdatedOrders: Order[]) => {
    const isAdmin = currentUser?.role === 'admin';
    const allowedOrders = isAdmin
      ? newOrUpdatedOrders
      : newOrUpdatedOrders.filter((incoming) => {
          const existing = data.orders.find(
            (o) =>
              o.id === incoming.id ||
              (incoming.rootCode && o.rootCode && o.rootCode.trim().toUpperCase() === incoming.rootCode.trim().toUpperCase())
          );
          if (existing?.deliveryStatus === 'completed') return false;
          if (incoming.deliveryStatus === 'completed') return false;
          return true;
        });

    if (!isAdmin && allowedOrders.length === 0 && newOrUpdatedOrders.length > 0) {
      alert('Chỉ tài khoản Admin mới được phép hoàn thành hoặc chỉnh sửa đơn hàng đã hoàn thành!');
      return;
    }

    setData((prev) => {
      const deletedList = prev.deletedOrders || [];
      const existingIdSet = new Set(prev.orders.map((o) => o.id));
      const usedRootSet = new Set<string>([
        ...(deletedList.map((d) => d.rootCode?.trim().toUpperCase()).filter(Boolean) as string[]),
        ...(prev.orders.map((o) => o.rootCode?.trim().toUpperCase()).filter(Boolean) as string[]),
      ]);

      const normalizedIncoming: Order[] = [];
      for (const incoming of allowedOrders) {
        const isExisting = existingIdSet.has(incoming.id);
        const incRootUpper = incoming.rootCode?.trim().toUpperCase();
        if (!isExisting && (!incRootUpper || usedRootSet.has(incRootUpper))) {
          const freshRoot = generateNextRootCode(
            [...prev.orders, ...normalizedIncoming],
            deletedList,
            incoming.createdAt || incoming.orderDate
          );
          usedRootSet.add(freshRoot.toUpperCase());
          const orderCodeWasRoot = Boolean(
            incRootUpper && incoming.orderCode?.trim().toUpperCase() === incRootUpper
          );
          normalizedIncoming.push({
            ...incoming,
            rootCode: freshRoot,
            orderCode: orderCodeWasRoot ? freshRoot : incoming.orderCode,
          });
        } else {
          if (incRootUpper) usedRootSet.add(incRootUpper);
          normalizedIncoming.push(incoming);
        }
      }

      const combined = [...normalizedIncoming, ...prev.orders];
      const cleanOrders = deduplicateOrders(
        ensureOrdersHaveRootCode(combined, deletedList),
        deletedList
      );

      return {
        ...prev,
        orders: cleanOrders,
      };
    });

    logUserAction(
      'import_excel',
      'order',
      `${allowedOrders.length} đơn hàng`,
      `Nhập/đồng bộ hàng loạt ${allowedOrders.length} đơn hàng từ Excel hoặc chức năng tính lại giá`
    );
  };

  const handleDeleteOrder = (orderId: string) => {
    // REQUIREMENT: "chỉ cho tài khoản Admin xóa đơn hàng"
    if (currentUser?.role !== 'admin') {
      setGlobalBanner({
        type: 'error',
        message: '⚠️ BẠN KHÔNG CÓ QUYỀN: Chỉ tài khoản Admin mới được phép xóa đơn hàng khỏi hệ thống!',
      });
      alert('Chỉ tài khoản Admin mới được phép xóa đơn hàng!');
      return;
    }

    const deletedOrder = data.orders.find((o) => o.id === orderId);
    const nowIso = new Date().toISOString();
    immediateSyncRequestedRef.current = true;

    setData((prev) => {
      const ensuredPrev = ensureOrdersHaveRootCode(prev.orders, prev.deletedOrders || []);
      const targetOrder = ensuredPrev.find((o) => o.id === orderId) || deletedOrder;
      const newTombstone: DeletedOrderRecord | null = targetOrder
        ? {
            id: targetOrder.id,
            rootCode: targetOrder.rootCode,
            orderCode: targetOrder.orderCode,
            deletedAt: nowIso,
            deletedById: currentUser?.id,
            deletedByName: currentUser?.fullName || currentUser?.username,
          }
        : {
            id: orderId,
            deletedAt: nowIso,
            deletedById: currentUser?.id,
            deletedByName: currentUser?.fullName || currentUser?.username,
          };

      const mergedDeleted = mergeDeletedOrders(
        prev.deletedOrders || [],
        newTombstone ? [newTombstone] : []
      );
      const remaining = filterDeletedOrders(
        ensuredPrev.filter((o) => o.id !== orderId),
        mergedDeleted
      );
      return {
        ...prev,
        orders: deduplicateOrders(remaining, mergedDeleted),
        deletedOrders: mergedDeleted,
      };
    });

    logUserAction(
      'delete',
      'order',
      deletedOrder?.orderCode || `Đơn hàng ${orderId}`,
      `Xóa đơn hàng ${deletedOrder?.orderCode || orderId} - Khách hàng: ${deletedOrder?.customerName || '—'}`,
      orderId
    );
  };

  const handleBatchDeleteOrders = (orderIds: string[]) => {
    // REQUIREMENT: "chỉ cho tài khoản Admin xóa đơn hàng"
    if (currentUser?.role !== 'admin') {
      setGlobalBanner({
        type: 'error',
        message: '⚠️ BẠN KHÔNG CÓ QUYỀN: Chỉ tài khoản Admin mới được phép xóa đơn hàng khỏi hệ thống!',
      });
      alert('Chỉ tài khoản Admin mới được phép xóa đơn hàng!');
      return;
    }

    const nowIso = new Date().toISOString();
    immediateSyncRequestedRef.current = true;

    setData((prev) => {
      const ensuredPrev = ensureOrdersHaveRootCode(prev.orders, prev.deletedOrders || []);
      const targetIdSet = new Set(orderIds);
      const newTombstones: DeletedOrderRecord[] = ensuredPrev
        .filter((o) => targetIdSet.has(o.id))
        .map((o) => ({
          id: o.id,
          rootCode: o.rootCode,
          orderCode: o.orderCode,
          deletedAt: nowIso,
          deletedById: currentUser?.id,
          deletedByName: currentUser?.fullName || currentUser?.username,
        }));

      const mergedDeleted = mergeDeletedOrders(prev.deletedOrders || [], newTombstones);
      const remaining = filterDeletedOrders(
        ensuredPrev.filter((o) => !targetIdSet.has(o.id)),
        mergedDeleted
      );
      return {
        ...prev,
        orders: deduplicateOrders(remaining, mergedDeleted),
        deletedOrders: mergedDeleted,
      };
    });

    logUserAction(
      'delete',
      'order',
      `${orderIds.length} đơn hàng`,
      `Xóa hàng loạt ${orderIds.length} đơn hàng khỏi hệ thống`
    );
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

    logUserAction(
      'update',
      'order',
      'Đánh số thứ tự lại',
      'Tự động đánh lại số đơn hàng theo thứ tự tăng dần theo quy tắc'
    );
  };

  // Customer Handlers
  const handleSaveCustomer = (customer: Customer) => {
    const isExisting = data.customers.some((c) => c.id === customer.id);
    setData((prev) => {
      const exists = prev.customers.some((c) => c.id === customer.id);
      return {
        ...prev,
        customers: exists
          ? prev.customers.map((c) => (c.id === customer.id ? customer : c))
          : [...prev.customers, customer],
      };
    });

    logUserAction(
      isExisting ? 'update' : 'create',
      'customer',
      customer.name,
      `${isExisting ? 'Cập nhật' : 'Thêm'} khách hàng: ${customer.name} (Mã: ${customer.code}, MST: ${customer.taxCode || '—'})`,
      customer.id
    );
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

    logUserAction(
      'import_excel',
      'customer',
      `${newOrUpdatedCustomers.length} khách hàng`,
      `Nhập/cập nhật hàng loạt ${newOrUpdatedCustomers.length} khách hàng từ file Excel`
    );
  };

  const handleDeleteCustomer = (customerId: string) => {
    const cust = data.customers.find((c) => c.id === customerId);
    setData((prev) => ({
      ...prev,
      customers: prev.customers.filter((c) => c.id !== customerId),
    }));

    logUserAction(
      'delete',
      'customer',
      cust?.name || `Khách hàng ${customerId}`,
      `Xóa khách hàng: ${cust?.name || customerId} (Mã: ${cust?.code || '—'})`,
      customerId
    );
  };

  // Inventory & Purchase Handlers
  const handleSavePurchase = (bill: PurchaseBill) => {
    const isExisting = data.purchases.some((b) => b.id === bill.id);
    setData((prev) => {
      const exists = prev.purchases.some((b) => b.id === bill.id);
      return {
        ...prev,
        purchases: exists
          ? prev.purchases.map((b) => (b.id === bill.id ? bill : b))
          : [bill, ...prev.purchases],
      };
    });

    logUserAction(
      isExisting ? 'update' : 'create',
      'purchase',
      bill.billNo,
      `${isExisting ? 'Cập nhật' : 'Tạo mới'} phiếu nhập hàng ${bill.billNo} - NCC: ${bill.supplierName} - Tổng tiền: ${bill.totalAmount.toLocaleString('vi-VN')} đ`,
      bill.id
    );
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

    logUserAction(
      'import',
      'purchase',
      `${bills.length} phiếu nhập`,
      `Nhập/cập nhật hàng loạt ${bills.length} phiếu nhập kho từ Excel`
    );
  };

  const handleDeletePurchase = (billId: string) => {
    const bill = data.purchases.find((b) => b.id === billId);
    setData((prev) => ({
      ...prev,
      purchases: prev.purchases.filter((b) => b.id !== billId),
    }));

    logUserAction(
      'delete',
      'purchase',
      bill?.billNo || `Phiếu nhập ${billId}`,
      `Xóa phiếu nhập kho: ${bill?.billNo || billId} - NCC: ${bill?.supplierName || '—'}`,
      billId
    );
  };

  // Supplier Handlers
  const handleSaveSupplier = (supplier: Supplier) => {
    const isExisting = data.suppliers.some((s) => s.id === supplier.id);
    setData((prev) => {
      const exists = prev.suppliers.some((s) => s.id === supplier.id);
      return {
        ...prev,
        suppliers: exists
          ? prev.suppliers.map((s) => (s.id === supplier.id ? supplier : s))
          : [...prev.suppliers, supplier],
      };
    });

    logUserAction(
      isExisting ? 'update' : 'create',
      'supplier',
      supplier.name,
      `${isExisting ? 'Cập nhật' : 'Thêm'} đơn vị cung cấp: ${supplier.name} (Mã: ${supplier.code}, MST: ${supplier.taxCode || '—'})`,
      supplier.id
    );
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

    logUserAction(
      'import_excel',
      'supplier',
      `${newOrUpdatedSuppliers.length} NCC`,
      `Nhập/cập nhật hàng loạt ${newOrUpdatedSuppliers.length} đơn vị cung cấp từ Excel`
    );
  };

  const handleDeleteSupplier = (supplierId: string) => {
    const sup = data.suppliers.find((s) => s.id === supplierId);
    setData((prev) => ({
      ...prev,
      suppliers: prev.suppliers.filter((s) => s.id !== supplierId),
    }));

    logUserAction(
      'delete',
      'supplier',
      sup?.name || `NCC ${supplierId}`,
      `Xóa đơn vị cung cấp: ${sup?.name || supplierId} (Mã: ${sup?.code || '—'})`,
      supplierId
    );
  };

  // Product Handlers
  const handleSaveProduct = (product: Product) => {
    const isExisting = data.products.some((p) => p.id === product.id);
    setData((prev) => {
      const exists = prev.products.some((p) => p.id === product.id);
      return {
        ...prev,
        products: exists
          ? prev.products.map((p) => (p.id === product.id ? product : p))
          : [...prev.products, product],
      };
    });

    logUserAction(
      isExisting ? 'update' : 'create',
      'product',
      product.name,
      `${isExisting ? 'Cập nhật' : 'Thêm'} sản phẩm: ${product.name} (Mã: ${product.code}, ĐVT: ${product.saleUnit})`,
      product.id
    );
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

    logUserAction(
      'import_excel',
      'product',
      `${products.length} sản phẩm`,
      `Nhập/cập nhật hàng loạt ${products.length} sản phẩm hàng hóa từ Excel`
    );
  };

  const handleDeleteProduct = (productId: string) => {
    const prod = data.products.find((p) => p.id === productId);
    setData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
    }));

    logUserAction(
      'delete',
      'product',
      prod?.name || `Sản phẩm ${productId}`,
      `Xóa sản phẩm hàng hóa: ${prod?.name || productId} (Mã: ${prod?.code || '—'})`,
      productId
    );
  };

  // Debt Payment Handlers
  const handleSaveDebtPayment = (payment: DebtPayment) => {
    setData((prev) => ({
      ...prev,
      debtPayments: [payment, ...prev.debtPayments],
    }));

    logUserAction(
      'create',
      'debt_payment',
      payment.code,
      `Ghi nhận thanh toán công nợ ${payment.code} (${payment.type === 'customer' ? 'Khách hàng' : 'Nhà cung cấp'}: ${payment.entityName}, Số tiền: ${payment.amount.toLocaleString('vi-VN')} đ)`,
      payment.id
    );
  };

  const handleDeleteDebtPayment = (paymentId: string) => {
    const pay = data.debtPayments.find((p) => p.id === paymentId);
    setData((prev) => ({
      ...prev,
      debtPayments: prev.debtPayments.filter((p) => p.id !== paymentId),
    }));

    logUserAction(
      'delete',
      'debt_payment',
      pay?.code || `Phiếu thu/chi ${paymentId}`,
      `Xóa phiếu thanh toán công nợ: ${pay?.code || paymentId}`,
      paymentId
    );
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

  // Direction 1: Auto-sync on local changes (orders, deletedOrders, customers, purchases, suppliers, products, debts)
  const isInitialMount = React.useRef(true);
  const autoSyncTimerRef = React.useRef<any>(null);

  useEffect(() => {
    // Skip auto-push on initial load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!autoSyncEnabled || data.isDemo || !currentUser || !data.spreadsheetId) {
      immediateSyncRequestedRef.current = false;
      return;
    }

    setHasPendingSync(true);

    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }

    const debounceMs = immediateSyncRequestedRef.current ? 300 : 4500;
    immediateSyncRequestedRef.current = false;

    // Push changes to Google Sheets (fast 300ms for deletions, 4.5s debounce for normal edits)
    autoSyncTimerRef.current = setTimeout(async () => {
      try {
        const token = await getAccessToken();
        if (!token || !googleConnState.isConnected) {
          setHasPendingSync(true);
          return;
        }

        setIsAutoSyncing(true);
        const res = await syncDataToGoogleSheets(data, token, data.spreadsheetId);
        setHasPendingSync(false);
        setData((prev) => ({
          ...prev,
          spreadsheetId: res.spreadsheetId,
          lastSyncedAt: res.lastSyncedAt,
          syncSource: 'google_drive',
        }));
      } catch (err: any) {
        if (err instanceof GoogleDriveConnectionError) {
          setHasPendingSync(true);
        }
        console.debug('Background auto-sync push error:', err);
      } finally {
        setIsAutoSyncing(false);
      }
    }, debounceMs);

    return () => {
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }
    };
  }, [
    data.orders,
    data.deletedOrders,
    data.customers,
    data.purchases,
    data.suppliers,
    data.products,
    data.debtPayments,
    autoSyncEnabled,
    data.isDemo,
    currentUser,
    data.spreadsheetId,
    googleConnState.isConnected,
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
            setData((prev) => {
              const mergedDeleted = mergeDeletedOrders(prev.deletedOrders, restored.deletedOrders);
              const mergedOrders = reconcileRemoteOrdersWithLocal(
                prev.orders,
                restored.orders,
                mergedDeleted,
                prev.lastSyncedAt
              );
              const merged: AppData = {
                ...restored,
                orders: mergedOrders,
                deletedOrders: mergedDeleted,
                activeSessions: prev.activeSessions,
              };
              saveData(merged, selectedDbId);
              return merged;
            });
            setGlobalBanner({
              type: 'success',
              message: `🔄 Đã tự động đồng bộ dữ liệu mới nhất từ Google Sheets (thiết bị khác) lúc ${new Date(meta.lastSyncedAt).toLocaleTimeString('vi-VN')}!`,
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
    if (!googleConnState.isConnected) {
      setHasDismissedDriveModal(false);
      return;
    }
    if (data.isDemo) {
      setGlobalBanner({
        type: 'error',
        message: '⚠️ CẢNH BÁO: Bạn đang sử dụng dữ liệu mẫu Demo! Không cho phép đồng bộ lên Google Sheets để tránh ghi đè dữ liệu thật. Vui lòng chuyển sang hoặc tạo cơ sở dữ liệu thực tế.',
      });
      return;
    }
    setSyncModalMode('push');
  };

  // 1. Manual Reset / Làm mới dữ liệu tại chỗ
  const handleManualResetData = async () => {
    try {
      const loaded = await loadDataAsync(selectedDbId);
      const cleanOrders = filterDeletedOrders(deduplicateOrders(loaded.orders), loaded.deletedOrders);
      const refreshed: AppData = {
        ...loaded,
        orders: cleanOrders,
      };
      setData(refreshed);
      saveData(refreshed, selectedDbId);
      setGlobalBanner({
        type: 'success',
        message: `✓ Đã làm mới hệ thống: Kiểm tra toàn vẹn ${cleanOrders.length} đơn hàng, khử sạch mã trùng lặp và tính toán lại tồn kho & công nợ!`,
      });
      logUserAction('import', 'settings', 'Làm mới', 'Làm mới và kiểm tra toàn vẹn dữ liệu thủ công');
    } catch (err: any) {
      console.error(err);
      setGlobalBanner({
        type: 'error',
        message: `Lỗi làm mới dữ liệu: ${err.message || 'Thao tác không thành công'}`,
      });
    }
  };

  // 2. Manual Push / Đẩy dữ liệu lên Google Sheets
  const handleManualPush = async () => {
    if (data.isDemo) {
      setGlobalBanner({
        type: 'error',
        message: '⚠️ CẢNH BÁO: Dữ liệu mẫu Demo không cho phép đẩy lên Google Sheets để tránh ghi đè dữ liệu thật.',
      });
      return;
    }

    if (!data.spreadsheetId) {
      setSyncModalMode('push');
      return;
    }

    setIsSyncing(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const signinRes = await googleSignIn();
        token = signinRes?.accessToken || null;
      }

      if (!token) {
        setSyncModalMode('push');
        setIsSyncing(false);
        return;
      }

      const res = await syncDataToGoogleSheets(data, token, data.spreadsheetId);
      if (res && res.spreadsheetId) {
        setHasPendingSync(false);
        const now = res.lastSyncedAt || new Date().toISOString();
        const syncedData: AppData = {
          ...data,
          spreadsheetId: res.spreadsheetId,
          lastSyncedAt: now,
          syncSource: 'google_drive',
        };
        setData((prev) => ({
          ...prev,
          spreadsheetId: res.spreadsheetId,
          lastSyncedAt: now,
          syncSource: 'google_drive',
        }));
        saveData(syncedData, selectedDbId);
        setGlobalBanner({
          type: 'success',
          message: '✓ Đã đẩy và sao lưu dữ liệu toàn vẹn lên Google Sheets thành công! Các máy khác đã có thể xem được dữ liệu mới.',
        });
        logUserAction('update', 'settings', 'Google Sheets', 'Đẩy dữ liệu thủ công lên Google Sheets');
      }
    } catch (err: any) {
      console.error('Manual push error:', err);
      setGlobalBanner({
        type: 'error',
        message: `Lỗi đẩy dữ liệu lên Google Sheets: ${err.message || 'Vui lòng kiểm tra quyền truy cập Google Drive'}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. Manual Pull / Nhận dữ liệu từ Google Sheets
  const handleManualPull = async () => {
    if (data.isDemo) {
      setGlobalBanner({
        type: 'error',
        message: '⚠️ Chế độ Demo không hỗ trợ nhận dữ liệu từ Google Sheets.',
      });
      return;
    }

    if (!data.spreadsheetId) {
      setSyncModalMode('pull');
      return;
    }

    setIsSyncing(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const signinRes = await googleSignIn();
        token = signinRes?.accessToken || null;
      }

      if (!token) {
        setSyncModalMode('pull');
        setIsSyncing(false);
        return;
      }

      const restored = await loadDataFromGoogleSheets(token, data.spreadsheetId);
      if (restored) {
        const mergedDeleted = mergeDeletedOrders(data.deletedOrders, restored.deletedOrders);
        const mergedOrders = reconcileRemoteOrdersWithLocal(
          data.orders,
          restored.orders,
          mergedDeleted,
          data.lastSyncedAt
        );
        const updated: AppData = {
          ...restored,
          orders: mergedOrders,
          deletedOrders: mergedDeleted,
          activeSessions: data.activeSessions,
          lastSyncedAt: new Date().toISOString(),
        };
        setData(updated);
        saveData(updated, selectedDbId);
        setGlobalBanner({
          type: 'success',
          message: `✓ Đã nhận dữ liệu mới nhất từ Google Sheets! Đã đồng bộ ${mergedOrders.length} đơn hàng theo mã gốc.`,
        });
        logUserAction('import', 'settings', 'Google Sheets', 'Nhận dữ liệu thủ công từ Google Sheets');
      }
    } catch (err: any) {
      console.error('Manual pull error:', err);
      setGlobalBanner({
        type: 'error',
        message: `Lỗi nhận dữ liệu từ Google Sheets: ${err.message || 'Không thể tải dữ liệu'}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Manual 2-Way Sync / Đồng bộ 2 chiều
  const handleManualSync2Way = async () => {
    if (data.isDemo) {
      setGlobalBanner({
        type: 'error',
        message: '⚠️ Chế độ Demo không hỗ trợ đồng bộ 2 chiều.',
      });
      return;
    }

    if (!data.spreadsheetId) {
      setSyncModalMode('push');
      return;
    }

    setIsSyncing(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const signinRes = await googleSignIn();
        token = signinRes?.accessToken || null;
      }

      if (!token) {
        setSyncModalMode('push');
        setIsSyncing(false);
        return;
      }

      // Step A: Pull remote
      const remote = await loadDataFromGoogleSheets(token, data.spreadsheetId);
      let combinedData = { ...data };
      if (remote) {
        const mergedDeleted = mergeDeletedOrders(data.deletedOrders, remote.deletedOrders);
        const mergedOrders = reconcileRemoteOrdersWithLocal(
          data.orders,
          remote.orders,
          mergedDeleted,
          data.lastSyncedAt
        );
        combinedData = {
          ...remote,
          ...data,
          orders: mergedOrders,
          deletedOrders: mergedDeleted,
        };
      }

      // Step B: Push back
      const res = await syncDataToGoogleSheets(combinedData, token, data.spreadsheetId);
      if (res && res.spreadsheetId) {
        setHasPendingSync(false);
        const now = res.lastSyncedAt || new Date().toISOString();
        const finalData: AppData = {
          ...combinedData,
          spreadsheetId: res.spreadsheetId,
          lastSyncedAt: now,
          syncSource: 'google_drive',
        };
        setData(finalData);
        saveData(finalData, selectedDbId);
        setGlobalBanner({
          type: 'success',
          message: '✓ Đồng bộ 2 chiều hoàn tất! Toàn bộ đơn hàng và dữ liệu giữa máy tính và điện thoại đã khớp nhau hoàn toàn.',
        });
        logUserAction('update', 'settings', 'Google Sheets', 'Đồng bộ 2 chiều thủ công');
      }
    } catch (err: any) {
      console.error('2-way sync error:', err);
      setGlobalBanner({
        type: 'error',
        message: `Lỗi đồng bộ 2 chiều: ${err.message || 'Vui lòng kiểm tra kết nối mạng'}`,
      });
    } finally {
      setIsSyncing(false);
    }
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
          onUsersUpdated={handleUsersUpdatedFromLogin}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans pb-20 md:pb-0 max-w-full overflow-x-hidden">
      {/* 2. REQUIREMENT: "nếu đăng nhập vào dữ liệu mẫu tạo cảnh báo đỏ đang sử dụng dữ liệu mẫu Demo" */}
      {data.isDemo && (
        <div className="bg-rose-600 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold shadow-md flex items-center justify-between border-b border-rose-700 animate-pulse z-50">
          <div className="w-full px-2 sm:px-6 lg:px-8 xl:px-10 mx-auto flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300 shrink-0" />
              <span className="truncate sm:whitespace-normal">
                CẢNH BÁO: BẠN ĐANG SỬ DỤNG DỮ LIỆU MẪU (DEMO) — KHÔNG ĐỒNG BỘ LÊN SHEETS!
              </span>
            </div>
            <button
              type="button"
              onClick={handleOpenExitConfirm}
              className="px-2.5 sm:px-3 py-1 bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-lg shrink-0 cursor-pointer shadow-xs whitespace-nowrap"
            >
              Đổi CSDL Thật
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
        onOpenAuditLog={() => setIsAuditLogOpen(true)}
        currentDeviceName={currentDeviceNameState}
        onChangeDeviceName={handleChangeDeviceName}
        isGoogleAuthenticated={hasGoogleToken}
        isSpreadsheetLinked={Boolean(data.spreadsheetId)}
        googleConnectionStatus={googleConnState.status}
      />

      {/* Persistent Google Drive Interruption / Session Expiry Warning Bar */}
      {!googleConnState.isConnected && (
        <div
          className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold shadow-md border-b z-30 ${
            googleConnState.status === 'interrupted'
              ? 'bg-amber-500 text-slate-950 border-amber-600'
              : 'bg-rose-600 text-white border-rose-700'
          }`}
        >
          <div className="w-full px-2 sm:px-6 lg:px-8 xl:px-10 mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {googleConnState.status === 'interrupted' ? (
                <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              ) : (
                <CloudOff className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              )}
              <span className="leading-snug">
                {googleConnState.status === 'interrupted'
                  ? 'CẢNH BÁO: Kết nối Google Drive bị gián đoạn! '
                  : 'CẢNH BÁO: Phiên kết nối Google Drive đã hết hạn! '}
                {hasPendingSync
                  ? 'Có dữ liệu mới đang chờ đồng bộ lên Google Sheets. Vui lòng kết nối lại để đồng bộ liên tục.'
                  : 'Vui lòng kết nối lại Google Drive để việc đồng bộ dữ liệu được diễn ra liên tục.'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {googleConnState.status === 'interrupted' && (
                <button
                  type="button"
                  disabled={isCheckingGoogleConn || isReconnectingGoogle}
                  onClick={handleRetryDriveCheck}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/90 hover:bg-white text-slate-900 text-xs font-bold shadow-xs cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingGoogleConn ? 'animate-spin' : ''}`} />
                  <span>{isCheckingGoogleConn ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</span>
                </button>
              )}
              <button
                type="button"
                disabled={isReconnectingGoogle}
                onClick={handleReconnectGoogleDrive}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-rose-700 hover:bg-rose-50 text-xs font-black shadow-xs cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReconnectingGoogle ? 'animate-spin' : ''}`} />
                <span>{isReconnectingGoogle ? 'Đang kết nối...' : 'Kết nối lại Google Drive'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global alert banner */}
      {globalBanner && (
        <div
          className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between transition-all ${
            globalBanner.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <div className="w-full px-2 sm:px-6 lg:px-8 xl:px-10 mx-auto flex items-center justify-between gap-2">
            <span className="truncate">{globalBanner.message}</span>
            <button
              onClick={() => setGlobalBanner(null)}
              className="text-white/80 hover:text-white ml-2 underline cursor-pointer shrink-0"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Main Container: Expanded for Desktop and optimized for Mobile */}
      <div className="w-full px-2.5 sm:px-6 lg:px-8 xl:px-10 flex flex-1 gap-4 sm:gap-6 max-w-full overflow-x-hidden">
        {/* Desktop / Tablet Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          currentUser={currentUser}
          ordersCount={data.orders.length}
          purchasesCount={data.purchases.length}
        />

        {/* Tab View Content */}
        <main className="flex-1 py-3 sm:py-6 min-w-0 max-w-full overflow-x-hidden">
          {currentTab === 'sales' && (
            <SalesManager
              orders={data.orders}
              deletedOrders={data.deletedOrders}
              customers={data.customers}
              products={data.products}
              purchases={data.purchases}
              debtPayments={data.debtPayments}
              currentUser={currentUser}
              settings={data.settings}
              users={data.users}
              onSaveOrder={handleSaveOrder}
              onBatchUpdateOrders={handleBatchUpdateOrders}
              onDeleteOrder={handleDeleteOrder}
              onBatchDeleteOrders={handleBatchDeleteOrders}
              onSaveCustomer={handleSaveCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onBatchUpdateCustomers={handleBatchUpdateCustomers}
              onAddNewProduct={handleSaveProduct}
              onBatchUpdateProducts={handleBatchUpdateProducts}
              isSyncing={isSyncing}
              isAutoSyncing={isAutoSyncing}
              autoSyncEnabled={autoSyncEnabled}
              lastSyncedAt={data.lastSyncedAt}
              spreadsheetId={data.spreadsheetId}
              isDemo={data.isDemo}
              currentDeviceName={currentDeviceNameState}
              onManualReset={handleManualResetData}
              onManualPush={handleManualPush}
              onManualPull={handleManualPull}
              onManualSync2Way={handleManualSync2Way}
              onOpenSyncModal={() => setSyncModalMode('push')}
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
              onBatchUpdateProducts={handleBatchUpdateProducts}
            />
          )}

          {currentTab === 'products' && (
            <ProductManager
              products={data.products}
              purchases={data.purchases}
              orders={data.orders}
              currentUser={currentUser}
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
          deletedOrders={data.deletedOrders}
          debtPayments={data.debtPayments}
          currentUser={currentUser}
          settings={data.settings}
          users={data.users}
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
          onUsersUpdated={handleUsersUpdatedFromLogin}
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

      {/* Audit Log / Nhật ký thao tác Modal */}
      {isAuditLogOpen && (
        <AuditLogModal
          isOpen={isAuditLogOpen}
          onClose={() => setIsAuditLogOpen(false)}
          logs={data.auditLogs || []}
          users={data.users}
          databaseName={data.databaseName || data.settings.companyName}
        />
      )}

      {/* Device Conflict Warning Modal */}
      {deviceConflictSession && !hasDismissedConflict && (
        <DeviceConflictModal
          isOpen={true}
          conflictingSession={deviceConflictSession}
          currentUser={currentUser}
          currentDeviceName={currentDeviceNameState}
          onContinueThisDevice={() => {
            setHasDismissedConflict(true);
            setDeviceConflictSession(null);
          }}
          onLogout={handleDirectLogout}
        />
      )}

      {/* Google Sheets Sync & Database Selector Modal */}
      {syncModalMode && (
        <GoogleSheetsSyncModal
          isOpen={!!syncModalMode}
          mode={syncModalMode}
          data={data}
          onClose={() => setSyncModalMode(null)}
          onSuccessPush={(spreadsheetId, webUrl, syncedAt) => {
            const now = syncedAt || new Date().toISOString();
            setData((prev) => {
              const updated: AppData = {
                ...prev,
                spreadsheetId,
                lastSyncedAt: now,
                syncSource: 'google_drive',
              };
              saveData(updated, selectedDbId);
              return updated;
            });
            setGlobalBanner({
              type: 'success',
              message: '✓ Đã đồng bộ dữ liệu toàn vẹn dạng text lên Google Sheets thành công!',
            });
          }}
          onSuccessPull={(restoredData) => {
            const isSameDb =
              (restoredData.databaseId && restoredData.databaseId === data.databaseId) ||
              (restoredData.spreadsheetId && restoredData.spreadsheetId === data.spreadsheetId);
            const mergedDeleted = isSameDb
              ? mergeDeletedOrders(data.deletedOrders, restoredData.deletedOrders)
              : restoredData.deletedOrders || [];
            const finalPullData: AppData = {
              ...restoredData,
              deletedOrders: mergedDeleted,
              orders: filterDeletedOrders(restoredData.orders, mergedDeleted),
            };
            setData(finalPullData);
            saveData(finalPullData, selectedDbId);
            setGlobalBanner({
              type: 'success',
              message: '✓ Đã nạp và khôi phục dữ liệu từ Google Sheets thành công!',
            });
          }}
          onDatabaseCreated={handleDatabaseCreated}
        />
      )}

      {/* Google Drive Interruption / Session Expiry Reconnect Modal */}
      <GoogleDriveReconnectModal
        isOpen={Boolean(currentUser) && !googleConnState.isConnected && !hasDismissedDriveModal}
        connectionState={googleConnState}
        hasPendingSync={hasPendingSync}
        isReconnecting={isReconnectingGoogle}
        isCheckingConnection={isCheckingGoogleConn}
        reconnectError={googleReconnectError}
        onReconnectGoogle={handleReconnectGoogleDrive}
        onRetryCheck={handleRetryDriveCheck}
        onDismissTemporary={() => setHasDismissedDriveModal(true)}
      />

      {/* Mobile Bottom Navigation Bar: Fix & Fit for Phone screens */}
      <MobileNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentUser={currentUser}
        ordersCount={data.orders.length}
        purchasesCount={data.purchases.length}
        onOpenSyncModal={() => setSyncModalMode('push')}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleOpenExitConfirm}
        onOpenAuditLog={() => setIsAuditLogOpen(true)}
        isGoogleConnected={hasGoogleToken && Boolean(data.spreadsheetId)}
        isDemo={data.isDemo}
      />
    </div>
  );
}
