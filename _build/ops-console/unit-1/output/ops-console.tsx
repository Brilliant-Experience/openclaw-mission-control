"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PanelRight, PanelRightClose, X, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_OPEN = "ops-console-open";
const STORAGE_KEY_WIDTH = "ops-console-width";
const STORAGE_KEY_ACTIVE_TAB = "ops-console-active-tab";

const PANEL_DEFAULT_WIDTH = 380;
const PANEL_MIN_WIDTH = 300;
const PANEL_MAX_WIDTH = 600;

function clampPanelWidth(width: number): number {
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, width));
}

// ── Inner placeholder stub ───────────────────────────────────────────────────

/**
 * Placeholder content for the OpsConsole panel.
 * Will be replaced with the full implementation in unit-2a.
 */
export function OpsConsolePanelContent(): JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <p className="text-sm text-stone-400 dark:text-stone-500">
        Ops Console — coming soon
      </p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function OpsConsole(): JSX.Element {
  // ── State — read from localStorage on first render ──────────────────────
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(STORAGE_KEY_OPEN);
    return stored === null ? false : stored === "true";
  });

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === "undefined") return PANEL_DEFAULT_WIDTH;
    const raw = Number(localStorage.getItem(STORAGE_KEY_WIDTH));
    return Number.isFinite(raw) && raw > 0
      ? clampPanelWidth(raw)
      : PANEL_DEFAULT_WIDTH;
  });

  // Reserved — will be used by unit-2a (tab switching)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeTab, _setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "main";
    return localStorage.getItem(STORAGE_KEY_ACTIVE_TAB) ?? "main";
  });

  // Tracks whether we're on mobile (< 768px)
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Unread indicator for the collapsed floating button
  const [hasUnread, setHasUnread] = useState<boolean>(false);

  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null
  );

  // ── Mobile detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const BREAKPOINT = 768;
    const mql = window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < BREAKPOINT);
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // ── Persist state to localStorage ────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_OPEN, String(isOpen));
    } catch {
      /* ignore */
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      try {
        localStorage.setItem(STORAGE_KEY_WIDTH, String(panelWidth));
      } catch {
        /* ignore */
      }
    }
  }, [panelWidth, isOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeTab);
    } catch {
      /* ignore */
    }
  }, [activeTab]);

  // ── Keyboard shortcut: Cmd+. / Ctrl+. ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === ".") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Pointer-based resize ─────────────────────────────────────────────────
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const active = resizeStateRef.current;
      if (!active) return;
      // Dragging LEFT (negative delta) increases width for a right panel
      const nextWidth = clampPanelWidth(
        active.startWidth - (event.clientX - active.startX)
      );
      setPanelWidth(nextWidth);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };

    const handlePointerUp = () => {
      if (!resizeStateRef.current) return;
      resizeStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isOpen) return;
      resizeStateRef.current = { startX: event.clientX, startWidth: panelWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [isOpen, panelWidth]
  );

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const open = useCallback(() => {
    setIsOpen(true);
    setHasUnread(false);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setHasUnread(false);
      return !prev;
    });
  }, []);

  // ── Dynamic width style (desktop only — mobile is full-screen) ────────────
  const widthStyle =
    !isMobile && isOpen
      ? { width: `${panelWidth}px`, minWidth: `${panelWidth}px` }
      : undefined;

  // ── Collapsed floating button (shown when panel is closed) ───────────────
  const FloatingButton = (
    <button
      type="button"
      onClick={open}
      aria-label="Open Ops Console"
      className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-stone-50 shadow-lg ring-1 ring-stone-700 transition-colors hover:bg-stone-800 dark:bg-stone-50 dark:text-stone-900 dark:ring-stone-200 dark:hover:bg-stone-200"
    >
      <PanelRight className="h-4 w-4" />
      {hasUnread && (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-stone-900 dark:ring-stone-50"
        />
      )}
    </button>
  );

  // ── Mobile: slide-in full-screen drawer from the right ───────────────────
  if (isMobile) {
    return (
      <>
        {!isOpen && FloatingButton}

        {/* Mobile overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={close}
            aria-hidden
          />
        )}

        {/* Mobile drawer */}
        <aside
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col",
            "bg-stone-50 dark:bg-[#0d0f12]",
            "border-l border-stone-200 dark:border-[#23282e]",
            "transition-transform duration-200 ease-in-out",
            isOpen ? "translate-x-0" : "translate-x-full"
          )}
          aria-label="Ops Console"
        >
          <PanelHeader toggle={toggle} />
          <OpsConsolePanelContent />
        </aside>
      </>
    );
  }

  // ── Desktop: docked right panel ──────────────────────────────────────────
  return (
    <>
      {!isOpen && FloatingButton}

      {isOpen && (
        <aside
          style={widthStyle}
          className={cn(
            "relative flex h-full shrink-0 flex-col",
            "bg-stone-50 dark:bg-[#0d0f12]",
            "border-l border-stone-200 dark:border-[#23282e]",
            "transition-[width] duration-200 ease-in-out"
          )}
          aria-label="Ops Console"
        >
          {/* Resize handle — on the LEFT edge of the panel */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize Ops Console"
            onPointerDown={startResize}
            className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize"
          >
            <div className="mx-auto h-full w-px bg-transparent transition-colors hover:bg-stone-300 dark:hover:bg-[#3d4752]" />
          </div>

          {/* Left-edge toggle button — collapses the panel, centered vertically.
              Sits at z-20 so it renders above the resize handle stripe. */}
          <button
            type="button"
            onClick={toggle}
            aria-label="Collapse Ops Console"
            className={cn(
              "absolute left-0 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2",
              "flex h-5 w-5 items-center justify-center",
              "rounded-full bg-stone-200 text-stone-500 shadow",
              "hover:bg-stone-300 hover:text-stone-700",
              "dark:bg-[#23282e] dark:text-[#7a8591]",
              "dark:hover:bg-[#2d3540] dark:hover:text-[#d6dce3]",
              "transition-colors"
            )}
          >
            <ChevronLeft className="h-3 w-3" />
          </button>

          <PanelHeader toggle={toggle} />
          <OpsConsolePanelContent />
        </aside>
      )}
    </>
  );
}

// ── Panel header sub-component ───────────────────────────────────────────────

function PanelHeader({ toggle }: { toggle: () => void }): JSX.Element {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between",
        "border-b border-stone-200 dark:border-[#23282e]",
        "px-4 py-3"
      )}
    >
      {/* Left group: icon + title */}
      <div className="flex items-center gap-2">
        <PanelRight className="h-4 w-4 shrink-0 text-stone-400 dark:text-stone-500" />
        <span className="text-sm font-semibold text-stone-900 dark:text-[#f5f7fa]">
          Ops Console
        </span>
      </div>

      {/* Right group: collapse button + X button */}
      <div className="flex items-center gap-1">
        {/* Collapse panel icon button */}
        <button
          type="button"
          onClick={toggle}
          aria-label="Collapse panel"
          title="Collapse panel"
          className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-[#7a8591] dark:hover:bg-[#171b1f] dark:hover:text-[#d6dce3]"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>

        {/* Close (X) button */}
        <button
          type="button"
          onClick={toggle}
          aria-label="Close Ops Console"
          className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-[#7a8591] dark:hover:bg-[#171b1f] dark:hover:text-[#d6dce3]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}


