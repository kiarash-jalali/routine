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
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;

    // Preserve the non-null narrowing inside the event-handler closures below.
    const overlayElement = overlay;
    const panelElement = panel;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const visualViewport = window.visualViewport;
    const typingSelector =
      "textarea, input:not([type='checkbox']):not([type='radio']):not([type='date']):not([type='time']):not([type='datetime-local']):not([type='button']):not([type='submit'])";

    function syncViewport() {
      const height = visualViewport?.height ?? window.innerHeight;
      const top = visualViewport?.offsetTop ?? 0;
      overlayElement.style.setProperty(
        "--sheet-viewport-height",
        `${height}px`,
      );
      overlayElement.style.setProperty("--sheet-viewport-top", `${top}px`);
    }

    function setTypingState(target: EventTarget | null) {
      if (!isMobile) return;
      const element = target instanceof HTMLElement ? target : null;
      document.body.classList.toggle(
        "sheet-keyboard-active",
        Boolean(element?.matches(typingSelector)),
      );
    }

    function keepFocusedFieldVisible(event: FocusEvent) {
      if (!isMobile) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches("input, textarea, select, button")) return;

      setTypingState(target);

      [80, 280, 520].forEach((delay) => {
        window.setTimeout(() => {
          syncViewport();
          target.scrollIntoView({ block: "center", behavior: "smooth" });
        }, delay);
      });
    }

    function handleFocusOut() {
      if (!isMobile) return;

      // Focus can move directly from one field to another. Wait until the next
      // frame so we read the new active element instead of briefly flashing the
      // mobile header back in between fields.
      window.requestAnimationFrame(() => {
        const activeElement = document.activeElement;
        if (!panelElement.contains(activeElement)) {
          document.body.classList.remove("sheet-keyboard-active");
          return;
        }
        setTypingState(activeElement);
      });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }

    document.body.style.overflow = "hidden";
    syncViewport();

    visualViewport?.addEventListener("resize", syncViewport);
    visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    panelElement.addEventListener("focusin", keepFocusedFieldVisible);
    panelElement.addEventListener("focusout", handleFocusOut);
    document.addEventListener("keydown", handleKeyDown);

    if (isMobile) {
      panelElement
        .querySelector<HTMLElement>("[data-sheet-close]")
        ?.focus({ preventScroll: true });
    } else {
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
      panelElement.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("sheet-keyboard-active");
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="sheet-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
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
          <div className="flex items-start justify-between gap-4">
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
            <button
              data-sheet-close
              className="icon-button"
              type="button"
              aria-label="Close dialog"
              onClick={onClose}
              disabled={busy}
            >
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
