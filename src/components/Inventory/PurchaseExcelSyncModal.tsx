import React, { useState, useMemo } from 'react';
import { Supplier, PurchaseBill, Product, AppUser } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  Package,
  Building2,
  Plus,
  RefreshCw,
  Check,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export interface ParsedItemCheck {
  id: string;
  productCode: string;
  productName: string;
  purchaseUnit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  isUncataloged: boolean; // Mã hàng hóa KHÔNG có trong danh mục sản phẩm (báo đỏ)
  matchedProduct?: Product;
}

export interface ParsedBillCheck {
  id: string;
  billNo: string;
  purchaseDate: string;
  supplierCode: string;
  supplierName: string;
  supplierTaxCode: string;
  isNewSupplier: boolean; // Nhà cung cấp KHÔNG có trong danh mục
  matchedSupplier?: Supplier;
  items: ParsedItemCheck[];
  subtotal: number;
  totalVat: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  isDuplicateBill: boolean; // Trùng mã số phiếu đã có trong hệ thống
  existingBill?: PurchaseBill;
  hasUncatalogedProducts: boolean; // Phiếu có ít nhất 1 mã hàng KHÔNG có trong danh mục (báo đỏ)
}

export interface NewProductDetected {
  code: string;
  name: string;
  purchaseUnit: string;
  vatRate: number;
  approxUnitPrice: number;
  occurrences: number;
}

export interface NewSupplierDetected {
  code: string;
  name: string;
  taxCode: string;
  occurrences: number;
}

interface PurchaseExcelSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedBills: ParsedBillCheck[];
  existingProducts: Product[];
  existingSuppliers: Supplier[];
  existingPurchases: PurchaseBill[];
  currentUser: AppUser;
  onConfirmImport: (config: {
    billsToImport: PurchaseBill[];
    newProductsToCreate: Product[];
    newSuppliersToCreate: Supplier[];
    suppliersToUpdate: Supplier[];
    duplicateAction: 'overwrite' | 'skip';
  }) => void;
}

export const PurchaseExcelSyncModal: React.FC<PurchaseExcelSyncModalProps> = ({
  isOpen,
  onClose,
  parsedBills,
  existingProducts,
  existingSuppliers,
  existingPurchases,
  currentUser,
  onConfirmImport,
}) => {
  // Sync options
  const [autoAddNewProducts, setAutoAddNewProducts] = useState(true);
  const [autoAddNewSuppliers, setAutoAddNewSuppliers] = useState(true);
  const [autoUpdateSuppliers, setAutoUpdateSuppliers] = useState(true);
  const [duplicateAction, setDuplicateAction] = useState<'overwrite' | 'skip'>('overwrite');

  // Filter tab inside modal
  const [activeTab, setActiveTab] = useState<'all' | 'uncataloged' | 'new_products' | 'new_suppliers' | 'duplicates'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Detect all unique uncataloged products across all bills
  const newProductsList = useMemo(() => {
    const map = new Map<string, NewProductDetected>();
    for (const bill of parsedBills) {
      for (const item of bill.items) {
        if (item.isUncataloged) {
          const codeUpper = item.productCode.toUpperCase();
          const existing = map.get(codeUpper);
          if (existing) {
            existing.occurrences += 1;
            if (!existing.name && item.productName) existing.name = item.productName;
            if (item.unitPrice > 0) existing.approxUnitPrice = item.unitPrice;
          } else {
            map.set(codeUpper, {
              code: item.productCode,
              name: item.productName || item.productCode,
              purchaseUnit: item.purchaseUnit || 'Cái',
              vatRate: item.vatRate || 0,
              approxUnitPrice: item.unitPrice || 0,
              occurrences: 1,
            });
          }
        }
      }
    }
    return Array.from(map.values());
  }, [parsedBills]);

  // 2. Detect all unique new suppliers across all bills
  const newSuppliersList = useMemo(() => {
    const map = new Map<string, NewSupplierDetected>();
    for (const bill of parsedBills) {
      if (bill.isNewSupplier) {
        const codeUpper = bill.supplierCode.toUpperCase();
        const existing = map.get(codeUpper);
        if (existing) {
          existing.occurrences += 1;
          if (!existing.taxCode && bill.supplierTaxCode) existing.taxCode = bill.supplierTaxCode;
          if (!existing.name && bill.supplierName) existing.name = bill.supplierName;
        } else {
          map.set(codeUpper, {
            code: bill.supplierCode,
            name: bill.supplierName || bill.supplierCode,
            taxCode: bill.supplierTaxCode || '',
            occurrences: 1,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [parsedBills]);

  // 3. Duplicate bills list
  const duplicateBills = useMemo(() => {
    return parsedBills.filter((b) => b.isDuplicateBill);
  }, [parsedBills]);

  // 4. Uncataloged bills (Bills with at least 1 uncataloged product - BÁO ĐỎ)
  const uncatalogedBills = useMemo(() => {
    return parsedBills.filter((b) => b.hasUncatalogedProducts);
  }, [parsedBills]);

  // Total items count
  const totalItemCount = useMemo(() => {
    return parsedBills.reduce((sum, b) => sum + b.items.length, 0);
  }, [parsedBills]);

  // Filtered bills for display
  const displayedBills = useMemo(() => {
    return parsedBills.filter((bill) => {
      // Tab filter
      if (activeTab === 'uncataloged' && !bill.hasUncatalogedProducts) return false;
      if (activeTab === 'duplicates' && !bill.isDuplicateBill) return false;

      // Search term filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchBill = bill.billNo.toLowerCase().includes(q);
        const matchSup = bill.supplierName.toLowerCase().includes(q) || bill.supplierCode.toLowerCase().includes(q);
        const matchItem = bill.items.some(
          (it) => it.productCode.toLowerCase().includes(q) || it.productName.toLowerCase().includes(q)
        );
        if (!matchBill && !matchSup && !matchItem) return false;
      }

      return true;
    });
  }, [parsedBills, activeTab, searchTerm]);

  // Handle Confirm Submission
  const handleConfirm = (importOnlyValid: boolean = false) => {
    let finalBillsToProcess = parsedBills;

    // If user chooses to only import valid bills and skip uncataloged bills
    if (importOnlyValid) {
      finalBillsToProcess = parsedBills.filter((b) => !b.hasUncatalogedProducts);
      if (finalBillsToProcess.length === 0) {
        alert('Không có phiếu nào hợp lệ để nhập.');
        return;
      }
    }

    // Prepare new Product records
    const newProductsToCreate: Product[] = [];
    if (autoAddNewProducts && !importOnlyValid) {
      newProductsList.forEach((np, idx) => {
        newProductsToCreate.push({
          id: `prod-sync-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          code: np.code.trim().toUpperCase(),
          name: np.name.trim(),
          purchaseUnit: np.purchaseUnit || 'Cái',
          saleUnit: np.purchaseUnit || 'Cái',
          conversionRate: 1,
          vatRate: np.vatRate || 0,
          category: 'Hàng nhập kho Excel',
          profitMargin: 20,
          defaultSalePrice: np.approxUnitPrice > 0 ? Math.round(np.approxUnitPrice * 1.2) : undefined,
          notes: 'Tự động đồng bộ từ file Excel nhập kho',
        });
      });
    }

    // Prepare new Supplier records
    const newSuppliersToCreate: Supplier[] = [];
    if (autoAddNewSuppliers) {
      newSuppliersList.forEach((ns, idx) => {
        newSuppliersToCreate.push({
          id: `sup-sync-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          code: ns.code.trim().toUpperCase(),
          name: ns.name.trim().toUpperCase(),
          shortName: ns.name.trim().toUpperCase(),
          taxCode: ns.taxCode.trim(),
          phone: '',
          address: '',
          notes: 'Tự động đồng bộ từ file Excel nhập kho',
          createdAt: new Date().toISOString().slice(0, 10),
        });
      });
    }

    // Prepare updated suppliers
    const suppliersToUpdate: Supplier[] = [];
    if (autoUpdateSuppliers) {
      existingSuppliers.forEach((s) => {
        const matchingBill = parsedBills.find((b) => b.supplierCode.toUpperCase() === s.code.toUpperCase());
        if (matchingBill && matchingBill.supplierTaxCode && !s.taxCode) {
          suppliersToUpdate.push({
            ...s,
            taxCode: matchingBill.supplierTaxCode,
          });
        }
      });
    }

    // Convert ParsedBillCheck to standard PurchaseBill
    const billsToImport: PurchaseBill[] = finalBillsToProcess.map((b) => ({
      id: b.id,
      billNo: b.billNo,
      purchaseDate: b.purchaseDate,
      supplierCode: b.supplierCode,
      supplierTaxCode: b.supplierTaxCode,
      supplierName: b.supplierName,
      items: b.items.map((it) => ({
        id: it.id,
        productCode: it.productCode,
        productName: it.productName,
        purchaseUnit: it.purchaseUnit,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        amount: it.amount,
        vatRate: it.vatRate,
        vatAmount: it.vatAmount,
        totalAmount: it.totalAmount,
      })),
      subtotal: b.subtotal,
      totalVat: b.totalVat,
      totalAmount: b.totalAmount,
      paidAmount: b.paidAmount,
      paymentStatus: b.paymentStatus,
      createdById: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    onConfirmImport({
      billsToImport,
      newProductsToCreate,
      newSuppliersToCreate,
      suppliersToUpdate,
      duplicateAction,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-teal-700 via-slate-800 to-indigo-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 shadow-inner border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight">
                  Kiểm tra & Đồng bộ Phiếu nhập kho từ Excel
                </h3>
                {uncatalogedBills.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white animate-pulse">
                    Có {uncatalogedBills.length} phiếu báo đỏ
                  </span>
                )}
              </div>
              <p className="text-xs text-teal-100/90 mt-0.5">
                Kiểm tra đối chiếu mã hàng hóa & nhà cung cấp với phần mềm, tự động phát hiện mã mới để thêm và cập nhật
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm bg-slate-50/50">
          {/* RED ALERT BANNER (If there are uncataloged products) */}
          {uncatalogedBills.length > 0 ? (
            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-rose-900 text-sm sm:text-base flex items-center gap-2">
                    <span>CẢNH BÁO: CÓ {uncatalogedBills.length} PHIẾU CHỨA MÃ HÀNG HÓA CHƯA CÓ TRONG DANH MỤC (BÁO ĐỎ)</span>
                  </h4>
                  <p className="text-xs text-rose-700 mt-1">
                    Phát hiện <strong className="font-bold underline">{newProductsList.length} mã hàng mới</strong> trong file Excel chưa tồn tại trong danh mục sản phẩm của phần mềm.
                    Các phiếu này và các dòng hàng hóa tương ứng được <strong>BÁO ĐỎ</strong> bên dưới.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('uncataloged')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all"
                >
                  Xem {uncatalogedBills.length} phiếu báo đỏ
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center gap-3 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs font-semibold">
                Toàn bộ mã hàng hóa trong file Excel đều đã khớp chính xác với Danh mục sản phẩm trên phần mềm!
              </div>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng số phiếu</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                {parsedBills.length} <span className="text-xs font-normal text-slate-500">({totalItemCount} mặt hàng)</span>
              </div>
            </div>

            <div className={`p-3 rounded-2xl border transition-all ${
              newProductsList.length > 0
                ? 'bg-rose-50 border-rose-300 shadow-xs'
                : 'bg-white border-slate-200 shadow-2xs'
            }`}>
              <div className="text-[11px] font-bold uppercase tracking-wider flex items-center justify-between">
                <span className={newProductsList.length > 0 ? 'text-rose-800 font-extrabold' : 'text-slate-500'}>
                  Mã HH chưa có (Báo đỏ)
                </span>
                {newProductsList.length > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
              </div>
              <div className={`text-xl sm:text-2xl font-black mt-0.5 ${
                newProductsList.length > 0 ? 'text-rose-600' : 'text-slate-800'
              }`}>
                {newProductsList.length} <span className="text-xs font-normal text-slate-500">mã mới</span>
              </div>
            </div>

            <div className={`p-3 rounded-2xl border transition-all ${
              newSuppliersList.length > 0
                ? 'bg-amber-50 border-amber-300 shadow-xs'
                : 'bg-white border-slate-200 shadow-2xs'
            }`}>
              <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                Nhà cung cấp mới
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-700 mt-0.5">
                {newSuppliersList.length} <span className="text-xs font-normal text-slate-500">NCC mới</span>
              </div>
            </div>

            <div className={`p-3 rounded-2xl border transition-all ${
              duplicateBills.length > 0
                ? 'bg-orange-50 border-orange-300 shadow-xs'
                : 'bg-white border-slate-200 shadow-2xs'
            }`}>
              <div className="text-[11px] font-bold text-orange-800 uppercase tracking-wider">
                Phiếu trùng số
              </div>
              <div className="text-xl sm:text-2xl font-black text-orange-700 mt-0.5">
                {duplicateBills.length} <span className="text-xs font-normal text-slate-500">phiếu</span>
              </div>
            </div>
          </div>

          {/* Sync & Auto-Add Controls Panel */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-teal-600" />
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wide">
                Tùy chọn Đồng bộ & Thêm mới vào phần mềm
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Product Sync Checkbox */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                autoAddNewProducts
                  ? 'bg-teal-50/70 border-teal-300 text-teal-900 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={autoAddNewProducts}
                  onChange={(e) => setAutoAddNewProducts(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded mt-0.5 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-teal-600" />
                    <span>Tự động thêm {newProductsList.length} mã hàng mới vào Danh mục sản phẩm</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Hệ thống sẽ tự động tạo sản phẩm mới với tên, ĐVT_Mua, thuế suất VAT từ file Excel để đồng bộ ngay lập tức.
                  </p>
                </div>
              </label>

              {/* Supplier Sync Checkbox */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                autoAddNewSuppliers
                  ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={autoAddNewSuppliers}
                  onChange={(e) => setAutoAddNewSuppliers(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded mt-0.5 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Tự động thêm {newSuppliersList.length} nhà cung cấp mới vào Danh mục NCC</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Tạo mới nhà cung cấp chưa có với Mã NCC, Tên và Mã số thuế lấy từ file Excel.
                  </p>
                </div>
              </label>
            </div>

            {/* Duplicate bill strategy */}
            {duplicateBills.length > 0 && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="text-xs font-bold text-amber-900">
                    Xử lý {duplicateBills.length} số phiếu đã tồn tại trong hệ thống:
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="duplicateAction"
                      value="overwrite"
                      checked={duplicateAction === 'overwrite'}
                      onChange={() => setDuplicateAction('overwrite')}
                      className="text-amber-600"
                    />
                    <span>Ghi đè phiếu cũ</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="duplicateAction"
                      value="skip"
                      checked={duplicateAction === 'skip'}
                      onChange={() => setDuplicateAction('skip')}
                      className="text-amber-600"
                    />
                    <span>Bỏ qua phiếu trùng</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-2.5 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tất cả phiếu ({parsedBills.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('uncataloged')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'uncataloged'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : uncatalogedBills.length > 0
                    ? 'bg-rose-100 text-rose-800 hover:bg-rose-200 font-black'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {uncatalogedBills.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                🚨 Phiếu báo đỏ ({uncatalogedBills.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('new_products')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'new_products'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Mã HH mới ({newProductsList.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('new_suppliers')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'new_suppliers'
                    ? 'bg-indigo-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                NCC mới ({newSuppliersList.length})
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <input
                type="text"
                placeholder="Tìm mã phiếu, mã HH, NCC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white font-medium"
              />
              <X
                className={`w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 cursor-pointer ${
                  searchTerm ? 'block' : 'hidden'
                }`}
                onClick={() => setSearchTerm('')}
              />
            </div>
          </div>

          {/* TAB CONTENT: TAB NEW PRODUCTS */}
          {activeTab === 'new_products' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3.5 bg-teal-50 border-b border-teal-200 flex justify-between items-center">
                <span className="font-bold text-teal-900 text-xs sm:text-sm">
                  Danh sách {newProductsList.length} Mã hàng hóa mới phát hiện trong file Excel (Sẽ được đồng bộ vào Danh mục sản phẩm)
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-200 text-teal-900">
                  {autoAddNewProducts ? 'Tự động tạo mã: BẬT' : 'Tự động tạo mã: TẮT'}
                </span>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0">
                    <tr>
                      <th className="p-2.5 text-center w-10">STT</th>
                      <th className="p-2.5">Mã hàng hóa mới</th>
                      <th className="p-2.5">Tên hàng hóa</th>
                      <th className="p-2.5 text-center">ĐVT_Mua</th>
                      <th className="p-2.5 text-center">Thuế %</th>
                      <th className="p-2.5 text-right">Đơn giá nhập</th>
                      <th className="p-2.5 text-center">Trạng thái danh mục</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {newProductsList.map((np, idx) => (
                      <tr key={np.code} className="hover:bg-teal-50/50">
                        <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-mono font-bold text-rose-700 bg-rose-50 px-2 rounded">
                          {np.code}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-900">{np.name}</td>
                        <td className="p-2.5 text-center text-slate-700">{np.purchaseUnit}</td>
                        <td className="p-2.5 text-center font-semibold text-indigo-700">{np.vatRate}%</td>
                        <td className="p-2.5 text-right font-medium text-slate-800">
                          {formatCurrency(np.approxUnitPrice)}
                        </td>
                        <td className="p-2.5 text-center">
                          {autoAddNewProducts ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-3 h-3" /> Sẽ tạo mới vào danh mục
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              Chưa có trong danh mục
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB CONTENT: TAB NEW SUPPLIERS */}
          {activeTab === 'new_suppliers' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3.5 bg-indigo-50 border-b border-indigo-200 flex justify-between items-center">
                <span className="font-bold text-indigo-900 text-xs sm:text-sm">
                  Danh sách {newSuppliersList.length} Nhà cung cấp mới phát hiện trong file Excel
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-200 text-indigo-900">
                  {autoAddNewSuppliers ? 'Tự động tạo NCC: BẬT' : 'Tự động tạo NCC: TẮT'}
                </span>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0">
                    <tr>
                      <th className="p-2.5 text-center w-10">STT</th>
                      <th className="p-2.5">Mã NCC mới</th>
                      <th className="p-2.5">Tên nhà cung cấp</th>
                      <th className="p-2.5">Mã số thuế</th>
                      <th className="p-2.5 text-center">Số phiếu liên quan</th>
                      <th className="p-2.5 text-center">Trạng thái danh mục</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {newSuppliersList.map((ns, idx) => (
                      <tr key={ns.code} className="hover:bg-indigo-50/50">
                        <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-mono font-bold text-indigo-700 bg-indigo-50 px-2 rounded">
                          {ns.code}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-900">{ns.name}</td>
                        <td className="p-2.5 font-mono text-slate-700">{ns.taxCode || '—'}</td>
                        <td className="p-2.5 text-center text-slate-700 font-semibold">{ns.occurrences}</td>
                        <td className="p-2.5 text-center">
                          {autoAddNewSuppliers ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-3 h-3" /> Sẽ tạo mới vào danh mục
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Chưa có trong danh mục
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB CONTENT: BILLS LIST (ALL OR UNCATALOGED) */}
          {(activeTab === 'all' || activeTab === 'uncataloged' || activeTab === 'duplicates') && (
            <div className="space-y-3.5">
              {displayedBills.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
                  Không tìm thấy phiếu nhập nào phù hợp với bộ lọc.
                </div>
              ) : (
                displayedBills.map((bill, billIdx) => (
                  <div
                    key={bill.id}
                    className={`rounded-2xl border transition-all overflow-hidden bg-white shadow-2xs ${
                      bill.hasUncatalogedProducts
                        ? 'border-2 border-rose-500 ring-2 ring-rose-200/50 shadow-rose-100'
                        : bill.isDuplicateBill
                        ? 'border-amber-400'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Bill Card Header */}
                    <div
                      className={`p-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
                        bill.hasUncatalogedProducts
                          ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                          : bill.isDuplicateBill
                          ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                          : 'bg-slate-50/80 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-300 shadow-2xs text-slate-900">
                          #{bill.billNo}
                        </span>
                        <span className="text-xs text-slate-600 font-medium">
                          Ngày: <strong>{bill.purchaseDate}</strong>
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-700 font-semibold">
                          NCC: <strong className="text-slate-900">{bill.supplierName}</strong> ({bill.supplierCode})
                        </span>
                        {bill.supplierTaxCode && (
                          <span className="text-[11px] font-mono text-slate-500">
                            MST: {bill.supplierTaxCode}
                          </span>
                        )}
                      </div>

                      {/* Status Badges on Bill Header */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* BÁO ĐỎ: Phiếu có mã hàng hóa không có trong danh mục */}
                        {bill.hasUncatalogedProducts && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white shadow-xs">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>BÁO ĐỎ: CÓ MÃ HÀNG CHƯA CÓ TRONG DANH MỤC</span>
                          </span>
                        )}

                        {bill.isNewSupplier && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                            <Building2 className="w-3 h-3" />
                            <span>NCC mới</span>
                          </span>
                        )}

                        {bill.isDuplicateBill && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Trùng số phiếu</span>
                          </span>
                        )}

                        <span className="text-xs font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                          {formatCurrency(bill.totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Items Table inside Bill */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100/70 text-slate-600 uppercase font-bold text-[10px]">
                          <tr>
                            <th className="p-2 w-8 text-center">#</th>
                            <th className="p-2 min-w-36">Mã hàng hóa</th>
                            <th className="p-2 min-w-48">Tên hàng hóa</th>
                            <th className="p-2 text-center">ĐVT_Mua</th>
                            <th className="p-2 text-right">Số lượng</th>
                            <th className="p-2 text-right">Đơn giá</th>
                            <th className="p-2 text-center">Thuế %</th>
                            <th className="p-2 text-right">Thành tiền</th>
                            <th className="p-2 text-center">Đối chiếu phần mềm</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bill.items.map((item, itemIdx) => (
                            <tr
                              key={item.id}
                              className={`transition-colors ${
                                item.isUncataloged
                                  ? 'bg-rose-50/70 hover:bg-rose-100/70'
                                  : 'hover:bg-slate-50/60'
                              }`}
                            >
                              <td className="p-2 text-center text-slate-400">{itemIdx + 1}</td>
                              
                              {/* CỘT MÃ HÀNG HÓA - BÁO ĐỎ NẾU CHƯA CÓ TRONG DANH MỤC */}
                              <td className="p-2">
                                {item.isUncataloged ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-mono font-black text-rose-700 bg-rose-100 border border-rose-400 px-2 py-0.5 rounded text-xs inline-block w-fit">
                                      {item.productCode}
                                    </span>
                                    <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">
                                      <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                                      Chưa có trong danh mục
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-mono font-bold text-teal-800 text-xs">
                                      {item.productCode}
                                    </span>
                                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                      Đã có trên phần mềm
                                    </span>
                                  </div>
                                )}
                              </td>

                              <td className="p-2 font-medium text-slate-800">{item.productName}</td>
                              <td className="p-2 text-center text-slate-600">{item.purchaseUnit}</td>
                              <td className="p-2 text-right font-bold text-slate-900">
                                {formatNumber(item.quantity)}
                              </td>
                              <td className="p-2 text-right text-slate-700">
                                {formatCurrency(item.unitPrice)}
                              </td>
                              <td className="p-2 text-center text-indigo-700 font-semibold">{item.vatRate}%</td>
                              <td className="p-2 text-right font-bold text-slate-900">
                                {formatCurrency(item.totalAmount)}
                              </td>

                              {/* CỘT TRẠNG THÁI DANH MỤC */}
                              <td className="p-2 text-center">
                                {item.isUncataloged ? (
                                  autoAddNewProducts ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                                      <Plus className="w-2.5 h-2.5" /> Sẽ tự động thêm mới
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-2xs">
                                      ❌ BÁO ĐỎ: Thiếu mã
                                    </span>
                                  )
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                    ✓ Hợp lệ
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {uncatalogedBills.length > 0 ? (
              <span className="text-rose-700 font-bold flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                Có {uncatalogedBills.length} phiếu chứa mã hàng chưa có trong danh mục.
                {autoAddNewProducts && ' Tùy chọn tự động thêm mã mới đã được bật.'}
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Tất cả {parsedBills.length} phiếu đều hợp lệ và sẵn sàng nhập vào hệ thống.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm cursor-pointer transition-colors"
            >
              Hủy bỏ
            </button>

            {/* Option to only import valid bills if there are uncataloged bills */}
            {uncatalogedBills.length > 0 && !autoAddNewProducts && (
              <button
                type="button"
                onClick={() => handleConfirm(true)}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs cursor-pointer transition-colors"
                title="Bỏ qua các phiếu báo đỏ và chỉ nhập phiếu hợp lệ"
              >
                Chỉ nhập {parsedBills.length - uncatalogedBills.length} phiếu hợp lệ
              </button>
            )}

            {/* Main Action: Import & Sync */}
            <button
              type="button"
              onClick={() => handleConfirm(false)}
              className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-teal-500/25 cursor-pointer transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>
                {autoAddNewProducts && newProductsList.length > 0
                  ? `Đồng bộ & Nhập ${parsedBills.length} phiếu (Thêm ${newProductsList.length} mã mới)`
                  : `Xác nhận nhập ${parsedBills.length} phiếu nhập kho`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
