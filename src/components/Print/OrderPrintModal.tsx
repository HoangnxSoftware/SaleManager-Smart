import React, { useEffect, useRef, useState } from 'react';
import { Order, OrderItem, AppSettings, SalesInvoicePrintSettings } from '../../types';
import { formatCurrency, formatCurrencyInWords, formatDate, formatNumber, formatPaymentMethod } from '../../utils/formatters';
import {
  getEffectivePrintSettings,
  getQrPixelSize,
  generateOrderQrMap,
} from '../../utils/qrPrintUtils';
import { Printer, X, ExternalLink } from 'lucide-react';

interface OrderPrintModalProps {
  orders: Order[];
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
}

interface PrintColumnDef {
  key: string;
  labelHtml: string;
  align: 'left' | 'center' | 'right';
  isFluid?: boolean;
}

function getActiveColumns(cfg: SalesInvoicePrintSettings): PrintColumnDef[] {
  const cols: PrintColumnDef[] = [];
  if (cfg.showColStt) {
    cols.push({ key: 'stt', labelHtml: 'STT', align: 'center' });
  }
  if (cfg.showColProductCode) {
    cols.push({ key: 'productCode', labelHtml: 'Mã HH', align: 'left' });
  }
  // Core: Tên hàng hóa (takes all remaining fluid space)
  cols.push({ key: 'productName', labelHtml: 'Tên hàng hóa', align: 'left', isFluid: true });
  if (cfg.showColUnit) {
    cols.push({ key: 'saleUnit', labelHtml: 'ĐVT', align: 'center' });
  }
  // Core: Số lượng
  cols.push({ key: 'quantity', labelHtml: 'SL', align: 'right' });
  if (cfg.showColPostTaxPrice) {
    cols.push({
      key: 'postTaxPrice',
      labelHtml: 'Đơn giá<br/>(Sau thuế)',
      align: 'right',
    });
  }
  if (cfg.showColPreTaxPrice) {
    cols.push({
      key: 'preTaxPrice',
      labelHtml: 'Đơn giá<br/>(Trước thuế)',
      align: 'right',
    });
  }
  if (cfg.showColSubtotal) {
    cols.push({
      key: 'subtotal',
      labelHtml: 'Thành tiền<br/>(Trước thuế)',
      align: 'right',
    });
  }
  if (cfg.showColVatRate) {
    cols.push({ key: 'vatRate', labelHtml: 'VAT<br/>(%)', align: 'center' });
  }
  if (cfg.showColVatAmount) {
    cols.push({ key: 'vatAmount', labelHtml: 'Tiền thuế<br/>GTGT', align: 'right' });
  }
  if (cfg.showColItemDiscount) {
    cols.push({ key: 'itemDiscount', labelHtml: 'Chiết<br/>khấu', align: 'right' });
  }
  // Core: Thành tiền thanh toán
  cols.push({
    key: 'totalAmount',
    labelHtml: 'Thành tiền<br/>thanh toán',
    align: 'right',
  });

  return cols;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatUnitPriceDisplay(val: number, decimals?: number): string {
  const dec = decimals !== undefined && decimals > 0 ? decimals : 0;
  return `${formatNumber(val, dec)} ₫`;
}

function renderCellHtml(colKey: string, item: OrderItem, idx: number, settings: AppSettings): string {
  const preTaxDec = settings.salePriceDecimals ?? 2;
  const postTaxDec = settings.postTaxSalePriceDecimals && settings.postTaxSalePriceDecimals > 0 ? settings.postTaxSalePriceDecimals : 0;

  switch (colKey) {
    case 'stt':
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 5px; text-align: center; color: #475569; font-weight: 600; white-space: nowrap; width: 1%;">${idx + 1}</td>`;
    case 'productCode':
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 6px; font-variant-numeric: tabular-nums; font-size: 10px; color: #334155; white-space: nowrap; width: 1%;">${escapeHtml(item.productCode)}</td>`;
    case 'productName':
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #0f172a; word-break: break-word; line-height: 1.4; min-width: 150px;">${escapeHtml(item.productName)}</td>`;
    case 'saleUnit':
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 5px; text-align: center; color: #334155; white-space: nowrap; width: 1%;">${escapeHtml(item.saleUnit)}</td>`;
    case 'quantity':
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; white-space: nowrap; width: 1%;">${formatNumber(item.quantity)}</td>`;
    case 'postTaxPrice':
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; font-weight: 600; color: #1e3a8a; font-variant-numeric: tabular-nums; white-space: nowrap; width: 1%;">${formatUnitPriceDisplay(item.postTaxPrice, postTaxDec)}</td>`;
    case 'preTaxPrice':
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; color: #334155; font-variant-numeric: tabular-nums; white-space: nowrap; width: 1%;">${formatUnitPriceDisplay(item.preTaxPrice, preTaxDec)}</td>`;
    case 'subtotal':
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; font-weight: 500; color: #1e293b; font-variant-numeric: tabular-nums; white-space: nowrap; width: 1%;">${formatCurrency(item.subtotal || item.quantity * item.preTaxPrice)}</td>`;
    case 'vatRate':
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 5px; text-align: center; color: #334155; font-variant-numeric: tabular-nums; white-space: nowrap; width: 1%;">${item.vatRate}%</td>`;
    case 'vatAmount':
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; color: #334155; font-variant-numeric: tabular-nums; white-space: nowrap; width: 1%;">${formatCurrency(item.vatAmount)}</td>`;
    case 'itemDiscount':
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; color: ${item.itemDiscount > 0 ? '#047857' : '#64748b'}; font-variant-numeric: tabular-nums; white-space: nowrap; width: 1%;">${item.itemDiscount > 0 ? `-${formatCurrency(item.itemDiscount)}` : '0 ₫'}</td>`;
    case 'totalAmount':
    default:
      return `<td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; white-space: nowrap; width: 1%;">${formatCurrency(item.totalAmount)}</td>`;
  }
}

/**
 * Builds standalone, pristine HTML for printing invoices.
 * Guaranteed to format on A4 with zero dependencies or app interference.
 */
function generateOrderPrintHtml(
  orders: Order[],
  settings: AppSettings,
  qrMap: Record<string, { dataUrl: string; subLabel: string }>
): string {
  const cfg = getEffectivePrintSettings(settings);
  const activeCols = getActiveColumns(cfg);
  const qrPx = getQrPixelSize(cfg.qrSize);

  const pagesHtml = orders
    .map((order, orderIdx) => {
      const isLast = orderIdx === orders.length - 1;
      const qrInfo = qrMap[order.id];

      const subtotalMap = new Map<number, number>();
      (order.items || []).forEach((it) => {
        const r = it.vatRate || 0;
        subtotalMap.set(r, (subtotalMap.get(r) || 0) + (it.subtotal || 0));
      });

      const taxMap = new Map<number, number>();
      (order.items || []).forEach((it) => {
        const r = it.vatRate || 0;
        taxMap.set(r, (taxMap.get(r) || 0) + (it.vatAmount || 0));
      });

      const itemDiscountTotal =
        order.itemDiscountTotal !== undefined && order.itemDiscountTotal !== null
          ? order.itemDiscountTotal
          : (order.items || []).reduce((sum, it) => sum + (it.itemDiscount || 0), 0);

      const hasCompanyBlock =
        cfg.showCompanyName ||
        cfg.showCompanyTaxCode ||
        cfg.showCompanyAddress ||
        cfg.showCompanyContact ||
        cfg.showCompanyBank;

      const hasHeaderQr = cfg.showQrCode && cfg.qrPosition === 'header_right' && Boolean(qrInfo?.dataUrl);
      const hasFooterQr = cfg.showQrCode && cfg.qrPosition === 'footer_left' && Boolean(qrInfo?.dataUrl);
      const hasRightHeader = cfg.showOrderCodeAndDate || hasHeaderQr;

      const headerQrHtml = hasHeaderQr
        ? `
          <div style="margin-top: 8px; display: inline-flex; flex-direction: column; align-items: center; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; background: #ffffff;">
            <img src="${qrInfo.dataUrl}" width="${qrPx}" height="${qrPx}" alt="QR" style="display: block;" />
            ${cfg.qrCaption ? `<div style="font-size: 9.5px; font-weight: 700; color: #1e293b; margin-top: 3px; text-align: center; max-width: ${qrPx + 24}px;">${escapeHtml(cfg.qrCaption)}</div>` : ''}
            ${qrInfo.subLabel ? `<div style="font-size: 9px; color: #475569; font-variant-numeric: tabular-nums; text-align: center;">${escapeHtml(qrInfo.subLabel)}</div>` : ''}
          </div>
        `
        : '';

      const footerQrHtml = hasFooterQr
        ? `
          <div style="margin-top: 12px; display: inline-flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc;">
            <img src="${qrInfo.dataUrl}" width="${qrPx}" height="${qrPx}" alt="QR" style="display: block; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px;" />
            <div style="font-size: 10.5px; color: #334155; line-height: 1.45;">
              ${cfg.qrCaption ? `<div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${escapeHtml(cfg.qrCaption)}</div>` : ''}
              ${qrInfo.subLabel ? `<div style="font-variant-numeric: tabular-nums; font-weight: 600;">${escapeHtml(qrInfo.subLabel)}</div>` : ''}
              ${cfg.qrMode === 'vietqr' && settings.bankAccount ? `<div style="font-size: 10px; color: #64748b;">Nội dung CK: TT ${escapeHtml(order.orderCode)}</div>` : ''}
            </div>
          </div>
        `
        : '';

      const customerLeftLines: string[] = [];
      if (cfg.showCustomerName) {
        customerLeftLines.push(`<div><strong>Khách hàng:</strong> ${escapeHtml(order.customerName)}</div>`);
      }
      if (cfg.showCustomerCode) {
        customerLeftLines.push(
          `<div><strong>Mã KH:</strong> <span style="font-variant-numeric: tabular-nums; color: #1d4ed8; font-weight: bold;">${escapeHtml(order.customerCode)}</span></div>`
        );
      }
      if (cfg.showCustomerTaxOrId) {
        customerLeftLines.push(
          `<div><strong>MST / CCCD:</strong> ${escapeHtml(order.customerTaxCode || order.customerIdCard || 'Chưa cung cấp')}</div>`
        );
      }

      const customerRightLines: string[] = [];
      if (cfg.showCustomerAddress) {
        customerRightLines.push(
          `<div><strong>Địa chỉ giao:</strong> ${escapeHtml(order.customerAddress || 'Tại quầy')}</div>`
        );
      }
      if (cfg.showPaymentMethod) {
        customerRightLines.push(
          `<div><strong>Phương thức TT:</strong> ${escapeHtml(formatPaymentMethod(order.paymentMethod))}</div>`
        );
      }
      if (cfg.showOrderNotes) {
        customerRightLines.push(`<div><strong>Ghi chú:</strong> ${escapeHtml(order.notes || 'Không có')}</div>`);
      }

      const hasCustomerBox = customerLeftLines.length > 0 || customerRightLines.length > 0;

      const totalItemsAmount = (order.items || []).reduce((sum, it) => sum + (it.totalAmount || 0), 0);
      const tableFontSize = activeCols.length >= 10 ? '10px' : '11px';

      const rowsHtml = (order.items || [])
        .map(
          (item, idx) =>
            `<tr style="background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'}; vertical-align: middle;">${activeCols.map((col) => renderCellHtml(col.key, item, idx, settings)).join('')}</tr>`
        )
        .join('');

      const leadingColSpan = Math.max(1, activeCols.length - 1);
      const footerCellsHtml = `
        <td colspan="${leadingColSpan}" style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-weight: 700; color: #0f172a;">
          Tổng cộng (${(order.items || []).length} mặt hàng):
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; font-weight: 800; color: #1d4ed8; font-variant-numeric: tabular-nums; white-space: nowrap;">
          ${formatCurrency(totalItemsAmount)}
        </td>
      `;

      const subtotalBreakdownHtml =
        subtotalMap.size > 0
          ? `
        <div style="padding-left: 8px; margin-top: 3px; border-left: 1px solid #cbd5e1; font-size: 10.5px; color: #475569;">
          ${Array.from(subtotalMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(
              ([rate, amt]) => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>• Tiền hàng thuế ${rate}%:</span>
              <span style="font-weight: 500; font-variant-numeric: tabular-nums;">${formatCurrency(amt)}</span>
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
        <div style="padding-left: 8px; margin-top: 3px; border-left: 1px solid #cbd5e1; font-size: 10.5px; color: #475569;">
          ${Array.from(taxMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(
              ([rate, amt]) => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>• Tiền thuế GTGT ${rate}%:</span>
              <span style="font-weight: 500; font-variant-numeric: tabular-nums;">${formatCurrency(amt)}</span>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : '';

      return `
      <div class="order-sheet" style="${isLast ? '' : 'page-break-after: always; break-after: page;'} margin-bottom: 28px; background: #fff;">
        ${
          hasCompanyBlock || hasRightHeader
            ? `
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 14px;">
          <div>
            ${cfg.showCompanyName ? `<h2 style="font-size: 16px; font-weight: bold; margin: 0 0 3px 0; color: #0f172a;">${escapeHtml(settings.companyName || 'CÔNG TY')}</h2>` : ''}
            <div style="font-size: 11px; color: #475569; line-height: 1.45;">
              ${cfg.showCompanyTaxCode ? `<div><strong>Mã số thuế:</strong> ${escapeHtml(settings.taxCode || '—')}</div>` : ''}
              ${cfg.showCompanyAddress ? `<div><strong>Địa chỉ:</strong> ${escapeHtml(settings.address || '—')}</div>` : ''}
              ${cfg.showCompanyContact ? `<div><strong>Điện thoại:</strong> ${escapeHtml(settings.phone || '—')} ${settings.email ? `| <strong>Email:</strong> ${escapeHtml(settings.email)}` : ''}</div>` : ''}
              ${cfg.showCompanyBank && settings.bankAccount ? `<div><strong>Số TK:</strong> ${escapeHtml(settings.bankAccount)} ${settings.bankName ? `- ${escapeHtml(settings.bankName)}` : ''}</div>` : ''}
            </div>
          </div>
          ${
            hasRightHeader
              ? `<div style="text-align: right; flex-shrink: 0;">
                  ${
                    cfg.showOrderCodeAndDate
                      ? `<div style="display: inline-block; padding: 3px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; font-variant-numeric: tabular-nums; font-size: 13px; font-weight: bold; color: #1e293b;">
                          ${escapeHtml(order.orderCode)}
                        </div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                          Ngày: ${formatDate(order.orderDate)}
                        </div>`
                      : ''
                  }
                  ${headerQrHtml}
                </div>`
              : ''
          }
        </div>`
            : ''
        }

        <!-- Title -->
        <div style="text-align: center; margin: 12px 0 14px 0;">
          <h1 style="font-family: 'Plus Jakarta Sans', 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 19px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; color: #0f172a;">${escapeHtml(cfg.invoiceTitle || 'HÓA ĐƠN BÁN HÀNG')}</h1>
          ${cfg.showInvoiceSubtitle && cfg.invoiceSubtitle ? `<div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">${escapeHtml(cfg.invoiceSubtitle)}</div>` : ''}
        </div>

        ${
          hasCustomerBox
            ? `
        <!-- Customer info -->
        <div style="display: flex; justify-content: space-between; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 11.5px;">
          ${customerLeftLines.length > 0 ? `<div style="flex: 1; line-height: 1.55;">${customerLeftLines.join('')}</div>` : ''}
          ${customerRightLines.length > 0 ? `<div style="flex: 1; line-height: 1.55;">${customerRightLines.join('')}</div>` : ''}
        </div>`
            : ''
        }

        <!-- Table -->
        <div style="font-size: 11px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px;">
          Chi tiết hàng hóa (${(order.items || []).length} mặt hàng)
        </div>
        <table style="width: 100%; border-collapse: collapse; table-layout: auto; margin-bottom: 14px; font-size: ${tableFontSize};">
          <thead>
            <tr style="background: #e2e8f0; color: #0f172a; font-size: ${activeCols.length >= 10 ? '9px' : '10px'}; font-weight: 700; text-transform: uppercase; line-height: 1.25;">
              ${activeCols
                .map(
                  (c) =>
                    `<th style="border: 1px solid #94a3b8; padding: 6px 5px; text-align: ${c.align}; vertical-align: middle; ${c.isFluid ? 'min-width: 150px;' : 'white-space: nowrap; width: 1%;'}">${c.labelHtml}</th>`
                )
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9;">
              ${footerCellsHtml}
            </tr>
          </tfoot>
        </table>

        <!-- Totals & Notes & Footer QR -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 18px;">
          <div style="flex: 1; font-size: 11px; color: #475569; line-height: 1.55;">
            ${
              cfg.showCreatorAndStatus
                ? `<div><strong>Người lập đơn:</strong> ${escapeHtml(order.createdByName)}</div>
                   <div><strong>Trạng thái giao:</strong> ${order.deliveryStatus === 'pending' ? 'Chờ giao' : order.deliveryStatus === 'delivering' ? 'Đang giao' : order.deliveryStatus === 'completed' ? 'Hoàn thành' : 'Đã hủy'}</div>`
                : ''
            }
            ${
              cfg.showThankYouNote && cfg.thankYouNote
                ? `<div style="margin-top: 10px; font-style: italic; color: #64748b;">${escapeHtml(cfg.thankYouNote)}</div>`
                : ''
            }
            ${footerQrHtml}
          </div>
          <div style="flex: 1; max-width: 370px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; font-size: 11.5px;">
            ${
              cfg.showSummaryPreTax
                ? `<div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 3px;">
                    <span>Tổng tiền hàng (Trước thuế):</span>
                    <span style="font-weight: 500; color: #1e293b; font-variant-numeric: tabular-nums;">${formatCurrency(order.totalPreTax)}</span>
                  </div>
                  ${subtotalBreakdownHtml}`
                : ''
            }

            ${
              cfg.showSummaryVat
                ? `<div style="display: flex; justify-content: space-between; color: #475569; margin: 5px 0 3px 0;">
                    <span>Tổng thuế GTGT:</span>
                    <span style="font-weight: 500; color: #1e293b; font-variant-numeric: tabular-nums;">${formatCurrency(order.totalVat)}</span>
                  </div>
                  ${taxBreakdownHtml}`
                : ''
            }

            ${
              cfg.showSummaryDiscount
                ? `<div style="display: flex; justify-content: space-between; color: #475569; margin: 5px 0 3px 0;">
                    <span>Chiết khấu mặt hàng:</span>
                    <span style="font-variant-numeric: tabular-nums; ${itemDiscountTotal > 0 ? 'font-weight: 500; color: #047857;' : 'color: #1e293b;'}">${itemDiscountTotal > 0 ? `-${formatCurrency(itemDiscountTotal)}` : '0 ₫'}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 5px;">
                    <span>Chiết khấu tổng đơn:</span>
                    <span style="font-variant-numeric: tabular-nums; ${order.orderDiscount > 0 ? 'font-weight: 500; color: #047857;' : 'color: #1e293b;'}">${order.orderDiscount > 0 ? `-${formatCurrency(order.orderDiscount)}` : '0 ₫'}</span>
                  </div>`
                : ''
            }

            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; color: #0f172a; ${cfg.showSummaryPreTax || cfg.showSummaryVat || cfg.showSummaryDiscount ? 'border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 5px;' : ''}">
              <span>Tổng tiền thanh toán:</span>
              <span style="color: #1d4ed8; font-variant-numeric: tabular-nums;">${formatCurrency(order.totalAmount)}</span>
            </div>

            ${
              cfg.showSummaryPaidAndDebt
                ? `<div style="display: flex; justify-content: space-between; color: #475569; margin-top: 4px;">
                    <span>Đã Thanh toán:</span>
                    <span style="font-weight: 600; color: #059669; font-variant-numeric: tabular-nums;">${formatCurrency(order.paidAmount)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-weight: 600; border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px; color: #475569;">
                    <span>Công nợ còn lại:</span>
                    <span style="font-variant-numeric: tabular-nums; ${order.debtAmount > 0 ? 'font-weight: bold; color: #e11d48;' : ''}">${formatCurrency(order.debtAmount)}</span>
                  </div>`
                : ''
            }
          </div>
        </div>

        ${
          cfg.showAmountInWords
            ? `<div style="margin-bottom: 14px; padding: 7px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11.5px; color: #1e293b;">
                <strong>Số tiền viết bằng chữ:</strong> <span style="font-style: italic; font-weight: 600; color: #0f172a;">${escapeHtml(formatCurrencyInWords(order.totalAmount))}.</span>
              </div>`
            : ''
        }

        ${
          cfg.showSignatures
            ? `
        <!-- Signatures -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; font-size: 11px; margin-top: 22px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
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
            <div style="font-weight: 600; color: #334155;">${escapeHtml(order.createdByName)}</div>
          </div>
        </div>`
            : ''
        }
      </div>
    `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Bản In Hóa Đơn - ${escapeHtml(orders.map((o) => o.orderCode).join(', '))}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Inter', 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    h1, h2, h3 {
      font-family: 'Plus Jakarta Sans', 'Inter', 'Segoe UI', Arial, sans-serif;
    }
    body {
      font-family: 'Inter', 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif;
      font-size: 11.5px;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
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
  const [qrMap, setQrMap] = useState<Record<string, { dataUrl: string; subLabel: string }>>({});

  const printCfg = getEffectivePrintSettings(settings);
  const activeCols = getActiveColumns(printCfg);
  const qrPx = getQrPixelSize(printCfg.qrSize);

  useEffect(() => {
    if (!isOpen || orders.length === 0 || !printCfg.showQrCode) {
      setQrMap({});
      return;
    }
    let cancelled = false;
    generateOrderQrMap(orders, settings)
      .then((map) => {
        if (!cancelled) setQrMap(map);
      })
      .catch(() => {
        if (!cancelled) setQrMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, orders, settings, printCfg.showQrCode]);

  if (!isOpen || orders.length === 0) return null;

  const ensureQrMap = async () => {
    if (!printCfg.showQrCode) return {};
    if (Object.keys(qrMap).length === orders.length) return qrMap;
    return generateOrderQrMap(orders, settings);
  };

  /**
   * Primary Print Handler:
   * Uses an isolated hidden iframe so ONLY the invoices are printed.
   */
  const handlePrint = async () => {
    try {
      const resolvedQrMap = await ensureQrMap();
      const htmlContent = generateOrderPrintHtml(orders, settings, resolvedQrMap);

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
  const handleOpenNewTab = async () => {
    try {
      const resolvedQrMap = await ensureQrMap();
      const htmlContent = generateOrderPrintHtml(orders, settings, resolvedQrMap);
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

  const renderReactCell = (colKey: string, item: OrderItem, idx: number) => {
    const preTaxDec = settings.salePriceDecimals ?? 2;
    const postTaxDec =
      settings.postTaxSalePriceDecimals && settings.postTaxSalePriceDecimals > 0
        ? settings.postTaxSalePriceDecimals
        : 0;

    switch (colKey) {
      case 'stt':
        return (
          <td
            key={colKey}
            className="border border-slate-300 px-2 py-2 text-center text-slate-600 font-semibold whitespace-nowrap w-[1%]"
          >
            {idx + 1}
          </td>
        );
      case 'productCode':
        return (
          <td
            key={colKey}
            className="border border-slate-300 px-2 py-2 font-mono tabular-nums text-[10.5px] print:text-[9px] text-slate-700 whitespace-nowrap w-[1%]"
          >
            {item.productCode}
          </td>
        );
      case 'productName':
        return (
          <td
            key={colKey}
            className="border border-slate-300 px-2.5 py-2 font-semibold text-slate-900 break-words leading-snug min-w-[160px]"
          >
            {item.productName}
          </td>
        );
      case 'saleUnit':
        return (
          <td
            key={colKey}
            className="border border-slate-300 px-2 py-2 text-center text-slate-700 whitespace-nowrap w-[1%]"
          >
            {item.saleUnit}
          </td>
        );
      case 'quantity':
        return (
          <td
            key={colKey}
            className="border border-slate-300 px-2 py-2 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap w-[1%]"
          >
            {formatNumber(item.quantity)}
          </td>
        );
      case 'postTaxPrice':
        return (
          <td
            key={colKey}
            className="border border-slate-300 px-2 py-2 text-right font-semibold text-blue-900 tabular-nums whitespace-nowrap w-[1%]"
          >
            {formatUnitPriceDisplay(item.postTaxPrice, postTaxDec)}
          </td>
        );
      case 'preTaxPrice':
        return (
          <td
            key={colKey}
            className="border border-slate-300 px-2 py-2 text-right text-slate-700 tabular-nums whitespace-nowrap w-[1%]"
          >
            {formatUnitPriceDisplay(item.preTaxPrice, preTaxDec)}
          </td>
        );
      case 'subtotal':
        return (
          <td
            key={colKey}
            className="border border-slate-300 px-2 py-2 text-right font-medium text-slate-800 tabular-nums whitespace-nowrap w-[1%]"
          >
            {formatCurrency(item.subtotal || item.quantity * item.preTaxPrice)}
          </td>
        );
      case 'vatRate':
        return (
          <td
            key={colKey}
            className="border border-slate-300 px-2 py-2 text-center text-slate-700 tabular-nums whitespace-nowrap w-[1%]"
          >
            {item.vatRate}%
          </td>
        );
      case 'vatAmount':
        return (
          <td
            key={colKey}
            className="border border-slate-300 px-2 py-2 text-right text-slate-700 tabular-nums whitespace-nowrap w-[1%]"
          >
            {formatCurrency(item.vatAmount)}
          </td>
        );
      case 'itemDiscount':
        return (
          <td
            key={colKey}
            className={`border border-slate-300 px-2 py-2 text-right tabular-nums whitespace-nowrap w-[1%] ${
              item.itemDiscount > 0 ? 'text-emerald-700 font-medium' : 'text-slate-500'
            }`}
          >
            {item.itemDiscount > 0 ? `-${formatCurrency(item.itemDiscount)}` : '0 ₫'}
          </td>
        );
      case 'totalAmount':
      default:
        return (
          <td
            key={colKey}
            className="border border-slate-300 px-2 py-2 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap w-[1%]"
          >
            {formatCurrency(item.totalAmount)}
          </td>
        );
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

            const qrInfo = qrMap[order.id];
            const hasCompanyBlock =
              printCfg.showCompanyName ||
              printCfg.showCompanyTaxCode ||
              printCfg.showCompanyAddress ||
              printCfg.showCompanyContact ||
              printCfg.showCompanyBank;
            const hasHeaderQr =
              printCfg.showQrCode && printCfg.qrPosition === 'header_right' && Boolean(qrInfo?.dataUrl);
            const hasFooterQr =
              printCfg.showQrCode && printCfg.qrPosition === 'footer_left' && Boolean(qrInfo?.dataUrl);
            const hasRightHeader = printCfg.showOrderCodeAndDate || hasHeaderQr;

            const hasLeftCustomer =
              printCfg.showCustomerName || printCfg.showCustomerCode || printCfg.showCustomerTaxOrId;
            const hasRightCustomer =
              printCfg.showCustomerAddress || printCfg.showPaymentMethod || printCfg.showOrderNotes;
            const hasCustomerBox = hasLeftCustomer || hasRightCustomer;

            return (
              <div
                key={order.id}
                className="order-sheet print:break-after-page border border-slate-200 p-8 rounded-xl shadow-xs print:border-none print:p-0 print:shadow-none bg-white"
              >
                {/* Company Header */}
                {(hasCompanyBlock || hasRightHeader) && (
                  <div className="flex justify-between items-start gap-4 border-b border-slate-300 pb-4 mb-4">
                    <div className="space-y-1">
                      {printCfg.showCompanyName && (
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                          {settings.companyName}
                        </h2>
                      )}
                      {printCfg.showCompanyTaxCode && (
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold">Mã số thuế:</span> {settings.taxCode || '—'}
                        </p>
                      )}
                      {printCfg.showCompanyAddress && (
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold">Địa chỉ:</span> {settings.address || '—'}
                        </p>
                      )}
                      {printCfg.showCompanyContact && (
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold">Điện thoại:</span> {settings.phone || '—'}
                          {settings.email ? (
                            <>
                              {' | '}
                              <span className="font-semibold">Email:</span> {settings.email}
                            </>
                          ) : null}
                        </p>
                      )}
                      {printCfg.showCompanyBank && settings.bankAccount && (
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold">Số TK:</span> {settings.bankAccount}
                          {settings.bankName ? ` - ${settings.bankName}` : ''}
                        </p>
                      )}
                    </div>

                    {hasRightHeader && (
                      <div className="text-right shrink-0 flex flex-col items-end">
                        {printCfg.showOrderCodeAndDate && (
                          <>
                            <div className="inline-block px-3 py-1 bg-slate-100 rounded text-xs font-mono tabular-nums font-semibold text-slate-700 border border-slate-200">
                              {order.orderCode}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Ngày: {formatDate(order.orderDate)}
                            </div>
                          </>
                        )}
                        {hasHeaderQr && qrInfo && (
                          <div className="mt-2 inline-flex flex-col items-center p-1.5 border border-slate-200 rounded-lg bg-white">
                            <img
                              src={qrInfo.dataUrl}
                              width={qrPx}
                              height={qrPx}
                              alt="Mã QR phiếu bán hàng"
                              className="block"
                            />
                            {printCfg.qrCaption && (
                              <span
                                className="text-[10px] font-bold text-slate-800 mt-1 text-center"
                                style={{ maxWidth: qrPx + 24 }}
                              >
                                {printCfg.qrCaption}
                              </span>
                            )}
                            {qrInfo.subLabel && (
                              <span className="text-[9.5px] font-mono tabular-nums text-slate-500 text-center">
                                {qrInfo.subLabel}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Title */}
                <div className="text-center my-5">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-wide">
                    {printCfg.invoiceTitle || 'HÓA ĐƠN BÁN HÀNG'}
                  </h1>
                  {printCfg.showInvoiceSubtitle && printCfg.invoiceSubtitle && (
                    <p className="text-xs text-slate-500 mt-1">{printCfg.invoiceSubtitle}</p>
                  )}
                </div>

                {/* Customer Info */}
                {hasCustomerBox && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm bg-slate-50 p-4 rounded-lg border border-slate-200 mb-5">
                    {hasLeftCustomer && (
                      <div className="space-y-1">
                        {printCfg.showCustomerName && (
                          <p className="text-slate-700">
                            <span className="font-bold text-slate-900">Khách hàng:</span>{' '}
                            {order.customerName}
                          </p>
                        )}
                        {printCfg.showCustomerCode && (
                          <p className="text-slate-700">
                            <span className="font-bold text-slate-900">Mã KH:</span>{' '}
                            <span className="font-mono tabular-nums text-blue-700 font-semibold">
                              {order.customerCode}
                            </span>
                          </p>
                        )}
                        {printCfg.showCustomerTaxOrId && (
                          <p className="text-slate-700">
                            <span className="font-bold text-slate-900">MST / CCCD:</span>{' '}
                            {order.customerTaxCode || order.customerIdCard || 'Chưa cung cấp'}
                          </p>
                        )}
                      </div>
                    )}
                    {hasRightCustomer && (
                      <div className="space-y-1">
                        {printCfg.showCustomerAddress && (
                          <p className="text-slate-700">
                            <span className="font-bold text-slate-900">Địa chỉ giao:</span>{' '}
                            {order.customerAddress || 'Tại quầy'}
                          </p>
                        )}
                        {printCfg.showPaymentMethod && (
                          <p className="text-slate-700">
                            <span className="font-bold text-slate-900">Phương thức TT:</span>{' '}
                            {formatPaymentMethod(order.paymentMethod)}
                          </p>
                        )}
                        {printCfg.showOrderNotes && (
                          <p className="text-slate-700">
                            <span className="font-bold text-slate-900">Ghi chú:</span>{' '}
                            {order.notes || 'Không có'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Items Table */}
                <div className="mb-5">
                  <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide mb-2">
                    Chi tiết hàng hóa ({order.items.length} mặt hàng)
                  </div>
                  <div className="overflow-x-auto print:overflow-visible">
                    <table
                      className={`w-full text-left border-collapse border border-slate-400 table-auto ${
                        activeCols.length >= 10
                          ? 'text-[11px] print:text-[9.5px]'
                          : 'text-xs print:text-[10.5px]'
                      }`}
                    >
                      <thead className="bg-slate-200/80 text-slate-900 uppercase font-bold text-[10px] print:text-[9px] leading-tight">
                        <tr>
                          {activeCols.map((col) => (
                            <th
                              key={col.key}
                              className={`border border-slate-400 px-2 py-2 align-middle ${
                                col.isFluid ? 'min-w-[160px]' : 'whitespace-nowrap w-[1%]'
                              } ${
                                col.align === 'center'
                                  ? 'text-center'
                                  : col.align === 'right'
                                  ? 'text-right'
                                  : 'text-left'
                              }`}
                              dangerouslySetInnerHTML={{ __html: col.labelHtml }}
                            />
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => (
                          <tr
                            key={item.id}
                            className={`text-slate-800 align-middle ${
                              idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'
                            }`}
                          >
                            {activeCols.map((col) => renderReactCell(col.key, item, idx))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold text-slate-900">
                        <tr>
                          <td
                            colSpan={Math.max(1, activeCols.length - 1)}
                            className="border border-slate-300 px-3 py-2 text-right"
                          >
                            Tổng cộng ({order.items.length} mặt hàng):
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-right text-blue-700 font-extrabold tabular-nums whitespace-nowrap">
                            {formatCurrency(
                              order.items.reduce((s, it) => s + (it.totalAmount || 0), 0)
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Summaries & QR & Notes */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                  <div className="w-full sm:w-1/2 text-xs space-y-1.5 text-slate-600">
                    {printCfg.showCreatorAndStatus && (
                      <>
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
                      </>
                    )}
                    {printCfg.showThankYouNote && printCfg.thankYouNote && (
                      <div className="pt-2 italic text-slate-500">{printCfg.thankYouNote}</div>
                    )}
                    {hasFooterQr && qrInfo && (
                      <div className="pt-2">
                        <div className="inline-flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg bg-slate-50">
                          <img
                            src={qrInfo.dataUrl}
                            width={qrPx}
                            height={qrPx}
                            alt="Mã QR phiếu bán hàng"
                            className="block bg-white border border-slate-200 rounded p-0.5 shrink-0"
                          />
                          <div className="text-[11px] text-slate-700 leading-snug space-y-0.5">
                            {printCfg.qrCaption && (
                              <div className="font-bold text-slate-900">{printCfg.qrCaption}</div>
                            )}
                            {qrInfo.subLabel && (
                              <div className="font-mono tabular-nums font-semibold text-slate-700">
                                {qrInfo.subLabel}
                              </div>
                            )}
                            {printCfg.qrMode === 'vietqr' && settings.bankAccount && (
                              <div className="text-[10.5px] text-slate-500">
                                Nội dung CK: TT {order.orderCode}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full sm:w-1/2 border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs sm:text-sm space-y-2">
                    {printCfg.showSummaryPreTax && (
                      <>
                        <div className="flex justify-between text-slate-600">
                          <span>Tổng tiền hàng (Trước thuế):</span>
                          <span className="font-medium tabular-nums text-slate-800">
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
                            <div className="pl-2 py-0.5 space-y-0.5 border-l border-slate-300 text-[11px] text-slate-600">
                              {Array.from(subtotalMap.entries())
                                .sort((a, b) => a[0] - b[0])
                                .map(([rate, amt]) => (
                                  <div key={rate} className="flex justify-between">
                                    <span>• Tiền hàng thuế {rate}%:</span>
                                    <span className="font-medium tabular-nums text-slate-800">
                                      {formatCurrency(amt)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          );
                        })()}
                      </>
                    )}

                    {printCfg.showSummaryVat && (
                      <>
                        <div className="flex justify-between text-slate-600">
                          <span>Tổng thuế GTGT:</span>
                          <span className="font-medium tabular-nums text-slate-800">
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
                            <div className="pl-2 py-0.5 space-y-0.5 border-l border-slate-300 text-[11px] text-slate-600">
                              {Array.from(taxMap.entries())
                                .sort((a, b) => a[0] - b[0])
                                .map(([rate, amt]) => (
                                  <div key={rate} className="flex justify-between">
                                    <span>• Tiền thuế GTGT {rate}%:</span>
                                    <span className="font-medium tabular-nums text-slate-800">
                                      {formatCurrency(amt)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          );
                        })()}
                      </>
                    )}

                    {printCfg.showSummaryDiscount && (
                      <>
                        <div className="flex justify-between text-slate-600">
                          <span>Chiết khấu mặt hàng:</span>
                          <span
                            className={`tabular-nums ${
                              itemDiscountTotal > 0 ? 'font-medium text-emerald-700' : 'text-slate-800'
                            }`}
                          >
                            {itemDiscountTotal > 0 ? `-${formatCurrency(itemDiscountTotal)}` : '0 ₫'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Chiết khấu tổng đơn:</span>
                          <span
                            className={`tabular-nums ${
                              order.orderDiscount > 0 ? 'font-medium text-emerald-700' : 'text-slate-800'
                            }`}
                          >
                            {order.orderDiscount > 0 ? `-${formatCurrency(order.orderDiscount)}` : '0 ₫'}
                          </span>
                        </div>
                      </>
                    )}

                    <div
                      className={`flex justify-between font-bold text-sm sm:text-base text-slate-900 ${
                        printCfg.showSummaryPreTax || printCfg.showSummaryVat || printCfg.showSummaryDiscount
                          ? 'border-t border-slate-300 pt-2'
                          : ''
                      }`}
                    >
                      <span>Tổng tiền thanh toán:</span>
                      <span className="text-blue-700 tabular-nums">{formatCurrency(order.totalAmount)}</span>
                    </div>

                    {printCfg.showSummaryPaidAndDebt && (
                      <>
                        <div className="flex justify-between text-slate-700 pt-1">
                          <span>Đã Thanh toán:</span>
                          <span className="font-semibold text-emerald-600 tabular-nums">
                            {formatCurrency(order.paidAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-700 font-semibold border-t border-slate-200 pt-1">
                          <span>Công nợ còn lại:</span>
                          <span
                            className={`tabular-nums ${
                              order.debtAmount > 0 ? 'text-rose-600 font-bold' : 'text-slate-600'
                            }`}
                          >
                            {formatCurrency(order.debtAmount)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Số tiền viết bằng chữ */}
                {printCfg.showAmountInWords && (
                  <div className="mt-4 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800">
                    <span className="font-bold text-slate-900">Số tiền viết bằng chữ:</span>{' '}
                    <span className="italic font-semibold text-slate-900">
                      {formatCurrencyInWords(order.totalAmount)}.
                    </span>
                  </div>
                )}

                {/* Signatures */}
                {printCfg.showSignatures && (
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
