export type IconProps = { className?: string };

const base = "stroke-current fill-none";

export function IntentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function ReportIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <path d="M7 3h7l4 4v14H7z" strokeLinejoin="round" />
      <path d="M14 3v4h4" strokeLinejoin="round" />
      <path d="m9.5 13 2 2 3.5-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <path d="M5 20V10M12 20V4M19 20v-7" strokeLinecap="round" />
    </svg>
  );
}

export function NewsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <rect x="3" y="5" width="14" height="15" rx="1.5" />
      <path d="M17 8h4v10a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9h8M6 12.5h8M6 16h5" strokeLinecap="round" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" strokeLinejoin="round" />
      <path d="M12 8v5" strokeLinecap="round" />
      <circle cx="12" cy="15.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CoinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.3 15.2c.4.9 1.4 1.4 2.7 1.4 1.8 0 3-.8 3-2s-1.1-1.7-3-2.1-3-1-3-2.1c0-1.2 1.2-2 3-2 1.3 0 2.3.5 2.7 1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ChainLinkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <path d="M9.5 14.5 14.5 9.5" strokeLinecap="round" />
      <path d="M11 6.5 12.6 5a3.6 3.6 0 0 1 5 5L16 11.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 17.5 11.4 19a3.6 3.6 0 0 1-5-5L8 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} className={`${base} ${className ?? ""}`}>
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <path d="M12 4 3 20h18L12 4Z" strokeLinejoin="round" />
      <path d="M12 10.5v4" strokeLinecap="round" />
      <circle cx="12" cy="17.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function KeyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <circle cx="8" cy="14.5" r="3.5" />
      <path d="M10.5 12 19 3.5M16 6.5l2.2 2.2M13.3 9.2l2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WalletIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1 1 0 0 1 1 1v2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="7.5" width="18" height="13" rx="2" />
      <path d="M16 14.3h2.2" strokeLinecap="round" />
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <path d="M7 4.5v15l13-7.5-13-7.5Z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} className={`${base} ${className ?? ""}`}>
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M6 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChipIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.75} className={`${base} ${className ?? ""}`}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M9.5 7V4M14.5 7V4M9.5 20v-3M14.5 20v-3M7 9.5H4M7 14.5H4M20 9.5h-3M20 14.5h-3" strokeLinecap="round" />
    </svg>
  );
}

export const CAPABILITY_ICON: Record<string, (p: IconProps) => React.JSX.Element> = {
  market_data: ChartIcon,
  news_scan: NewsIcon,
  risk_flags: ShieldIcon,
  synthesize_report: ReportIcon,
};
