const COLOR_MAP: Record<string, string> = {
  running: "bg-blue-100 text-blue-700",
  idle: "bg-gray-100 text-gray-700",
  waiting_for_answers: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  confirmed: "bg-green-100 text-green-700",
  estimated: "bg-yellow-100 text-yellow-700",
  unconfirmed: "bg-red-100 text-red-700",
  insufficient_evidence: "bg-gray-100 text-gray-500",
};

const STATUS_ICONS: Record<string, string> = {
  confirmed: "\u2705",
  estimated: "\uD83D\uDD36",
  unconfirmed: "\u2753",
  insufficient_evidence: "\u26A0\uFE0F",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${COLOR_MAP[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_ICONS[status] && <span>{STATUS_ICONS[status]}</span>}
      {label ?? status}
    </span>
  );
}
