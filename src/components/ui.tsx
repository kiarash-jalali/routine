import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

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
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
      <div className={joinClasses("mx-auto w-full max-w-6xl", className)}>
        {children}
      </div>
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
    <header className="flex flex-col gap-5 border-b border-border/80 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
          {title}
        </h1>
        {description && (
          <div className="mt-2 max-w-xl text-sm leading-6 text-muted sm:text-[15px]">
            {description}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}

type CardTone = "default" | "soft" | "accent";

const cardTones: Record<CardTone, string> = {
  default: "border-border bg-surface",
  soft: "border-border/80 bg-surface-soft/80",
  accent: "border-primary/15 bg-primary-soft/55",
};

export function Card({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLElement> & { tone?: CardTone }) {
  return (
    <section
      className={joinClasses(
        "rounded-[1.4rem] border p-5 shadow-card sm:p-6",
        cardTones[tone],
        className,
      )}
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
        <h2 className="text-base font-semibold tracking-[-0.015em] text-foreground sm:text-lg">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-white shadow-button hover:border-primary-strong hover:bg-primary-strong",
  secondary:
    "border-border-strong bg-surface text-foreground hover:border-primary/25 hover:bg-primary-soft/45",
  ghost:
    "border-transparent bg-transparent text-muted hover:bg-surface-soft hover:text-foreground",
  danger:
    "border-danger-border bg-surface text-danger hover:bg-danger-soft",
};

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={joinClasses(
        "inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={joinClasses(
        "min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-soft hover:border-border-strong/80 focus:border-primary focus:ring-4 focus:ring-primary-ring",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={joinClasses(
        "min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition hover:border-border-strong/80 focus:border-primary focus:ring-4 focus:ring-primary-ring",
        className,
      )}
      {...props}
    />
  );
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface-soft/70 px-4 py-5 text-sm leading-6 text-muted">
      {children}
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
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
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
      <p className="text-xl font-semibold tracking-[-0.03em] text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-xs leading-5 text-muted">{label}</p>
    </div>
  );
}

export function ProgressBar({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-primary-soft"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-200"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
