// 개별 TC 추천 삭제 API
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ recId: string }>;
}

/**
 * DELETE /api/recommendations/[recId]
 * 특정 추천 항목 삭제
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { recId } = await params;
  console.log(`[Recommendations API] 추천 삭제: ${recId}`);

  try {
    await prisma.recommendation.delete({ where: { id: recId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Recommendations API] 삭제 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
