import React, { useState, useMemo } from 'react';
import { AppUser, UserRole } from '../../types';
import {
  ShieldCheck,
  UserCheck,
  ShoppingBag,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Users,
  Shield,
  Lock,
  Eye,
  Minus,
} from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';

interface UserManagerProps {
  users: AppUser[];
  currentUser: AppUser;
  onSaveUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => void;
}

type UserManagerSubTab = 'accounts' | 'matrix';

type PermissionLevel = 'full' | 'view_only' | 'denied';

interface RbacFeatureRow {
  feature: string;
  description: string;
  admin: PermissionLevel;
  manager: PermissionLevel;
  salesperson: PermissionLevel;
  adminNote?: string;
  managerNote?: string;
  salespersonNote?: string;
}

interface RbacCategory {
  id: string;
  title: string;
  features: RbacFeatureRow[];
}

const RBAC_MATRIX_CATEGORIES: RbacCategory[] = [
  {
    id: 'sales',
    title: '1. Bán hàng & Quản lý Đơn hàng',
    features: [
      {
        feature: 'Tạo đơn hàng mới & Xem danh sách đơn',
        description: 'Lập đơn bán hàng, xem chi tiết, tra cứu và in phiếu đơn hàng',
        admin: 'full',
        manager: 'full',
        salesperson: 'full',
      },
      {
        feature: 'Copy đơn hàng loạt & Chi tiết đơn hàng',
        description: 'Sao chép nhiều đơn theo thứ tự cũ → mới, sắp xếp và xuất Excel chi tiết đơn hàng',
        admin: 'full',
        manager: 'full',
        salesperson: 'full',
      },
      {
        feature: 'Chỉnh sửa đơn chưa hoàn thành',
        description: 'Sửa thông tin, mặt hàng, chiết khấu khi đơn ở trạng thái Chờ giao / Đang giao / Đã hủy',
        admin: 'full',
        manager: 'full',
        salesperson: 'full',
      },
      {
        feature: 'Đánh dấu Hoàn thành đơn hàng',
        description: 'Chuyển trạng thái đơn hàng sang Hoàn thành (đơn lẻ hoặc Hoàn thành hàng loạt)',
        admin: 'full',
        manager: 'denied',
        salesperson: 'denied',
        managerNote: 'Chỉ Admin',
        salespersonNote: 'Chỉ Admin',
      },
      {
        feature: 'Chỉnh sửa đơn hàng đã Hoàn thành',
        description: 'Mở khóa và sửa đơn giá/nội dung của đơn hàng đã tích Hoàn thành',
        admin: 'full',
        manager: 'denied',
        salesperson: 'denied',
        managerNote: 'Đã khóa',
        salespersonNote: 'Đã khóa',
      },
      {
        feature: 'Xóa đơn hàng (đơn lẻ & hàng loạt)',
        description: 'Xóa vĩnh viễn đơn hàng khỏi hệ thống và ghi nhận nhật ký xóa đồng bộ',
        admin: 'full',
        manager: 'denied',
        salesperson: 'denied',
        managerNote: 'Chỉ Admin',
        salespersonNote: 'Chỉ Admin',
      },
      {
        feature: 'Tạo lại mã đơn hàng loạt theo quy tắc',
        description: 'Đánh lại mã đơn hàng loạt theo quy tắc tạo mã và trình tự thời gian',
        admin: 'full',
        manager: 'denied',
        salesperson: 'denied',
        managerNote: 'Chỉ Admin',
        salespersonNote: 'Chỉ Admin',
      },
      {
        feature: 'Tính lại giá hàng loạt & Nhập Excel đơn hàng',
        description: 'Cập nhật lại đơn giá bán hàng loạt và import đơn hàng từ file Excel',
        admin: 'full',
        manager: 'full',
        salesperson: 'denied',
        managerNote: 'Trừ đơn hoàn thành',
        salespersonNote: 'Không có quyền',
      },
      {
        feature: 'Quản lý danh bạ Khách hàng',
        description: 'Thêm mới, cập nhật và tìm kiếm thông tin khách hàng trong bán hàng',
        admin: 'full',
        manager: 'full',
        salesperson: 'full',
      },
    ],
  },
  {
    id: 'inventory',
    title: '2. Kho hàng & Nhà cung cấp',
    features: [
      {
        feature: 'Truy cập thẻ Kho hàng',
        description: 'Xem tồn kho, phiếu nhập hàng và lịch sử nhập kho',
        admin: 'full',
        manager: 'full',
        salesperson: 'denied',
      },
      {
        feature: 'Tạo / Sửa / Xóa phiếu nhập & Nhập Excel kho',
        description: 'Nhập hàng hóa vào kho, quản lý nhà cung cấp và xuất bảng kê nhập hàng',
        admin: 'full',
        manager: 'full',
        salesperson: 'denied',
      },
    ],
  },
  {
    id: 'products',
    title: '3. Danh mục Sản phẩm',
    features: [
      {
        feature: 'Xem danh mục sản phẩm & tồn kho hiện tại',
        description: 'Tra cứu mã hàng, đơn vị tính, thuế suất, giá bán mặc định và tồn kho',
        admin: 'full',
        manager: 'full',
        salesperson: 'view_only',
        salespersonNote: 'Chỉ xem',
      },
      {
        feature: 'Thêm / Sửa / Xóa sản phẩm & Nhập Excel',
        description: 'Quản lý danh mục hàng hóa, tỷ suất lợi nhuận, giá bán mặc định và biên độ (+/-)',
        admin: 'full',
        manager: 'full',
        salesperson: 'denied',
        salespersonNote: 'Chỉ xem',
      },
    ],
  },
  {
    id: 'debts_reports',
    title: '4. Công nợ & Báo cáo FIFO',
    features: [
      {
        feature: 'Truy cập & Quản lý Công nợ',
        description: 'Theo dõi công nợ phải thu khách hàng, phải trả NCC và lập phiếu thanh toán nợ',
        admin: 'full',
        manager: 'full',
        salesperson: 'denied',
      },
      {
        feature: 'Xem Báo cáo Xuất nhập tồn & Lợi nhuận FIFO',
        description: 'Xem báo cáo tổng hợp xuất nhập tồn, doanh thu, giá vốn FIFO và lợi nhuận gộp',
        admin: 'full',
        manager: 'full',
        salesperson: 'denied',
      },
    ],
  },
  {
    id: 'system',
    title: '5. Hệ thống, Đồng bộ & Phân quyền',
    features: [
      {
        feature: 'Đồng bộ Google Drive / Google Sheets & Cài đặt',
        description: 'Truy cập thẻ Cài đặt, cấu hình đơn vị, quy tắc mã đơn, số thập phân và sao lưu Sheets',
        admin: 'full',
        manager: 'full',
        salesperson: 'denied',
      },
      {
        feature: 'Nhật ký thao tác & Kiểm tra đa thiết bị',
        description: 'Xem lịch sử thao tác người dùng và đồng bộ phiên làm việc trên nhiều thiết bị',
        admin: 'full',
        manager: 'full',
        salesperson: 'full',
      },
      {
        feature: 'Quản lý Phân quyền & Tài khoản người dùng',
        description: 'Truy cập thẻ Phân quyền & Người dùng, thêm/sửa/xóa tài khoản và gán vai trò',
        admin: 'full',
        manager: 'denied',
        salesperson: 'denied',
        managerNote: 'Chỉ Admin',
        salespersonNote: 'Chỉ Admin',
      },
    ],
  },
];

const renderPermissionBadge = (level: PermissionLevel, note?: string) => {
  if (level === 'full') {
    return (
      <div className="inline-flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
          <span>Có quyền</span>
        </span>
        {note && <span className="text-[10px] text-slate-500 font-medium">{note}</span>}
      </div>
    );
  }

  if (level === 'view_only') {
    return (
      <div className="inline-flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <Eye className="w-3.5 h-3.5 text-amber-600" />
          <span>{note || 'Chỉ xem'}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        {note ? (
          <Lock className="w-3 h-3 text-rose-500" />
        ) : (
          <Minus className="w-3.5 h-3.5 text-slate-400" />
        )}
        <span>{note || 'Không có quyền'}</span>
      </span>
    </div>
  );
};

export const UserManager: React.FC<UserManagerProps> = ({
  users,
  currentUser,
  onSaveUser,
  onDeleteUser,
}) => {
  const confirm = useConfirm();
  const [activeSubTab, setActiveSubTab] = useState<UserManagerSubTab>('accounts');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('salesperson');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('123');

  const roleCounts = useMemo(() => {
    return {
      admin: users.filter((u) => u.role === 'admin').length,
      manager: users.filter((u) => u.role === 'manager').length,
      salesperson: users.filter((u) => u.role === 'salesperson').length,
    };
  }, [users]);

  const visibleCategories = useMemo(() => {
    if (selectedCategoryFilter === 'all') return RBAC_MATRIX_CATEGORIES;
    return RBAC_MATRIX_CATEGORIES.filter((c) => c.id === selectedCategoryFilter);
  }, [selectedCategoryFilter]);

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
    setPassword(u.password || '');
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
    <div className="space-y-5">
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
            Thiết lập tài khoản và đối chiếu Ma trận phân quyền theo vai trò: Admin, Quản lý, Nhân viên bán hàng
          </p>
        </div>

        {currentUser.role === 'admin' && activeSubTab === 'accounts' && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>THÊM NGƯỜI DÙNG MỚI</span>
          </button>
        )}
      </div>

      {/* 2 Sub-tabs Switcher */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs inline-flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveSubTab('accounts')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === 'accounts'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Danh sách tài khoản</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
              activeSubTab === 'accounts'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {users.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('matrix')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === 'matrix'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Ma trận phân quyền (RBAC Matrix)</span>
        </button>
      </div>

      {/* TAB 1: DANH SÁCH TÀI KHOẢN */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-5">
          {/* Role Count Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-indigo-950 text-sm">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span>Admin (Quản trị viên)</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {roleCounts.admin} tài khoản
                </span>
              </div>
              <p className="text-xs text-indigo-800 leading-relaxed">
                Toàn quyền hệ thống: quản trị bán hàng, xóa/hoàn thành đơn, tạo lại mã đơn hàng loạt, nhập kho, công nợ, đồng bộ Google Sheets và phân quyền.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-blue-950 text-sm">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  <span>Quản lý</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
                  {roleCounts.manager} tài khoản
                </span>
              </div>
              <p className="text-xs text-blue-800 leading-relaxed">
                Điều hành bán hàng, nhập kho, công nợ, báo cáo FIFO và đồng bộ Google Sheets (không xóa đơn, không tạo lại mã hàng loạt, không phân quyền).
              </p>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  <span>Nhân viên bán hàng</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {roleCounts.salesperson} tài khoản
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Tạo mới đơn hàng, quản lý khách hàng, theo dõi giao hàng, in hóa đơn bán lẻ và tra cứu danh mục sản phẩm (chỉ xem).
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
                          {u.role === 'admin'
                            ? 'Admin'
                            : u.role === 'manager'
                            ? 'Quản lý'
                            : 'Nhân viên bán hàng'}
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
        </div>
      )}

      {/* TAB 2: MA TRẬN PHÂN QUYỀN (RBAC MATRIX) */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-4">
          {/* Matrix Header & Category Filter */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span>Bảng So Sánh Quyền Hạn Theo Vai Trò (RBAC Matrix)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đối chiếu chi tiết quyền hạn thực thi của từng nhóm tài khoản trên toàn bộ phân hệ của phần mềm
                </p>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                  <Check className="w-3 h-3" /> Có quyền
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">
                  <Eye className="w-3 h-3" /> Chỉ xem
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                  <Lock className="w-3 h-3 text-rose-500" /> Bị giới hạn / Không có quyền
                </span>
              </div>
            </div>

            {/* Module filter pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả phân hệ
              </button>
              {RBAC_MATRIX_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedCategoryFilter === cat.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.title}
                </button>
              ))}
            </div>
          </div>

          {/* RBAC Comparison Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto table-scrollbar">
              <table className="w-full text-xs sm:text-sm text-left border-collapse min-w-[780px]">
                <thead className="bg-slate-100 text-slate-800 border-b-2 border-slate-200">
                  <tr>
                    <th className="p-3.5 font-black uppercase text-[11px] tracking-wider w-[44%]">
                      Chức năng / Quyền hạn hệ thống
                    </th>
                    <th className="p-3.5 text-center w-[18.5%] bg-indigo-50/70 border-l border-slate-200">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className="inline-flex items-center gap-1.5 text-indigo-900 font-black text-xs sm:text-sm">
                          <ShieldCheck className="w-4 h-4 text-indigo-600" />
                          <span>Admin</span>
                        </span>
                        <span className="text-[10px] font-semibold text-indigo-700">
                          Quản trị viên ({roleCounts.admin})
                        </span>
                      </div>
                    </th>
                    <th className="p-3.5 text-center w-[18.5%] bg-blue-50/70 border-l border-slate-200">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className="inline-flex items-center gap-1.5 text-blue-900 font-black text-xs sm:text-sm">
                          <UserCheck className="w-4 h-4 text-blue-600" />
                          <span>Quản lý</span>
                        </span>
                        <span className="text-[10px] font-semibold text-blue-700">
                          Điều hành ({roleCounts.manager})
                        </span>
                      </div>
                    </th>
                    <th className="p-3.5 text-center w-[19%] bg-emerald-50/70 border-l border-slate-200">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className="inline-flex items-center gap-1.5 text-emerald-900 font-black text-xs sm:text-sm">
                          <ShoppingBag className="w-4 h-4 text-emerald-600" />
                          <span>Bán hàng</span>
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700">
                          Nhân viên ({roleCounts.salesperson})
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleCategories.map((category) => (
                    <React.Fragment key={category.id}>
                      {/* Category Group Row */}
                      <tr className="bg-slate-50/95 border-t border-b border-slate-200">
                        <td
                          colSpan={4}
                          className="px-3.5 py-2.5 font-black text-xs sm:text-sm text-indigo-950 uppercase tracking-wide"
                        >
                          {category.title}
                        </td>
                      </tr>

                      {/* Feature Rows */}
                      {category.features.map((row, idx) => (
                        <tr
                          key={`${category.id}-${idx}`}
                          className="hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{row.feature}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              {row.description}
                            </div>
                          </td>
                          <td className="p-3 text-center border-l border-slate-100 bg-indigo-50/20">
                            {renderPermissionBadge(row.admin, row.adminNote)}
                          </td>
                          <td className="p-3 text-center border-l border-slate-100 bg-blue-50/20">
                            {renderPermissionBadge(row.manager, row.managerNote)}
                          </td>
                          <td className="p-3 text-center border-l border-slate-100 bg-emerald-50/20">
                            {renderPermissionBadge(row.salesperson, row.salespersonNote)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
                className="text-white/80 hover:text-white cursor-pointer"
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
                  className="px-4 py-2 bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer"
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
