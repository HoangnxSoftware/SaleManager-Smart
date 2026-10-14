import React, { useState, useMemo } from 'react';
import { Order, Product, PurchaseBill, AppSettings } from '../../types';
import { calculateSuggestedPrices } from '../../services/fifo';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { AlertTriangle, Calculator, CheckCircle2, X } from 'lucide-react';

interface RecalculatePricesModalProps {
  orders: Order[];
  selectedOrderIds: string[];
  products: Product[];
  purchases: PurchaseBill[];
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onApplyRecalculation: (updatedOrders: Order[]) => void;
}

export const RecalculatePricesModal: React.FC<RecalculatePricesModalProps> = ({
  orders,
  selectedOrderIds,
  products,
  purchases,
  settings,
  isOpen,
  onClose,
  onApplyRecalculation,
}) => {
  const [filterMode, setFilterMode] = useState<'selected' | 'dates'>(
    selectedOrderIds.length > 0 ? 'selected' : 'dates'
  );
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [hasConfirmed, setHasConfirmed] = useState(false);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.code, p));
    return map;
  }, [products]);

  // Determine which orders will be affected
  const targetOrders = useMemo(() => {
    if (filterMode === 'selected') {
      return orders.filter((o) => selectedOrderIds.includes(o.id));
    } else {
      return orders.filter(
        (o) => o.orderDate >= startDate && o.orderDate <= endDate
      );
    }
  }, [orders, filterMode, selectedOrderIds, startDate, endDate]);

  // Compute recalculated values
  const recalculatedOrders = useMemo(() => {
    const decimals = settings.salePriceDecimals ?? 2;
    const factor = Math.pow(10, decimals);

    return targetOrders.map((ord) => {
      let updatedTotalPreTax = 0;
      let updatedTotalVat = 0;
      let updatedItemDiscountTotal = 0;

      const newItems = ord.items.map((item) => {
        const prod = productMap.get(item.productCode);
        const vatRate = item.vatRate ?? 10;
        let newPreTaxPrice = item.preTaxPrice;
        let postTaxPrice = item.postTaxPrice || Number((item.preTaxPrice * (1 + vatRate / 100)).toFixed(decimals));

        if (prod) {
          const sp = calculateSuggestedPrices(
            prod,
            ord.orderDate,
            products,
            purchases,
            orders,
            settings.postTaxSalePriceDecimals ?? -2,
            decimals,
            ord.id
          );
          if (sp.priceByMargin > 0) {
            postTaxPrice = sp.priceByMargin;
            newPreTaxPrice = Number((sp.priceByMargin / (1 + vatRate / 100)).toFixed(decimals));
          }
        }

        const newSubtotal = item.quantity * newPreTaxPrice;
        const netAfterItemDiscount = Math.max(0, newSubtotal - (item.itemDiscount || 0));
        const vatAmount = Math.round(((netAfterItemDiscount * vatRate) / 100) * factor) / factor;
        const totalAmount = netAfterItemDiscount + vatAmount;

        updatedTotalPreTax += newSubtotal;
        updatedItemDiscountTotal += item.itemDiscount || 0;
        updatedTotalVat += vatAmount;

        return {
          ...item,
          preTaxPrice: newPreTaxPrice,
          postTaxPrice,
          subtotal: newSubtotal,
          vatAmount,
          totalAmount,
        };
      });

      const orderDiscount = ord.orderDiscount || 0;
      const netPreTaxOrder = Math.max(0, updatedTotalPreTax - updatedItemDiscountTotal - orderDiscount);
      const finalTotalAmount = netPreTaxOrder + updatedTotalVat;
      const newDebt = Math.max(0, finalTotalAmount - ord.paidAmount);

      return {
        ...ord,
        items: newItems,
        totalPreTax: updatedTotalPreTax,
        itemDiscountTotal: updatedItemDiscountTotal,
        totalVat: updatedTotalVat,
        totalAmount: finalTotalAmount,
        debtAmount: newDebt,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [targetOrders, productMap, products, purchases, orders, settings.salePriceDecimals, settings.postTaxSalePriceDecimals]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!hasConfirmed) return;
    onApplyRecalculation(recalculatedOrders);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                Tự động tính lại đơn giá bán theo Giá vốn cao nhất & Tỷ suất lợi nhuận
              </h2>
              <p className="text-amber-100 text-xs">
                Quy tắc: Giá vốn cao nhất của lô còn hiệu lực x (1 + Tỷ suất lợi nhuận %)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-amber-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter controls */}
        <div className="p-5 space-y-4 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Phạm vi áp dụng:
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="filterMode"
                value="selected"
                checked={filterMode === 'selected'}
                onChange={() => setFilterMode('selected')}
                className="text-amber-600 focus:ring-amber-500"
              />
              <span>Theo đơn hàng đã chọn ({selectedOrderIds.length} đơn)</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="filterMode"
                value="dates"
                checked={filterMode === 'dates'}
                onChange={() => setFilterMode('dates')}
                className="text-amber-600 focus:ring-amber-500"
              />
              <span>Theo ngày / khoảng ngày</span>
            </label>
          </div>

          {filterMode === 'dates' && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <span className="text-xs text-slate-600 font-medium">Từ ngày:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
              />
              <span className="text-xs text-slate-600 font-medium">Đến ngày:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
              />
            </div>
          )}
        </div>

        {/* Preview of orders to be updated */}
        <div className="p-5 max-h-72 overflow-y-auto space-y-3">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
            <span>Danh sách {targetOrders.length} đơn hàng sẽ được tính toán lại:</span>
            <span>Số mặt hàng: {recalculatedOrders.reduce((sum, o) => sum + o.items.length, 0)}</span>
          </div>

          {targetOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Không có đơn hàng nào phù hợp với phạm vi lựa chọn. Vui lòng tích chọn đơn hoặc chọn lại khoảng ngày.
            </div>
          ) : (
            targetOrders.map((ord, idx) => {
              const updated = recalculatedOrders[idx];
              const diff = updated ? updated.totalAmount - ord.totalAmount : 0;
              return (
                <div
                  key={ord.id}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between text-xs sm:text-sm"
                >
                  <div>
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <span className="font-mono text-blue-600">{ord.orderCode}</span>
                      <span className="text-slate-400 font-normal">|</span>
                      <span>{ord.customerName}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Ngày tạo: {formatDate(ord.orderDate)} • {ord.items.length} mặt hàng
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-400 line-through">
                      Hiện tại: {formatCurrency(ord.totalAmount)}
                    </div>
                    <div className="font-bold text-amber-700">
                      Mới: {formatCurrency(updated?.totalAmount || 0)}
                    </div>
                    <div
                      className={`text-[11px] font-semibold ${
                        diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-500'
                      }`}
                    >
                      Chênh lệch: {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Mandatory Warning Checkbox */}
        <div className="p-5 bg-amber-50 border-t border-amber-200 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-bold">CẢNH BÁO QUAN TRỌNG:</strong> Thao tác này sẽ tự động tra cứu Giá vốn cao nhất của từng sản phẩm từ ngày có lô tồn kho đến ngày tạo đơn, nhân với Tỷ suất lợi nhuận trong danh mục và ghi đè đơn giá bán, thành tiền cũng như tổng tiền thanh toán của các đơn hàng trên.
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-amber-300 cursor-pointer shadow-xs">
            <input
              type="checkbox"
              checked={hasConfirmed}
              onChange={(e) => setHasConfirmed(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-amber-400 focus:ring-amber-500 cursor-pointer"
            />
            <span className="text-xs sm:text-sm font-semibold text-slate-800">
              Tôi xác nhận và chắc chắn muốn áp dụng tính toán lại đơn giá bán cho {targetOrders.length} đơn hàng này
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-100 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={!hasConfirmed || targetOrders.length === 0}
            onClick={handleApply}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Thực hiện tính toán lại</span>
          </button>
        </div>
      </div>
    </div>
  );
};
