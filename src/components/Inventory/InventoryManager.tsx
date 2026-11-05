import React, { useState, useMemo } from 'react';
import { Supplier, PurchaseBill, Product, AppSettings, AppUser } from '../../types';
import { formatCurrency, formatPrecise, formatDate, formatNumber } from '../../utils/formatters';
import {
  exportPurchasesToExcel,
  downloadPurchaseTemplate,
  parseExcelFile,
  exportSuppliersToExcel,
  downloadSupplierTemplate,
} from '../../services/excelService';
import { PurchaseFormModal } from './PurchaseFormModal';
import { SupplierModal } from './SupplierModal';
import { ExcelDuplicateConflictModal, ConflictItem } from '../Common/ExcelDuplicateConflictModal';
import { PurchaseExcelSyncModal, ParsedBillCheck, ParsedItemCheck } from './PurchaseExcelSyncModal';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Package,
  Plus,
  Search,
  Building2,
  FileSpreadsheet,
  Download,
  Upload,
  Edit,
  Trash2,
  Eye,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Info,
  CheckSquare,
  Square,
  Calendar,
  X
} from 'lucide-react';

interface InventoryManagerProps {
  purchases: PurchaseBill[];
  suppliers: Supplier[];
  products: Product[];
  currentUser: AppUser;
  settings: AppSettings;
  onSavePurchase: (bill: PurchaseBill) => void;
  onDeletePurchase: (billId: string) => void;
  onBatchUpdatePurchases: (bills: PurchaseBill[]) => void;
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onBatchUpdateSuppliers?: (suppliers: Supplier[]) => void;
  onAddNewProduct: (product: Product) => void;
  onBatchUpdateProducts?: (products: Product[]) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  purchases,
  suppliers,
  products,
  currentUser,
  settings,
  onSavePurchase,
  onDeletePurchase,
  onBatchUpdatePurchases,
  onSaveSupplier,
  onDeleteSupplier,
  onBatchUpdateSuppliers,
  onAddNewProduct,
  onBatchUpdateProducts,
}) => {
  const confirm = useConfirm();
  const [activeSubTab, setActiveSubTab] = useState<'purchases' | 'suppliers'>('purchases');

  // Excel Purchase Inspection & Sync Modal
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [parsedExcelBills, setParsedExcelBills] = useState<ParsedBillCheck[]>([]);

  // Fast set of existing product codes for checking uncataloged items (báo đỏ)
  const existingProductCodesMap = useMemo(
    () => new Set(products.map((p) => p.code.trim().toUpperCase())),
    [products]
  );

  // Fast sets of existing suppliers for checking uncataloged / missing suppliers
  const existingSupplierMap = useMemo(() => {
    const codeSet = new Set<string>();
    const taxSet = new Set<string>();
    const nameSet = new Set<string>();
    suppliers.forEach((s) => {
      if (s.code?.trim()) codeSet.add(s.code.trim().toUpperCase());
      if (s.taxCode?.trim()) taxSet.add(s.taxCode.trim().toUpperCase());
      if (s.name?.trim()) nameSet.add(s.name.trim().toLowerCase());
    });
    return { codeSet, taxSet, nameSet };
  }, [suppliers]);

  // Helpers to check missing product code or uncataloged product
  const isItemMissingProductCode = (item: { productCode?: string }) => {
    const code = (item.productCode || '').trim();
    if (!code) return true;
    return !existingProductCodesMap.has(code.toUpperCase());
  };

  const isBillMissingProduct = (bill: PurchaseBill) => {
    if (!bill.items || bill.items.length === 0) return true;
    return bill.items.some((it) => isItemMissingProductCode(it));
  };

  // Helper to check missing or uncataloged supplier
  const isBillMissingSupplier = (bill: PurchaseBill) => {
    const supCode = (bill.supplierCode || '').trim().toUpperCase();
    const supTax = (bill.supplierTaxCode || '').trim().toUpperCase();
    const supName = (bill.supplierName || '').trim().toLowerCase();

    // If completely empty code and name
    if (!supCode && !supName) return true;
    if (!supCode || supCode === 'NCC-MOI' || supCode === 'CHUA-CO-NCC') return true;

    const matchCode = existingSupplierMap.codeSet.has(supCode);
    const matchTax = supTax ? existingSupplierMap.taxSet.has(supTax) : false;
    const matchName = supName ? existingSupplierMap.nameSet.has(supName) : false;

    return !matchCode && !matchTax && !matchName;
  };

  // Filter by missing product code or missing supplier (Requirement: lọc phiếu chưa có mã hàng, đơn vị cung cấp)
  const [missingFilter, setMissingFilter] = useState<'all' | 'missing_product' | 'missing_supplier' | 'missing_both' | 'missing_any'>('all');

  // Real-time bill counts for missing info
  const missingInfoStats = useMemo(() => {
    let missingProductBills = 0;
    let missingSupplierBills = 0;
    let missingBothBills = 0;
    let missingAnyBills = 0;

    purchases.forEach((b) => {
      const missProd = isBillMissingProduct(b);
      const missSup = isBillMissingSupplier(b);
      if (missProd) missingProductBills++;
      if (missSup) missingSupplierBills++;
      if (missProd && missSup) missingBothBills++;
      if (missProd || missSup) missingAnyBills++;
    });

    return {
      missingProductBills,
      missingSupplierBills,
      missingBothBills,
      missingAnyBills,
    };
  }, [purchases, existingProductCodesMap, existingSupplierMap]);

  // Search & Date range filter
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const hasActivePurchasesFilter =
    searchTerm.trim() !== '' ||
    startDate !== '' ||
    endDate !== '' ||
    missingFilter !== 'all';

  const handleResetPurchasesFilter = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setMissingFilter('all');
  };

  // Selected bills for batch delete (Requirement 6)
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);

  // Modals
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<PurchaseBill | null>(null);

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const purchaseDecimals = settings.purchasePriceDecimals ?? 10;

  // Flattened items view with cumulative quantities and bill grouping
  const flattenedPurchaseItems = useMemo(() => {
    // 1. Calculate cumulative quantity chronologically (oldest to newest)
    const chronologicalBills = [...purchases].sort((a, b) =>
      a.purchaseDate.localeCompare(b.purchaseDate) || a.createdAt.localeCompare(b.createdAt)
    );

    const cumulativeMap = new Map<string, number>();
    const itemCumulativeMap = new Map<string, number>();

    for (const bill of chronologicalBills) {
      for (const item of bill.items) {
        const prevCumulative = cumulativeMap.get(item.productCode) || 0;
        const currentCumulative = prevCumulative + item.quantity;
        cumulativeMap.set(item.productCode, currentCumulative);
        itemCumulativeMap.set(`${bill.id}_${item.id}`, currentCumulative);
      }
    }

    // 2. Sort bills newest first for display, preserving item order within each bill
    const displayBills = [...purchases].sort((a, b) =>
      b.purchaseDate.localeCompare(a.purchaseDate) || b.createdAt.localeCompare(a.createdAt)
    );

    const rows: any[] = [];

    for (const bill of displayBills) {
      if (!bill.items || bill.items.length === 0) {
        rows.push({
          billId: bill.id,
          billNo: bill.billNo,
          purchaseDate: bill.purchaseDate,
          supplierCode: bill.supplierCode,
          supplierTaxCode: bill.supplierTaxCode,
          supplierName: bill.supplierName,
          itemId: `empty-${bill.id}`,
          itemIndex: 0,
          isFirstRowInBill: true,
          totalItemsInBill: 0,
          productCode: '',
          productName: '(Phiếu chưa có mặt hàng nào)',
          purchaseUnit: '—',
          quantity: 0,
          unitPrice: 0,
          amount: 0,
          vatRate: 0,
          vatAmount: 0,
          billSubtotal: bill.subtotal || 0,
          billTotalVat: bill.totalVat || 0,
          billTotalAmount: bill.totalAmount || 0,
          billPaidAmount: bill.paidAmount || 0,
          billPaymentStatus: bill.paymentStatus || 'unpaid',
          cumulativeQuantity: 0,
          rawBill: bill,
        });
        continue;
      }

      bill.items.forEach((item, itemIdx) => {
        const currentCumulative = itemCumulativeMap.get(`${bill.id}_${item.id}`) ?? item.quantity;

        rows.push({
          billId: bill.id,
          billNo: bill.billNo,
          purchaseDate: bill.purchaseDate,
          supplierCode: bill.supplierCode,
          supplierTaxCode: bill.supplierTaxCode,
          supplierName: bill.supplierName,
          itemId: item.id,
          itemIndex: itemIdx,
          isFirstRowInBill: itemIdx === 0,
          totalItemsInBill: bill.items.length,
          productCode: item.productCode,
          productName: item.productName,
          purchaseUnit: item.purchaseUnit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          vatRate: item.vatRate,
          vatAmount: item.vatAmount,
          billSubtotal: bill.subtotal,
          billTotalVat: bill.totalVat,
          billTotalAmount: bill.totalAmount,
          billPaidAmount: bill.paidAmount,
          billPaymentStatus: bill.paymentStatus,
          cumulativeQuantity: currentCumulative,
          rawBill: bill,
        });
      });
    }

    // Filter by date range (Requirement 5)
    let filtered = rows;
    if (startDate || endDate) {
      filtered = filtered.filter(
        (r) => (!startDate || r.purchaseDate >= startDate) && (!endDate || r.purchaseDate <= endDate)
      );
    }

    // Filter by search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.billNo.toLowerCase().includes(q) ||
          r.productName.toLowerCase().includes(q) ||
          r.productCode.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q) ||
          (r.supplierCode && r.supplierCode.toLowerCase().includes(q)) ||
          (r.supplierTaxCode && r.supplierTaxCode.toLowerCase().includes(q))
      );
    }

    // Filter by missing product code or missing supplier (Requirement: lọc phiếu chưa có mã hàng, đơn vị cung cấp)
    if (missingFilter !== 'all') {
      filtered = filtered.filter((r) => {
        const missProd = isBillMissingProduct(r.rawBill);
        const missSup = isBillMissingSupplier(r.rawBill);
        if (missingFilter === 'missing_product') return missProd;
        if (missingFilter === 'missing_supplier') return missSup;
        if (missingFilter === 'missing_both') return missProd && missSup;
        if (missingFilter === 'missing_any') return missProd || missSup;
        return true;
      });
    }

    return filtered;
  }, [purchases, searchTerm, startDate, endDate, missingFilter, existingProductCodesMap, existingSupplierMap]);

  // Unique bill IDs currently visible in the table
  const uniqueFilteredBillIds = useMemo(() => {
    return Array.from(new Set(flattenedPurchaseItems.map((r) => r.billId)));
  }, [flattenedPurchaseItems]);

  const handleToggleSelectAllBills = () => {
    if (selectedBillIds.length === uniqueFilteredBillIds.length) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(uniqueFilteredBillIds);
    }
  };

  const handleToggleSelectBill = (billId: string) => {
    setSelectedBillIds((prev) =>
      prev.includes(billId) ? prev.filter((id) => id !== billId) : [...prev, billId]
    );
  };

  const handleBatchDeletePurchases = async () => {
    if (selectedBillIds.length === 0) {
      alert('Vui lòng chọn ít nhất một phiếu nhập kho để xóa.');
      return;
    }
    const ok = await confirm({
      title: 'Xác nhận xóa phiếu nhập hàng hàng loạt',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedBillIds.length} phiếu nhập kho đã chọn không? Thao tác này sẽ cập nhật lại số lượng tồn kho và công nợ!`,
      confirmText: 'Xác nhận xóa',
      type: 'danger',
    });
    if (ok) {
      selectedBillIds.forEach((id) => onDeletePurchase(id));
      setSelectedBillIds([]);
    }
  };

  // Aggregate KPI stats for purchases
  const kpiStats = useMemo(() => {
    let totalQuantity = 0;
    let totalSubtotal = 0;
    let totalVat = 0;
    let totalAmount = 0;
    const uniqueBillIds = new Set<string>();

    flattenedPurchaseItems.forEach((r) => {
      totalQuantity += r.quantity || 0;
      if (!uniqueBillIds.has(r.billId)) {
        uniqueBillIds.add(r.billId);
        totalSubtotal += r.billSubtotal || 0;
        totalVat += r.billTotalVat || 0;
        totalAmount += r.billTotalAmount || 0;
      }
    });

    return {
      billCount: uniqueBillIds.size,
      rowCount: flattenedPurchaseItems.length,
      totalQuantity,
      totalSubtotal,
      totalVat,
      totalAmount,
    };
  }, [flattenedPurchaseItems]);

  // Filtered suppliers with duplicate tax filtering & sorting
  const [supplierFilterDuplicateTax, setSupplierFilterDuplicateTax] = useState(false);
  const [supplierSortField, setSupplierSortField] = useState<'default' | 'code' | 'taxCode'>('default');
  const [supplierSortDirection, setSupplierSortDirection] = useState<'asc' | 'desc'>('asc');

  // Duplicate tax codes check for suppliers (REQUIREMENT: nếu trong danh mục có trùng mã số thuế thì bôi đỏ)
  const duplicateSupplierTaxCodes = useMemo(() => {
    const counts = new Map<string, number>();
    suppliers.forEach((s) => {
      const t = s.taxCode?.trim();
      if (t) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    });
    const dupes = new Set<string>();
    counts.forEach((count, tax) => {
      if (count > 1) dupes.add(tax);
    });
    return dupes;
  }, [suppliers]);

  const duplicateSupplierCount = useMemo(() => {
    return suppliers.filter((s) => s.taxCode && duplicateSupplierTaxCodes.has(s.taxCode.trim())).length;
  }, [suppliers, duplicateSupplierTaxCodes]);

  const filteredSuppliers = useMemo(() => {
    let list = suppliers;
    if (supplierSearch.trim()) {
      const q = supplierSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.shortName.toLowerCase().includes(q) ||
          s.taxCode.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q)
      );
    }

    if (supplierFilterDuplicateTax) {
      list = list.filter((s) => s.taxCode && duplicateSupplierTaxCodes.has(s.taxCode.trim()));
    }

    if (supplierSortField !== 'default') {
      list = [...list].sort((a, b) => {
        let valA = '';
        let valB = '';
        if (supplierSortField === 'code') {
          valA = a.code || '';
          valB = b.code || '';
        } else if (supplierSortField === 'taxCode') {
          valA = a.taxCode || '';
          valB = b.taxCode || '';
        }

        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
        if (!valA && !valB) return 0;

        const cmp = valA.localeCompare(valB, 'vi', { numeric: true, sensitivity: 'base' });
        return supplierSortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [suppliers, supplierSearch, supplierFilterDuplicateTax, duplicateSupplierTaxCodes, supplierSortField, supplierSortDirection]);

  const handleSupplierSort = (field: 'code' | 'taxCode') => {
    if (supplierSortField === field) {
      setSupplierSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSupplierSortField(field);
      setSupplierSortDirection('asc');
    }
  };

  // Supplier Excel Import State
  const [supplierConflictModalOpen, setSupplierConflictModalOpen] = useState(false);
  const [pendingSupplierConflicts, setPendingSupplierConflicts] = useState<ConflictItem[]>([]);
  const [pendingNewSuppliers, setPendingNewSuppliers] = useState<Supplier[]>([]);
  const [pendingOverwrittenSuppliers, setPendingOverwrittenSuppliers] = useState<Supplier[]>([]);
  const [totalSupplierImportedCount, setTotalSupplierImportedCount] = useState(0);

  // Purchase Bill Excel Duplicate State
  const [purchaseConflictModalOpen, setPurchaseConflictModalOpen] = useState(false);
  const [pendingPurchaseConflicts, setPendingPurchaseConflicts] = useState<ConflictItem[]>([]);
  const [pendingNewBills, setPendingNewBills] = useState<PurchaseBill[]>([]);
  const [pendingOverwrittenBills, setPendingOverwrittenBills] = useState<PurchaseBill[]>([]);
  const [totalBillsImportedCount, setTotalBillsImportedCount] = useState(0);

  const handleSupplierExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = await confirm({
      title: 'Xác nhận nhập danh mục nhà cung cấp từ Excel',
      message: `Bạn có chắc chắn muốn tải lên và nhập danh sách nhà cung cấp từ file "${file.name}" vào hệ thống không?`,
      confirmText: 'Xác nhận nhập',
      type: 'info',
    });
    if (!ok) {
      e.target.value = '';
      return;
    }

    try {
      const rows = await parseExcelFile(file);
      if (!rows || rows.length === 0) {
        alert('File Excel rỗng.');
        return;
      }

      const importedSuppliers: Supplier[] = rows.map((r: any, idx: number) => {
        const sCode = String(r['Mã đơn vị CC'] || r['Mã NCC'] || r['Đơn vị CC'] || `NCC-IMP-${Date.now()}-${idx}`).trim().toUpperCase();
        const rawName = String(r['Tên đơn vị cung cấp'] || r['Tên NCC'] || r['Tên ĐVCC'] || 'NHÀ CUNG CẤP MỚI').trim();
        // REQUIREMENT: Tên trong danh sách đơn vị cung cấp mặc định viết hoa
        const sName = rawName.toUpperCase();
        const rawShort = String(r['Tên gợi nhớ'] || sName).trim();
        const sShort = rawShort.toUpperCase();
        const sTax = String(r['Mã Số Thuế'] || r['MST'] || '').trim();
        const sPhone = String(r['Số điện thoại'] || r['SĐT'] || '').trim();
        const sAddr = String(r['Địa chỉ'] || '').trim();
        const sNotes = String(r['Ghi chú'] || '').trim();

        return {
          id: `sup-imp-${Date.now()}-${idx}`,
          code: sCode,
          name: sName,
          shortName: sShort,
          taxCode: sTax,
          phone: sPhone,
          address: sAddr,
          notes: sNotes,
          createdAt: new Date().toISOString().slice(0, 10),
        };
      });

      // Check duplicates
      const conflicts: ConflictItem[] = [];
      const newItems: Supplier[] = [];
      const existingMap = new Map<string, Supplier>();
      suppliers.forEach((s) => existingMap.set(s.code.toUpperCase(), s));

      importedSuppliers.forEach((item) => {
        const existing = existingMap.get(item.code.toUpperCase());
        if (existing) {
          conflicts.push({
            code: item.code,
            name: existing.name,
            oldInfo: `Tên: ${existing.name}\nMST: ${existing.taxCode || '—'} | SĐT: ${existing.phone || '—'}\nĐ/C: ${existing.address || '—'}`,
            newInfo: `Tên: ${item.name}\nMST: ${item.taxCode || '—'} | SĐT: ${item.phone || '—'}\nĐ/C: ${item.address || '—'}`,
          });
        } else {
          newItems.push(item);
        }
      });

      if (conflicts.length > 0) {
        setTotalSupplierImportedCount(importedSuppliers.length);
        setPendingSupplierConflicts(conflicts);
        setPendingNewSuppliers(newItems);
        // Overwrite list: existing suppliers not in excel + new excel versions
        const merged = suppliers.map((s) => {
          const match = importedSuppliers.find((imp) => imp.code.toUpperCase() === s.code.toUpperCase());
          return match ? { ...match, id: s.id } : s;
        });
        const brandNew = newItems.filter(
          (ni) => !merged.some((m) => m.code.toUpperCase() === ni.code.toUpperCase())
        );
        setPendingOverwrittenSuppliers([...merged, ...brandNew]);
        setSupplierConflictModalOpen(true);
      } else {
        if (onBatchUpdateSuppliers) {
          onBatchUpdateSuppliers([...suppliers, ...importedSuppliers]);
        } else {
          importedSuppliers.forEach(onSaveSupplier);
        }
        alert(`Đã nhập thành công ${importedSuppliers.length} nhà cung cấp từ Excel!`);
      }

      e.target.value = '';
    } catch (err: any) {
      alert(`Lỗi đọc file Excel: ${err.message}`);
    }
  };

  const handleSkipSupplierDuplicates = () => {
    if (onBatchUpdateSuppliers) {
      onBatchUpdateSuppliers([...suppliers, ...pendingNewSuppliers]);
    } else {
      pendingNewSuppliers.forEach(onSaveSupplier);
    }
    setSupplierConflictModalOpen(false);
    alert(`Đã bỏ qua các mã trùng. Đã thêm thành công ${pendingNewSuppliers.length} nhà cung cấp mới từ Excel!`);
  };

  const handleOverwriteSupplierDuplicates = () => {
    if (onBatchUpdateSuppliers) {
      onBatchUpdateSuppliers(pendingOverwrittenSuppliers);
    } else {
      pendingOverwrittenSuppliers.forEach(onSaveSupplier);
    }
    setSupplierConflictModalOpen(false);
    alert(`Đã cập nhật/thêm thành công danh mục nhà cung cấp từ Excel!`);
  };

  // Skip duplicate purchase bills (keep existing, import new)
  const handleSkipPurchaseDuplicates = () => {
    onBatchUpdatePurchases([...purchases, ...pendingNewBills]);
    setPurchaseConflictModalOpen(false);
    alert(`Đã bỏ qua các phiếu trùng. Đã thêm thành công ${pendingNewBills.length} phiếu nhập kho mới từ Excel!`);
  };

  // Overwrite duplicate purchase bills (update existing with Excel data, add new)
  const handleOverwritePurchaseDuplicates = () => {
    onBatchUpdatePurchases(pendingOverwrittenBills);
    setPurchaseConflictModalOpen(false);
    alert(`Đã cập nhật/thêm thành công ${pendingOverwrittenBills.length} phiếu nhập kho từ Excel!`);
  };

  // Handle Excel Import Purchases with Product & Supplier Validation and Synchronization
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await parseExcelFile(file);
      if (!rows || rows.length === 0) {
        alert('File Excel rỗng.');
        e.target.value = '';
        return;
      }

      // Group by Bill No
      const billGroups = new Map<string, any[]>();
      rows.forEach((r: any) => {
        const bNo = String(r['Mã phiếu (Bill No)'] || r['Mã phiếu'] || r['Số phiếu'] || `PNK-IMP-${Date.now()}`).trim();
        const list = billGroups.get(bNo) || [];
        list.push(r);
        billGroups.set(bNo, list);
      });

      // Prepare lookup maps
      const existingProductMap = new Map(products.map((p) => [p.code.trim().toUpperCase(), p]));
      const existingSupplierCodeMap = new Map(suppliers.map((s) => [s.code.trim().toUpperCase(), s]));
      const existingSupplierTaxMap = new Map(
        suppliers.filter((s) => s.taxCode).map((s) => [s.taxCode.trim().toUpperCase(), s])
      );
      const existingBillsMap = new Map<string, PurchaseBill>();
      purchases.forEach((p) => existingBillsMap.set(p.billNo.trim().toUpperCase(), p));

      const checkedBillsList: ParsedBillCheck[] = [];

      for (const [bNo, itemsList] of billGroups.entries()) {
        const first = itemsList[0];

        const rawSupCode =
          first['Mã đơn vị CC'] ??
          first['Mã NCC'] ??
          first['Đơn vị CC'] ??
          first['Mã Đơn vị CC'] ??
          first['Mã nhà cung cấp'] ??
          '';
        const supCode = String(rawSupCode).trim().toUpperCase();

        const rawSupName =
          first['Tên đơn vị cung cấp'] ??
          first['Tên Đơn vị CC'] ??
          first['Tên NCC'] ??
          first['Tên ĐVCC'] ??
          first['Tên nhà cung cấp'] ??
          '';
        const excelSupName = String(rawSupName).trim().toUpperCase();
        const rawSupTax = String(first['MST NCC'] || first['Mã Số Thuế'] || first['Mã số thuế'] || first['MST'] || '').trim();

        // Match supplier case-insensitively by Code or Tax
        const matchedSup = supCode
          ? existingSupplierCodeMap.get(supCode) || (rawSupTax ? existingSupplierTaxMap.get(rawSupTax.toUpperCase()) : undefined)
          : (rawSupTax ? existingSupplierTaxMap.get(rawSupTax.toUpperCase()) : undefined);

        const isNewSupplier = !matchedSup;
        const finalSupCode = matchedSup ? matchedSup.code : (supCode || 'NCC-MOI');
        const finalSupName = matchedSup ? matchedSup.name : (excelSupName || supCode || 'NHÀ CUNG CẤP MỚI');
        const finalSupTax = matchedSup?.taxCode || rawSupTax;

        let subtotal = 0;
        let totalVat = 0;

        const checkedItems: ParsedItemCheck[] = itemsList.map((row: any, idx: number) => {
          const pCode = String(row['Mã HH'] || row['Mã hàng hóa'] || 'PROD').trim().toUpperCase();
          const pName = String(row['Tên Hàng Hóa'] || row['Tên HH'] || row['Tên hàng hóa'] || pCode).trim();
          const pUnit = String(row['ĐVT_Mua'] || row['Đơn vị tính'] || row['ĐVT'] || 'Cái').trim();

          const rawQty =
            row['Số lượng'] !== undefined && row['Số lượng'] !== '' && row['Số lượng'] !== null
              ? Number(row['Số lượng'])
              : 0;
          const qty = isNaN(rawQty) ? 0 : rawQty;

          const rawAmt =
            row['Thành tiền'] !== undefined && row['Thành tiền'] !== '' && row['Thành tiền'] !== null
              ? Number(row['Thành tiền'])
              : 0;
          const amt = isNaN(rawAmt) ? 0 : rawAmt;

          const vat = Number(row['Thuế suất (%)'] ?? row['Thuế suất'] ?? row['VAT'] ?? 0) || 0;
          const rawUnitPrice = row['Đơn giá nhập'] ?? row['Đơn giá'] ?? (qty > 0 ? amt / qty : 0);
          const uPrice = qty > 0 ? Number((amt / qty).toFixed(purchaseDecimals)) : (Number(rawUnitPrice) || 0);
          const vatAmt = (amt * vat) / 100;

          subtotal += amt;
          totalVat += vatAmt;

          // Check if product code exists in software's catalog (báo đỏ nếu chưa có)
          const matchedProd = existingProductMap.get(pCode);
          const isUncataloged = !matchedProd;

          return {
            id: `pi-imp-${Date.now()}-${idx}-${Math.random()}`,
            productCode: pCode,
            productName: pName,
            purchaseUnit: pUnit,
            quantity: qty,
            unitPrice: uPrice,
            amount: amt,
            vatRate: vat,
            vatAmount: vatAmt,
            totalAmount: amt + vatAmt,
            isUncataloged,
            matchedProduct: matchedProd,
          };
        });

        const totalAmt = subtotal + totalVat;
        const rawPaid = first['Đã trả'] ?? first['Đã thanh toán'];
        const paid = rawPaid !== undefined && rawPaid !== '' ? Number(rawPaid) : totalAmt;

        const existingBill = existingBillsMap.get(bNo.toUpperCase());
        const isDuplicateBill = !!existingBill;
        const hasUncatalogedProducts = checkedItems.some((it) => it.isUncataloged);

        checkedBillsList.push({
          id: existingBill ? existingBill.id : `bill-imp-${Date.now()}-${Math.random()}`,
          billNo: bNo,
          purchaseDate: first['Ngày nhập (YYYY-MM-DD)'] || first['Ngày nhập'] || new Date().toISOString().slice(0, 10),
          supplierCode: finalSupCode,
          supplierTaxCode: finalSupTax,
          supplierName: finalSupName,
          isNewSupplier,
          matchedSupplier: matchedSup,
          items: checkedItems,
          subtotal,
          totalVat,
          totalAmount: totalAmt,
          paidAmount: paid,
          paymentStatus: paid >= totalAmt ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
          isDuplicateBill,
          existingBill,
          hasUncatalogedProducts,
        });
      }

      setParsedExcelBills(checkedBillsList);
      setIsSyncModalOpen(true);
      e.target.value = '';
    } catch (err: any) {
      alert(`Lỗi đọc file Excel: ${err.message}`);
    }
  };

  // Confirm Import & Sync Handler
  const handleConfirmSyncImport = (config: {
    billsToImport: PurchaseBill[];
    newProductsToCreate: Product[];
    newSuppliersToCreate: Supplier[];
    suppliersToUpdate: Supplier[];
    duplicateAction: 'overwrite' | 'skip';
  }) => {
    const {
      billsToImport,
      newProductsToCreate,
      newSuppliersToCreate,
      suppliersToUpdate,
      duplicateAction,
    } = config;

    // 1. Sync & Batch Add New Products to Catalog
    if (newProductsToCreate.length > 0) {
      if (onBatchUpdateProducts) {
        onBatchUpdateProducts([...products, ...newProductsToCreate]);
      } else {
        newProductsToCreate.forEach(onAddNewProduct);
      }
    }

    // 2. Sync & Batch Add New Suppliers to Catalog
    if (newSuppliersToCreate.length > 0 || suppliersToUpdate.length > 0) {
      const mergedSuppliers = [...suppliers];
      // Update existing ones
      suppliersToUpdate.forEach((up) => {
        const idx = mergedSuppliers.findIndex((s) => s.id === up.id);
        if (idx >= 0) mergedSuppliers[idx] = up;
      });
      // Add brand new
      newSuppliersToCreate.forEach((ns) => {
        if (!mergedSuppliers.some((s) => s.code.toUpperCase() === ns.code.toUpperCase())) {
          mergedSuppliers.push(ns);
        }
      });

      if (onBatchUpdateSuppliers) {
        onBatchUpdateSuppliers(mergedSuppliers);
      } else {
        newSuppliersToCreate.forEach(onSaveSupplier);
        suppliersToUpdate.forEach(onSaveSupplier);
      }
    }

    // 3. Save Bills (Handling duplicates overwrite or skip)
    let finalPurchases = [...purchases];

    if (duplicateAction === 'overwrite') {
      const billsMap = new Map(finalPurchases.map((p) => [p.billNo.trim().toUpperCase(), p]));
      billsToImport.forEach((b) => {
        const existing = billsMap.get(b.billNo.trim().toUpperCase());
        if (existing) {
          billsMap.set(b.billNo.trim().toUpperCase(), { ...b, id: existing.id });
        } else {
          billsMap.set(b.billNo.trim().toUpperCase(), b);
        }
      });
      finalPurchases = Array.from(billsMap.values());
    } else {
      const existingNos = new Set(finalPurchases.map((p) => p.billNo.trim().toUpperCase()));
      const brandNewBills = billsToImport.filter((b) => !existingNos.has(b.billNo.trim().toUpperCase()));
      finalPurchases = [...finalPurchases, ...brandNewBills];
    }

    onBatchUpdatePurchases(finalPurchases);
    setIsSyncModalOpen(false);

    let msg = `Đã nhập thành công ${billsToImport.length} phiếu nhập kho từ Excel!`;
    if (newProductsToCreate.length > 0) {
      msg += `\n• Đã tự động thêm ${newProductsToCreate.length} mã hàng hóa mới vào Danh mục sản phẩm.`;
    }
    if (newSuppliersToCreate.length > 0) {
      msg += `\n• Đã tự động thêm ${newSuppliersToCreate.length} nhà cung cấp mới vào Danh mục NCC.`;
    }
    alert(msg);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-teal-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Quản lý Kho hàng & Nhập kho
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý phiếu nhập chi tiết, giá nhập chuẩn xác đến 10 số thập phân, SL lũy kế và nhà cung cấp
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingBill(null);
            setIsPurchaseModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-teal-500/25 transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>LẬP PHIẾU NHẬP HÀNG</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('purchases')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'purchases'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Bảng Quản lý Nhập hàng ({purchases.length} phiếu / {flattenedPurchaseItems.length} dòng hàng)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('suppliers')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'suppliers'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Danh mục Đơn vị cung cấp ({suppliers.length})</span>
        </button>
      </div>

      {activeSubTab === 'purchases' ? (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Tìm kiếm phiếu (Bill No, Tên hàng, Mã HH, NCC)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-teal-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              {/* Date range filter - Requirement 5 */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-600">Từ:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-0.5 border border-slate-300 rounded text-xs bg-white font-medium"
                />
                <span className="font-semibold text-slate-600">Đến:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-0.5 border border-slate-300 rounded text-xs bg-white font-medium"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    title="Xóa lọc ngày"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Lọc phiếu chưa có mã hàng / đơn vị cung cấp */}
              <div className="flex items-center gap-1.5">
                <select
                  value={missingFilter}
                  onChange={(e) => setMissingFilter(e.target.value as any)}
                  className={`px-3 py-2 border rounded-xl text-xs sm:text-sm cursor-pointer font-medium transition-all ${
                    missingFilter !== 'all'
                      ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-2xs'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                  title="Lọc phiếu nhập hàng thiếu mã hàng hoặc nhà cung cấp"
                >
                  <option value="all">Tất cả phiếu nhập ({purchases.length})</option>
                  <option value="missing_product">
                    ⚠️ Chưa có / chưa khớp Mã hàng ({missingInfoStats.missingProductBills})
                  </option>
                  <option value="missing_supplier">
                    🏢 Chưa có / chưa khớp Đơn vị CC ({missingInfoStats.missingSupplierBills})
                  </option>
                  <option value="missing_any">
                    ⚡ Thiếu Mã hàng HOẶC Đơn vị CC ({missingInfoStats.missingAnyBills})
                  </option>
                  <option value="missing_both">
                    ❌ Thiếu CẢ Mã hàng VÀ Đơn vị CC ({missingInfoStats.missingBothBills})
                  </option>
                </select>

                {/* Quick Toggle Filter Badges */}
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMissingFilter((prev) => (prev === 'missing_product' ? 'all' : 'missing_product'))}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      missingFilter === 'missing_product'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : missingInfoStats.missingProductBills > 0
                        ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    title="Bấm để lọc các phiếu có mã hàng chưa có trong danh mục sản phẩm"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Thiếu mã HH ({missingInfoStats.missingProductBills})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMissingFilter((prev) => (prev === 'missing_supplier' ? 'all' : 'missing_supplier'))}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      missingFilter === 'missing_supplier'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : missingInfoStats.missingSupplierBills > 0
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    title="Bấm để lọc các phiếu chưa có hoặc nhà cung cấp chưa có trong danh mục"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Thiếu ĐVCC ({missingInfoStats.missingSupplierBills})</span>
                  </button>
                </div>

                {hasActivePurchasesFilter && (
                  <button
                    type="button"
                    onClick={handleResetPurchasesFilter}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer px-2.5 py-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Xóa toàn bộ bộ lọc để xem tất cả phiếu nhập"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Đặt lại</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Batch Delete Purchases - Requirement 6 */}
              {selectedBillIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBatchDeletePurchases}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
                  title="Xóa các phiếu nhập kho đã chọn"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa các phiếu đã chọn ({selectedBillIds.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => exportPurchasesToExcel(purchases)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Kết xuất Excel</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Nhập từ Excel</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelImport}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={downloadPurchaseTemplate}
                className="text-xs text-slate-500 hover:text-teal-600 underline cursor-pointer"
              >
                Tải mẫu Excel
              </button>
            </div>
          </div>

          {hasActivePurchasesFilter && (
            <div className="text-xs text-slate-600 bg-amber-50/70 border border-amber-200 px-3 py-2 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-amber-950">Đang lọc danh mục nhập:</span>
                {missingFilter === 'missing_product' && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold text-[11px] shadow-2xs">
                    Phiếu chưa có / chưa khớp Mã hàng ({missingInfoStats.missingProductBills})
                  </span>
                )}
                {missingFilter === 'missing_supplier' && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white font-bold text-[11px] shadow-2xs">
                    Phiếu chưa có / chưa khớp Đơn vị CC ({missingInfoStats.missingSupplierBills})
                  </span>
                )}
                {missingFilter === 'missing_any' && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-600 text-white font-bold text-[11px] shadow-2xs">
                    Phiếu thiếu Mã hàng HOẶC Đơn vị CC ({missingInfoStats.missingAnyBills})
                  </span>
                )}
                {missingFilter === 'missing_both' && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-700 text-white font-bold text-[11px] shadow-2xs">
                    Phiếu thiếu CẢ Mã hàng VÀ Đơn vị CC ({missingInfoStats.missingBothBills})
                  </span>
                )}
                {searchTerm && (
                  <span className="text-slate-600">
                    Từ khóa: &ldquo;<strong>{searchTerm}</strong>&rdquo;
                  </span>
                )}
                {(startDate || endDate) && (
                  <span className="text-slate-600">
                    Từ {startDate || '...'} đến {endDate || '...'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-semibold text-slate-700">
                <span>
                  Hiển thị: <strong>{uniqueFilteredBillIds.length}</strong> / <strong>{purchases.length}</strong> phiếu ({flattenedPurchaseItems.length} dòng hàng)
                </span>
                <button
                  type="button"
                  onClick={handleResetPurchasesFilter}
                  className="text-xs text-rose-600 hover:text-rose-800 underline font-bold cursor-pointer"
                >
                  Bỏ lọc
                </button>
              </div>
            </div>
          )}

          {/* Accounting Rule Notice */}
          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              <strong>Quy tắc hiển thị kế toán:</strong> Các cột thông tin cấp phiếu nhập (<strong>Mã phiếu (Bill No), Ngày nhập, MST, Đơn vị CC, Tên Đơn vị CC, Thành tiền tổng Bill, Tổng thuế GTGT, TT thanh toán</strong>) chỉ hiển thị tại dòng đầu tiên của phiếu để tránh trùng lặp số liệu.
            </span>
          </div>

          {/* Full Detailed Purchase Table meeting user specification */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[1500px]">
                <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider shadow-xs">
                  <tr>
                    <th className="p-2.5 w-10 text-center border-r border-slate-200">
                      <button
                        type="button"
                        onClick={handleToggleSelectAllBills}
                        className="cursor-pointer inline-flex items-center justify-center"
                        title="Chọn tất cả phiếu"
                      >
                        {selectedBillIds.length > 0 && selectedBillIds.length === uniqueFilteredBillIds.length ? (
                          <CheckSquare className="w-4 h-4 text-teal-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="p-2.5 w-10 text-left">STT</th>
                    <th className="p-2.5 text-left">Mã phiếu (Bill No)</th>
                    <th className="p-2.5 text-left">Ngày nhập</th>
                    <th className="p-2.5 text-left">MST</th>
                    <th className="p-2.5 text-left">Đơn vị CC</th>
                    <th className="p-2.5 min-w-36 text-left">Tên Đơn vị CC</th>
                    <th className="p-2.5 font-mono text-left">Mã HH</th>
                    <th className="p-2.5 min-w-40 text-left">Tên Hàng Hóa</th>
                    <th className="p-2.5 text-left">ĐVT_Mua</th>
                    <th className="p-2.5 text-left">Số lượng</th>
                    <th className="p-2.5 text-left min-w-32 bg-amber-50">Đơn giá nhập (10 số TP)</th>
                    <th className="p-2.5 text-left">Thành tiền</th>
                    <th className="p-2.5 text-left">Thuế %</th>
                    <th className="p-2.5 text-left">Tiền thuế GTGT</th>
                    <th className="p-2.5 text-left">Thành tiền tổng Bill</th>
                    <th className="p-2.5 text-left">Tổng thuế GTGT</th>
                    <th className="p-2.5 text-left font-bold text-teal-900">TT thanh toán</th>
                    <th className="p-2.5 text-left font-bold bg-blue-50 text-blue-900">SL nhập lũy kế</th>
                    <th className="p-2.5 text-left w-16">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flattenedPurchaseItems.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="p-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Package className="w-8 h-8 text-slate-300" />
                          <p className="font-semibold text-slate-600">
                            {hasActivePurchasesFilter
                              ? 'Không tìm thấy phiếu nhập nào phù hợp với điều kiện tìm kiếm hoặc bộ lọc mã hàng / đơn vị cung cấp.'
                              : 'Chưa có dữ liệu nhập hàng. Bấm "LẬP PHIẾU NHẬP HÀNG" để tạo mới.'}
                          </p>
                          {hasActivePurchasesFilter && (
                            <button
                              type="button"
                              onClick={handleResetPurchasesFilter}
                              className="text-xs text-teal-600 hover:text-teal-800 underline font-semibold mt-1 cursor-pointer"
                            >
                              Xóa bộ lọc để hiển thị toàn bộ {purchases.length} phiếu nhập kho
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    flattenedPurchaseItems.map((row, idx) => {
                      const isFirstRowOfBill = idx === 0 || row.billId !== flattenedPurchaseItems[idx - 1]?.billId;
                      const isNewBill = idx > 0 && row.billId !== flattenedPurchaseItems[idx - 1]?.billId;
                      const billBorderClass = isNewBill ? 'border-t-2 border-slate-300' : '';

                      // Product check
                      const isItemEmptyProduct = !row.productCode || row.productCode.trim() === '';
                      const isUncatalogedProduct = isItemEmptyProduct || !existingProductCodesMap.has(row.productCode.trim().toUpperCase());
                      const billHasMissingProduct = isBillMissingProduct(row.rawBill);

                      // Supplier check
                      const billHasMissingSupplier = isBillMissingSupplier(row.rawBill);
                      const isSupplierUncataloged = billHasMissingSupplier;

                      return (
                        <tr
                          key={`${row.billId}-${row.itemId}-${idx}`}
                          className={`hover:bg-teal-50/30 transition-colors ${billBorderClass} ${
                            isUncatalogedProduct
                              ? 'bg-rose-50/40 hover:bg-rose-50/70'
                              : isSupplierUncataloged
                              ? 'bg-amber-50/30 hover:bg-amber-50/60'
                              : isFirstRowOfBill
                              ? 'bg-white'
                              : 'bg-slate-50/20'
                          }`}
                        >
                          {/* Checkbox chọn phiếu */}
                          <td className="p-2.5 text-center border-r border-slate-100">
                            {isFirstRowOfBill && (
                              <button
                                type="button"
                                onClick={() => handleToggleSelectBill(row.billId)}
                                className="cursor-pointer text-slate-500 hover:text-teal-600 inline-flex items-center justify-center"
                                title="Chọn phiếu này để xóa hàng loạt"
                              >
                                {selectedBillIds.includes(row.billId) ? (
                                  <CheckSquare className="w-4 h-4 text-teal-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                            )}
                          </td>

                          {/* STT */}
                          <td className="p-2.5 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>

                          {/* 1. Mã phiếu (Bill No) - chỉ hiện tại dòng đầu tiên của phiếu */}
                          <td className="p-2.5 font-mono font-bold text-teal-800 whitespace-nowrap">
                            {isFirstRowOfBill ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBill(row.rawBill);
                                    setIsPurchaseModalOpen(true);
                                  }}
                                  className="hover:underline hover:text-teal-950 text-left cursor-pointer"
                                  title="Bấm để xem/sửa phiếu nhập"
                                >
                                  {row.billNo}
                                </button>
                                {billHasMissingProduct && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-black bg-rose-600 text-white shadow-xs animate-pulse"
                                    title="Phiếu này có mặt hàng chưa có trong Danh mục sản phẩm hoặc bị trống mã hàng!"
                                  >
                                    <AlertTriangle className="w-3 h-3 text-rose-200" />
                                    Chưa có mã hàng
                                  </span>
                                )}
                                {billHasMissingSupplier && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-black bg-amber-600 text-white shadow-xs"
                                    title="Phiếu này chưa có thông tin nhà cung cấp hoặc nhà cung cấp chưa có trong Danh mục ĐVCC!"
                                  >
                                    <Building2 className="w-3 h-3 text-amber-200" />
                                    Chưa có ĐVCC
                                  </span>
                                )}
                                {row.totalItemsInBill > 1 && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 font-normal">
                                    {row.totalItemsInBill} món
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 select-none">—</span>
                            )}
                          </td>

                          {/* 2. Ngày nhập - chỉ hiện tại dòng đầu tiên của phiếu */}
                          <td className="p-2.5 text-slate-600 whitespace-nowrap">
                            {isFirstRowOfBill ? formatDate(row.purchaseDate) : <span className="text-slate-300 select-none">—</span>}
                          </td>

                          {/* 3. MST - chỉ hiện tại dòng đầu tiên của phiếu */}
                          <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">
                            {isFirstRowOfBill ? (row.supplierTaxCode || '—') : <span className="text-slate-300 select-none">—</span>}
                          </td>

                          {/* 4. Đơn vị CC - chỉ hiện tại dòng đầu tiên của phiếu */}
                          <td className="p-2.5 font-mono font-semibold text-slate-700 whitespace-nowrap">
                            {isFirstRowOfBill ? (
                              isSupplierUncataloged ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded text-xs w-fit">
                                    <Building2 className="w-3 h-3 text-amber-600 shrink-0" />
                                    {row.supplierCode || '(Trống mã ĐVCC)'}
                                  </span>
                                  <span className="text-[10px] text-amber-700 font-bold">
                                    Chưa có trong DM NCC
                                  </span>
                                </div>
                              ) : (
                                row.supplierCode || '—'
                              )
                            ) : (
                              <span className="text-slate-300 select-none">—</span>
                            )}
                          </td>

                          {/* 5. Tên Đơn vị CC - chỉ hiện tại dòng đầu tiên của phiếu */}
                          <td className="p-2.5 font-medium text-slate-900 min-w-36">
                            {isFirstRowOfBill ? (
                              isSupplierUncataloged ? (
                                <span className="font-bold text-amber-950">
                                  {row.supplierName || '(Chưa có tên ĐVCC)'}
                                </span>
                              ) : (
                                row.supplierName
                              )
                            ) : (
                              <span className="text-slate-300 italic select-none">〃</span>
                            )}
                          </td>

                          {/* 6. Mã HH */}
                          <td className="p-2.5 font-mono font-semibold whitespace-nowrap">
                            {isUncatalogedProduct ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 font-mono font-black text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded text-xs w-fit">
                                  <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                  {row.productCode || '(Trống mã HH)'}
                                </span>
                                <span className="text-[10px] text-rose-600 font-bold">
                                  {isItemEmptyProduct ? 'Trống mã hàng' : 'Chưa có trong DM'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-700">{row.productCode}</span>
                            )}
                          </td>

                          {/* 7. Tên Hàng Hóa */}
                          <td className="p-2.5 font-semibold text-slate-900 min-w-40">
                            {row.productName}
                          </td>

                          {/* 8. ĐVT_Mua */}
                          <td className="p-2.5 text-center text-slate-600">
                            {row.purchaseUnit}
                          </td>

                          {/* 9. Số lượng */}
                          <td className="p-2.5 text-right font-bold text-slate-900">
                            {formatNumber(row.quantity)}
                          </td>

                          {/* 10. Đơn giá nhập (10 số TP) */}
                          <td className="p-2.5 text-right bg-amber-50 font-mono font-bold text-amber-900 whitespace-nowrap">
                            {formatPrecise(row.unitPrice, purchaseDecimals)}
                          </td>

                          {/* 11. Thành tiền */}
                          <td className="p-2.5 text-right font-medium text-slate-800 whitespace-nowrap">
                            {formatCurrency(row.amount)}
                          </td>

                          {/* 12. Thuế % */}
                          <td className="p-2.5 text-center text-slate-600">
                            {row.vatRate}%
                          </td>

                          {/* 13. Tiền thuế GTGT */}
                          <td className="p-2.5 text-right text-slate-600 whitespace-nowrap">
                            {formatCurrency(row.vatAmount)}
                          </td>

                          {/* 14. Thành tiền tổng Bill - chỉ hiện tại dòng đầu tiên của phiếu */}
                          <td className="p-2.5 text-right text-slate-700 whitespace-nowrap font-mono">
                            {isFirstRowOfBill ? formatCurrency(row.billSubtotal) : <span className="text-slate-200 select-none">—</span>}
                          </td>

                          {/* 15. Tổng thuế GTGT - chỉ hiện tại dòng đầu tiên của phiếu */}
                          <td className="p-2.5 text-right text-slate-700 whitespace-nowrap font-mono">
                            {isFirstRowOfBill ? formatCurrency(row.billTotalVat) : <span className="text-slate-200 select-none">—</span>}
                          </td>

                          {/* 16. TT thanh toán - chỉ hiện tại dòng đầu tiên của phiếu */}
                          <td className="p-2.5 text-right font-bold whitespace-nowrap font-mono">
                            {isFirstRowOfBill ? (
                              <span className="text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60 inline-block font-black">
                                {formatCurrency(row.billTotalAmount)}
                              </span>
                            ) : (
                              <span className="text-slate-200 select-none">—</span>
                            )}
                          </td>

                          {/* 17. SL nhập lũy kế */}
                          <td className="p-2.5 text-right bg-blue-50 font-black text-blue-800 whitespace-nowrap">
                            {formatNumber(row.cumulativeQuantity)}
                          </td>

                          {/* 18. Thao tác */}
                          <td className="p-2.5 text-center">
                            {isFirstRowOfBill ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBill(row.rawBill);
                                    setIsPurchaseModalOpen(true);
                                  }}
                                  className="p-1 text-slate-500 hover:text-teal-600 rounded cursor-pointer"
                                  title="Chỉnh sửa phiếu nhập này"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: 'Xác nhận xóa phiếu nhập',
                                      message: `Bạn có chắc muốn xóa phiếu nhập ${row.billNo} từ NCC "${row.supplierName}"?`,
                                      confirmText: 'Xóa phiếu',
                                      type: 'danger',
                                    });
                                    if (ok) {
                                      onDeletePurchase(row.billId);
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                  title="Xóa phiếu"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-200 select-none">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Suppliers Sub Tab */
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Tìm NCC (Mã, Tên, MST, SĐT)..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-teal-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>

              {/* Duplicate Tax Filter Toggle */}
              <button
                type="button"
                onClick={() => setSupplierFilterDuplicateTax(!supplierFilterDuplicateTax)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  supplierFilterDuplicateTax
                    ? 'bg-rose-100 text-rose-800 border-rose-300 ring-2 ring-rose-400 shadow-xs'
                    : duplicateSupplierTaxCodes.size > 0
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title="Lọc danh sách các nhà cung cấp có mã số thuế bị trùng nhau"
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${supplierFilterDuplicateTax || duplicateSupplierTaxCodes.size > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Lọc trùng MST</span>
                {duplicateSupplierTaxCodes.size > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    supplierFilterDuplicateTax ? 'bg-rose-600 text-white' : 'bg-rose-200 text-rose-800'
                  }`}>
                    {duplicateSupplierCount} NCC
                  </span>
                )}
              </button>

              {/* Sort selector */}
              <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
                <span className="text-slate-500 font-medium whitespace-nowrap">Sắp xếp:</span>
                <select
                  value={supplierSortField}
                  onChange={(e) => setSupplierSortField(e.target.value as any)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="default">Mặc định</option>
                  <option value="code">Mã đơn vị CC</option>
                  <option value="taxCode">Mã số thuế</option>
                </select>
                {supplierSortField !== 'default' && (
                  <button
                    type="button"
                    onClick={() => setSupplierSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                    className="p-1 hover:bg-slate-200 rounded text-teal-700 font-bold cursor-pointer transition-colors"
                    title={supplierSortDirection === 'asc' ? 'Đang tăng dần (A-Z). Bấm chuyển giảm dần (Z-A)' : 'Đang giảm dần (Z-A). Bấm chuyển tăng dần (A-Z)'}
                  >
                    {supplierSortDirection === 'asc' ? (
                      <span className="inline-flex items-center gap-0.5 text-[11px]">↑ A-Z</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[11px]">↓ Z-A</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Download Excel Template */}
              <button
                type="button"
                onClick={downloadSupplierTemplate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                title="Tải file mẫu Excel nhập danh mục nhà cung cấp"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Mẫu Excel</span>
              </button>

              {/* Export to Excel */}
              <button
                type="button"
                onClick={() => exportSuppliersToExcel(suppliers)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs transition-colors cursor-pointer"
                title="Xuất danh sách nhà cung cấp ra Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Xuất Excel</span>
              </button>

              {/* Import from Excel */}
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-semibold text-xs transition-colors cursor-pointer">
                <Upload className="w-4 h-4 text-teal-600" />
                <span>Nhập Excel</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleSupplierExcelImport}
                  className="hidden"
                />
              </label>

              {/* Add New Supplier */}
              <button
                type="button"
                onClick={() => {
                  setEditingSupplier(null);
                  setIsSupplierModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm mới</span>
              </button>
            </div>
          </div>

          {/* DUPLICATE TAX CODE ALERT BANNER */}
          {duplicateSupplierTaxCodes.size > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Cảnh báo trùng mã số thuế:</strong> Phát hiện <strong>{duplicateSupplierTaxCodes.size}</strong> mã số thuế bị trùng giữa <strong>{duplicateSupplierCount}</strong> nhà cung cấp (các dòng được bôi đỏ nổi bật bên dưới).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSupplierFilterDuplicateTax(!supplierFilterDuplicateTax)}
                className="shrink-0 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                {supplierFilterDuplicateTax ? 'Xem toàn bộ đơn vị CC' : 'Lọc chỉ xem NCC trùng MST'}
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] sm:text-xs">
                  <tr>
                    <th className="p-3 w-10 text-left">STT</th>
                    <th
                      onClick={() => handleSupplierSort('code')}
                      className="p-3 text-left cursor-pointer select-none hover:bg-slate-200 transition-colors group"
                      title="Bấm để sắp xếp theo Mã đơn vị cung cấp"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Mã đơn vị CC</span>
                        {supplierSortField === 'code' ? (
                          supplierSortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-teal-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-teal-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 text-left">Tên đơn vị cung cấp</th>
                    <th className="p-3 text-left">Tên gợi nhớ</th>
                    <th
                      onClick={() => handleSupplierSort('taxCode')}
                      className="p-3 text-left cursor-pointer select-none hover:bg-slate-200 transition-colors group"
                      title="Bấm để sắp xếp theo Mã số thuế"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Mã Số Thuế</span>
                        {supplierSortField === 'taxCode' ? (
                          supplierSortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-teal-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-teal-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 text-left">Số điện thoại</th>
                    <th className="p-3 text-left">Địa chỉ</th>
                    <th className="p-3 text-left">Ghi chú</th>
                    <th className="p-3 text-left">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Building2 className="w-8 h-8 text-slate-300" />
                          <p className="font-semibold text-slate-600">
                            {supplierFilterDuplicateTax
                              ? 'Không tìm thấy nhà cung cấp nào trùng mã số thuế.'
                              : 'Không tìm thấy nhà cung cấp nào phù hợp.'}
                          </p>
                          {supplierFilterDuplicateTax && (
                            <button
                              type="button"
                              onClick={() => setSupplierFilterDuplicateTax(false)}
                              className="text-xs text-teal-600 hover:text-teal-800 underline font-semibold mt-1 cursor-pointer"
                            >
                              Bỏ lọc trùng MST và hiển thị tất cả nhà cung cấp
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((sup, idx) => {
                      const isDupTax = sup.taxCode && duplicateSupplierTaxCodes.has(sup.taxCode.trim());
                      return (
                        <tr
                          key={sup.id}
                          className={`transition-colors ${
                            isDupTax
                              ? 'bg-rose-50/70 hover:bg-rose-100/70 border-l-4 border-l-rose-500'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-teal-800">{sup.code}</td>
                          <td className="p-3 font-semibold text-slate-900">{sup.name}</td>
                          <td className="p-3 text-slate-600">{sup.shortName}</td>
                          <td className="p-3">
                            {isDupTax ? (
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>{sup.taxCode}</span>
                                <span className="text-[10px] text-rose-800 font-semibold">(Trùng MST)</span>
                              </span>
                            ) : (
                              <span className="font-mono text-slate-700">{sup.taxCode || '—'}</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-700">{sup.phone || '—'}</td>
                          <td className="p-3 text-slate-600">{sup.address || '—'}</td>
                          <td className="p-3 text-slate-500 text-xs">{sup.notes || '—'}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSupplier(sup);
                                  setIsSupplierModalOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg cursor-pointer"
                                title="Sửa NCC"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Xác nhận xóa nhà cung cấp',
                                    message: `Bạn có chắc muốn xóa nhà cung cấp "${sup.name}" (Mã: ${sup.code})?`,
                                    confirmText: 'Xóa NCC',
                                    type: 'danger',
                                  });
                                  if (ok) {
                                    onDeleteSupplier(sup.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Xóa NCC"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Excel Duplicate Conflict Modal */}
      {supplierConflictModalOpen && (
        <ExcelDuplicateConflictModal
          isOpen={supplierConflictModalOpen}
          entityTitle="Nhà cung cấp"
          totalImportedCount={totalSupplierImportedCount}
          newItemsCount={pendingNewSuppliers.length}
          conflicts={pendingSupplierConflicts}
          onSkipDuplicates={handleSkipSupplierDuplicates}
          onOverwriteDuplicates={handleOverwriteSupplierDuplicates}
          onCancel={() => setSupplierConflictModalOpen(false)}
        />
      )}


      {/* Purchase Excel Duplicate Conflict Modal */}
      {purchaseConflictModalOpen && (
        <ExcelDuplicateConflictModal
          isOpen={purchaseConflictModalOpen}
          entityTitle="Phiếu nhập kho"
          totalImportedCount={totalBillsImportedCount}
          newItemsCount={pendingNewBills.length}
          conflicts={pendingPurchaseConflicts}
          onSkipDuplicates={handleSkipPurchaseDuplicates}
          onOverwriteDuplicates={handleOverwritePurchaseDuplicates}
          onCancel={() => setPurchaseConflictModalOpen(false)}
        />
      )}

      {/* Purchase Excel Synchronization & Catalog Validation Modal */}
      {isSyncModalOpen && (
        <PurchaseExcelSyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          parsedBills={parsedExcelBills}
          existingProducts={products}
          existingSuppliers={suppliers}
          existingPurchases={purchases}
          currentUser={currentUser}
          onConfirmImport={handleConfirmSyncImport}
        />
      )}

      {/* Purchase Modal */}
      {isPurchaseModalOpen && (
        <PurchaseFormModal
          isOpen={isPurchaseModalOpen}
          onClose={() => setIsPurchaseModalOpen(false)}
          onSave={onSavePurchase}
          initialBill={editingBill}
          suppliers={suppliers}
          products={products}
          currentUser={currentUser}
          settings={settings}
          allPurchases={purchases}
          onAddNewProduct={onAddNewProduct}
          onSaveSupplier={onSaveSupplier}
        />
      )}

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <SupplierModal
          isOpen={isSupplierModalOpen}
          onClose={() => setIsSupplierModalOpen(false)}
          onSave={onSaveSupplier}
          initialSupplier={editingSupplier}
          existingCount={suppliers.length}
          existingSuppliers={suppliers}
        />
      )}
    </div>
  );
};
