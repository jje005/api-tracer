// TestSuite 단건 관리 API
// DELETE: 스위트 + 케이스 + 커버리지 전체 삭제
// GET: 스위트 내 TestCase 목록 (커버된 API 포함)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ suiteId: string }>;
}

/**
 * GET /api/parse/tc/[suiteId]
 * 스위트 내 TestCase 목록 + 각 케이스가 커버하는 API 반환
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { suiteId } = await params;
  console.log(`[TC Suite API] 케이스 목록 조회: ${suiteId}`);

  try {
    const testCases = await prisma.testCase.findMany({
      where: { suiteId },
      orderBy: { name: "asc" },
      include: {
        coverages: {
          include: {
            api: {
              select: {
                id: true,
                className: true,
                methodName: true,
                returnType: true,
              },
            },
          },
        },
      },
    });

    // 클라이언트 전송 형식으로 가공
    // calledApis는 Json 타입 → 배열로 캐스팅
    const result = testCases.map((tc) => ({
      id: tc.id,
      name: tc.name,
      filePath: tc.filePath,
      calledApis: tc.calledApis as string[],
      coveredApis: tc.coverages.map((c) => ({
        id: c.api.id,
        className: c.api.className,
        methodName: c.api.methodName,
        returnType: c.api.returnType,
      })),
    }));

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[TC Suite API] 조회 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/parse/tc/[suiteId]
 * 스위트 + 소속 TestCase + Coverage 전체 삭제 (Cascade)
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { suiteId } = await params;
  console.log(`[TC Suite API] 스위트 삭제: ${suiteId}`);

  try {
    // Coverage는 TestCase의 Cascade로 자동 삭제
    // TestCase는 TestSuite의 Cascade로 자동 삭제
    await prisma.testSuite.delete({ where: { id: suiteId } });

    console.log(`[TC Suite API] 삭제 완료: ${suiteId}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[TC Suite API] 삭제 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
