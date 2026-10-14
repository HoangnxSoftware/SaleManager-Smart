import React, { useState, useEffect } from 'react';
import { Supplier } from '../../types';
import { X, Building2, Save, AlertTriangle, ArrowRight } from 'lucide-react';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
  initialSupplier?: Supplier | null;
  existingCount?: number;
  existingSuppliers?: Supplier[];
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSupplier,
  existingCount = 0,
  existingSuppliers = [],
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Target supplier ID being edited (can switch if duplicate code detected)
  const [targetSupplierId, setTargetSupplierId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<Supplier | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialSupplier) {
      setTargetSupplierId(initialSupplier.id);
      setIsEditMode(true);
      setCode(initialSupplier.code);
      setName(initialSupplier.name.toUpperCase());
      setShortName(initialSupplier.shortName.toUpperCase());
      setTaxCode(initialSupplier.taxCode);
      setPhone(initialSupplier.phone);
      setAddress(initialSupplier.address);
      setNotes(initialSupplier.notes);
      setDuplicateWarning(null);
    } else {
      setTargetSupplierId(null);
      setIsEditMode(false);
      setCode(`NCC${String(existingCount + 1).padStart(3, '0')}`);
      setName('');
      setShortName('');
      setTaxCode('');
      setPhone('');
      setAddress('');
      setNotes('');
      setDuplicateWarning(null);
    }
  }, [initialSupplier, existingCount, isOpen]);

  // Check code uniqueness when code input changes
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    const trimmed = newCode.trim().toUpperCase();
    if (!trimmed) {
      setDuplicateWarning(null);
      return;
    }
    const matched = existingSuppliers.find(
      (s) => s.code.trim().toUpperCase() === trimmed && s.id !== targetSupplierId
    );
    setDuplicateWarning(matched || null);
  };

  // Switch to editing the existing supplier
  const handleSwitchToEditExisting = (existing: Supplier) => {
    setTargetSupplierId(existing.id);
    setIsEditMode(true);
    setCode(existing.code);
    setName(existing.name.toUpperCase());
    setShortName((existing.shortName || existing.name).toUpperCase());
    setTaxCode(existing.taxCode || '');
    setPhone(existing.phone || '');
    setAddress(existing.address || '');
    setNotes(existing.notes || '');
    setDuplicateWarning(null);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const trimmedCode = code.trim().toUpperCase() || `NCC${Date.now().toString().slice(-4)}`;

    // If duplicate detected and not already switched
    const existing = existingSuppliers.find(
      (s) => s.code.trim().toUpperCase() === trimmedCode && s.id !== targetSupplierId
    );

    if (existing) {
      const confirmSwitch = window.confirm(
        `Mã đơn vị cung cấp "${trimmedCode}" đã tồn tại trong hệ thống (Tên: ${existing.name}).\nBạn có muốn cập nhật thông tin cho đơn vị cung cấp này không?`
      );
      if (confirmSwitch) {
        handleSwitchToEditExisting(existing);
        return;
      }
      return;
    }

    // Default Name in Supplier list is UPPERCASE per user requirement
    const upperName = name.trim().toUpperCase();
    const upperShortName = shortName.trim() ? shortName.trim().toUpperCase() : upperName;

    const savedSupplier: Supplier = {
      id: targetSupplierId || `sup-${Date.now()}`,
      code: trimmedCode,
      name: upperName,
      shortName: upperShortName,
      taxCode: taxCode.trim(),
      phone: phone.trim(),
      address: address.trim(),
      notes: notes.trim(),
      createdAt: initialSupplier ? initialSupplier.createdAt : new Date().toISOString().slice(0, 10),
    };

    onSave(savedSupplier);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-emerald-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {isEditMode ? 'Cập nhật thông tin Nhà cung cấp' : 'Thêm mới Nhà cung cấp'}
              </h2>
              <p className="text-teal-100 text-xs">
                Mã đơn vị CC, MST, điện thoại và địa chỉ (Tên mặc định viết hoa)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                Mã <strong>{duplicateWarning.code}</strong> đã thuộc về đơn vị CC{' '}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã đơn vị CC <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="VD: NCC001"
                className={`w-full px-3 py-2 border rounded-xl text-sm font-mono focus:ring-2 ${
                  duplicateWarning
                    ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-teal-500'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã số thuế (MST)
              </label>
              <input
                type="text"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value)}
                placeholder="MST doanh nghiệp"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên đơn vị cung cấp (Mặc định viết hoa) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              placeholder="VD: CÔNG TY TNHH PANASONIC VIỆT NAM"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 font-semibold"
            />
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
                placeholder="VD: PANASONIC VN"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
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
                placeholder="VD: 0243888999"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
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
              placeholder="Địa chỉ văn phòng / tổng kho"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
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
              placeholder="Chính sách chiết khấu, thời gian giao hàng..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
            />
          </div>

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
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isEditMode ? 'Cập nhật thông tin' : 'Lưu nhà cung cấp'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
