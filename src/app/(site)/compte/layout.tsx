import type { Metadata } from "next";

/**
 * Everything under /compte belongs to one signed-in customer. Marked
 * noindex/nofollow at the segment root so every page inherits it — including
 * ones added later, which is the point of putting it here rather than on each.
 * robots.txt already disallows the path; this is the belt to that pair of
 * braces, since a disallowed URL can still be indexed from an external link.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
