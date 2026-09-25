"use client";

import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AnimatedNumber } from "@/components/Motion";
import { useLanguage } from "@/components/preferences/LanguageProvider";

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main id="main-content" className="page-shell">
      <div className={joinClasses("page-inner", className)}>{children}</div>
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <div className="page-description">{description}</div>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}

const cardTones = {
  default: "bg-surface",
  soft: "bg-surface-soft",
  accent: "card-accent",
};
export function Card({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLElement> & { tone?: keyof typeof cardTones }) {
  return (
    <section
      className={joinClasses("card", cardTones[tone], className)}
      {...props}
    />
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonSizes: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  busy = false,
  disabled = false,
  children,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <button
      type={type}
      className={joinClasses(
        "btn",
        `btn-${variant}`,
        buttonSizes[size],
        className,
      )}
      {...props}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
    >
      <AnimatePresence initial={false}>
        {busy && (
          <motion.span
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 15, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="flex shrink-0"
            aria-hidden="true"
          >
            <span className="spinner" />
          </motion.span>
        )}
      </AnimatePresence>
      {children}
    </button>
  );
}

type FieldSize = "sm" | "md";

const fieldSizes: Record<FieldSize, string> = {
  sm: "field-sm",
  md: "field-md",
};

type SharedFieldProps = {
  size?: FieldSize | undefined;
  invalid?: boolean | undefined;
  describedBy?: string | undefined;
};

export function Input({
  className,
  size = "md",
  invalid,
  describedBy,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & SharedFieldProps) {
  return (
    <input
      className={joinClasses("field", fieldSizes[size], className)}
      aria-invalid={invalid ?? ariaInvalid}
      aria-describedby={describedBy ?? ariaDescribedBy}
      {...props}
    />
  );
}

export function Select({
  className,
  size = "md",
  invalid,
  describedBy,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & SharedFieldProps) {
  return (
    <select
      className={joinClasses("field", fieldSizes[size], className)}
      aria-invalid={invalid ?? ariaInvalid}
      aria-describedby={describedBy ?? ariaDescribedBy}
      {...props}
    />
  );
}

export function Textarea({
  className,
  size = "md",
  invalid,
  describedBy,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & SharedFieldProps) {
  return (
    <textarea
      className={joinClasses("field", fieldSizes[size], className)}
      aria-invalid={invalid ?? ariaInvalid}
      aria-describedby={describedBy ?? ariaDescribedBy}
      {...props}
    />
  );
}

export function ErrorNotice({
  children,
  className,
  role = "alert",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role={role}
      className={joinClasses(
        "notice rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm leading-6 text-danger",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  children,
  title,
  action,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={joinClasses(
        "rounded-2xl bg-surface-soft px-5 py-7 text-center text-sm leading-6 text-muted",
        className,
      )}
      {...props}
    >
      {title && (
        <p className="mb-1 font-semibold text-foreground">{title}</p>
      )}
      <div>{children}</div>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
export function Pill({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={joinClasses(
        "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium",
        muted
          ? "bg-surface-soft text-muted"
          : "bg-primary-soft text-primary-strong",
      )}
    >
      {children}
    </span>
  );
}
export function Stat({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <p className="stat-value text-2xl tracking-tight text-foreground">
        <AnimatedNumber value={value} />
      </p>
      <p className="mt-1 text-[13px] leading-5 text-muted">{label}</p>
    </div>
  );
}
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const reduced = useReducedMotion();
  const { t } = useLanguage();
  const percent =
    max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-primary-soft"
      role="progressbar"
      aria-label={t("common.completion")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={false}
        animate={{ width: `${percent}%` }}
        transition={{ duration: reduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
export function LoadingState({ label }: { label?: string }) {
  const { t } = useLanguage();
  const resolvedLabel = label ?? t("common.loading");
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{resolvedLabel}</span>
      <div aria-hidden="true" className="space-y-5">
        <div className="skeleton h-4 w-36" />
        <div className="skeleton h-9 w-52" />
        <div className="skeleton mt-8 h-44 w-full" />
        <div className="skeleton h-28 w-full" />
      </div>
    </div>
  );
}
export function CheckCircle({ checked = false }: { checked?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      initial={false}
      animate={{ scale: checked && !reduced ? [1, 1.18, 1] : 1 }}
      transition={{ duration: reduced ? 0 : 0.35 }}
      className={joinClasses("check-circle", checked && "is-checked")}
      aria-hidden="true"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="m5 12 4 4L19 6"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.3, ease: "easeOut" }}
        />
      </svg>
    </motion.span>
  );
}
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div
      className="segmented"
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      style={
        {
          "--segment-count": options.length,
          "--segment-index": Math.max(
            0,
            options.findIndex((option) => option.value === value),
          ),
        } as CSSProperties
      }
    >
      <span className="segmented-indicator" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
