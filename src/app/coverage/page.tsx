// 커버리지 리포트 페이지
// 1단계: 프로젝트 요약 + 모듈 요약 카드 (빠른 로드)
// 2단계: 모듈 클릭 → API 상세 lazy 로드 (클래스 그룹핑 + 필터 + 페이지네이션)
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, CheckCircle2, XCircle, BarChart3,
  ChevronRight, ChevronDown, Package, Package2, Download,
} from "lucide-react";
import { getCoverageColor } from "@/lib/utils";
import type { CoverageSummary, ModuleCoverageSummary, ModuleApiCoverageResult, ApiCoverage } from "@/lib/services/coverageService";

// ─── 타입 ──────────────────────────────────────────────────────
interface Project { id: string; name: string; }
type CoverageFilter = "all" | "covered" | "uncovered";

// ─── 게이지 바 ─────────────────────────────────────────────────
function CoverageBar({ percent, height = "h-2" }: { percent: number; height?: string }) {
  const color =
    percent >= 80 ? "bg-green-500"
    : percent >= 50 ? "bg-yellow-500"
    : "bg-red-500";

  return (
    <div className={`w-full ${height} rounded-full bg-secondary overflow-hidden`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// ─── API 행 ────────────────────────────────────────────────────
function ApiRow({ api }: { api: ApiCoverage }) {
  const [open, setOpen] = useState(false);
  const simpleClass = api.className.split(".").pop() ?? api.className;

  return (
    <div className={`border-b last:border-b-0 ${api.isCovered ? "" : "bg-red-50/40 dark:bg-red-950/10"}`}>
      <div className="flex items-center justify-between px-4 py-2 text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          {api.isCovered
            ? <CheckCircle2 size={13} className="text-green-500 shrink-0" />
            : <XCircle size={13} className="text-red-400 shrink-0" />
          }
          <span className="font-mono text-xs truncate">
            {api.isStatic && <span className="text-blue-500 mr-1">static</span>}
            <span className="text-muted-foreground">{simpleClass}.</span>
            <span className="font-medium">{api.methodName}</span>
            <span className="text-muted-foreground">({api.params.join(", ")})</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {api.isCovered ? (
            // TC 목록 토글
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              TC {api.testCases.length}개
              {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          ) : (
            <span className="text-xs text-red-400 font-medium">미커버</span>
          )}
        </div>
      </div>
      {/* TC 목록 펼침 */}
      {open && api.testCases.length > 0 && (
        <div className="px-10 pb-2 flex flex-wrap gap-1">
          {api.testCases.map((tc) => (
            <span key={tc} className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-mono">
              {tc}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 클래스 그룹 ───────────────────────────────────────────────
function ClassGroup({ className, apis }: { className: string; apis: ApiCoverage[] }) {
  const [open, setOpen] = useState(true);
  const simpleClass = className.split(".").pop() ?? className;
  const pkg = className.includes(".") ? className.substring(0, className.lastIndexOf(".")) : "";
  const coveredCount = apis.filter((a) => a.isCovered).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-secondary/60 hover:bg-secondary transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown size={13} className="text-muted-foreground shrink-0" /> : <ChevronRight size={13} className="text-muted-foreground shrink-0" />}
          <span className="font-mono font-medium text-sm">{simpleClass}</span>
          {pkg && <span className="text-xs text-muted-foreground hidden sm:block truncate">{pkg}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <span className="text-xs text-muted-foreground">
            <span className="text-green-500 font-medium">{coveredCount}</span>/{apis.length}
          </span>
          <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full ${coveredCount === apis.length ? "bg-green-500" : coveredCount > 0 ? "bg-yellow-500" : "bg-red-400"}`}
              style={{ width: `${Math.round((coveredCount / apis.length) * 100)}%` }}
            />
          </div>
        </div>
      </button>
      {open && (
        <div>
          {/* 미커버 먼저 정렬 */}
          {[...apis.filter((a) => !a.isCovered), ...apis.filter((a) => a.isCovered)].map((api) => (
            <ApiRow key={api.apiId} api={api} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 모듈 상세 패널 ────────────────────────────────────────────
function ModuleDetailPanel({ moduleId }: { moduleId: string }) {
  const [filter, setFilter] = useState<CoverageFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ModuleApiCoverageResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (f: CoverageFilter, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coverage/${moduleId}?filter=${f}&page=${p}&perPage=20`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("[ModuleDetailPanel] 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => { load(filter, page); }, [load, filter, page]);

  const handleFilter = (f: CoverageFilter) => { setFilter(f); setPage(1); };

  return (
    <div className="border-t bg-muted/10 px-4 py-3 space-y-3">
      {/* 필터 탭 */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "uncovered", "covered"] as CoverageFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => handleFilter(f)}
            className={[
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              filter === f
                ? f === "uncovered" ? "bg-red-500 text-white border-red-500"
                  : f === "covered" ? "bg-green-500 text-white border-green-500"
                  : "bg-primary text-primary-foreground border-primary"
                : "hover:bg-accent",
            ].join(" ")}
          >
            {f === "all" ? "전체" : f === "covered" ? "커버됨" : "미커버"}
          </button>
        ))}
        {loading && <RefreshCw size={13} className="animate-spin text-muted-foreground ml-1" />}
        {data && (
          <span className="text-xs text-muted-foreground ml-auto">
            {data.totalClasses}개 클래스
            {data.totalPages > 1 && ` (페이지 ${data.currentPage}/${data.totalPages})`}
          </span>
        )}
      </div>

      {/* 클래스 그룹 목록 */}
      {data && (
        <>
          {Object.keys(data.grouped).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {filter === "uncovered" ? "미커버 API가 없습니다 🎉" : "API가 없습니다"}
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.grouped).map(([cls, apis]) => (
                <ClassGroup key={cls} className={cls} apis={apis} />
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.currentPage === 1}
                className="px-3 py-1 rounded border text-xs disabled:opacity-40 hover:bg-accent"
              >
                ‹
              </button>
              <span className="text-xs text-muted-foreground">
                {data.currentPage} / {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={data.currentPage === data.totalPages}
                className="px-3 py-1 rounded border text-xs disabled:opacity-40 hover:bg-accent"
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 모듈 카드 ─────────────────────────────────────────────────
function ModuleCard({ mod }: { mod: ModuleCoverageSummary }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        onClick={() => setExpanded((o) => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded bg-secondary shrink-0">
            {mod.moduleType === "AAR"
              ? <Package size={14} className="text-blue-500" />
              : <Package2 size={14} className="text-purple-500" />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{mod.moduleName}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{mod.moduleType}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              전체 {mod.totalApis}개 •
              <span className="text-green-600 mx-1">커버 {mod.coveredApis}개</span>•
              <span className="text-red-500 mx-1">미커버 {mod.uncoveredApis}개</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          <div className="flex flex-col items-end gap-1 w-28">
            <CoverageBar percent={mod.coveragePercent} />
            <span className={`text-xs font-bold ${getCoverageColor(mod.coveragePercent)}`}>
              {mod.coveragePercent}%
            </span>
          </div>
          {expanded
            ? <ChevronDown size={15} className="text-muted-foreground" />
            : <ChevronRight size={15} className="text-muted-foreground" />
          }
        </div>
      </button>

      {expanded && <ModuleDetailPanel moduleId={mod.moduleId} />}
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────
export default function CoveragePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [summary, setSummary] = useState<CoverageSummary | null>(null);
  const [modules, setModules] = useState<ModuleCoverageSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // 프로젝트 목록 로드
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data);
        if (data.length > 0) setSelectedProjectId(data[0].id);
      });
  }, []);

  // 선택 프로젝트 커버리지 요약 로드
  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    setSummary(null);
    setModules([]);
    console.log(`[CoveragePage] 커버리지 요약 조회: ${selectedProjectId}`);

    fetch(`/api/coverage?projectId=${selectedProjectId}`)
      .then((r) => r.json())
      .then(({ summary, modules }) => {
        setSummary(summary);
        setModules(modules);
      })
      .catch((e) => console.error("[CoveragePage] 조회 실패:", e))
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">커버리지 리포트</h2>
          <p className="text-muted-foreground mt-1">API별 TC 커버리지 현황을 확인합니다</p>
        </div>
        {/* 프로젝트 선택 + CSV 내보내기 */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">프로젝트</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {loading && <RefreshCw size={14} className="animate-spin text-muted-foreground" />}
          {/* CSV 내보내기: summary가 있고 projectId가 선택된 경우만 활성화 */}
          {/* window.location.href 사용 시 브라우저가 직접 파일 다운로드 처리 */}
          {/* Java의 response.sendRedirect()와 유사하나 파일 다운로드 목적으로 사용 */}
          <button
            onClick={() => {
              if (selectedProjectId) {
                window.location.href = `/api/coverage/export?projectId=${selectedProjectId}`;
              }
            }}
            disabled={!selectedProjectId || !summary}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="커버리지 데이터를 CSV 파일로 내보내기"
          >
            <Download size={13} />
            CSV 내보내기
          </button>
        </div>
      </div>

      {/* 전체 요약 */}
      {summary && (
        <>
          {/* 요약 카드 4개 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "전체 API", value: summary.totalApis, color: "text-foreground" },
              { label: "커버된 API", value: summary.coveredApis, color: "text-green-500" },
              { label: "미커버 API", value: summary.uncoveredApis, color: "text-red-500" },
              { label: "전체 커버리지", value: `${summary.coveragePercent}%`, color: getCoverageColor(summary.coveragePercent) },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* 전체 게이지 */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">전체 커버리지</span>
              <span className={`font-bold ${getCoverageColor(summary.coveragePercent)}`}>
                {summary.coveragePercent}%
              </span>
            </div>
            <CoverageBar percent={summary.coveragePercent} height="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>커버됨 {summary.coveredApis}개</span>
              <span>미커버 {summary.uncoveredApis}개</span>
            </div>
          </div>

          {/* 모듈별 커버리지 카드 */}
          {modules.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <BarChart3 size={32} className="mx-auto mb-2 opacity-40" />
              <p className="font-medium">TC를 먼저 등록하세요</p>
              <p className="text-sm mt-1">TC 관리 페이지에서 테스트 스위트를 등록하면 커버리지가 계산됩니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold">
                모듈별 현황
                <span className="ml-2 text-sm font-normal text-muted-foreground">{modules.length}개 모듈</span>
              </h3>
              {modules.map((mod) => (
                <ModuleCard key={mod.moduleId} mod={mod} />
              ))}
            </div>
          )}
        </>
      )}

      {!summary && !loading && (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">커버리지 데이터가 없습니다</p>
          <p className="text-sm mt-1">모듈 등록 후 TC를 분석하면 커버리지가 표시됩니다</p>
        </div>
      )}
    </div>
  );
}
