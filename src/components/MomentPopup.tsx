"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon, type IconName } from "@/components/Icon";

export type MomentTone = "success" | "warm" | "info";

export type MomentNotice = {
  id: string;
  title: string;
  detail?: string;
  icon?: IconName;
  tone?: MomentTone;
  sourceId?: string;
  durationMs?: number;
};

function useMobileMomentLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

export function MomentSource({
  id,
  className = "inline-flex",
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  // Keep the real control completely outside popup layout animation. Matching
  // the source and popup with a shared layoutId made buttons, checkboxes and
  // list rows visibly travel toward the popup on desktop. The popup now has
  // its own independent entrance motion on every screen size.
  return (
    <span className={className} data-moment-source={id}>
      {children}
    </span>
  );
}

export function MomentPopup({
  notice,
  onDismiss,
}: {
  notice: MomentNotice | null;
  onDismiss: () => void;
}) {
  const reduced = useReducedMotion();
  const isMobile = useMobileMomentLayout();
  const [mounted, setMounted] = useState(false);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(
      () => dismissRef.current(),
      notice.durationMs ?? 2600,
    );
    return () => window.clearTimeout(timeout);
  }, [notice]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence initial={false}>
      {notice && (
        <motion.div
          key={notice.id}
          className="moment-popup-wrap"
          initial={{ opacity: 0, y: reduced ? 0 : isMobile ? 14 : -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            y: reduced ? 0 : isMobile ? 8 : -8,
            scale: reduced ? 1 : 0.98,
          }}
          transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }}
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            className={`moment-popup moment-${notice.tone ?? "success"}`}
            onClick={onDismiss}
            aria-label={`${notice.title}${notice.detail ? ` ${notice.detail}` : ""}. Tap to dismiss.`}
          >
            <span className="moment-popup-icon" aria-hidden="true">
              <Icon name={notice.icon ?? "spark"} size={19} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <strong className="moment-popup-title">{notice.title}</strong>
              {notice.detail && (
                <span className="moment-popup-detail">{notice.detail}</span>
              )}
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
