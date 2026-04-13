// 버전 비교(Diff) 페이지 — Phase 2
// 모듈 선택 → 두 버전 선택 → Diff 결과 표시
"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GitCompare, RefreshCw, ArrowRight } from "lucide-react";
import { DiffTable, type DiffItem } from "@/components/diff/DiffTable";
import { DiffSummaryBar } from "@/components/diff/DiffSummaryBar";
import type { ChangeType } from "@/components/diff/ChangeTypeBadge";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ─── 타입 정의 ────────────────────────────────────────────────
interface Module {
  id: string;
  name: string;
  type: string;
}

interface ModuleVersion {
  id: string;
  version: string;
  parsedAt: string;
}

interface DiffResult {
  v1: { id: string; version: string };
  v2: { id: string; version: string };
  summary: {
    added: number;
    removed: number;
    modified: number;
    same: number;
    total: number;
  };
  diff: {
    added: Array<{ signature: string; api: ApiEntry }>;
    removed: Array<{ signature: string; api: ApiEntry }>;
    modified: Array<{
      signature: string;
      api: ApiEntry;
      oldReturnType: string;
      newReturnType: string;
    }>;
    same: Array<{ signature: string; api: ApiEntry }>;
  };
}

interface ApiEntry {
  id: string;
  className: string;
  methodName: string;
  params: string[];
  returnType: string;
  isStatic: boolean;
  isDeprecated: boolean;
}

// useSearchParams()는 클라이언트 렌더링 타이밍에 의존하므로 Suspense 경계 필요
// Next.js 15에서 빌드 시 정적 분석 단계에서 오류 방지
// Java의 lazy initialization과 유사한 개념
export default function DiffPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">로딩 중...</div>}>
      <DiffPageInner />
    </Suspense>
  );
}

function DiffPageInner() {
  const [modules, setModules] = useState<Module[]>([]);
  // URL query param으로 moduleId가 넘어오면 자동 선택
  // useSearchParams: Next.js 클라이언트 훅, Java의 HttpServletRequest.getParameter와 유사
  const searchParams = useSearchParams();
  const moduleIdFromUrl = searchParams.get("moduleId") ?? "";

  const [selectedModuleId, setSelectedModuleId] = useState<string>(moduleIdFromUrl);
  const [versions, setVersions] = useState<ModuleVersion[]>([]);
  const [v1Id, setV1Id] = useState<string>("");
  const [v2Id, setV2Id] = useState<string>("");
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // 모듈 목록 로드 (URL에서 넘어온 moduleId 자동 적용)
  useEffect(() => {
    console.log("[DiffPage] 모듈 목록 로드");
    fetch("/api/modules")
      .then((r) => r.json())
      .then((data) => {
        setModules(data);
        // URL에서 moduleId가 있으면 자동 선택
        if (moduleIdFromUrl) setSelectedModuleId(moduleIdFromUrl);
      })
      .catch((e) => console.error("[DiffPage] 모듈 로드 실패:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 모듈 선택 시 버전 목록 로드
  const loadVersions = useCallback(async (moduleId: string) => {
    if (!moduleId) return;
    console.log(`[DiffPage] 버전 목록 로드: ${moduleId}`);
    try {
      const res = await fetch(`/api/modules/${moduleId}`);
      const data = await res.json();
      setVersions(data.versions ?? []);
      setV1Id("");
      setV2Id("");
      setDiffResult(null);
    } catch (e) {
      console.error("[DiffPage] 버전 로드 실패:", e);
    }
  }, []);

  useEffect(() => {
    if (selectedModuleId) loadVersions(selectedModuleId);
  }, [selectedModuleId, loadVersions]);

  // Diff 실행
  const runDiff = async () => {
    if (!v1Id || !v2Id) return;
    if (v1Id === v2Id) {
      setError("같은 버전을 선택할 수 없습니다");
      return;
    }

    setLoading(true);
    setError("");
    setDiffResult(null);
    console.log(`[DiffPage] Diff 실행: v1=${v1Id}, v2=${v2Id}`);

    try {
      const res = await fetch(`/api/diff?v1=${v1Id}&v2=${v2Id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Diff 실패");
      setDiffResult(data);
      console.log("[DiffPage] Diff 완료:", data.summary);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      setError(msg);
      console.error("[DiffPage] Diff 오류:", msg);
    } finally {
      setLoading(false);
    }
  };

  // DiffResult → DiffItem[] 변환 (테이블용 평탄화)
  // TypeScript 타입 가드 없이 ChangeType을 안전하게 붙이는 방법
  const flatItems: DiffItem[] = diffResult
    ? [
        ...diffResult.diff.added.map((i) => ({
          ...i,
          changeType: "ADDED" as ChangeType,
        })),
        ...diffResult.diff.removed.map((i) => ({
          ...i,
          changeType: "REMOVED" as ChangeType,
        })),
        ...diffResult.diff.modified.map((i) => ({
          ...i,
          changeType: "MODIFIED" as ChangeType,
        })),
        ...diffResult.diff.same.map((i) => ({
          ...i,
          changeType: "SAME" as ChangeType,
        })),
      ].sort((a, b) => {
        // 변경 항목 우선 정렬: REMOVED → ADDED → MODIFIED → SAME
        const order: Record<ChangeType, number> = {
          REMOVED: 0,
          ADDED: 1,
          MODIFIED: 2,
          SAME: 3,
        };
        return order[a.changeType] - order[b.changeType];
      })
    : [];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold">버전 비교</h2>
        <p className="text-muted-foreground mt-1">
          두 버전 간 추가·삭제·변경된 API를 확인합니다
        </p>
      </div>

      {/* 선택 폼 */}
      <div className="rounded-lg border p-5 space-y-4">
        {/* 1. 모듈 선택 */}
        <div>
          <label className="text-sm font-medium block mb-1.5">1. 모듈 선택</label>
          {modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              등록된 모듈이 없습니다.{" "}
              <a href="/upload" className="text-primary hover:underline">
                파일을 업로드
              </a>
              하세요.
            </p>
          ) : (
            <select
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            >
              <option value="">모듈을 선택하세요</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.type})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 2. 버전 선택 */}
        {versions.length > 0 && (
          <div>
            <label className="text-sm font-medium block mb-1.5">2. 버전 선택</label>
            {versions.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                비교하려면 버전이 2개 이상 필요합니다. 새 버전을{" "}
                <a href="/upload" className="text-primary hover:underline">
                  업로드
                </a>
                하세요.
              </p>
            ) : (
              <div className="flex items-center gap-3">
                {/* v1 선택 */}
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">이전 버전 (Old)</p>
                  <select
                    value={v1Id}
                    onChange={(e) => setV1Id(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  >
                    <option value="">선택</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id} disabled={v.id === v2Id}>
                        v{v.version}
                      </option>
                    ))}
                  </select>
                </div>

                <ArrowRight size={18} className="text-muted-foreground mt-4 shrink-0" />

                {/* v2 선택 */}
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">새 버전 (New)</p>
                  <select
                    value={v2Id}
                    onChange={(e) => setV2Id(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  >
                    <option value="">선택</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id} disabled={v.id === v1Id}>
                        v{v.version}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 실행 버튼 */}
                <button
                  onClick={runDiff}
                  disabled={!v1Id || !v2Id || loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity mt-4 shrink-0"
                >
                  {loading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <GitCompare size={14} />
                  )}
                  {loading ? "분석 중..." : "비교 실행"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 에러 */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Diff 결과 */}
      {diffResult && (
        <div className="space-y-4">
          {/* 요약 바 */}
          <DiffSummaryBar
            summary={diffResult.summary}
            v1Version={diffResult.v1.version}
            v2Version={diffResult.v2.version}
          />

          {/* 변경사항 없음 */}
          {diffResult.summary.added === 0 &&
            diffResult.summary.removed === 0 &&
            diffResult.summary.modified === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <GitCompare size={32} className="mx-auto mb-2 opacity-40" />
              <p className="font-medium">두 버전 간 API 변경사항이 없습니다</p>
            </div>
          ) : (
            /* Diff 테이블 — ErrorBoundary로 테이블 렌더링 에러 격리 */
            <ErrorBoundary fallback={<div className="p-4 rounded border border-red-200 bg-red-50 text-red-600 text-sm">Diff 목록을 표시하는 중 오류가 발생했습니다.</div>}>
              <DiffTable items={flatItems} />
            </ErrorBoundary>
          )}
        </div>
      )}
    </div>
  );
}
