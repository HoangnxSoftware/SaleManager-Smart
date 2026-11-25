import QRCode from 'qrcode';
import { AppSettings, Order, SalesInvoicePrintSettings } from '../types';

export interface VietnamBankOption {
  bin: string;
  shortName: string;
  name: string;
  aliases: string[];
}

export const VIETNAM_BANKS: VietnamBankOption[] = [
  { bin: '970407', shortName: 'Techcombank', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', aliases: ['techcombank', 'tcb', 'ky thuong'] },
  { bin: '970436', shortName: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại thương Việt Nam', aliases: ['vietcombank', 'vcb', 'ngoai thuong'] },
  { bin: '970418', shortName: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', aliases: ['bidv', 'dau tu va phat trien'] },
  { bin: '970415', shortName: 'VietinBank', name: 'Ngân hàng TMCP Công thương Việt Nam', aliases: ['vietinbank', 'vietin', 'ctg', 'cong thuong'] },
  { bin: '970422', shortName: 'MB Bank', name: 'Ngân hàng TMCP Quân đội', aliases: ['mb', 'mbbank', 'mb bank', 'quan doi'] },
  { bin: '970416', shortName: 'ACB', name: 'Ngân hàng TMCP Á Châu', aliases: ['acb', 'a chau'] },
  { bin: '970432', shortName: 'VPBank', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', aliases: ['vpbank', 'vp bank', 'thinh vuong'] },
  { bin: '970423', shortName: 'TPBank', name: 'Ngân hàng TMCP Tiên Phong', aliases: ['tpbank', 'tp bank', 'tien phong'] },
  { bin: '970403', shortName: 'Sacombank', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', aliases: ['sacombank', 'stb'] },
  { bin: '970405', shortName: 'Agribank', name: 'Ngân hàng NN&PTNT Việt Nam', aliases: ['agribank', 'agri', 'nong nghiep'] },
  { bin: '970437', shortName: 'HDBank', name: 'Ngân hàng TMCP Phát triển TP.HCM', aliases: ['hdbank', 'hd bank'] },
  { bin: '970441', shortName: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam', aliases: ['vib', 'quoc te'] },
  { bin: '970426', shortName: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam', aliases: ['msb', 'hang hai', 'maritime'] },
  { bin: '970448', shortName: 'OCB', name: 'Ngân hàng TMCP Phương Đông', aliases: ['ocb', 'phuong dong'] },
  { bin: '970443', shortName: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', aliases: ['shb', 'sai gon ha noi'] },
  { bin: '970440', shortName: 'SeABank', name: 'Ngân hàng TMCP Đông Nam Á', aliases: ['seabank', 'sea bank', 'dong nam a'] },
  { bin: '970431', shortName: 'Eximbank', name: 'Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam', aliases: ['eximbank', 'exim', 'xuat nhap khau'] },
  { bin: '970449', shortName: 'LPBank', name: 'Ngân hàng TMCP Lộc Phát Việt Nam', aliases: ['lpbank', 'lienviet', 'lien viet'] },
  { bin: '970428', shortName: 'Nam A Bank', name: 'Ngân hàng TMCP Nam Á', aliases: ['nam a', 'namabank'] },
  { bin: '970424', shortName: 'Shinhan Bank', name: 'Ngân hàng TNHH MTV Shinhan Việt Nam', aliases: ['shinhan'] },
  { bin: '970454', shortName: 'BVBank', name: 'Ngân hàng TMCP Bản Việt', aliases: ['bvbank', 'ban viet', 'vietcapital'] },
  { bin: '546034', shortName: 'CAKE by VPBank', name: 'Ngân hàng số CAKE by VPBank', aliases: ['cake'] },
  { bin: '963388', shortName: 'Timo by BVBank', name: 'Ngân hàng số Timo', aliases: ['timo'] },
];

export const DEFAULT_SALES_INVOICE_PRINT_SETTINGS: SalesInvoicePrintSettings = {
  invoiceTitle: 'HÓA ĐƠN BÁN HÀNG',
  invoiceSubtitle: '(Liên 1: Lưu nội bộ - Liên 2: Giao cho khách hàng)',
  thankYouNote: 'Cảm ơn Quý khách đã tin tưởng và ủng hộ chúng tôi!',
  showCompanyName: true,
  showCompanyTaxCode: true,
  showCompanyAddress: true,
  showCompanyContact: true,
  showCompanyBank: true,
  showOrderCodeAndDate: true,
  showInvoiceSubtitle: true,
  showCustomerName: true,
  showCustomerCode: true,
  showCustomerTaxOrId: true,
  showCustomerAddress: true,
  showPaymentMethod: true,
  showOrderNotes: true,
  showColStt: true,
  showColProductCode: true,
  showColUnit: true,
  showColPostTaxPrice: true,
  showColPreTaxPrice: true,
  showColSubtotal: true,
  showColVatRate: true,
  showColVatAmount: true,
  showColItemDiscount: true,
  showSummaryPreTax: true,
  showSummaryVat: true,
  showSummaryDiscount: true,
  showSummaryPaidAndDebt: true,
  showAmountInWords: true,
  showCreatorAndStatus: true,
  showThankYouNote: true,
  showSignatures: true,
  showQrCode: true,
  qrMode: 'vietqr',
  qrBankBin: '970407',
  qrAmountSource: 'debt_or_total',
  qrPosition: 'footer_left',
  qrSize: 'medium',
  qrCaption: 'Quét mã QR để thanh toán',
  qrCustomText: '',
};

export function inferBankBinFromName(bankName?: string): string {
  if (!bankName) return '';
  const normalized = bankName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
  for (const bank of VIETNAM_BANKS) {
    if (bank.aliases.some((alias) => normalized.includes(alias))) {
      return bank.bin;
    }
  }
  return '';
}

export function getEffectivePrintSettings(settings: AppSettings): SalesInvoicePrintSettings {
  const inferredBin = inferBankBinFromName(settings.bankName);
  const saved = settings.salesInvoicePrint;
  if (!saved) {
    return {
      ...DEFAULT_SALES_INVOICE_PRINT_SETTINGS,
      qrBankBin: inferredBin || DEFAULT_SALES_INVOICE_PRINT_SETTINGS.qrBankBin,
    };
  }
  return {
    ...DEFAULT_SALES_INVOICE_PRINT_SETTINGS,
    ...saved,
    qrBankBin: saved.qrBankBin || inferredBin || DEFAULT_SALES_INVOICE_PRINT_SETTINGS.qrBankBin,
  };
}

function toAsciiSafe(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 .\-_:/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTlv(tag: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${tag}${len}${value}`;
}

function crc16CcittFalse(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Builds standard EMVCo / NAPAS VietQR payload compatible with Vietnamese banking apps.
 */
export function buildVietQrPayload(params: {
  bankBin: string;
  accountNumber: string;
  amount?: number;
  description?: string;
}): string {
  const cleanBin = (params.bankBin || '').replace(/\D/g, '').slice(0, 6);
  const cleanAcc = (params.accountNumber || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 19);
  const roundedAmount = params.amount && params.amount > 0 ? Math.round(params.amount) : 0;
  const cleanDesc = toAsciiSafe(params.description || '').slice(0, 50);

  const beneficiary = formatTlv('00', cleanBin) + formatTlv('01', cleanAcc);
  const merchantAccountInfo =
    formatTlv('00', 'A000000727') +
    formatTlv('01', beneficiary) +
    formatTlv('02', 'QRIBFTTA');

  let payload = '';
  payload += formatTlv('00', '01'); // Payload Format Indicator
  payload += formatTlv('01', roundedAmount > 0 ? '12' : '11'); // Dynamic or Static
  payload += formatTlv('38', merchantAccountInfo);
  payload += formatTlv('53', '704'); // VND
  if (roundedAmount > 0) {
    payload += formatTlv('54', String(roundedAmount));
  }
  payload += formatTlv('58', 'VN');
  if (cleanDesc) {
    payload += formatTlv('62', formatTlv('08', cleanDesc));
  }
  payload += '6304';
  const crc = crc16CcittFalse(payload);
  return payload + crc;
}

export interface OrderQrDescriptor {
  payload: string;
  subLabel: string;
  modeUsed: 'vietqr' | 'order_info' | 'custom';
}

export function buildOrderQrDescriptor(order: Order, settings: AppSettings): OrderQrDescriptor {
  const cfg = getEffectivePrintSettings(settings);
  const bankBin = cfg.qrBankBin || inferBankBinFromName(settings.bankName);
  const accountNo = (settings.bankAccount || '').trim();
  const bankOption = VIETNAM_BANKS.find((b) => b.bin === bankBin);

  if (cfg.qrMode === 'custom' && cfg.qrCustomText.trim()) {
    const formatted = cfg.qrCustomText
      .trim()
      .replace(/\{orderCode\}/g, order.orderCode)
      .replace(/\{totalAmount\}/g, String(Math.round(order.totalAmount || 0)))
      .replace(/\{customerName\}/g, order.customerName || '')
      .replace(/\{orderDate\}/g, order.orderDate || '');
    return {
      payload: formatted,
      subLabel: order.orderCode,
      modeUsed: 'custom',
    };
  }

  if (cfg.qrMode === 'vietqr' && bankBin && accountNo) {
    let amount = 0;
    if (cfg.qrAmountSource === 'debt_or_total') {
      amount = order.debtAmount > 0 ? order.debtAmount : order.totalAmount;
    } else if (cfg.qrAmountSource === 'total_amount') {
      amount = order.totalAmount;
    }

    const payload = buildVietQrPayload({
      bankBin,
      accountNumber: accountNo,
      amount,
      description: `TT ${order.orderCode}`,
    });

    return {
      payload,
      subLabel: `${bankOption?.shortName || settings.bankName || 'Ngân hàng'} · ${accountNo}`,
      modeUsed: 'vietqr',
    };
  }

  // Order info fallback or explicit order_info mode
  const infoLines = [
    `DON HANG: ${order.orderCode}`,
    `NGAY: ${order.orderDate}`,
    `KHACH HANG: ${order.customerName}`,
    `TONG TIEN: ${Math.round(order.totalAmount || 0).toLocaleString('vi-VN')} VND`,
    order.debtAmount > 0 ? `CON NO: ${Math.round(order.debtAmount).toLocaleString('vi-VN')} VND` : 'DA THANH TOAN DU',
    `DON VI: ${settings.companyName || ''}`,
  ].filter(Boolean);

  return {
    payload: infoLines.join('\n'),
    subLabel: `${order.orderCode} · ${order.orderDate}`,
    modeUsed: 'order_info',
  };
}

export function getQrPixelSize(size: SalesInvoicePrintSettings['qrSize']): number {
  switch (size) {
    case 'small':
      return 78;
    case 'large':
      return 120;
    case 'medium':
    default:
      return 96;
  }
}

export async function generateQrDataUrl(payload: string, pxSize = 180): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: pxSize,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

export async function generateOrderQrMap(
  orders: Order[],
  settings: AppSettings
): Promise<Record<string, { dataUrl: string; subLabel: string }>> {
  const cfg = getEffectivePrintSettings(settings);
  if (!cfg.showQrCode) return {};

  const entries = await Promise.all(
    orders.map(async (order) => {
      const desc = buildOrderQrDescriptor(order, settings);
      const dataUrl = await generateQrDataUrl(desc.payload, 220);
      return [order.id, { dataUrl, subLabel: desc.subLabel }] as const;
    })
  );

  return Object.fromEntries(entries);
}
