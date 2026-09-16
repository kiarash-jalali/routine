"use client";

import { forwardRef, type ReactNode } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useIsPresent,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
    >
      {children}
    </MotionConfig>
  );
}

export function AnimatedList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul className={`animated-list ${className}`}>
      <AnimatePresence initial={false} mode="popLayout">
        {children}
      </AnimatePresence>
    </ul>
  );
}

export const AnimatedListItem = forwardRef<
  HTMLLIElement,
  HTMLMotionProps<"li">
>(function AnimatedListItem({ children, ...props }, ref) {
  const reduced = useReducedMotion();
  const present = useIsPresent();
  return (
    <motion.li
      ref={ref}
      layout={reduced ? false : "position"}
      initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: reduced ? 0 : 24, scale: reduced ? 1 : 0.96 }}
      transition={{
        duration: reduced ? 0 : 0.3,
        layout: { type: "spring", stiffness: 300, damping: 30 },
      }}
      inert={!present}
      {...props}
    >
      {children}
    </motion.li>
  );
});

export function AnimatedSwap({
  children,
  value,
  className = "",
}: {
  children: ReactNode;
  value: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="wait">
      <SwapPanel key={value} reduced={!!reduced} className={className}>
        {children}
      </SwapPanel>
    </AnimatePresence>
  );
}

function SwapPanel({
  children,
  reduced,
  className,
}: {
  children: ReactNode;
  reduced: boolean;
  className: string;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -10 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }}
      inert={!present}
    >
      {children}
    </motion.div>
  );
}

export function Collapse({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && <CollapsePanel reduced={!!reduced}>{children}</CollapsePanel>}
    </AnimatePresence>
  );
}

function CollapsePanel({
  children,
  reduced,
}: {
  children: ReactNode;
  reduced: boolean;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: "hidden" }}
      inert={!present}
      aria-hidden={!present || undefined}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({ value }: { value: number | string }) {
  const reduced = useReducedMotion();
  return (
    <span className="animated-number">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{
            opacity: 0,
            y: reduced ? 0 : 10,
            filter: reduced ? "none" : "blur(3px)",
          }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{
            opacity: 0,
            y: reduced ? 0 : -10,
            filter: reduced ? "none" : "blur(3px)",
          }}
          transition={{ duration: reduced ? 0 : 0.24 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
