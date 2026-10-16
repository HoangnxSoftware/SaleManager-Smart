import React from 'react';
import { Order, AppSettings } from '../../types';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { X, Printer, Copy, Edit, FileText, CheckCircle, Clock, Truck, AlertCircle } from 'lucide-react';

interface OrderDetailModalProps {
  order: Order | null;
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (order: Order) => void;
  onCopy: (order: Order) => void;
  onPrint: (order: Order) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  settings,
  isOpen,
  onClose,
  onEdit,
  onCopy,
  onPrint,
}) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl xl:max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold font-mono text-white">
                  {order.orderCode}
                </h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    order.deliveryStatus === 'pending'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : order.deliveryStatus === 'delivering'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      : order.deliveryStatus === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {order.deliveryStatus === 'pending'
                    ? 'Chờ giao'
                    : order.deliveryStatus === 'delivering'
                    ? 'Đang giao'
                    : order.deliveryStatus === 'completed'
                    ? 'Hoàn thành'
                    : 'Đã hủy'}
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Ngày tạo đơn: {formatDate(order.orderDate)} • Người lập: {order.createdByName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrint(order)}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="In phiếu này"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Customer & Order Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs sm:text-sm">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                Thông tin khách hàng
              </h4>
              <p>
                <span className="font-semibold text-slate-900">Tên KH:</span> {order.customerName}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Mã KH:</span>{' '}
                <span className="font-mono text-blue-600 font-bold">{order.customerCode}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-900">MST:</span> {order.customerTaxCode || 'Không có'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Số CCCD:</span> {order.customerIdCard || 'Không có'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Địa chỉ:</span> {order.customerAddress || 'Chưa cập nhật'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs sm:text-sm">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                Thanh toán & Giao nhận
              </h4>
              <p>
                <span className="font-semibold text-slate-900">Phương thức TT:</span>{' '}
                {order.paymentMethod === 'cash' ? 'Tiền mặt' : order.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thẻ'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Đã thanh toán:</span>{' '}
                <span className="font-bold text-emerald-600">{formatCurrency(order.paidAmount)}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-900">Công nợ đơn hàng:</span>{' '}
                <span className={order.debtAmount > 0 ? 'font-bold text-rose-600' : 'font-semibold text-slate-700'}>
                  {formatCurrency(order.debtAmount)}
                </span>
              </p>
              <p>
                <span className="font-semibold text-slate-900">Ghi chú:</span> {order.notes || 'Không có ghi chú'}
              </p>
            </div>
          </div>

          {/* Items Detail Table */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
              Chi tiết các mặt hàng ({order.items.length} mặt hàng)
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 text-[11px] uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-center w-10 whitespace-nowrap">STT</th>
                    <th className="p-2.5 text-left whitespace-nowrap">Mã HH</th>
                    <th className="p-2.5 text-left min-w-[160px]">Tên HH</th>
                    <th className="p-2.5 text-center whitespace-nowrap">ĐVT_Bán</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Số lượng</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Đơn giá bán (Sau thuế)</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Đơn giá trước thuế</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Thành tiền</th>
                    <th className="p-2.5 text-center whitespace-nowrap">thuế %</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Thuế GTGT</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Chiết Khấu</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Tổng tiền thanh toán</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="p-2.5 text-center text-slate-500 font-medium whitespace-nowrap">{idx + 1}</td>
                      <td className="p-2.5 font-mono font-medium text-slate-700 whitespace-nowrap">{item.productCode}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{item.productName}</td>
                      <td className="p-2.5 text-center text-slate-600 whitespace-nowrap">{item.saleUnit}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900 whitespace-nowrap">{formatNumber(item.quantity)}</td>
                      <td className="p-2.5 text-right font-semibold text-blue-700 whitespace-nowrap">{formatCurrency(item.postTaxPrice)}</td>
                      <td className="p-2.5 text-right text-slate-700 whitespace-nowrap">{formatCurrency(item.preTaxPrice)}</td>
                      <td className="p-2.5 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(item.subtotal)}</td>
                      <td className="p-2.5 text-center text-slate-700 whitespace-nowrap">{item.vatRate}%</td>
                      <td className="p-2.5 text-right text-slate-700 whitespace-nowrap">{formatCurrency(item.vatAmount)}</td>
                      <td className="p-2.5 text-right text-slate-600 whitespace-nowrap">
                        {item.itemDiscount > 0 ? formatCurrency(item.itemDiscount) : '0'}
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900 whitespace-nowrap">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="flex flex-col sm:flex-row justify-end">
            <div className="w-full sm:w-96 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs sm:text-sm">
              {/* 1. Tổng tiền hàng (Trước thuế): */}
              <div className="flex justify-between text-slate-600">
                <span>Tổng tiền hàng (Trước thuế):</span>
                <span className="font-semibold text-slate-800">{formatCurrency(order.totalPreTax)}</span>
              </div>
              {(() => {
                const subtotalMap = new Map<number, number>();
                order.items.forEach((it) => {
                  const r = it.vatRate || 0;
                  subtotalMap.set(r, (subtotalMap.get(r) || 0) + (it.subtotal || 0));
                });
                if (subtotalMap.size <= 0) return null;
                return (
                  <div className="pl-2.5 py-1 space-y-0.5 border-l-2 border-blue-300 text-[11px] text-slate-600 bg-blue-50/40 rounded-r-md">
                    <div className="font-semibold text-blue-900 text-[10px] uppercase">Thành tiền theo từng thuế suất:</div>
                    {Array.from(subtotalMap.entries()).sort((a, b) => a[0] - b[0]).map(([rate, amt]) => (
                      <div key={rate} className="flex justify-between pr-1">
                        <span>• Thuế {rate}%:</span>
                        <span className="font-semibold text-blue-800">{formatCurrency(amt)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* 2. Tổng thuế GTGT: */}
              <div className="flex justify-between text-slate-600">
                <span>Tổng thuế GTGT:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(order.totalVat)}</span>
              </div>
              {(() => {
                const taxMap = new Map<number, number>();
                order.items.forEach((it) => {
                  const r = it.vatRate || 0;
                  taxMap.set(r, (taxMap.get(r) || 0) + (it.vatAmount || 0));
                });
                if (taxMap.size <= 0) return null;
                return (
                  <div className="pl-2.5 py-1 space-y-0.5 border-l-2 border-amber-300 text-[11px] text-slate-600 bg-amber-50/40 rounded-r-md">
                    <div className="font-semibold text-amber-900 text-[10px] uppercase">Thuế GTGT theo từng thuế suất:</div>
                    {Array.from(taxMap.entries()).sort((a, b) => a[0] - b[0]).map(([rate, amt]) => (
                      <div key={rate} className="flex justify-between pr-1">
                        <span>• Thuế {rate}%:</span>
                        <span className="font-semibold text-amber-800">{formatCurrency(amt)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* 3. Chiết khấu mặt hàng: */}
              {(() => {
                const itemDiscountTotal = (order.itemDiscountTotal !== undefined && order.itemDiscountTotal !== null)
                  ? order.itemDiscountTotal
                  : (order.items || []).reduce((sum, it) => sum + (it.itemDiscount || 0), 0);
                return (
                  <div className="flex justify-between text-slate-600">
                    <span>Chiết khấu mặt hàng:</span>
                    <span className={itemDiscountTotal > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-700'}>
                      {itemDiscountTotal > 0 ? `-${formatCurrency(itemDiscountTotal)}` : '0 ₫'}
                    </span>
                  </div>
                );
              })()}

              {/* 4. Chiết khấu tổng đơn: */}
              <div className="flex justify-between text-slate-600">
                <span>Chiết khấu tổng đơn:</span>
                <span className={order.orderDiscount > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-700'}>
                  {order.orderDiscount > 0 ? `-${formatCurrency(order.orderDiscount)}` : '0 ₫'}
                </span>
              </div>

              {/* 5. Tổng tiền thanh toán: */}
              <div className="flex justify-between text-base font-black text-blue-900 border-t border-slate-300 pt-2">
                <span>Tổng tiền thanh toán:</span>
                <span className="text-blue-700 text-lg">{formatCurrency(order.totalAmount)}</span>
              </div>

              {/* 6. Đã Thanh toán: */}
              <div className="flex justify-between text-emerald-600 font-semibold pt-1">
                <span>Đã Thanh toán:</span>
                <span>{formatCurrency(order.paidAmount)}</span>
              </div>

              {/* 7. Công nợ còn lại: */}
              <div className="flex justify-between text-rose-600 font-bold border-t border-slate-200 pt-1">
                <span>Công nợ còn lại:</span>
                <span>{formatCurrency(order.debtAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onCopy(order);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4 text-slate-500" />
              <span>Copy đơn hàng này</span>
            </button>
            <button
              onClick={() => {
                onEdit(order);
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <Edit className="w-4 h-4" />
              <span>Chỉnh sửa đơn hàng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
