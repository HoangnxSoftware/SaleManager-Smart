import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import {
  AppData,
  Order,
  Customer,
  Supplier,
  Product,
  PurchaseBill,
  DebtPayment,
} from '../types';
import { DEFAULT_ORDER_CODE_RULES } from './orderCodeService';
import { INITIAL_USERS, DEFAULT_SETTINGS } from './storage';

// Initialize Firebase if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không lấy được access token từ Google Auth.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const DRIVE_FOLDER_NAME = 'SaleManager-Smart';
const DEFAULT_SPREADSHEET_NAME = 'SaleManager_Smart_Database';

/**
 * Finds or automatically creates the folder 'SaleManager-Smart' on Google Drive
 */
export async function getOrCreateDriveFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${DRIVE_FOLDER_NAME}' and trashed=false`);
  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Lỗi kiểm tra thư mục Google Drive: ${errText}`);
  }

  const listData = await listRes.json();
  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id;
  }

  // Create folder if not yet existing
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Lỗi tạo thư mục '${DRIVE_FOLDER_NAME}': ${errText}`);
  }

  const createData = await createRes.json();
  return createData.id;
}

/**
 * Lists all Google Sheets database files inside the 'SaleManager-Smart' folder
 */
export async function listSpreadsheetsInFolder(
  accessToken: string
): Promise<Array<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }>> {
  const folderId = await getOrCreateDriveFolder(accessToken);
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);

  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,modifiedTime)&orderBy=modifiedTime desc`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listRes.ok) {
    return [];
  }

  const data = await listRes.json();
  return data.files || [];
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  appName?: string;
  version?: string;
  databaseId?: string;
  databaseName?: string;
  companyName?: string;
  taxCode?: string;
  address?: string;
  lastSyncedAt?: string;
  totalCustomers?: number;
  totalSuppliers?: number;
  totalProducts?: number;
  totalOrders?: number;
  totalPurchases?: number;
  totalDebtPayments?: number;
}

/**
 * Reads Metadata sheet from Google Spreadsheet to inspect companyName, taxCode, lastSyncedAt etc.
 */
export async function fetchSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata | null> {
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Metadata!A1:B35`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!metaRes.ok) {
      return null;
    }

    const json = await metaRes.json();
    const rows: string[][] = json.values || [];
    const meta: SpreadsheetMetadata = { spreadsheetId };

    for (const row of rows) {
      if (!row || row.length < 2) continue;
      const key = (row[0] || '').trim();
      const val = (row[1] || '').trim();

      if (key === 'appName') meta.appName = val;
      if (key === 'version') meta.version = val;
      if (key === 'databaseId') meta.databaseId = val;
      if (key === 'databaseName') meta.databaseName = val;
      if (key === 'companyName') meta.companyName = val;
      if (key === 'taxCode') meta.taxCode = val;
      if (key === 'address') meta.address = val;
      if (key === 'lastSyncedAt') meta.lastSyncedAt = val;
      if (key === 'totalCustomers') meta.totalCustomers = parseInt(val, 10) || 0;
      if (key === 'totalSuppliers') meta.totalSuppliers = parseInt(val, 10) || 0;
      if (key === 'totalProducts') meta.totalProducts = parseInt(val, 10) || 0;
      if (key === 'totalOrders') meta.totalOrders = parseInt(val, 10) || 0;
      if (key === 'totalPurchases') meta.totalPurchases = parseInt(val, 10) || 0;
      if (key === 'totalDebtPayments') meta.totalDebtPayments = parseInt(val, 10) || 0;
    }

    return meta;
  } catch (e) {
    console.error('Error fetching spreadsheet metadata:', e);
    return null;
  }
}

/**
 * Creates a dedicated isolated Google Spreadsheet inside 'SaleManager-Smart' folder for a new database
 */
export async function createDatabaseSpreadsheetOnDrive(
  accessToken: string,
  databaseName: string,
  companyName: string
): Promise<{ spreadsheetId: string; webUrl: string }> {
  const folderId = await getOrCreateDriveFolder(accessToken);
  const cleanTitle = `SaleManager_Smart_${databaseName || companyName || 'Database'}`.replace(/[\/\\?%*:|"<>]/g, '_');

  const sheetCreateRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: cleanTitle,
      },
      sheets: [
        { properties: { title: 'Metadata' } },
        { properties: { title: 'Customers' } },
        { properties: { title: 'Suppliers' } },
        { properties: { title: 'Products' } },
        { properties: { title: 'Orders' } },
        { properties: { title: 'Purchases' } },
        { properties: { title: 'DebtPayments' } },
      ],
    }),
  });

  if (!sheetCreateRes.ok) {
    const err = await sheetCreateRes.text();
    throw new Error(`Lỗi tạo Google Sheets mới: ${err}`);
  }

  const sheetData = await sheetCreateRes.json();
  const fileId = sheetData.spreadsheetId;

  // Move file into the SaleManager-Smart folder
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${folderId}&fields=id,parents`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const webUrl = `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
  return { spreadsheetId: fileId, webUrl };
}

/**
 * Finds or creates the spreadsheet inside 'SaleManager-Smart' folder
 */
export async function getOrCreateSpreadsheet(
  accessToken: string,
  folderId: string,
  customTitle?: string
): Promise<string> {
  const title = customTitle || DEFAULT_SPREADSHEET_NAME;
  const query = encodeURIComponent(`'${folderId}' in parents and name='${title}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Lỗi tìm file Google Sheets: ${errText}`);
  }

  const listData = await listRes.json();
  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id;
  }

  // Create new spreadsheet
  const sheetCreateRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        { properties: { title: 'Metadata' } },
        { properties: { title: 'Customers' } },
        { properties: { title: 'Suppliers' } },
        { properties: { title: 'Products' } },
        { properties: { title: 'Orders' } },
        { properties: { title: 'Purchases' } },
        { properties: { title: 'DebtPayments' } },
      ],
    }),
  });

  if (!sheetCreateRes.ok) {
    const err = await sheetCreateRes.text();
    throw new Error(`Lỗi tạo Google Sheets mới: ${err}`);
  }

  const sheetData = await sheetCreateRes.json();
  const fileId = sheetData.spreadsheetId;

  // Move file into the SaleManager-Smart folder
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${folderId}&fields=id,parents`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return fileId;
}

/**
 * Converts all cells to String and enforces Google Sheets 50,000 char limit per cell
 */
function toTextRow(row: any[]): string[] {
  return row.map((v) => {
    if (v === null || v === undefined) return '';
    const str = String(v);
    // Google Sheets strictly allows at most 50,000 chars per single cell.
    // Truncate safely at 45,000 to prevent API 400 error.
    if (str.length > 45000) {
      return str.substring(0, 45000);
    }
    return str;
  });
}

/**
 * Backup / Sync local AppData to Google Sheets inside 'SaleManager-Smart'
 * All data is formatted as Text to prevent losing leading zeros or precision.
 * CRITICAL RULE: If data.isDemo is true, block syncing to prevent overwriting real user data!
 */
export async function syncDataToGoogleSheets(
  data: AppData,
  accessToken: string,
  targetSpreadsheetId?: string
): Promise<{ spreadsheetId: string; webUrl: string }> {
  // Requirement: "nếu sử dụng dữ liệu mẫu thì không cho phép đồng bộ dữ liệu lên google sheet"
  if (data.isDemo) {
    throw new Error(
      'CẢNH BÁO: Bạn đang sử dụng dữ liệu mẫu Demo! Hệ thống không cho phép đồng bộ dữ liệu mẫu lên Google Sheets để tránh ghi đè dữ liệu kinh doanh thực tế. Vui lòng tạo cơ sở dữ liệu mới hoặc kết nối cơ sở dữ liệu thực.'
    );
  }

  const folderId = await getOrCreateDriveFolder(accessToken);
  const title = `SaleManager_Smart_${data.databaseName || data.settings.companyName || 'Database'}`.replace(/[\/\\?%*:|"<>]/g, '_');
  const spreadsheetId = targetSpreadsheetId || data.spreadsheetId || await getOrCreateSpreadsheet(accessToken, folderId, title);

  // Prepare sheets text payloads
  const now = new Date().toISOString();

  // Chunk serialized JSON backup (max 40,000 chars per chunk) to stay well under Google Sheets 50,000 character limit
  const serialized = JSON.stringify(data);
  const CHUNK_SIZE = 40000;
  const backupChunks: string[] = [];
  for (let i = 0; i < serialized.length; i += CHUNK_SIZE) {
    backupChunks.push(serialized.substring(i, i + CHUNK_SIZE));
  }

  // 1. Metadata
  const metadataRows: string[][] = [
    ['Key', 'Value', 'Description'],
    ['appName', 'SaleManager-Smart', 'Tên phần mềm'],
    ['version', '1.0.0', 'Phiên bản'],
    ['databaseId', data.databaseId || '', 'Mã CSDL'],
    ['databaseName', data.databaseName || data.settings.companyName || '', 'Tên CSDL'],
    ['companyName', data.settings.companyName, 'Tên đơn vị'],
    ['taxCode', data.settings.taxCode, 'Mã số thuế'],
    ['address', data.settings.address, 'Địa chỉ'],
    ['lastSyncedAt', now, 'Thời gian đồng bộ'],
    ['totalCustomers', String(data.customers.length), 'Số khách hàng'],
    ['totalSuppliers', String(data.suppliers.length), 'Số NCC'],
    ['totalProducts', String(data.products.length), 'Số hàng hóa'],
    ['totalOrders', String(data.orders.length), 'Số đơn hàng'],
    ['totalPurchases', String(data.purchases.length), 'Số phiếu nhập'],
    ['totalDebtPayments', String(data.debtPayments.length), 'Số phiếu thu chi nợ'],
    ['serializedBackupChunks', String(backupChunks.length), 'Số phần lưu trữ JSON backup'],
    ...backupChunks.map((chunk, idx) => [
      `serializedBackup_${idx}`,
      chunk,
      `Phần ${idx + 1}/${backupChunks.length} của dữ liệu JSON backup`
    ])
  ];

  // 2. Customers
  const customerRows: string[][] = [
    ['Mã KH', 'Tên khách hàng', 'Tên gợi nhớ', 'Mã số thuế', 'Số điện thoại', 'Địa chỉ', 'Loại KH', 'Số CCCD', 'Ghi chú', 'Ngày tạo'],
    ...data.customers.map(c => [
      c.code, c.name, c.shortName, c.taxCode, c.phone, c.address, c.type, c.idCard, c.notes, c.createdAt
    ])
  ];

  // 3. Suppliers
  const supplierRows: string[][] = [
    ['Mã NCC', 'Tên nhà cung cấp', 'Tên gợi nhớ', 'Mã số thuế', 'Số điện thoại', 'Địa chỉ', 'Ghi chú', 'Ngày tạo'],
    ...data.suppliers.map(s => [
      s.code, s.name, s.shortName, s.taxCode, s.phone, s.address, s.notes, s.createdAt
    ])
  ];

  // 4. Products
  const productRows: string[][] = [
    ['Mã HH', 'Tên hàng hóa', 'ĐVT Mua', 'Thuế suất (%)', 'SL quy đổi', 'ĐVT Bán', 'Nhóm hàng', 'Tỷ suất lợi nhuận (%)', 'Ghi chú'],
    ...data.products.map(p => [
      p.code, p.name, p.purchaseUnit, String(p.vatRate), String(p.conversionRate), p.saleUnit, p.category, String(p.profitMargin), p.notes || ''
    ])
  ];

  // 5. Orders
  const orderRows: string[][] = [
    ['Mã đơn', 'Ngày', 'Mã KH', 'Tên KH', 'MST', 'CCCD', 'Địa chỉ', 'Tổng trước thuế', 'Chiết khấu đơn', 'Thuế GTGT', 'Tổng thanh toán', 'Đã trả', 'Còn nợ', 'PT thanh toán', 'Trạng thái giao', 'Ghi chú', 'Chi tiết mặt hàng (JSON)'],
    ...data.orders.map(o => [
      o.orderCode, o.orderDate, o.customerCode, o.customerName, o.customerTaxCode, o.customerIdCard, o.customerAddress,
      String(o.totalPreTax), String(o.orderDiscount), String(o.totalVat), String(o.totalAmount), String(o.paidAmount), String(o.debtAmount),
      o.paymentMethod, o.deliveryStatus, o.notes || '', JSON.stringify(o.items)
    ])
  ];

  // 6. Purchases
  const purchaseRows: string[][] = [
    ['Mã phiếu (Bill No)', 'Ngày nhập', 'Mã NCC', 'MST NCC', 'Tên NCC', 'Thành tiền', 'Tổng thuế', 'Tổng thanh toán', 'Đã trả', 'Trạng thái TT', 'Chi tiết mặt hàng (JSON)'],
    ...data.purchases.map(b => [
      b.billNo, b.purchaseDate, b.supplierCode, b.supplierTaxCode, b.supplierName,
      String(b.subtotal), String(b.totalVat), String(b.totalAmount), String(b.paidAmount), b.paymentStatus, JSON.stringify(b.items)
    ])
  ];

  // 7. DebtPayments
  const debtRows: string[][] = [
    ['Mã phiếu', 'Loại', 'Mã đối tượng', 'Tên đối tượng', 'Ngày trả nợ', 'Số tiền', 'PT thanh toán', 'Ghi chú'],
    ...data.debtPayments.map(d => [
      d.code, d.type, d.entityCode, d.entityName, d.date, String(d.amount), d.paymentMethod, d.notes
    ])
  ];

  // Send batch clear & write to spreadsheet formatted entirely as text
  const payload = {
    valueInputOption: 'RAW',
    data: [
      { range: `Metadata!A1:C${Math.max(100, metadataRows.length + 5)}`, values: metadataRows.map(toTextRow) },
      { range: `Customers!A1:J${Math.max(500, customerRows.length + 5)}`, values: customerRows.map(toTextRow) },
      { range: `Suppliers!A1:H${Math.max(500, supplierRows.length + 5)}`, values: supplierRows.map(toTextRow) },
      { range: `Products!A1:I${Math.max(500, productRows.length + 5)}`, values: productRows.map(toTextRow) },
      { range: `Orders!A1:Q${Math.max(1000, orderRows.length + 5)}`, values: orderRows.map(toTextRow) },
      { range: `Purchases!A1:K${Math.max(1000, purchaseRows.length + 5)}`, values: purchaseRows.map(toTextRow) },
      { range: `DebtPayments!A1:H${Math.max(1000, debtRows.length + 5)}`, values: debtRows.map(toTextRow) },
    ],
  };

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(`Lỗi cập nhật dữ liệu Google Sheets: ${errText}`);
  }

  const webUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  return { spreadsheetId, webUrl };
}

/**
/**
 * Safely fetches values from an individual sheet tab
 */
async function fetchTabValuesSafe(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  range: string
): Promise<string[][]> {
  try {
    const escapedTab = `'${tabName.replace(/'/g, "''")}'!${range}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(escapedTab)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return (data.values || []) as string[][];
    }
  } catch (err) {
    console.debug(`Failed to fetch tab ${tabName}:`, err);
  }
  return [];
}

/**
 * Loads and restores data from a specific Google Spreadsheet in 'SaleManager-Smart'.
 * Guaranteed to parse human-readable rows from the 'Orders', 'Customers', 'Suppliers',
 * 'Products', 'Purchases', 'DebtPayments' sheets, as well as chunked serialized JSON backups.
 */
export async function loadDataFromGoogleSheets(
  accessToken: string,
  spreadsheetId?: string
): Promise<AppData | null> {
  let targetId = spreadsheetId;

  if (!targetId) {
    const folderId = await getOrCreateDriveFolder(accessToken);
    targetId = await getOrCreateSpreadsheet(accessToken, folderId);
  }

  // 1. Inspect sheet tabs to locate available sheets
  let sheetTitles: string[] = [];
  try {
    const sheetMetaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${targetId}?fields=sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (sheetMetaRes.ok) {
      const sJson = await sheetMetaRes.json();
      if (sJson.sheets && Array.isArray(sJson.sheets)) {
        sheetTitles = sJson.sheets.map((s: any) => s.properties?.title).filter(Boolean);
      }
    }
  } catch (err) {
    console.debug('Error checking sheet titles:', err);
  }

  const findTab = (regex: RegExp): string | null => {
    return sheetTitles.find((t) => regex.test(t)) || null;
  };

  const metaTab = findTab(/meta/i) || (sheetTitles.includes('Metadata') ? 'Metadata' : null);
  let ordersTab = findTab(/order|đơn hàng|don hang|donhang|bán hàng|ban hang|bán|danh sách đơn/i);
  const customersTab = findTab(/customer|khách hàng|khach hang|khachhang/i) || (sheetTitles.includes('Customers') ? 'Customers' : null);
  const suppliersTab = findTab(/supplier|nhà cung cấp|nha cung cap|nhacungcap/i) || (sheetTitles.includes('Suppliers') ? 'Suppliers' : null);
  const productsTab = findTab(/product|hàng hóa|hang hoa|hanghoa|san pham|sản phẩm|sanpham/i) || (sheetTitles.includes('Products') ? 'Products' : null);
  const purchasesTab = findTab(/purchase|nhập kho|nhap kho|nhapkho/i) || (sheetTitles.includes('Purchases') ? 'Purchases' : null);
  const debtsTab = findTab(/debt|công nợ|cong no|congno/i) || (sheetTitles.includes('DebtPayments') ? 'DebtPayments' : null);

  // If ordersTab not found but sheet has a non-meta sheet, pick it
  if (!ordersTab && sheetTitles.length > 0) {
    const candidate = sheetTitles.find((t) => !/meta/i.test(t));
    ordersTab = candidate || sheetTitles[0];
  } else if (!ordersTab) {
    ordersTab = 'Orders';
  }

  // 2. Query tabs safely: only query existing tabs to prevent 400 Bad Request
  const tabQueries: Array<{ key: string; title: string; range: string }> = [];
  if (metaTab) tabQueries.push({ key: 'meta', title: metaTab, range: 'A1:C300' });
  if (ordersTab) tabQueries.push({ key: 'orders', title: ordersTab, range: 'A1:Z5000' });
  if (customersTab) tabQueries.push({ key: 'customers', title: customersTab, range: 'A1:Z2000' });
  if (suppliersTab) tabQueries.push({ key: 'suppliers', title: suppliersTab, range: 'A1:Z2000' });
  if (productsTab) tabQueries.push({ key: 'products', title: productsTab, range: 'A1:Z2000' });
  if (purchasesTab) tabQueries.push({ key: 'purchases', title: purchasesTab, range: 'A1:Z5000' });
  if (debtsTab) tabQueries.push({ key: 'debts', title: debtsTab, range: 'A1:Z2000' });

  let metaRows: string[][] = [];
  let orderRows: string[][] = [];
  let customerRows: string[][] = [];
  let supplierRows: string[][] = [];
  let productRows: string[][] = [];
  let purchaseRows: string[][] = [];
  let debtRows: string[][] = [];

  let batchSucceeded = false;
  if (tabQueries.length > 0) {
    try {
      const batchRanges = tabQueries.map((q) => encodeURIComponent(`'${q.title.replace(/'/g, "''")}'!${q.range}`));
      const batchQuery = batchRanges.map((r) => `ranges=${r}`).join('&');
      const batchRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values:batchGet?${batchQuery}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (batchRes.ok) {
        const batchData = await batchRes.json();
        const valRanges = (batchData.valueRanges || []) as Array<{ range: string; values?: string[][] }>;
        tabQueries.forEach((q, idx) => {
          const vals = valRanges[idx]?.values || [];
          if (q.key === 'meta') metaRows = vals;
          else if (q.key === 'orders') orderRows = vals;
          else if (q.key === 'customers') customerRows = vals;
          else if (q.key === 'suppliers') supplierRows = vals;
          else if (q.key === 'products') productRows = vals;
          else if (q.key === 'purchases') purchaseRows = vals;
          else if (q.key === 'debts') debtRows = vals;
        });
        batchSucceeded = true;
      }
    } catch (e) {
      console.debug('Batch get error, falling back to individual tab queries:', e);
    }
  }

  // Fallback: If batchGet failed, fetch individual tabs safely
  if (!batchSucceeded) {
    const queriesToRun = tabQueries.length > 0 ? tabQueries : [
      { key: 'orders', title: ordersTab, range: 'A1:Z5000' },
      { key: 'meta', title: 'Metadata', range: 'A1:C300' },
    ];
    const results = await Promise.all(
      queriesToRun.map(async (q) => ({
        key: q.key,
        values: await fetchTabValuesSafe(accessToken, targetId!, q.title, q.range),
      }))
    );
    results.forEach(({ key, values }) => {
      if (key === 'meta') metaRows = values;
      else if (key === 'orders') orderRows = values;
      else if (key === 'customers') customerRows = values;
      else if (key === 'suppliers') supplierRows = values;
      else if (key === 'products') productRows = values;
      else if (key === 'purchases') purchaseRows = values;
      else if (key === 'debts') debtRows = values;
    });
  }

  // 3. Parse Metadata Key-Value pairs
  const metaObj: Record<string, string> = {};
  for (const row of metaRows) {
    if (row && row[0] && row[1]) {
      metaObj[row[0].trim()] = String(row[1]).trim();
    }
  }

  // 4. Try parsing serialized backup from Metadata if available
  let parsedFromJson: AppData | null = null;
  const totalChunks = parseInt(metaObj['serializedBackupChunks'] || '0', 10);
  if (totalChunks > 0) {
    const chunkMap = new Map<number, string>();
    for (const row of metaRows) {
      if (row[0] && row[0].startsWith('serializedBackup_') && row[1]) {
        const idx = parseInt(row[0].replace('serializedBackup_', ''), 10);
        if (!isNaN(idx)) {
          chunkMap.set(idx, row[1]);
        }
      }
    }
    if (chunkMap.size > 0) {
      let combined = '';
      for (let i = 0; i < totalChunks; i++) {
        combined += chunkMap.get(i) || '';
      }
      try {
        parsedFromJson = JSON.parse(combined) as AppData;
      } catch (e) {
        console.error('Failed to parse chunked serialized backup:', e);
      }
    }
  }

  if (!parsedFromJson && metaObj['serializedBackup']) {
    try {
      parsedFromJson = JSON.parse(metaObj['serializedBackup']) as AppData;
    } catch (e) {
      console.error('Failed to parse single-cell serialized backup:', e);
    }
  }

  // 5. Parse human-readable Orders from the 'Orders' sheet tab with flexible column header mapping
  const parsedSheetOrders: Order[] = [];
  if (orderRows.length > 0) {
    const headerRow = orderRows[0] || [];
    const colMap: Record<string, number> = {};
    headerRow.forEach((c, idx) => {
      const clean = String(c || '').trim().toLowerCase();
      colMap[clean] = idx;
    });

    const getColIdx = (aliases: string[], fallbackIdx: number): number => {
      for (const a of aliases) {
        const lower = a.toLowerCase();
        for (const [header, idx] of Object.entries(colMap)) {
          if (header === lower || header.includes(lower)) {
            return idx;
          }
        }
      }
      return fallbackIdx;
    };

    const idxCode = getColIdx(['mã đơn', 'mã đơn hàng', 'số đơn', 'số chứng từ', 'code'], 0);
    const idxDate = getColIdx(['ngày', 'ngày đơn', 'date'], 1);
    const idxCustCode = getColIdx(['mã kh', 'mã khách hàng', 'mã khách'], 2);
    const idxCustName = getColIdx(['tên kh', 'tên khách hàng', 'tên khách'], 3);
    const idxTax = getColIdx(['mst', 'mã số thuế', 'tax'], 4);
    const idxIdCard = getColIdx(['cccd', 'cmnd'], 5);
    const idxAddr = getColIdx(['địa chỉ', 'address'], 6);
    const idxPreTax = getColIdx(['tổng trước thuế', 'tiền hàng', 'trước thuế', 'tiền trước thuế', 'subtotal'], 7);
    const idxDisc = getColIdx(['chiết khấu đơn', 'chiết khấu', 'giảm giá', 'discount'], 8);
    const idxVat = getColIdx(['thuế gtgt', 'tiền thuế', 'vat'], 9);
    const idxTotal = getColIdx(['tổng thanh toán', 'tổng tiền', 'thành tiền', 'total'], 10);
    const idxPaid = getColIdx(['đã trả', 'đã thanh toán', 'paid'], 11);
    const idxDebt = getColIdx(['còn nợ', 'nợ', 'debt'], 12);
    const idxMethod = getColIdx(['pt thanh toán', 'phương thức', 'hình thức', 'payment'], 13);
    const idxStatus = getColIdx(['trạng thái', 'tình trạng', 'status'], 14);
    const idxNotes = getColIdx(['ghi chú', 'notes'], 15);
    const idxItems = getColIdx(['chi tiết mặt hàng', 'chi tiết', 'items'], 16);

    const firstCell = String(headerRow[idxCode] !== undefined ? headerRow[idxCode] : (headerRow[0] || '')).trim().toLowerCase();
    const isFirstRowHeader = /mã|stt|ngày|code|date|đơn/i.test(firstCell);
    const startRowIdx = isFirstRowHeader ? 1 : 0;

    for (let i = startRowIdx; i < orderRows.length; i++) {
      const r = orderRows[i];
      if (!r || r.length === 0) continue;

      let code = String(r[idxCode] !== undefined ? r[idxCode] : (r[0] || '')).trim();
      // If code is empty or literally the header
      if (!code || /^(mã đơn|mã đơn hàng|stt|code)$/i.test(code)) {
        // If col 1 has an order code
        if (r[1] && !/^(mã đơn|stt)$/i.test(String(r[1]))) {
          code = String(r[1]).trim();
        } else {
          continue;
        }
      }

      const ordDate = String(r[idxDate] || r[1] || '').trim() || new Date().toISOString().slice(0, 10);
      const custCode = String(r[idxCustCode] || r[2] || '').trim();
      const custName = String(r[idxCustName] || r[3] || '').trim();
      const custTax = String(r[idxTax] || r[4] || '').trim();
      const custCard = String(r[idxIdCard] || r[5] || '').trim();
      const custAddr = String(r[idxAddr] || r[6] || '').trim();
      const preTax = Number(r[idxPreTax] !== undefined ? r[idxPreTax] : r[7]) || 0;
      const ordDisc = Number(r[idxDisc] !== undefined ? r[idxDisc] : r[8]) || 0;
      const vat = Number(r[idxVat] !== undefined ? r[idxVat] : r[9]) || 0;
      const tot = Number(r[idxTotal] !== undefined ? r[idxTotal] : r[10]) || 0;
      const paid = Number(r[idxPaid] !== undefined ? r[idxPaid] : r[11]) || 0;
      const debt = Number(r[idxDebt] !== undefined ? r[idxDebt] : r[12]) || 0;
      const pMethod = ((r[idxMethod] !== undefined ? r[idxMethod] : r[13]) || 'cash') as any;
      const dStatus = ((r[idxStatus] !== undefined ? r[idxStatus] : r[14]) || 'pending') as any;
      const notes = String((r[idxNotes] !== undefined ? r[idxNotes] : r[15]) || '');

      let items: any[] = [];
      const itemsRaw = r[idxItems] !== undefined ? r[idxItems] : r[16];
      if (itemsRaw) {
        try {
          const parsedItems = JSON.parse(itemsRaw);
          if (Array.isArray(parsedItems) && parsedItems.length > 0) {
            items = parsedItems;
          }
        } catch {
          // Ignore json parse error and fallback
        }
      }

      if (items.length === 0) {
        items = [
          {
            id: `oi-${code}-1`,
            productCode: 'PROD',
            productName: `Mặt hàng theo đơn ${code}`,
            saleUnit: 'Cái',
            quantity: 1,
            preTaxPrice: preTax,
            postTaxPrice: tot,
            itemDiscount: 0,
            vatRate: preTax > 0 ? Math.round((vat / preTax) * 100) : 0,
            vatAmount: vat,
            subtotal: preTax,
            totalAmount: tot,
          },
        ];
      }

      parsedSheetOrders.push({
        id: `ord-${code}`,
        orderCode: code,
        orderDate: ordDate,
        customerId: `cust-${custCode || 'unknown'}`,
        customerCode: custCode,
        customerName: custName || 'Khách hàng',
        customerTaxCode: custTax,
        customerIdCard: custCard,
        customerAddress: custAddr,
        items,
        itemDiscountTotal: 0,
        orderDiscount: ordDisc,
        orderDiscountPercent: 0,
        totalPreTax: preTax,
        totalVat: vat,
        totalAmount: tot,
        paymentMethod: pMethod,
        paidAmount: paid,
        debtAmount: debt,
        deliveryStatus: dStatus,
        notes,
        createdById: 'admin-1',
        createdByName: 'Admin',
        createdAt: ordDate + 'T08:00:00.000Z',
        updatedAt: ordDate + 'T08:00:00.000Z',
      });
    }
  }

  // 6. Parse human-readable Customers
  const parsedSheetCustomers: Customer[] = [];
  if (customerRows.length > 1) {
    for (let i = 1; i < customerRows.length; i++) {
      const r = customerRows[i];
      if (!r || !r[0] || !String(r[0]).trim()) continue;
      const code = String(r[0]).trim();
      if (code === 'Mã KH') continue;
      parsedSheetCustomers.push({
        id: `cust-${code}`,
        code,
        name: String(r[1] || code).toUpperCase(),
        shortName: String(r[2] || ''),
        taxCode: String(r[3] || ''),
        phone: String(r[4] || ''),
        address: String(r[5] || ''),
        type: (r[6] || 'corporate') as any,
        idCard: String(r[7] || ''),
        notes: String(r[8] || ''),
        createdAt: String(r[9] || new Date().toISOString().slice(0, 10)),
      });
    }
  }

  // 7. Parse human-readable Suppliers
  const parsedSheetSuppliers: Supplier[] = [];
  if (supplierRows.length > 1) {
    for (let i = 1; i < supplierRows.length; i++) {
      const r = supplierRows[i];
      if (!r || !r[0] || !String(r[0]).trim()) continue;
      const code = String(r[0]).trim();
      if (code === 'Mã NCC') continue;
      parsedSheetSuppliers.push({
        id: `sup-${code}`,
        code,
        name: String(r[1] || code).toUpperCase(),
        shortName: String(r[2] || ''),
        taxCode: String(r[3] || ''),
        phone: String(r[4] || ''),
        address: String(r[5] || ''),
        notes: String(r[6] || ''),
        createdAt: String(r[7] || new Date().toISOString().slice(0, 10)),
      });
    }
  }

  // 8. Parse human-readable Products
  const parsedSheetProducts: Product[] = [];
  if (productRows.length > 1) {
    for (let i = 1; i < productRows.length; i++) {
      const r = productRows[i];
      if (!r || !r[0] || !String(r[0]).trim()) continue;
      const code = String(r[0]).trim();
      if (code === 'Mã HH') continue;
      parsedSheetProducts.push({
        id: `prod-${code}`,
        code,
        name: String(r[1] || code),
        purchaseUnit: String(r[2] || 'Cái'),
        vatRate: Number(r[3]) || 0,
        conversionRate: Number(r[4]) || 1,
        saleUnit: String(r[5] || 'Cái'),
        category: String(r[6] || 'Hàng hóa'),
        profitMargin: Number(r[7]) || 15,
        notes: String(r[8] || ''),
      });
    }
  }

  // 9. Parse human-readable Purchases
  const parsedSheetPurchases: PurchaseBill[] = [];
  if (purchaseRows.length > 1) {
    for (let i = 1; i < purchaseRows.length; i++) {
      const r = purchaseRows[i];
      if (!r || !r[0] || !String(r[0]).trim()) continue;
      const billNo = String(r[0]).trim();
      if (billNo === 'Mã phiếu (Bill No)' || billNo === 'Mã phiếu') continue;

      const pDate = String(r[1] || '').trim() || new Date().toISOString().slice(0, 10);
      const sCode = String(r[2] || '').trim();
      const sTax = String(r[3] || '').trim();
      const sName = String(r[4] || '').trim();
      const sub = Number(r[5]) || 0;
      const vat = Number(r[6]) || 0;
      const tot = Number(r[7]) || 0;
      const paid = Number(r[8]) || 0;
      const pStatus = (r[9] || 'paid') as any;

      let items: any[] = [];
      if (r[10]) {
        try {
          const pItems = JSON.parse(r[10]);
          if (Array.isArray(pItems)) items = pItems;
        } catch {}
      }

      parsedSheetPurchases.push({
        id: `pur-${billNo}`,
        billNo,
        purchaseDate: pDate,
        supplierCode: sCode,
        supplierName: sName || 'Nhà cung cấp',
        supplierTaxCode: sTax,
        items,
        subtotal: sub,
        totalVat: vat,
        totalAmount: tot,
        paidAmount: paid,
        paymentStatus: pStatus,
        createdById: 'admin-1',
        createdAt: pDate + 'T08:00:00.000Z',
        updatedAt: pDate + 'T08:00:00.000Z',
      });
    }
  }

  // 10. Parse human-readable DebtPayments
  const parsedSheetDebts: DebtPayment[] = [];
  if (debtRows.length > 1) {
    for (let i = 1; i < debtRows.length; i++) {
      const r = debtRows[i];
      if (!r || !r[0] || !String(r[0]).trim()) continue;
      const code = String(r[0]).trim();
      if (code === 'Mã phiếu') continue;
      parsedSheetDebts.push({
        id: `debt-${code}`,
        code,
        type: (r[1] === 'supplier' || r[1] === 'Chi trả nợ NCC' ? 'supplier' : 'customer') as any,
        entityId: `ent-${r[2] || ''}`,
        entityCode: String(r[2] || ''),
        entityName: String(r[3] || ''),
        date: String(r[4] || new Date().toISOString().slice(0, 10)),
        amount: Number(r[5]) || 0,
        paymentMethod: (r[6] || 'cash') as any,
        notes: String(r[7] || ''),
        createdAt: String(r[4] || new Date().toISOString().slice(0, 10)) + 'T08:00:00.000Z',
      });
    }
  }

  // 11. Synthesize final AppData
  let finalResult: AppData;

  if (parsedFromJson) {
    finalResult = parsedFromJson;
    // CRITICAL: If sheet tab 'Orders' has orders, ensure they are present in finalResult!
    if (parsedSheetOrders.length > 0) {
      if (!finalResult.orders || finalResult.orders.length === 0) {
        finalResult.orders = parsedSheetOrders;
      } else {
        const existingCodes = new Set(finalResult.orders.map((o) => o.orderCode));
        const missing = parsedSheetOrders.filter((o) => !existingCodes.has(o.orderCode));
        if (missing.length > 0) {
          finalResult.orders = [...finalResult.orders, ...missing];
        }
        // Update any existing orders that might have been updated directly on Google Sheets
        parsedSheetOrders.forEach((so) => {
          const idx = finalResult.orders.findIndex((o) => o.orderCode === so.orderCode);
          if (idx !== -1) {
            finalResult.orders[idx] = {
              ...finalResult.orders[idx],
              ...so,
              items: (finalResult.orders[idx].items && finalResult.orders[idx].items.length > 0) ? finalResult.orders[idx].items : so.items,
            };
          }
        });
      }
    }
    // Also merge other entities if sheet tab has rows but backup was empty
    if (parsedSheetPurchases.length > 0 && (!finalResult.purchases || finalResult.purchases.length === 0)) {
      finalResult.purchases = parsedSheetPurchases;
    }
    if (parsedSheetCustomers.length > 0 && (!finalResult.customers || finalResult.customers.length === 0)) {
      finalResult.customers = parsedSheetCustomers;
    }
    if (parsedSheetSuppliers.length > 0 && (!finalResult.suppliers || finalResult.suppliers.length === 0)) {
      finalResult.suppliers = parsedSheetSuppliers;
    }
    if (parsedSheetProducts.length > 0 && (!finalResult.products || finalResult.products.length === 0)) {
      finalResult.products = parsedSheetProducts;
    }
    if (parsedSheetDebts.length > 0 && (!finalResult.debtPayments || finalResult.debtPayments.length === 0)) {
      finalResult.debtPayments = parsedSheetDebts;
    }
  } else {
    // Reconstruct full AppData entirely from sheet tabs
    finalResult = {
      databaseId: metaObj.databaseId || targetId,
      databaseName: metaObj.databaseName || metaObj.companyName || 'CSDL Google Sheets',
      settings: {
        ...DEFAULT_SETTINGS,
        companyName: metaObj.companyName || DEFAULT_SETTINGS.companyName,
        taxCode: metaObj.taxCode || '',
        address: metaObj.address || '',
        orderCodeRules: DEFAULT_ORDER_CODE_RULES,
        defaultOrderCodeRuleId: 'rule-dh',
      },
      customers: parsedSheetCustomers,
      suppliers: parsedSheetSuppliers,
      products: parsedSheetProducts,
      orders: parsedSheetOrders,
      purchases: parsedSheetPurchases,
      debtPayments: parsedSheetDebts,
      users: INITIAL_USERS,
      isDemo: false,
      spreadsheetId: targetId,
      syncSource: 'google_drive',
      lastSyncedAt: new Date().toISOString(),
    };
  }

  finalResult.lastSyncedAt = new Date().toISOString();
  finalResult.syncSource = 'google_drive';
  finalResult.spreadsheetId = targetId;
  return finalResult;
}
