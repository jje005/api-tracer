// API 탐색기 — 전체 열기/닫기 + 페이지네이션 + 제외 버튼 (클라이언트 컴포넌트)
// 서버 컴포넌트에서 데이터를 받아 인터랙티브 UI만 담당
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Ban, X, Check, RefreshCw } from "lucide-react";
import { useExcludeRulesStore } from "@/lib/stores/excludeRulesStore";

// ─── 타입 정의 ────────────────────────────────────────────────
export interface ApiEntryData {
  id: string;
  methodName: string;
  params: string[];
  returnType: string;
  isStatic: boolean;
  isDeprecated: boolean;
}

export interface ApiExplorerProps {
  moduleId: string;
  projectId: string;  // 제외 규칙 API 호출에 필요
  grouped: Record<string, ApiEntryData[]>;
  currentPage: number;
  totalPages: number;
  totalClasses: number;
  totalApis: number;
  filteredClasses: number;
  filteredApis: number;
  search: string;
}

// ─── 제외 팝업 컴포넌트 ──────────────────────────────────────
// 클래스 또는 메서드 제외 요청을 인라인에서 처리
// 별도 모달 없이 버튼 옆에 소형 팝업으로 표시
interface ExcludePopupProps {
  projectId: string;
  type: "CLASS" | "METHOD";
  className: string;
  methodName?: string;
  params?: string[];
  onClose: () => void;
  onSuccess: () => void;
}

function ExcludePopup({
  projectId, type, className, methodName, params, onClose, onSuccess,
}: ExcludePopupProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // 제외 규칙 추가 후 ExcludeRulesPanel에 변경 알림 (Zustand)
  const notifyChanged = useExcludeRulesStore((s) => s.notifyChanged);
  // 팝업 외부 클릭 시 닫기를 위한 ref
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지
  // TypeScript의 MouseEvent 제네릭: Java의 EventListener와 유사
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/exclude-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          className,
          methodName: type === "METHOD" ? methodName : undefined,
          matchParams: type === "METHOD" && (params?.length ?? 0) > 0,
          params: type === "METHOD" ? (params ?? []) : [],
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "저장 실패");
        return;
      }

      console.log(`[ApiExplorer] 제외 규칙 추가: ${type} ${className}${methodName ? `.${methodName}` : ""}`);
      // ExcludeRulesPanel이 있는 업로드 페이지 등에서 자동 동기화되도록 알림
      notifyChanged(projectId);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setSaving(false);
    }
  };

  const simpleClass = className.split(".").pop() ?? className;
  const label = type === "CLASS"
    ? `클래스 "${simpleClass}" 전체 제외`
    : `"${simpleClass}.${methodName}" 제외`;

  return (
    // z-50으로 다른 요소 위에 표시 (details summary 포함)
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border bg-background shadow-lg p-3 space-y-2"
    >
      <p className="text-xs font-medium text-foreground">{label}</p>

      {/* 메모 입력 */}
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="제외 이유 (선택)"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-1 justify-end">
        <button
          onClick={onClose}
          className="p-1.5 rounded border hover:bg-accent text-xs"
          title="취소"
        >
          <X size={11} />
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 px-2 py-1 rounded bg-destructive text-destructive-foreground text-xs hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <RefreshCw size={10} className="animate-spin" /> : <Check size={10} />}
          제외 추가
        </button>
      </div>
    </div>
  );
}

// ─── Sticky 전체 열기/닫기 패널 ──────────────────────────────
function StickyTogglePanel({
  currentPage, totalPages, totalClasses, totalApis,
  filteredClasses, filteredApis, search,
}: {
  currentPage: number; totalPages: number; totalClasses: number;
  totalApis: number; filteredClasses: number; filteredApis: number; search: string;
}) {
  const handleToggle = (open: boolean) => {
    document.querySelectorAll<HTMLDetailsElement>("details[data-class-group]").forEach((el) => {
      el.open = open;
    });
  };

  return (
    <div className="sticky top-20 z-10 self-start rounded-lg border bg-background shadow-sm p-3 space-y-3 w-44">
      <div className="text-xs text-muted-foreground space-y-1">
        {search ? (
          <>
            <p><span className="font-medium text-foreground">{filteredClasses}</span>개 클래스</p>
            <p><span className="font-medium text-foreground">{filteredApis}</span>개 API (필터)</p>
            <p className="text-[10px]">전체 {totalClasses}클래스/{totalApis}API</p>
          </>
        ) : (
          <>
            <p><span className="font-medium text-foreground">{totalClasses}</span>개 클래스</p>
            <p><span className="font-medium text-foreground">{totalApis}</span>개 API</p>
            {totalPages > 1 && (
              <p className="text-[10px]">페이지 {currentPage}/{totalPages}</p>
            )}
          </>
        )}
      </div>

      <div className="border-t pt-2 space-y-1.5">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">열기 / 닫기</p>
        <button
          onClick={() => handleToggle(true)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs hover:bg-accent transition-colors"
        >
          <ChevronsUpDown size={11} /> 전체 열기
        </button>
        <button
          onClick={() => handleToggle(false)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs hover:bg-accent transition-colors"
        >
          <ChevronsDownUp size={11} /> 전체 닫기
        </button>
      </div>
    </div>
  );
}

// ─── 페이지네이션 ─────────────────────────────────────────────
function Pagination({ moduleId, currentPage, totalPages, search }: {
  moduleId: string; currentPage: number; totalPages: number; search: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goTo = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`/modules/${moduleId}?${params.toString()}`);
  };

  if (totalPages <= 1) return null;

  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    const delta = 2;
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);
    pages.push(1);
    if (rangeStart > 2) pages.push("...");
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < totalPages - 1) pages.push("...");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button onClick={() => goTo(currentPage - 1)} disabled={currentPage === 1}
        className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-40 hover:bg-accent transition-colors">‹</button>
      {getPageNumbers().map((p, i) =>
        p === "..." ? (
          <span key={`e-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
        ) : (
          <button key={p} onClick={() => goTo(p as number)}
            className={["min-w-[36px] px-2 py-1.5 rounded-md border text-sm transition-colors",
              p === currentPage ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
            ].join(" ")}>
            {p}
          </button>
        )
      )}
      <button onClick={() => goTo(currentPage + 1)} disabled={currentPage === totalPages}
        className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-40 hover:bg-accent transition-colors">›</button>
    </div>
  );
}

// ─── 클래스 그룹 ─────────────────────────────────────────────
function ClassGroup({
  className, apis, projectId,
}: {
  className: string;
  apis: ApiEntryData[];
  projectId: string;
}) {
  const simpleClassName = className.split(".").pop() ?? className;
  const packageName = className.includes(".")
    ? className.substring(0, className.lastIndexOf("."))
    : "";

  // 클래스/메서드 레벨 제외 팝업 상태
  // null이면 닫힘, "CLASS"이면 클래스 팝업, apiId이면 해당 API 팝업
  const [activePopup, setActivePopup] = useState<"CLASS" | string | null>(null);
  // 제외 완료된 항목 로컬 표시 (페이지 새로고침 없이 시각적 피드백)
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());

  const handleExcludeSuccess = (key: string) => {
    setExcludedItems((prev) => new Set([...prev, key]));
    setActivePopup(null);
  };

  return (
    <details data-class-group className="group rounded-lg border overflow-hidden" open>
      <summary className="flex items-center justify-between px-4 py-3 bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors list-none">
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight size={14} className="group-open:rotate-90 transition-transform text-muted-foreground shrink-0" />
          <span className="font-mono font-medium text-sm truncate">{simpleClassName}</span>
          {packageName && (
            <span className="text-xs text-muted-foreground truncate hidden sm:block">{packageName}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs text-muted-foreground">{apis.length}개</span>

          {/* 클래스 전체 제외 버튼 — relative wrapper로 팝업 위치 기준 */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            {excludedItems.has("CLASS") ? (
              <span className="text-xs text-muted-foreground px-1">제외됨</span>
            ) : (
              <button
                onClick={() => setActivePopup(activePopup === "CLASS" ? null : "CLASS")}
                title="이 클래스 전체 제외"
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Ban size={13} />
              </button>
            )}
            {activePopup === "CLASS" && (
              <ExcludePopup
                projectId={projectId}
                type="CLASS"
                className={className}
                onClose={() => setActivePopup(null)}
                onSuccess={() => handleExcludeSuccess("CLASS")}
              />
            )}
          </div>
        </div>
      </summary>

      <div className="divide-y">
        {apis.map((api) => {
          const apiKey = api.id;
          const isExcluded = excludedItems.has(apiKey);

          return (
            <div
              key={api.id}
              className={[
                "flex items-start justify-between px-4 py-2 hover:bg-muted/30 transition-colors group/row",
                api.isDeprecated || isExcluded ? "opacity-50" : "",
              ].join(" ")}
            >
              <div className="font-mono text-sm min-w-0">
                {api.isStatic && <span className="text-blue-500 text-xs mr-1">static </span>}
                <span className="font-medium">{api.methodName}</span>
                <span className="text-muted-foreground">({api.params.join(", ")})</span>
                {api.isDeprecated && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-600 font-sans">
                    deprecated
                  </span>
                )}
                {isExcluded && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-sans">
                    제외됨
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 ml-4 shrink-0">
                <span className="font-mono text-xs text-green-600">: {api.returnType}</span>

                {/* API 제외 버튼 — hover 시 표시 */}
                {!isExcluded && (
                  <div className="relative">
                    <button
                      onClick={() => setActivePopup(activePopup === apiKey ? null : apiKey)}
                      title="이 API 제외"
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover/row:opacity-100"
                    >
                      <Ban size={12} />
                    </button>
                    {activePopup === apiKey && (
                      <ExcludePopup
                        projectId={projectId}
                        type="METHOD"
                        className={className}
                        methodName={api.methodName}
                        params={api.params}
                        onClose={() => setActivePopup(null)}
                        onSuccess={() => handleExcludeSuccess(apiKey)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

// ─── 메인 ApiExplorer ─────────────────────────────────────────
export function ApiExplorer({
  moduleId, projectId, grouped, currentPage, totalPages,
  totalClasses, totalApis, filteredClasses, filteredApis, search,
}: ApiExplorerProps) {
  const entries = Object.entries(grouped);

  return (
    <div className="flex gap-4 items-start">
      {/* 왼쪽: 클래스 그룹 목록 + 페이지네이션 */}
      <div className="flex-1 space-y-2 min-w-0">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            {search ? `"${search}"에 해당하는 API가 없습니다` : "API가 없습니다"}
          </div>
        ) : (
          <>
            {entries.map(([cls, apis]) => (
              <ClassGroup key={cls} className={cls} apis={apis} projectId={projectId} />
            ))}
            <Pagination moduleId={moduleId} currentPage={currentPage} totalPages={totalPages} search={search} />
          </>
        )}
      </div>

      {/* 오른쪽: sticky 통계 + 전체 열기/닫기 패널 */}
      <StickyTogglePanel
        currentPage={currentPage} totalPages={totalPages}
        totalClasses={totalClasses} totalApis={totalApis}
        filteredClasses={filteredClasses} filteredApis={filteredApis}
        search={search}
      />
    </div>
  );
}
