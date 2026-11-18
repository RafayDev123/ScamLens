/** ScamLens mark: a shield whose centre is a lens with a scan aperture. Works without the wordmark. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2.5 4.5 6.6v8.3c0 7.1 4.7 12.3 11.5 14.6 6.8-2.3 11.5-7.5 11.5-14.6V6.6L16 2.5Z" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="15" cy="14.5" r="5.2" stroke="var(--accent)" strokeWidth="1.8" />
      <path d="m19 18.6 3.6 3.6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.4 14.5h5.2" stroke="var(--azure)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">
        Scam<span className="text-accent">Lens</span>
      </span>
    </span>
  );
}
