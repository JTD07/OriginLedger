"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function FocusOnNavigate() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const heading = document.querySelector<HTMLElement>("#main-content h1");
    heading?.focus();
  }, [pathname]);

  return null;
}
