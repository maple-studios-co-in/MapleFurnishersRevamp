"use client";

import { ShoppingBag } from "lucide-react";
import { usePathname } from "next/navigation";
import MapleLogo from "@/components/ui/MapleLogo";
import { BULK_ENQUIRY_URL, SHOP_URL } from "@/lib/links";
import { usesPaperHeader } from "@/lib/sections";
import PhoneMenu from "./PhoneMenu";
import TransitionLink from "./TransitionLink";
import styles from "./PhoneSiteHeader.module.css";

/**
 * The phone header for pages that otherwise have none below 1024px (the
 * desktop SiteHeader is hidden there): today the product customizer. The
 * wordmark, Shop Now and the menu, in the home phone header's cream over
 * the dark page. Home brings its own phone header, and the editorial
 * routes wear PaperHeader, which carries the menu itself.
 */
export default function PhoneSiteHeader() {
  const pathname = usePathname();
  if (pathname === "/" || usesPaperHeader(pathname)) return null;

  return (
    <header className={styles.root}>
      <TransitionLink href="/" className={styles.logo} aria-label="Maple Furnishers — home">
        <MapleLogo idPrefix="maple-phone-header-logo" />
      </TransitionLink>
      <div className={styles.end}>
        <a href={SHOP_URL} className={styles.shop}>
          Shop Now
          <ShoppingBag strokeWidth={1.5} aria-hidden />
        </a>
        <PhoneMenu
          primary={{ label: "Shop Now", href: SHOP_URL }}
          secondary={{ label: "Bulk Order", href: BULK_ENQUIRY_URL }}
        />
      </div>
    </header>
  );
}
