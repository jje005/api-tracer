// 모듈 상세 페이지 (서버 컴포넌트)
// 데이터 조회 + 페이지네이션은 서버에서, UI 인터랙션은 ApiExplorer 클라이언트 컴포넌트에서
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, GitCompare } from "lucide-react";
import { ModuleActions } from "@/components/modules/ModuleActions";
import { ApiExplorer, type ApiEntryData } from "@/components/modules/ApiExplorer";
import { type ParseOptions } from "@/lib/parseOptions";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ─── 상수 ────────────────────────────────────────────────────
// 클래스 단위 페이지네이션: 페이지당 25개 클래스
// API가 1만 개여도 25개 클래스씩 나눠 렌더링하므로 성능 문제 없음
const CLASSES_PER_PAGE = 25;

// Next.js 15: params, searchParams 모두 Promise로 변경
interface PageProps {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<{ search?: string; className?: string; page?: string }>;
}

export const dynamic = "force-dynamic";

// 제외 규칙 적용 헬퍼 — 클래스명 패턴 매칭 (와일드카드 지원)
// "com.example.*" → com.example 패키지 하위 모든 클래스 제외
// Java의 Pattern.matches()와 유사하지만 단순 prefix 방식 사용
function matchesExcludeClass(apiClassName: string, ruleClassName: string): boolean {
  if (ruleClassName.endsWith(".*")) {
    const prefix = ruleClassName.slice(0, -2); // ".*" 제거
    return apiClassName === prefix || apiClassName.startsWith(prefix + ".");
  }
  return apiClassName === ruleClassName;
}

async function getModuleDetail(
  moduleId: string,
  search: string,
  classNameFilter: string
) {
  console.log(`[Module Detail Page] moduleId: ${moduleId}`);

  const module = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      versions: { orderBy: { parsedAt: "desc" } },
      project: { select: { id: true, name: true } },
      _count: { select: { apis: true } },
    },
  });

  if (!module) return null;

  // 제외 규칙 조회 — 프로젝트 단위로 관리되므로 projectId 기준 조회
  const excludeRules = await prisma.excludeRule.findMany({
    where: { projectId: module.projectId },
  });

  // 필터 조건 적용하여 API 목록 조회
  const apis = await prisma.apiEntry.findMany({
    where: {
      moduleId,
      ...(search && {
        OR: [
          { className: { contains: search, mode: "insensitive" } },
          { methodName: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(classNameFilter && {
        className: { contains: classNameFilter, mode: "insensitive" },
      }),
    },
    orderBy: [{ className: "asc" }, { methodName: "asc" }],
    select: {
      id: true,
      className: true,
      methodName: true,
      params: true,
      returnType: true,
      isStatic: true,
      isDeprecated: true,
    },
  });

  // 제외 규칙 적용 — DB에 저장된 규칙을 서버사이드에서 필터링
  // 재파싱 없이도 UI에서 즉시 반영됨
  const filteredApis = apis.filter((api) => {
    for (const rule of excludeRules) {
      if (rule.type === "CLASS") {
        if (matchesExcludeClass(api.className, rule.className)) return false;
      } else if (rule.type === "METHOD" && api.methodName === rule.methodName) {
        if (!matchesExcludeClass(api.className, rule.className)) continue;
        // matchParams가 false면 메서드명만 일치해도 제외
        if (!rule.matchParams) return false;
        // matchParams가 true면 파라미터 목록까지 비교
        const ruleParams = rule.params as string[];
        const apiParams = api.params as string[];
        if (JSON.stringify(apiParams) === JSON.stringify(ruleParams)) return false;
      }
    }
    return true;
  });

  console.log(`[Module Detail Page] 전체 API: ${apis.length}, 제외 후: ${filteredApis.length} (규칙 ${excludeRules.length}개 적용)`);

  // 클래스별 그룹핑
  // TypeScript Record<string, T[]>: Java의 Map<String, List<T>>와 동일
  const grouped = filteredApis.reduce(
    (acc, api) => {
      if (!acc[api.className]) acc[api.className] = [];
      acc[api.className].push({
        id: api.id,
        methodName: api.methodName,
        params: api.params as string[],
        returnType: api.returnType,
        isStatic: api.isStatic,
        isDeprecated: api.isDeprecated,
      } satisfies ApiEntryData);
      return acc;
    },
    {} as Record<string, ApiEntryData[]>
  );

  return {
    module,
    grouped,
    totalFilteredApis: filteredApis.length,
    excludeRuleCount: excludeRules.length,
    parseOptions: (module.parseOptions ?? {}) as Partial<ParseOptions>,
  };
}

export default async function ModuleDetailPage({ params, searchParams }: PageProps) {
  const { moduleId } = await params;
  const { search: rawSearch, className: rawClass, page: rawPage } = await searchParams;

  const search = rawSearch ?? "";
  const classNameFilter = rawClass ?? "";

  const data = await getModuleDetail(moduleId, search, classNameFilter);
  if (!data) notFound();

  const { module, grouped, totalFilteredApis, excludeRuleCount, parseOptions } = data;

  // 클래스 단위 페이지네이션
  const allClassEntries = Object.entries(grouped);
  const totalClasses = allClassEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalClasses / CLASSES_PER_PAGE));
  const currentPage = Math.max(1, Math.min(Number(rawPage ?? "1"), totalPages));
  const offset = (currentPage - 1) * CLASSES_PER_PAGE;

  // 현재 페이지 클래스만 슬라이싱 — 클라이언트에 전달하는 데이터 최소화
  const pageGrouped = Object.fromEntries(
    allClassEntries.slice(offset, offset + CLASSES_PER_PAGE)
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/modules" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold">{module.name}</h2>
              <span className="text-sm px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                {module.type}
              </span>
              {module.versions[0] && (
                <span className="text-sm px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  v{module.versions[0].version}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {module.project.name} • 전체 API {module._count.apis}개
              {excludeRuleCount > 0 && (
                <span className="ml-1 text-orange-500">(제외 규칙 {excludeRuleCount}개 적용 중)</span>
              )}
            </p>
          </div>
        </div>

        {/* 우측: 버전 비교 + 편집/삭제 */}
        <div className="flex items-center gap-2 flex-wrap">
          {module.versions.length >= 2 && (
            <Link
              href={`/diff?moduleId=${module.id}`}
              className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              <GitCompare size={14} />
              버전 비교
            </Link>
          )}
          <ModuleActions
            moduleId={module.id}
            moduleName={module.name}
            projectId={module.project.id}
            versions={module.versions.map((v: {
              id: string;
              version: string;
              dirPath: string | null;
              filePath: string;
            }) => ({
              id: v.id,
              version: v.version,
              dirPath: v.dirPath,
              filePath: v.filePath,
            }))}
            parseOptions={parseOptions}
          />
        </div>
      </div>

      {/* 검색 바 */}
      <form className="flex gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="클래스명 또는 메서드명 검색..."
          className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
        >
          검색
        </button>
        {search && (
          <Link
            href={`/modules/${moduleId}`}
            className="px-4 py-2 rounded-md border text-sm hover:bg-accent"
          >
            초기화
          </Link>
        )}
      </form>

      {/* API 탐색기 — 전체 열기/닫기 + 페이지네이션 */}
      {/* Suspense: useSearchParams()를 쓰는 ApiExplorer 내부 Pagination을 위해 필요 */}
      {/* ErrorBoundary: ApiExplorer 렌더링 에러를 페이지 전체 크래시 없이 처리 */}
      <ErrorBoundary fallback={<div className="p-4 rounded border border-red-200 bg-red-50 text-red-600 text-sm">API 목록을 불러오는 중 오류가 발생했습니다.</div>}>
        <Suspense fallback={<div className="text-sm text-muted-foreground">로딩 중...</div>}>
          <ApiExplorer
            moduleId={moduleId}
            projectId={module.project.id}
            grouped={pageGrouped}
            currentPage={currentPage}
            totalPages={totalPages}
            totalClasses={module._count.apis > 0 ? Object.keys(grouped).length : 0}
            totalApis={module._count.apis}
            filteredClasses={totalClasses}
            filteredApis={totalFilteredApis}
            search={search}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
