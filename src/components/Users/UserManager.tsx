import React, { useState } from 'react';
import { AppUser, UserRole } from '../../types';
import { ShieldCheck, UserCheck, ShoppingBag, Plus, Edit, Trash2, KeyRound, Check, X, Users } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';

interface UserManagerProps {
  users: AppUser[];
  currentUser: AppUser;
  onSaveUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => void;
}

export const UserManager: React.FC<UserManagerProps> = ({
  users,
  currentUser,
  onSaveUser,
  onDeleteUser,
}) => {
  const confirm = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('salesperson');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('123');

  const handleOpenAdd = () => {
    setEditingUser(null);
    setUsername('');
    setFullName('');
    setRole('salesperson');
    setPhone('');
    setEmail('');
    setPassword('123');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: AppUser) => {
    setEditingUser(u);
    setUsername(u.username);
    setFullName(u.fullName);
    setRole(u.role);
    setPhone(u.phone || '');
    setEmail(u.email || '');
    setPassword(u.password || '123');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !fullName.trim()) return;

    const user: AppUser = {
      id: editingUser ? editingUser.id : `u-${Date.now()}`,
      username: username.trim(),
      fullName: fullName.trim(),
      role,
      phone: phone.trim(),
      email: email.trim(),
      isActive: true,
      password: password.trim(),
    };

    onSaveUser(user);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Phân quyền & Quản lý Người dùng
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Thiết lập vai trò: Admin (Toàn quyền), Quản lý (Điều hành kho & bán hàng), Nhân viên bán hàng
          </p>
        </div>

        {currentUser.role === 'admin' && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>THÊM NGƯỜI DÙNG MỚI</span>
          </button>
        )}
      </div>

      {/* Permission Summary Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
          <div className="flex items-center gap-2 font-bold text-indigo-950 text-sm">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>Admin (Quản trị viên)</span>
          </div>
          <p className="text-xs text-indigo-800 leading-relaxed">
            Toàn quyền hệ thống: quản trị bán hàng, nhập kho, công nợ, tính lại giá bán, đồng bộ Google Drive / Google Sheets và cấu hình hệ thống.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
          <div className="flex items-center gap-2 font-bold text-blue-950 text-sm">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <span>Quản lý</span>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed">
            Quản lý duyệt đơn hàng, quản lý kho bãi, nhập kho, theo dõi công nợ, in phiếu và xem báo cáo xuất nhập kho, lợi nhuận FIFO.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <span>Nhân viên bán hàng</span>
          </div>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Tạo mới đơn hàng, xem danh sách đơn hàng, quản lý danh bạ khách hàng, theo dõi tình trạng giao hàng và in hóa đơn bán lẻ.
          </p>
        </div>
      </div>

      {/* Users List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] sm:text-xs">
              <tr>
                <th className="p-3 w-10 text-center">STT</th>
                <th className="p-3">Tài khoản</th>
                <th className="p-3">Họ và tên</th>
                <th className="p-3 text-center">Vai trò phân quyền</th>
                <th className="p-3">Số điện thoại</th>
                <th className="p-3">Email</th>
                <th className="p-3 text-center">Trạng thái</th>
                <th className="p-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u, idx) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                  <td className="p-3 font-mono font-bold text-slate-800">{u.username}</td>
                  <td className="p-3 font-semibold text-slate-900">{u.fullName}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        u.role === 'admin'
                          ? 'bg-indigo-100 text-indigo-800'
                          : u.role === 'manager'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {u.role === 'admin' ? 'Admin' : u.role === 'manager' ? 'Quản lý' : 'Nhân viên bán hàng'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{u.phone || '—'}</td>
                  <td className="p-3 text-slate-600">{u.email || '—'}</td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                      <Check className="w-3.5 h-3.5" /> Hoạt động
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                        title="Sửa người dùng"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {users.length > 1 && u.username !== 'admin' && (
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Xác nhận xóa người dùng',
                              message: `Bạn có chắc muốn xóa tài khoản "${u.username}" (${u.fullName})?`,
                              confirmText: 'Xóa tài khoản',
                              type: 'danger',
                            });
                            if (ok) {
                              onDeleteUser(u.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Xóa người dùng"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-gradient-to-r from-indigo-700 to-purple-700 p-5 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingUser ? 'Chỉnh sửa Người dùng' : 'Thêm Người dùng Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold mb-1">Tên đăng nhập (*)</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-mono"
                  placeholder="VD: sales01"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Họ và tên (*)</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="VD: Nguyễn Văn A"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Phân quyền vai trò</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
                >
                  <option value="salesperson">Nhân viên bán hàng</option>
                  <option value="manager">Quản lý</option>
                  <option value="admin">Admin (Toàn quyền)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Mật khẩu</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                >
                  Lưu thông tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
