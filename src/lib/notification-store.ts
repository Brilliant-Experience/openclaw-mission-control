/**
 * Centralized notification store — pub/sub system for app-wide notifications.
 *
 * Supports multiple display modes (bell, toast, banner) and action callbacks.
 * Uses the same useSyncExternalStore pattern as gateway-status-store.ts.
 */

import { useSyncExternalStore } from "react";

/* ── Types ── */

export type NotificationSeverity = "error" | "warning" | "info" | "success";

export type NotificationDisplayMode = "bell" | "toast" | "both";

export type NotificationAction = {
  label: string;
  callback: () => void;
};

export type AppNotification = {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  detail?: string;
  source?: string;
  timestamp: number;
  displayMode: NotificationDisplayMode;
  actions?: NotificationAction[];
  /** Auto-dismiss toast after this many ms (default 5000). Set 0 to persist. */
  autoDismissMs?: number;
  read: boolean;
  dismissed: boolean;
  /** For deduplication: notifications with the same dedupKey are grouped. */
  dedupKey?: string;
};

export type NotificationStoreSnapshot = {
  notifications: AppNotification[];
  unreadCount: number;
};

/* ── Constants ── */

const MAX_NOTIFICATIONS = 50;
const DEFAULT_AUTO_DISMISS_MS = 5000;
const READ_IDS_KEY = "notif_store_read_ids";

/* ── State ── */

let notifications: AppNotification[] = [];
const listeners = new Set<() => void>();
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

/* ── Persistence ── */

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(READ_IDS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistReadIds() {
  if (typeof window === "undefined") return;
  try {
    const ids = notifications.filter((n) => n.read).map((n) => n.id);
    localStorage.setItem(READ_IDS_KEY, JSON.stringify(ids.slice(-100)));
  } catch { /* ignore */ }
}

/* ── Internal helpers ── */

function emit() {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function buildSnapshot(): NotificationStoreSnapshot {
  const visible = notifications.filter((n) => !n.dismissed);
  return {
    notifications: visible,
    unreadCount: visible.filter((n) => !n.read).length,
  };
}

let cachedSnapshot: NotificationStoreSnapshot = buildSnapshot();

function updateSnapshot() {
  cachedSnapshot = buildSnapshot();
  emit();
}

function scheduleDismiss(notification: AppNotification) {
  if (notification.displayMode === "bell") return;
  const ms = notification.autoDismissMs ?? DEFAULT_AUTO_DISMISS_MS;
  if (ms <= 0) return;
  const timer = setTimeout(() => {
    dismissTimers.delete(notification.id);
    notificationStore.dismiss(notification.id);
  }, ms);
  dismissTimers.set(notification.id, timer);
}

/* ── Public API ── */

export const notificationStore = {
  /** Push a new notification into the store. */
  push(opts: {
    type: string;
    severity: NotificationSeverity;
    title: string;
    detail?: string;
    source?: string;
    displayMode?: NotificationDisplayMode;
    actions?: NotificationAction[];
    autoDismissMs?: number;
    dedupKey?: string;
  }): string {
    const key = opts.dedupKey ?? `${opts.type}:${opts.source ?? ""}:${opts.title}`;

    // Dedup: if an identical non-dismissed notification exists, update it
    const existing = notifications.find(
      (n) => !n.dismissed && n.dedupKey === key,
    );
    if (existing) {
      existing.timestamp = Date.now();
      existing.detail = opts.detail ?? existing.detail;
      existing.read = false;
      updateSnapshot();
      return existing.id;
    }

    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const notification: AppNotification = {
      id,
      type: opts.type,
      severity: opts.severity,
      title: opts.title,
      detail: opts.detail,
      source: opts.source,
      timestamp: Date.now(),
      displayMode: opts.displayMode ?? "both",
      actions: opts.actions,
      autoDismissMs: opts.autoDismissMs,
      read: false,
      dismissed: false,
      dedupKey: key,
    };

    notifications = [notification, ...notifications].slice(0, MAX_NOTIFICATIONS);
    updateSnapshot();
    scheduleDismiss(notification);
    return id;
  },

  /** Mark a notification as read. */
  markRead(id: string) {
    const n = notifications.find((n) => n.id === id);
    if (n && !n.read) {
      n.read = true;
      persistReadIds();
      updateSnapshot();
    }
  },

  /** Mark all notifications as read. */
  markAllRead() {
    let changed = false;
    for (const n of notifications) {
      if (!n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) {
      persistReadIds();
      updateSnapshot();
    }
  },

  /** Dismiss a notification (hide from UI, clear auto-dismiss timer). */
  dismiss(id: string) {
    const n = notifications.find((n) => n.id === id);
    if (n && !n.dismissed) {
      n.dismissed = true;
      const timer = dismissTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        dismissTimers.delete(id);
      }
      updateSnapshot();
    }
  },

  /** Clear all notifications. */
  clear() {
    for (const timer of dismissTimers.values()) clearTimeout(timer);
    dismissTimers.clear();
    notifications = [];
    updateSnapshot();
  },

  /** Get all active toast notifications (for ToastRenderer). */
  getToasts(): AppNotification[] {
    return notifications.filter(
      (n) => !n.dismissed && (n.displayMode === "toast" || n.displayMode === "both"),
    );
  },

  /** Get all bell notifications (for NotificationCenter). */
  getBellNotifications(): AppNotification[] {
    return notifications.filter(
      (n) => !n.dismissed && (n.displayMode === "bell" || n.displayMode === "both"),
    );
  },

  /* ── useSyncExternalStore integration ── */

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): NotificationStoreSnapshot {
    return cachedSnapshot;
  },

  getServerSnapshot(): NotificationStoreSnapshot {
    return { notifications: [], unreadCount: 0 };
  },
};

/* ── Convenience helpers ── */

export function notifyError(title: string, detail?: string, source?: string) {
  return notificationStore.push({
    type: "app-error",
    severity: "error",
    title,
    detail,
    source,
    displayMode: "both",
    autoDismissMs: 8000,
  });
}

export function notifySuccess(title: string, detail?: string, source?: string) {
  return notificationStore.push({
    type: "app-success",
    severity: "success",
    title,
    detail,
    source,
    displayMode: "toast",
    autoDismissMs: 4000,
  });
}

export function notifyWarning(title: string, detail?: string, source?: string) {
  return notificationStore.push({
    type: "app-warning",
    severity: "warning",
    title,
    detail,
    source,
    displayMode: "both",
    autoDismissMs: 6000,
  });
}

export function notifyInfo(title: string, detail?: string, source?: string) {
  return notificationStore.push({
    type: "app-info",
    severity: "info",
    title,
    detail,
    source,
    displayMode: "toast",
    autoDismissMs: 4000,
  });
}

/* ── React hook ── */

export function useNotificationStore() {
  return useSyncExternalStore(
    notificationStore.subscribe,
    notificationStore.getSnapshot,
    notificationStore.getServerSnapshot,
  );
}
