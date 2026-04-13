// 변경 유형 배지 컴포넌트
// ADDED / REMOVED / MODIFIED / SAME 를 색상으로 구분
// TypeScript의 satisfies 연산자: 객체가 특정 타입을 만족하는지 컴파일 타임 검사
//   Java의 final Map<String, Style>과 유사하나 타입 추론이 더 강력함

export type ChangeType = "ADDED" | "REMOVED" | "MODIFIED" | "SAME";

const styleMap = {
  ADDED: {
    badge: "bg-green-100 text-green-700 border-green-300",
    row: "bg-green-50",
    symbol: "+",
    label: "추가",
  },
  REMOVED: {
    badge: "bg-red-100 text-red-700 border-red-300",
    row: "bg-red-50",
    symbol: "-",
    label: "삭제",
  },
  MODIFIED: {
    badge: "bg-yellow-100 text-yellow-700 border-yellow-300",
    row: "bg-yellow-50",
    symbol: "~",
    label: "변경",
  },
  SAME: {
    badge: "bg-gray-100 text-gray-500 border-gray-200",
    row: "",
    symbol: "=",
    label: "동일",
  },
} satisfies Record<ChangeType, { badge: string; row: string; symbol: string; label: string }>;

interface ChangeTypeBadgeProps {
  type: ChangeType;
}

/** 변경 유형 인라인 배지 */
export function ChangeTypeBadge({ type }: ChangeTypeBadgeProps) {
  const style = styleMap[type];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-semibold ${style.badge}`}
    >
      {style.symbol} {style.label}
    </span>
  );
}

/** 행 전체 배경색 반환 유틸 */
export function getChangeTypeRowClass(type: ChangeType): string {
  return styleMap[type].row;
}
