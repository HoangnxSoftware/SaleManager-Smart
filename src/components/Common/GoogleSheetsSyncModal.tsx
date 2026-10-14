import React, { useState, useEffect } from 'react';
import { AppData, DatabaseProfile } from '../../types';
import {
  listSpreadsheetsInFolder,
  fetchSpreadsheetMetadata,
  SpreadsheetMetadata,
  syncDataToGoogleSheets,
  loadDataFromGoogleSheets,
  createDatabaseSpreadsheetOnDrive,
  getAccessToken,
  googleSignIn,
  DRIVE_FOLDER_NAME,
} from '../../services/googleDriveSheets';
import { createNewDatabase } from '../../services/storage';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Cloud,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  PlusCircle,
  FileSpreadsheet,
  Building2,
  Hash,
  ShieldAlert,
  ArrowRight,
  Database,
  Info,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  mode: 'push' | 'pull';
  data: AppData;
  onClose: () => void;
  onSuccessPush?: (spreadsheetId: string, webUrl: string) => void;
  onSuccessPull?: (restoredData: AppData) => void;
  onDatabaseCreated?: (profile: DatabaseProfile) => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  mode,
  data,
  onClose,
  onSuccessPush,
  onSuccessPull,
  onDatabaseCreated,
}) => {
  const confirm = useConfirm();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<Array<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }>>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);

  const [selectedSheetId, setSelectedSheetId] = useState<string>(data.spreadsheetId || '');
  const [remoteMetadata, setRemoteMetadata] = useState<SpreadsheetMetadata | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize and check Google token
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const checkAuthAndLoad = async () => {
      try {
        let token = await getAccessToken();
        if (token) {
          setAccessToken(token);
          loadSheets(token);
        }
      } catch (e) {
        console.error('Failed to get cached access token:', e);
      }
    };
    checkAuthAndLoad();
  }, [isOpen]);

  // Load sheets list
  const loadSheets = async (token: string) => {
    try {
      setIsLoadingSheets(true);
      const files = await listSpreadsheetsInFolder(token);
      setSpreadsheets(files);

      // Default selection logic: pick current data.spreadsheetId, or the first file matching company name, or files[0]
      if (files.length > 0) {
        if (data.spreadsheetId && files.some((f) => f.id === data.spreadsheetId)) {
          setSelectedSheetId(data.spreadsheetId);
        } else {
          // Check if any file name matches
          const match = files.find((f) =>
            f.name.toLowerCase().includes((data.settings.companyName || '').toLowerCase().substring(0, 10))
          );
          setSelectedSheetId(match ? match.id : files[0].id);
        }
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || 'Lỗi khi tải danh sách Google Sheets từ thư mục SaleManager-Smart.');
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleSignInGoogle = async () => {
    try {
      setIsAuthenticating(true);
      setErrorMessage(null);
      const res = await googleSignIn();
      if (res?.accessToken) {
        setAccessToken(res.accessToken);
        await loadSheets(res.accessToken);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || 'Lỗi kết nối tài khoản Google.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Whenever selectedSheetId changes, fetch its metadata to check companyName & taxCode
  useEffect(() => {
    if (!selectedSheetId || !accessToken) {
      setRemoteMetadata(null);
      return;
    }

    let isMounted = true;
    const fetchMeta = async () => {
      try {
        setIsLoadingMeta(true);
        const meta = await fetchSpreadsheetMetadata(accessToken, selectedSheetId);
        if (isMounted) {
          setRemoteMetadata(meta);
        }
      } catch (e) {
        console.error('Failed to fetch sheet metadata:', e);
      } finally {
        if (isMounted) setIsLoadingMeta(false);
      }
    };

    fetchMeta();
    return () => {
      isMounted = false;
    };
  }, [selectedSheetId, accessToken]);

  if (!isOpen) return null;

  // Comparison logic
  const currentCompany = (data.settings.companyName || '').trim();
  const currentTaxCode = (data.settings.taxCode || '').trim();

  const remoteCompany = (remoteMetadata?.companyName || '').trim();
  const remoteTaxCode = (remoteMetadata?.taxCode || '').trim();

  // Check mismatch: if remote has company or taxCode and doesn't match current
  const isCompanyNameMismatch =
    !!remoteCompany && remoteCompany.toLowerCase() !== currentCompany.toLowerCase();
  const isTaxCodeMismatch =
    !!remoteTaxCode && remoteTaxCode.toLowerCase() !== currentTaxCode.toLowerCase();

  const hasMismatch = isCompanyNameMismatch || isTaxCodeMismatch;

  // Action: Create brand new safe spreadsheet to preserve data
  const handleCreateNewDatabaseSpreadsheet = async () => {
    if (!accessToken) return;
    try {
      setIsExecuting(true);
      setErrorMessage(null);

      // Create new spreadsheet on Drive
      const cleanDbName = data.databaseName || data.settings.companyName || 'CSDL Mới';
      const created = await createDatabaseSpreadsheetOnDrive(
        accessToken,
        cleanDbName,
        data.settings.companyName
      );

      // Push current data to this new spreadsheet
      const synced = await syncDataToGoogleSheets(data, accessToken, created.spreadsheetId);

      // If local DB profile creation hook provided
      if (onDatabaseCreated) {
        const newDb = createNewDatabase({
          name: cleanDbName,
          companyName: data.settings.companyName,
          taxCode: data.settings.taxCode,
          address: data.settings.address,
          spreadsheetId: created.spreadsheetId,
          spreadsheetUrl: created.webUrl,
        });
        onDatabaseCreated(newDb.profile);
      }

      setSuccessMessage(
        `Đã sinh ra một cơ sở dữ liệu mới hoàn toàn trên Google Sheets (${created.spreadsheetId}) để bảo toàn dữ liệu thành công!`
      );
      if (onSuccessPush) {
        onSuccessPush(created.spreadsheetId, created.webUrl);
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || 'Lỗi khi tạo cơ sở dữ liệu mới trên Google Drive.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Action: Execute Push with current selected spreadsheet
  const handleExecutePush = async (forceOverwrite = false) => {
    if (!accessToken || !selectedSheetId) return;

    if (hasMismatch && !forceOverwrite) {
      const ok = await confirm({
        title: 'CẢNH BÁO ĐỒNG BỘ KHÔNG KHỚP DỮ LIỆU',
        message: `Tên đơn vị hoặc Mã số thuế trên Google Sheets đã chọn (${remoteCompany || 'Chưa rõ'} - MST: ${remoteTaxCode || 'Chưa rõ'}) khác với phần mềm hiện tại (${currentCompany} - MST: ${currentTaxCode}). Bạn có chắc chắn muốn ghi đè lên file này không?`,
        confirmText: 'Vẫn ghi đè lên file này',
        cancelText: 'Hủy bỏ',
        type: 'danger',
      });
      if (!ok) return;
    }

    try {
      setIsExecuting(true);
      setErrorMessage(null);

      const res = await syncDataToGoogleSheets(data, accessToken, selectedSheetId);
      setSuccessMessage(
        'Đã đẩy và sao lưu dữ liệu toàn vẹn dạng text lên Google Sheets thành công!'
      );
      if (onSuccessPush) {
        onSuccessPush(res.spreadsheetId, res.webUrl);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || 'Lỗi khi đẩy dữ liệu lên Google Sheets.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Action: Execute Pull (Restore) with current selected spreadsheet
  const handleExecutePull = async (forceOverwrite = false) => {
    if (!accessToken || !selectedSheetId) return;

    if (hasMismatch && !forceOverwrite) {
      const ok = await confirm({
        title: 'CẢNH BÁO NẠP DỮ LIỆU ĐƠN VỊ KHÁC',
        message: `Dữ liệu trên Google Sheets thuộc về đơn vị: "${remoteCompany || 'Chưa rõ'}" (MST: ${remoteTaxCode || 'Chưa rõ'}), khác với đơn vị hiện tại của bạn: "${currentCompany}" (MST: ${currentTaxCode}). Nếu nạp, dữ liệu trong phần mềm hiện tại sẽ bị thay thế. Bạn có chắc chắn muốn tiếp tục không?`,
        confirmText: 'Vẫn tiếp tục nạp dữ liệu',
        cancelText: 'Hủy bỏ',
        type: 'danger',
      });
      if (!ok) return;
    }

    try {
      setIsExecuting(true);
      setErrorMessage(null);

      const restored = await loadDataFromGoogleSheets(accessToken, selectedSheetId);
      if (!restored) {
        throw new Error('Không đọc được dữ liệu hợp lệ từ file Google Sheets đã chọn.');
      }

      setSuccessMessage('Đã nạp và khôi phục dữ liệu từ Google Sheets thành công!');
      if (onSuccessPull) {
        onSuccessPull(restored);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || 'Lỗi khi nạp dữ liệu từ Google Sheets.');
    } finally {
      setIsExecuting(false);
    }
  };

  const selectedSheetObj = spreadsheets.find((s) => s.id === selectedSheetId);
  const openSheetWebUrl = selectedSheetId
    ? `https://docs.google.com/spreadsheets/d/${selectedSheetId}/edit`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 px-6 py-4.5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 text-blue-300 border border-white/20">
              <Cloud className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">
                {mode === 'push'
                  ? 'Đẩy dữ liệu (Sao lưu) lên Google Sheets'
                  : 'Nạp dữ liệu từ Google Sheets'}
              </h3>
              <p className="text-xs text-blue-200">
                Thư mục tập trung: <span className="font-mono text-yellow-300 font-bold">{DRIVE_FOLDER_NAME}</span> trên Google Drive
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isExecuting}
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Demo Warning */}
          {data.isDemo && mode === 'push' && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs flex items-center gap-2.5 font-bold">
              <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
              <span>
                CẢNH BÁO: BẠN ĐANG DÙNG CSDL MẪU (DEMO) — KHÔNG CHO PHÉP ĐỒNG BỘ LÊN GOOGLE SHEETS ĐỂ TRÁNH GHI ĐÈ DỮ LIỆU KINH DOANH THẬT!
              </span>
            </div>
          )}

          {/* Step 1: Google Account Check */}
          {!accessToken ? (
            <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Kết nối tài khoản Google Drive & Sheets</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Để chọn cơ sở dữ liệu đồng bộ trên Google Drive, vui lòng kết nối tài khoản Google của bạn.
                </p>
              </div>
              <button
                type="button"
                disabled={isAuthenticating}
                onClick={handleSignInGoogle}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang kết nối...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>Đăng nhập với Google</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {/* Step 2: Select Database Spreadsheet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-blue-600" />
                    Chọn Cơ sở dữ liệu (Google Sheets) để đồng bộ:
                  </label>
                  <button
                    type="button"
                    onClick={() => loadSheets(accessToken)}
                    disabled={isLoadingSheets}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingSheets ? 'animate-spin' : ''}`} />
                    <span>Làm mới danh sách</span>
                  </button>
                </div>

                {isLoadingSheets ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Đang đọc danh sách file Google Sheets trong thư mục SaleManager-Smart...</span>
                  </div>
                ) : spreadsheets.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
                    <p className="font-semibold">
                      Chưa tìm thấy file Google Sheets nào trong thư mục <code className="font-mono font-bold text-amber-950">SaleManager-Smart</code>.
                    </p>
                    <p className="text-[11px]">
                      Bạn có thể bấm nút bên dưới để tự động tạo một file Google Sheets mới cho cơ sở dữ liệu hiện tại.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <select
                      value={selectedSheetId}
                      onChange={(e) => setSelectedSheetId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {spreadsheets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.modifiedTime ? `(Cập nhật: ${formatDate(s.modifiedTime)})` : ''}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                      <span>ID Sheet: <span className="font-mono text-slate-700 font-semibold">{selectedSheetId || 'Chưa chọn'}</span></span>
                      {openSheetWebUrl && (
                        <a
                          href={openSheetWebUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                          title="Mở file Google Sheets trực tiếp để kiểm tra"
                        >
                          <span>Mở file để kiểm tra</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Information comparison & Mismatch Pre-Check */}
              {selectedSheetId && (
                <div className="space-y-3 pt-1">
                  {isLoadingMeta ? (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Đang kiểm tra thông tin pháp nhân và mã số thuế từ Google Sheets...</span>
                    </div>
                  ) : hasMismatch ? (
                    /* RED WARNING BOX FOR MISMATCH */
                    <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-500 text-rose-900 space-y-3 shadow-sm animate-in fade-in">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-black text-sm uppercase text-rose-700 tracking-wide">
                            CẢNH BÁO ĐỒNG BỘ SAI DỮ LIỆU: TÊN ĐƠN VỊ HOẶC MÃ SỐ THUẾ KHÔNG KHỚP!
                          </h4>
                          <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
                            Yêu cầu bạn kiểm tra kỹ thông tin trước khi đồng bộ! Nếu đồng bộ có thể dẫn đến việc ghi đè hoặc nạp nhầm dữ liệu của đơn vị kinh doanh khác.
                          </p>
                        </div>
                      </div>

                      {/* Comparison Table */}
                      <div className="rounded-xl overflow-hidden border border-rose-200 bg-white text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-rose-100/70 text-rose-900 font-bold border-b border-rose-200">
                            <tr>
                              <th className="p-2.5">Tiêu chí đối chiếu</th>
                              <th className="p-2.5 bg-blue-50 text-blue-900">Phần mềm hiện tại</th>
                              <th className="p-2.5 bg-amber-50 text-amber-900">Google Sheets đã chọn</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rose-100">
                            <tr>
                              <td className="p-2.5 font-semibold text-slate-700">Tên đơn vị</td>
                              <td className="p-2.5 font-bold text-blue-700 bg-blue-50/40">{currentCompany}</td>
                              <td className="p-2.5 font-bold text-rose-700 bg-amber-50/40">
                                {remoteCompany || '(Trống hoặc chưa có)'}
                              </td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-semibold text-slate-700">Mã số thuế</td>
                              <td className="p-2.5 font-mono font-bold text-blue-700 bg-blue-50/40">{currentTaxCode || '(Trống)'}</td>
                              <td className="p-2.5 font-mono font-bold text-rose-700 bg-amber-50/40">
                                {remoteTaxCode || '(Trống)'}
                              </td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-semibold text-slate-700">Lần đồng bộ gần nhất</td>
                              <td className="p-2.5 text-slate-600 bg-blue-50/40">
                                {data.lastSyncedAt ? formatDate(data.lastSyncedAt) : 'Chưa đồng bộ'}
                              </td>
                              <td className="p-2.5 text-slate-600 bg-amber-50/40">
                                {remoteMetadata?.lastSyncedAt ? formatDate(remoteMetadata.lastSyncedAt) : 'Chưa rõ'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Solutions to preserve data */}
                      <div className="pt-1 space-y-2">
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Info className="w-4 h-4 text-blue-600" />
                          <span>Giải pháp khuyến nghị để bảo toàn dữ liệu:</span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          {/* Option 1: Create new database spreadsheet to preserve data (Recommended) */}
                          <button
                            type="button"
                            disabled={isExecuting}
                            onClick={handleCreateNewDatabaseSpreadsheet}
                            className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                          >
                            <PlusCircle className="w-4 h-4 shrink-0" />
                            <span>(Khuyên dùng) Sinh ra một CSDL mới để bảo toàn dữ liệu</span>
                          </button>

                          {/* Option 2: Force continue */}
                          <button
                            type="button"
                            disabled={isExecuting || (data.isDemo && mode === 'push')}
                            onClick={() => (mode === 'push' ? handleExecutePush(true) : handleExecutePull(true))}
                            className="px-4 py-3 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs transition-colors cursor-pointer"
                            title="Chấp nhận ghi đè dữ liệu dù thông tin không khớp"
                          >
                            Vẫn tiếp tục đồng bộ
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* GREEN SAFE BOX */
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>✓ Thông tin đơn vị và mã số thuế hoàn toàn trùng khớp. An toàn để đồng bộ!</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-emerald-200">
                        <div>
                          <span className="text-slate-500 block">Tên đơn vị:</span>
                          <span className="font-bold text-slate-800 truncate block">{currentCompany}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Mã số thuế:</span>
                          <span className="font-mono font-bold text-slate-800 block">{currentTaxCode || 'Chưa thiết lập'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status messages */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{successMessage}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {accessToken && (
              <button
                type="button"
                disabled={isExecuting}
                onClick={handleCreateNewDatabaseSpreadsheet}
                className="inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
                title="Tạo file Google Sheets riêng biệt mới"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Tạo file Google Sheets mới</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isExecuting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>

            {accessToken && !hasMismatch && (
              <button
                type="button"
                disabled={isExecuting || !selectedSheetId || (data.isDemo && mode === 'push')}
                onClick={() => (mode === 'push' ? handleExecutePush(false) : handleExecutePull(false))}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : mode === 'push' ? (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>Xác nhận Đẩy dữ liệu</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>Xác nhận Nạp dữ liệu</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
