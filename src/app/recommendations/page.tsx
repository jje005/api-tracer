// TC 추천 페이지 — Claude AI가 미커버 API에 대한 테스트 케이스를 생성
// 서버 컴포넌트: 모듈 목록 + 저장된 추천 데이터 로드
// 클라이언트 인터랙션(생성 버튼, 코드 펼침)은 별도 컴포넌트로 분리
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, RefreshCw, Trash2, ChevronDown, ChevronUp,
  Code2, CheckCircle2, AlertCircle, Package, Package2,
  Brain, Lightbulb, Copy, Check,
} from "lucide-react";

// ─── 타입 ──────────────────────────────────────────────────────
interface ApiInfo {
  id: string;
  className: string;
  methodName: string;
  params: string[];
  returnType: string;
}

interface Recommendation {
  id: string;
  suggestedTestName: string;
  scenario: string;
  reasoning: string;
  sampleCode: string | null;
  generatedAt: string;
  api: ApiInfo;
}

interface ModuleSummary {
  id: string;
  name: string;
  type: string;
  _count: { apis: number };
  uncoveredCount: number;
  recommendationCount: number;
}

// ─── 코드 블록 컴포넌트 ───────────────────────────────────────
// 복사 버튼이 있는 코드 미리보기
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 첫 5줄만 미리보기, 나머지는 접기
  const lines = code.split("\n");
  const preview = lines.slice(0, 5).join("\n");
  const hasMore = lines.length > 5;

  return (
    <div className="rounded-md border border-border overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/70 border-b">
        <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
          <Code2 size={11} /> Kotlin 샘플
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto bg-background font-mono text-[11px] leading-relaxed">
        {expanded ? code : preview}
        {hasMore && !expanded && "\n..."}
      </pre>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors border-t"
        >
          {expanded ? "접기" : `+${lines.length - 5}줄 더 보기`}
        </button>
      )}
    </div>
  );
}

// ─── 추천 카드 컴포넌트 ──────────────────────────────────────
function RecommendationCard({
  rec,
  onDelete,
}: {
  rec: Recommendation;
  onDelete: (id: string) => void;
}) {
  const [showCode, setShowCode] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("이 추천을 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/recommendations/${rec.id}`, { method: "DELETE" });
      onDelete(rec.id);
    } catch (e) {
      console.error("[RecommendationCard] 삭제 오류:", e);
    } finally {
      setDeleting(false);
    }
  };

  const paramStr = rec.api.params.join(", ");

  return (
    <div className="rounded-md border p-3 space-y-2.5 hover:shadow-sm transition-shadow">
      {/* API 시그니처 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono text-muted-foreground truncate">
            {rec.api.className}
          </p>
          <p className="text-sm font-semibold">
            {rec.api.methodName}({paramStr})
            <span className="text-muted-foreground font-normal ml-1">
              → {rec.api.returnType}
            </span>
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          title="추천 삭제"
        >
          {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>

      {/* 추천 TC명 */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/5 border border-primary/20">
        <CheckCircle2 size={12} className="text-primary shrink-0" />
        <code className="text-xs font-mono text-primary">{rec.suggestedTestName}</code>
      </div>

      {/* 시나리오 */}
      <div className="flex items-start gap-1.5">
        <Lightbulb size={12} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">{rec.scenario}</p>
      </div>

      {/* 추천 이유 */}
      <div className="flex items-start gap-1.5">
        <Brain size={12} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">{rec.reasoning}</p>
      </div>

      {/* 샘플 코드 토글 */}
      {rec.sampleCode && (
        <div>
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Code2 size={11} />
            {showCode ? "코드 숨기기" : "샘플 코드 보기"}
            {showCode ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {showCode && <div className="mt-2"><CodeBlock code={rec.sampleCode} /></div>}
        </div>
      )}
    </div>
  );
}

// ─── 모듈 카드 컴포넌트 ──────────────────────────────────────
function ModuleCard({
  module,
  onGenerated,
}: {
  module: ModuleSummary;
  onGenerated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);
  const [recs, setRecs] = useState<Record<string, Recommendation[]>>({});
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [replace, setReplace] = useState(false);

  // 추천 목록 로드 (패널 열릴 때 한 번)
  const loadRecs = useCallback(async () => {
    setLoadingRecs(true);
    try {
      const res = await fetch(`/api/recommendations?moduleId=${module.id}`);
      const data = await res.json();
      setRecs(data.grouped ?? {});
    } catch (e) {
      console.error("[ModuleCard] 추천 로드 오류:", e);
    } finally {
      setLoadingRecs(false);
    }
  }, [module.id]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && Object.keys(recs).length === 0) loadRecs();
  };

  // TC 추천 생성 요청
  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult(null);
    console.log(`[RecommendationsPage] TC 추천 생성: ${module.id}, replace=${replace}`);

    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: module.id, limit: 10, replace }),
      });
      const data = await res.json();

      if (!res.ok) {
        setGenResult(`오류: ${data.error}`);
        return;
      }

      setGenResult(data.message);
      // 생성 후 추천 목록 갱신
      await loadRecs();
      onGenerated();
    } catch (e) {
      setGenResult("생성 중 오류가 발생했습니다");
      console.error("[ModuleCard] 생성 오류:", e);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteRec = (recId: string) => {
    // 로컬 상태에서 삭제 — 서버는 이미 삭제됨
    setRecs((prev) => {
      const next: Record<string, Recommendation[]> = {};
      for (const [cls, list] of Object.entries(prev)) {
        const filtered = list.filter((r) => r.id !== recId);
        if (filtered.length > 0) next[cls] = filtered;
      }
      return next;
    });
  };

  const totalRecs = Object.values(recs).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* 모듈 헤더 */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/40 hover:bg-secondary/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {module.type === "AAR"
            ? <Package size={15} className="text-blue-500 shrink-0" />
            : <Package2 size={15} className="text-purple-500 shrink-0" />
          }
          <span className="font-semibold truncate">{module.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
            {module.type}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          {/* 미커버 / 추천 수 */}
          <div className="text-xs text-muted-foreground flex gap-2">
            <span className="text-red-500 font-medium">미커버 {module.uncoveredCount}개</span>
            {module.recommendationCount > 0 && (
              <span className="text-primary font-medium">추천 {module.recommendationCount}개</span>
            )}
          </div>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* 펼쳐진 패널 */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* 생성 컨트롤 */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleGenerate}
              disabled={generating || module.uncoveredCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {generating
                ? <><RefreshCw size={13} className="animate-spin" /> 생성 중...</>
                : <><Sparkles size={13} /> TC 추천 생성</>
              }
            </button>
            {/* 재생성 옵션 */}
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
                className="accent-primary h-3.5 w-3.5"
              />
              <span className="text-muted-foreground">기존 추천 재생성</span>
            </label>
            {genResult && (
              <p className={`text-xs ${genResult.startsWith("오류") ? "text-destructive" : "text-green-600"}`}>
                {genResult.startsWith("오류")
                  ? <span className="flex items-center gap-1"><AlertCircle size={11} />{genResult}</span>
                  : <span className="flex items-center gap-1"><CheckCircle2 size={11} />{genResult}</span>
                }
              </p>
            )}
          </div>

          {/* 추천 목록 */}
          {loadingRecs ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <RefreshCw size={13} className="animate-spin" /> 추천 목록 로딩 중...
            </div>
          ) : totalRecs === 0 ? (
            <div className="text-sm text-muted-foreground py-2 text-center">
              {module.uncoveredCount > 0
                ? "아직 생성된 추천이 없습니다. 위 버튼을 눌러 생성하세요."
                : "모든 API가 TC로 커버되었습니다 🎉"
              }
            </div>
          ) : (
            // 클래스별 그룹 표시
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {Object.keys(recs).length}개 클래스, 총 {totalRecs}개 추천
              </p>
              {Object.entries(recs).map(([className, recList]) => (
                <div key={className} className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground font-mono border-b pb-1">
                    {className}
                  </h4>
                  <div className="space-y-2 pl-2">
                    {recList.map((rec) => (
                      <RecommendationCard
                        key={rec.id}
                        rec={rec}
                        onDelete={handleDeleteRec}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function RecommendationsPage() {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRecs, setTotalRecs] = useState(0);
  const [hasApiKey, setHasApiKey] = useState(true); // API 키 설정 여부 (서버에서 확인)

  const loadModules = useCallback(async () => {
    setLoading(true);
    try {
      // 모듈 목록 조회 + 미커버 API 수 계산
      // API 키 설정 여부 확인 (POST 없이 서버 상태 조회)
      const checkRes = await fetch("/api/recommendations/check");
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        setHasApiKey(checkData.hasApiKey ?? true);
      }

      const res = await fetch("/api/modules");
      const data: ModuleSummary[] = await res.json();

      // 각 모듈의 미커버 API 수를 병렬로 조회
      // Promise.all: Java의 CompletableFuture.allOf와 동일한 병렬 실행
      const enriched = await Promise.all(
        data.map(async (m) => {
          try {
            const r = await fetch(`/api/recommendations?moduleId=${m.id}`);
            const d = await r.json();
            return {
              ...m,
              uncoveredCount: 0,   // 별도 API 없이 임시 0 (모듈별 미커버 집계는 커버리지 API 참조)
              recommendationCount: d.total ?? 0,
            };
          } catch {
            return { ...m, uncoveredCount: 0, recommendationCount: 0 };
          }
        })
      );

      // 미커버 API 수는 coverage summary API에서 조회
      const covRes = await fetch("/api/coverage");
      const covData = await covRes.json();

      // 커버리지 데이터로 미커버 수 채우기
      // Java의 Map.getOrDefault와 유사: covData의 모듈 정보가 없으면 0
      const covByModule: Record<string, number> = {};
      if (covData.modules) {
        for (const mod of covData.modules) {
          covByModule[mod.moduleId] = mod.total - mod.covered;
        }
      }

      const final = enriched.map((m) => ({
        ...m,
        uncoveredCount: covByModule[m.id] ?? 0,
      }));

      setModules(final);
      setTotalRecs(final.reduce((s, m) => s + m.recommendationCount, 0));
    } catch (e) {
      console.error("[RecommendationsPage] 모듈 로드 오류:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadModules(); }, [loadModules]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-10">
        <RefreshCw size={16} className="animate-spin" /> 데이터 로딩 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles size={22} className="text-primary" />
            TC 추천
          </h2>
          <p className="text-muted-foreground mt-1">
            미커버 API에 대해 Claude AI가 테스트 케이스 시나리오를 생성합니다
          </p>
        </div>
        {/* 요약 배지 */}
        {totalRecs > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm">
            <Brain size={14} className="text-primary" />
            <span className="font-medium text-primary">저장된 추천 {totalRecs}개</span>
          </div>
        )}
      </div>

      {/* 사용 안내 */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm space-y-1">
        <p className="font-semibold text-amber-800 flex items-center gap-1.5">
          <Lightbulb size={14} /> 사용 방법
        </p>
        <ul className="text-amber-700 space-y-0.5 list-disc list-inside text-xs">
          <li>모듈을 클릭하여 펼친 후 <strong>TC 추천 생성</strong> 버튼을 누르세요</li>
          <li>Claude AI가 미커버 API를 분석하여 테스트 시나리오를 생성합니다</li>
          <li>생성에는 10~30초가 소요될 수 있습니다</li>
          <li><strong>기존 추천 재생성</strong> 체크 시 이전 추천을 삭제하고 새로 생성합니다</li>
          <li>먼저 TC를 파싱하여 커버리지를 분석한 후 사용하면 더욱 정확합니다</li>
        </ul>
      </div>

      {/* API 키 미설정 경고 */}
      {!hasApiKey && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive flex items-center gap-1.5">
            <AlertCircle size={14} /> ANTHROPIC_API_KEY 미설정
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            .env 파일에 ANTHROPIC_API_KEY를 설정해야 TC 추천 생성이 가능합니다
          </p>
        </div>
      )}

      {/* 모듈 목록 */}
      {modules.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>등록된 모듈이 없습니다.</p>
          <p className="text-sm mt-1">먼저 AAR/JAR 파일을 업로드하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((m) => (
            <ModuleCard
              key={m.id}
              module={m}
              onGenerated={loadModules}
            />
          ))}
        </div>
      )}
    </div>
  );
}
