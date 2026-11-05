import { DeviceSession, AppUser } from '../types';

const DEVICE_ID_KEY = 'SALEMANAGER_DEVICE_ID_V1';
const DEVICE_NAME_KEY = 'SALEMANAGER_DEVICE_NAME_V1';

// Detect Device & Browser details
function detectDefaultDeviceName(): string {
  if (typeof window === 'undefined') return 'Thiết bị';

  const ua = navigator.userAgent;
  let os = 'Máy tính';
  if (/android/i.test(ua)) os = 'Điện thoại Android';
  else if (/iPad|iPhone|iPod/.test(ua)) os = 'Điện thoại/iPad iOS';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Máy Mac';
  else if (/Windows/i.test(ua)) os = 'Máy tính Windows';
  else if (/Linux/i.test(ua)) os = 'Máy Linux';

  let browser = 'Trình duyệt';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  return `${os} (${browser})`;
}

export function getCurrentDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return 'dev-browser';
  }
}

export function getCurrentDeviceName(): string {
  try {
    const saved = localStorage.getItem(DEVICE_NAME_KEY);
    if (saved && saved.trim()) return saved.trim();
    const detected = detectDefaultDeviceName();
    localStorage.setItem(DEVICE_NAME_KEY, detected);
    return detected;
  } catch (e) {
    return 'Thiết bị làm việc';
  }
}

export function setCurrentDeviceName(name: string): void {
  try {
    localStorage.setItem(DEVICE_NAME_KEY, name.trim());
  } catch (e) {
    console.error('Failed to set device name:', e);
  }
}

// Active session timeout: 5 minutes threshold for active conflict
const ACTIVE_SESSION_THRESHOLD_MS = 5 * 60 * 1000;

export function registerOrUpdateDeviceSession(
  currentUser: AppUser,
  existingSessions: DeviceSession[] = []
): { updatedSessions: DeviceSession[]; conflictingSession?: DeviceSession } {
  const currentDevId = getCurrentDeviceId();
  const currentDevName = getCurrentDeviceName();
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  // Find any active session of the SAME USER on a DIFFERENT DEVICE
  let conflictingSession: DeviceSession | undefined;

  const validSessions: DeviceSession[] = [];

  for (const s of existingSessions) {
    const sessionTime = new Date(s.lastActiveAt).getTime();
    const isExpired = nowMs - sessionTime > 30 * 60 * 1000; // prune sessions older than 30 mins
    if (isExpired) continue;

    if (s.userId === currentUser.id && s.deviceId !== currentDevId) {
      // If active within 5 mins, mark as conflict
      if (nowMs - sessionTime < ACTIVE_SESSION_THRESHOLD_MS) {
        conflictingSession = s;
      }
    }

    if (s.deviceId !== currentDevId) {
      validSessions.push(s);
    }
  }

  // Add/Update current device's session
  const thisSession: DeviceSession = {
    deviceId: currentDevId,
    deviceName: currentDevName,
    userId: currentUser.id,
    username: currentUser.username,
    fullName: currentUser.fullName,
    role: currentUser.role,
    loginAt: nowIso,
    lastActiveAt: nowIso,
  };

  validSessions.unshift(thisSession);

  return {
    updatedSessions: validSessions,
    conflictingSession,
  };
}

export function checkDeviceConflict(
  currentUser: AppUser,
  existingSessions: DeviceSession[] = []
): DeviceSession | undefined {
  const currentDevId = getCurrentDeviceId();
  const nowMs = Date.now();
  for (const s of existingSessions) {
    if (s.userId === currentUser.id && s.deviceId !== currentDevId) {
      const sessionTime = new Date(s.lastActiveAt).getTime();
      if (nowMs - sessionTime < ACTIVE_SESSION_THRESHOLD_MS) {
        return s;
      }
    }
  }
  return undefined;
}
