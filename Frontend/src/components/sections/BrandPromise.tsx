"use client";

import { useState } from "react";
import { Heart, Leaf, ShieldCheck, User, type LucideIcon } from "lucide-react";
import { subscribeNewsletter } from "../../lib/api";

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */


const FEATURES: { Icon: LucideIcon; title: string; desc: string }[] = [
  {
    Icon: Leaf,
    title: "Sustainably Sourced",
    desc: "Timber from responsibly managed forests, traced from stump to showroom.",
  },
  {
    Icon: ShieldCheck,
    title: "Built to Last",
    desc: "Mortise-and-tenon joinery and solid hardwood — made to outlive trends.",
  },
  {
    Icon: Heart,
    title: "Made with Care",
    desc: "Hand-finished in our workshop, where every piece is signed before it ships.",
  },
  {
    Icon: User,
    title: "Designed for You",
    desc: "Dimensions, timber and upholstery tailored to the room you actually live in.",
  },
];

const IMAGE_PATH = "/images/hero-promise/chair-scene.webp";

/**
 * Social marks as inline SVG. lucide dropped its brand icons in v1, and
 * brand glyphs are trademarks best shipped as exact paths rather than
 * redrawn — so all three live here.
 */
type IconProps = { className?: string };

function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.9 5.9 0 0 0-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0m0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84M12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4m7.85-10.4a1.44 1.44 0 1 1-1.44-1.44 1.44 1.44 0 0 1 1.44 1.44" />
    </svg>
  );
}

function PinterestIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.237 2.636 7.855 6.356 9.312-.088-.791-.167-2.005.035-2.868.182-.78 1.172-4.97 1.172-4.97s-.299-.598-.299-1.482c0-1.388.805-2.425 1.807-2.425.852 0 1.263.64 1.263 1.406 0 .857-.545 2.138-.827 3.325-.235.994.499 1.804 1.478 1.804 1.774 0 3.138-1.871 3.138-4.571 0-2.39-1.718-4.062-4.171-4.062-2.841 0-4.509 2.131-4.509 4.333 0 .858.331 1.779.744 2.279a.3.3 0 0 1 .069.287c-.076.316-.245.994-.278 1.133-.043.183-.145.222-.334.134-1.249-.582-2.03-2.408-2.03-3.874 0-3.154 2.292-6.052 6.607-6.052 3.469 0 6.165 2.472 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.966-.527-2.292-1.148l-.623 2.378c-.226.869-.835 1.958-1.243 2.622A10 10 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2" />
    </svg>
  );
}

function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ContentLeft() {
  return (
    <div className="max-w-xl">
      <p className="font-ui text-[11px] font-medium uppercase tracking-[0.3em] text-maple-accent">
        The Maple Promise
      </p>

      <h2
        className="mt-6 text-4xl leading-[1.15] text-maple-headline sm:text-5xl lg:text-[3.4rem]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
      >
        Furniture that earns
        <br />
        its place in your home
      </h2>

      <p className="mt-6 font-ui text-sm leading-relaxed text-maple-body">
        We build a small number of pieces each month, by hand, from timber we
        can trace. No flat-pack shortcuts, no finishes that flake in a year —
        just honest joinery meant to be handed down rather than replaced.
      </p>

      <div className="mt-10 h-px w-16 bg-maple-accent/70" />

      <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2">
        {FEATURES.map(({ Icon, title, desc }) => (
          <div key={title} className="group">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-maple-divider text-maple-accent transition-colors duration-300 group-hover:border-maple-accent/50">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </span>
            <h3 className="mt-4 font-ui text-[13px] font-semibold tracking-[0.04em] text-maple-headline">
              {title}
            </h3>
            <p className="mt-2 font-ui text-[12.5px] leading-relaxed text-maple-body">
              {desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContentRight() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="relative">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-maple-divider">
        {/* Until the asset is dropped in, this degrades to the tinted panel
            rather than a broken-image glyph. The ref callback matters: the
            browser can fail the request before React hydrates and attaches
            onError, so we re-check `complete && naturalWidth === 0` on mount. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={(el) => {
            if (el?.complete && el.naturalWidth === 0) setImgFailed(true);
          }}
          src={IMAGE_PATH}
          alt="A Maple Furnishers lounge chair in a sunlit interior"
          className={`h-full w-full object-cover ${imgFailed ? "hidden" : ""}`}
          onError={() => setImgFailed(true)}
        />
      </div>

      {/* Floating quote card */}
      <figure className="absolute left-5 top-5 max-w-[15.5rem] rounded-xl border border-white/10 bg-black/50 p-5 backdrop-blur-lg">
        <span
          className="block text-3xl leading-none text-maple-accent"
          style={{ fontFamily: "var(--font-display)" }}
          aria-hidden
        >
          &ldquo;
        </span>
        <blockquote
          className="mt-2 text-[15px] italic leading-snug text-maple-headline"
          style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
        >
          We don&rsquo;t sell furniture. We hand over something someone will
          still be using in forty years.
        </blockquote>
        <figcaption className="mt-3 font-ui text-[10px] uppercase tracking-[0.22em] text-maple-accent">
          Arjun Mehra — Founder
        </figcaption>
      </figure>
    </div>
  );
}

function BrandFooter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  return (
    <footer className="border-t border-maple-divider bg-maple-footer">
      <div className="mx-auto grid max-w-[1600px] gap-12 px-6 py-16 lg:grid-cols-3 lg:items-start lg:gap-8 lg:px-12">
        {/* 1 — step counter */}
        <div>
          <p className="font-ui text-sm tracking-[0.1em] text-maple-body/50">
            <span className="text-maple-accent">07</span> / 07
          </p>
          <p className="mt-2 font-ui text-[10px] uppercase tracking-[0.28em] text-maple-body/70">
            The Maple Promise
          </p>
        </div>

        {/* 2 — sign-off */}
        <div className="lg:text-center">
          <p className="font-ui text-[10px] uppercase tracking-[0.28em] text-maple-body/70">
            Thank you for exploring
          </p>
          <Leaf
            className="mt-4 h-5 w-5 text-maple-accent lg:mx-auto"
            strokeWidth={1.5}
            aria-hidden
          />
          <p
            className="mt-4 text-2xl text-maple-headline"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            Maple Furnishers
          </p>
        </div>

        {/* 3 — newsletter */}
        <div className="lg:justify-self-end lg:text-left">
          <h3
            className="text-xl text-maple-headline"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            Stay Inspired
          </h3>
          <p className="mt-3 max-w-xs font-ui text-[12.5px] leading-relaxed text-maple-body">
            New pieces, workshop notes and the occasional look behind the
            bench. No more than once a month.
          </p>

          <form
            className="mt-5 flex max-w-sm items-center gap-2 rounded-full border border-maple-divider bg-maple-bg/60 p-1.5 focus-within:border-maple-accent/60"
            onSubmit={async (e) => {
              e.preventDefault();
              if (status === "sending") return;
              setStatus("sending");
              try {
                await subscribeNewsletter(email);
                setStatus("sent");
              } catch {
                setStatus("error");
              }
            }}
          >
            <label htmlFor="mf-newsletter" className="sr-only">
              Email address
            </label>
            <input
              id="mf-newsletter"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="min-w-0 flex-1 bg-transparent px-4 font-ui text-[12.5px] text-maple-headline placeholder:text-maple-body/50 focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-maple-accent px-5 py-2.5 font-ui text-[10px] font-semibold uppercase tracking-wider text-maple-bg transition-colors hover:bg-maple-accent/85"
            >
              Subscribe
            </button>
          </form>

          <p
            className="mt-2 h-4 font-ui text-[11px] text-maple-accent"
            role="status"
            aria-live="polite"
          >
            {status === "sent"
              ? "Thank you — you're on the list."
              : status === "error"
                ? "Couldn't subscribe — please try again."
                : status === "sending"
                  ? "Subscribing…"
                  : ""}
          </p>

          <div className="mt-5 flex gap-3">
            {[
              { Cmp: InstagramIcon, label: "Instagram" },
              { Cmp: PinterestIcon, label: "Pinterest" },
              { Cmp: FacebookIcon, label: "Facebook" },
            ].map(({ Cmp, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-maple-divider text-maple-body transition-colors hover:border-maple-accent/60 hover:text-maple-accent"
              >
                <Cmp className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-maple-divider/60 px-6 py-6 lg:px-12">
        <p className="mx-auto max-w-[1600px] font-ui text-[11px] text-maple-body/50">
          © {new Date().getFullYear()} Maple Furnishers. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Section                                                            */
/* ------------------------------------------------------------------ */

/**
 * The closing 07/07 beat of the hero journey — the point where the
 * scroll-scrubbed film hands over to real, interactive page furniture.
 */
export default function BrandPromise() {
  return (
    <>
      {/* 06 — the promise + contact/sign-off. (05 is the sun-dappled beat
          inside the outro scrub — a marker there, not a DOM section.) */}
      <section id="contact" className="relative z-10 bg-maple-bg">
        <div className="mx-auto max-w-[1600px] px-6 py-28 lg:px-20 lg:py-32">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <ContentLeft />
            <ContentRight />
          </div>
        </div>
        <BrandFooter />
      </section>
    </>
  );
}
