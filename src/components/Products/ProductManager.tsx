import React, { useState, useMemo } from 'react';
import { Product, PurchaseBill, Order } from '../../types';
import { formatNumber } from '../../utils/formatters';
import {
  exportProductsToExcel,
  downloadProductTemplate,
  parseExcelFile,
} from '../../services/excelService';
import { calculateCurrentInventory } from '../../services/fifo';
import { ProductModal } from './ProductModal';
import { ExcelDuplicateConflictModal, ConflictItem } from '../Common/ExcelDuplicateConflictModal';
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
  Square
} from 'lucide-react';

interface ProductManagerProps {
  products: Product[];
  purchases: PurchaseBill[];
  orders: Order[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onBatchUpdateProducts: (products: Product[]) => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({
  products,
  purchases,
  orders,
  onSaveProduct,
  onDeleteProduct,
  onBatchUpdateProducts,
}) => {
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

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

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !searchTerm.trim() ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;

      return matchSearch && matchCat;
    });
  }, [products, searchTerm, categoryFilter]);

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

  // Excel Import State & Conflicts
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<ConflictItem[]>([]);
  const [pendingNewProducts, setPendingNewProducts] = useState<Product[]>([]);
  const [pendingOverwrittenProducts, setPendingOverwrittenProducts] = useState<Product[]>([]);
  const [totalImportedCount, setTotalImportedCount] = useState(0);

  // Excel Import Products with duplicate code check
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = await confirm({
      title: 'Xác nhận nhập dữ liệu hàng hóa từ Excel',
      message: `Bạn có chắc chắn muốn tải lên và nhập danh mục hàng hóa từ file "${file.name}" vào hệ thống không?`,
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

      const imported: Product[] = rows.map((r: any, idx: number) => ({
        id: `prod-imp-${Date.now()}-${idx}`,
        code: String(r['Mã HH'] || `HH${Date.now()}`).trim().toUpperCase(),
        name: String(r['Tên HH'] || r['Tên hàng hóa'] || 'Sản phẩm mới').trim(),
        purchaseUnit: String(r['ĐVT_Mua'] || 'Cái').trim(),
        vatRate: Number(r['Thuế suất (%)'] || r['Thuế suất'] || 10),
        conversionRate: Number(r['SL quy đổi'] || 1),
        saleUnit: String(r['ĐVT_Bán'] || 'Cái').trim(),
        category: String(r['Nhóm/loại HH'] || r['Nhóm HH'] || '').trim(),
        profitMargin: Number(r['Tỷ suất lợi nhuận (%)'] || r['Tỷ suất lợi nhuận'] || 0),
        defaultSalePrice: r['Giá bán mặc định'] || r['Giá bán mặc định (Sau thuế)'] ? Number(r['Giá bán mặc định'] || r['Giá bán mặc định (Sau thuế)']) : undefined,
        priceVariance: r['Biên độ giá'] || r['Biên độ giá (+/-)'] ? Number(r['Biên độ giá'] || r['Biên độ giá (+/-)']) : undefined,
        notes: String(r['Ghi chú'] || ''),
      }));

      // Check duplicates
      const conflicts: ConflictItem[] = [];
      const newItems: Product[] = [];
      const existingMap = new Map<string, Product>();
      products.forEach((p) => existingMap.set(p.code.toUpperCase(), p));

      imported.forEach((item) => {
        const existing = existingMap.get(item.code.toUpperCase());
        if (existing) {
          conflicts.push({
            code: item.code,
            name: existing.name,
            oldInfo: `Tên: ${existing.name}\nNhóm: ${existing.category} | ĐVT: ${existing.saleUnit}\nLợi nhuận: ${existing.profitMargin}% | VAT: ${existing.vatRate}%\nGiá mặc định: ${existing.defaultSalePrice ? formatNumber(existing.defaultSalePrice) + ' đ' : '—'} | Biên độ: ${existing.priceVariance ? '±' + formatNumber(existing.priceVariance) + ' đ' : '—'}`,
            newInfo: `Tên: ${item.name}\nNhóm: ${item.category} | ĐVT: ${item.saleUnit}\nLợi nhuận: ${item.profitMargin}% | VAT: ${item.vatRate}%\nGiá mặc định: ${item.defaultSalePrice ? formatNumber(item.defaultSalePrice) + ' đ' : '—'} | Biên độ: ${item.priceVariance ? '±' + formatNumber(item.priceVariance) + ' đ' : '—'}`,
          });
        } else {
          newItems.push(item);
        }
      });

      if (conflicts.length > 0) {
        setTotalImportedCount(imported.length);
        setPendingConflicts(conflicts);
        setPendingNewProducts(newItems);
        // Overwrite list: existing products not in excel + new excel versions
        const merged = products.map((p) => {
          const match = imported.find((imp) => imp.code.toUpperCase() === p.code.toUpperCase());
          return match ? { ...match, id: p.id } : p;
        });
        const brandNew = newItems.filter(
          (ni) => !merged.some((m) => m.code.toUpperCase() === ni.code.toUpperCase())
        );
        setPendingOverwrittenProducts([...merged, ...brandNew]);
        setConflictModalOpen(true);
      } else {
        onBatchUpdateProducts([...products, ...imported]);
        alert(`Đã nhập thành công ${imported.length} sản phẩm từ Excel!`);
      }

      e.target.value = '';
    } catch (err: any) {
      alert(`Lỗi đọc file Excel: ${err.message}`);
    }
  };

  const handleSkipDuplicates = () => {
    onBatchUpdateProducts([...products, ...pendingNewProducts]);
    setConflictModalOpen(false);
    alert(`Đã bỏ qua các mã trùng. Đã thêm thành công ${pendingNewProducts.length} sản phẩm mới từ Excel!`);
  };

  const handleOverwriteDuplicates = () => {
    onBatchUpdateProducts(pendingOverwrittenProducts);
    setConflictModalOpen(false);
    alert(`Đã cập nhật/thêm thành công danh mục sản phẩm từ Excel!`);
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
            Mã HH, ĐVT mua/bán, SL quy đổi, tỷ suất lợi nhuận và số lượng tồn kho tức thì
          </p>
        </div>

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
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Tìm theo Mã HH hoặc Tên hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>

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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Batch Delete Products - Requirement 6 */}
          {selectedProductIds.length > 0 && (
            <button
              type="button"
              onClick={handleBatchDeleteProducts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
              title="Xóa các sản phẩm đã chọn cùng một lúc"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa các sản phẩm đã chọn ({selectedProductIds.length})</span>
            </button>
          )}

          {/* Download template */}
          <button
            type="button"
            onClick={downloadProductTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            title="Tải file mẫu Excel nhập sản phẩm"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Mẫu Excel</span>
          </button>

          <button
            type="button"
            onClick={() => exportProductsToExcel(filteredProducts)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>

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
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] sm:text-xs">
              <tr>
                <th className="p-3 w-10 text-center">
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
                </th>
                <th className="p-3 w-10 text-left">STT</th>
                <th className="p-3 text-left">Mã HH</th>
                <th className="p-3 min-w-48 text-left">Tên HH</th>
                <th className="p-3 text-left">Nhóm / Loại HH</th>
                <th className="p-3 text-left">ĐVT_Mua</th>
                <th className="p-3 text-left">SL quy đổi</th>
                <th className="p-3 text-left">ĐVT_Bán</th>
                <th className="p-3 text-left">Thuế suất</th>
                <th className="p-3 text-left bg-indigo-50/70 text-indigo-900">Tỷ suất lợi nhuận (%)</th>
                <th className="p-3 text-left bg-blue-50/70 text-blue-900">Giá bán mặc định</th>
                <th className="p-3 text-left bg-blue-50/70 text-blue-900">Biên độ (+/-)</th>
                <th className="p-3 text-left bg-emerald-50/70 text-emerald-900">Tồn kho hiện tại</th>
                <th className="p-3 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center text-slate-400">
                    Không tìm thấy hàng hóa nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => {
                  const stock = inventoryStockMap.get(p.code)?.inStock ?? 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="p-3 text-center">
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
                      </td>
                      <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                      <td className={`p-3 font-mono font-bold ${stock < 0 ? 'text-red-600' : 'text-indigo-700'}`}>{p.code}</td>
                      <td className={`p-3 font-semibold ${stock < 0 ? 'text-red-600' : 'text-slate-900'}`}>{p.name}</td>
                      <td className="p-3 text-slate-600">{p.category}</td>
                      <td className="p-3 text-center text-slate-700">{p.purchaseUnit}</td>
                      <td className="p-3 text-center font-bold text-slate-800">
                        {p.conversionRate ?? 1}
                      </td>
                      <td className="p-3 text-center font-medium text-slate-700">{p.saleUnit}</td>
                      <td className="p-3 text-center text-slate-700">{p.vatRate}%</td>
                      <td className="p-3 text-right bg-indigo-50/40 font-black text-indigo-800">
                        {p.profitMargin}%
                      </td>
                      <td className="p-3 text-right bg-blue-50/30 font-bold text-slate-900">
                        {p.defaultSalePrice ? formatNumber(p.defaultSalePrice) + ' ₫' : '—'}
                      </td>
                      <td className="p-3 text-right bg-blue-50/30 font-semibold text-indigo-700">
                        {p.priceVariance ? '±' + formatNumber(p.priceVariance) + ' ₫' : '—'}
                      </td>
                      <td className={`p-3 text-right font-black ${
                        stock < 0
                          ? 'text-red-600 bg-red-50/80 border border-red-200 rounded'
                          : 'text-emerald-700 bg-emerald-50/40'
                      }`}>
                        {formatNumber(stock)} {p.saleUnit}
                      </td>
                      <td className="p-3 text-center">
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
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
        />
      )}

      {/* Product Excel Duplicate Conflict Modal */}
      {conflictModalOpen && (
        <ExcelDuplicateConflictModal
          isOpen={conflictModalOpen}
          entityTitle="Sản phẩm / Hàng hóa"
          totalImportedCount={totalImportedCount}
          newItemsCount={pendingNewProducts.length}
          conflicts={pendingConflicts}
          onSkipDuplicates={handleSkipDuplicates}
          onOverwriteDuplicates={handleOverwriteDuplicates}
          onCancel={() => setConflictModalOpen(false)}
        />
      )}
    </div>
  );
};
