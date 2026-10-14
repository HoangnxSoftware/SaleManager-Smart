import { AppData, AppSettings, AppUser, Customer, Supplier, Product, Order, PurchaseBill, DebtPayment, DatabaseProfile } from '../types';
import { DEFAULT_ORDER_CODE_RULES } from './orderCodeService';

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: 'CÔNG TY TNHH THƯƠNG MẠI & DỊCH VỤ SMART TECH',
  taxCode: '0108999888',
  address: 'Số 88 Phố Vọng, Phường Đồng Tâm, Quận Hai Bà Trưng, Hà Nội',
  phone: '0988 123 456',
  email: 'contact@smarttech.vn',
  bankAccount: '19036888666888',
  bankName: 'Techcombank - Chi nhánh Thăng Long',
  representative: 'Nguyễn Văn Minh - Giám đốc',
  purchasePriceDecimals: 10,
  salePriceDecimals: 2,
  postTaxSalePriceDecimals: -2,
  costPriceDecimals: 2,
  inventoryMethod: 'FIFO',
  driveFolder: 'SaleManager-Smart',
  orderCodeRules: DEFAULT_ORDER_CODE_RULES,
  defaultOrderCodeRuleId: 'rule-dh',
};

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'u-1',
    username: 'admin',
    fullName: 'Quản Trị Viên (Admin)',
    role: 'admin',
    phone: '0988123456',
    email: 'admin@salemanager.vn',
    isActive: true,
    password: '123',
  },
  {
    id: 'u-2',
    username: 'quanly',
    fullName: 'Trần Văn Quản Lý',
    role: 'manager',
    phone: '0912345678',
    email: 'quanly@salemanager.vn',
    isActive: true,
    password: '123',
  },
  {
    id: 'u-3',
    username: 'banhang',
    fullName: 'Lê Thị Thu Thảo',
    role: 'salesperson',
    phone: '0977889900',
    email: 'banhang@salemanager.vn',
    isActive: true,
    password: '123',
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    code: 'KH001',
    name: 'Công ty Cổ phần Xây dựng & Địa ốc Thăng Long',
    shortName: 'Địa ốc Thăng Long',
    taxCode: '0102345678',
    phone: '0243888999',
    address: 'Tầng 12 Tòa Licogi 13, Thanh Xuân, Hà Nội',
    type: 'organization',
    idCard: '',
    notes: 'Khách hàng dự án lớn, thanh toán chuyển khoản',
    createdAt: '2026-09-01',
  },
  {
    id: 'cust-2',
    code: 'KH002',
    name: 'Nguyễn Văn Thành',
    shortName: 'Anh Thành - Cầu Giấy',
    taxCode: '038194002345',
    phone: '0983112233',
    address: '15 Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
    type: 'personal',
    idCard: '038194002345',
    notes: 'Khách lẻ thường xuyên, thích nhận hàng buổi sáng',
    createdAt: '2026-09-10',
  },
  {
    id: 'cust-3',
    code: 'KH003',
    name: 'Cửa hàng Thiết bị Điện Nước Hoàng Kim',
    shortName: 'Điện nước Hoàng Kim',
    taxCode: '0314567890',
    phone: '0903445566',
    address: '240 Trường Chinh, Đống Đa, Hà Nội',
    type: 'organization',
    idCard: '',
    notes: 'Đại lý cấp 2, chiết khấu theo chính sách sỉ',
    createdAt: '2026-09-15',
  },
  {
    id: 'cust-4',
    code: 'KH004',
    name: 'Phạm Thị Lan',
    shortName: 'Chị Lan - Đống Đa',
    taxCode: '001198007891',
    phone: '0912667788',
    address: '88 Thái Hà, Trung Liệt, Đống Đa, Hà Nội',
    type: 'personal',
    idCard: '001198007891',
    notes: 'Khách cá nhân VIP',
    createdAt: '2026-09-20',
  },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    code: 'NCC001',
    name: 'Công ty TNHH Sản Xuất Thiết Bị Điện Panasonic VN',
    shortName: 'Panasonic VN',
    taxCode: '0100112233',
    phone: '02437654321',
    address: 'Khu công nghiệp Thăng Long, Đông Anh, Hà Nội',
    notes: 'Nhà cung cấp thiết bị điện chính hãng',
    createdAt: '2026-08-01',
  },
  {
    id: 'sup-2',
    code: 'NCC002',
    name: 'Công ty Cổ phần Dây Cáp Điện Cadivi',
    shortName: 'Cadivi Miền Bắc',
    taxCode: '0300223344',
    phone: '02438887766',
    address: 'Lô B2 Cụm CN Từ Liêm, Bắc Từ Liêm, Hà Nội',
    notes: 'Tổng kho dây điện và phụ kiện điện',
    createdAt: '2026-08-10',
  },
  {
    id: 'sup-3',
    code: 'NCC003',
    name: 'Công ty TNHH Thiết Bị Chiếu Sáng Rạng Đông',
    shortName: 'Rạng Đông',
    taxCode: '0100445566',
    phone: '02438584310',
    address: '87-89 Hạ Đình, Thanh Xuân, Hà Nội',
    notes: 'Cung cấp đèn LED và thiết bị thông minh',
    createdAt: '2026-08-15',
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    code: 'LED-RD-18W',
    name: 'Đèn LED Downlight Rạng Đông 18W Viền Bạc',
    purchaseUnit: 'Thùng (20 chiếc)',
    vatRate: 10,
    conversionRate: 20,
    saleUnit: 'Chiếc',
    category: 'Thiết bị chiếu sáng',
    profitMargin: 25, // 25% tỷ suất lợi nhuận
    notes: 'Bảo hành 24 tháng',
  },
  {
    id: 'prod-2',
    code: 'LED-RD-09W',
    name: 'Đèn LED Búp Rạng Đông 9W Ánh Sáng Trắng',
    purchaseUnit: 'Thùng (50 chiếc)',
    vatRate: 10,
    conversionRate: 50,
    saleUnit: 'Chiếc',
    category: 'Thiết bị chiếu sáng',
    profitMargin: 30, // 30% tỷ suất lợi nhuận
    notes: 'Tiết kiệm điện 85%',
  },
  {
    id: 'prod-3',
    code: 'DAY-CAD-2X2.5',
    name: 'Dây điện đôi Cadivi VCmd 2x2.5mm (Cuộn 100m)',
    purchaseUnit: 'Cuộn 100m',
    vatRate: 10,
    conversionRate: 100,
    saleUnit: 'Mét',
    category: 'Dây & Cáp điện',
    profitMargin: 20, // 20%
    notes: 'Lõi đồng nguyên chất',
  },
  {
    id: 'prod-4',
    code: 'DAY-CAD-1X4.0',
    name: 'Dây điện đơn Cadivi VC 1x4.0mm',
    purchaseUnit: 'Cuộn 100m',
    vatRate: 10,
    conversionRate: 100,
    saleUnit: 'Mét',
    category: 'Dây & Cáp điện',
    profitMargin: 22,
    notes: 'Dây nguồn chịu tải',
  },
  {
    id: 'prod-5',
    code: 'O-CAM-PANA-WIDE',
    name: 'Ổ cắm đôi 3 chấu Panasonic Wide series',
    purchaseUnit: 'Hộp (10 chiếc)',
    vatRate: 10,
    conversionRate: 10,
    saleUnit: 'Chiếc',
    category: 'Công tắc ổ cắm',
    profitMargin: 28,
    notes: 'Chống cháy cao cấp',
  },
  {
    id: 'prod-6',
    code: 'APTOMAT-PANA-32A',
    name: 'Aptomat chống giật Panasonic RCBO 32A',
    purchaseUnit: 'Hộp (6 chiếc)',
    vatRate: 10,
    conversionRate: 6,
    saleUnit: 'Chiếc',
    category: 'Thiết bị đóng cắt',
    profitMargin: 26,
    notes: 'Tự ngắt khi rò điện',
  },
];

export const INITIAL_PURCHASES: PurchaseBill[] = [
  {
    id: 'bill-1',
    billNo: 'PNK-20260905-01',
    purchaseDate: '2026-09-05',
    supplierCode: 'NCC003',
    supplierTaxCode: '0100445566',
    supplierName: 'Công ty TNHH Thiết Bị Chiếu Sáng Rạng Đông',
    items: [
      {
        id: 'pi-1',
        productCode: 'LED-RD-18W',
        productName: 'Đèn LED Downlight Rạng Đông 18W Viền Bạc',
        purchaseUnit: 'Chiếc',
        quantity: 200,
        unitPrice: 85000.0000000000,
        amount: 17000000,
        vatRate: 10,
        vatAmount: 1700000,
        totalAmount: 18700000,
        cumulativeQuantity: 200,
      },
      {
        id: 'pi-2',
        productCode: 'LED-RD-09W',
        productName: 'Đèn LED Búp Rạng Đông 9W Ánh Sáng Trắng',
        purchaseUnit: 'Chiếc',
        quantity: 500,
        unitPrice: 32000.0000000000,
        amount: 16000000,
        vatRate: 10,
        vatAmount: 1600000,
        totalAmount: 17600000,
        cumulativeQuantity: 500,
      },
    ],
    subtotal: 33000000,
    totalVat: 3300000,
    totalAmount: 36300000,
    paidAmount: 36300000,
    paymentStatus: 'paid',
    createdById: 'u-1',
    createdAt: '2026-09-05T08:30:00Z',
    updatedAt: '2026-09-05T08:30:00Z',
  },
  {
    id: 'bill-2',
    billNo: 'PNK-20260912-02',
    purchaseDate: '2026-09-12',
    supplierCode: 'NCC002',
    supplierTaxCode: '0300223344',
    supplierName: 'Công ty Cổ phần Dây Cáp Điện Cadivi',
    items: [
      {
        id: 'pi-3',
        productCode: 'DAY-CAD-2X2.5',
        productName: 'Dây điện đôi Cadivi VCmd 2x2.5mm (Cuộn 100m)',
        purchaseUnit: 'Mét',
        quantity: 1000,
        unitPrice: 14500.0000000000,
        amount: 14500000,
        vatRate: 10,
        vatAmount: 1450000,
        totalAmount: 15950000,
        cumulativeQuantity: 1000,
      },
      {
        id: 'pi-4',
        productCode: 'DAY-CAD-1X4.0',
        productName: 'Dây điện đơn Cadivi VC 1x4.0mm',
        purchaseUnit: 'Mét',
        quantity: 800,
        unitPrice: 18200.0000000000,
        amount: 14560000,
        vatRate: 10,
        vatAmount: 1456000,
        totalAmount: 16016000,
        cumulativeQuantity: 800,
      },
    ],
    subtotal: 29060000,
    totalVat: 2906000,
    totalAmount: 31966000,
    paidAmount: 20000000,
    paymentStatus: 'partial',
    createdById: 'u-1',
    createdAt: '2026-09-12T09:15:00Z',
    updatedAt: '2026-09-12T09:15:00Z',
  },
  {
    id: 'bill-3',
    billNo: 'PNK-20260920-03',
    purchaseDate: '2026-09-20',
    supplierCode: 'NCC001',
    supplierTaxCode: '0100112233',
    supplierName: 'Công ty TNHH Sản Xuất Thiết Bị Điện Panasonic VN',
    items: [
      {
        id: 'pi-5',
        productCode: 'O-CAM-PANA-WIDE',
        productName: 'Ổ cắm đôi 3 chấu Panasonic Wide series',
        purchaseUnit: 'Chiếc',
        quantity: 150,
        unitPrice: 62000.0000000000,
        amount: 9300000,
        vatRate: 10,
        vatAmount: 930000,
        totalAmount: 10230000,
        cumulativeQuantity: 150,
      },
      {
        id: 'pi-6',
        productCode: 'APTOMAT-PANA-32A',
        productName: 'Aptomat chống giật Panasonic RCBO 32A',
        purchaseUnit: 'Chiếc',
        quantity: 80,
        unitPrice: 285000.0000000000,
        amount: 22800000,
        vatRate: 10,
        vatAmount: 2280000,
        totalAmount: 25080000,
        cumulativeQuantity: 80,
      },
      {
        id: 'pi-7',
        productCode: 'LED-RD-18W',
        productName: 'Đèn LED Downlight Rạng Đông 18W Viền Bạc',
        purchaseUnit: 'Chiếc',
        quantity: 100,
        unitPrice: 88000.0000000000, // Lô sau giá tăng lên 88k
        amount: 8800000,
        vatRate: 10,
        vatAmount: 880000,
        totalAmount: 9680000,
        cumulativeQuantity: 300,
      },
    ],
    subtotal: 40900000,
    totalVat: 4090000,
    totalAmount: 44990000,
    paidAmount: 30000000,
    paymentStatus: 'partial',
    createdById: 'u-1',
    createdAt: '2026-09-20T14:00:00Z',
    updatedAt: '2026-09-20T14:00:00Z',
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-1',
    orderCode: 'DH-20260925-001',
    orderDate: '2026-09-25',
    customerId: 'cust-1',
    customerCode: 'KH001',
    customerName: 'Công ty Cổ phần Xây dựng & Địa ốc Thăng Long',
    customerTaxCode: '0102345678',
    customerIdCard: '',
    customerAddress: 'Tầng 12 Tòa Licogi 13, Thanh Xuân, Hà Nội',
    items: [
      {
        id: 'oi-1',
        productCode: 'LED-RD-18W',
        productName: 'Đèn LED Downlight Rạng Đông 18W Viền Bạc',
        saleUnit: 'Chiếc',
        quantity: 50,
        preTaxPrice: 110000,
        postTaxPrice: 121000,
        itemDiscount: 0,
        vatRate: 10,
        vatAmount: 550000,
        subtotal: 5500000,
        totalAmount: 6050000,
      },
      {
        id: 'oi-2',
        productCode: 'DAY-CAD-2X2.5',
        productName: 'Dây điện đôi Cadivi VCmd 2x2.5mm (Cuộn 100m)',
        saleUnit: 'Mét',
        quantity: 200,
        preTaxPrice: 18000,
        postTaxPrice: 19800,
        itemDiscount: 0,
        vatRate: 10,
        vatAmount: 360000,
        subtotal: 3600000,
        totalAmount: 3960000,
      },
      {
        id: 'oi-3',
        productCode: 'O-CAM-PANA-WIDE',
        saleUnit: 'Chiếc',
        productName: 'Ổ cắm đôi 3 chấu Panasonic Wide series',
        quantity: 30,
        preTaxPrice: 85000,
        postTaxPrice: 93500,
        itemDiscount: 0,
        vatRate: 10,
        vatAmount: 255000,
        subtotal: 2550000,
        totalAmount: 2805000,
      },
    ],
    itemDiscountTotal: 0,
    orderDiscount: 500000,
    orderDiscountPercent: 0,
    totalPreTax: 11650000,
    totalVat: 1165000,
    totalAmount: 12315000,
    paymentMethod: 'transfer',
    paidAmount: 10000000,
    debtAmount: 2315000,
    deliveryStatus: 'pending', // Mặc định: Chờ giao
    notes: 'Giao hàng tại công trình Tòa Green Park',
    createdById: 'u-3',
    createdByName: 'Lê Thị Thu Thảo',
    createdAt: '2026-09-25T10:15:00Z',
    updatedAt: '2026-09-25T10:15:00Z',
  },
  {
    id: 'ord-2',
    orderCode: 'DH-20260928-002',
    orderDate: '2026-09-28',
    customerId: 'cust-2',
    customerCode: 'KH002',
    customerName: 'Nguyễn Văn Thành',
    customerTaxCode: '038194002345',
    customerIdCard: '038194002345',
    customerAddress: '15 Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
    items: [
      {
        id: 'oi-4',
        productCode: 'LED-RD-09W',
        productName: 'Đèn LED Búp Rạng Đông 9W Ánh Sáng Trắng',
        saleUnit: 'Chiếc',
        quantity: 20,
        preTaxPrice: 42000,
        postTaxPrice: 46200,
        itemDiscount: 0,
        vatRate: 10,
        vatAmount: 84000,
        subtotal: 840000,
        totalAmount: 924000,
      },
      {
        id: 'oi-5',
        productCode: 'APTOMAT-PANA-32A',
        productName: 'Aptomat chống giật Panasonic RCBO 32A',
        saleUnit: 'Chiếc',
        quantity: 4,
        preTaxPrice: 360000,
        postTaxPrice: 396000,
        itemDiscount: 0,
        vatRate: 10,
        vatAmount: 144000,
        subtotal: 1440000,
        totalAmount: 1584000,
      },
    ],
    itemDiscountTotal: 0,
    orderDiscount: 0,
    orderDiscountPercent: 0,
    totalPreTax: 2280000,
    totalVat: 228000,
    totalAmount: 2508000,
    paymentMethod: 'cash',
    paidAmount: 2508000,
    debtAmount: 0,
    deliveryStatus: 'pending', // Mặc định: Chờ giao
    notes: 'Khách lấy trực tiếp tại cửa hàng',
    createdById: 'u-3',
    createdByName: 'Lê Thị Thu Thảo',
    createdAt: '2026-09-28T14:30:00Z',
    updatedAt: '2026-09-28T14:30:00Z',
  },
  {
    id: 'ord-3',
    orderCode: 'DH-20261002-003',
    orderDate: '2026-10-02',
    customerId: 'cust-3',
    customerCode: 'KH003',
    customerName: 'Cửa hàng Thiết bị Điện Nước Hoàng Kim',
    customerTaxCode: '0314567890',
    customerIdCard: '',
    customerAddress: '240 Trường Chinh, Đống Đa, Hà Nội',
    items: [
      {
        id: 'oi-6',
        productCode: 'LED-RD-18W',
        productName: 'Đèn LED Downlight Rạng Đông 18W Viền Bạc',
        saleUnit: 'Chiếc',
        quantity: 40,
        preTaxPrice: 105000,
        postTaxPrice: 115500,
        itemDiscount: 200000,
        vatRate: 10,
        vatAmount: 400000,
        subtotal: 4200000,
        totalAmount: 4400000,
      },
      {
        id: 'oi-7',
        productCode: 'DAY-CAD-1X4.0',
        productName: 'Dây điện đơn Cadivi VC 1x4.0mm',
        saleUnit: 'Mét',
        quantity: 150,
        preTaxPrice: 22500,
        postTaxPrice: 24750,
        itemDiscount: 0,
        vatRate: 10,
        vatAmount: 337500,
        subtotal: 3375000,
        totalAmount: 3712500,
      },
    ],
    itemDiscountTotal: 200000,
    orderDiscount: 0,
    orderDiscountPercent: 0,
    totalPreTax: 7375000,
    totalVat: 737500,
    totalAmount: 8112500,
    paymentMethod: 'transfer',
    paidAmount: 5000000,
    debtAmount: 3112500,
    deliveryStatus: 'pending',
    notes: 'Giao trong giờ hành chính',
    createdById: 'u-2',
    createdByName: 'Trần Văn Quản Lý',
    createdAt: '2026-10-02T09:00:00Z',
    updatedAt: '2026-10-02T09:00:00Z',
  },
];

export const INITIAL_DEBT_PAYMENTS: DebtPayment[] = [
  {
    id: 'dp-1',
    code: 'PT-20260926-001',
    type: 'customer',
    entityId: 'cust-1',
    entityCode: 'KH001',
    entityName: 'Công ty Cổ phần Xây dựng & Địa ốc Thăng Long',
    date: '2026-09-26',
    amount: 1000000,
    paymentMethod: 'transfer',
    notes: 'Thu nợ đợt 2 đơn DH-20260925-001',
    createdAt: '2026-09-26T16:00:00Z',
  },
  {
    id: 'dp-2',
    code: 'PC-20260918-001',
    type: 'supplier',
    entityId: 'sup-2',
    entityCode: 'NCC002',
    entityName: 'Công ty Cổ phần Dây Cáp Điện Cadivi',
    date: '2026-09-18',
    amount: 5000000,
    paymentMethod: 'transfer',
    notes: 'Thanh toán tiếp tiền hàng đợt 1',
    createdAt: '2026-09-18T10:00:00Z',
  },
];

export const DEMO_DATABASE_ID = 'demo-smart-tech';
const PROFILES_STORAGE_KEY = 'SALEMANAGER_SMART_DB_PROFILES_V1';
const LAST_USED_DB_KEY = 'SALEMANAGER_SMART_LAST_DB_ID_V1';
const CURRENT_USER_KEY = 'SALEMANAGER_SMART_AUTH_USER_V1';

export const DEFAULT_DEMO_PROFILE: DatabaseProfile = {
  id: DEMO_DATABASE_ID,
  name: 'Dữ liệu mẫu Demo (Thử nghiệm)',
  companyName: 'CÔNG TY TNHH THƯƠNG MẠI & DỊCH VỤ SMART TECH',
  taxCode: '0108999888',
  address: 'Số 88 Phố Vọng, Phường Đồng Tâm, Quận Hai Bà Trưng, Hà Nội',
  isDemo: true,
  createdAt: '2026-09-01',
  lastUsedAt: new Date().toISOString(),
};

export function getSampleData(): AppData {
  return {
    databaseId: DEMO_DATABASE_ID,
    databaseName: 'Dữ liệu mẫu Demo (Thử nghiệm)',
    isDemo: true,
    users: INITIAL_USERS,
    customers: INITIAL_CUSTOMERS,
    suppliers: INITIAL_SUPPLIERS,
    products: INITIAL_PRODUCTS,
    orders: INITIAL_ORDERS,
    purchases: INITIAL_PURCHASES,
    debtPayments: INITIAL_DEBT_PAYMENTS,
    settings: {
      ...DEFAULT_SETTINGS,
      databaseId: DEMO_DATABASE_ID,
      databaseName: 'Dữ liệu mẫu Demo (Thử nghiệm)',
    },
    lastSyncedAt: new Date().toISOString(),
    syncSource: 'local',
  };
}

export function getEmptyData(
  companyInfo?: {
    databaseId?: string;
    databaseName?: string;
    companyName?: string;
    taxCode?: string;
    address?: string;
    spreadsheetId?: string;
  }
): AppData {
  const dbId = companyInfo?.databaseId || `db-${Date.now()}`;
  const dbName = companyInfo?.databaseName || companyInfo?.companyName || 'Cơ sở dữ liệu mới';
  const compName = companyInfo?.companyName || 'CÔNG TY MỚI';
  const tax = companyInfo?.taxCode || '';
  const addr = companyInfo?.address || '';

  const initialAdminUser: AppUser = {
    id: `u-${Date.now()}`,
    username: 'admin',
    fullName: 'Quản Trị Viên (Admin)',
    role: 'admin',
    phone: '',
    email: '',
    isActive: true,
    password: '123',
  };

  return {
    databaseId: dbId,
    databaseName: dbName,
    isDemo: false, // Dữ liệu thật mới, không phải Demo
    spreadsheetId: companyInfo?.spreadsheetId,
    users: [initialAdminUser],
    customers: [],
    suppliers: [],
    products: [],
    orders: [],
    purchases: [],
    debtPayments: [],
    settings: {
      ...DEFAULT_SETTINGS,
      databaseId: dbId,
      databaseName: dbName,
      companyName: compName,
      taxCode: tax,
      address: addr,
      spreadsheetId: companyInfo?.spreadsheetId,
    },
    lastSyncedAt: new Date().toISOString(),
    syncSource: 'local',
  };
}

export function loadDatabaseProfiles(): DatabaseProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) {
      const initial = [DEFAULT_DEMO_PROFILE];
      saveDatabaseProfiles(initial);
      return initial;
    }
    const list = JSON.parse(raw) as DatabaseProfile[];
    if (!list.some((p) => p.id === DEMO_DATABASE_ID)) {
      list.unshift(DEFAULT_DEMO_PROFILE);
    }
    return list;
  } catch (e) {
    console.error('Failed to load database profiles:', e);
    return [DEFAULT_DEMO_PROFILE];
  }
}

export function saveDatabaseProfiles(profiles: DatabaseProfile[]): void {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Failed to save database profiles:', e);
  }
}

export function getLastUsedDatabaseId(): string {
  try {
    const id = localStorage.getItem(LAST_USED_DB_KEY);
    return id || DEMO_DATABASE_ID;
  } catch {
    return DEMO_DATABASE_ID;
  }
}

export function setLastUsedDatabaseId(dbId: string): void {
  try {
    localStorage.setItem(LAST_USED_DB_KEY, dbId);
    // Also update lastUsedAt in profile
    const profiles = loadDatabaseProfiles();
    const updated = profiles.map((p) =>
      p.id === dbId ? { ...p, lastUsedAt: new Date().toISOString() } : p
    );
    saveDatabaseProfiles(updated);
  } catch (e) {
    console.error('Failed to save last used db id:', e);
  }
}

export function getLastUsedDatabaseProfile(): DatabaseProfile | null {
  const lastId = getLastUsedDatabaseId();
  const profiles = loadDatabaseProfiles();
  return profiles.find((p) => p.id === lastId) || profiles[0] || null;
}

export function deleteDatabaseProfile(profileId: string): void {
  if (profileId === DEMO_DATABASE_ID) return; // Do not delete demo
  try {
    const profiles = loadDatabaseProfiles().filter((p) => p.id !== profileId);
    saveDatabaseProfiles(profiles);
    localStorage.removeItem(`SALEMANAGER_SMART_DATA_${profileId}`);
    if (getLastUsedDatabaseId() === profileId) {
      setLastUsedDatabaseId(DEMO_DATABASE_ID);
    }
  } catch (e) {
    console.error('Failed to delete database profile:', e);
  }
}

export function loadData(databaseId?: string): AppData {
  const targetId = databaseId || getLastUsedDatabaseId();

  try {
    const key = `SALEMANAGER_SMART_DATA_${targetId}`;
    const raw = localStorage.getItem(key);

    if (!raw) {
      if (targetId === DEMO_DATABASE_ID) {
        const sample = getSampleData();
        saveData(sample, targetId);
        return sample;
      }
      // If custom db profile exists
      const profiles = loadDatabaseProfiles();
      const profile = profiles.find((p) => p.id === targetId);
      const empty = getEmptyData({
        databaseId: targetId,
        databaseName: profile?.name,
        companyName: profile?.companyName,
        taxCode: profile?.taxCode,
        address: profile?.address,
        spreadsheetId: profile?.spreadsheetId,
      });
      saveData(empty, targetId);
      return empty;
    }

    const parsed = JSON.parse(raw) as AppData;
    if (!parsed.settings) {
      parsed.settings = DEFAULT_SETTINGS;
    }
    if (!parsed.settings.orderCodeRules || parsed.settings.orderCodeRules.length === 0) {
      parsed.settings.orderCodeRules = DEFAULT_ORDER_CODE_RULES;
      parsed.settings.defaultOrderCodeRuleId = 'rule-dh';
    }
    if (!parsed.users || parsed.users.length === 0) {
      parsed.users = INITIAL_USERS;
    }
    // Tag whether demo or not
    parsed.isDemo = targetId === DEMO_DATABASE_ID;
    parsed.databaseId = targetId;

    return parsed;
  } catch (e) {
    console.error(`Failed to load data for db ${targetId}:`, e);
    const sample = getSampleData();
    saveData(sample, DEMO_DATABASE_ID);
    return sample;
  }
}

export function saveData(data: AppData, databaseId?: string): void {
  const targetId = databaseId || data.databaseId || getLastUsedDatabaseId();
  try {
    const key = `SALEMANAGER_SMART_DATA_${targetId}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save data for db ${targetId}:`, e);
  }
}

export function createNewDatabase(params: {
  name: string;
  companyName: string;
  taxCode: string;
  address: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
}): { profile: DatabaseProfile; data: AppData } {
  const dbId = `db-${Date.now()}`;
  const now = new Date().toISOString();

  const newProfile: DatabaseProfile = {
    id: dbId,
    name: params.name.trim() || params.companyName.trim(),
    companyName: params.companyName.trim(),
    taxCode: params.taxCode.trim(),
    address: params.address.trim(),
    isDemo: false,
    spreadsheetId: params.spreadsheetId,
    spreadsheetUrl: params.spreadsheetUrl,
    createdAt: now,
    lastUsedAt: now,
  };

  const newData = getEmptyData({
    databaseId: dbId,
    databaseName: newProfile.name,
    companyName: newProfile.companyName,
    taxCode: newProfile.taxCode,
    address: newProfile.address,
    spreadsheetId: params.spreadsheetId,
  });

  // Save to storage
  const profiles = loadDatabaseProfiles();
  profiles.push(newProfile);
  saveDatabaseProfiles(profiles);

  saveData(newData, dbId);
  setLastUsedDatabaseId(dbId);

  return { profile: newProfile, data: newData };
}

export function saveCurrentAuthUser(user: AppUser | null): void {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

export function loadCurrentAuthUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
