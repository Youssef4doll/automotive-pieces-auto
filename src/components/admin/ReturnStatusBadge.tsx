import { RETURN_STATUS_LABEL } from "@/lib/returns-labels";
import type { ReturnStatus } from "@/lib/returns-rules";

const TONE: Record<ReturnStatus, string> = {
  REQUESTED: "bg-red-50 text-red-700 border-red-200",
  APPROVED: "bg-gold-500/15 text-navy-950 border-gold-500/40",
  RECEIVED: "bg-navy-50 text-navy-900 border-navy-900/15",
  RESOLVED: "bg-green-50 text-green-700 border-green-200",
  REFUSED: "bg-slate-100 text-slate-600 border-slate-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap ${TONE[status]}`}>
      {RETURN_STATUS_LABEL[status]}
    </span>
  );
}
