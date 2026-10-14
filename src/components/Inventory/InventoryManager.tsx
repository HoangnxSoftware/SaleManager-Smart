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
}) => {
  const confirm = useConfirm();
  const [activeSubTab, setActiveSubTab] = useState<'purchases' | 'suppliers'>('purchases');

  // Search & Date range filter
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
      if (!bill.items || bill.items.length === 0) continue;

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

    return filtered;
  }, [purchases, searchTerm, startDate, endDate]);

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

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.shortName.toLowerCase().includes(q) ||
        s.taxCode.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearch]);

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

  // Excel Import Purchases
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // REQUIREMENT: Khi up dữ liệu từ excel ở tất cả dữ liệu, xuất hiện thông báo xác nhận xem có thực hiện hay không
    const ok = await confirm({
      title: 'Xác nhận nhập phiếu nhập kho từ Excel',
      message: `Bạn có chắc chắn muốn tải lên và nhập dữ liệu phiếu nhập kho từ file "${file.name}" vào hệ thống không?`,
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

      // Group by Bill No
      const billGroups = new Map<string, any[]>();
      rows.forEach((r: any) => {
        const bNo = String(r['Mã phiếu (Bill No)'] || r['Mã phiếu'] || r['Số phiếu'] || `PNK-IMP-${Date.now()}`).trim();
        const list = billGroups.get(bNo) || [];
        list.push(r);
        billGroups.set(bNo, list);
      });

      const parsedBillsList: PurchaseBill[] = [];

      for (const [bNo, itemsList] of billGroups.entries()) {
        const first = itemsList[0];

        // REQUIREMENT: Lỗi nếu mã đơn vị cung cấp dài hơn 6 ký tự khi up dữ liệu từ excel vào thông tin mã đơn vị CC và tên đơn vị cung cấp bị sai
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

        // Match case-insensitively, strictly avoid falling back to suppliers[0]!
        const matchedSup = supCode ? suppliers.find((s) => s.code.trim().toUpperCase() === supCode) : null;
        const finalSupCode = matchedSup ? matchedSup.code : (supCode || 'NCC-CHUNGDUNG');
        const finalSupName = matchedSup ? matchedSup.name : (excelSupName || supCode || 'NHÀ CUNG CẤP');
        const finalSupTax =
          matchedSup?.taxCode ||
          String(first['MST NCC'] || first['Mã Số Thuế'] || first['Mã số thuế'] || first['MST'] || '').trim();

        let subtotal = 0;
        let totalVat = 0;

        const purchaseItems = itemsList.map((row: any, idx: number) => {
          const pCode = String(row['Mã HH'] || row['Mã hàng hóa'] || 'PROD').trim().toUpperCase();
          const pName = String(row['Tên Hàng Hóa'] || row['Tên HH'] || row['Tên hàng hóa'] || pCode).trim();
          const pUnit = String(row['ĐVT_Mua'] || row['Đơn vị tính'] || row['ĐVT'] || 'Cái').trim();

          // REQUIREMENT: Cho phép nhập phiếu có số lượng và thành tiền = 0.
          // Không được chuyển số lượng 0 thành 1, không được chuyển thành tiền 0 thành 100.000!
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
          };
        });

        const totalAmt = subtotal + totalVat;
        const rawPaid = first['Đã trả'] ?? first['Đã thanh toán'];
        const paid = rawPaid !== undefined && rawPaid !== '' ? Number(rawPaid) : totalAmt;

        parsedBillsList.push({
          id: `bill-imp-${Date.now()}-${Math.random()}`,
          billNo: bNo,
          purchaseDate: first['Ngày nhập (YYYY-MM-DD)'] || first['Ngày nhập'] || new Date().toISOString().slice(0, 10),
          supplierCode: finalSupCode,
          supplierTaxCode: finalSupTax,
          supplierName: finalSupName,
          items: purchaseItems,
          subtotal,
          totalVat,
          totalAmount: totalAmt,
          paidAmount: paid,
          paymentStatus: paid >= totalAmt ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
          createdById: currentUser.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // REQUIREMENT: Khi up phiếu nhập kho cần có kiểm tra trước khi up dữ liệu, phát hiện số phiếu trùng, cho phép cập nhật phiếu trùng hoặc hủy bỏ
      const conflicts: ConflictItem[] = [];
      const newBillsList: PurchaseBill[] = [];
      const existingBillsMap = new Map<string, PurchaseBill>();
      purchases.forEach((p) => existingBillsMap.set(p.billNo.trim().toUpperCase(), p));

      parsedBillsList.forEach((bill) => {
        const existing = existingBillsMap.get(bill.billNo.trim().toUpperCase());
        if (existing) {
          conflicts.push({
            code: bill.billNo,
            name: `Phiếu nhập ngày ${existing.purchaseDate} - NCC: ${existing.supplierName}`,
            oldInfo: `Ngày: ${existing.purchaseDate} | NCC: ${existing.supplierName} (${existing.supplierCode})\nTổng tiền: ${formatCurrency(existing.totalAmount)} | ${existing.items.length} mặt hàng`,
            newInfo: `Ngày: ${bill.purchaseDate} | NCC: ${bill.supplierName} (${bill.supplierCode})\nTổng tiền: ${formatCurrency(bill.totalAmount)} | ${bill.items.length} mặt hàng`,
          });
        } else {
          newBillsList.push(bill);
        }
      });

      if (conflicts.length > 0) {
        setTotalBillsImportedCount(parsedBillsList.length);
        setPendingPurchaseConflicts(conflicts);
        setPendingNewBills(newBillsList);
        // Overwrite list: existing purchases merged/replaced by Excel versions + completely new bills
        const merged = purchases.map((p) => {
          const match = parsedBillsList.find((imp) => imp.billNo.trim().toUpperCase() === p.billNo.trim().toUpperCase());
          return match ? { ...match, id: p.id } : p;
        });
        const brandNew = newBillsList.filter(
          (nb) => !merged.some((m) => m.billNo.trim().toUpperCase() === nb.billNo.trim().toUpperCase())
        );
        setPendingOverwrittenBills([...merged, ...brandNew]);
        setPurchaseConflictModalOpen(true);
      } else {
        onBatchUpdatePurchases([...purchases, ...parsedBillsList]);
        alert(`Đã nhập thành công ${parsedBillsList.length} phiếu nhập kho từ Excel!`);
      }

      e.target.value = '';
    } catch (err: any) {
      alert(`Lỗi nhập Excel: ${err.message}`);
    }
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
                        Chưa có dữ liệu nhập hàng. Bấm "LẬP PHIẾU NHẬP HÀNG" để tạo mới.
                      </td>
                    </tr>
                  ) : (
                    flattenedPurchaseItems.map((row, idx) => {
                      const isFirstRowOfBill = idx === 0 || row.billId !== flattenedPurchaseItems[idx - 1]?.billId;
                      const isNewBill = idx > 0 && row.billId !== flattenedPurchaseItems[idx - 1]?.billId;
                      const billBorderClass = isNewBill ? 'border-t-2 border-slate-300' : '';

                      return (
                        <tr
                          key={`${row.billId}-${row.itemId}-${idx}`}
                          className={`hover:bg-teal-50/30 transition-colors ${billBorderClass} ${
                            isFirstRowOfBill ? 'bg-white' : 'bg-slate-50/20'
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
                              <div className="flex items-center gap-1.5">
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
                            {isFirstRowOfBill ? (row.supplierCode || '—') : <span className="text-slate-300 select-none">—</span>}
                          </td>

                          {/* 5. Tên Đơn vị CC - chỉ hiện tại dòng đầu tiên của phiếu */}
                          <td className="p-2.5 font-medium text-slate-900 min-w-36">
                            {isFirstRowOfBill ? row.supplierName : <span className="text-slate-300 italic select-none">〃</span>}
                          </td>

                          {/* 6. Mã HH */}
                          <td className="p-2.5 font-mono font-semibold text-slate-700 whitespace-nowrap">
                            {row.productCode}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Tìm NCC (Mã, Tên, MST, SĐT)..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-teal-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
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
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center gap-2 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Cảnh báo trùng mã số thuế:</strong> Phát hiện <strong>{duplicateSupplierTaxCodes.size}</strong> mã số thuế bị trùng giữa nhiều nhà cung cấp (các dòng được bôi đỏ nổi bật bên dưới).
              </span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] sm:text-xs">
                  <tr>
                    <th className="p-3 w-10 text-left">STT</th>
                    <th className="p-3 text-left">Mã đơn vị CC</th>
                    <th className="p-3 text-left">Tên đơn vị cung cấp</th>
                    <th className="p-3 text-left">Tên gợi nhớ</th>
                    <th className="p-3 text-left">Mã Số Thuế</th>
                    <th className="p-3 text-left">Số điện thoại</th>
                    <th className="p-3 text-left">Địa chỉ</th>
                    <th className="p-3 text-left">Ghi chú</th>
                    <th className="p-3 text-left">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.map((sup, idx) => {
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
                  })}
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
