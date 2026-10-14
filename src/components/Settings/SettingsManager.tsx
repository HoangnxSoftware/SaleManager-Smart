import React, { useState } from 'react';
import { AppData, AppSettings, OrderCodeRule, OrderCodePatternType } from '../../types';
import { syncDataToGoogleSheets, loadDataFromGoogleSheets, getAccessToken, googleSignIn } from '../../services/googleDriveSheets';
import { DEFAULT_ORDER_CODE_RULES, formatOrderCode } from '../../services/orderCodeService';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Settings,
  Building,
  Hash,
  Cloud,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Database,
  Save,
  RotateCcw,
  Sparkles,
  Plus,
  Trash2,
  Edit,
  Check,
  Star,
  Tags,
  ArrowUpDown,
  X
} from 'lucide-react';

interface SettingsManagerProps {
  data: AppData;
  onUpdateSettings: (settings: AppSettings) => void;
  onRestoreFromSheets: (restoredData: AppData) => void;
  onResetEmptyData: () => void;
  onResetSampleData: () => void;
  onResequenceOrders?: () => void;
  onOpenSyncModal?: (mode: 'push' | 'pull') => void;
  onOpenSwitchDatabaseModal?: () => void;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  isAutoSyncing?: boolean;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  data,
  onUpdateSettings,
  onRestoreFromSheets,
  onResetEmptyData,
  onResetSampleData,
  onResequenceOrders,
  onOpenSyncModal,
  onOpenSwitchDatabaseModal,
  autoSyncEnabled = true,
  onToggleAutoSync,
  isAutoSyncing = false,
}) => {
  const confirm = useConfirm();
  const [form, setForm] = useState<AppSettings>({ ...data.settings });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);
  const [sheetsWebUrl, setSheetsWebUrl] = useState<string | null>(
    data.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit` : null
  );

  // Order Code Rules state
  const [rules, setRules] = useState<OrderCodeRule[]>(() => {
    return data.settings.orderCodeRules && data.settings.orderCodeRules.length > 0
      ? data.settings.orderCodeRules
      : DEFAULT_ORDER_CODE_RULES;
  });
  const [defaultRuleId, setDefaultRuleId] = useState<string>(() => {
    return data.settings.defaultOrderCodeRuleId || 'rule-dh';
  });

  // Modal for Add / Edit Rule
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<OrderCodeRule | null>(null);

  // Rule Form fields
  const [ruleName, setRuleName] = useState('');
  const [rulePatternType, setRulePatternType] = useState<OrderCodePatternType>('prefix_only');
  const [rulePrefix, setRulePrefix] = useState('DH');
  const [ruleSeparator, setRuleSeparator] = useState('-');
  const [ruleDateFormat, setRuleDateFormat] = useState<'YYYYMMDD' | 'YYMMDD' | 'DDMMYYYY' | 'YYYY-MM-DD'>('YYYYMMDD');
  const [ruleMinDigits, setRuleMinDigits] = useState(1);
  const [ruleIsDefault, setRuleIsDefault] = useState(false);

  const [showConfirmResetEmpty, setShowConfirmResetEmpty] = useState(false);
  const [showConfirmResetSample, setShowConfirmResetSample] = useState(false);

  const handleOpenAddRule = () => {
    setEditingRule(null);
    setRuleName('');
    setRulePatternType('prefix_only');
    setRulePrefix('DH');
    setRuleSeparator('-');
    setRuleDateFormat('YYYYMMDD');
    setRuleMinDigits(1);
    setRuleIsDefault(rules.length === 0);
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (r: OrderCodeRule) => {
    setEditingRule(r);
    setRuleName(r.name);
    setRulePatternType(r.patternType);
    setRulePrefix(r.prefix || '');
    setRuleSeparator(r.separator ?? '-');
    setRuleDateFormat(r.dateFormat || 'YYYYMMDD');
    setRuleMinDigits(r.minDigits || 1);
    setRuleIsDefault(r.isDefault || defaultRuleId === r.id);
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      alert('Vui lòng nhập tên quy tắc');
      return;
    }

    const ruleId = editingRule ? editingRule.id : `rule-${Date.now()}`;
    const newRule: OrderCodeRule = {
      id: ruleId,
      name: ruleName.trim(),
      patternType: rulePatternType,
      prefix: rulePrefix.trim().toUpperCase(),
      separator: ruleSeparator,
      dateFormat: ruleDateFormat,
      minDigits: Math.max(1, ruleMinDigits || 1),
      isDefault: ruleIsDefault,
      createdAt: editingRule?.createdAt || new Date().toISOString(),
    };

    let updatedRules: OrderCodeRule[];
    if (editingRule) {
      updatedRules = rules.map((r) => (r.id === editingRule.id ? newRule : r));
    } else {
      updatedRules = [...rules, newRule];
    }

    let newDefaultId = defaultRuleId;
    if (ruleIsDefault || updatedRules.length === 1) {
      newDefaultId = ruleId;
      updatedRules = updatedRules.map((r) => ({
        ...r,
        isDefault: r.id === ruleId,
      }));
    } else if (!updatedRules.some((r) => r.isDefault)) {
      newDefaultId = updatedRules[0].id;
      updatedRules[0].isDefault = true;
    }

    setRules(updatedRules);
    setDefaultRuleId(newDefaultId);
    const updatedSettings: AppSettings = {
      ...form,
      orderCodeRules: updatedRules,
      defaultOrderCodeRuleId: newDefaultId,
    };
    setForm(updatedSettings);
    onUpdateSettings(updatedSettings);
    setIsRuleModalOpen(false);
  };

  const handleSetDefaultRule = (ruleId: string) => {
    const updatedRules = rules.map((r) => ({
      ...r,
      isDefault: r.id === ruleId,
    }));
    setRules(updatedRules);
    setDefaultRuleId(ruleId);
    const updatedSettings: AppSettings = {
      ...form,
      orderCodeRules: updatedRules,
      defaultOrderCodeRuleId: ruleId,
    };
    setForm(updatedSettings);
    onUpdateSettings(updatedSettings);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (rules.length <= 1) {
      alert('Hệ thống cần tối thiểu 1 quy tắc tạo mã đơn!');
      return;
    }
    const target = rules.find((r) => r.id === ruleId);
    const ok = await confirm({
      title: 'Xác nhận xóa quy tắc',
      message: `Bạn có chắc chắn muốn xóa quy tắc tạo mã "${target?.name}" không?`,
      confirmText: 'Xác nhận xóa',
      type: 'danger',
    });
    if (!ok) return;

    let updatedRules = rules.filter((r) => r.id !== ruleId);
    let newDefaultId = defaultRuleId;
    if (defaultRuleId === ruleId) {
      newDefaultId = updatedRules[0].id;
      updatedRules = updatedRules.map((r, idx) => ({
        ...r,
        isDefault: idx === 0,
      }));
    }

    setRules(updatedRules);
    setDefaultRuleId(newDefaultId);
    const updatedSettings: AppSettings = {
      ...form,
      orderCodeRules: updatedRules,
      defaultOrderCodeRuleId: newDefaultId,
    };
    setForm(updatedSettings);
    onUpdateSettings(updatedSettings);
  };

  const handleTriggerResequence = async () => {
    const ok = await confirm({
      title: 'Xác nhận đánh số lại toàn bộ đơn hàng',
      message:
        'Hệ thống sẽ rà soát toàn bộ đơn hàng hiện có theo thứ tự ngày và thời gian tăng dần và đánh số lại liên tục theo từng quy tắc (DH-1, DH-2..., NB-1, NB-2...), tránh trùng đơn hàng. Bạn có muốn thực hiện không?',
      confirmText: 'Đồng ý đánh số lại',
      type: 'info',
    });
    if (ok && onResequenceOrders) {
      onResequenceOrders();
      alert('Đã cập nhật và đánh số lại toàn bộ mã đơn hàng theo quy tắc thành công!');
    }
  };

  const handleSaveCompanySettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(form);
    alert('Đã lưu cấu hình đơn vị và cài đặt số thập phân thành công!');
  };

  // Google Drive & Sheets Sync
  const handleSyncToDrive = async () => {
    if (data.isDemo) {
      setSyncErrorMsg(
        'CẢNH BÁO: Bạn đang sử dụng dữ liệu mẫu Demo! Hệ thống KHÔNG CHO PHÉP đồng bộ dữ liệu mẫu lên Google Sheets để tránh ghi đè dữ liệu kinh doanh thực tế. Vui lòng chuyển sang hoặc tạo cơ sở dữ liệu mới.'
      );
      return;
    }

    try {
      setIsSyncing(true);
      setSyncSuccessMsg(null);
      setSyncErrorMsg(null);

      let token = await getAccessToken();
      if (!token) {
        const signinRes = await googleSignIn();
        token = signinRes?.accessToken || null;
      }

      if (!token) {
        throw new Error('Vui lòng kết nối tài khoản Google để thực hiện sao lưu.');
      }

      const res = await syncDataToGoogleSheets(data, token);
      setSheetsWebUrl(res.webUrl);
      setSyncSuccessMsg(
        `Đã sao lưu thành công vào thư mục 'SaleManager-Smart' trên Google Drive và lưu trữ toàn bộ dữ liệu dưới dạng text trên Google Sheets!`
      );
    } catch (err: any) {
      console.error(err);
      setSyncErrorMsg(err.message || 'Lỗi khi đồng bộ Google Drive / Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Restore from Google Sheets
  const handleRestoreFromSheets = async () => {
    const ok = await confirm({
      title: 'Xác nhận nạp dữ liệu từ Google Sheets',
      message: 'Bạn có chắc muốn nạp dữ liệu từ Google Sheets về phần mềm? Dữ liệu hiện tại sẽ được thay thế bằng dữ liệu trên Google Sheets.',
      confirmText: 'Đồng ý nạp dữ liệu',
      type: 'warning',
    });
    if (!ok) {
      return;
    }

    try {
      setIsSyncing(true);
      setSyncSuccessMsg(null);
      setSyncErrorMsg(null);

      let token = await getAccessToken();
      if (!token) {
        const signinRes = await googleSignIn();
        token = signinRes?.accessToken || null;
      }

      if (!token) {
        throw new Error('Vui lòng kết nối tài khoản Google để tải dữ liệu.');
      }

      const restored = await loadDataFromGoogleSheets(token);
      if (restored) {
        onRestoreFromSheets(restored);
        setSyncSuccessMsg('Đã nạp và khôi phục dữ liệu từ Google Sheets thành công không mất định dạng!');
      } else {
        throw new Error('Không tìm thấy bản sao lưu hợp lệ trên Google Sheets trong thư mục SaleManager-Smart.');
      }
    } catch (err: any) {
      console.error(err);
      setSyncErrorMsg(err.message || 'Lỗi khi nạp dữ liệu từ Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Cài đặt Hệ thống & Thông tin chung
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý số thập phân, thông tin pháp nhân đơn vị, phương pháp FIFO và đồng bộ Google Drive / Sheets
          </p>
        </div>
      </div>

      {/* Section 1: Google Drive & Google Sheets Sync Hub & Working Database Management */}
      <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl space-y-5">
        {data.isDemo && (
          <div className="p-3 bg-rose-500/30 border-2 border-rose-400 rounded-xl text-rose-200 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
            <div>
              <span className="font-bold text-white uppercase block">
                CẢNH BÁO: ĐANG SỬ DỤNG DỮ LIỆU MẪU (DEMO)
              </span>
              Hệ thống không cho phép đồng bộ dữ liệu mẫu lên Google Sheets để tránh ghi đè dữ liệu thật. Vui lòng tạo CSDL mới hoặc kết nối CSDL thực tế ở cửa sổ đăng nhập.
            </div>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
              <Cloud className="w-7 h-7 text-blue-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                Đồng bộ & Sao lưu Google Drive / Google Sheets
              </h2>
              <p className="text-blue-200 text-xs mt-0.5">
                Thư mục tập trung: <span className="font-mono font-bold text-yellow-300">SaleManager-Smart</span> • Định dạng toàn bộ dạng Text chống mất số 0 và độ chính xác
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSyncing || data.isDemo}
              onClick={() => (onOpenSyncModal ? onOpenSyncModal('push') : handleSyncToDrive())}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all ${
                data.isDemo
                  ? 'bg-slate-600/50 text-slate-400 cursor-not-allowed border border-slate-500/30'
                  : 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer disabled:opacity-50'
              }`}
              title={data.isDemo ? 'Khóa đồng bộ vì đang dùng dữ liệu mẫu Demo' : 'Chọn CSDL và Đẩy dữ liệu lên Google Sheets'}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Đẩy dữ liệu lên Google Sheets</span>
            </button>

            <button
              type="button"
              disabled={isSyncing}
              onClick={() => (onOpenSyncModal ? onOpenSyncModal('pull') : handleRestoreFromSheets())}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs sm:text-sm border border-white/20 transition-all cursor-pointer disabled:opacity-50"
              title="Chọn CSDL và Nạp dữ liệu từ Google Sheets về phần mềm"
            >
              <Database className="w-4 h-4" />
              <span>Nạp từ Google Sheets</span>
            </button>
          </div>
        </div>

        {/* Working Database Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-yellow-400" />
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  Quản lý Cơ sở dữ liệu đang làm việc
                </h3>
                <p className="text-[11px] text-blue-200">
                  Thông tin kết nối & File lưu trữ Google Sheets đang sử dụng
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {data.spreadsheetId ? (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Mở trực tiếp file Google Sheets để kiểm tra bảng dữ liệu"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Mở file cơ sở dữ liệu (Google Sheets) để kiểm tra</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled={data.isDemo}
                  onClick={() => (onOpenSyncModal ? onOpenSyncModal('push') : handleSyncToDrive())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Kết nối / Tạo Google Sheets</span>
                </button>
              )}

              {onOpenSwitchDatabaseModal && (
                <button
                  type="button"
                  onClick={onOpenSwitchDatabaseModal}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold transition-all cursor-pointer"
                  title="Đổi sang cơ sở dữ liệu khác hoặc tạo mới"
                >
                  Đổi CSDL
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-blue-300 block mb-0.5">Tên cơ sở dữ liệu:</span>
              <span className="font-bold text-white text-sm truncate block">
                {data.databaseName || data.settings.companyName || 'CSDL Mặc định'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                ID: {data.databaseId || 'local'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-blue-300 block mb-0.5">Đơn vị & Mã số thuế:</span>
              <span className="font-bold text-white text-xs truncate block" title={data.settings.companyName}>
                {data.settings.companyName}
              </span>
              <span className="text-[11px] text-yellow-300 font-mono mt-0.5 block font-bold">
                MST: {data.settings.taxCode || 'Chưa cập nhật'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-blue-300 block mb-0.5">File Google Sheets:</span>
              {data.spreadsheetId ? (
                <div>
                  <span className="font-mono text-[11px] text-emerald-300 font-semibold block truncate">
                    {data.spreadsheetId}
                  </span>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-100 underline mt-0.5 font-bold"
                  >
                    <span>Xem file trên Google Sheets</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <span className="text-amber-300 italic">Chưa liên kết file Google Sheets</span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-blue-300 block mb-0.5">Lần đồng bộ gần nhất:</span>
              <span className="font-bold text-white text-xs block">
                {data.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString('vi-VN') : 'Chưa đồng bộ'}
              </span>
              <span className="text-[10px] text-blue-200 mt-1 block">
                {isAutoSyncing ? (
                  <span className="text-emerald-300 flex items-center gap-1 font-semibold animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Đang tự động đồng bộ...
                  </span>
                ) : autoSyncEnabled ? (
                  <span className="text-emerald-300 font-semibold">✓ Tự động 2 chiều đang bật</span>
                ) : (
                  <span className="text-slate-400">Tự động đồng bộ đang tắt</span>
                )}
              </span>
            </div>
          </div>

          {/* Real-time Bidirectional Auto-Sync Toggle */}
          <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-white">
                  Tự động đồng bộ 2 chiều (Đa thiết bị: PC, Điện thoại)
                </span>
                {autoSyncEnabled ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold">
                    ĐANG BẬT
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/40 text-[10px] font-bold">
                    ĐÃ TẮT
                  </span>
                )}
              </div>
              <p className="text-[11px] text-blue-200 leading-relaxed max-w-2xl">
                Tự động lưu lên Google Sheets khi có bất kỳ thay đổi về đơn hàng, khách hàng, phiếu nhập, NCC, sản phẩm; và tự động nạp lại khi có thiết bị khác cập nhật trên Google Sheets, đảm bảo mọi thiết bị máy tính, điện thoại cùng lúc đều có dữ liệu mới nhất.
              </p>
            </div>

            {onToggleAutoSync && (
              <button
                type="button"
                onClick={() => onToggleAutoSync(!autoSyncEnabled)}
                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 border ${
                  autoSyncEnabled
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400/50 shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 border-white/20'
                }`}
              >
                {autoSyncEnabled ? 'Tắt tự động đồng bộ' : 'Bật tự động đồng bộ'}
              </button>
            )}
          </div>
        </div>

        {/* Sync Status alerts */}
        {syncSuccessMsg && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
            {sheetsWebUrl && (
              <a
                href={sheetsWebUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold underline text-white hover:text-emerald-300 ml-2"
              >
                <span>Mở Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {syncErrorMsg && (
          <div className="p-3 bg-rose-500/20 border border-rose-400/40 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{syncErrorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs text-blue-200">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-white font-bold block mb-1">✓ Thư mục chuẩn:</span>
            Tập trung đồng bộ tự động vào thư mục <code className="text-yellow-300 font-mono font-bold">SaleManager-Smart</code> trên Google Drive.
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-white font-bold block mb-1">✓ Định dạng Text tuyệt đối:</span>
            Mọi cell số, MST, số thập phân 10 chữ số đều lưu dạng văn bản (Text), không bao giờ mất số 0 đầu hay sai lệch độ chính xác.
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-white font-bold block mb-1">✓ Kiểm tra đối chiếu thông tin:</span>
            Tự động cảnh báo đỏ nếu phát hiện sai lệch Tên đơn vị hoặc MST giữa phần mềm và Google Sheets để bảo toàn dữ liệu.
          </div>
        </div>
      </div>

      {/* Section 2: Decimal Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">
              Quản lý Số Thập Phân (Đơn giá mua, Đơn giá bán trước/sau thuế, Giá vốn)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdateSettings(form);
              alert('Đã lưu cấu hình số thập phân thành công!');
            }}
            className="self-start sm:self-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Lưu số thập phân
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Đơn giá mua (Đơn giá nhập)
            </label>
            <p className="text-[11px] text-slate-500">
              Quy định lấy chính xác đến 10 số thập phân để đảm bảo không bị sai lệch thành tiền và lũy kế kho.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="number"
                min="0"
                max="10"
                value={form.purchasePriceDecimals}
                onChange={(e) =>
                  setForm({ ...form, purchasePriceDecimals: parseInt(e.target.value) || 10 })
                }
                className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-center font-bold text-slate-900 bg-white"
              />
              <span className="text-xs text-slate-600 font-medium">chữ số thập phân</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Đơn giá bán trước thuế
            </label>
            <p className="text-[11px] text-slate-500">
              Trường hợp sửa đơn giá sau thuế, đơn giá trước thuế được tự động tính lại với số chữ số thập phân này.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="number"
                min="0"
                max="4"
                value={form.salePriceDecimals}
                onChange={(e) =>
                  setForm({ ...form, salePriceDecimals: parseInt(e.target.value) || 2 })
                }
                className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-center font-bold text-slate-900 bg-white"
              />
              <span className="text-xs text-slate-600 font-medium">chữ số thập phân</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-indigo-900 uppercase">
                Đơn giá bán sau thuế
              </label>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                Mới
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Nhập <strong>-2</strong> để làm tròn đến <strong>hàng chục</strong> (VD: 5.740 đ), <strong>-3</strong> hàng trăm, <strong>0</strong> hàng đơn vị, hoặc &gt; 0 số thập phân.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min="-4"
                max="4"
                value={form.postTaxSalePriceDecimals ?? -2}
                onChange={(e) =>
                  setForm({
                    ...form,
                    postTaxSalePriceDecimals: parseInt(e.target.value) !== undefined ? parseInt(e.target.value) : -2,
                  })
                }
                className="w-20 px-3 py-1.5 border border-indigo-300 rounded-lg text-center font-black text-indigo-900 bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-indigo-800 font-semibold">
                {(form.postTaxSalePriceDecimals ?? -2) === -2
                  ? '(Hàng chục: 5.740 đ)'
                  : (form.postTaxSalePriceDecimals ?? -2) === -3
                  ? '(Hàng trăm: 5.700 đ)'
                  : (form.postTaxSalePriceDecimals ?? -2) === -4
                  ? '(Hàng nghìn: 6.000 đ)'
                  : (form.postTaxSalePriceDecimals ?? -2) <= 0
                  ? '(Hàng đơn vị)'
                  : `${form.postTaxSalePriceDecimals} số thập phân`}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Giá vốn (Đơn giá xuất kho FIFO)
            </label>
            <p className="text-[11px] text-slate-500">
              Đơn giá xuất tính theo phương pháp FIFO để tính toán lợi nhuận và doanh thu thuần.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="number"
                min="0"
                max="6"
                value={form.costPriceDecimals}
                onChange={(e) =>
                  setForm({ ...form, costPriceDecimals: parseInt(e.target.value) || 2 })
                }
                className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-center font-bold text-slate-900 bg-white"
              />
              <span className="text-xs text-slate-600 font-medium">chữ số thập phân</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2.5: Quản lý Quy tắc tạo mã đơn bán hàng */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Tags className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                Quản lý Quy tắc tạo mã đơn bán hàng
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tạo mã đơn theo ký tự, ngày tháng hoặc kết hợp; tùy biến dấu ngăn cách (-, ;, , hoặc để trống); tự động tăng thứ tự và cập nhật lại khi xóa đơn hàng.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onResequenceOrders && (
              <button
                type="button"
                onClick={handleTriggerResequence}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                title="Đánh số lại toàn bộ đơn hàng theo đúng thứ tự ngày của từng quy tắc"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Đánh số lại toàn bộ đơn</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenAddRule}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm quy tắc mới</span>
            </button>
          </div>
        </div>

        {/* Rules Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center border-r border-slate-200">STT</th>
                <th className="p-3 border-r border-slate-200">Tên quy tắc</th>
                <th className="p-3 border-r border-slate-200">Kiểu quy tắc</th>
                <th className="p-3 border-r border-slate-200 font-mono text-center">Tiền tố</th>
                <th className="p-3 border-r border-slate-200 text-center">Dấu ngăn cách</th>
                <th className="p-3 border-r border-slate-200 font-mono text-center">Mẫu xem trước</th>
                <th className="p-3 border-r border-slate-200 text-center">Mặc định</th>
                <th className="p-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule, idx) => {
                const isDef = rule.isDefault || defaultRuleId === rule.id;
                const sample1 = formatOrderCode(rule, 1, '2026-01-01');
                const sample2 = formatOrderCode(rule, 2, '2026-01-01');
                const sample3 = formatOrderCode(rule, 3, '2026-01-01');

                return (
                  <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 text-center text-slate-400 font-medium border-r border-slate-100">
                      {idx + 1}
                    </td>
                    <td className="p-3 font-bold text-slate-900 border-r border-slate-100">
                      <div className="flex items-center gap-1.5">
                        {isDef && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                        <span>{rule.name}</span>
                      </div>
                    </td>
                    <td className="p-3 border-r border-slate-100">
                      {rule.patternType === 'prefix_only' && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                          Theo ký tự ({rule.prefix || '—'})
                        </span>
                      )}
                      {rule.patternType === 'prefix_and_date' && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                          Ký tự + Ngày ({rule.prefix || '—'} + {rule.dateFormat || 'YYYYMMDD'})
                        </span>
                      )}
                      {rule.patternType === 'date_only' && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                          Theo ngày tháng ({rule.dateFormat || 'YYYYMMDD'})
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-indigo-700 border-r border-slate-100">
                      {rule.prefix || '—'}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-800 border-r border-slate-100">
                      {rule.separator ? `"${rule.separator}"` : '(Để trống)'}
                    </td>
                    <td className="p-3 text-center font-mono text-slate-700 border-r border-slate-100 bg-slate-50/50">
                      <span className="font-bold text-blue-700">{sample1}</span>, {sample2}, {sample3}...
                    </td>
                    <td className="p-3 text-center border-r border-slate-100">
                      {isDef ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                          <Check className="w-3 h-3" /> Mặc định
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultRule(rule.id)}
                          className="px-2 py-0.5 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 font-medium text-[11px] transition-colors cursor-pointer"
                        >
                          Chọn làm mặc định
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditRule(rule)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer transition-colors"
                          title="Chỉnh sửa quy tắc"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          disabled={rules.length <= 1}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          title="Xóa quy tắc"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
          <span className="font-bold">Ghi chú về quy tắc tạo mã đơn:</span> Khi tạo hoặc sửa đơn hàng, người dùng có thể lựa chọn quy tắc tạo mã từ danh sách trên. Khi một đơn hàng phía trước bị xóa, hệ thống tự động cập nhật lại các đơn hàng phía sau theo thứ tự tăng dần liên tục của từng quy tắc (ví dụ: các đơn DH- sẽ được đánh số lại liên tục DH-1, DH-2... mà không ảnh hưởng tới các đơn NB-), đảm bảo tránh trùng lặp đơn hàng.
        </div>
      </div>

      {/* Section 3: Company Details & FIFO Method */}
      <form onSubmit={handleSaveCompanySettings} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-base">
              Thông tin chung về đơn vị kinh doanh
            </h3>
          </div>
          <div className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Phương pháp xuất kho: <span className="font-bold">Nhập trước xuất trước (FIFO)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên công ty / Cửa hàng
            </label>
            <input
              type="text"
              required
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mã số thuế (MST)
            </label>
            <input
              type="text"
              required
              value={form.taxCode}
              onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Địa chỉ trụ sở / Cửa hàng
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Số điện thoại liên hệ
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Số tài khoản ngân hàng
            </label>
            <input
              type="text"
              value={form.bankAccount}
              onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên ngân hàng & Chi nhánh
            </label>
            <input
              type="text"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Người đại diện pháp luật / Giám đốc
          </label>
          <input
            type="text"
            value={form.representative}
            onChange={(e) => setForm({ ...form, representative: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
          />
        </div>

        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Lưu tất cả Cài đặt</span>
          </button>
        </div>
      </form>

      {/* Section 4: Database reset options */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Database className="w-5 h-5 text-rose-600" />
          <h3 className="font-bold text-slate-800 text-base">
            Quản lý Dữ liệu Hệ thống (Reset & Khởi tạo)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="font-bold text-rose-900 text-sm">Tạo dữ liệu mới trống</h4>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                Xóa toàn bộ khách hàng, sản phẩm, phiếu nhập và đơn hàng. Hệ thống sẽ ở trạng thái trắng để bắt đầu đưa dữ liệu thực tế vào.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowConfirmResetEmpty(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs self-start cursor-pointer shadow-sm"
            >
              Làm trống toàn bộ cơ sở dữ liệu
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Khôi phục dữ liệu mẫu ban đầu</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Nạp lại dữ liệu mẫu về thiết bị điện Panasonic, Rạng Đông, Cadivi và các đơn hàng mẫu để kiểm thử tính năng FIFO, in ấn và báo cáo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowConfirmResetSample(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs self-start cursor-pointer shadow-sm"
            >
              Nạp lại dữ liệu mẫu Demo
            </button>
          </div>
        </div>
      </div>

      {/* Modal Confirm Reset Empty */}
      {showConfirmResetEmpty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Xác nhận làm trống cơ sở dữ liệu?</h3>
            <p className="text-xs text-slate-600">
              Thao tác này sẽ xóa sạch toàn bộ hàng hóa, phiếu nhập, đơn hàng và công nợ trên thiết bị này.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmResetEmpty(false)}
                className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetEmptyData();
                  setShowConfirmResetEmpty(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Đồng ý làm trống dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Reset Sample */}
      {showConfirmResetSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Nạp lại dữ liệu mẫu Demo?</h3>
            <p className="text-xs text-slate-600">
              Hệ thống sẽ nạp lại các đơn hàng, phiếu nhập kho Cadivi, Rạng Đông, Panasonic để trải nghiệm.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmResetSample(false)}
                className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetSampleData();
                  setShowConfirmResetSample(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Đồng ý nạp mẫu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm / Sửa Quy tắc tạo mã đơn */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-700 to-blue-700 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tags className="w-5 h-5 text-indigo-200" />
                <h3 className="font-bold text-base">
                  {editingRule ? 'Chỉnh sửa Quy tắc tạo mã đơn' : 'Thêm Quy tắc tạo mã đơn mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="p-1.5 text-indigo-200 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tên quy tắc <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Ví dụ: Đơn bán hàng chuẩn (DH-), Đơn nội bộ (NB-)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Kiểu quy tắc
                  </label>
                  <select
                    value={rulePatternType}
                    onChange={(e) => setRulePatternType(e.target.value as OrderCodePatternType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white cursor-pointer"
                  >
                    <option value="prefix_only">Theo ký tự (VD: DH-1)</option>
                    <option value="prefix_and_date">Ký tự + Ngày tháng (VD: DH-20260101-1)</option>
                    <option value="date_only">Theo ngày tháng (VD: 20260101-1)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tiền tố ký tự (Prefix)
                  </label>
                  <input
                    type="text"
                    value={rulePrefix}
                    onChange={(e) => setRulePrefix(e.target.value)}
                    placeholder="VD: DH, NB, BH..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-indigo-800 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Dấu ngăn cách
                  </label>
                  <input
                    type="text"
                    value={ruleSeparator}
                    onChange={(e) => setRuleSeparator(e.target.value)}
                    placeholder="VD: -, ;, , hoặc để trống"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-center text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5 text-center">
                    (Có thể là -, ;, , hoặc để trống)
                  </span>
                </div>

                {rulePatternType !== 'prefix_only' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Định dạng ngày
                    </label>
                    <select
                      value={ruleDateFormat}
                      onChange={(e) => setRuleDateFormat(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white cursor-pointer"
                    >
                      <option value="YYYYMMDD">YYYYMMDD (20260101)</option>
                      <option value="YYMMDD">YYMMDD (260101)</option>
                      <option value="DDMMYYYY">DDMMYYYY (01012026)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Định dạng ngày
                    </label>
                    <div className="px-3 py-2 bg-slate-100 rounded-xl text-xs text-slate-400 text-center font-medium">
                      Không áp dụng
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Chữ số tối thiểu STT
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={ruleMinDigits}
                    onChange={(e) => setRuleMinDigits(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-center text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5 text-center">
                    (1: 1,2,3; 2: 01,02; 3: 001)
                  </span>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
                <span className="text-xs font-bold text-indigo-900 block">
                  Mẫu xem trước mã đơn hàng sẽ sinh:
                </span>
                <div className="font-mono text-sm font-bold text-indigo-800 flex flex-wrap items-center gap-2">
                  <span className="px-2 py-1 bg-white rounded-lg border border-indigo-200 shadow-2xs">
                    {formatOrderCode(
                      {
                        id: 'preview',
                        name: '',
                        patternType: rulePatternType,
                        prefix: rulePrefix,
                        separator: ruleSeparator,
                        dateFormat: ruleDateFormat,
                        minDigits: ruleMinDigits,
                        isDefault: false,
                      },
                      1,
                      '2026-01-01'
                    )}
                  </span>
                  <span>→</span>
                  <span className="px-2 py-1 bg-white rounded-lg border border-indigo-200 shadow-2xs">
                    {formatOrderCode(
                      {
                        id: 'preview',
                        name: '',
                        patternType: rulePatternType,
                        prefix: rulePrefix,
                        separator: ruleSeparator,
                        dateFormat: ruleDateFormat,
                        minDigits: ruleMinDigits,
                        isDefault: false,
                      },
                      2,
                      '2026-01-01'
                    )}
                  </span>
                  <span>→</span>
                  <span className="px-2 py-1 bg-white rounded-lg border border-indigo-200 shadow-2xs">
                    {formatOrderCode(
                      {
                        id: 'preview',
                        name: '',
                        patternType: rulePatternType,
                        prefix: rulePrefix,
                        separator: ruleSeparator,
                        dateFormat: ruleDateFormat,
                        minDigits: ruleMinDigits,
                        isDefault: false,
                      },
                      3,
                      '2026-01-01'
                    )}
                  </span>
                </div>
              </div>

              {/* Default checkbox */}
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ruleIsDefault}
                  onChange={(e) => setRuleIsDefault(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Đặt làm quy tắc mặc định khi tạo đơn hàng mới
                </span>
              </label>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-colors"
                >
                  {editingRule ? 'Cập nhật quy tắc' : 'Lưu quy tắc mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
