import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, OrderItem, PurchaseBill, Order, AppSettings } from '../../types';
import { calculateSuggestedPrices } from '../../services/fifo';
import { formatNumber, formatDate } from '../../utils/formatters';
import {
  X,
  Search,
  RefreshCw,
  Package,
  Check,
  CheckCircle2,
  Layers,
  ArrowRight,
  TrendingUp,
  Tag,
  AlertCircle,
} from 'lucide-react';

interface ChangeProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentItem: OrderItem | null;
  itemIndex: number;
  products: Product[];
  inventoryStockMap: Map<string, { inStock: number; [key: string]: any }>;
  orderDate: string;
  purchases: PurchaseBill[];
  allOrders: Order[];
  settings: AppSettings;
  initialOrderId?: string;
  onSelectProduct: (
    newProduct: Product,
    options: { keepQuantity: boolean; keepPrice: boolean; customPrice?: number }
  ) => void;
}

export const ChangeProductModal: React.FC<ChangeProductModalProps> = ({
  isOpen,
  onClose,
  currentItem,
  itemIndex,
  products,
  inventoryStockMap,
  orderDate,
  purchases,
  allOrders,
  settings,
  initialOrderId,
  onSelectProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [keepQuantity, setKeepQuantity] = useState(true);
  const [applySuggestedPrice, setApplySuggestedPrice] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedCategory('all');
      setKeepQuantity(true);
      setApplySuggestedPrice(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let result = products;

    if (selectedCategory !== 'all') {
      result = result.filter((p) => (p.category || '').trim() === selectedCategory);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          p.saleUnit.toLowerCase().includes(q)
      );
    }

    return result;
  }, [products, selectedCategory, searchTerm]);

  if (!isOpen || !currentItem) return null;

  const handleChooseProduct = (prod: Product, customPrice?: number) => {
    onSelectProduct(prod, {
      keepQuantity,
      keepPrice: !applySuggestedPrice && customPrice === undefined,
      customPrice,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/20 shadow-xs">
              <RefreshCw className="w-5 h-5 text-white animate-spin-reverse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>Đổi mặt hàng đã chọn</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/50 text-indigo-100 border border-indigo-400/40">
                  Dòng #{itemIndex + 1}
                </span>
              </h2>
              <p className="text-indigo-100 text-xs mt-0.5">
                Chọn mặt hàng mới thay thế cho mặt hàng hiện tại trong đơn hàng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Item Banner */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 mt-0.5 shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Mặt hàng hiện tại:
                </div>
                <div className="font-bold text-slate-900 text-sm truncate" title={currentItem.productName}>
                  {currentItem.productName}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 font-mono mt-0.5 flex-wrap">
                  <span className="bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded font-semibold">
                    Mã: {currentItem.productCode}
                  </span>
                  <span>ĐVT: <strong>{currentItem.saleUnit}</strong></span>
                  <span>SL: <strong className="text-indigo-700">{currentItem.quantity}</strong></span>
                  <span>Đơn giá: <strong className="text-blue-700">{formatNumber(currentItem.postTaxPrice)} ₫</strong></span>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="flex flex-wrap sm:flex-col gap-2 shrink-0 bg-white p-2 rounded-xl border border-slate-200 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={keepQuantity}
                  onChange={(e) => setKeepQuantity(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>Giữ nguyên số lượng (<strong>{currentItem.quantity}</strong> {currentItem.saleUnit})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={applySuggestedPrice}
                  onChange={(e) => setApplySuggestedPrice(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>Áp dụng đơn giá gợi ý của hàng mới</span>
              </label>
            </div>
          </div>
        </div>

        {/* Search Bar & Category Chips */}
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-white space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã hàng hóa, tên hàng, nhóm hàng hoặc đơn vị tính..."
              className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Chips */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => (p.category || '').trim() === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-slate-100">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <div className="text-sm font-semibold">Không tìm thấy mặt hàng nào phù hợp</div>
              <div className="text-xs text-slate-500 mt-1">
                Thử tìm với từ khóa khác hoặc chuyển sang danh mục khác
              </div>
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const isCurrent = prod.code === currentItem.productCode;
              const stock = inventoryStockMap.get(prod.code)?.inStock;
              const sp = calculateSuggestedPrices(
                prod,
                orderDate,
                products,
                purchases,
                allOrders,
                settings.postTaxSalePriceDecimals ?? -2,
                settings.salePriceDecimals ?? 2,
                initialOrderId
              );

              return (
                <div
                  key={prod.id}
                  className={`py-3 px-3 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-indigo-50/70 border border-indigo-200'
                      : 'hover:bg-slate-50 hover:border-slate-200 border border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                        {prod.code}
                      </span>
                      {prod.category && (
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                          {prod.category}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Đang chọn dòng này
                        </span>
                      )}
                    </div>

                    <div className="font-bold text-sm text-slate-900 mt-1">
                      {prod.name}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      <span>ĐVT bán: <strong className="text-slate-800">{prod.saleUnit}</strong></span>
                      <span>Thuế GTGT: <strong className="text-slate-800">{prod.vatRate}%</strong></span>
                      {stock !== undefined && (
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                            stock > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : stock === 0
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                          title={`Tồn kho đến ${formatDate(orderDate)}: ${formatNumber(stock)} ${prod.saleUnit}`}
                        >
                          Tồn kho: {formatNumber(stock)} {prod.saleUnit}
                        </span>
                      )}
                    </div>

                    {/* Price Suggestions Chips */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap text-xs">
                      <span className="text-[11px] text-slate-400 font-medium">Giá gợi ý:</span>
                      {sp.priceByMargin > 0 && (
                        <button
                          type="button"
                          onClick={() => handleChooseProduct(prod, sp.priceByMargin)}
                          className="px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-[11px] transition-colors cursor-pointer"
                          title={`Giá theo TSLN ${prod.profitMargin}%: ${formatNumber(sp.priceByMargin)} ₫`}
                        >
                          TSLN: {formatNumber(sp.priceByMargin)} ₫
                        </button>
                      )}
                      {sp.defaultPrice > 0 && (
                        <button
                          type="button"
                          onClick={() => handleChooseProduct(prod, sp.defaultPrice)}
                          className="px-2 py-0.5 rounded border border-blue-200 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 font-bold text-[11px] transition-colors cursor-pointer"
                          title="Giá bán mặc định"
                        >
                          MĐ: {formatNumber(sp.defaultPrice)} ₫
                        </button>
                      )}
                      {sp.priceMinusVariance > 0 && (
                        <button
                          type="button"
                          onClick={() => handleChooseProduct(prod, sp.priceMinusVariance)}
                          className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 text-[11px] transition-colors cursor-pointer"
                          title="Giá biên độ (-)"
                        >
                          (-): {formatNumber(sp.priceMinusVariance)} ₫
                        </button>
                      )}
                      {sp.pricePlusVariance > 0 && (
                        <button
                          type="button"
                          onClick={() => handleChooseProduct(prod, sp.pricePlusVariance)}
                          className="px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 text-[11px] transition-colors cursor-pointer"
                          title="Giá biên độ (+)"
                        >
                          (+): {formatNumber(sp.pricePlusVariance)} ₫
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="shrink-0 flex items-center justify-end sm:justify-start">
                    <button
                      type="button"
                      disabled={isCurrent}
                      onClick={() => handleChooseProduct(prod)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{isCurrent ? 'Đang chọn' : 'Chọn đổi sang hàng này'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Đổi mặt hàng sẽ tự động cập nhật ĐVT, thuế suất, đơn giá và tính lại thành tiền.
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              Đóng / Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
