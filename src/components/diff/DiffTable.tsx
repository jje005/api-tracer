// Diff 결과 테이블 컴포넌트 (클라이언트 컴포넌트)
// 필터(전체/추가/삭제/변경) + 검색 + 정렬 지원
"use client";

import { useState, useMemo } from "react";
import { ChangeTypeBadge, getChangeTypeRowClass, type ChangeType } from "./ChangeTypeBadge";
import { Search } from "lucide-react";

// ─── 타입 정의 ────────────────────────────────────────────────
interface ApiEntry {
  id: string;
  className: string;
  methodName: string;
  params: string[];
  returnType: string;
  isStatic: boolean;
  isDeprecated: boolean;
}

export interface DiffItem {
  signature: string;
  api: ApiEntry;
  changeType: ChangeType;
  // MODIFIED일 때만 존재
  oldReturnType?: string;
  newReturnType?: string;
}

interface DiffTableProps {
  items: DiffItem[];
}

// 필터 탭 타입: "ALL" | ChangeType
type FilterTab = "ALL" | ChangeType;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "ADDED", label: "+ 추가" },
  { value: "REMOVED", label: "- 삭제" },
  { value: "MODIFIED", label: "~ 변경" },
  { value: "SAME", label: "= 동일" },
];

export function DiffTable({ items }: DiffTableProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [search, setSearch] = useState("");

  // 필터 + 검색 적용
  // useMemo: 의존성이 바뀔 때만 재계산. Java의 캐시 계산 패턴과 유사
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchFilter =
        activeFilter === "ALL" || item.changeType === activeFilter;
      const matchSearch =
        !search ||
        item.signature.toLowerCase().includes(search.toLowerCase()) ||
        item.api.className.toLowerCase().includes(search.toLowerCase()) ||
        item.api.methodName.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [items, activeFilter, search]);

  // 탭별 카운트
  const counts = useMemo(() => {
    return {
      ALL: items.length,
      ADDED: items.filter((i) => i.changeType === "ADDED").length,
      REMOVED: items.filter((i) => i.changeType === "REMOVED").length,
      MODIFIED: items.filter((i) => i.changeType === "MODIFIED").length,
      SAME: items.filter((i) => i.changeType === "SAME").length,
    };
  }, [items]);

  return (
    <div className="space-y-3">
      {/* 필터 탭 + 검색 */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* 탭 */}
        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={[
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              ].join(" ")}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">
                {counts[tab.value]}
              </span>
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="클래스명 또는 메서드명 검색..."
            className="pl-8 pr-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-24">상태</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">클래스</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">메서드 시그니처</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-40">반환 타입</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-muted-foreground">
                  해당하는 API가 없습니다
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => (
                <DiffRow key={`${item.signature}-${idx}`} item={item} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {filteredItems.length} / {items.length} 개 표시
      </p>
    </div>
  );
}

// ─── 개별 행 컴포넌트 ────────────────────────────────────────
function DiffRow({ item }: { item: DiffItem }) {
  const rowClass = getChangeTypeRowClass(item.changeType);
  // 클래스명 단순화: 패키지 제거
  const simpleClass = item.api.className.split(".").pop() ?? item.api.className;
  const packageName = item.api.className.includes(".")
    ? item.api.className.substring(0, item.api.className.lastIndexOf("."))
    : "";

  return (
    <tr className={`${rowClass} hover:brightness-95 transition-all`}>
      {/* 상태 배지 */}
      <td className="px-4 py-2.5">
        <ChangeTypeBadge type={item.changeType} />
      </td>

      {/* 클래스명 */}
      <td className="px-4 py-2.5">
        <div className="font-mono">
          <span className="font-medium">{simpleClass}</span>
        </div>
        {packageName && (
          <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
            {packageName}
          </div>
        )}
      </td>

      {/* 메서드 시그니처 */}
      <td className="px-4 py-2.5 font-mono">
        {item.api.isStatic && (
          <span className="text-blue-500 text-xs mr-1">static </span>
        )}
        <span className="font-medium">{item.api.methodName}</span>
        <span className="text-muted-foreground">
          ({item.api.params.join(", ")})
        </span>
        {item.api.isDeprecated && (
          <span className="ml-2 text-xs px-1 py-0.5 rounded bg-yellow-50 text-yellow-600 font-sans">
            deprecated
          </span>
        )}
      </td>

      {/* 반환 타입 */}
      <td className="px-4 py-2.5">
        {item.changeType === "MODIFIED" ? (
          // 변경된 경우 이전 → 이후 표시
          <div className="font-mono text-xs space-y-0.5">
            <div className="line-through text-red-500">{item.oldReturnType}</div>
            <div className="text-green-600">{item.newReturnType}</div>
          </div>
        ) : (
          <span className="font-mono text-xs text-green-600">{item.api.returnType}</span>
        )}
      </td>
    </tr>
  );
}
