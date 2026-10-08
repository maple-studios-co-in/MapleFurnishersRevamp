import styles from "./mobile.module.css";

/** The desktop SocialRail's three rings, for the phone menu and brand card. */
const SOCIALS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/maplefurnishers",
    path: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/maplefurnishers",
    path: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  },
  {
    label: "Twitter",
    href: "https://x.com/maplefurnishers",
    path: (
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    ),
  },
] as const;

export default function Socials({ className }: { className?: string }) {
  return (
    <div className={className}>
      {SOCIALS.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noreferrer"
          className={styles.social}
          aria-label={`Maple Furnishers on ${s.label}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {s.path}
          </svg>
        </a>
      ))}
    </div>
  );
}
