import { STATUS_BADGE_STYLES } from "@/lib/constants";
import { cn, labelForStatus } from "@/lib/utils";

export function StatusBadge({ value, className = "" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        STATUS_BADGE_STYLES[value] ||
          "border border-slate-200 bg-slate-100 text-slate-700",
        className
      )}
    >
      {labelForStatus(value)}
    </span>
  );
}
