"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { usePageNavigate } from "./PageTransition";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/**
 * next/link that routes through the page-transition curtain. Modified
 * clicks (new tab, etc.) keep the browser's default behaviour.
 */
export default function TransitionLink({ href, onClick, ...rest }: Props) {
  const navigate = usePageNavigate();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    navigate(href);
  };

  return <Link href={href} onClick={handleClick} {...rest} />;
}
