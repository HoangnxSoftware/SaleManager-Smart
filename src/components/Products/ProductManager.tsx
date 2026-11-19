import React, { useState, useMemo } from 'react';
import { Product, PurchaseBill, Order, AppUser } from '../../types';
import { formatNumber, formatCurrency } from '../../utils/formatters';
import {
  exportProductsToExcel,
  downloadProductTemplate,
  parseExcelFile,
} from '../../services/excelService';
import { calculateCurrentInventory } from '../../services/fifo';
import { ProductModal } from './ProductModal';
import { CatalogExcelImportModal, CatalogImportCheckItem, CatalogImportFieldDiff } from '../Common/CatalogExcelImportModal';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Package,
  Plus,
  Search,
  Download,
  Upload,
  Edit,
  Trash2,
  Percent,
  Layers,
  CheckCircle2,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Filter,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GripVertical,
  Eye,
  ShieldAlert
} from 'lucide-react';

interface ProductManagerProps {
  products: Product[];
  purchases: PurchaseBill[];
  orders: Order[];
  currentUser?: AppUser | null;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onBatchUpdateProducts: (products: Product[]) => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({
  products,
  purchases,
  orders,
  currentUser,
  onSaveProduct,
  onDeleteProduct,
  onBatchUpdateProducts,
}) => {
  const confirm = useConfirm();
  // REQUIREMENT: phần Danh mục sản phẩm tài khoản nhân viên bán hàng chỉ được phép xem, không được phép chỉnh sửa
  const isReadOnly = currentUser?.role === 'salesperson';

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Filters for Tồn kho hiện tại & Trị giá tồn kho hiện tại
  const [stockFilterMode, setStockFilterMode] = useState<'all' | 'in_stock' | 'out_of_stock' | 'negative' | 'custom'>('all');
  const [stockMin, setStockMin] = useState<string>('');
  const [stockMax, setStockMax] = useState<string>('');

  const [valueFilterMode, setValueFilterMode] = useState<'all' | 'has_value' | 'zero_value' | 'negative_value' | 'custom'>('all');
  const [valueMin, setValueMin] = useState<string>('');
  const [valueMax, setValueMax] = useState<string>('');

  // Sorting & Reordering State (Requirement: cho phép sắp xếp theo mã hàng, tên hàng, nhóm/loại hàng hóa, cho phép di chuyển thứ tự mã hàng)
  const [sortField, setSortField] = useState<'default' | 'code' | 'reconciliationCode' | 'name' | 'category'>('default');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Drag & drop state for moving product order
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);

  // Selected products for batch delete (Requirement 6)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Stock calculations
  const inventoryStockMap = useMemo(() => {
    return calculateCurrentInventory(products, purchases, orders);
  }, [products, purchases, orders]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered and sorted products based on search, category, stock, inventory value, and sort field
  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        p.code.toLowerCase().includes(q) ||
        (p.reconciliationCode && p.reconciliationCode.toLowerCase().includes(q)) ||
        p.name.toLowerCase().includes(q);

      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      if (!matchSearch || !matchCat) return false;

      const stockInfo = inventoryStockMap.get(p.code);
      const stock = stockInfo?.inStock ?? 0;
      const invValue = stockInfo?.inventoryValue ?? 0;

      // Filter by Tồn kho hiện tại
      if (stockFilterMode === 'in_stock' && stock <= 0) return false;
      if (stockFilterMode === 'out_of_stock' && stock !== 0) return false;
      if (stockFilterMode === 'negative' && stock >= 0) return false;
      if (stockFilterMode === 'custom') {
        const min = stockMin.trim() !== '' ? Number(stockMin) : -Infinity;
        const max = stockMax.trim() !== '' ? Number(stockMax) : Infinity;
        if (stock < min || stock > max) return false;
      }

      // Filter by Trị giá tồn kho hiện tại
      if (valueFilterMode === 'has_value' && invValue <= 0) return false;
      if (valueFilterMode === 'zero_value' && invValue !== 0) return false;
      if (valueFilterMode === 'negative_value' && invValue >= 0) return false;
      if (valueFilterMode === 'custom') {
        const min = valueMin.trim() !== '' ? Number(valueMin) : -Infinity;
        const max = valueMax.trim() !== '' ? Number(valueMax) : Infinity;
        if (invValue < min || invValue > max) return false;
      }

      return true;
    });

    // Apply sorting if requested
    if (sortField !== 'default') {
      list = [...list].sort((a, b) => {
        let valA = '';
        let valB = '';
        if (sortField === 'code') {
          valA = a.code || '';
          valB = b.code || '';
        } else if (sortField === 'reconciliationCode') {
          valA = a.reconciliationCode || '';
          valB = b.reconciliationCode || '';
        } else if (sortField === 'name') {
          valA = a.name || '';
          valB = b.name || '';
        } else if (sortField === 'category') {
          valA = a.category || '';
          valB = b.category || '';
        }

        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
        if (!valA && !valB) return 0;

        const cmp = valA.localeCompare(valB, 'vi', { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [
    products,
    searchTerm,
    categoryFilter,
    inventoryStockMap,
    stockFilterMode,
    stockMin,
    stockMax,
    valueFilterMode,
    valueMin,
    valueMax,
    sortField,
    sortDirection,
  ]);

  // Click handler on column headers
  const handleHeaderSort = (field: 'code' | 'reconciliationCode' | 'name' | 'category') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Reordering handlers (Di chuyển thứ tự mã hàng)
  const handleMoveProduct = (product: Product, direction: 'up' | 'down') => {
    // If a sorted view is active, switch to default custom order so movements are visible
    if (sortField !== 'default') {
      setSortField('default');
    }

    const currentProducts = [...products];
    const currentIndex = currentProducts.findIndex((p) => p.id === product.id);
    if (currentIndex === -1) return;

    // Find position in filtered list
    const currentFilteredIndex = filteredProducts.findIndex((p) => p.id === product.id);
    if (currentFilteredIndex === -1) return;

    const targetFilteredIndex = direction === 'up' ? currentFilteredIndex - 1 : currentFilteredIndex + 1;
    if (targetFilteredIndex < 0 || targetFilteredIndex >= filteredProducts.length) return;

    const neighborProduct = filteredProducts[targetFilteredIndex];
    const neighborIndex = currentProducts.findIndex((p) => p.id === neighborProduct.id);
    if (neighborIndex === -1) return;

    // Swap in main list
    const temp = currentProducts[currentIndex];
    currentProducts[currentIndex] = currentProducts[neighborIndex];
    currentProducts[neighborIndex] = temp;

    onBatchUpdateProducts(currentProducts);
  };

  // Drag and drop handlers for moving products
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedProductId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragOverProductId !== id) {
      setDragOverProductId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverProductId(null);
    const sourceId = draggedProductId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;

    if (sortField !== 'default') {
      setSortField('default');
    }

    const currentList = [...products];
    const sourceIndex = currentList.findIndex((p) => p.id === sourceId);
    const targetIndex = currentList.findIndex((p) => p.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    // Remove source item and insert at target position
    const [movedItem] = currentList.splice(sourceIndex, 1);
    currentList.splice(targetIndex, 0, movedItem);

    onBatchUpdateProducts(currentList);
    setDraggedProductId(null);
  };

  const hasActiveProductFilters =
    searchTerm.trim() !== '' ||
    categoryFilter !== 'all' ||
    stockFilterMode !== 'all' ||
    valueFilterMode !== 'all' ||
    sortField !== 'default';

  const handleResetProductFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStockFilterMode('all');
    setStockMin('');
    setStockMax('');
    setValueFilterMode('all');
    setValueMin('');
    setValueMax('');
    setSortField('default');
    setSortDirection('asc');
  };

  // Overall inventory summary for filtered products
  const inventoryTotals = useMemo(() => {
    let totalStock = 0;
    let totalValue = 0;
    filteredProducts.forEach((p) => {
      const info = inventoryStockMap.get(p.code);
      if (info) {
        totalStock += info.inStock;
        totalValue += info.inventoryValue;
      }
    });
    return { totalStock, totalValue };
  }, [filteredProducts, inventoryStockMap]);

  // Batch Selection & Deletion for Products (Requirement 6)
  const handleToggleSelectAllProducts = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p.id));
    }
  };

  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleBatchDeleteProducts = async () => {
    if (selectedProductIds.length === 0) {
      alert('Vui lòng chọn ít nhất một sản phẩm để xóa.');
      return;
    }
    const ok = await confirm({
      title: 'Xác nhận xóa hàng hóa hàng loạt',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedProductIds.length} sản phẩm đã chọn không? Thao tác này không thể hoàn tác!`,
      confirmText: 'Xóa hàng hóa',
      type: 'danger',
    });
    if (ok) {
      const remaining = products.filter((p) => !selectedProductIds.includes(p.id));
      onBatchUpdateProducts(remaining);
      setSelectedProductIds([]);
    }
  };

  // Excel Import Check State
  const [productImportModalOpen, setProductImportModalOpen] = useState(false);
  const [productImportCheckItems, setProductImportCheckItems] = useState<CatalogImportCheckItem<Product>[]>([]);
  const [productImportFileName, setProductImportFileName] = useState<string>('');

  // Excel Import Products with check & field comparison modal
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

      const importedByCode = new Map<string, Product>();
      rows.forEach((r: any, idx: number) => {
        const pCode = String(r['Mã HH'] || `HH${Date.now()}-${idx}`).trim().toUpperCase();
        const rawVat = r['Thuế suất (%)'] ?? r['Thuế suất'] ?? 10;
        const vatRate = rawVat === '' || rawVat === null || rawVat === undefined ? 10 : Number(rawVat);
        const rawConv = r['SL quy đổi'] ?? 1;
        const conversionRate = rawConv === '' || rawConv === null || rawConv === undefined ? 1 : Number(rawConv);
        const rawMargin = r['Tỷ suất lợi nhuận (%)'] ?? r['Tỷ suất lợi nhuận'] ?? 0;
        const cleanMargin =
          typeof rawMargin === 'string'
            ? parseFloat(rawMargin.replace('%', '').trim())
            : Number(rawMargin);
        const rawDefPrice = r['Giá bán mặc định'] ?? r['Giá bán mặc định (Sau thuế)'];
        const defaultSalePrice =
          rawDefPrice !== '' && rawDefPrice !== null && rawDefPrice !== undefined && !isNaN(Number(rawDefPrice))
            ? Number(rawDefPrice)
            : undefined;
        const rawVariance = r['Biên độ giá'] ?? r['Biên độ giá (+/-)'];
        const priceVariance =
          rawVariance !== '' && rawVariance !== null && rawVariance !== undefined && !isNaN(Number(rawVariance))
            ? Number(rawVariance)
            : undefined;

        importedByCode.set(pCode, {
          id: `prod-imp-${Date.now()}-${idx}`,
          code: pCode,
          reconciliationCode: String(r['Mã đối chiếu'] || r['Mã Đối Chiếu'] || r['Mã ĐC'] || '').trim(),
          name: String(r['Tên HH'] || r['Tên hàng hóa'] || 'Sản phẩm mới').trim(),
          purchaseUnit: String(r['ĐVT_Mua'] || 'Cái').trim(),
          vatRate: isNaN(vatRate) ? 10 : vatRate,
          conversionRate: isNaN(conversionRate) ? 1 : conversionRate,
          saleUnit: String(r['ĐVT_Bán'] || 'Cái').trim(),
          category: String(r['Nhóm/loại HH'] || r['Nhóm HH'] || '').trim(),
          profitMargin: isNaN(cleanMargin) ? 0 : cleanMargin,
          defaultSalePrice,
          priceVariance,
          notes: String(r['Ghi chú'] || '').trim(),
        });
      });

      const existingMap = new Map<string, Product>();
      products.forEach((p) => existingMap.set(p.code.toUpperCase(), p));

      const checkItems: CatalogImportCheckItem<Product>[] = Array.from(importedByCode.values()).map((item) => {
        const existing = existingMap.get(item.code.toUpperCase());
        const previewFields = [
          ...(item.reconciliationCode ? [{ label: 'Mã đối chiếu', value: item.reconciliationCode }] : []),
          { label: 'ĐVT Mua/Bán', value: `${item.purchaseUnit} → ${item.saleUnit} (x${item.conversionRate})` },
          { label: 'Nhóm', value: item.category || '—' },
          { label: 'VAT / LN', value: `${item.vatRate}% / ${item.profitMargin}%` },
          ...(item.defaultSalePrice !== undefined
            ? [{ label: 'Giá mặc định', value: `${formatNumber(item.defaultSalePrice)} đ` }]
            : []),
        ];

        if (!existing) {
          return {
            code: item.code,
            name: item.name,
            status: 'new',
            diffs: [],
            previewFields,
            incomingItem: item,
          };
        }

        const fieldPairs: Array<{ label: string; oldVal: string; newVal: string; isChanged?: boolean }> = [
          { label: 'Tên hàng hóa', oldVal: (existing.name || '').trim(), newVal: (item.name || '').trim() },
          {
            label: 'Mã đối chiếu',
            oldVal: (existing.reconciliationCode || '').trim(),
            newVal: (item.reconciliationCode || '').trim(),
          },
          {
            label: 'ĐVT Mua',
            oldVal: (existing.purchaseUnit || '').trim(),
            newVal: (item.purchaseUnit || '').trim(),
          },
          {
            label: 'SL quy đổi',
            oldVal: String(existing.conversionRate),
            newVal: String(item.conversionRate),
            isChanged: Number(existing.conversionRate) !== Number(item.conversionRate),
          },
          {
            label: 'ĐVT Bán',
            oldVal: (existing.saleUnit || '').trim(),
            newVal: (item.saleUnit || '').trim(),
          },
          {
            label: 'Nhóm hàng',
            oldVal: (existing.category || '').trim(),
            newVal: (item.category || '').trim(),
          },
          {
            label: 'Thuế suất (%)',
            oldVal: `${existing.vatRate}%`,
            newVal: `${item.vatRate}%`,
            isChanged: Number(existing.vatRate) !== Number(item.vatRate),
          },
          {
            label: 'Tỷ suất LN (%)',
            oldVal: `${existing.profitMargin}%`,
            newVal: `${item.profitMargin}%`,
            isChanged: Number(existing.profitMargin) !== Number(item.profitMargin),
          },
          {
            label: 'Giá bán mặc định',
            oldVal: existing.defaultSalePrice !== undefined ? `${formatNumber(existing.defaultSalePrice)} đ` : '',
            newVal: item.defaultSalePrice !== undefined ? `${formatNumber(item.defaultSalePrice)} đ` : '',
            isChanged: (existing.defaultSalePrice ?? null) !== (item.defaultSalePrice ?? null),
          },
          {
            label: 'Biên độ giá',
            oldVal: existing.priceVariance !== undefined ? `±${formatNumber(existing.priceVariance)} đ` : '',
            newVal: item.priceVariance !== undefined ? `±${formatNumber(item.priceVariance)} đ` : '',
            isChanged: (existing.priceVariance ?? null) !== (item.priceVariance ?? null),
          },
          {
            label: 'Ghi chú',
            oldVal: (existing.notes || '').trim(),
            newVal: (item.notes || '').trim(),
          },
        ];

        const diffs: CatalogImportFieldDiff[] = fieldPairs
          .filter((fp) => (fp.isChanged !== undefined ? fp.isChanged : fp.oldVal !== fp.newVal))
          .map((fp) => ({ label: fp.label, oldValue: fp.oldVal, newValue: fp.newVal }));

        return {
          code: item.code,
          name: item.name,
          status: diffs.length > 0 ? 'changed' : 'unchanged',
          diffs,
          previewFields,
          incomingItem: {
            ...item,
            id: existing.id,
          },
          existingId: existing.id,
        };
      });

      setProductImportFileName(file.name);
      setProductImportCheckItems(checkItems);
      setProductImportModalOpen(true);
      e.target.value = '';
    } catch (err: any) {
      alert(`Lỗi đọc file Excel: ${err.message}`);
      e.target.value = '';
    }
  };

  const handleConfirmProductImport = (selectedNew: Product[], selectedUpdates: Product[]) => {
    const payload = [...selectedUpdates, ...selectedNew];
    if (payload.length === 0) {
      setProductImportModalOpen(false);
      return;
    }
    onBatchUpdateProducts(payload);
    setProductImportModalOpen(false);
    alert(
      `Đã hoàn tất nhập danh mục sản phẩm từ Excel: thêm mới ${selectedNew.length} mã, cập nhật ${selectedUpdates.length} mã!`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Danh mục Sản phẩm & Hàng hóa
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Mã HH, ĐVT mua/bán, SL quy đổi, tỷ suất lợi nhuận, số lượng và trị giá tồn kho hiện tại
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs shadow-2xs">
            <span className="text-slate-600 font-medium">Tổng trị giá tồn kho:</span>
            <span className="font-black text-emerald-800 text-sm">{formatCurrency(inventoryTotals.totalValue)}</span>
          </div>

          {isReadOnly ? (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs sm:text-sm shadow-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Chế độ chỉ xem giá & tồn kho (Nhân viên bán hàng)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>THÊM HÀNG HÓA MỚI</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar with Search, Category, Stock & Inventory Value Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search */}
            <div className="relative w-full sm:w-60">
              <input
                type="text"
                placeholder="Tìm Mã HH, Mã đối chiếu, Tên hàng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            {/* Category */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white cursor-pointer"
            >
              <option value="all">Tất cả nhóm hàng</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Filter by Tồn kho hiện tại */}
            <div className="flex items-center gap-1.5">
              <select
                value={stockFilterMode}
                onChange={(e) => setStockFilterMode(e.target.value as any)}
                className={`px-3 py-2 border rounded-xl text-xs sm:text-sm cursor-pointer ${
                  stockFilterMode !== 'all'
                    ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-900 shadow-2xs'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
                title="Lọc sản phẩm theo số lượng tồn kho hiện tại"
              >
                <option value="all">Tồn kho: Tất cả</option>
                <option value="in_stock">Tồn kho: Còn hàng (&gt; 0)</option>
                <option value="out_of_stock">Tồn kho: Hết hàng (= 0)</option>
                <option value="negative">Tồn kho: Âm kho (&lt; 0)</option>
                <option value="custom">Tồn kho: Tùy chỉnh khoảng SL...</option>
              </select>

              {stockFilterMode === 'custom' && (
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                  <input
                    type="number"
                    placeholder="Từ"
                    value={stockMin}
                    onChange={(e) => setStockMin(e.target.value)}
                    className="w-16 px-1 text-xs bg-transparent focus:outline-hidden"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="number"
                    placeholder="đến"
                    value={stockMax}
                    onChange={(e) => setStockMax(e.target.value)}
                    className="w-16 px-1 text-xs bg-transparent focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            {/* Filter by Trị giá tồn kho hiện tại */}
            <div className="flex items-center gap-1.5">
              <select
                value={valueFilterMode}
                onChange={(e) => setValueFilterMode(e.target.value as any)}
                className={`px-3 py-2 border rounded-xl text-xs sm:text-sm cursor-pointer ${
                  valueFilterMode !== 'all'
                    ? 'border-emerald-600 bg-emerald-100/70 font-bold text-emerald-950 shadow-2xs'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
                title="Lọc sản phẩm theo giá trị tồn kho hiện tại"
              >
                <option value="all">Trị giá tồn: Tất cả</option>
                <option value="has_value">Trị giá: Có giá trị (&gt; 0)</option>
                <option value="zero_value">Trị giá: Bằng 0 (0 ₫)</option>
                <option value="negative_value">Trị giá: Âm (&lt; 0)</option>
                <option value="custom">Trị giá: Tùy chỉnh khoảng tiền...</option>
              </select>

              {valueFilterMode === 'custom' && (
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                  <input
                    type="number"
                    placeholder="Tiền từ"
                    value={valueMin}
                    onChange={(e) => setValueMin(e.target.value)}
                    className="w-20 px-1 text-xs bg-transparent focus:outline-hidden"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="number"
                    placeholder="đến"
                    value={valueMax}
                    onChange={(e) => setValueMax(e.target.value)}
                    className="w-20 px-1 text-xs bg-transparent focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            {/* Sắp xếp danh mục hàng hóa */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
              <span className="text-slate-500 font-medium whitespace-nowrap">Sắp xếp:</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                title="Chọn tiêu chí sắp xếp hàng hóa"
              >
                <option value="default">Thứ tự tùy chỉnh (di chuyển)</option>
                <option value="code">Mã hàng hóa</option>
                <option value="reconciliationCode">Mã đối chiếu</option>
                <option value="name">Tên hàng hóa</option>
                <option value="category">Nhóm / Loại hàng hóa</option>
              </select>
              {sortField !== 'default' && (
                <button
                  type="button"
                  onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="px-1.5 py-0.5 hover:bg-slate-200 rounded text-indigo-700 font-bold cursor-pointer transition-colors"
                  title={sortDirection === 'asc' ? 'Đang tăng dần (A-Z). Bấm chuyển giảm dần (Z-A)' : 'Đang giảm dần (Z-A). Bấm chuyển tăng dần (A-Z)'}
                >
                  {sortDirection === 'asc' ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px]">↑ A-Z</span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[11px]">↓ Z-A</span>
                  )}
                </button>
              )}
            </div>

            {/* Reset Filters button */}
            {hasActiveProductFilters && (
              <button
                type="button"
                onClick={handleResetProductFilters}
                className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer px-2.5 py-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                title="Bỏ tất cả bộ lọc và hiển thị toàn bộ hàng hóa"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Batch Delete Products - Only for admin/manager */}
            {!isReadOnly && selectedProductIds.length > 0 && (
              <button
                type="button"
                onClick={handleBatchDeleteProducts}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
                title="Xóa các sản phẩm đã chọn cùng một lúc"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa đã chọn ({selectedProductIds.length})</span>
              </button>
            )}

            {/* Download template - Only for admin/manager */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={downloadProductTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                title="Tải file mẫu Excel nhập sản phẩm"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Mẫu Excel</span>
              </button>
            )}

            {/* Export Excel is available for all roles including salesperson */}
            <button
              type="button"
              onClick={() => exportProductsToExcel(filteredProducts, inventoryStockMap)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel</span>
            </button>

            {/* Import Excel - Only for admin/manager */}
            {!isReadOnly && (
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Nhập Excel</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelImport}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {hasActiveProductFilters && (
          <div className="text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1.5 border-t border-slate-100">
            <span>
              Đang hiển thị <strong>{filteredProducts.length}</strong> / <strong>{products.length}</strong> sản phẩm thỏa mãn điều kiện lọc
            </span>
            <span className="font-semibold text-emerald-800">
              Tổng SL: {formatNumber(inventoryTotals.totalStock)} • Tổng giá trị tồn: {formatCurrency(inventoryTotals.totalValue)}
            </span>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[68vh] table-scrollbar">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 uppercase font-bold text-[11px] sm:text-xs shadow-xs border-b border-slate-200">
              <tr>
                <th className="p-3 w-10 text-center">
                  {!isReadOnly ? (
                    <button
                      type="button"
                      onClick={handleToggleSelectAllProducts}
                      className="cursor-pointer inline-flex items-center justify-center text-slate-500 hover:text-indigo-600"
                      title="Chọn tất cả sản phẩm"
                    >
                      {selectedProductIds.length > 0 && selectedProductIds.length === filteredProducts.length ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </th>
                <th className="p-3 w-10 text-left">STT</th>
                <th className="p-3 w-20 text-center whitespace-nowrap">Thứ tự</th>
                <th
                  onClick={() => handleHeaderSort('code')}
                  className="p-3 text-left cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                  title="Bấm để sắp xếp theo Mã hàng hóa"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Mã HH</span>
                    {sortField === 'code' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('reconciliationCode')}
                  className="p-3 text-left cursor-pointer hover:bg-slate-200/80 transition-colors select-none whitespace-nowrap"
                  title="Bấm để sắp xếp theo Mã đối chiếu"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Mã đối chiếu</span>
                    {sortField === 'reconciliationCode' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('name')}
                  className="p-3 min-w-48 text-left cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                  title="Bấm để sắp xếp theo Tên hàng hóa"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Tên HH</span>
                    {sortField === 'name' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('category')}
                  className="p-3 text-left cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                  title="Bấm để sắp xếp theo Nhóm / Loại hàng hóa"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Nhóm / Loại HH</span>
                    {sortField === 'category' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="p-3 text-left">ĐVT_Mua</th>
                <th className="p-3 text-left">SL quy đổi</th>
                <th className="p-3 text-left">ĐVT_Bán</th>
                <th className="p-3 text-left">Thuế suất</th>
                <th className="p-3 text-left bg-indigo-100 text-indigo-900">Tỷ suất lợi nhuận (%)</th>
                <th className="p-3 text-left bg-blue-100 text-blue-900">Giá bán mặc định</th>
                <th className="p-3 text-left bg-blue-100 text-blue-900">Biên độ (+/-)</th>
                <th className="p-3 text-right bg-emerald-100 text-emerald-900 whitespace-nowrap">Tồn kho hiện tại</th>
                <th className="p-3 text-right bg-emerald-200 text-emerald-950 whitespace-nowrap">Trị giá tồn kho hiện tại</th>
                <th className="p-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={17} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-600">
                        {hasActiveProductFilters
                          ? 'Không tìm thấy hàng hóa nào phù hợp với điều kiện tìm kiếm hoặc bộ lọc số lượng / trị giá tồn kho.'
                          : 'Không tìm thấy hàng hóa nào phù hợp.'}
                      </p>
                      {hasActiveProductFilters && (
                        <button
                          type="button"
                          onClick={handleResetProductFilters}
                          className="text-xs text-indigo-600 hover:text-indigo-800 underline font-semibold mt-1 cursor-pointer"
                        >
                          Xóa bộ lọc để hiển thị toàn bộ {products.length} hàng hóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => {
                  const stockInfo = inventoryStockMap.get(p.code);
                  const stock = stockInfo?.inStock ?? 0;
                  const inventoryValue = stockInfo?.inventoryValue ?? 0;
                  return (
                    <tr
                      key={p.id}
                      draggable={!isReadOnly}
                      onDragStart={(e) => !isReadOnly && handleDragStart(e, p.id)}
                      onDragOver={(e) => !isReadOnly && handleDragOver(e, p.id)}
                      onDrop={(e) => !isReadOnly && handleDrop(e, p.id)}
                      onDragEnd={() => {
                        setDraggedProductId(null);
                        setDragOverProductId(null);
                      }}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        dragOverProductId === p.id ? 'border-t-2 border-indigo-600 bg-indigo-50/60' : ''
                      } ${draggedProductId === p.id ? 'opacity-40' : ''}`}
                    >
                      <td className="p-3 text-center">
                        {!isReadOnly ? (
                          <button
                            type="button"
                            onClick={() => handleToggleSelectProduct(p.id)}
                            className="cursor-pointer inline-flex items-center justify-center text-slate-500 hover:text-indigo-600"
                            title="Chọn sản phẩm này để xóa"
                          >
                            {selectedProductIds.includes(p.id) ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                      <td className="p-2 text-center whitespace-nowrap">
                        {!isReadOnly ? (
                          <div className="inline-flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveProduct(p, 'up')}
                              disabled={idx === 0}
                              className={`p-1 rounded cursor-pointer transition-colors ${
                                idx === 0
                                  ? 'text-slate-200 cursor-not-allowed'
                                  : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                              title="Di chuyển lên trên"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveProduct(p, 'down')}
                              disabled={idx === filteredProducts.length - 1}
                              className={`p-1 rounded cursor-pointer transition-colors ${
                                idx === filteredProducts.length - 1
                                  ? 'text-slate-200 cursor-not-allowed'
                                  : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                              title="Di chuyển xuống dưới"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <span
                              className="p-1 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing"
                              title="Kéo thả dòng này để thay đổi thứ tự sản phẩm"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs font-mono">{idx + 1}</span>
                        )}
                      </td>
                      <td className={`p-3 font-mono font-bold ${stock < 0 ? 'text-red-600' : 'text-indigo-700'}`}>{p.code}</td>
                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap">{p.reconciliationCode || '—'}</td>
                      <td className={`p-3 font-semibold ${stock < 0 ? 'text-red-600' : 'text-slate-900'}`}>{p.name}</td>
                      <td className="p-3 text-slate-600">{p.category}</td>
                      <td className="p-3 text-center text-slate-700">{p.purchaseUnit}</td>
                      <td className="p-3 text-center font-bold text-slate-800">
                        {p.conversionRate ?? 1}
                      </td>
                      <td className="p-3 text-center font-medium text-slate-700">{p.saleUnit}</td>
                      <td className="p-3 text-center text-slate-700">{p.vatRate}%</td>
                      <td className={`p-3 text-right font-black ${
                        (p.profitMargin ?? 0) < 0
                          ? 'bg-rose-50 text-rose-700 font-bold'
                          : 'bg-indigo-50/40 text-indigo-800'
                      }`}>
                        {p.profitMargin}%
                      </td>
                      <td className="p-3 text-right bg-blue-50/30 font-bold text-slate-900">
                        {p.defaultSalePrice ? formatNumber(p.defaultSalePrice) + ' ₫' : '—'}
                      </td>
                      <td className="p-3 text-right bg-blue-50/30 font-semibold text-indigo-700">
                        {p.priceVariance ? '±' + formatNumber(p.priceVariance) + ' ₫' : '—'}
                      </td>
                      <td className={`p-3 text-right font-black whitespace-nowrap ${
                        stock < 0
                          ? 'text-red-600 bg-red-50/80 border border-red-200 rounded'
                          : 'text-emerald-700 bg-emerald-50/40'
                      }`}>
                        {formatNumber(stock)} {p.saleUnit}
                      </td>
                      <td className={`p-3 text-right font-bold tabular-nums whitespace-nowrap ${
                        stock < 0
                          ? 'text-red-600 bg-red-50/40'
                          : inventoryValue > 0
                          ? 'text-emerald-900 bg-emerald-50/60'
                          : 'text-slate-400 bg-slate-50/30'
                      }`}>
                        {formatCurrency(inventoryValue)}
                      </td>
                      <td className="p-3 text-center">
                        {isReadOnly ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(p);
                              setIsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer text-xs font-semibold border border-slate-200"
                            title="Xem chi tiết hàng hóa"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Xem</span>
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(p);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                              title="Sửa hàng hóa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Xác nhận xóa hàng hóa',
                                  message: `Bạn có chắc chắn muốn xóa sản phẩm "${p.name}" (Mã: ${p.code})?`,
                                  confirmText: 'Xóa hàng hóa',
                                  type: 'danger',
                                });
                                if (ok) {
                                  onDeleteProduct(p.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Xóa hàng hóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredProducts.length > 0 && (
              <tfoot className="sticky bottom-0 z-20 bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300 shadow-[0_-2px_6px_-1px_rgba(0,0,0,0.06)]">
                <tr>
                  <td colSpan={14} className="p-3 text-right uppercase tracking-wider text-xs font-black text-slate-700">
                    Tổng cộng ({filteredProducts.length} sản phẩm):
                  </td>
                  <td className="p-3 text-right font-black text-emerald-800 whitespace-nowrap bg-emerald-100">
                    {formatNumber(inventoryTotals.totalStock)} (Tổng SL)
                  </td>
                  <td className="p-3 text-right font-black text-emerald-900 whitespace-nowrap bg-emerald-200 text-sm">
                    {formatCurrency(inventoryTotals.totalValue)}
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {isModalOpen && (
        <ProductModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={onSaveProduct}
          initialProduct={editingProduct}
          existingCount={products.length}
          existingProducts={products}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Product Excel Import Check Modal */}
      {productImportModalOpen && (
        <CatalogExcelImportModal
          isOpen={productImportModalOpen}
          entityTitle="Sản phẩm / Hàng hóa"
          fileName={productImportFileName}
          items={productImportCheckItems}
          onConfirm={handleConfirmProductImport}
          onCancel={() => setProductImportModalOpen(false)}
        />
      )}
    </div>
  );
};
