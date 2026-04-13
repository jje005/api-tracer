// 대시보드 페이지 (서버 컴포넌트)
// Next.js App Router: 기본적으로 서버 컴포넌트 → 'use client' 없으면 서버에서 렌더링
// Java의 @Controller + @GetMapping("/") + Thymeleaf 렌더링과 유사한 역할
import { prisma } from "@/lib/prisma";
import { Boxes, FlaskConical, BarChart3, GitCompare, Clock, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";

// 빌드 시 정적 생성 방지: DB 연결이 런타임에만 가능하므로 항상 동적 렌더링
// Java Spring의 @Scope("request")와 유사하게 요청마다 새로 렌더링
export const dynamic = "force-dynamic";

// 서버 컴포넌트에서 직접 DB 조회 가능 (API Route 불필요)
async function getDashboardStats() {
  console.log("[Dashboard] 통계 조회");

  // Promise.all: Java의 CompletableFuture.allOf와 유사 - 병렬 실행
  const [moduleCount, apiCount, tcCount, coverageCount] = await Promise.all([
    prisma.module.count(),
    prisma.apiEntry.count(),
    prisma.testCase.count(),
    prisma.coverage.count(),
  ]);

  // 커버된 API 수 계산
  const coveredCount = await prisma.coverage.count({
    where: { status: "COVERED" },
  });

  const coveragePercent =
    apiCount > 0 ? Math.round((coveredCount / apiCount) * 100) : 0;

  // 추가 통계 쿼리: 최근 파싱 이력, 미커버 API 수, 프로젝트별 현황
  // 세 쿼리를 병렬로 실행하여 응답 시간 최소화
  const [recentVersions, uncoveredCount, projectStats] = await Promise.all([
    // 최근 파싱된 버전 5건 (모듈명 + 프로젝트명 포함)
    prisma.moduleVersion.findMany({
      take: 5,
      orderBy: { parsedAt: "desc" },
      include: {
        module: {
          select: {
            name: true,
            project: { select: { name: true } },
          },
        },
      },
    }),
    // 커버리지가 전혀 없는 API 수 (none: 하나도 없을 것)
    // Java의 WHERE NOT EXISTS (SELECT 1 FROM Coverage WHERE api_id = ...)와 유사
    prisma.apiEntry.count({
      where: { coverages: { none: {} } },
    }),
    // 프로젝트별 현황: 모듈 수 + API 수 + 커버리지 계산용 데이터
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        _count: { select: { modules: true } },
        modules: {
          select: {
            _count: { select: { apis: true } },
            // 커버리지 여부 확인: take: 1로 필요한 데이터만 최소 조회
            apis: {
              select: {
                id: true,
                coverages: { select: { id: true }, take: 1 },
              },
            },
          },
        },
      },
    }),
  ]);

  // 프로젝트별 커버리지 퍼센트 계산
  // TypeScript의 reduce: Java Stream의 reduce()와 동일한 개념
  const projectSummaries = projectStats.map((p) => {
    const totalApis = p.modules.reduce((s, m) => s + m._count.apis, 0);
    // coverages.length > 0인 api만 커버됨으로 카운트
    const coveredApis = p.modules.reduce(
      (s, m) => s + m.apis.filter((a) => a.coverages.length > 0).length,
      0
    );
    return {
      id: p.id,
      name: p.name,
      moduleCount: p._count.modules,
      totalApis,
      coveragePercent: totalApis > 0 ? Math.round((coveredApis / totalApis) * 100) : 0,
    };
  });

  return {
    moduleCount,
    apiCount,
    tcCount,
    coveragePercent,
    uncoveredCount,
    recentVersions,
    projectSummaries,
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const statCards = [
    {
      label: "등록 모듈",
      value: stats.moduleCount,
      icon: Boxes,
      href: "/modules",
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "전체 API",
      value: stats.apiCount,
      icon: Boxes,
      href: "/modules",
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
    {
      label: "테스트 케이스",
      value: stats.tcCount,
      icon: FlaskConical,
      href: "/tc",
      color: "text-green-500",
      bg: "bg-green-50",
    },
    {
      label: "TC 커버리지",
      value: `${stats.coveragePercent}%`,
      icon: BarChart3,
      href: "/coverage",
      color:
        stats.coveragePercent >= 80
          ? "text-green-500"
          : stats.coveragePercent >= 50
          ? "text-yellow-500"
          : "text-red-500",
      bg: "bg-gray-50",
    },
    // 미커버 API 카드: 0이면 초록색, 있으면 빨간색으로 강조
    {
      label: "미커버 API",
      value: stats.uncoveredCount,
      icon: AlertCircle,
      href: "/coverage",
      color: stats.uncoveredCount === 0 ? "text-green-500" : "text-red-500",
      bg: stats.uncoveredCount === 0 ? "bg-green-50" : "bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">대시보드</h2>
        <p className="text-muted-foreground mt-1">
          AAR/JAR API 커버리지 현황을 한눈에 확인하세요
        </p>
      </div>

      {/* 통계 카드: 5개이므로 lg에서 5열 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="block p-5 rounded-lg border bg-card hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <div className={`p-2 rounded-md ${card.bg}`}>
                <card.icon size={16} className={card.color} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </Link>
        ))}
      </div>

      {/* 빠른 시작 안내 */}
      {stats.moduleCount === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Boxes size={40} className="mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">아직 모듈이 없습니다</h3>
          <p className="text-muted-foreground text-sm mb-4">
            AAR 또는 JAR 파일을 업로드하여 API 분석을 시작하세요
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            파일 업로드 시작
          </Link>
        </div>
      )}

      {/* 바로가기 */}
      {stats.moduleCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/diff"
            className="flex items-center gap-4 p-4 rounded-lg border hover:shadow-sm transition-shadow"
          >
            <div className="p-3 rounded-md bg-orange-50">
              <GitCompare size={20} className="text-orange-500" />
            </div>
            <div>
              <p className="font-medium">버전 비교</p>
              <p className="text-sm text-muted-foreground">
                이전 버전과 현재 버전의 API 변경사항을 확인
              </p>
            </div>
          </Link>
          <Link
            href="/recommendations"
            className="flex items-center gap-4 p-4 rounded-lg border hover:shadow-sm transition-shadow"
          >
            <div className="p-3 rounded-md bg-yellow-50">
              <BarChart3 size={20} className="text-yellow-500" />
            </div>
            <div>
              <p className="font-medium">TC 추천 받기</p>
              <p className="text-sm text-muted-foreground">
                커버되지 않은 API에 대한 TC를 AI가 추천
              </p>
            </div>
          </Link>
        </div>
      )}

      {/* ── 최근 파싱 이력 ─────────────────────────────────────── */}
      {/* moduleCount > 0일 때만 표시 — 빈 상태에서 불필요한 테이블 렌더링 방지 */}
      {stats.moduleCount > 0 && stats.recentVersions.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-secondary/40 border-b">
            <Clock size={14} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">최근 파싱 이력</h3>
          </div>
          <div className="divide-y">
            {stats.recentVersions.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  {/* 모듈명 */}
                  <span className="font-medium text-sm truncate">{v.module.name}</span>
                  {/* 버전 배지 */}
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-mono">
                    v{v.version}
                  </span>
                  {/* 프로젝트명: 회색 텍스트로 구분 */}
                  <span className="text-xs text-muted-foreground truncate hidden sm:block">
                    {v.module.project.name}
                  </span>
                </div>
                {/* 파싱 날짜 */}
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {new Date(v.parsedAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 프로젝트별 현황 ──────────────────────────────────────── */}
      {/* TrendingUp 아이콘으로 진행 상황 강조 */}
      {stats.projectSummaries.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-secondary/40 border-b">
            <TrendingUp size={14} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">프로젝트별 현황</h3>
          </div>
          <div className="divide-y">
            {stats.projectSummaries.map((p) => (
              <div key={p.id} className="px-4 py-3 space-y-2 hover:bg-accent/20 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-medium text-sm">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      모듈 {p.moduleCount}개 · API {p.totalApis}개
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* 커버리지 숫자 */}
                    <span className={`text-sm font-bold ${
                      p.coveragePercent >= 80 ? "text-green-600"
                      : p.coveragePercent >= 50 ? "text-yellow-600"
                      : "text-red-500"
                    }`}>
                      {p.coveragePercent}%
                    </span>
                    {/* 상세보기 링크 */}
                    <Link
                      href="/modules"
                      className="text-xs px-2.5 py-1 rounded-md border hover:bg-accent transition-colors"
                    >
                      상세보기
                    </Link>
                  </div>
                </div>
                {/* 커버리지 게이지 바 */}
                {p.totalApis > 0 && (
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        p.coveragePercent >= 80 ? "bg-green-500"
                        : p.coveragePercent >= 50 ? "bg-yellow-500"
                        : "bg-red-400"
                      }`}
                      style={{ width: `${p.coveragePercent}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
