"use client";

import { useEffect, useRef, type ReactNode } from "react";
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

export function MomentSource({
  id,
  className = "inline-flex",
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.span
      className={className}
      layoutId={reduced ? undefined : `moment-${id}`}
      transition={{ type: "spring", stiffness: 360, damping: 32 }}
    >
      {children}
    </motion.span>
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
  const dismissRef = useRef(onDismiss);

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

  return (
    <AnimatePresence initial={false}>
      {notice && (
        <motion.div
          className="moment-popup-wrap"
          initial={{ opacity: 0, y: reduced ? 0 : 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : 8, scale: reduced ? 1 : 0.98 }}
          transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }}
          role="status"
          aria-live="polite"
        >
          <motion.button
            type="button"
            className={`moment-popup moment-${notice.tone ?? "success"}`}
            layoutId={
              !reduced && notice.sourceId
                ? `moment-${notice.sourceId}`
                : undefined
            }
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
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
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
