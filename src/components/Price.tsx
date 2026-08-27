import { formatTND } from "@/lib/money";

/**
 * Renders a price with a forced LTR direction so "32.70 DT" doesn't get
 * visually reordered by the bidi algorithm when the page is RTL (Arabic).
 */
export default function Price({ value, className }: { value: number | string; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {formatTND(value)}
    </bdi>
  );
}
