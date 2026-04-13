// 모듈별 API 커버리지 상세 API — 클래스 그룹핑 + 필터 + 페이지네이션
import { NextRequest, NextResponse } from "next/server";
import { getModuleApiCoverage } from "@/lib/services/coverageService";

interface RouteParams {
  params: Promise<{ moduleId: string }>;
}

/**
 * GET /api/coverage/[moduleId]?filter=all&page=1&perPage=20
 *
 * 모듈 API 커버리지 상세 (클래스 단위 그룹핑 + 페이지네이션)
 *
 * Query params:
 *   filter  - "all" | "covered" | "uncovered" (기본 "all")
 *   page    - 페이지 번호 (기본 1)
 *   perPage - 페이지당 클래스 수 (기본 20)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { moduleId } = await params;
  const { searchParams } = req.nextUrl;

  const filter = (searchParams.get("filter") ?? "all") as "all" | "covered" | "uncovered";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const perPage = Math.max(1, Number(searchParams.get("perPage") ?? "20"));

  console.log(`[Coverage Module API] moduleId=${moduleId}, filter=${filter}, page=${page}`);

  try {
    const result = await getModuleApiCoverage(moduleId, filter, page, perPage);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Coverage Module API] 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
