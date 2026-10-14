import React, { useState, useEffect, useMemo } from 'react';
import { Customer, Supplier, DebtPayment, PaymentMethod } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { X, Search, CheckCircle2, Wallet, Banknote, Building, CreditCard } from 'lucide-react';

interface DebtPaymentModalProps {
  type: 'customer' | 'supplier';
  customers: Customer[];
  suppliers: Supplier[];
  preSelectedEntityId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSavePayment: (payment: DebtPayment) => void;
}

export const DebtPaymentModal: React.FC<DebtPaymentModalProps> = ({
  type,
  customers,
  suppliers,
  preSelectedEntityId,
  isOpen,
  onClose,
  onSavePayment,
}) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const [notes, setNotes] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (preSelectedEntityId) {
      setSelectedEntityId(preSelectedEntityId);
      if (type === 'customer') {
        const c = customers.find((item) => item.id === preSelectedEntityId);
        if (c) setSearchQuery(`${c.name} (${c.code})`);
      } else {
        const s = suppliers.find((item) => item.id === preSelectedEntityId);
        if (s) setSearchQuery(`${s.name} (${s.code})`);
      }
    } else {
      setSelectedEntityId('');
      setSearchQuery('');
    }
  }, [preSelectedEntityId, type, customers, suppliers, isOpen]);

  const filteredEntities = useMemo(() => {
    const list = type === 'customer' ? customers : suppliers;
    if (!searchQuery.trim()) return list.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.shortName.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [type, customers, suppliers, searchQuery]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntityId) {
      alert(`Vui lòng chọn ${type === 'customer' ? 'khách hàng' : 'nhà cung cấp'}.`);
      return;
    }
    if (amount <= 0) {
      alert('Vui lòng nhập số tiền trả nợ lớn hơn 0.');
      return;
    }

    let entityCode = '';
    let entityName = '';
    if (type === 'customer') {
      const c = customers.find((item) => item.id === selectedEntityId);
      entityCode = c?.code || '';
      entityName = c?.name || '';
    } else {
      const s = suppliers.find((item) => item.id === selectedEntityId);
      entityCode = s?.code || '';
      entityName = s?.name || '';
    }

    const code = `${type === 'customer' ? 'PT' : 'PC'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const payment: DebtPayment = {
      id: `dp-${Date.now()}`,
      code,
      type,
      entityId: selectedEntityId,
      entityCode,
      entityName,
      date,
      amount,
      paymentMethod,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    onSavePayment(payment);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        <div className={`p-5 text-white flex items-center justify-between ${
          type === 'customer' ? 'bg-gradient-to-r from-blue-700 to-indigo-700' : 'bg-gradient-to-r from-teal-700 to-emerald-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {type === 'customer' ? 'Thu tiền nợ Khách hàng' : 'Chi trả tiền nợ Nhà cung cấp'}
              </h2>
              <p className="text-white/80 text-xs">
                Ghi nhận thanh toán và khấu trừ công nợ tồn đọng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ngày trả nợ <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>

          {/* Quick Search Entity */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {type === 'customer' ? 'Khách hàng trả nợ' : 'Nhà cung cấp nhận thanh toán'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Gõ tìm kiếm nhanh..."
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            {isDropdownOpen && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {filteredEntities.map((ent) => (
                  <button
                    key={ent.id}
                    type="button"
                    onClick={() => {
                      setSelectedEntityId(ent.id);
                      setSearchQuery(`${ent.name} (${ent.code})`);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left p-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-none flex justify-between items-center cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900">{ent.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{ent.code}</div>
                    </div>
                    <span className="text-xs text-blue-600 font-medium">Chọn</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Số tiền trả nợ (VNĐ) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1000"
              step="any"
              required
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-lg font-bold text-emerald-700 text-right"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Phương thức thanh toán:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                  paymentMethod === 'cash' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Tiền mặt</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('transfer')}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                  paymentMethod === 'transfer' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200'
                }`}
              >
                <Building className="w-4 h-4 text-blue-600" />
                <span>Chuyển khoản</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                  paymentMethod === 'card' ? 'border-purple-600 bg-purple-50 text-purple-800' : 'border-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4 text-purple-600" />
                <span>Thẻ</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú / Số chứng từ
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ủy nhiệm chi, phiếu thu số..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className={`flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-md cursor-pointer ${
                type === 'customer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Xác nhận thu/trả nợ</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
