// 프로젝트 CRUD API Route
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/projects
 * 전체 프로젝트 목록 + 모듈 수, API 수 집계 반환
 */
export async function GET() {
  console.log("[Projects API] 목록 조회");

  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { modules: true } },
        modules: {
          include: {
            _count: { select: { apis: true } },
          },
        },
      },
    });

    // 프로젝트별 전체 API 수 계산 후 추가 정보를 병렬로 조회
    // Promise.all: Java의 CompletableFuture.allOf와 유사 — 병렬 실행으로 응답 시간 단축
    const result = await Promise.all(
      projects.map(async (p) => {
        const totalApiCount = p.modules.reduce((sum, m) => sum + m._count.apis, 0);

        // 커버된 API 수와 최근 파싱 날짜를 병렬로 조회
        const [coveredApis, latestVersion] = await Promise.all([
          // coverages: { some: {} } — 커버리지가 1개 이상 연결된 ApiEntry 카운트
          // Java의 WHERE EXISTS (SELECT 1 FROM Coverage WHERE api_id = ...)와 유사
          prisma.apiEntry.count({
            where: {
              module: { projectId: p.id },
              coverages: { some: {} },
            },
          }),
          // 가장 최근에 파싱된 버전 1건만 조회 (parsedAt 기준 내림차순)
          prisma.moduleVersion.findFirst({
            where: { module: { projectId: p.id } },
            orderBy: { parsedAt: "desc" },
            select: { parsedAt: true },
          }),
        ]);

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          createdAt: p.createdAt,
          moduleCount: p._count.modules,
          totalApiCount,
          // 커버리지 퍼센트: 소수점 없이 반올림
          // TypeScript: 삼항 연산자로 0 나누기 방지 (Java와 동일한 패턴)
          coveragePercent: totalApiCount > 0
            ? Math.round((coveredApis / totalApiCount) * 100)
            : 0,
          // toISOString(): Java의 LocalDateTime.toString()과 유사한 ISO 8601 형식 반환
          lastParsedAt: latestVersion?.parsedAt?.toISOString() ?? null,
        };
      })
    );

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Projects API] 조회 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/projects
 * 새 프로젝트 생성
 * Body: { name: string, description?: string }
 */
export async function POST(req: NextRequest) {
  console.log("[Projects API] 프로젝트 생성");

  try {
    // TypeScript에서 req.json()은 unknown 타입 반환
    // 타입 단언(as) 대신 구조분해로 안전하게 처리
    const body = (await req.json()) as { name?: string; description?: string };

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "프로젝트 이름은 필수입니다" },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim(),
      },
    });

    console.log(`[Projects API] 생성 완료: ${project.id}`);
    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Projects API] 생성 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
