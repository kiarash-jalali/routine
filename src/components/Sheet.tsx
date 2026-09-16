"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "@/components/Icon";

export function Sheet({
  open,
  onClose,
  title,
  description,
  busy = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  busy?: boolean;
  children: ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const titleId = useId();
  const descriptionId = useId();

  // Callers usually pass an inline onClose function. Keep the latest callback
  // in a ref so typing in a form does not tear down and recreate the sheet
  // effect on every parent render.
  onCloseRef.current = onClose;
  busyRef.current = busy;

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
      if (!isMobile) return;
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

    // Do not move focus to the close control on mobile. Desktop keeps the
    // convenient first-field focus.
    if (!isMobile) {
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
  }, [open]);

  if (!open) return null;

  function closeSheet() {
    if (!busyRef.current) onCloseRef.current();
  }

  return (
    <div
      ref={overlayRef}
      className="sheet-overlay"
      onPointerDownCapture={(event) => {
        // The glass panel is a nested, momentum-scrolling layer on mobile. Some
        // iOS/Android PWAs can visually show a control inside that layer while
        // losing its final tap/click during viewport or keyboard changes. Handle
        // the close gesture at the stable overlay layer before it reaches the
        // scrolling panel instead.
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("[data-sheet-close]")
        ) {
          event.preventDefault();
          closeSheet();
        }
      }}
      onPointerDown={(event) => {
        // Tapping the scrim already proved reliable on the affected phones.
        if (event.target === event.currentTarget) closeSheet();
      }}
    >
      <div className="sheet-shell">
        <section
          ref={panelRef}
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
        >
          <div className="sheet-body">
            <div className="pr-14">
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

        {/* Keep the close target outside the transformed/scrolling glass panel.
            It still looks like part of the sheet, but mobile hit-testing happens
            in the same stable overlay layer as the working scrim close gesture. */}
        <button
          data-sheet-close
          className="sheet-close-button icon-button"
          type="button"
          aria-label="Close dialog"
          onClick={closeSheet}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}
