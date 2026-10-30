import type { SVGProps } from "react";

type IconName =
  | "play"
  | "pause"
  | "previous"
  | "next"
  | "restart"
  | "volume"
  | "queue"
  | "close"
  | "refresh"
  | "arrow-up-right"
  | "chevron-right"
  | "settings"
  | "sun"
  | "coffee"
  | "feather"
  | "focus"
  | "heart"
  | "music"
  | "thumb-up"
  | "thumb-down";

const paths: Record<IconName, React.ReactNode> = {
  play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  previous: (
    <>
      <path d="M6 5v14" />
      <path d="m18 6-9 6 9 6V6Z" fill="currentColor" stroke="none" />
    </>
  ),
  next: (
    <>
      <path d="M18 5v14" />
      <path d="m6 6 9 6-9 6V6Z" fill="currentColor" stroke="none" />
    </>
  ),
  restart: (
    <>
      <path d="M4 10a8 8 0 1 1 2.3 7.7" />
      <path d="M4 5v5h5" />
    </>
  ),
  volume: (
    <>
      <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
      <path d="M16 9.2a4 4 0 0 1 0 5.6M18.8 6.5a7.8 7.8 0 0 1 0 11" />
    </>
  ),
  queue: (
    <>
      <path d="M5 7h9M5 12h9M5 17h9" />
      <path d="M18 6v10.2" />
      <circle cx="16" cy="17" r="2" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  refresh: (
    <>
      <path d="M19 7v5h-5" />
      <path d="M18.2 12a7 7 0 1 0-1.4 5" />
    </>
  ),
  "arrow-up-right": (
    <>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </>
  ),
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 8h11v6.5A4.5 4.5 0 0 1 11.5 19h-2A4.5 4.5 0 0 1 5 14.5V8Z" />
      <path d="M16 10h1.3a2.7 2.7 0 0 1 0 5.4H16M8 4.5c.8.8.8 1.7 0 2.5M12 4.5c.8.8.8 1.7 0 2.5" />
    </>
  ),
  feather: (
    <>
      <path d="M19 5c-4.6-1.4-9.4.6-12 5.2L4 16l4.1-3.1C10.7 11 13.5 8.6 16 7" />
      <path d="m7.5 15.5 9-9M9.5 13.5h4.7M12 11h3.3" />
    </>
  ),
  focus: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </>
  ),
  heart: (
    <path d="M20.7 6.3a5.1 5.1 0 0 0-7.2 0L12 7.8l-1.5-1.5a5.1 5.1 0 0 0-7.2 7.2L12 22l8.7-8.5a5.1 5.1 0 0 0 0-7.2Z" />
  ),
  music: (
    <>
      <path d="M9 18V5l10-2v13" />
      <ellipse cx="6.5" cy="18" rx="2.5" ry="2" />
      <ellipse cx="16.5" cy="16" rx="2.5" ry="2" />
    </>
  ),
  "thumb-up": (
    <>
      <path d="M8 10v10H4V10h4Z" />
      <path d="M8 18.5h8.7a2 2 0 0 0 2-1.6l1.1-5.3a1.8 1.8 0 0 0-1.8-2.1H14l.7-3.1A2.4 2.4 0 0 0 12.4 3L8 10" />
    </>
  ),
  "thumb-down": (
    <>
      <path d="M8 14V4H4v10h4Z" />
      <path d="M8 5.5h8.7a2 2 0 0 1 2 1.6l1.1 5.3a1.8 1.8 0 0 1-1.8 2.1H14l.7 3.1a2.4 2.4 0 0 1-2.3 3.4L8 14" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

export type { IconName };
