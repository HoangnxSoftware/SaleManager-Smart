import React, { useRef } from 'react';
import { Order, AppSettings } from '../../types';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { Printer, X, Download, ExternalLink } from 'lucide-react';

interface OrderPrintModalProps {
  orders: Order[];
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Builds standalone, pristine HTML for printing invoices.
 * Guaranteed to format on A4 with zero dependencies or app interference.
 */
function generateOrderPrintHtml(orders: Order[], settings: AppSettings): string {
  const pagesHtml = orders.map((order, orderIdx) => {
    const isLast = orderIdx === orders.length - 1;

    // Subtotal breakdown by VAT rate
    const subtotalMap = new Map<number, number>();
    (order.items || []).forEach((it) => {
      const r = it.vatRate || 0;
      subtotalMap.set(r, (subtotalMap.get(r) || 0) + (it.subtotal || 0));
    });

    // Tax breakdown by VAT rate
    const taxMap = new Map<number, number>();
    (order.items || []).forEach((it) => {
      const r = it.vatRate || 0;
      taxMap.set(r, (taxMap.get(r) || 0) + (it.vatAmount || 0));
    });

    const itemDiscountTotal =
      order.itemDiscountTotal !== undefined && order.itemDiscountTotal !== null
        ? order.itemDiscountTotal
        : (order.items || []).reduce((sum, it) => sum + (it.itemDiscount || 0), 0);

    const rowsHtml = (order.items || [])
      .map(
        (item, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 3px; text-align: center; color: #64748b; font-size: 11px;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 4px; font-family: monospace; font-size: 10px; word-break: break-all;">${item.productCode}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 4px; font-weight: 500; word-break: break-word; font-size: 11px; line-height: 1.35;">${item.productName}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 3px; text-align: center; white-space: nowrap; font-size: 11px;">${item.saleUnit}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 4px; text-align: right; font-weight: 500; white-space: nowrap; font-size: 11px;">${formatNumber(item.quantity)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 4px; text-align: right; font-weight: 600; color: #1e3a8a; white-space: nowrap; font-size: 11px;">${formatCurrency(item.postTaxPrice)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 4px; text-align: right; white-space: nowrap; font-size: 11px;">${formatCurrency(item.preTaxPrice)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 4px; text-align: right; font-weight: 500; white-space: nowrap; font-size: 11px;">${formatCurrency(item.subtotal || item.quantity * item.preTaxPrice)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 3px; text-align: center; white-space: nowrap; font-size: 11px;">${item.vatRate}%</td>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 4px; text-align: right; white-space: nowrap; font-size: 11px;">${formatCurrency(item.vatAmount)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 4px; text-align: right; white-space: nowrap; font-size: 11px;">${item.itemDiscount > 0 ? formatCurrency(item.itemDiscount) : '0'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4.5px 4px; text-align: right; font-weight: 700; white-space: nowrap; font-size: 11px;">${formatCurrency(item.totalAmount)}</td>
      </tr>
    `
      )
      .join('');

    const subtotalBreakdownHtml =
      subtotalMap.size > 0
        ? `
      <div style="padding-left: 8px; margin-top: 3px; border-left: 2px solid #cbd5e1; font-size: 10.5px; color: #475569;">
        ${Array.from(subtotalMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(
            ([rate, amt]) => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>• Tiền hàng thuế ${rate}%:</span>
            <span style="font-weight: 500;">${formatCurrency(amt)}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `
        : '';

    const taxBreakdownHtml =
      taxMap.size > 0
        ? `
      <div style="padding-left: 8px; margin-top: 3px; border-left: 2px solid #cbd5e1; font-size: 10.5px; color: #475569;">
        ${Array.from(taxMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(
            ([rate, amt]) => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>• Tiền thuế GTGT ${rate}%:</span>
            <span style="font-weight: 500;">${formatCurrency(amt)}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `
        : '';

    return `
      <div class="order-sheet" style="${isLast ? '' : 'page-break-after: always; break-after: page;'} margin-bottom: 28px; background: #fff;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 14px;">
          <div>
            <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 3px 0; color: #0f172a;">${settings.companyName || 'CÔNG TY'}</h2>
            <div style="font-size: 11px; color: #475569; line-height: 1.45;">
              <div><strong>Mã số thuế:</strong> ${settings.taxCode || '—'}</div>
              <div><strong>Địa chỉ:</strong> ${settings.address || '—'}</div>
              <div><strong>Điện thoại:</strong> ${settings.phone || '—'} ${settings.email ? `| <strong>Email:</strong> ${settings.email}` : ''}</div>
              ${settings.bankAccount ? `<div><strong>Số TK:</strong> ${settings.bankAccount} ${settings.bankName ? `- ${settings.bankName}` : ''}</div>` : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; padding: 3px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; font-family: monospace; font-size: 13px; font-weight: bold; color: #1e293b;">
              ${order.orderCode}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              Ngày: ${formatDate(order.orderDate)}
            </div>
          </div>
        </div>

        <!-- Title -->
        <div style="text-align: center; margin: 14px 0 16px 0;">
          <h1 style="font-size: 19px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; color: #0f172a;">HÓA ĐƠN BÁN HÀNG</h1>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">(Liên 1: Lưu nội bộ - Liên 2: Giao cho khách hàng)</div>
        </div>

        <!-- Customer info -->
        <div style="display: flex; justify-content: space-between; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 11.5px;">
          <div style="flex: 1; line-height: 1.55;">
            <div><strong>Khách hàng:</strong> ${order.customerName}</div>
            <div><strong>Mã KH:</strong> <span style="font-family: monospace; color: #1d4ed8; font-weight: bold;">${order.customerCode}</span></div>
            <div><strong>MST / CCCD:</strong> ${order.customerTaxCode || order.customerIdCard || 'Chưa cung cấp'}</div>
          </div>
          <div style="flex: 1; line-height: 1.55;">
            <div><strong>Địa chỉ giao:</strong> ${order.customerAddress || 'Tại quầy'}</div>
            <div><strong>Phương thức TT:</strong> ${order.paymentMethod === 'cash' ? 'Tiền mặt' : order.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thẻ'}</div>
            <div><strong>Ghi chú:</strong> ${order.notes || 'Không có'}</div>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 16px;">
          <colgroup>
            <col style="width: 3.5%;" />
            <col style="width: 8.5%;" />
            <col style="width: 20%;" />
            <col style="width: 5%;" />
            <col style="width: 5.5%;" />
            <col style="width: 9.5%;" />
            <col style="width: 9.5%;" />
            <col style="width: 9.5%;" />
            <col style="width: 4.5%;" />
            <col style="width: 7.5%;" />
            <col style="width: 7%;" />
            <col style="width: 10%;" />
          </colgroup>
          <thead>
            <tr style="background: #f1f5f9; color: #334155; font-size: 9.5px; font-weight: bold; text-transform: uppercase;">
              <th style="border: 1px solid #cbd5e1; padding: 5px 2px; text-align: center; vertical-align: middle;">STT</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 3px; text-align: left; vertical-align: middle;">Mã HH</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 3px; text-align: left; vertical-align: middle;">Tên HH</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 2px; text-align: center; vertical-align: middle;">ĐVT_Bán</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 3px; text-align: right; vertical-align: middle;">Số<br/>lượng</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 3px; text-align: right; vertical-align: middle;">Đơn giá bán<br/>(Sau thuế)</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 3px; text-align: right; vertical-align: middle;">Đơn giá<br/>trước thuế</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 3px; text-align: right; vertical-align: middle;">Thành<br/>tiền</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 2px; text-align: center; vertical-align: middle;">Thuế<br/>%</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 3px; text-align: right; vertical-align: middle;">Thuế<br/>GTGT</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 3px; text-align: right; vertical-align: middle;">Chiết<br/>Khấu</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 3px; text-align: right; vertical-align: middle;">Tổng tiền<br/>thanh toán</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Totals & Notes -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 20px;">
          <div style="flex: 1; font-size: 11px; color: #475569; line-height: 1.55;">
            <div><strong>Người lập đơn:</strong> ${order.createdByName}</div>
            <div><strong>Trạng thái giao:</strong> ${order.deliveryStatus === 'pending' ? 'Chờ giao' : order.deliveryStatus === 'delivering' ? 'Đang giao' : order.deliveryStatus === 'completed' ? 'Hoàn thành' : 'Đã hủy'}</div>
            <div style="margin-top: 14px; font-style: italic; color: #64748b;">Cảm ơn Quý khách đã tin tưởng và ủng hộ chúng tôi!</div>
          </div>
          <div style="flex: 1; max-width: 370px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; font-size: 11.5px;">
            <!-- 1. Tổng tiền hàng (Trước thuế): -->
            <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 3px;">
              <span>Tổng tiền hàng (Trước thuế):</span>
              <span style="font-weight: 500; color: #1e293b;">${formatCurrency(order.totalPreTax)}</span>
            </div>
            ${subtotalBreakdownHtml}

            <!-- 2. Tổng thuế GTGT: -->
            <div style="display: flex; justify-content: space-between; color: #475569; margin: 5px 0 3px 0;">
              <span>Tổng thuế GTGT:</span>
              <span style="font-weight: 500; color: #1e293b;">${formatCurrency(order.totalVat)}</span>
            </div>
            ${taxBreakdownHtml}

            <!-- 3. Chiết khấu mặt hàng: -->
            <div style="display: flex; justify-content: space-between; color: #475569; margin: 5px 0 3px 0;">
              <span>Chiết khấu mặt hàng:</span>
              <span style="${itemDiscountTotal > 0 ? 'font-weight: 500; color: #047857;' : 'color: #1e293b;'}">${itemDiscountTotal > 0 ? `-${formatCurrency(itemDiscountTotal)}` : '0 ₫'}</span>
            </div>

            <!-- 4. Chiết khấu tổng đơn: -->
            <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 5px;">
              <span>Chiết khấu tổng đơn:</span>
              <span style="${order.orderDiscount > 0 ? 'font-weight: 500; color: #047857;' : 'color: #1e293b;'}">${order.orderDiscount > 0 ? `-${formatCurrency(order.orderDiscount)}` : '0 ₫'}</span>
            </div>

            <!-- 5. Tổng tiền thanh toán: -->
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; color: #0f172a; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 5px;">
              <span>Tổng tiền thanh toán:</span>
              <span style="color: #1d4ed8;">${formatCurrency(order.totalAmount)}</span>
            </div>

            <!-- 6. Đã Thanh toán: -->
            <div style="display: flex; justify-content: space-between; color: #475569; margin-top: 4px;">
              <span>Đã Thanh toán:</span>
              <span style="font-weight: 600; color: #059669;">${formatCurrency(order.paidAmount)}</span>
            </div>

            <!-- 7. Công nợ còn lại: -->
            <div style="display: flex; justify-content: space-between; font-weight: 600; border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px; color: #475569;">
              <span>Công nợ còn lại:</span>
              <span style="${order.debtAmount > 0 ? 'font-weight: bold; color: #e11d48;' : ''}">${formatCurrency(order.debtAmount)}</span>
            </div>
          </div>
        </div>

        <!-- Signatures -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; font-size: 11px; margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
          <div>
            <div style="font-weight: bold; color: #1e293b;">Người mua hàng</div>
            <div style="font-size: 10px; color: #94a3b8; font-style: italic;">(Ký, ghi rõ họ tên)</div>
            <div style="height: 50px;"></div>
          </div>
          <div>
            <div style="font-weight: bold; color: #1e293b;">Thủ kho / Giao hàng</div>
            <div style="font-size: 10px; color: #94a3b8; font-style: italic;">(Ký, ghi rõ họ tên)</div>
            <div style="height: 50px;"></div>
          </div>
          <div>
            <div style="font-weight: bold; color: #1e293b;">Người bán hàng</div>
            <div style="font-size: 10px; color: #94a3b8; font-style: italic;">(Ký, ghi rõ họ tên)</div>
            <div style="height: 50px;"></div>
            <div style="font-weight: 600; color: #334155;">${order.createdByName}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Bản In Hóa Đơn - ${orders.map((o) => o.orderCode).join(', ')}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Calibri', 'Carlito', Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11.5px;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 4px;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

export const OrderPrintModal: React.FC<OrderPrintModalProps> = ({
  orders,
  settings,
  isOpen,
  onClose,
}) => {
  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen || orders.length === 0) return null;

  /**
   * Primary Print Handler:
   * Uses an isolated hidden iframe so ONLY the invoices are printed,
   * without background dashboard, overlay, navbars, or height cutoffs.
   * If iframe print is blocked by browser sandbox, gracefully falls back to window.print().
   */
  const handlePrint = () => {
    try {
      const htmlContent = generateOrderPrintHtml(orders, settings);

      const iframe = document.createElement('iframe');
      iframe.name = `print_frame_${Date.now()}`;
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(htmlContent);
        frameDoc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.warn('Iframe print failed or blocked, falling back to window.print():', e);
            window.print();
          } finally {
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 3000);
          }
        }, 300);
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Print initialization error, falling back to window.print():', err);
      window.print();
    }
  };

  /**
   * Secondary Option: Open in new tab for direct browser print
   */
  const handleOpenNewTab = () => {
    try {
      const htmlContent = generateOrderPrintHtml(orders, settings);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const newWin = window.open(blobUrl, '_blank');
      if (newWin) {
        newWin.onload = () => {
          setTimeout(() => {
            newWin.print();
          }, 350);
        };
      }
    } catch (e) {
      console.warn('Could not open new window, triggering print:', e);
      handlePrint();
    }
  };

  return (
    <div className="order-print-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="order-print-container relative w-full max-w-5xl xl:max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none">
        {/* Modal Controls - hidden in print */}
        <div className="print:hidden flex flex-wrap items-center justify-between p-4 bg-slate-800 text-white border-b border-slate-700 gap-2">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-base">
              Xem trước in hóa đơn ({orders.length} đơn hàng đã chọn)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenNewTab}
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer"
              title="Mở bản in toàn màn hình trong thẻ mới"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Mở tab in riêng</span>
            </button>
            <button
              onClick={handlePrint}
              type="button"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In ngay (Print)</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Pages Screen Preview */}
        <div
          ref={printContainerRef}
          id="printable-order-pages"
          className="order-print-scroll p-6 sm:p-10 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 space-y-12"
        >
          {orders.map((order) => {
            const itemDiscountTotal =
              order.itemDiscountTotal !== undefined && order.itemDiscountTotal !== null
                ? order.itemDiscountTotal
                : (order.items || []).reduce((sum, it) => sum + (it.itemDiscount || 0), 0);

            return (
              <div
                key={order.id}
                className="order-sheet print:break-after-page border border-slate-200 p-8 rounded-xl shadow-xs print:border-none print:p-0 print:shadow-none bg-white"
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
                      <span className="font-semibold">Điện thoại:</span> {settings.phone} |{' '}
                      <span className="font-semibold">Email:</span> {settings.email}
                    </p>
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold">Số TK:</span> {settings.bankAccount} -{' '}
                      {settings.bankName}
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
                      <span className="font-bold text-slate-900">Khách hàng:</span>{' '}
                      {order.customerName}
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
                      <span className="font-bold text-slate-900">Địa chỉ giao:</span>{' '}
                      {order.customerAddress || 'Tại quầy'}
                    </p>
                    <p className="text-slate-700 mt-1">
                      <span className="font-bold text-slate-900">Phương thức TT:</span>{' '}
                      {order.paymentMethod === 'cash'
                        ? 'Tiền mặt'
                        : order.paymentMethod === 'transfer'
                        ? 'Chuyển khoản'
                        : 'Thẻ'}
                    </p>
                    <p className="text-slate-700 mt-1">
                      <span className="font-bold text-slate-900">Ghi chú:</span>{' '}
                      {order.notes || 'Không có'}
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto print:overflow-visible mb-6">
                  <table className="w-full text-xs text-left border-collapse border border-slate-300 table-fixed">
                    <colgroup>
                      <col className="w-[3.5%]" />
                      <col className="w-[8.5%]" />
                      <col className="w-[20%]" />
                      <col className="w-[5%]" />
                      <col className="w-[5.5%]" />
                      <col className="w-[9.5%]" />
                      <col className="w-[9.5%]" />
                      <col className="w-[9.5%]" />
                      <col className="w-[4.5%]" />
                      <col className="w-[7.5%]" />
                      <col className="w-[7%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10.5px] print:text-[9px] leading-tight">
                      <tr>
                        <th className="border border-slate-300 px-1 py-1.5 text-center align-middle whitespace-normal break-words">
                          STT
                        </th>
                        <th className="border border-slate-300 px-1.5 py-1.5 text-left align-middle whitespace-normal break-words">
                          Mã HH
                        </th>
                        <th className="border border-slate-300 px-1.5 py-1.5 text-left align-middle whitespace-normal break-words">
                          Tên HH
                        </th>
                        <th className="border border-slate-300 px-1.5 py-1.5 text-center align-middle whitespace-normal break-words">
                          ĐVT_Bán
                        </th>
                        <th className="border border-slate-300 px-1.5 py-1.5 text-right align-middle whitespace-normal break-words">
                          Số<br />lượng
                        </th>
                        <th className="border border-slate-300 px-1.5 py-1.5 text-right align-middle whitespace-normal break-words">
                          Đơn giá bán<br />(Sau thuế)
                        </th>
                        <th className="border border-slate-300 px-1.5 py-1.5 text-right align-middle whitespace-normal break-words">
                          Đơn giá<br />trước thuế
                        </th>
                        <th className="border border-slate-300 px-1.5 py-1.5 text-right align-middle whitespace-normal break-words">
                          Thành<br />tiền
                        </th>
                        <th className="border border-slate-300 px-1.5 py-1.5 text-center align-middle whitespace-normal break-words">
                          Thuế<br />%
                        </th>
                        <th className="border border-slate-300 px-1.5 py-1.5 text-right align-middle whitespace-normal break-words">
                          Thuế<br />GTGT
                        </th>
                        <th className="border border-slate-300 px-1.5 py-1.5 text-right align-middle whitespace-normal break-words">
                          Chiết<br />Khấu
                        </th>
                        <th className="border border-slate-300 px-1.5 py-1.5 text-right align-middle whitespace-normal break-words">
                          Tổng tiền<br />thanh toán
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, idx) => (
                        <tr key={item.id} className="text-slate-800 align-top">
                          <td className="border border-slate-300 px-1 py-1 text-center text-slate-500 font-medium whitespace-nowrap text-[11px] print:text-[9.5px]">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 font-mono text-[10px] print:text-[8.5px] break-all leading-tight">
                            {item.productCode}
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 font-medium break-words leading-snug text-[11px] print:text-[9.5px]">
                            {item.productName}
                          </td>
                          <td className="border border-slate-300 px-1 py-1 text-center whitespace-nowrap text-[11px] print:text-[9.5px]">
                            {item.saleUnit}
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap text-[11px] print:text-[9.5px]">
                            {formatNumber(item.quantity)}
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 text-right font-semibold text-blue-900 tabular-nums whitespace-nowrap text-[11px] print:text-[9.5px]">
                            {formatCurrency(item.postTaxPrice)}
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums whitespace-nowrap text-[11px] print:text-[9.5px]">
                            {formatCurrency(item.preTaxPrice)}
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap text-[11px] print:text-[9.5px]">
                            {formatCurrency(item.subtotal || item.quantity * item.preTaxPrice)}
                          </td>
                          <td className="border border-slate-300 px-1 py-1 text-center tabular-nums whitespace-nowrap text-[11px] print:text-[9.5px]">
                            {item.vatRate}%
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums whitespace-nowrap text-[11px] print:text-[9.5px]">
                            {formatCurrency(item.vatAmount)}
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums whitespace-nowrap text-[11px] print:text-[9.5px]">
                            {item.itemDiscount > 0 ? formatCurrency(item.itemDiscount) : '0'}
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap text-[11px] print:text-[9.5px]">
                            {formatCurrency(item.totalAmount)}
                          </td>
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
                    {/* 1. Tổng tiền hàng (Trước thuế): */}
                    <div className="flex justify-between text-slate-600">
                      <span>Tổng tiền hàng (Trước thuế):</span>
                      <span className="font-medium text-slate-800">
                        {formatCurrency(order.totalPreTax)}
                      </span>
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
                          {Array.from(subtotalMap.entries())
                            .sort((a, b) => a[0] - b[0])
                            .map(([rate, amt]) => (
                              <div key={rate} className="flex justify-between">
                                <span>• Tiền hàng thuế {rate}%:</span>
                                <span className="font-medium text-slate-800">
                                  {formatCurrency(amt)}
                                </span>
                              </div>
                            ))}
                        </div>
                      );
                    })()}

                    {/* 2. Tổng thuế GTGT: */}
                    <div className="flex justify-between text-slate-600">
                      <span>Tổng thuế GTGT:</span>
                      <span className="font-medium text-slate-800">
                        {formatCurrency(order.totalVat)}
                      </span>
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
                          {Array.from(taxMap.entries())
                            .sort((a, b) => a[0] - b[0])
                            .map(([rate, amt]) => (
                              <div key={rate} className="flex justify-between">
                                <span>• Tiền thuế GTGT {rate}%:</span>
                                <span className="font-medium text-slate-800">
                                  {formatCurrency(amt)}
                                </span>
                              </div>
                            ))}
                        </div>
                      );
                    })()}

                    {/* 3. Chiết khấu mặt hàng: */}
                    <div className="flex justify-between text-slate-600">
                      <span>Chiết khấu mặt hàng:</span>
                      <span
                        className={
                          itemDiscountTotal > 0
                            ? 'font-medium text-emerald-700'
                            : 'text-slate-800'
                        }
                      >
                        {itemDiscountTotal > 0 ? `-${formatCurrency(itemDiscountTotal)}` : '0 ₫'}
                      </span>
                    </div>

                    {/* 4. Chiết khấu tổng đơn: */}
                    <div className="flex justify-between text-slate-600">
                      <span>Chiết khấu tổng đơn:</span>
                      <span
                        className={
                          order.orderDiscount > 0
                            ? 'font-medium text-emerald-700'
                            : 'text-slate-800'
                        }
                      >
                        {order.orderDiscount > 0
                          ? `-${formatCurrency(order.orderDiscount)}`
                          : '0 ₫'}
                      </span>
                    </div>

                    {/* 5. Tổng tiền thanh toán: */}
                    <div className="flex justify-between font-bold text-sm sm:text-base text-slate-900 border-t border-slate-300 pt-2">
                      <span>Tổng tiền thanh toán:</span>
                      <span className="text-blue-700">{formatCurrency(order.totalAmount)}</span>
                    </div>

                    {/* 6. Đã Thanh toán: */}
                    <div className="flex justify-between text-slate-700 pt-1">
                      <span>Đã Thanh toán:</span>
                      <span className="font-semibold text-emerald-600">
                        {formatCurrency(order.paidAmount)}
                      </span>
                    </div>

                    {/* 7. Công nợ còn lại: */}
                    <div className="flex justify-between text-slate-700 font-semibold border-t border-slate-200 pt-1">
                      <span>Công nợ còn lại:</span>
                      <span
                        className={
                          order.debtAmount > 0 ? 'text-rose-600 font-bold' : 'text-slate-600'
                        }
                      >
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
            );
          })}
        </div>
      </div>
    </div>
  );
};
