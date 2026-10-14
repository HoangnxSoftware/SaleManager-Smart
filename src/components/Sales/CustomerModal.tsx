import React, { useState, useEffect } from 'react';
import { Customer, CustomerType } from '../../types';
import { X, User, Building, Save, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer) => void;
  initialCustomer?: Customer | null;
  existingCustomersCount?: number;
  existingCustomers?: Customer[];
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialCustomer,
  existingCustomersCount = 0,
  existingCustomers = [],
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<CustomerType>('personal');
  const [idCard, setIdCard] = useState('');
  const [notes, setNotes] = useState('');

  // Target customer ID being edited (can switch dynamically if duplicate code detected)
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<Customer | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialCustomer) {
      setTargetCustomerId(initialCustomer.id);
      setIsEditMode(true);
      setCode(initialCustomer.code);
      setName(initialCustomer.name.toUpperCase());
      setShortName(initialCustomer.shortName.toUpperCase());
      setTaxCode(initialCustomer.taxCode);
      setPhone(initialCustomer.phone);
      setAddress(initialCustomer.address);
      setType(initialCustomer.type);
      setIdCard(initialCustomer.idCard);
      setNotes(initialCustomer.notes);
      setDuplicateWarning(null);
    } else {
      setTargetCustomerId(null);
      setIsEditMode(false);
      const nextNum = existingCustomersCount + 1;
      setCode(`KH${String(nextNum).padStart(3, '0')}`);
      setName('');
      setShortName('');
      setTaxCode('');
      setPhone('');
      setAddress('');
      setType('personal');
      setIdCard('');
      setNotes('');
      setDuplicateWarning(null);
    }
  }, [initialCustomer, existingCustomersCount, isOpen]);

  // Check code uniqueness when code input changes
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    const trimmed = newCode.trim().toUpperCase();
    if (!trimmed) {
      setDuplicateWarning(null);
      return;
    }
    const matched = existingCustomers.find(
      (c) => c.code.trim().toUpperCase() === trimmed && c.id !== targetCustomerId
    );
    setDuplicateWarning(matched || null);
  };

  // Switch to editing the existing customer
  const handleSwitchToEditExisting = (existing: Customer) => {
    setTargetCustomerId(existing.id);
    setIsEditMode(true);
    setCode(existing.code);
    setName(existing.name.toUpperCase());
    setShortName((existing.shortName || existing.name).toUpperCase());
    setTaxCode(existing.taxCode || '');
    setPhone(existing.phone || '');
    setAddress(existing.address || '');
    setType(existing.type);
    setIdCard(existing.idCard || '');
    setNotes(existing.notes || '');
    setDuplicateWarning(null);
  };

  // When type is 'personal' and taxCode changes, auto-fill CCCD if not manually different
  const handleTaxCodeChange = (val: string) => {
    setTaxCode(val);
    if (type === 'personal') {
      setIdCard(val);
    }
  };

  const handleTypeChange = (newType: CustomerType) => {
    setType(newType);
    if (newType === 'personal' && taxCode) {
      setIdCard(taxCode);
    } else if (newType === 'organization') {
      setIdCard('');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const trimmedCode = code.trim().toUpperCase() || `KH${Date.now().toString().slice(-4)}`;

    // If duplicate detected and not already confirmed/switched
    const existing = existingCustomers.find(
      (c) => c.code.trim().toUpperCase() === trimmedCode && c.id !== targetCustomerId
    );

    if (existing) {
      const confirmSwitch = window.confirm(
        `Mã khách hàng "${trimmedCode}" đã tồn tại trong hệ thống (Tên: ${existing.name}).\nBạn có muốn cập nhật thông tin cho khách hàng này không?`
      );
      if (confirmSwitch) {
        handleSwitchToEditExisting(existing);
        return;
      }
      return;
    }

    // Default Name in Customer list is UPPERCASE per user requirement
    const upperName = name.trim().toUpperCase();
    const upperShortName = shortName.trim() ? shortName.trim().toUpperCase() : upperName;

    const savedCustomer: Customer = {
      id: targetCustomerId || `cust-${Date.now()}`,
      code: trimmedCode,
      name: upperName,
      shortName: upperShortName,
      taxCode: taxCode.trim(),
      phone: phone.trim(),
      address: address.trim(),
      type,
      idCard: type === 'personal' ? (idCard.trim() || taxCode.trim()) : '',
      notes: notes.trim(),
      createdAt: initialCustomer ? initialCustomer.createdAt : new Date().toISOString().slice(0, 10),
    };

    onSave(savedCustomer);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {isEditMode ? 'Cập nhật thông tin Khách hàng' : 'Thêm mới Khách hàng'}
              </h2>
              <p className="text-blue-100 text-xs">
                Quản lý thông tin định danh, MST, CCCD và liên hệ (Tên mặc định viết hoa)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Duplicate Code Alert Banner */}
        {duplicateWarning && (
          <div className="p-3.5 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-rose-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-800">Cảnh báo trùng mã: </span>
                Mã <strong>{duplicateWarning.code}</strong> đã thuộc về khách hàng{' '}
                <strong>"{duplicateWarning.name}"</strong>.
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSwitchToEditExisting(duplicateWarning)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shrink-0 cursor-pointer transition-colors shadow-xs"
            >
              <span>Chuyển sang Cập nhật thông tin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Customer Type Choice */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Loại khách hàng:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange('personal')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  type === 'personal'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Cá nhân (Default)</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('organization')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  type === 'organization'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building className="w-4 h-4" />
                <span>Tổ chức / Doanh nghiệp</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã khách hàng <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="VD: KH001"
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 font-mono ${
                  duplicateWarning
                    ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên khách hàng (Mặc định viết hoa) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder="VD: CÔNG TY TNHH PHÁT TRIỂN ÁNH SÁNG..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên gợi nhớ (Mặc định viết hoa)
              </label>
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value.toUpperCase())}
                placeholder="VD: ÁNH SÁNG TECH"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0988123456"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã số thuế (MST)
              </label>
              <input
                type="text"
                value={taxCode}
                onChange={(e) => handleTaxCodeChange(e.target.value)}
                placeholder="Mã số thuế doanh nghiệp hoặc cá nhân"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số căn cước công dân (CCCD)
                {type === 'personal' && (
                  <span className="text-[11px] text-blue-600 font-normal ml-1">
                    (Mặc định theo MST)
                  </span>
                )}
              </label>
              <input
                type="text"
                value={idCard}
                onChange={(e) => setIdCard(e.target.value)}
                placeholder="Số CCCD 12 số"
                disabled={type === 'organization'}
                className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono ${
                  type === 'organization' ? 'bg-slate-100 text-slate-400' : ''
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Địa chỉ
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Địa chỉ giao hàng hoặc trụ sở"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thông tin thêm về thói quen mua hàng, thanh toán..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isEditMode ? 'Cập nhật thông tin' : 'Lưu thông tin'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
