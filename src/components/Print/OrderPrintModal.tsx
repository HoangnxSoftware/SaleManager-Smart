import React from 'react';
import { Order, AppSettings } from '../../types';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { Printer, X, Download } from 'lucide-react';

interface OrderPrintModalProps {
  orders: Order[];
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderPrintModal: React.FC<OrderPrintModalProps> = ({
  orders,
  settings,
  isOpen,
  onClose,
}) => {
  if (!isOpen || orders.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none">
        {/* Modal Controls - hidden in print */}
        <div className="print:hidden flex items-center justify-between p-4 bg-slate-800 text-white border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-base">
              Xem trước in hóa đơn ({orders.length} đơn hàng đã chọn)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In ngay (Print)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Pages */}
        <div className="p-6 sm:p-10 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 space-y-12">
          {orders.map((order, orderIdx) => (
            <div
              key={order.id}
              className="print:break-after-page border border-slate-200 p-8 rounded-xl shadow-xs print:border-none print:p-0 print:shadow-none"
            >
              {/* Company Header */}
              <div className="flex justify-between items-start border-b border-slate-300 pb-4 mb-4">
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    {settings.companyName}
                  </h2>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">Mã số thuế:</span> {settings.taxCode}
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">Địa chỉ:</span> {settings.address}
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">Điện thoại:</span> {settings.phone} | <span className="font-semibold">Email:</span> {settings.email}
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">Số TK:</span> {settings.bankAccount} - {settings.bankName}
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-slate-100 rounded text-xs font-mono font-semibold text-slate-700 border border-slate-200">
                    {order.orderCode}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Ngày: {formatDate(order.orderDate)}
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center my-6">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-wide">
                  HÓA ĐƠN BÁN HÀNG
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  (Liên 1: Lưu nội bộ - Liên 2: Giao cho khách hàng)
                </p>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                <div>
                  <p className="text-slate-700">
                    <span className="font-bold text-slate-900">Khách hàng:</span> {order.customerName}
                  </p>
                  <p className="text-slate-700 mt-1">
                    <span className="font-bold text-slate-900">Mã KH:</span> {order.customerCode}
                  </p>
                  <p className="text-slate-700 mt-1">
                    <span className="font-bold text-slate-900">MST / CCCD:</span>{' '}
                    {order.customerTaxCode || order.customerIdCard || 'Chưa cung cấp'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-700">
                    <span className="font-bold text-slate-900">Địa chỉ giao:</span> {order.customerAddress || 'Tại quầy'}
                  </p>
                  <p className="text-slate-700 mt-1">
                    <span className="font-bold text-slate-900">Phương thức TT:</span>{' '}
                    {order.paymentMethod === 'cash' ? 'Tiền mặt' : order.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thẻ'}
                  </p>
                  <p className="text-slate-700 mt-1">
                    <span className="font-bold text-slate-900">Ghi chú:</span> {order.notes || 'Không có'}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-xs text-left border-collapse border border-slate-300">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                    <tr>
                      <th className="border border-slate-300 px-2.5 py-2 text-center w-10">STT</th>
                      <th className="border border-slate-300 px-2.5 py-2">Mã HH</th>
                      <th className="border border-slate-300 px-2.5 py-2">Tên hàng hóa</th>
                      <th className="border border-slate-300 px-2.5 py-2 text-center">ĐVT</th>
                      <th className="border border-slate-300 px-2.5 py-2 text-right">SL</th>
                      <th className="border border-slate-300 px-2.5 py-2 text-right">Đơn giá trước thuế</th>
                      <th className="border border-slate-300 px-2.5 py-2 text-right">Tiền hàng (trước thuế)</th>
                      <th className="border border-slate-300 px-2.5 py-2 text-right">Chiết khấu</th>
                      <th className="border border-slate-300 px-2.5 py-2 text-center">Thuế %</th>
                      <th className="border border-slate-300 px-2.5 py-2 text-right">Tiền thuế</th>
                      <th className="border border-slate-300 px-2.5 py-2 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => (
                      <tr key={item.id} className="text-slate-800">
                        <td className="border border-slate-300 px-2.5 py-1.5 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 px-2.5 py-1.5 font-mono">{item.productCode}</td>
                        <td className="border border-slate-300 px-2.5 py-1.5 font-medium">{item.productName}</td>
                        <td className="border border-slate-300 px-2.5 py-1.5 text-center">{item.saleUnit}</td>
                        <td className="border border-slate-300 px-2.5 py-1.5 text-right font-medium">{formatNumber(item.quantity)}</td>
                        <td className="border border-slate-300 px-2.5 py-1.5 text-right">{formatCurrency(item.preTaxPrice)}</td>
                        <td className="border border-slate-300 px-2.5 py-1.5 text-right font-medium">
                          {formatCurrency(item.subtotal || (item.quantity * item.preTaxPrice))}
                        </td>
                        <td className="border border-slate-300 px-2.5 py-1.5 text-right">{item.itemDiscount > 0 ? formatCurrency(item.itemDiscount) : '0'}</td>
                        <td className="border border-slate-300 px-2.5 py-1.5 text-center">{item.vatRate}%</td>
                        <td className="border border-slate-300 px-2.5 py-1.5 text-right">{formatCurrency(item.vatAmount)}</td>
                        <td className="border border-slate-300 px-2.5 py-1.5 text-right font-semibold">{formatCurrency(item.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summaries & Signatures */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                <div className="w-full sm:w-1/2 text-xs space-y-1 text-slate-600">
                  <p>
                    <span className="font-semibold">Người lập đơn:</span> {order.createdByName}
                  </p>
                  <p>
                    <span className="font-semibold">Trạng thái giao:</span>{' '}
                    {order.deliveryStatus === 'pending'
                      ? 'Chờ giao'
                      : order.deliveryStatus === 'delivering'
                      ? 'Đang giao'
                      : order.deliveryStatus === 'completed'
                      ? 'Hoàn thành'
                      : 'Đã hủy'}
                  </p>
                  <div className="pt-4 italic text-slate-500">
                    Cảm ơn Quý khách đã tin tưởng và ủng hộ chúng tôi!
                  </div>
                </div>

                <div className="w-full sm:w-1/2 border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs sm:text-sm space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Tổng tiền hàng (trước thuế):</span>
                    <span className="font-medium text-slate-800">{formatCurrency(order.totalPreTax)}</span>
                  </div>
                  {(() => {
                    const subtotalMap = new Map<number, number>();
                    order.items.forEach((it) => {
                      const r = it.vatRate || 0;
                      subtotalMap.set(r, (subtotalMap.get(r) || 0) + (it.subtotal || 0));
                    });
                    if (subtotalMap.size <= 0) return null;
                    return (
                      <div className="pl-2 py-0.5 space-y-0.5 border-l-2 border-slate-300 text-[11px] text-slate-600">
                        {Array.from(subtotalMap.entries()).sort((a, b) => a[0] - b[0]).map(([rate, amt]) => (
                          <div key={rate} className="flex justify-between">
                            <span>• Tiền hàng thuế {rate}%:</span>
                            <span className="font-medium text-slate-800">{formatCurrency(amt)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {order.orderDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Giảm giá / Chiết khấu đơn:</span>
                      <span className="font-medium">-{formatCurrency(order.orderDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Tổng tiền thuế GTGT:</span>
                    <span className="font-medium text-slate-800">{formatCurrency(order.totalVat)}</span>
                  </div>
                  {(() => {
                    const taxMap = new Map<number, number>();
                    order.items.forEach((it) => {
                      const r = it.vatRate || 0;
                      taxMap.set(r, (taxMap.get(r) || 0) + (it.vatAmount || 0));
                    });
                    if (taxMap.size <= 0) return null;
                    return (
                      <div className="pl-2 py-0.5 space-y-0.5 border-l-2 border-slate-300 text-[11px] text-slate-600">
                        {Array.from(taxMap.entries()).sort((a, b) => a[0] - b[0]).map(([rate, amt]) => (
                          <div key={rate} className="flex justify-between">
                            <span>• Tiền thuế GTGT {rate}%:</span>
                            <span className="font-medium text-slate-800">{formatCurrency(amt)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="flex justify-between font-bold text-sm sm:text-base text-slate-900 border-t border-slate-300 pt-2">
                    <span>Tổng tiền thanh toán:</span>
                    <span className="text-blue-700">{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700 pt-1">
                    <span>Đã thanh toán đợt này:</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(order.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700 font-semibold">
                    <span>Công nợ còn lại của đơn:</span>
                    <span className={order.debtAmount > 0 ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                      {formatCurrency(order.debtAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 text-center text-xs mt-10 pt-4 border-t border-slate-200">
                <div>
                  <p className="font-bold text-slate-800">Người mua hàng</p>
                  <p className="text-slate-400 italic text-[11px]">(Ký, ghi rõ họ tên)</p>
                  <div className="h-16"></div>
                </div>
                <div>
                  <p className="font-bold text-slate-800">Thủ kho / Giao hàng</p>
                  <p className="text-slate-400 italic text-[11px]">(Ký, ghi rõ họ tên)</p>
                  <div className="h-16"></div>
                </div>
                <div>
                  <p className="font-bold text-slate-800">Người bán hàng</p>
                  <p className="text-slate-400 italic text-[11px]">(Ký, ghi rõ họ tên)</p>
                  <div className="h-16"></div>
                  <p className="font-semibold text-slate-700">{order.createdByName}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
