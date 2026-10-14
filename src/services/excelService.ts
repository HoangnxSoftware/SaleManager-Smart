import * as XLSX from 'xlsx';
import { Customer, Order, Product, PurchaseBill, Supplier } from '../types';

/**
 * Downloads an Excel workbook
 */
function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

/**
 * Exports orders list to Excel
 */
export function exportOrdersToExcel(orders: Order[]) {
  const data = orders.map((o, idx) => ({
    'STT': idx + 1,
    'Mã đơn hàng': o.orderCode,
    'Ngày đặt': o.orderDate,
    'Mã khách hàng': o.customerCode,
    'Tên khách hàng': o.customerName,
    'Số điện thoại': o.customerTaxCode || '',
    'Địa chỉ giao hàng': o.customerAddress,
    'Số lượng mặt hàng': o.items.length,
    'Tổng tiền trước thuế': o.totalPreTax,
    'Chiết khấu đơn': o.orderDiscount,
    'Tiền thuế GTGT': o.totalVat,
    'Tổng tiền thanh toán': o.totalAmount,
    'Số tiền đã trả': o.paidAmount,
    'Công nợ còn lại': o.debtAmount,
    'Phương thức thanh toán': o.paymentMethod === 'cash' ? 'Tiền mặt' : o.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thẻ',
    'Trạng thái giao hàng': o.deliveryStatus === 'pending' ? 'Chờ giao' : o.deliveryStatus === 'delivering' ? 'Đang giao' : o.deliveryStatus === 'completed' ? 'Hoàn thành' : 'Đã hủy',
    'Người tạo đơn/Bán hàng': o.createdByName || '',
    'Ghi chú': o.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachDonHang');
  downloadWorkbook(wb, `Danh_Sach_Don_Hang_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports detailed order items to Excel with exact columns and first-row grouping
 */
export function exportOrderDetailsToExcel(orders: Order[]) {
  const rows: any[] = [];
  let stt = 1;

  for (const o of orders) {
    if (!o.items || o.items.length === 0) continue;

    // Calculate tax and subtotal breakdown for this order
    const taxMap = new Map<number, number>();
    const subtotalMap = new Map<number, number>();
    o.items.forEach((it) => {
      const rate = it.vatRate || 0;
      taxMap.set(rate, (taxMap.get(rate) || 0) + (it.vatAmount || 0));
      subtotalMap.set(rate, (subtotalMap.get(rate) || 0) + (it.subtotal || 0));
    });
    const taxBreakdownStr = Array.from(taxMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rate, amt]) => `Thuế ${rate}%: ${amt.toLocaleString('vi-VN')} ₫`)
      .join('; ');
    const subtotalBreakdownStr = Array.from(subtotalMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rate, amt]) => `Thuế ${rate}%: ${amt.toLocaleString('vi-VN')} ₫`)
      .join('; ');

    const orderSubtotal = o.totalPreTax || o.items.reduce((sum, it) => sum + (it.subtotal || 0), 0);

    o.items.forEach((item, idx) => {
      const isFirst = idx === 0;
      rows.push({
        'STT': stt++,
        'Mã đơn': isFirst ? o.orderCode : '',
        'Ngày tháng': isFirst ? o.orderDate : '',
        'Tên khách hàng': isFirst ? o.customerName : '',
        'MST': isFirst ? (o.customerTaxCode || '') : '',
        'CCCD': isFirst ? (o.customerIdCard || '') : '',
        'Địa chỉ': isFirst ? (o.customerAddress || '') : '',
        'Mã HH': item.productCode,
        'Tên HH': item.productName,
        'ĐVT_Bán': item.saleUnit,
        'Số lượng': item.quantity,
        'Đơn giá bán trước thuế': Number(item.preTaxPrice.toFixed(2)),
        'Thành tiền từng mặt hàng': item.subtotal,
        'Chiết khấu giảm giá từng mặt hàng': item.itemDiscount || 0,
        'Thuế suất GTGT từng mặt hàng (%)': item.vatRate || 0,
        'Thuế GTGT từng mặt hàng': item.vatAmount || 0,
        'Tổng TT từng mặt hàng': item.totalAmount,
        'Tổng thành tiền đơn hàng': isFirst ? orderSubtotal : '',
        'Chiết khấu giảm giá tổng đơn hàng': isFirst ? (o.orderDiscount || 0) : '',
        'Tổng thuế GTGT': isFirst ? (o.totalVat || 0) : '',
        'Tổng tiền thanh toán': isFirst ? o.totalAmount : '',
        'Tổng thành tiền theo từng thuế suất': isFirst ? subtotalBreakdownStr : '',
        'Tổng thuế GTGT theo từng thuế suất': isFirst ? taxBreakdownStr : '',
        'Đơn giá bán sau thuế': item.postTaxPrice || Number((item.preTaxPrice * (1 + (item.vatRate || 0) / 100)).toFixed(2)),
      });
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ChiTietDonHang');
  downloadWorkbook(wb, `Chi_Tiet_Don_Hang_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports Purchases list to Excel
 */
export function exportPurchasesToExcel(purchases: PurchaseBill[]) {
  const rows: any[] = [];
  let stt = 1;

  for (const bill of purchases) {
    if (!bill.items || bill.items.length === 0) continue;
    bill.items.forEach((item, idx) => {
      const isFirst = idx === 0;
      rows.push({
        'STT': stt++,
        'Mã phiếu (Bill No)': isFirst ? bill.billNo : '',
        'Ngày nhập': isFirst ? bill.purchaseDate : '',
        'MST': isFirst ? (bill.supplierTaxCode || '') : '',
        'Đơn vị CC': isFirst ? bill.supplierCode : '',
        'Tên Đơn vị CC': isFirst ? bill.supplierName : '',
        'Mã HH': item.productCode,
        'Tên Hàng Hóa': item.productName,
        'ĐVT_Mua': item.purchaseUnit,
        'Số lượng': item.quantity,
        'Đơn giá nhập': item.unitPrice,
        'Thành tiền': item.amount,
        'Thuế suất (%)': item.vatRate,
        'Tiền thuế GTGT': item.vatAmount,
        'Thành tiền tổng Bill': isFirst ? bill.subtotal : '',
        'Tổng thuế GTGT': isFirst ? bill.totalVat : '',
        'TT thanh toán': isFirst ? bill.totalAmount : '',
        'Trạng thái': isFirst ? (bill.paymentStatus === 'paid' ? 'Đã thanh toán' : bill.paymentStatus === 'partial' ? 'Còn nợ' : 'Chưa thanh toán') : '',
      });
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'NhapHangChiTiet');
  downloadWorkbook(wb, `Danh_Sach_Nhap_Kho_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports products to Excel
 */
export function exportProductsToExcel(products: Product[]) {
  const rows = products.map((p, idx) => ({
    'STT': idx + 1,
    'Mã HH': p.code,
    'Tên HH': p.name,
    'ĐVT_Mua': p.purchaseUnit,
    'Thuế suất (%)': p.vatRate,
    'SL quy đổi': p.conversionRate,
    'ĐVT_Bán': p.saleUnit,
    'Nhóm/loại HH': p.category,
    'Tỷ suất lợi nhuận (%)': p.profitMargin,
    'Giá bán mặc định (Sau thuế)': p.defaultSalePrice || '',
    'Biên độ giá (+/-)': p.priceVariance || '',
    'Ghi chú': p.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhMucSanPham');
  downloadWorkbook(wb, `Danh_Muc_San_Pham_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Downloads a sample Excel template for importing Orders
 */
export function downloadOrderTemplate() {
  const sample = [
    {
      'Mã đơn': 'DH-EXCEL-001',
      'Ngày (YYYY-MM-DD)': new Date().toISOString().slice(0, 10),
      'Mã KH': 'KH001',
      'Tên khách hàng': 'Công ty Cổ phần Xây dựng & Địa ốc Thăng Long',
      'Mã HH': 'LED-RD-18W',
      'Số lượng': 10,
      'Đơn giá trước thuế': 110000,
      'Thuế suất (%)': 10,
      'Chiết khấu mặt hàng': 0,
      'Chiết khấu tổng đơn': 0,
      'Đã thanh toán': 1210000,
      'Phương thức thanh toán': 'Tiền mặt',
      'Ghi chú': 'Đơn mẫu Excel',
    },
    {
      'Mã đơn': 'DH-EXCEL-001',
      'Ngày (YYYY-MM-DD)': new Date().toISOString().slice(0, 10),
      'Mã KH': 'KH001',
      'Tên khách hàng': 'Công ty Cổ phần Xây dựng & Địa ốc Thăng Long',
      'Mã HH': 'DAY-CAD-2X2.5',
      'Số lượng': 50,
      'Đơn giá trước thuế': 18000,
      'Thuế suất (%)': 10,
      'Chiết khấu mặt hàng': 0,
      'Chiết khấu tổng đơn': 0,
      'Đã thanh toán': 0,
      'Phương thức thanh toán': 'Tiền mặt',
      'Ghi chú': 'Mặt hàng 2 của đơn 001',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Don');
  downloadWorkbook(wb, 'Mau_Nhap_Don_Hang.xlsx');
}

/**
 * Downloads a sample Excel template for importing Purchases
 */
export function downloadPurchaseTemplate() {
  const sample = [
    {
      'Mã phiếu (Bill No)': 'PNK-EXCEL-001',
      'Ngày nhập (YYYY-MM-DD)': new Date().toISOString().slice(0, 10),
      'Mã NCC': 'NCC001',
      'Tên NCC': 'Công ty TNHH Sản Xuất Thiết Bị Điện Panasonic VN',
      'MST NCC': '0100112233',
      'Mã HH': 'O-CAM-PANA-WIDE',
      'Tên HH': 'Ổ cắm đôi 3 chấu Panasonic Wide series',
      'ĐVT_Mua': 'Chiếc',
      'Số lượng': 50,
      'Thành tiền': 3100000,
      'Thuế suất (%)': 10,
      'Đã trả': 3410000,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Kho');
  downloadWorkbook(wb, 'Mau_Nhap_Kho.xlsx');
}

/**
 * Exports customers to Excel
 */
export function exportCustomersToExcel(customers: Customer[]) {
  const rows = customers.map((c, idx) => ({
    'STT': idx + 1,
    'Mã KH': c.code,
    'Tên khách hàng': c.name,
    'Tên gợi nhớ': c.shortName,
    'Mã số thuế': c.taxCode || '',
    'Số CCCD': c.idCard || '',
    'Số điện thoại': c.phone || '',
    'Địa chỉ': c.address || '',
    'Loại KH': c.type === 'organization' ? 'Tổ chức' : 'Cá nhân',
    'Ghi chú': c.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhMucKhachHang');
  downloadWorkbook(wb, `Danh_Muc_Khach_Hang_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Downloads a sample Excel template for importing Customers
 */
export function downloadCustomerTemplate() {
  const sample = [
    {
      'Mã KH': 'KH001',
      'Tên khách hàng': 'Công ty Cổ phần Xây dựng Thăng Long',
      'Tên gợi nhớ': 'Xây dựng Thăng Long',
      'Mã số thuế': '0102345678',
      'Số CCCD': '',
      'Số điện thoại': '0243888999',
      'Địa chỉ': 'Tầng 12 Tòa Licogi 13, Thanh Xuân, Hà Nội',
      'Loại KH (Cá nhân/Tổ chức)': 'Tổ chức',
      'Ghi chú': 'Khách hàng dự án lớn',
    },
    {
      'Mã KH': 'KH002',
      'Tên khách hàng': 'Nguyễn Văn Thành',
      'Tên gợi nhớ': 'Anh Thành - Cầu Giấy',
      'Mã số thuế': '038194002345',
      'Số CCCD': '038194002345',
      'Số điện thoại': '0983112233',
      'Địa chỉ': '15 Duy Tân, Cầu Giấy, Hà Nội',
      'Loại KH (Cá nhân/Tổ chức)': 'Cá nhân',
      'Ghi chú': 'Khách lẻ thường xuyên',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Khach_Hang');
  downloadWorkbook(wb, 'Mau_Nhap_Khach_Hang.xlsx');
}

/**
 * Exports suppliers to Excel
 */
export function exportSuppliersToExcel(suppliers: Supplier[]) {
  const rows = suppliers.map((s, idx) => ({
    'STT': idx + 1,
    'Mã đơn vị CC': s.code,
    'Tên đơn vị cung cấp': s.name,
    'Tên gợi nhớ': s.shortName,
    'Mã Số Thuế': s.taxCode || '',
    'Số điện thoại': s.phone || '',
    'Địa chỉ': s.address || '',
    'Ghi chú': s.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhMucNhaCungCap');
  downloadWorkbook(wb, `Danh_Muc_Nha_Cung_Cap_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Downloads a sample Excel template for importing Suppliers
 */
export function downloadSupplierTemplate() {
  const sample = [
    {
      'Mã NCC': 'NCC001',
      'Tên đơn vị cung cấp': 'Công ty TNHH Sản Xuất Thiết Bị Điện Panasonic VN',
      'Tên gợi nhớ': 'Panasonic VN',
      'Mã Số Thuế': '0100112233',
      'Số điện thoại': '02437654321',
      'Địa chỉ': 'KCN Thăng Long, Đông Anh, Hà Nội',
      'Ghi chú': 'Nhà cung cấp thiết bị điện chính hãng',
    },
    {
      'Mã NCC': 'NCC002',
      'Tên đơn vị cung cấp': 'Công ty Cổ phần Dây Cáp Điện Cadivi',
      'Tên gợi nhớ': 'Cadivi',
      'Mã Số Thuế': '0300381857',
      'Số điện thoại': '02838299443',
      'Địa chỉ': '70-72 Nam Kỳ Khởi Nghĩa, Q.1, TP.HCM',
      'Ghi chú': 'Nhà cung cấp dây cáp điện hàng đầu',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nha_Cung_Cap');
  downloadWorkbook(wb, 'Mau_Nhap_Nha_Cung_Cap.xlsx');
}

/**
 * Downloads a sample Excel template for importing Products
 */
export function downloadProductTemplate() {
  const sample = [
    {
      'Mã HH': 'LED-RD-18W',
      'Tên HH': 'Đèn LED âm trần Rạng Đông 18W Tròn Ánh sáng Trắng',
      'ĐVT_Mua': 'Hộp',
      'Thuế suất (%)': 10,
      'SL quy đổi': 1,
      'ĐVT_Bán': 'Cái',
      'Nhóm/loại HH': 'Thiết bị chiếu sáng',
      'Tỷ suất lợi nhuận (%)': 25,
      'Giá bán mặc định (Sau thuế)': 5580,
      'Biên độ giá (+/-)': 100,
      'Ghi chú': 'Bảo hành 2 năm',
    },
    {
      'Mã HH': 'DAY-CAD-2X2.5',
      'Tên HH': 'Dây điện đôi Cadivi 2x2.5mm² đồng bọc PVC',
      'ĐVT_Mua': 'Cuộn',
      'Thuế suất (%)': 10,
      'SL quy đổi': 100,
      'ĐVT_Bán': 'Mét',
      'Nhóm/loại HH': 'Dây cáp điện',
      'Tỷ suất lợi nhuận (%)': 18,
      'Giá bán mặc định (Sau thuế)': 18500,
      'Biên độ giá (+/-)': 500,
      'Ghi chú': '1 cuộn = 100 mét',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_SanPham');
  downloadWorkbook(wb, 'Mau_Nhap_San_Pham.xlsx');
}

/**
 * Downloads a sample Excel template for importing Customer Debt Collections (Thu tiền nợ khách hàng)
 */
export function downloadCustomerDebtTemplate() {
  const sample = [
    {
      'STT': 1,
      'Mã phiếu': 'PT-001',
      'Ngày thu (YYYY-MM-DD)': new Date().toISOString().slice(0, 10),
      'Mã KH': 'KH001',
      'Tên khách hàng': 'Công ty TNHH Cơ điện Ánh Sáng',
      'Số tiền thu': 15000000,
      'Phương thức thanh toán': 'Chuyển khoản',
      'Ghi chú': 'Thu nợ tiền hàng đợt 1',
    },
    {
      'STT': 2,
      'Mã phiếu': 'PT-002',
      'Ngày thu (YYYY-MM-DD)': new Date().toISOString().slice(0, 10),
      'Mã KH': 'KH002',
      'Tên khách hàng': 'Cửa hàng Thiết bị Điện Nhật Quang',
      'Số tiền thu': 5000000,
      'Phương thức thanh toán': 'Tiền mặt',
      'Ghi chú': 'Thu nợ mặt bằng và linh kiện',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Thu_No_Khach_Hang');
  downloadWorkbook(wb, 'Mau_Nhap_Thu_No_Khach_Hang.xlsx');
}

/**
 * Downloads a sample Excel template for importing Supplier Debt Payments (Chi trả tiền nợ NCC)
 */
export function downloadSupplierDebtTemplate() {
  const sample = [
    {
      'STT': 1,
      'Mã phiếu': 'PC-001',
      'Ngày chi (YYYY-MM-DD)': new Date().toISOString().slice(0, 10),
      'Mã NCC': 'NCC001',
      'Tên nhà cung cấp': 'Công ty CP Phích nước Bóng đèn Rạng Đông',
      'Số tiền chi': 20000000,
      'Phương thức thanh toán': 'Chuyển khoản',
      'Ghi chú': 'Thanh toán tiền hàng bóng đèn LED',
    },
    {
      'STT': 2,
      'Mã phiếu': 'PC-002',
      'Ngày chi (YYYY-MM-DD)': new Date().toISOString().slice(0, 10),
      'Mã NCC': 'NCC002',
      'Tên nhà cung cấp': 'Công ty CP Dây cáp điện Việt Nam (Cadivi)',
      'Số tiền chi': 12500000,
      'Phương thức thanh toán': 'Chuyển khoản',
      'Ghi chú': 'Chi trả nợ đợt 2 dây cáp điện',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Chi_Tra_No_NCC');
  downloadWorkbook(wb, 'Mau_Nhap_Chi_Tra_No_NCC.xlsx');
}

/**
 * Parses Excel file into JSON rows
 */
export async function parseExcelFile(file: File): Promise<any[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
}


