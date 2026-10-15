import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { X, Package, Save, AlertTriangle, ArrowRight } from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  initialProduct?: Product | null;
  existingCount?: number;
  existingProducts?: Product[];
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProduct,
  existingCount = 0,
  existingProducts = [],
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('Thùng');
  const [vatRate, setVatRate] = useState<number>(10);
  const [conversionRate, setConversionRate] = useState<number>(1);
  const [saleUnit, setSaleUnit] = useState('Thùng');
  const [category, setCategory] = useState('');
  const [profitMargin, setProfitMargin] = useState<number | string>(0);
  const [defaultSalePrice, setDefaultSalePrice] = useState<number>(0);
  const [priceVariance, setPriceVariance] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [saleUnitCustomized, setSaleUnitCustomized] = useState(false);

  // Target product ID being edited (can switch dynamically if duplicate code detected)
  const [targetProductId, setTargetProductId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<Product | null>(null);

  // Auto-sync saleUnit with purchaseUnit when creating new product unless user customized it
  const handlePurchaseUnitChange = (val: string) => {
    setPurchaseUnit(val);
    if (!isEditMode && !saleUnitCustomized) {
      setSaleUnit(val);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (initialProduct) {
      setTargetProductId(initialProduct.id);
      setIsEditMode(true);
      setCode(initialProduct.code);
      setName(initialProduct.name);
      setPurchaseUnit(initialProduct.purchaseUnit);
      setVatRate(initialProduct.vatRate);
      setConversionRate(initialProduct.conversionRate ?? 1);
      setSaleUnit(initialProduct.saleUnit);
      setCategory(initialProduct.category || '');
      setProfitMargin(initialProduct.profitMargin ?? 0);
      setDefaultSalePrice(initialProduct.defaultSalePrice || 0);
      setPriceVariance(initialProduct.priceVariance || 0);
      setNotes(initialProduct.notes || '');
      setDuplicateWarning(null);
    } else {
      setTargetProductId(null);
      setIsEditMode(false);
      setCode(`HH${String(existingCount + 1).padStart(3, '0')}`);
      setName('');
      setPurchaseUnit('Thùng');
      setVatRate(10);
      setConversionRate(1);
      setSaleUnit('Thùng');
      setSaleUnitCustomized(false);
      setCategory('');
      setProfitMargin(0);
      setDefaultSalePrice(0);
      setPriceVariance(0);
      setNotes('');
      setDuplicateWarning(null);
    }
  }, [initialProduct, existingCount, isOpen]);

  // Check code uniqueness when code input changes
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    const trimmed = newCode.trim().toUpperCase();
    if (!trimmed) {
      setDuplicateWarning(null);
      return;
    }
    const matched = existingProducts.find(
      (p) => p.code.trim().toUpperCase() === trimmed && p.id !== targetProductId
    );
    setDuplicateWarning(matched || null);
  };

  // Switch to editing the existing product
  const handleSwitchToEditExisting = (existing: Product) => {
    setTargetProductId(existing.id);
    setIsEditMode(true);
    setCode(existing.code);
    setName(existing.name);
    setPurchaseUnit(existing.purchaseUnit);
    setVatRate(existing.vatRate);
    setConversionRate(existing.conversionRate ?? 1);
    setSaleUnit(existing.saleUnit);
    setCategory(existing.category || '');
    setProfitMargin(existing.profitMargin ?? 0);
    setDefaultSalePrice(existing.defaultSalePrice || 0);
    setPriceVariance(existing.priceVariance || 0);
    setNotes(existing.notes || '');
    setDuplicateWarning(null);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    const trimmedCode = code.trim().toUpperCase();

    // Check if code duplicate
    const existing = existingProducts.find(
      (p) => p.code.trim().toUpperCase() === trimmedCode && p.id !== targetProductId
    );

    if (existing) {
      const confirmSwitch = window.confirm(
        `Mã hàng hóa "${trimmedCode}" đã tồn tại trong danh mục (Tên: ${existing.name}).\nBạn có muốn chuyển sang cập nhật thông tin cho hàng hóa này không?`
      );
      if (confirmSwitch) {
        handleSwitchToEditExisting(existing);
        return;
      }
      return;
    }

    const parsedMargin = typeof profitMargin === 'number' ? profitMargin : parseFloat(String(profitMargin));
    const finalProfitMargin = isNaN(parsedMargin) ? 0 : parsedMargin;

    const prod: Product = {
      id: targetProductId || `prod-${Date.now()}`,
      code: trimmedCode,
      name: name.trim(),
      purchaseUnit: purchaseUnit.trim() || 'Cái',
      vatRate,
      conversionRate: conversionRate > 0 ? conversionRate : 1,
      saleUnit: saleUnit.trim() || purchaseUnit.trim() || 'Cái',
      category: category.trim(),
      profitMargin: finalProfitMargin,
      defaultSalePrice: defaultSalePrice > 0 ? defaultSalePrice : undefined,
      priceVariance: priceVariance > 0 ? priceVariance : undefined,
      notes: notes.trim(),
    };

    onSave(prod);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {isEditMode ? 'Cập nhật thông tin Hàng Hóa' : 'Thêm mới Hàng Hóa'}
              </h2>
              <p className="text-indigo-100 text-xs">
                Mã HH, ĐVT mua/bán, tỷ lệ quy đổi và tỷ suất lợi nhuận
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                Mã <strong>{duplicateWarning.code}</strong> đã thuộc về hàng hóa{' '}
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã HH <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="VD: LED-RD-18W"
                className={`w-full px-3 py-2 border rounded-xl text-sm font-mono uppercase focus:ring-2 ${
                  duplicateWarning
                    ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-indigo-500'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nhóm / Loại HH
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="VD: Chiếu sáng, Dây cáp..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên hàng hóa <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Đèn LED Downlight Rạng Đông 18W"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ĐVT_Mua
              </label>
              <input
                type="text"
                required
                value={purchaseUnit}
                onChange={(e) => handlePurchaseUnitChange(e.target.value)}
                placeholder="VD: Thùng, Cuộn"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SL quy đổi (Mặc định = 1)
              </label>
              <input
                type="number"
                min="0.0001"
                step="any"
                value={conversionRate}
                onChange={(e) => setConversionRate(parseFloat(e.target.value) || 1)}
                placeholder="1"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-center font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ĐVT_Bán
              </label>
              <input
                type="text"
                required
                value={saleUnit}
                onChange={(e) => {
                  setSaleUnitCustomized(true);
                  setSaleUnit(e.target.value);
                }}
                placeholder="VD: Chiếc, Mét"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thuế suất thuế GTGT (%)
              </label>
              <input
                type="number"
                min="0"
                value={vatRate}
                onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                placeholder="10"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Tỷ suất lợi nhuận (%)
                </label>
                {Number(profitMargin) < 0 && (
                  <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                    Lợi nhuận âm (bán lỗ)
                  </span>
                )}
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={profitMargin}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
                    setProfitMargin(val);
                  }
                }}
                placeholder="VD: 15 hoặc -5"
                className={`w-full px-3 py-2 border rounded-xl text-sm font-bold transition-colors ${
                  Number(profitMargin) < 0
                    ? 'border-rose-400 bg-rose-50/40 text-rose-700 focus:ring-2 focus:ring-rose-500'
                    : 'border-slate-300 text-indigo-700 focus:ring-2 focus:ring-indigo-500'
                }`}
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Cho phép ghi số âm (VD: -5, -10% khi xả kho hoặc bán lỗ)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Giá bán mặc định (Đã gồm thuế GTGT, theo ĐVT_Bán)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={defaultSalePrice || ''}
                onChange={(e) => setDefaultSalePrice(parseFloat(e.target.value) || 0)}
                placeholder="VD: 5580"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">Giá bán chuẩn để gợi ý khi lập đơn hàng</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Biên độ giá (+/-)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={priceVariance || ''}
                onChange={(e) => setPriceVariance(parseFloat(e.target.value) || 0)}
                placeholder="VD: 100"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-indigo-700 bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">Khoảng biến thiên giá bán cho phép</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thông số kỹ thuật, quy cách đóng gói..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
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
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isEditMode ? 'Cập nhật thông tin' : 'Lưu hàng hóa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
