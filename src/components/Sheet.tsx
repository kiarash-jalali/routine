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
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open) {
      const previousOverflow = document.body.style.overflow;
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      const desktopInputFocus = window.matchMedia(
        "(min-width: 768px) and (pointer: fine)",
      ).matches;
      const autofocusElement =
        dialog.querySelector<HTMLElement>("[autofocus]");
      const visualViewport = window.visualViewport;

      function syncViewport() {
        if (!isMobile) return;

        const height = visualViewport?.height ?? window.innerHeight;
        const top = visualViewport?.offsetTop ?? 0;
        const availableHeight = Math.max(260, Math.floor(height - 24));

        // Use a real height, not only max-height. Mobile browsers can leave the
        // dialog at its pre-keyboard size otherwise, which means there is no
        // overflow area to scroll when the software keyboard appears.
        dialog.style.height = `${availableHeight}px`;
        dialog.style.maxHeight = `${availableHeight}px`;
        dialog.style.top = `${Math.floor(top + 12)}px`;
      }

      function keepFocusedFieldVisible(event: FocusEvent) {
        if (!isMobile) return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches("input, textarea, select, button")) return;

        // Keyboard animation and visualViewport resizing are asynchronous on
        // iOS/Android. Re-sync a few times while it settles, then reveal the
        // focused control inside the sheet's own scroll container.
        [60, 260, 520].forEach((delay) => {
          window.setTimeout(() => {
            syncViewport();
            target.scrollIntoView({ block: "center", behavior: "smooth" });
          }, delay);
        });
      }

      // Browsers autofocus dialog fields during showModal(). On a phone that can
      // summon the keyboard before the floating card is visible, covering it.
      if (!desktopInputFocus) autofocusElement?.removeAttribute("autofocus");

      syncViewport();
      dialog.showModal();
      document.body.style.overflow = "hidden";

      visualViewport?.addEventListener("resize", syncViewport);
      visualViewport?.addEventListener("scroll", syncViewport);
      window.addEventListener("resize", syncViewport);
      dialog.addEventListener("focusin", keepFocusedFieldVisible);

      if (desktopInputFocus) {
        dialog
          .querySelector<HTMLElement>(
            "input:not([type='hidden']):not(:disabled), textarea:not(:disabled)",
          )
          ?.focus({ preventScroll: true });
      } else {
        dialog
          .querySelector<HTMLElement>("[data-sheet-close]")
          ?.focus({ preventScroll: true });
      }

      if (!desktopInputFocus && autofocusElement) {
        autofocusElement.setAttribute("autofocus", "");
      }

      return () => {
        visualViewport?.removeEventListener("resize", syncViewport);
        visualViewport?.removeEventListener("scroll", syncViewport);
        window.removeEventListener("resize", syncViewport);
        dialog.removeEventListener("focusin", keepFocusedFieldVisible);
        dialog.style.removeProperty("height");
        dialog.style.removeProperty("max-height");
        dialog.style.removeProperty("top");
        dialog.close();
        document.body.style.overflow = previousOverflow;
      };
    }

    dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="sheet-body">
        <div className="sheet-handle" aria-hidden="true" />
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
    </dialog>
  );
}
