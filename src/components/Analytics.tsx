"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";

/** Mounted once in the root layout — fires page_view on every route change. */
export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    track("page_view", { path: pathname });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
