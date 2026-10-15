import React, { useState, useEffect } from 'react';
import { AppUser, DatabaseProfile } from '../types';
import { useConfirm } from '../context/ConfirmContext';
import {
  loadDatabaseProfiles,
  getLastUsedDatabaseId,
  setLastUsedDatabaseId,
  createNewDatabase,
  deleteDatabaseProfile,
  DEMO_DATABASE_ID,
  saveData,
} from '../services/storage';
import {
  googleSignIn,
  listSpreadsheetsInFolder,
  createDatabaseSpreadsheetOnDrive,
  getAccessToken,
  loadDataFromGoogleSheets,
  DRIVE_FOLDER_NAME,
} from '../services/googleDriveSheets';
import {
  ShoppingBag,
  AlertTriangle,
  Lock,
  User,
  LogIn,
  Database,
  PlusCircle,
  Cloud,
  CheckCircle2,
  Building,
  Hash,
  MapPin,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ChevronDown,
  X,
  FileSpreadsheet,
  Link2,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  ShieldCheck,
  UserCheck,
  Building2,
  Info
} from 'lucide-react';

interface LoginModalProps {
  currentUser: AppUser | null;
  users: AppUser[];
  currentDatabaseId: string;
  onSelectDatabase: (databaseId: string) => void;
  onLogin: (user: AppUser, databaseId: string) => void;
  onDatabaseCreated: (newProfile: DatabaseProfile) => void;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  currentUser,
  users,
  currentDatabaseId,
  onSelectDatabase,
  onLogin,
  onDatabaseCreated,
  onClose,
}) => {
  const confirm = useConfirm();
  // Profiles
  const [profiles, setProfiles] = useState<DatabaseProfile[]>(() => loadDatabaseProfiles());
  const [selectedDbId, setSelectedDbId] = useState<string>(() => {
    return currentDatabaseId || getLastUsedDatabaseId();
  });

  // Login form fields (NO quick role picker: role is determined strictly by account from the database!)
  const [selectedAccountUsername, setSelectedAccountUsername] = useState<string>('admin');
  const [passwordInput, setPasswordInput] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // New database modal state
  const [showCreateDbModal, setShowCreateDbModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newTaxCode, setNewTaxCode] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [createGoogleSheetAlso, setCreateGoogleSheetAlso] = useState(true);
  const [isCreatingDb, setIsCreatingDb] = useState(false);
  const [createDbStatusMsg, setCreateDbStatusMsg] = useState<string | null>(null);

  // Link existing sheet modal state
  const [showLinkSheetModal, setShowLinkSheetModal] = useState(false);
  const [sheetUrlOrIdInput, setSheetUrlOrIdInput] = useState('');
  const [linkSheetError, setLinkSheetError] = useState<string | null>(null);

  // Drive scan state
  const [isScanningDrive, setIsScanningDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [showDriveFilesList, setShowDriveFilesList] = useState(false);
  const [driveStatusNote, setDriveStatusNote] = useState<string | null>(null);

  // Active selected profile
  const activeProfile = profiles.find((p) => p.id === selectedDbId) || profiles[0];
  const isSelectedDbDemo = activeProfile?.isDemo ?? false;

  // Sync selected account when active database changes
  useEffect(() => {
    if (users && users.length > 0) {
      const currentSelectedExists = users.some(u => u.username === selectedAccountUsername);
      if (!currentSelectedExists) {
        setSelectedAccountUsername(users[0].username);
      }
    }
  }, [users]);

  // Sync selected DB change
  const handleDbChange = (id: string) => {
    setSelectedDbId(id);
    setLastUsedDatabaseId(id);
    onSelectDatabase(id);
    setLoginError(null);
  };

  // Submit login
  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const trimmedUser = selectedAccountUsername.trim().toLowerCase();
    const trimmedPass = passwordInput.trim();

    // Check against accounts configured in this database
    const matched = users.find(
      (u) =>
        u.username.toLowerCase() === trimmedUser &&
        (u.password ? u.password === trimmedPass : trimmedPass === '123')
    );

    if (matched) {
      if (!matched.isActive) {
        setLoginError('Tài khoản này hiện đang bị khóa trong CSDL. Vui lòng liên hệ Admin của đơn vị.');
        return;
      }
      // Save last used database connection
      setLastUsedDatabaseId(selectedDbId);
      onLogin(matched, selectedDbId);
    } else {
      setLoginError(
        'Mật khẩu không chính xác cho tài khoản này trong cơ sở dữ liệu đã chọn. (Mật khẩu mặc định: 123)'
      );
    }
  };

  // Scan Drive folder: searches or automatically creates 'SaleManager-Smart' folder
  const handleScanDrive = async () => {
    try {
      setIsScanningDrive(true);
      setDriveStatusNote('Đang kết nối Google Drive và kiểm tra thư mục "SaleManager-Smart"...');
      let token = await getAccessToken();
      if (!token) {
        const signRes = await googleSignIn();
        token = signRes?.accessToken || null;
      }
      if (!token) {
        alert('Vui lòng cho phép quyền truy cập Google Drive để quét danh sách cơ sở dữ liệu.');
        return;
      }

      setDriveStatusNote('Đang tìm kiếm các file Google Sheet trong thư mục "SaleManager-Smart"...');
      const files = await listSpreadsheetsInFolder(token);
      setDriveFiles(files);
      setShowDriveFilesList(true);
      setDriveStatusNote(`Tìm thấy ${files.length} file Google Sheets trong thư mục SaleManager-Smart.`);
    } catch (err: any) {
      alert(`Lỗi khi quét Google Drive: ${err.message}`);
    } finally {
      setIsScanningDrive(false);
    }
  };

  // Connect spreadsheet file found from drive
  const handleConnectDriveFile = async (file: { id: string; name: string }) => {
    const existing = profiles.find((p) => p.spreadsheetId === file.id);
    if (existing) {
      handleDbChange(existing.id);
      setShowDriveFilesList(false);
      return;
    }

    const cleanTitle = file.name.replace(/^SaleManager_Smart_/, '').replace(/_/g, ' ');
    const { profile } = createNewDatabase({
      name: cleanTitle || file.name,
      companyName: cleanTitle || file.name,
      taxCode: '',
      address: '',
      spreadsheetId: file.id,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
    });

    // Automatically load data from this Google Sheet right away
    try {
      const token = await getAccessToken();
      if (token) {
        const loadedFromSheet = await loadDataFromGoogleSheets(token, file.id);
        if (loadedFromSheet) {
          loadedFromSheet.databaseId = profile.id;
          loadedFromSheet.databaseName = profile.name;
          saveData(loadedFromSheet, profile.id);
        }
      }
    } catch (e) {
      console.debug('Error pre-loading connected spreadsheet data:', e);
    }

    setProfiles(loadDatabaseProfiles());
    handleDbChange(profile.id);
    onDatabaseCreated(profile);
    setShowDriveFilesList(false);
  };

  // Link existing sheet directly by URL or ID
  const handleLinkSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkSheetError(null);
    let raw = sheetUrlOrIdInput.trim();
    if (!raw) {
      setLinkSheetError('Vui lòng dán liên kết (URL) hoặc mã ID của file Google Sheet.');
      return;
    }

    // Extract ID from Google Sheet URL if full link was provided
    let extractedId = raw;
    const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      extractedId = match[1];
    }

    try {
      const existing = profiles.find((p) => p.spreadsheetId === extractedId);
      if (existing) {
        handleDbChange(existing.id);
        setShowLinkSheetModal(false);
        setSheetUrlOrIdInput('');
        return;
      }

      // Create new profile linked to this spreadsheet
      const { profile } = createNewDatabase({
        name: `Google Sheet (${extractedId.substring(0, 8)}...)`,
        companyName: `Đơn vị liên kết Google Sheet`,
        taxCode: '',
        address: '',
        spreadsheetId: extractedId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${extractedId}/edit`,
      });

      // Automatically load data from this Google Sheet right away
      try {
        const token = await getAccessToken();
        if (token) {
          const loadedFromSheet = await loadDataFromGoogleSheets(token, extractedId);
          if (loadedFromSheet) {
            loadedFromSheet.databaseId = profile.id;
            loadedFromSheet.databaseName = profile.name;
            saveData(loadedFromSheet, profile.id);
          }
        }
      } catch (e) {
        console.debug('Error pre-loading linked spreadsheet data:', e);
      }

      setProfiles(loadDatabaseProfiles());
      handleDbChange(profile.id);
      onDatabaseCreated(profile);
      setShowLinkSheetModal(false);
      setSheetUrlOrIdInput('');
    } catch (err: any) {
      setLinkSheetError(`Lỗi kết nối file: ${err.message}`);
    }
  };

  // Handle Create New Database with mandatory company fields: Tên đơn vị, MST, Địa chỉ
  const handleCreateNewDatabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newTaxCode.trim() || !newAddress.trim()) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc: Tên đơn vị, Mã số thuế và Địa chỉ trước khi tạo mới.');
      return;
    }

    try {
      setIsCreatingDb(true);
      setCreateDbStatusMsg('Đang khởi tạo cơ sở dữ liệu riêng biệt...');

      let spreadsheetId: string | undefined = undefined;
      let spreadsheetUrl: string | undefined = undefined;

      // Automatically create dedicated Google Spreadsheet in SaleManager-Smart folder if selected
      if (createGoogleSheetAlso) {
        try {
          setCreateDbStatusMsg(`Đang tự động kiểm tra/tạo thư mục "${DRIVE_FOLDER_NAME}" trên Google Drive...`);
          let token = await getAccessToken();
          if (!token) {
            const signRes = await googleSignIn();
            token = signRes?.accessToken || null;
          }
          if (token) {
            setCreateDbStatusMsg('Đang tạo file Google Sheet định dạng text trong thư mục SaleManager-Smart...');
            const res = await createDatabaseSpreadsheetOnDrive(
              token,
              newDbName || newCompanyName,
              newCompanyName
            );
            spreadsheetId = res.spreadsheetId;
            spreadsheetUrl = res.webUrl;
          }
        } catch (err) {
          console.warn('Không tạo Google Sheet tự động được lúc này, chuyển sang tạo CSDL cục bộ:', err);
        }
      }

      const { profile } = createNewDatabase({
        name: newDbName.trim() || newCompanyName.trim(),
        companyName: newCompanyName.trim(),
        taxCode: newTaxCode.trim(),
        address: newAddress.trim(),
        spreadsheetId,
        spreadsheetUrl,
      });

      const updatedList = loadDatabaseProfiles();
      setProfiles(updatedList);
      handleDbChange(profile.id);
      onDatabaseCreated(profile);
      setShowCreateDbModal(false);

      // Reset form
      setNewDbName('');
      setNewCompanyName('');
      setNewTaxCode('');
      setNewAddress('');
      setCreateDbStatusMsg(null);
    } catch (err: any) {
      alert(`Lỗi tạo cơ sở dữ liệu mới: ${err.message}`);
    } finally {
      setIsCreatingDb(false);
      setCreateDbStatusMsg(null);
    }
  };

  // Delete custom profile (cannot delete Demo)
  const handleDeleteCustomProfile = async (pId: string, pName: string) => {
    const ok = await confirm({
      title: 'Xóa cấu hình cơ sở dữ liệu',
      message: `Bạn có chắc muốn xóa cấu hình cơ sở dữ liệu "${pName}" khỏi danh sách trên máy này?`,
      confirmText: 'Xóa cấu hình',
      type: 'danger',
    });
    if (ok) {
      deleteDatabaseProfile(pId);
      const updated = loadDatabaseProfiles();
      setProfiles(updated);
      if (selectedDbId === pId) {
        handleDbChange(DEMO_DATABASE_ID);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-5 sm:p-6 text-white text-center relative shrink-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 backdrop-blur-md mb-2 border border-white/20 shadow-inner">
            <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
            CỬA SỔ ĐĂNG NHẬP & KẾT NỐI CƠ SỞ DỮ LIỆU
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-lg mx-auto">
            SaleManager-Smart • Phần mềm Quản lý Bán hàng, Kho bãi, Công nợ & Báo cáo FIFO
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/15 border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            Đa phương tiện: Máy tính • Điện thoại • Máy tính bảng
          </div>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* STEP 1: SELECT DATABASE & GOOGLE SHEET CONNECTION BEFORE WORKING */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border-2 border-slate-200 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-blue-600" />
                <span>1. Chọn cơ sở dữ liệu & File Google Sheet làm việc</span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateDbModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  title="Tạo cơ sở dữ liệu mới hoàn toàn trống cho công ty bạn"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Tạo CSDL mới trống</span>
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleScanDrive}
                  disabled={isScanningDrive}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                  title="Tìm kiếm các file Google Sheet trong thư mục SaleManager-Smart"
                >
                  <Cloud className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isScanningDrive ? 'Đang quét...' : 'Quét Drive'}</span>
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setShowLinkSheetModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                  title="Nhập URL hoặc ID Google Sheet trực tiếp"
                >
                  <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Gắn link Sheet</span>
                </button>
              </div>
            </div>

            {/* Dropdown to switch between databases */}
            <div className="relative">
              <select
                value={selectedDbId}
                onChange={(e) => handleDbChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.isDemo ? '⭐ [DỮ LIỆU MẪU DEMO] ' : '🏢 [CSDL THẬT] '}
                    {p.name} — {p.companyName} {p.taxCode ? `(MST: ${p.taxCode})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Database Summary Card */}
            {activeProfile && (
              <div
                className={`p-3.5 rounded-xl border text-xs transition-all ${
                  isSelectedDbDemo
                    ? 'bg-rose-50/50 border-rose-200'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {activeProfile.companyName}
                      </span>
                      {isSelectedDbDemo ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                          DỮ LIỆU MẪU (DEMO)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                          CSDL DOANH NGHIỆP
                        </span>
                      )}
                    </div>

                    <div className="text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                      {activeProfile.taxCode && (
                        <span className="font-mono">
                          <strong>MST:</strong> {activeProfile.taxCode}
                        </span>
                      )}
                      {activeProfile.address && (
                        <span>
                          <strong>Đ/C:</strong> {activeProfile.address}
                        </span>
                      )}
                    </div>

                    {/* Google Sheet Link Details */}
                    <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      {activeProfile.spreadsheetId ? (
                        <a
                          href={activeProfile.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${activeProfile.spreadsheetId}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium hover:underline"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Google Sheet ID: {activeProfile.spreadsheetId.substring(0, 12)}...</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          <Database className="w-3 h-3" />
                          Lưu trữ cục bộ trên trình duyệt (Chưa gắn Google Sheet)
                        </span>
                      )}

                      <span className="text-slate-400">
                        • Lần dùng trước: {new Date(activeProfile.lastUsedAt || activeProfile.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  {!isSelectedDbDemo && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomProfile(activeProfile.id, activeProfile.name)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 self-end sm:self-auto cursor-pointer"
                      title="Xóa hồ sơ CSDL này khỏi máy"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* BRIGHT RED WARNING WHEN DEMO DATABASE IS SELECTED */}
            {isSelectedDbDemo && (
              <div className="p-4 bg-rose-50 border-2 border-rose-500 rounded-2xl text-rose-950 text-xs shadow-md space-y-1.5 animate-pulse">
                <div className="flex items-center gap-2 font-black uppercase tracking-wide text-rose-700 text-sm">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>CẢNH BÁO ĐỎ: BẠN ĐANG CHỌN DỮ LIỆU MẪU (DEMO)</span>
                </div>
                <p className="leading-relaxed text-rose-900">
                  • Đây là dữ liệu giả lập được cài sẵn để thử nghiệm các tính năng của phần mềm.
                </p>
                <p className="leading-relaxed font-bold text-rose-700">
                  • Để đảm bảo an toàn, HỆ THỐNG KHÓA HOÀN TOÀN CHỨC NĂNG ĐỒNG BỘ LÊN GOOGLE SHEETS khi đang ở chế độ Dữ liệu mẫu Demo, tránh ghi đè làm mất dữ liệu kinh doanh thật của bạn!
                </p>
                <p className="leading-relaxed text-rose-900">
                  👉 Để làm việc thực tế: Vui lòng bấm vào nút <strong>"+ Tạo CSDL mới trống"</strong> ở trên để nhập thông tin đơn vị và tạo kho dữ liệu riêng, hoặc chọn <strong>"Quét Drive"</strong> để nạp file của bạn.
                </p>
              </div>
            )}
          </div>

          {/* Scanned Drive Files List Popover */}
          {showDriveFilesList && (
            <div className="p-4 bg-indigo-50/90 border-2 border-indigo-200 rounded-2xl space-y-3 text-xs">
              <div className="flex justify-between items-center font-bold text-indigo-950">
                <div className="flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-indigo-600" />
                  <span>Các file Google Sheets trong thư mục '{DRIVE_FOLDER_NAME}':</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDriveFilesList(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {driveStatusNote && (
                <div className="text-[11px] text-indigo-700 italic">{driveStatusNote}</div>
              )}

              {driveFiles.length === 0 ? (
                <div className="p-3 bg-white rounded-xl text-slate-500 text-center">
                  Chưa có file Google Sheets nào trong thư mục <strong>SaleManager-Smart</strong> trên Google Drive. Bạn có thể bấm <strong>"+ Tạo CSDL mới trống"</strong> để hệ thống tự động tạo file cho bạn.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {driveFiles.map((f) => (
                    <div
                      key={f.id}
                      className="p-2.5 bg-white rounded-xl border border-indigo-100 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="truncate">
                        <div className="font-bold text-slate-800 truncate">{f.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {f.id}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleConnectDriveFile(f)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                      >
                        Kết nối file này
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: USER ACCOUNT & PASSWORD LOGIN */}
          {/* REQUIREMENT: BỎ HẲN ĐĂNG NHẬP NHANH THEO VAI TRÒ! */}
          <form onSubmit={handleFormLogin} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                <span>2. Đăng nhập tài khoản người dùng</span>
              </label>
              <span className="text-[11px] text-slate-500">
                (Phân quyền lấy theo thẻ 'Phân quyền và người dùng')
              </span>
            </div>

            {loginError && (
              <div className="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Account Selector from configured users in database */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn hoặc nhập tài khoản người dùng:
                </label>
                <div className="relative">
                  <select
                    value={selectedAccountUsername}
                    onChange={(e) => setSelectedAccountUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.username}>
                        {u.fullName} ({u.username}) — [Vai trò: {u.role === 'admin' ? 'Admin' : u.role === 'manager' ? 'Quản lý' : 'Bán hàng'}]
                      </option>
                    ))}
                  </select>
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu tài khoản:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Mật khẩu mặc định: 123"
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Explanatory notice regarding strict role enforcement */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                Vai trò phân quyền (<strong>Admin</strong>, <strong>Quản lý</strong>, <strong>Nhân viên bán hàng</strong>) được xác định tự động theo cấu hình bảo mật trong thẻ <strong>"Phân quyền và người dùng"</strong> của cơ sở dữ liệu đã chọn.
              </div>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-98 cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              <span>XÁC NHẬN ĐĂNG NHẬP & BẮT ĐẦU LÀM VIỆC</span>
            </button>
          </form>
        </div>
      </div>

      {/* MODAL 1: CREATE NEW ISOLATED DATABASE (WITH MANDATORY COMPANY INFO) */}
      {showCreateDbModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4">
            <div className="bg-gradient-to-r from-indigo-700 to-blue-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building className="w-6 h-6 text-white" />
                <div>
                  <h3 className="font-bold text-base sm:text-lg">Tạo Cơ sở Dữ liệu Mới (Trống)</h3>
                  <p className="text-xs text-indigo-100">
                    Mỗi CSDL là độc lập và lưu tập trung trong thư mục SaleManager-Smart
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateDbModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewDatabaseSubmit} className="p-5 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên đơn vị / Doanh nghiệp <span className="text-rose-500">* (Bắt buộc)</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => {
                    setNewCompanyName(e.target.value);
                    if (!newDbName) {
                      setNewDbName(`CSDL_${e.target.value.replace(/\s+/g, '_')}`);
                    }
                  }}
                  placeholder="VD: CÔNG TY CỔ PHẦN CÔNG NGHỆ THĂNG LONG"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã số thuế (MST) <span className="text-rose-500">* (Bắt buộc)</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTaxCode}
                  onChange={(e) => setNewTaxCode(e.target.value)}
                  placeholder="VD: 0109888999"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Địa chỉ đơn vị <span className="text-rose-500">* (Bắt buộc)</span>
                </label>
                <input
                  type="text"
                  required
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="VD: Số 123 Đường Cầu Giấy, Quận Cầu Giấy, Hà Nội"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên cơ sở dữ liệu / Tên file:
                </label>
                <input
                  type="text"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  placeholder="VD: CSDL_ChiNhanhHanoi_2026"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Option to create isolated Google Sheet */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createGoogleSheetAlso}
                  onChange={(e) => setCreateGoogleSheetAlso(e.target.checked)}
                  className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-blue-900 leading-snug">
                  Tự động khởi tạo file Google Sheet riêng biệt tập trung trong thư mục <strong>SaleManager-Smart</strong> trên Google Drive cho cơ sở dữ liệu này.
                </span>
              </label>

              {createDbStatusMsg && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                  <span>{createDbStatusMsg}</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isCreatingDb}
                  onClick={() => setShowCreateDbModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingDb}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isCreatingDb ? 'Đang khởi tạo...' : 'Xác nhận tạo CSDL mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LINK EXISTING SPREADSHEET URL OR ID */}
      {showLinkSheetModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4">
            <div className="bg-gradient-to-r from-emerald-700 to-teal-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Link2 className="w-6 h-6 text-white" />
                <div>
                  <h3 className="font-bold text-base sm:text-lg">Gắn link Google Sheet có sẵn</h3>
                  <p className="text-xs text-emerald-100">
                    Kết nối trực tiếp bằng URL hoặc mã ID của file Google Sheet
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkSheetModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLinkSheetSubmit} className="p-5 space-y-4 text-xs sm:text-sm">
              {linkSheetError && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs">
                  {linkSheetError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đường dẫn (URL) hoặc mã ID Google Sheet:
                </label>
                <input
                  type="text"
                  required
                  value={sheetUrlOrIdInput}
                  onChange={(e) => setSheetUrlOrIdInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  File Google Sheet cần được chia sẻ quyền truy cập hoặc nằm trong Google Drive đã đăng nhập.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowLinkSheetModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Kết nối Google Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
