import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Supplier, PurchaseBill, PurchaseItem, Product, AppSettings, AppUser } from '../../types';
import {
  formatCurrency,
  formatPrecise,
  formatDate,
  formatNumber,
  formatVietnameseNumber,
  parseVietnameseNumber,
} from '../../utils/formatters';
import {
  X,
  Plus,
  Trash2,
  Search,
  Building2,
  PackagePlus,
  CheckCircle2,
  Edit,
  AlertTriangle,
  Phone,
  MapPin,
  FileText
} from 'lucide-react';
import { SupplierModal } from './SupplierModal';
import { useConfirm } from '../../context/ConfirmContext';

interface VnNumberInputProps {
  value: number;
  onChange: (val: number) => void;
  decimals?: number;
  className?: string;
  min?: number;
  placeholder?: string;
  title?: string;
}

const VnNumberInput: React.FC<VnNumberInputProps> = ({
  value,
  onChange,
  decimals = 0,
  className,
  min = 0,
  placeholder,
  title,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [text, setText] = useState(() => formatVietnameseNumber(value, decimals));

  useEffect(() => {
    if (!isFocused) {
      setText(formatVietnameseNumber(value, decimals));
    }
  }, [value, decimals, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const parsed = parseVietnameseNumber(raw);
    onChange(min !== undefined ? Math.max(min, parsed) : parsed);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseVietnameseNumber(text);
    const finalVal = min !== undefined ? Math.max(min, parsed) : parsed;
    onChange(finalVal);
    setText(formatVietnameseNumber(finalVal, decimals));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={isFocused ? text : formatVietnameseNumber(value, decimals)}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      title={title}
      className={className}
    />
  );
};

interface PurchaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bill: PurchaseBill) => void;
  initialBill?: PurchaseBill | null;
  suppliers: Supplier[];
  products: Product[];
  currentUser: AppUser;
  settings: AppSettings;
  allPurchases: PurchaseBill[];
  onAddNewProduct: (product: Product) => void;
  onSaveSupplier?: (supplier: Supplier) => void;
}

export const PurchaseFormModal: React.FC<PurchaseFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialBill,
  suppliers,
  products,
  currentUser,
  settings,
  allPurchases,
  onAddNewProduct,
  onSaveSupplier,
}) => {
  const confirm = useConfirm();
  const [billNo, setBillNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [isEditSupplierModalOpen, setIsEditSupplierModalOpen] = useState(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);

  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Items
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  // Quick add product inline modal state
  const [isQuickAddProductOpen, setIsQuickAddProductOpen] = useState(false);
  const [newProdCode, setNewProdCode] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPurchaseUnit, setNewProdPurchaseUnit] = useState('Cái');
  const [newProdSaleUnit, setNewProdSaleUnit] = useState('Cái');
  const [newProdVat, setNewProdVat] = useState(10);
  const [newProdMargin, setNewProdMargin] = useState<number | string>(0);

  // Payment
  const [paidAmount, setPaidAmount] = useState<number>(0);

  const purchaseDecimals = settings.purchasePriceDecimals ?? 10;

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (initialBill) {
      setBillNo(initialBill.billNo);
      setPurchaseDate(initialBill.purchaseDate);
      const sup = suppliers.find((s) => s.code === initialBill.supplierCode) || {
        id: 'sup-init',
        code: initialBill.supplierCode,
        name: initialBill.supplierName,
        shortName: initialBill.supplierName,
        taxCode: initialBill.supplierTaxCode,
        phone: '',
        address: '',
        notes: '',
        createdAt: '',
      };
      setSelectedSupplier(sup);
      setSupplierSearch(`${sup.name} (${sup.code})`);
      setItems([...initialBill.items]);
      setPaidAmount(initialBill.paidAmount);
    } else {
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = allPurchases.filter((p) => p.purchaseDate === new Date().toISOString().slice(0, 10)).length + 1;
      setBillNo(`PNK-${datePart}-${String(countToday).padStart(2, '0')}`);
      setPurchaseDate(new Date().toISOString().slice(0, 10));
      // Reset supplier to blank for quick search as requested
      setSelectedSupplier(null);
      setSupplierSearch('');
      setItems([]);
      setPaidAmount(0);
    }
  }, [isOpen, initialBill, suppliers, allPurchases]);

  const handleSaveSupplier = (supplier: Supplier) => {
    if (onSaveSupplier) {
      onSaveSupplier(supplier);
    }
    setSelectedSupplier(supplier);
    setSupplierSearch(`${supplier.name} (${supplier.code})`);
    setIsEditSupplierModalOpen(false);
    setIsAddSupplierModalOpen(false);
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers.slice(0, 8);
    const q = supplierSearch.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.shortName.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.taxCode.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [suppliers, supplierSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 8);
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [products, productSearch]);

  // Totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalVat = 0;

    items.forEach((item) => {
      subtotal += item.amount;
      totalVat += item.vatAmount;
    });

    const totalAmount = subtotal + totalVat;
    const debt = Math.max(0, totalAmount - paidAmount);

    return { subtotal, totalVat, totalAmount, debt };
  }, [items, paidAmount]);

  if (!isOpen) return null;

  // Add product to bill
  const handleAddItem = (prod: Product) => {
    const qty = 10;
    const initialAmount = 1000000;
    const vat = prod.vatRate ?? 10;
    const unitPrice = initialAmount / qty;
    const vatAmount = (initialAmount * vat) / 100;

    const newItem: PurchaseItem = {
      id: `pi-${Date.now()}-${Math.random()}`,
      productCode: prod.code,
      productName: prod.name,
      purchaseUnit: prod.purchaseUnit || 'Cái',
      quantity: qty,
      unitPrice,
      amount: initialAmount,
      vatRate: vat,
      vatAmount,
      totalAmount: initialAmount + vatAmount,
    };

    setItems([...items, newItem]);
    setProductSearch('');
    setIsProductDropdownOpen(false);
  };

  // Update item: Thành tiền hoặc Số lượng -> Đơn giá nhập tự động tính = Thành tiền / Số lượng
  const handleUpdateItem = (
    index: number,
    field: 'quantity' | 'amount' | 'vatRate',
    val: number
  ) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'quantity') {
      item.quantity = Math.max(0, val);
      // Auto recalculate unit price with 10 decimals: Đơn giá nhập = Thành tiền / Số lượng
      item.unitPrice = item.quantity > 0 ? Number((item.amount / item.quantity).toFixed(purchaseDecimals)) : 0;
    } else if (field === 'amount') {
      item.amount = Math.max(0, val);
      // Auto recalculate unit price with 10 decimals: Đơn giá nhập = Thành tiền / Số lượng
      item.unitPrice = item.quantity > 0 ? Number((item.amount / item.quantity).toFixed(purchaseDecimals)) : 0;
    } else if (field === 'vatRate') {
      item.vatRate = Math.max(0, val);
    }

    item.vatAmount = (item.amount * (item.vatRate || 0)) / 100;
    item.totalAmount = item.amount + item.vatAmount;

    updated[index] = item;
    setItems(updated);
  };

  const handleRemoveItem = async (index: number) => {
    const item = items[index];
    const itemName = item ? `"${item.productName}"` : 'mặt hàng này';
    const ok = await confirm({
      title: 'Xác nhận xóa mặt hàng',
      message: `Bạn có chắc muốn xóa ${itemName} khỏi phiếu nhập?`,
      confirmText: 'Xóa mặt hàng',
      type: 'danger',
    });
    if (ok) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Quick add product
  const handleQuickAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdCode.trim() || !newProdName.trim()) return;

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      code: newProdCode.trim().toUpperCase(),
      name: newProdName.trim(),
      purchaseUnit: newProdPurchaseUnit.trim() || 'Cái',
      saleUnit: newProdSaleUnit.trim() || 'Cái',
      vatRate: newProdVat,
      conversionRate: 1,
      category: '',
      profitMargin: typeof newProdMargin === 'number' ? newProdMargin : (parseFloat(String(newProdMargin)) || 0),
    };

    onAddNewProduct(newProd);
    handleAddItem(newProd);
    setIsQuickAddProductOpen(false);
    setNewProdCode('');
    setNewProdName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) {
      alert('Vui lòng chọn thông tin đơn vị cung cấp.');
      return;
    }
    if (items.length === 0) {
      alert('Vui lòng thêm ít nhất một mặt hàng nhập kho.');
      return;
    }

    const paymentStatus: 'paid' | 'partial' | 'unpaid' =
      paidAmount >= totals.totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    const bill: PurchaseBill = {
      id: initialBill ? initialBill.id : `bill-${Date.now()}`,
      billNo: billNo.trim() || `PNK-${Date.now()}`,
      purchaseDate,
      supplierCode: selectedSupplier.code,
      supplierTaxCode: selectedSupplier.taxCode,
      supplierName: selectedSupplier.name,
      items,
      subtotal: totals.subtotal,
      totalVat: totals.totalVat,
      totalAmount: totals.totalAmount,
      paidAmount,
      paymentStatus,
      createdById: initialBill ? initialBill.createdById : currentUser.id,
      createdAt: initialBill ? initialBill.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(bill);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-6xl xl:max-w-7xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">
                {initialBill ? `Chỉnh sửa Phiếu nhập kho: ${initialBill.billNo}` : 'Lập Phiếu Nhập Hàng Mới'}
              </h2>
              <p className="text-teal-100 text-xs">
                Mã phiếu (Bill No): <span className="font-mono font-semibold">{billNo}</span> • Ngày: {formatDate(purchaseDate)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-teal-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Top Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã phiếu (Bill No) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày nhập kho <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Supplier Search & Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-600" />
                <span>Đơn vị cung cấp (Nhà cung cấp)</span>
                <span className="text-rose-500">*</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSupplierModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm mới NCC</span>
              </button>
            </div>

            <div className="relative" ref={supplierDropdownRef}>
              <input
                type="text"
                placeholder="Tìm kiếm đơn vị cung cấp theo Tên, Mã, MST, SĐT..."
                value={supplierSearch}
                onFocus={() => setIsSupplierDropdownOpen(true)}
                onChange={(e) => {
                  setSupplierSearch(e.target.value);
                  setIsSupplierDropdownOpen(true);
                }}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              {supplierSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setSupplierSearch('');
                    setIsSupplierDropdownOpen(true);
                  }}
                  className="absolute right-3 top-3 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {isSupplierDropdownOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {filteredSuppliers.length > 0 ? (
                    filteredSuppliers.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedSupplier(s);
                          setSupplierSearch(`${s.name} (${s.code})`);
                          setIsSupplierDropdownOpen(false);
                        }}
                        className={`w-full text-left p-3 hover:bg-teal-50 transition-colors flex items-center justify-between cursor-pointer ${
                          selectedSupplier?.id === s.id ? 'bg-teal-50/70 border-l-4 border-teal-600' : ''
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-xs text-slate-900 flex items-center gap-2">
                            <span>{s.name}</span>
                            {s.shortName && s.shortName !== s.name && (
                              <span className="text-[10px] text-teal-700 bg-teal-100/70 px-1.5 py-0.2 rounded font-normal">
                                {s.shortName}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span className="font-mono text-teal-700 font-medium">Mã: {s.code}</span>
                            <span>MST: {s.taxCode || '—'}</span>
                            {s.phone && <span>SĐT: {s.phone}</span>}
                          </div>
                        </div>
                        <span className="text-xs text-teal-600 font-semibold shrink-0 ml-2">Chọn</span>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500 space-y-2">
                      <p>Không tìm thấy nhà cung cấp phù hợp với từ khóa.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSupplierDropdownOpen(false);
                          setIsAddSupplierModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tạo mới nhà cung cấp này</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedSupplier ? (
              <div className="p-3.5 bg-gradient-to-br from-teal-50/80 via-emerald-50/40 to-teal-50/60 rounded-xl border border-teal-200 text-xs text-slate-700 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-teal-700 shrink-0" />
                    <span className="font-bold text-slate-900 text-sm">{selectedSupplier.name}</span>
                    {selectedSupplier.shortName && selectedSupplier.shortName !== selectedSupplier.name && (
                      <span className="text-[11px] text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-md font-medium">
                        {selectedSupplier.shortName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditSupplierModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-white hover:bg-teal-100 border border-teal-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                      title="Cập nhật thông tin chi tiết nhà cung cấp này"
                    >
                      <Edit className="w-3.5 h-3.5 text-teal-600" />
                      <span>Cập nhật thông tin đơn vị cung cấp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSupplier(null);
                        setSupplierSearch('');
                        setIsSupplierDropdownOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                      title="Xóa để chọn nhà cung cấp khác"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Đổi NCC</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-0.5">
                  <div className="bg-white/90 p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Mã đơn vị CC</div>
                    <div className="font-mono font-bold text-teal-800 text-xs mt-0.5">{selectedSupplier.code}</div>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Mã số thuế (MST)</div>
                    <div className="font-semibold text-slate-800 text-xs mt-0.5">
                      {selectedSupplier.taxCode ? (
                        <span className="font-mono text-slate-900">{selectedSupplier.taxCode}</span>
                      ) : (
                        <span className="text-slate-400 italic">Chưa có MST</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Điện thoại</div>
                    <div className="font-semibold text-slate-800 text-xs mt-0.5">
                      {selectedSupplier.phone || <span className="text-slate-400 italic">Chưa có</span>}
                    </div>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Địa chỉ</div>
                    <div className="font-semibold text-slate-800 text-xs mt-0.5 truncate" title={selectedSupplier.address || ''}>
                      {selectedSupplier.address || <span className="text-slate-400 italic">Chưa có</span>}
                    </div>
                  </div>
                </div>

                {selectedSupplier.notes && (
                  <div className="text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-teal-100/60">
                    <span className="font-medium text-slate-700">Ghi chú:</span> {selectedSupplier.notes}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Chưa chọn đơn vị cung cấp. Nhập từ khóa vào ô tìm kiếm ở trên để chọn nhanh, hoặc bấm tạo mới.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo mới NCC ngay</span>
                </button>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span>Chi tiết các mặt hàng nhập ({items.length} mặt hàng)</span>
              </h3>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddProductOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  <span>+ Thêm nhanh sản phẩm mới</span>
                </button>

                {/* Add from existing catalog */}
                <div className="relative w-64" ref={productDropdownRef}>
                  <input
                    type="text"
                    placeholder="Tìm mặt hàng để thêm..."
                    value={productSearch}
                    onFocus={() => setIsProductDropdownOpen(true)}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setIsProductDropdownOpen(true);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />

                  {isProductDropdownOpen && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAddItem(p)}
                          className="w-full text-left p-2 hover:bg-teal-50 border-b border-slate-100 last:border-none flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <div className="font-semibold text-xs text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{p.code}</div>
                          </div>
                          <span className="text-xs text-teal-600 font-bold">+</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-xl">
                Chưa có mặt hàng nào. Thêm mặt hàng từ ô tìm kiếm hoặc bấm nút "+ Thêm nhanh sản phẩm mới".
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-semibold">
                    <tr>
                      <th className="p-2 text-left w-8">#</th>
                      <th className="p-2 text-left min-w-36">Mã & Tên Hàng hóa</th>
                      <th className="p-2 text-left w-20">ĐVT_Mua</th>
                      <th className="p-2 text-left w-24">Số lượng</th>
                      <th className="p-2 text-left w-36">Thành tiền</th>
                      <th className="p-2 text-left min-w-36 bg-amber-50/50">
                        Đơn giá nhập (Tự tính)
                      </th>
                      <th className="p-2 text-left w-16">Thuế %</th>
                      <th className="p-2 text-left w-28">Tiền thuế GTGT</th>
                      <th className="p-2 text-left w-32">Thành tiền sau thuế</th>
                      <th className="p-2 text-left w-10">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-2">
                          <div className="font-semibold text-slate-800">{item.productName}</div>
                          <div className="font-mono text-[10px] text-teal-700">{item.productCode}</div>
                        </td>
                        <td className="p-2 text-center text-slate-600">{item.purchaseUnit}</td>
                        <td className="p-2">
                          <VnNumberInput
                            value={item.quantity}
                            onChange={(val) => handleUpdateItem(idx, 'quantity', val)}
                            decimals={4}
                            min={0.000001}
                            className="w-24 px-2 py-1 text-right font-bold text-slate-900 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 font-mono text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <VnNumberInput
                            value={item.amount}
                            onChange={(val) => handleUpdateItem(idx, 'amount', val)}
                            decimals={2}
                            min={0}
                            className="w-36 px-2 py-1 text-right font-semibold text-slate-900 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 font-mono text-xs"
                          />
                        </td>
                        <td className="p-2 text-right bg-amber-50/50 font-mono font-bold text-amber-900">
                          {/* Đơn giá nhập được tính tự động = Thành tiền / Số lượng định dạng theo chuẩn Việt Nam */}
                          {formatPrecise(item.unitPrice, purchaseDecimals)}
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.vatRate}
                            onChange={(e) => handleUpdateItem(idx, 'vatRate', parseFloat(e.target.value) || 0)}
                            className="w-12 px-1 py-1 text-center border border-slate-300 rounded"
                          />
                        </td>
                        <td className="p-2 text-right text-slate-700">
                          {formatCurrency(item.vatAmount)}
                        </td>
                        <td className="p-2 text-right font-bold text-slate-900">
                          {formatCurrency(item.totalAmount)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summaries & Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Thanh toán cho nhà cung cấp
              </h4>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Số tiền đã trả nhà cung cấp:
                </label>
                <VnNumberInput
                  value={paidAmount}
                  onChange={(val) => setPaidAmount(val)}
                  decimals={0}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-base font-bold text-emerald-700 text-right font-mono"
                />
              </div>
              <div className="flex justify-between items-center text-xs pt-2">
                <span className="text-slate-600">Trạng thái công nợ:</span>
                <span className={`font-bold ${totals.debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {totals.debt > 0 ? `Còn nợ: ${formatCurrency(totals.debt)}` : 'Đã thanh toán đủ'}
                </span>
              </div>
            </div>

            <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-200 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-slate-700">
                <span>Thành tiền tổng Bill No:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Tổng thuế GTGT:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(totals.totalVat)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-teal-950 border-t border-teal-200 pt-2">
                <span>Tổng TT thanh toán:</span>
                <span className="text-teal-700 text-lg">{formatCurrency(totals.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{initialBill ? 'Cập nhật phiếu nhập' : 'Lưu phiếu nhập kho'}</span>
          </button>
        </div>
      </div>

      {/* Quick Add Product Inline Modal */}
      {isQuickAddProductOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-800 text-sm">Thêm nhanh Sản phẩm mới</h3>
              <button
                type="button"
                onClick={() => setIsQuickAddProductOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddProductSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Mã hàng hóa (*)</label>
                <input
                  type="text"
                  required
                  value={newProdCode}
                  onChange={(e) => setNewProdCode(e.target.value)}
                  placeholder="VD: DEN-OP-24W"
                  className="w-full px-3 py-1.5 border rounded-lg font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Tên hàng hóa (*)</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="VD: Đèn ốp trần 24W"
                  className="w-full px-3 py-1.5 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">ĐVT Mua</label>
                  <input
                    type="text"
                    value={newProdPurchaseUnit}
                    onChange={(e) => setNewProdPurchaseUnit(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">ĐVT Bán</label>
                  <input
                    type="text"
                    value={newProdSaleUnit}
                    onChange={(e) => setNewProdSaleUnit(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Thuế GTGT (%)</label>
                  <input
                    type="number"
                    value={newProdVat}
                    onChange={(e) => setNewProdVat(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tỷ suất LN (%)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newProdMargin}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
                        setNewProdMargin(val);
                      }
                    }}
                    placeholder="VD: 15 hoặc -5"
                    className="w-full px-3 py-1.5 border rounded-lg font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsQuickAddProductOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 text-white font-bold rounded-lg"
                >
                  Lưu & Thêm vào phiếu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Supplier Update Modal */}
      {isEditSupplierModalOpen && selectedSupplier && (
        <SupplierModal
          isOpen={isEditSupplierModalOpen}
          onClose={() => setIsEditSupplierModalOpen(false)}
          onSave={handleSaveSupplier}
          initialSupplier={selectedSupplier}
          existingCount={suppliers.length}
          existingSuppliers={suppliers}
        />
      )}

      {/* Supplier Add New Modal */}
      {isAddSupplierModalOpen && (
        <SupplierModal
          isOpen={isAddSupplierModalOpen}
          onClose={() => setIsAddSupplierModalOpen(false)}
          onSave={handleSaveSupplier}
          initialSupplier={null}
          existingCount={suppliers.length}
          existingSuppliers={suppliers}
        />
      )}
    </div>
  );
};
