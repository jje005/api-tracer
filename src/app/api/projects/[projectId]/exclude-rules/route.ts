// 프로젝트 제외 규칙 목록 조회 + 생성 API
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * GET /api/projects/[projectId]/exclude-rules
 * 프로젝트의 전체 제외 규칙 목록 반환
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  console.log(`[ExcludeRules API] 목록 조회: ${projectId}`);

  try {
    const rules = await prisma.excludeRule.findMany({
      where: { projectId },
      orderBy: [{ type: "asc" }, { className: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(rules);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[ExcludeRules API] 조회 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/projects/[projectId]/exclude-rules
 * 제외 규칙 추가
 *
 * Body:
 *   type        - "CLASS" | "METHOD"
 *   className   - 제외 대상 클래스명 (와일드카드 가능: "hmg.car.internal.*")
 *   methodName  - 메서드명 (type=METHOD일 때, 없으면 클래스 전체)
 *   matchParams - true이면 params도 비교 (기본 false)
 *   params      - 비교할 파라미터 목록 (matchParams=true일 때)
 *   note        - 제외 이유 메모 (선택)
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

  try {
    const body = await req.json() as {
      type: "CLASS" | "METHOD";
      className: string;
      methodName?: string;
      matchParams?: boolean;
      params?: string[];
      note?: string;
    };

    const { type, className, methodName, matchParams = false, params: ruleParams = [], note } = body;

    if (!className?.trim()) {
      return NextResponse.json({ error: "className은 필수입니다" }, { status: 400 });
    }
    if (type === "METHOD" && !methodName?.trim()) {
      return NextResponse.json({ error: "METHOD 타입은 methodName이 필요합니다" }, { status: 400 });
    }

    const rule = await prisma.excludeRule.create({
      data: {
        projectId,
        type,
        className: className.trim(),
        methodName: methodName?.trim() ?? null,
        matchParams,
        params: ruleParams,
        note: note?.trim() ?? null,
      },
    });

    console.log(`[ExcludeRules API] 규칙 추가: ${type} ${className}${methodName ? `.${methodName}` : ""}`);
    return NextResponse.json(rule, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[ExcludeRules API] 생성 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
