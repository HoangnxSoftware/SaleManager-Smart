import { AppData, DatabaseProfile } from '../types';

const DB_NAME = 'SaleManagerSmart_IndexedDB';
const DB_VERSION = 1;
const APP_DATA_STORE = 'app_data';
const PROFILES_STORE = 'profiles';

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(APP_DATA_STORE)) {
        db.createObjectStore(APP_DATA_STORE, { keyPath: 'databaseId' });
      }
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        db.createObjectStore(PROFILES_STORE, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => {
      resolve(req.result);
    };

    req.onerror = () => {
      console.error('Failed to open IndexedDB:', req.error);
      reject(req.error);
    };
  });

  return dbPromise;
}

/**
 * Persists full AppData into IndexedDB without 5MB quota restrictions
 */
export async function idbSaveAppData(databaseId: string, data: AppData): Promise<void> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(APP_DATA_STORE, 'readwrite');
      const store = tx.objectStore(APP_DATA_STORE);
      const record = {
        ...data,
        databaseId,
        _idbSavedAt: new Date().toISOString(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.error(`IDB put error for ${databaseId}:`, req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.debug('IndexedDB save failed, falling back:', err);
  }
}

/**
 * Loads full AppData from IndexedDB for a specific databaseId
 */
export async function idbGetAppData(databaseId: string): Promise<AppData | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(APP_DATA_STORE, 'readonly');
      const store = tx.objectStore(APP_DATA_STORE);
      const req = store.get(databaseId);
      req.onsuccess = () => {
        const val = req.result;
        if (val) {
          resolve(val as AppData);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.debug('IndexedDB get error:', err);
    return null;
  }
}

/**
 * Deletes AppData from IndexedDB
 */
export async function idbDeleteAppData(databaseId: string): Promise<void> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(APP_DATA_STORE, 'readwrite');
      const store = tx.objectStore(APP_DATA_STORE);
      const req = store.delete(databaseId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

/**
 * Saves DatabaseProfile list to IndexedDB
 */
export async function idbSaveProfiles(profiles: DatabaseProfile[]): Promise<void> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(PROFILES_STORE, 'readwrite');
      const store = tx.objectStore(PROFILES_STORE);
      for (const p of profiles) {
        store.put(p);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

/**
 * Loads all DatabaseProfiles from IndexedDB
 */
export async function idbGetProfiles(): Promise<DatabaseProfile[] | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(PROFILES_STORE, 'readonly');
      const store = tx.objectStore(PROFILES_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        if (req.result && req.result.length > 0) {
          resolve(req.result as DatabaseProfile[]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
