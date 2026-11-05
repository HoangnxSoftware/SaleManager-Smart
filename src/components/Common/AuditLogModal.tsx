import React, { useState, useMemo } from 'react';
import { AuditLogEntry, AuditLogAction, AuditLogEntity, AppUser } from '../../types';
import { ACTION_LABELS, ENTITY_LABELS, exportAuditLogsToExcel } from '../../services/auditLogService';
import {
  X,
  History,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Laptop,
  CheckCircle2,
  Trash2,
  Edit,
  PlusCircle,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
  users: AppUser[];
  databaseName?: string;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  logs,
  users,
  databaseName = 'SaleManager',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (entityFilter !== 'all' && log.entity !== entityFilter) return false;
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (userFilter !== 'all' && log.userId !== userFilter && log.userName !== userFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = log.entityName.toLowerCase().includes(q);
        const matchDetails = log.details.toLowerCase().includes(q);
        const matchUser = log.userName.toLowerCase().includes(q);
        const matchDevice = (log.deviceName || '').toLowerCase().includes(q);
        if (!matchName && !matchDetails && !matchUser && !matchDevice) return false;
      }

      return true;
    });
  }, [logs, entityFilter, actionFilter, userFilter, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 shadow-inner">
              <History className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold">
                  Nhật ký thao tác & Người chỉnh sửa gần nhất
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Thời gian thực
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Ghi nhận chi tiết người dùng thêm, sửa, xóa dữ liệu để đồng bộ đa thiết bị chính xác
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportAuditLogsToExcel(logs, databaseName)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Xuất nhật ký ra file Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto flex-1">
            {/* Search */}
            <div className="relative min-w-48 flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="Tìm đối tượng, người sửa, thiết bị..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            </div>

            {/* Entity filter */}
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-xl font-medium text-slate-700 cursor-pointer"
            >
              <option value="all">Tất cả phân hệ</option>
              <option value="order">Đơn bán hàng</option>
              <option value="product">Hàng hóa / Sản phẩm</option>
              <option value="customer">Khách hàng</option>
              <option value="supplier">Đơn vị cung cấp</option>
              <option value="purchase">Phiếu nhập kho</option>
              <option value="debt_payment">Thanh toán công nợ</option>
              <option value="settings">Cài đặt / Quy tắc</option>
            </select>

            {/* Action filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-xl font-medium text-slate-700 cursor-pointer"
            >
              <option value="all">Tất cả hành động</option>
              <option value="create">Thêm mới</option>
              <option value="update">Chỉnh sửa</option>
              <option value="delete">Xóa dữ liệu</option>
              <option value="import">Nhập Excel</option>
              <option value="status_change">Đổi trạng thái</option>
            </select>

            {/* User filter */}
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-xl font-medium text-slate-700 cursor-pointer"
            >
              <option value="all">Tất cả người dùng</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.username})
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Hiển thị <strong>{filteredLogs.length}</strong> / <strong>{logs.length}</strong> nhật ký
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto overflow-y-auto flex-1 p-3 sm:p-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">Chưa có nhật ký thao tác phù hợp</p>
              <p className="text-xs text-slate-400 mt-1">
                Các thao tác thêm đơn hàng, sửa giá, xóa phiếu nhập, v.v. sẽ tự động được ghi lại tại đây.
              </p>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse min-w-[750px]">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="p-2.5 w-10 text-center">STT</th>
                  <th className="p-2.5 w-36 text-left">Thời gian</th>
                  <th className="p-2.5 w-44 text-left">Người thực hiện</th>
                  <th className="p-2.5 w-28 text-center">Hành động</th>
                  <th className="p-2.5 w-32 text-left">Phân hệ</th>
                  <th className="p-2.5 min-w-44 text-left">Đối tượng</th>
                  <th className="p-2.5 min-w-56 text-left">Nội dung chi tiết</th>
                  <th className="p-2.5 w-40 text-left">Thiết bị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log, idx) => {
                  const actionMeta = ACTION_LABELS[log.action] || {
                    label: log.action,
                    color: 'bg-slate-100 text-slate-800',
                  };

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-2.5 text-slate-600 font-mono whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{log.userName}</div>
                        <span className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                          {log.userRole === 'admin' ? 'Admin' : log.userRole === 'manager' ? 'Quản lý' : 'Bán hàng'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${actionMeta.color}`}
                        >
                          {actionMeta.label}
                        </span>
                      </td>
                      <td className="p-2.5 font-medium text-slate-700 whitespace-nowrap">
                        {ENTITY_LABELS[log.entity] || log.entity}
                      </td>
                      <td className="p-2.5 font-bold font-mono text-slate-800">
                        {log.entityName}
                      </td>
                      <td className="p-2.5 text-slate-700">
                        {log.details}
                      </td>
                      <td className="p-2.5 text-slate-500 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 text-[11px]">
                          <Laptop className="w-3 h-3 text-slate-400" />
                          <span>{log.deviceName || 'Thiết bị'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Nhật ký được tự động đồng bộ lên Google Sheets theo thời gian thực để đối soát liên thiết bị.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
