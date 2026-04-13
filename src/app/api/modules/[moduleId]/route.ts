// 모듈 상세 + API 목록 + 수정 + 삭제 API Route
// Next.js의 동적 라우트: [moduleId]는 Java의 @PathVariable과 동일
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ParseOptions } from "@/lib/parseOptions";

// Next.js 15부터 동적 라우트의 params가 Promise로 변경됨
// Java의 @PathVariable과 달리 await로 비동기 추출 필요
interface RouteParams {
  params: Promise<{ moduleId: string }>;
}

/**
 * GET /api/modules/[moduleId]
 * 모듈 상세 정보 + API 목록 반환
 * Query: ?search=xxx (API 검색), ?className=xxx (클래스 필터)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { moduleId } = await params;
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const className = req.nextUrl.searchParams.get("className") ?? "";

  console.log(`[Module Detail API] moduleId: ${moduleId}, search: ${search}`);

  try {
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        versions: { orderBy: { parsedAt: "desc" } },
        _count: { select: { apis: true } },
      },
    });

    if (!module) {
      return NextResponse.json(
        { error: "모듈을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // API 목록 조회 (검색 필터 적용)
    // Prisma의 where 조건: Java의 JPA Specification과 유사
    const apis = await prisma.apiEntry.findMany({
      where: {
        moduleId,
        ...(search && {
          OR: [
            { className: { contains: search, mode: "insensitive" } },
            { methodName: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(className && {
          className: { contains: className, mode: "insensitive" },
        }),
      },
      orderBy: [{ className: "asc" }, { methodName: "asc" }],
    });

    // 클래스별 그룹핑
    // TypeScript의 reduce: Java의 Collectors.groupingBy와 유사
    const groupedByClass = apis.reduce(
      (acc, api) => {
        if (!acc[api.className]) acc[api.className] = [];
        acc[api.className].push(api);
        return acc;
      },
      {} as Record<string, typeof apis>
    );

    return NextResponse.json({
      id: module.id,
      name: module.name,
      type: module.type,
      versions: module.versions,
      parseOptions: module.parseOptions ?? {},  // 파싱 옵션 포함
      totalApiCount: module._count.apis,
      filteredApiCount: apis.length,
      apisByClass: groupedByClass,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Module Detail API] 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/modules/[moduleId]
 * 모듈 이름 또는 파싱 옵션 수정
 * Body: { name?: string, parseOptions?: Partial<ParseOptions> }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { moduleId } = await params;
  console.log(`[Module API] 모듈 수정: ${moduleId}`);

  try {
    const body = await req.json() as { name?: string; parseOptions?: Partial<ParseOptions> };
    const { name, parseOptions } = body;

    // 변경할 내용이 없으면 오류
    if (!name?.trim() && !parseOptions) {
      return NextResponse.json({ error: "name 또는 parseOptions 중 하나가 필요합니다" }, { status: 400 });
    }

    // 업데이트할 필드만 동적으로 구성
    // TypeScript의 조건부 객체 스프레드: Java의 if/else 체인보다 간결
    const updateData: Record<string, unknown> = {};
    if (name?.trim()) updateData.name = name.trim();
    if (parseOptions) updateData.parseOptions = parseOptions;

    const updated = await prisma.module.update({
      where: { id: moduleId },
      data: updateData,
    });

    console.log(`[Module API] 모듈 수정 완료: ${updated.name}`, parseOptions ? "옵션 포함" : "");
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      parseOptions: updated.parseOptions,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Module API] 수정 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/modules/[moduleId]
 * 모듈 전체 삭제 (버전, API, 스냅샷, 커버리지 포함)
 * Prisma schema의 onDelete: Cascade 설정에 따라 연관 데이터 자동 삭제
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { moduleId } = await params;
  console.log(`[Module API] 모듈 삭제: ${moduleId}`);

  try {
    // Cascade 삭제: Module → ModuleVersion → ApiSnapshot
    //               Module → ApiEntry → Coverage
    await prisma.module.delete({ where: { id: moduleId } });

    console.log(`[Module API] 모듈 삭제 완료: ${moduleId}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Module API] 삭제 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
