import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// The cart page itself is a client component and cannot export metadata, so
// the segment layout carries it. Never indexed: its contents belong to one
// shopper's session and mean nothing in a search result.
export const metadata: Metadata = pageMeta({
  title: "Mon panier",
  description: "Vos pièces sélectionnées, avec le total et les frais de livraison.",
  path: "/panier",
  noIndex: true,
});

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
