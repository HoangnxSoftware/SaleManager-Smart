import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import { AppData } from '../types';

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
 * Loads and restores data from a specific Google Spreadsheet in 'SaleManager-Smart'
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

  // Read Metadata first to check serializedBackup or chunked serializedBackup
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/Metadata!A1:C200`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    throw new Error('Không thể đọc dữ liệu từ file Google Sheets đã chọn.');
  }

  const metaData = await metaRes.json();
  const rows = (metaData.values || []) as string[][];

  // 1. Check for chunked backup: serializedBackupChunks & serializedBackup_0..n
  let totalChunks = 0;
  for (const row of rows) {
    if (row[0] === 'serializedBackupChunks' && row[1]) {
      totalChunks = parseInt(row[1], 10) || 0;
      break;
    }
  }

  if (totalChunks > 0) {
    const chunkMap = new Map<number, string>();
    for (const row of rows) {
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
        const parsed = JSON.parse(combined) as AppData;
        parsed.lastSyncedAt = new Date().toISOString();
        parsed.syncSource = 'google_drive';
        parsed.spreadsheetId = targetId;
        return parsed;
      } catch (e) {
        console.error('Failed to parse chunked serialized backup:', e);
      }
    }
  }

  // 2. Fallback to legacy single-cell serializedBackup
  for (const row of rows) {
    if (row[0] === 'serializedBackup' && row[1]) {
      try {
        const parsed = JSON.parse(row[1]) as AppData;
        parsed.lastSyncedAt = new Date().toISOString();
        parsed.syncSource = 'google_drive';
        parsed.spreadsheetId = targetId;
        return parsed;
      } catch (e) {
        console.error('Failed to parse legacy serialized backup:', e);
      }
    }
  }

  return null;
}
