"use client";

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
  description?: string;
  busy?: boolean;
  keyboardAssist?: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
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
        window.setTimeout(() => {
          syncViewport();
          target.scrollIntoView({ block: "center", behavior: "smooth" });
        }, delay);
      });
    }

    function handleKeyDown(event: KeyboardEvent) {
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

    if (!isMobile && keyboardAssist) {
      panelElement
        .querySelector<HTMLElement>(
          "input:not([type='hidden']):not(:disabled), textarea:not(:disabled)",
        )
        ?.focus({ preventScroll: true });
    }

    return () => {
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

  if (!open) return null;

  function closeSheet() {
    if (!busy) onClose();
  }

  return (
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
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
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
    </div>
  );
}
