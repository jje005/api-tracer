// 제외 규칙 단건 수정 / 삭제 API
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ projectId: string; ruleId: string }>;
}

/**
 * PATCH /api/projects/[projectId]/exclude-rules/[ruleId]
 * 제외 규칙 수정 (note, matchParams, params 변경 가능)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { projectId, ruleId } = await params;

  try {
    const body = await req.json() as {
      matchParams?: boolean;
      params?: string[];
      note?: string;
    };

    const rule = await prisma.excludeRule.update({
      where: { id: ruleId, projectId },
      data: {
        ...(body.matchParams !== undefined && { matchParams: body.matchParams }),
        ...(body.params !== undefined && { params: body.params }),
        ...(body.note !== undefined && { note: body.note }),
      },
    });

    console.log(`[ExcludeRules API] 규칙 수정: ${ruleId}`);
    return NextResponse.json(rule);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[projectId]/exclude-rules/[ruleId]
 * 제외 규칙 삭제
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { projectId, ruleId } = await params;

  try {
    await prisma.excludeRule.delete({ where: { id: ruleId, projectId } });
    console.log(`[ExcludeRules API] 규칙 삭제: ${ruleId}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
