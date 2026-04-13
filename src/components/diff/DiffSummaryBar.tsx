// Diff 요약 바 컴포넌트
// 추가 N / 삭제 N / 변경 N / 동일 N 을 한 줄로 표시

interface DiffSummary {
  added: number;
  removed: number;
  modified: number;
  same: number;
  total: number;
}

interface DiffSummaryBarProps {
  summary: DiffSummary;
  v1Version: string;
  v2Version: string;
}

export function DiffSummaryBar({ summary, v1Version, v2Version }: DiffSummaryBarProps) {
  const changed = summary.added + summary.removed + summary.modified;
  const changePercent = summary.total > 0 ? Math.round((changed / summary.total) * 100) : 0;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* 버전 표시 */}
      <div className="flex items-center gap-2 text-sm">
        <span className="px-2 py-1 rounded bg-secondary font-mono">v{v1Version}</span>
        <span className="text-muted-foreground">→</span>
        <span className="px-2 py-1 rounded bg-primary text-primary-foreground font-mono">v{v2Version}</span>
        <span className="ml-auto text-muted-foreground">전체 {summary.total}개 API 비교</span>
      </div>

      {/* 카운트 뱃지 */}
      <div className="flex flex-wrap gap-3">
        <StatChip color="green" symbol="+" label="추가" count={summary.added} />
        <StatChip color="red" symbol="-" label="삭제" count={summary.removed} />
        <StatChip color="yellow" symbol="~" label="변경" count={summary.modified} />
        <StatChip color="gray" symbol="=" label="동일" count={summary.same} />
      </div>

      {/* 변경 비율 바 */}
      {summary.total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>변경 비율</span>
            <span>{changePercent}% ({changed}개 변경)</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
            {/* 추가 */}
            {summary.added > 0 && (
              <div
                className="bg-green-500 h-full transition-all"
                style={{ width: `${(summary.added / summary.total) * 100}%` }}
              />
            )}
            {/* 삭제 */}
            {summary.removed > 0 && (
              <div
                className="bg-red-500 h-full transition-all"
                style={{ width: `${(summary.removed / summary.total) * 100}%` }}
              />
            )}
            {/* 변경 */}
            {summary.modified > 0 && (
              <div
                className="bg-yellow-500 h-full transition-all"
                style={{ width: `${(summary.modified / summary.total) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 내부 칩 컴포넌트 ─────────────────────────────────────────
interface StatChipProps {
  color: "green" | "red" | "yellow" | "gray";
  symbol: string;
  label: string;
  count: number;
}

const chipColors = {
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  yellow: "bg-yellow-100 text-yellow-700",
  gray: "bg-gray-100 text-gray-500",
} satisfies Record<string, string>;

function StatChip({ color, symbol, label, count }: StatChipProps) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${chipColors[color]}`}>
      <span className="font-mono">{symbol}</span>
      <span>{label}</span>
      <span className="font-bold">{count}</span>
    </div>
  );
}
