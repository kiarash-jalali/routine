import type { SVGProps } from "react";

const paths = {
  today:
    "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m3 11h2m4 0h2m-8 4h2",
  routines:
    "m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3",
  checkin: "M22 11.1V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
  history: "M3 12a9 9 0 1 0 2.6-6.4L3 8m0-5v5h5m4-1v5l3 2",
  plus: "M12 5v14M5 12h14",
  chevron: "m9 5 7 7-7 7",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  clock: "M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  trash: "M3 6h18M9 6V4h6v2m4 0-1 14H6L5 6m5 4v6m4-6v6",
  edit: "m16 3 5 5M4 20l4-1L21 6l-4-4L4 15l-1 6 5-2",
  logout: "M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4m5-14 5 5-5 5M9 12h12",
  settings:
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.7 7.7 0 0 0-.1-1.2l2-1.6-2-3.5-2.5 1a8.8 8.8 0 0 0-2.1-1.2L14.3 3h-4.1l-.4 2.5a8.8 8.8 0 0 0-2.1 1.2l-2.5-1-2 3.5 2 1.6a7.7 7.7 0 0 0 0 2.4l-2 1.6 2 3.5 2.5-1a8.8 8.8 0 0 0 2.1 1.2l.4 2.5h4.1l.4-2.5a8.8 8.8 0 0 0 2.1-1.2l2.5 1 2-3.5-2-1.6c.1-.4.1-.8.1-1.2Z",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  moon: "M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z",
  spark: "m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m-2 3 10 6L22 7",
  eye: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  pause: "M8 5v14M16 5v14",
} as const;

export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <Icon name="checkin" size={25} />
    </span>
  );
}
