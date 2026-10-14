import React, { useState, useMemo } from 'react';
import { Order, OrderItem } from '../../types';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { exportOrderDetailsToExcel } from '../../services/excelService';
import {
  Search,
  FileSpreadsheet,
  Calendar,
  Filter,
  Eye,
  Edit,
  Check,
  X,
  Layers,
  ShoppingBag,
  TrendingUp,
  Receipt,
  Sparkles,
  Info
} from 'lucide-react';

interface OrderDetailsTabProps {
  orders: Order[];
  onSaveOrder: (order: Order) => void;
  onViewOrder: (order: Order) => void;
  onEditOrder: (order: Order) => void;
}

interface FlattenedRow {
  rowId: string;
  order: Order;
  item: OrderItem;
  itemIndex: number;
  totalItemsInOrder: number;
  isFirstRow: boolean;
}

export const OrderDetailsTab: React.FC<OrderDetailsTabProps> = ({
  orders,
  onSaveOrder,
  onViewOrder,
  onEditOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Inline editing state for "Đơn giá bán sau thuế"
  // Map key: `${orderId}_${itemId}`
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempPostTaxPrice, setTempPostTaxPrice] = useState<string>('');

  // Flatten orders into item rows
  const flattenedRows: FlattenedRow[] = useMemo(() => {
    // Sort orders newest first
    const sortedOrders = [...orders].sort(
      (a, b) => b.orderDate.localeCompare(a.orderDate) || b.createdAt.localeCompare(a.createdAt)
    );

    const rows: FlattenedRow[] = [];

    sortedOrders.forEach((order) => {
      // Apply filters on order level or item level
      const matchDate = !dateFilter || order.orderDate === dateFilter;
      if (!matchDate) return;

      const items = order.items && order.items.length > 0 ? order.items : [];
      if (items.length === 0) return;

      items.forEach((item, idx) => {
        rows.push({
          rowId: `${order.id}-${item.id || idx}`,
          order,
          item,
          itemIndex: idx,
          totalItemsInOrder: items.length,
          isFirstRow: idx === 0,
        });
      });
    });

    // Apply search query
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.toLowerCase();

    return rows.filter((r) => {
      const o = r.order;
      const it = r.item;
      return (
        o.orderCode.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerCode.toLowerCase().includes(q) ||
        (o.customerTaxCode && o.customerTaxCode.toLowerCase().includes(q)) ||
        (o.customerIdCard && o.customerIdCard.toLowerCase().includes(q)) ||
        (o.customerAddress && o.customerAddress.toLowerCase().includes(q)) ||
        it.productCode.toLowerCase().includes(q) ||
        it.productName.toLowerCase().includes(q)
      );
    });
  }, [orders, dateFilter, searchTerm]);

  // Aggregate KPI stats
  const kpiStats = useMemo(() => {
    let totalQuantity = 0;
    let totalPreTaxSum = 0;
    let totalVatSum = 0;
    let totalPaymentSum = 0;

    const uniqueOrderIds = new Set<string>();

    flattenedRows.forEach((r) => {
      totalQuantity += r.item.quantity || 0;
      totalPreTaxSum += r.item.subtotal || 0;
      totalVatSum += r.item.vatAmount || 0;

      if (!uniqueOrderIds.has(r.order.id)) {
        uniqueOrderIds.add(r.order.id);
        totalPaymentSum += r.order.totalAmount || 0;
      }
    });

    return {
      orderCount: uniqueOrderIds.size,
      rowCount: flattenedRows.length,
      totalQuantity,
      totalPreTaxSum,
      totalVatSum,
      totalPaymentSum,
    };
  }, [flattenedRows]);

  // Handle starting inline edit
  const handleStartEditPostTax = (order: Order, item: OrderItem) => {
    const key = `${order.id}_${item.id}`;
    setEditingKey(key);
    const postTax =
      item.postTaxPrice || Number((item.preTaxPrice * (1 + (item.vatRate || 0) / 100)).toFixed(2));
    setTempPostTaxPrice(String(postTax));
  };

  // Handle saving post-tax price change
  // REQUIREMENT: "trường hợp có sửa đơn giá sau thuế thì đơn giá trước thuế được tự động tính lại, đơn giá trước thuế có 2 số thập phân"
  const handleSavePostTaxPrice = (order: Order, itemIndex: number) => {
    const newPostTax = parseFloat(tempPostTaxPrice);
    if (isNaN(newPostTax) || newPostTax < 0) {
      alert('Đơn giá sau thuế không hợp lệ.');
      return;
    }

    const updatedItems = [...order.items];
    const targetItem = { ...updatedItems[itemIndex] };

    const vatRate = targetItem.vatRate || 0;
    const rateMultiplier = 1 + vatRate / 100;

    // Recalculate pre-tax price with exactly 2 decimal places
    const recalculatedPreTax = Number((newPostTax / rateMultiplier).toFixed(2));

    targetItem.postTaxPrice = newPostTax;
    targetItem.preTaxPrice = recalculatedPreTax;
    targetItem.subtotal = targetItem.quantity * recalculatedPreTax;

    const netBase = Math.max(0, targetItem.subtotal - (targetItem.itemDiscount || 0));
    targetItem.vatAmount = (netBase * vatRate) / 100;
    targetItem.totalAmount = netBase + targetItem.vatAmount;

    updatedItems[itemIndex] = targetItem;

    // Recalculate overall order totals
    let newOrderSubtotal = 0;
    let newOrderItemDiscounts = 0;
    let newOrderVat = 0;

    updatedItems.forEach((it) => {
      newOrderSubtotal += it.subtotal;
      newOrderItemDiscounts += it.itemDiscount || 0;
      newOrderVat += it.vatAmount;
    });

    let newOrderDiscount = order.orderDiscount || 0;
    if (order.orderDiscountPercent && order.orderDiscountPercent > 0) {
      newOrderDiscount =
        ((newOrderSubtotal - newOrderItemDiscounts) * order.orderDiscountPercent) / 100;
    }

    const newNetPreTax = Math.max(0, newOrderSubtotal - newOrderItemDiscounts - newOrderDiscount);
    const newOrderTotalAmount = newNetPreTax + newOrderVat;
    const newDebtAmount = Math.max(0, newOrderTotalAmount - (order.paidAmount || 0));

    const updatedOrder: Order = {
      ...order,
      items: updatedItems,
      totalPreTax: newOrderSubtotal,
      itemDiscountTotal: newOrderItemDiscounts,
      orderDiscount: newOrderDiscount,
      totalVat: newOrderVat,
      totalAmount: newOrderTotalAmount,
      debtAmount: newDebtAmount,
      updatedAt: new Date().toISOString(),
    };

    onSaveOrder(updatedOrder);
    setEditingKey(null);
    setTempPostTaxPrice('');
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setTempPostTaxPrice('');
  };

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Tìm theo Mã đơn, Tên KH, MST, CCCD, Mã HH, Tên HH..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>

          {/* Date */}
          <div className="relative w-full sm:w-48">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white cursor-pointer shadow-2xs"
            />
          </div>

          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer font-medium"
            >
              Xóa ngày
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Excel Export Button */}
          <button
            type="button"
            onClick={() => exportOrderDetailsToExcel(orders)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            title="Xuất đầy đủ 20 cột chi tiết đơn hàng ra file Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel Chi Tiết</span>
          </button>
        </div>
      </div>

      {/* Helper Guideline Box */}
      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <span>
          <strong>Ghi chú kế toán:</strong> Các thông tin tổng quan đơn hàng (Tên KH, MST, CCCD, Địa chỉ, Tổng thành tiền, Tổng thành tiền theo từng thuế suất, Chiết khấu tổng đơn, Tổng thuế GTGT theo từng thuế suất, Tổng thuế GTGT, Tổng tiền thanh toán) <strong>chỉ hiển thị tại dòng đầu tiên của đơn hàng</strong> theo chuẩn báo cáo kế toán. Trường hợp sửa <strong>Đơn giá bán sau thuế</strong>, hệ thống sẽ tự động tính lại <strong>Đơn giá bán trước thuế với 2 số thập phân</strong> và cập nhật toàn bộ đơn hàng.
        </span>
      </div>

      {/* Main Table: 25 Columns */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[72vh]">
          <table className="w-full text-xs text-left border-collapse min-w-[2000px]">
            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 font-bold uppercase text-[11px] shadow-2xs">
              <tr className="border-b border-slate-200">
                <th className="p-3 w-12 text-left sticky left-0 bg-slate-100 z-30">STT</th>
                <th className="p-3 w-32 text-left sticky left-12 bg-slate-100 z-30">Mã đơn</th>
                <th className="p-3 w-28 text-left">Ngày tháng</th>
                <th className="p-3 min-w-[200px] text-left">Tên khách hàng</th>
                <th className="p-3 w-28 text-left">MST</th>
                <th className="p-3 w-28 text-left">CCCD</th>
                <th className="p-3 min-w-[220px] text-left">Địa chỉ</th>
                <th className="p-3 w-28 text-left">Mã HH</th>
                <th className="p-3 min-w-[220px] text-left">Tên HH</th>
                <th className="p-3 w-20 text-left">ĐVT_Bán</th>
                <th className="p-3 w-24 text-left">Số lượng</th>
                <th className="p-3 w-36 text-left">Đơn giá bán trước thuế</th>
                <th className="p-3 w-32 text-left">Thành tiền từng mặt hàng</th>
                <th className="p-3 w-32 text-left">Chiết khấu từng mặt hàng</th>
                <th className="p-3 w-24 text-left">Thuế suất GTGT</th>
                <th className="p-3 w-28 text-left">Thuế GTGT từng mặt hàng</th>
                <th className="p-3 w-32 text-left">Tổng TT từng mặt hàng</th>
                <th className="p-3 w-36 text-left font-bold text-slate-800 bg-slate-200/50">
                  Tổng thành tiền
                </th>
                <th className="p-3 w-32 text-left">Chiết khấu giảm giá tổng đơn</th>
                <th className="p-3 w-32 text-left">Tổng thuế GTGT</th>
                <th className="p-3 w-36 text-left font-black text-blue-900">Tổng tiền thanh toán</th>
                <th className="p-3 min-w-[190px] text-left font-bold text-blue-900 bg-blue-100/50">
                  Tổng thành tiền theo từng thuế suất
                </th>
                <th className="p-3 min-w-[180px] text-left font-bold text-amber-900 bg-amber-100/40">
                  Tổng thuế theo từng thuế suất
                </th>
                <th className="p-3 w-40 text-left bg-amber-50/70 border-l border-amber-200 text-amber-900">
                  Đơn giá bán sau thuế
                </th>
                <th className="p-3 w-20 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flattenedRows.length === 0 ? (
                <tr>
                  <td colSpan={25} className="p-12 text-center text-slate-400">
                    Không tìm thấy dữ liệu mặt hàng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                flattenedRows.map((row, idx) => {
                  const { order, item, itemIndex, isFirstRow } = row;
                  const rowKey = `${order.id}_${item.id}`;
                  const isEditing = editingKey === rowKey;

                  // Post-tax unit price
                  const currentPostTaxPrice =
                    item.postTaxPrice ||
                    Number((item.preTaxPrice * (1 + (item.vatRate || 0) / 100)).toFixed(2));

                  // Apply visual border separating different orders
                  const orderBorderClass = isFirstRow && idx > 0 ? 'border-t-2 border-slate-300' : '';

                  return (
                    <tr
                      key={row.rowId}
                      className={`hover:bg-blue-50/40 transition-colors ${orderBorderClass} ${
                        isFirstRow ? 'bg-white' : 'bg-slate-50/20'
                      }`}
                    >
                      {/* STT */}
                      <td className="p-3 text-center text-slate-400 font-mono sticky left-0 bg-inherit z-10">
                        {idx + 1}
                      </td>

                      {/* 1. Mã đơn */}
                      <td className="p-3 font-mono font-bold text-blue-700 sticky left-12 bg-inherit z-10 whitespace-nowrap">
                        {isFirstRow ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewOrder(order)}
                              className="hover:underline hover:text-blue-900 text-left cursor-pointer"
                              title="Bấm để xem chi tiết đơn hàng"
                            >
                              {order.orderCode}
                            </button>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-normal">
                              {order.items.length} món
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-normal">{order.orderCode}</span>
                        )}
                      </td>

                      {/* 2. Ngày tháng */}
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {isFirstRow ? formatDate(order.orderDate) : <span className="text-slate-300">—</span>}
                      </td>

                      {/* 3. Tên khách hàng (Chỉ hiện dòng đầu tiên của đơn hàng) */}
                      <td className="p-3">
                        {isFirstRow ? (
                          <div className="font-semibold text-slate-900 leading-snug">
                            {order.customerName}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic select-none">〃</span>
                        )}
                      </td>

                      {/* 4. MST (Chỉ hiện dòng đầu tiên của đơn hàng) */}
                      <td className="p-3 font-mono">
                        {isFirstRow ? (
                          <span className="text-slate-700 font-medium">
                            {order.customerTaxCode || '—'}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic select-none">〃</span>
                        )}
                      </td>

                      {/* 5. CCCD (Chỉ hiện dòng đầu tiên của đơn hàng) */}
                      <td className="p-3 font-mono">
                        {isFirstRow ? (
                          <span className="text-slate-700 font-medium">
                            {order.customerIdCard || '—'}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic select-none">〃</span>
                        )}
                      </td>

                      {/* 6. Địa chỉ (Chỉ hiện dòng đầu tiên của đơn hàng) */}
                      <td className="p-3 text-slate-600">
                        {isFirstRow ? (
                          <span className="line-clamp-2" title={order.customerAddress}>
                            {order.customerAddress || '—'}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic select-none">〃</span>
                        )}
                      </td>

                      {/* 7. Mã HH */}
                      <td className="p-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        {item.productCode}
                      </td>

                      {/* 8. Tên HH */}
                      <td className="p-3 font-medium text-slate-900">
                        {item.productName}
                      </td>

                      {/* 9. ĐVT_Bán */}
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {item.saleUnit}
                        </span>
                      </td>

                      {/* 10. Số lượng */}
                      <td className="p-3 text-right font-black text-slate-900">
                        {formatNumber(item.quantity)}
                      </td>

                      {/* 11. Đơn giá bán trước thuế (2 số thập phân) */}
                      <td className="p-3 text-right font-mono font-bold text-slate-800">
                        {formatNumber(item.preTaxPrice, 2)} ₫
                      </td>

                      {/* 12. Thành tiền từng mặt hàng */}
                      <td className="p-3 text-right font-mono font-semibold text-slate-900">
                        {formatCurrency(item.subtotal)}
                      </td>

                      {/* 13. Chiết khấu giảm giá từng mặt hàng */}
                      <td className="p-3 text-right font-mono">
                        {item.itemDiscount && item.itemDiscount > 0 ? (
                          <span className="text-amber-700 font-semibold">
                            -{formatCurrency(item.itemDiscount)}
                          </span>
                        ) : (
                          <span className="text-slate-400">0 ₫</span>
                        )}
                      </td>

                      {/* 14. Thuế suất GTGT từng mặt hàng */}
                      <td className="p-3 text-center font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[11px]">
                          {item.vatRate || 0}%
                        </span>
                      </td>

                      {/* 15. Thuế GTGT từng mặt hàng */}
                      <td className="p-3 text-right font-mono text-slate-700">
                        {formatCurrency(item.vatAmount)}
                      </td>

                      {/* 16. Tổng TT từng mặt hàng */}
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.totalAmount)}
                      </td>

                      {/* Tổng thành tiền đơn hàng (Chỉ hiện dòng đầu tiên của đơn hàng) */}
                      <td className="p-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                        {isFirstRow ? (
                          formatCurrency(order.totalPreTax || order.items.reduce((s, it) => s + (it.subtotal || 0), 0))
                        ) : (
                          <span className="text-slate-200 select-none">—</span>
                        )}
                      </td>

                      {/* Chiết khấu giảm giá tổng đơn hàng (Chỉ hiện dòng đầu tiên của đơn hàng) */}
                      <td className="p-3 text-right font-mono">
                        {isFirstRow ? (
                          order.orderDiscount > 0 ? (
                            <span className="text-amber-700 font-bold">
                              -{formatCurrency(order.orderDiscount)}
                            </span>
                          ) : (
                            <span className="text-slate-400">0 ₫</span>
                          )
                        ) : (
                          <span className="text-slate-200 select-none">—</span>
                        )}
                      </td>

                      {/* Tổng thuế GTGT (Chỉ hiện dòng đầu tiên của đơn hàng) */}
                      <td className="p-3 text-right font-mono">
                        {isFirstRow ? (
                          <span className="font-semibold text-slate-800">
                            {formatCurrency(order.totalVat)}
                          </span>
                        ) : (
                          <span className="text-slate-200 select-none">—</span>
                        )}
                      </td>

                      {/* Tổng tiền thanh toán (Chỉ hiện dòng đầu tiên của đơn hàng) */}
                      <td className="p-3 text-right font-mono">
                        {isFirstRow ? (
                          <span className="font-black text-sm text-blue-900 bg-blue-50/80 px-2.5 py-1 rounded-lg inline-block border border-blue-200/60 shadow-2xs">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-200 select-none">—</span>
                        )}
                      </td>

                      {/* Tổng thành tiền theo từng thuế suất (Chỉ hiện dòng đầu tiên của đơn hàng) */}
                      <td className="p-3 text-right font-mono bg-blue-50/20">
                        {isFirstRow ? (
                          (() => {
                            const subtotalMap = new Map<number, number>();
                            order.items.forEach((it) => {
                              const r = it.vatRate || 0;
                              subtotalMap.set(r, (subtotalMap.get(r) || 0) + (it.subtotal || 0));
                            });
                            const breakdown = Array.from(subtotalMap.entries()).sort((a, b) => a[0] - b[0]);
                            return (
                              <div className="flex flex-col items-end gap-1">
                                {breakdown.map(([rate, amt]) => (
                                  <span
                                    key={rate}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-semibold whitespace-nowrap text-[11px]"
                                  >
                                    <span className="text-[10px] text-blue-700 font-bold">Thuế {rate}%:</span>
                                    <span>{formatCurrency(amt)}</span>
                                  </span>
                                ))}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-slate-200 select-none">—</span>
                        )}
                      </td>

                      {/* Tổng thuế GTGT theo từng thuế suất (Chỉ hiện dòng đầu tiên của đơn hàng) */}
                      <td className="p-3 text-right font-mono bg-amber-50/30">
                        {isFirstRow ? (
                          (() => {
                            const taxMap = new Map<number, number>();
                            order.items.forEach((it) => {
                              const r = it.vatRate || 0;
                              taxMap.set(r, (taxMap.get(r) || 0) + (it.vatAmount || 0));
                            });
                            const breakdown = Array.from(taxMap.entries()).sort((a, b) => a[0] - b[0]);
                            return (
                              <div className="flex flex-col items-end gap-1">
                                {breakdown.map(([rate, amt]) => (
                                  <span
                                    key={rate}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-semibold whitespace-nowrap text-[11px]"
                                  >
                                    <span className="text-[10px] text-amber-700 font-bold">Thuế {rate}%:</span>
                                    <span>{formatCurrency(amt)}</span>
                                  </span>
                                ))}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-slate-200 select-none">—</span>
                        )}
                      </td>

                      {/* 20. Đơn giá bán sau thuế (Cho phép sửa trực tiếp, tự động tính lại đơn giá trước thuế với 2 số thập phân) */}
                      <td className="p-3 text-right font-mono bg-amber-50/40 border-l border-amber-200">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={tempPostTaxPrice}
                              onChange={(e) => setTempPostTaxPrice(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSavePostTaxPrice(order, itemIndex);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              className="w-28 px-2 py-1 text-right font-bold text-xs bg-white border-2 border-amber-500 rounded-lg focus:outline-hidden"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePostTaxPrice(order, itemIndex)}
                              className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-md cursor-pointer"
                              title="Lưu đơn giá sau thuế"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="p-1 text-rose-700 hover:bg-rose-100 rounded-md cursor-pointer"
                              title="Hủy"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEditPostTax(order, item)}
                            className="group flex items-center justify-end gap-1.5 cursor-pointer hover:bg-amber-100/60 p-1 rounded-md transition-colors"
                            title="Bấm để sửa đơn giá bán sau thuế (đơn giá trước thuế sẽ tự động tính lại với 2 số thập phân)"
                          >
                            <span className="font-black text-amber-950">
                              {formatNumber(currentPostTaxPrice, 2)} ₫
                            </span>
                            <Edit className="w-3.5 h-3.5 text-amber-600 opacity-40 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onViewOrder(order)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer"
                            title="Xem phiếu đơn hàng"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditOrder(order)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md cursor-pointer"
                            title="Chỉnh sửa toàn bộ đơn hàng"
                          >
                            <Edit className="w-3.5 h-3.5" />
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
  );
};
