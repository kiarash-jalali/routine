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
      const desktopInputFocus = window.matchMedia(
        "(min-width: 768px) and (pointer: fine)",
      ).matches;
      const autofocusElement =
        dialog.querySelector<HTMLElement>("[autofocus]");
      const visualViewport = window.visualViewport;

      function syncViewport() {
        const height = visualViewport?.height ?? window.innerHeight;
        const top = visualViewport?.offsetTop ?? 0;
        dialog.style.setProperty("--sheet-viewport-height", `${height}px`);
        dialog.style.setProperty("--sheet-viewport-top", `${top}px`);
      }

      function keepFocusedFieldVisible(event: FocusEvent) {
        if (desktopInputFocus) return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches("input, textarea, select, button")) return;

        window.setTimeout(() => {
          target.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 220);
      }

      // Browsers autofocus dialog fields during showModal(). On a phone that can
      // summon the keyboard before the dialog is visible, covering it.
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
        dialog.style.removeProperty("--sheet-viewport-height");
        dialog.style.removeProperty("--sheet-viewport-top");
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
