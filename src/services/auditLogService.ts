import { AuditLogEntry, AuditLogAction, AuditLogEntity, AppUser } from '../types';
import { getCurrentDeviceId, getCurrentDeviceName } from './deviceService';
import * as XLSX from 'xlsx';

export function createAuditLogEntry(
  currentUser: AppUser,
  action: AuditLogAction,
  entity: AuditLogEntity,
  entityName: string,
  details: string,
  entityId?: string
): AuditLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    userId: currentUser.id,
    userName: currentUser.fullName || currentUser.username,
    userRole: currentUser.role,
    action,
    entity,
    entityId,
    entityName,
    details,
    deviceId: getCurrentDeviceId(),
    deviceName: getCurrentDeviceName(),
  };
}

export function appendAuditLog(
  currentLogs: AuditLogEntry[] = [],
  newEntry: AuditLogEntry,
  maxEntries = 1000
): AuditLogEntry[] {
  const updated = [newEntry, ...currentLogs];
  if (updated.length > maxEntries) {
    return updated.slice(0, maxEntries);
  }
  return updated;
}

export const ACTION_LABELS: Record<AuditLogAction, { label: string; color: string }> = {
  create: { label: 'Thêm mới', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  update: { label: 'Chỉnh sửa', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  delete: { label: 'Xóa dữ liệu', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  import: { label: 'Nhập Excel', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  import_excel: { label: 'Nhập Excel', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  status_change: { label: 'Đổi trạng thái', color: 'bg-amber-100 text-amber-800 border-amber-300' },
};

export const ENTITY_LABELS: Record<AuditLogEntity, string> = {
  order: 'Đơn bán hàng',
  product: 'Sản phẩm / Hàng hóa',
  customer: 'Khách hàng',
  supplier: 'Đơn vị cung cấp',
  purchase: 'Phiếu nhập kho',
  debt: 'Thanh toán công nợ',
  debt_payment: 'Thanh toán công nợ',
  user: 'Người dùng / Phân quyền',
  settings: 'Cài đặt hệ thống',
};

export function exportAuditLogsToExcel(logs: AuditLogEntry[], databaseName = 'SaleManager'): void {
  const rows = logs.map((log, idx) => ({
    STT: idx + 1,
    'Thời gian': new Date(log.timestamp).toLocaleString('vi-VN'),
    'Người thực hiện': log.userName,
    'Vai trò': log.userRole === 'admin' ? 'Quản trị viên' : log.userRole === 'manager' ? 'Quản lý' : 'Nhân viên bán hàng',
    'Hành động': ACTION_LABELS[log.action]?.label || log.action,
    'Phân hệ / Đối tượng': ENTITY_LABELS[log.entity] || log.entity,
    'Tên / Mã đối tượng': log.entityName,
    'Chi tiết thay đổi': log.details,
    'Thiết bị thực hiện': log.deviceName || 'Không xác định',
    'Mã thiết bị': log.deviceId || '—',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nhat_Ky_Hoat_Dong');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Nhat_Ky_Hoat_Dong_${databaseName}_${today}.xlsx`);
}
