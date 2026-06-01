// JS Bridge: Mini-app ↔ Shell native.
// Native-only operations require the Mushy Shell. Typed helpers may provide
// browser fallbacks when a real Web API exists.
//
// Sử dụng:
//   const loc = await callNative('GET_LOCATION');
//   const photo = await callNative('OPEN_CAMERA', { quality: 0.8 });
//
// Hoặc helper typed (recommended):
//   import { bridge } from './lib/bridge.js';
//   await bridge.share({ message: 'Hello', url: 'https://...' });
//   await bridge.haptic('success');
//   await bridge.tel('0901234567');
//   const ok = await bridge.biometric({ promptMessage: 'Xác thực' });

import { isInShell } from './context.js';

// Timeout: 10s cho op nhanh, 5 phút cho op tương tác (user loay hoay tay lâu).
// Override qua opts.timeout nếu cần.
const DEFAULT_TIMEOUT_MS = 10_000;
const INTERACTIVE_TIMEOUT_MS = 5 * 60_000;
const INTERACTIVE_TYPES = new Set([
  'OPEN_CAMERA', 'PICK_FILE', 'SCAN_QR', 'BIOMETRIC', 'SHARE',
  'SAVE_IMAGE', 'SAVE_CONTACT', 'PICK_CONTACT', 'ADD_CALENDAR_EVENT',
]);
const pending = new Map();
let nextId = 1;

// Shell sẽ gọi `window.__bridgeResolve(id, result, error)` khi xong
if (typeof window !== 'undefined') {
  window.__bridgeResolve = (id, result, error) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    error ? p.reject(new Error(error)) : p.resolve(result);
  };
}

export function callNative(type, payload = {}, opts = {}) {
  if (!isInShell()) return unsupportedNativeOperation(type);

  const timeoutMs =
    opts.timeout ?? (INTERACTIVE_TYPES.has(type) ? INTERACTIVE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Bridge timeout: ${type}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    window.ReactNativeWebView.postMessage(JSON.stringify({ id, type, payload }));
  });
}

// Typed helpers — recommended. Fallback browser khi không có Shell:
//   - tel/url: dùng window.location = `tel:...` / window.open(url)
//   - share: dùng navigator.share (mobile) hoặc clipboard fallback
//   - haptic: no-op trong browser
export const bridge = {
  location: () => callNative('GET_LOCATION'),
  camera: (opts) => callNative('OPEN_CAMERA', opts),
  pickFile: (opts) => callNative('PICK_FILE', opts),
  pushNotification: (opts) => callNative('PUSH_NOTIFICATION', opts),

  async tel(phone) {
    if (!isInShell()) {
      // Browser fallback: anchor tel:. Desktop: thường không action gì.
      window.location.href = `tel:${phone}`;
      return { opened: true };
    }
    return callNative('OPEN_TEL', { phone });
  },

  async openUrl(url) {
    if (!isInShell()) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return { opened: true };
    }
    return callNative('OPEN_URL', { url });
  },

  async share({ title, message, url } = {}) {
    if (!isInShell()) {
      // Browser fallback: Web Share API (mobile) hoặc clipboard.
      if (navigator.share) {
        try {
          await navigator.share({ title, text: message, url });
          return { shared: true, action: 'web-share' };
        } catch (e) {
          if (e.name === 'AbortError') return { shared: false, action: 'dismissed' };
          throw e;
        }
      }
      const text = [message, url].filter(Boolean).join('\n');
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return { shared: true, action: 'clipboard' };
      }
      throw new Error('Browser không hỗ trợ share');
    }
    return callNative('SHARE', { title, message, url });
  },

  // type: 'light'|'medium'|'heavy'|'success'|'warning'|'error'|'selection'
  async haptic(type = 'medium') {
    if (!isInShell()) {
      // Browser navigator.vibrate dài/ngắn theo intensity. Có gì tốt nấy.
      if (navigator.vibrate) navigator.vibrate(type === 'heavy' ? 30 : type === 'light' ? 5 : 15);
      return { ok: true };
    }
    return callNative('HAPTIC', { type });
  },

  scanQr: () => callNative('SCAN_QR'),

  // Browser không có biometric — luôn fail rõ ràng để mini-app fallback password.
  async biometric(opts = {}) {
    if (!isInShell()) throw new Error('Biometric chỉ chạy trong Shell native');
    return callNative('BIOMETRIC', opts);
  },

  refreshToken: () => callNative('REFRESH_TOKEN'),

  // Lưu ảnh vào thư viện máy. payload: { dataUrl } | { base64, mimeType } | { url }
  saveImage: (payload) => callNative('SAVE_IMAGE', payload),

  // Clipboard. copyText('...') / getClipboard() → { text }
  async copyText(text) {
    if (!isInShell()) {
      try { await navigator.clipboard.writeText(String(text ?? '')); } catch { /* noop */ }
      return { copied: true };
    }
    return callNative('COPY_TEXT', { text: String(text ?? '') });
  },
  async getClipboard() {
    if (!isInShell()) {
      try { return { text: await navigator.clipboard.readText() }; } catch { return { text: '' }; }
    }
    return callNative('GET_CLIPBOARD');
  },

  // Mở màn Cài đặt app (hướng dẫn khi user lỡ từ chối quyền).
  openSettings: () => callNative('OPEN_SETTINGS'),

  // Lưu liên hệ vào Danh bạ. payload: { name, phone, email? }
  saveContact: (payload) => callNative('SAVE_CONTACT', payload),
  // Chọn 1 liên hệ từ Danh bạ → { name, phone }
  pickContact: () => callNative('PICK_CONTACT'),

  // Thêm sự kiện vào Lịch (UI hệ thống). payload:
  //   { title, startDate, endDate?, notes?, location?, allDay? }
  //   startDate/endDate = ISO string hoặc epoch ms.
  addCalendarEvent: (payload) => callNative('ADD_CALENDAR_EVENT', payload),
};

function unsupportedNativeOperation(type) {
  return Promise.reject(new Error(`${type} chỉ chạy trong Mushy Shell native`));
}
