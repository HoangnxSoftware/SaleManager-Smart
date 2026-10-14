export type UserRole = 'admin' | 'manager' | 'salesperson';

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  email?: string;
  isActive: boolean;
  password?: string;
}

export type CustomerType = 'personal' | 'organization';

export interface Customer {
  id: string;
  code: string; // Mã khách hàng
  name: string; // Tên khách hàng
  shortName: string; // Tên gợi nhớ
  taxCode: string; // Mã số thuế
  phone: string; // Số điện thoại
  address: string; // Địa chỉ
  type: CustomerType; // Cá nhân / Tổ chức
  idCard: string; // Số CCCD (mặc định lấy theo MST nếu là cá nhân)
  notes: string; // Ghi chú
  createdAt: string;
}

export interface Supplier {
  id: string;
  code: string; // Mã đơn vị CC
  name: string; // Tên đơn vị cung cấp
  shortName: string; // Tên gợi nhớ
  taxCode: string; // Mã số thuế
  phone: string; // Số điện thoại
  address: string; // Địa chỉ
  notes: string; // Ghi chú
  createdAt: string;
}

export interface Product {
  id: string;
  code: string; // Mã HH
  name: string; // Tên HH
  purchaseUnit: string; // ĐVT_Mua
  vatRate: number; // Thuế suất (%)
  conversionRate: number; // SL quy đổi (mặc định = 1)
  saleUnit: string; // ĐVT_Bán
  category: string; // Nhóm/loại HH
  profitMargin: number; // Tỷ suất lợi nhuận (%)
  defaultSalePrice?: number; // Giá bán mặc định (Giá đã bao gồm thuế GTGT, theo ĐVT_Bán)
  priceVariance?: number; // Biên độ giá (+/-)
  notes?: string;
}

export interface OrderItem {
  id: string;
  productCode: string; // Mã HH
  productName: string; // Tên HH
  saleUnit: string; // ĐVT_Bán
  quantity: number; // Số lượng
  preTaxPrice: number; // Đơn giá bán trước thuế
  postTaxPrice: number; // Đơn giá bán sau thuế
  itemDiscount: number; // Chiết khấu giảm giá từng mặt hàng
  vatRate: number; // Thuế suất GTGT (%)
  vatAmount: number; // Thuế GTGT từng mặt hàng
  subtotal: number; // Thành tiền từng mặt hàng (trước thuế & chiết khấu)
  totalAmount: number; // Tổng TT từng mặt hàng (sau chiết khấu + thuế)
}

export type PaymentMethod = 'cash' | 'transfer' | 'card';
export type DeliveryStatus = 'pending' | 'delivering' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  orderCode: string; // Mã đơn
  orderDate: string; // Ngày tháng (YYYY-MM-DD)
  customerId: string; // ID khách hàng
  customerCode: string; // Mã khách hàng
  customerName: string; // Tên khách hàng
  customerTaxCode: string; // MST
  customerIdCard: string; // CCCD
  customerAddress: string; // Địa chỉ
  items: OrderItem[];
  itemDiscountTotal: number; // Tổng chiết khấu từng mặt hàng
  orderDiscount: number; // Chiết khấu giảm giá tổng đơn hàng (số tiền)
  orderDiscountPercent: number; // Chiết khấu theo %
  totalPreTax: number; // Tổng tiền trước thuế
  totalVat: number; // Tổng thuế GTGT
  totalAmount: number; // Tổng tiền thanh toán
  paymentMethod: PaymentMethod; // Phương thức thanh toán (tiền mặt, chuyển khoản, thẻ)
  paidAmount: number; // Số tiền thanh toán đợt này
  debtAmount: number; // Công nợ còn lại của đơn
  deliveryStatus: DeliveryStatus; // Trạng thái giao hàng (Mặc định: pending - Chờ giao)
  notes?: string;
  orderCodeRuleId?: string; // ID quy tắc áp dụng cho mã đơn
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderCodePatternType = 'prefix_only' | 'date_only' | 'prefix_and_date';

export interface OrderCodeRule {
  id: string;
  name: string; // Tên quy tắc (ví dụ: "Đơn bán hàng (DH-)", "Đơn nội bộ (NB-)")
  patternType: OrderCodePatternType; // 'prefix_only' (Ký tự), 'date_only' (Ngày tháng), 'prefix_and_date' (Ký tự + ngày tháng)
  prefix: string; // Ví dụ: "DH", "NB"
  dateFormat?: 'YYYYMMDD' | 'YYMMDD' | 'DDMMYYYY' | 'YYYY-MM-DD'; // Định dạng ngày nếu dùng ngày
  separator: string; // Dấu ngăn cách: '-', ';', ',', '/', '_' hoặc để trống ''
  minDigits: number; // Số chữ số tối thiểu STT: 1 (1, 2, 3...) hoặc 2 (01, 02...), 3, 4
  isDefault: boolean; // Quy tắc mặc định
  createdAt?: string;
}

export interface PurchaseItem {
  id: string;
  productCode: string; // Mã Hàng hóa
  productName: string; // Tên Hàng hóa
  purchaseUnit: string; // ĐVT_Mua
  quantity: number; // Số lượng
  unitPrice: number; // Đơn giá nhập (10 số thập phân)
  amount: number; // Thành tiền từng mặt hàng
  vatRate: number; // Thuế suất thuế GTGT từng mặt hàng
  vatAmount: number; // Tiền thuế GTGT từng mặt hàng
  totalAmount: number; // Thành tiền sau thuế
  cumulativeQuantity?: number; // SL nhập lũy kế từng mặt hàng
}

export interface PurchaseBill {
  id: string;
  billNo: string; // Mã phiếu (Bill No)
  purchaseDate: string; // Ngày nhập (YYYY-MM-DD)
  supplierCode: string; // MST hoặc Mã đơn vị CC
  supplierTaxCode: string; // MST đơn vị CC
  supplierName: string; // Tên Đơn vị CC
  items: PurchaseItem[];
  subtotal: number; // Thành tiền tổng Bill No
  totalVat: number; // Tổng thuế GTGT
  totalAmount: number; // TT thanh toán
  paidAmount: number; // Đã thanh toán
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtPayment {
  id: string;
  code: string;
  type: 'customer' | 'supplier'; // Khách hàng hay Nhà cung cấp
  entityId: string; // ID khách hoặc NCC
  entityCode: string;
  entityName: string;
  date: string; // Ngày trả nợ
  amount: number; // Số tiền trả nợ
  paymentMethod: PaymentMethod;
  notes: string;
  createdAt: string;
}

export interface AppSettings {
  companyName: string;
  taxCode: string;
  address: string;
  phone: string;
  email: string;
  bankAccount: string;
  bankName: string;
  representative: string;
  logoUrl?: string;
  // Decimal configs
  purchasePriceDecimals: number; // Đơn giá mua (mặc định 10)
  salePriceDecimals: number; // Đơn giá bán trước thuế (mặc định 2)
  postTaxSalePriceDecimals?: number; // Đơn giá bán sau thuế (mặc định -2 làm tròn đến hàng chục)
  costPriceDecimals: number; // Giá vốn / Đơn giá xuất (mặc định 2)
  inventoryMethod: 'FIFO'; // Nhập trước xuất trước cố định
  driveFolder: string; // Thư mục Google Drive: SaleManager-Smart
  databaseId?: string; // ID của cơ sở dữ liệu
  databaseName?: string; // Tên cơ sở dữ liệu / Tên file
  spreadsheetId?: string; // ID Google Sheet kết nối
  orderCodeRules?: OrderCodeRule[]; // Danh sách quy tắc tạo mã đơn bán hàng
  defaultOrderCodeRuleId?: string; // ID quy tắc tạo mã đơn mặc định
}

export interface DatabaseProfile {
  id: string; // Mã định danh CSDL (local key hoặc sheet ID)
  name: string; // Tên hiển thị CSDL (VD: CSDL Công ty ABC hoặc Dữ liệu mẫu Demo)
  companyName: string; // Tên đơn vị
  taxCode: string; // Mã số thuế
  address: string; // Địa chỉ
  isDemo: boolean; // Có phải là dữ liệu mẫu demo hay không
  spreadsheetId?: string; // ID Google Sheet riêng biệt
  spreadsheetUrl?: string; // Đường dẫn Google Sheet
  createdAt: string;
  lastUsedAt: string;
}

export interface AppData {
  databaseId?: string;
  databaseName?: string;
  isDemo?: boolean; // Cờ nhận diện dữ liệu mẫu Demo
  spreadsheetId?: string;
  users: AppUser[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  orders: Order[];
  purchases: PurchaseBill[];
  debtPayments: DebtPayment[];
  settings: AppSettings;
  lastSyncedAt?: string;
  syncSource?: 'local' | 'google_drive';
}
