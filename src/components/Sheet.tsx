"use client";

import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function Sheet({
  open,
  onClose,
  title,
  description,
  busy = false,
  keyboardAssist = true,
  compact = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | undefined;
  busy?: boolean;
  keyboardAssist?: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!open) return;

    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;

    const overlayElement = overlay;
    const panelElement = panel;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const visualViewport = window.visualViewport;
    const focusTimers: number[] = [];

    function syncViewport() {
      const height = visualViewport?.height ?? window.innerHeight;
      const top = visualViewport?.offsetTop ?? 0;
      overlayElement.style.setProperty(
        "--sheet-viewport-height",
        `${height}px`,
      );
      overlayElement.style.setProperty("--sheet-viewport-top", `${top}px`);
    }

    function keepFocusedFieldVisible(event: FocusEvent) {
      if (!isMobile || !keyboardAssist) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches("input, textarea, select")) return;

      [80, 280, 520].forEach((delay) => {
        focusTimers.push(
          window.setTimeout(() => {
            syncViewport();
            target.scrollIntoView({
              block: "center",
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
            });
          }, delay),
        );
      });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Tab") {
        const items = Array.from(
          panelElement.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
          ),
        ).filter((item) => item.getClientRects().length);
        const first = items[0];
        if (!first) {
          event.preventDefault();
          panelElement.focus();
        } else {
          const last = items.at(-1) ?? first;
          if (
          event.shiftKey &&
          (document.activeElement === first ||
            !panelElement.contains(document.activeElement) ||
            document.activeElement === panelElement)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !panelElement.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
          }
        }
      }
      if (event.key === "Escape" && !busyRef.current) {
        onCloseRef.current();
      }
    }

    document.body.style.overflow = "hidden";
    if (isMobile) document.body.classList.add("sheet-editor-open");
    syncViewport();

    visualViewport?.addEventListener("resize", syncViewport);
    visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    panelElement.addEventListener("focusin", keepFocusedFieldVisible);
    document.addEventListener("keydown", handleKeyDown);

    panelElement.focus({ preventScroll: true });
    if (!isMobile && keyboardAssist) {
      panelElement
        .querySelector<HTMLElement>(
          "input:not([type='hidden']):not(:disabled), textarea:not(:disabled)",
        )
        ?.focus({ preventScroll: true });
    }

    return () => {
      focusTimers.forEach(clearTimeout);
      visualViewport?.removeEventListener("resize", syncViewport);
      visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      panelElement.removeEventListener("focusin", keepFocusedFieldVisible);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("sheet-editor-open");
      document.body.style.overflow = previousOverflow;

      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [keyboardAssist, open]);

  if (!open || typeof document === "undefined") return null;

  function closeSheet() {
    if (!busy) onClose();
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="sheet-overlay"
      data-keyboard-assist={keyboardAssist}
      data-compact={compact}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeSheet();
      }}
    >
      <section
        ref={panelRef}
        className="sheet"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <button
          type="button"
          className="sheet-close"
          disabled={busy}
          onClick={closeSheet}
          aria-label={t("common.cancel")}
        >
          <Icon name="close" />
        </button>
        <div className="sheet-body">
          <div>
            <h2 id={titleId} className="sheet-title text-3xl">
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-2 text-sm leading-6 text-muted"
              >
                {description}
              </p>
            )}
          </div>
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}
