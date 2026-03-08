"use client";

import { useCallback } from "react";
import {
  notificationStore,
  useNotificationStore,
  type NotificationSeverity,
  type NotificationDisplayMode,
  type NotificationAction,
} from "@/lib/notification-store";

/**
 * React hook for components to push and manage notifications.
 *
 * Usage:
 *   const { notify, notifyError, notifySuccess, store } = useNotification();
 *   notify({ severity: "error", title: "Save failed", source: "config-editor" });
 */
export function useNotification() {
  const store = useNotificationStore();

  const notify = useCallback(
    (opts: {
      type?: string;
      severity: NotificationSeverity;
      title: string;
      detail?: string;
      source?: string;
      displayMode?: NotificationDisplayMode;
      actions?: NotificationAction[];
      autoDismissMs?: number;
      dedupKey?: string;
    }) =>
      notificationStore.push({
        type: opts.type ?? "app",
        ...opts,
      }),
    [],
  );

  const notifyError = useCallback(
    (title: string, detail?: string, source?: string) =>
      notificationStore.push({
        type: "app-error",
        severity: "error",
        title,
        detail,
        source,
        displayMode: "both",
        autoDismissMs: 8000,
      }),
    [],
  );

  const notifySuccess = useCallback(
    (title: string, detail?: string, source?: string) =>
      notificationStore.push({
        type: "app-success",
        severity: "success",
        title,
        detail,
        source,
        displayMode: "toast",
        autoDismissMs: 4000,
      }),
    [],
  );

  const notifyWarning = useCallback(
    (title: string, detail?: string, source?: string) =>
      notificationStore.push({
        type: "app-warning",
        severity: "warning",
        title,
        detail,
        source,
        displayMode: "both",
        autoDismissMs: 6000,
      }),
    [],
  );

  const notifyInfo = useCallback(
    (title: string, detail?: string, source?: string) =>
      notificationStore.push({
        type: "app-info",
        severity: "info",
        title,
        detail,
        source,
        displayMode: "toast",
        autoDismissMs: 4000,
      }),
    [],
  );

  return {
    store,
    notify,
    notifyError,
    notifySuccess,
    notifyWarning,
    notifyInfo,
    markRead: notificationStore.markRead,
    markAllRead: notificationStore.markAllRead,
    dismiss: notificationStore.dismiss,
    clear: notificationStore.clear,
  };
}
