// 모듈 API 데이터 정리 API
// 파서 버그로 인해 저장된 잘못된 ApiEntry를 DB에서 직접 제거
// 재파싱 없이 오염된 데이터만 선별 삭제

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ moduleId: string }>;
}

// 유효한 Java 메서드명 패턴
// 영문자/_ /$로 시작하고, 이후 영문자/숫자/_ /$만 허용
// /  ;  [  L... 등 JVM 내부 특수문자 포함 시 파서 오류로 생긴 artifact
const VALID_METHOD_NAME = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

// 유효하지 않은 클래스명 패턴:
// - 세미콜론 포함: "Ljava.lang.String;" 같은 타입 디스크립터
// - [ 로 시작: "[B", "[Ljava/lang/String;" 같은 배열 디스크립터
const isInvalidClassName = (name: string) => name.includes(";") || name.startsWith("[");

/**
 * POST /api/modules/[moduleId]/cleanup
 * 모듈의 ApiEntry 중 잘못된 메서드명/클래스명을 가진 항목 삭제
 *
 * 삭제 대상:
 *   - methodName에 / ; [ 등 JVM 특수문자 포함
 *   - methodName이 - . 등 비식별자 문자 포함 (ex: "Connect-S")
 *   - className이 L...;  또는 [...  형태인 JVM 타입 디스크립터
 *
 * Body: {} (파라미터 없음, dry_run 옵션 가능)
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { moduleId } = await params;
  const body = await req.json().catch(() => ({})) as { dryRun?: boolean };
  const dryRun = body.dryRun ?? false;

  console.log(`[Cleanup API] 모듈 데이터 정리 시작: ${moduleId}, dryRun=${dryRun}`);

  try {
    // 전체 ApiEntry 조회 (className, methodName만)
    const entries = await prisma.apiEntry.findMany({
      where: { moduleId },
      select: { id: true, className: true, methodName: true },
    });

    // 잘못된 항목 필터링
    const invalid = entries.filter(
      (e) => !VALID_METHOD_NAME.test(e.methodName) || isInvalidClassName(e.className)
    );

    console.log(`[Cleanup API] 전체 ${entries.length}개 중 잘못된 항목: ${invalid.length}개`);

    if (dryRun) {
      // dry run: 삭제하지 않고 목록만 반환
      return NextResponse.json({
        dryRun: true,
        total: entries.length,
        invalidCount: invalid.length,
        samples: invalid.slice(0, 20).map((e) => ({
          id: e.id,
          className: e.className,
          methodName: e.methodName,
        })),
      });
    }

    if (invalid.length === 0) {
      return NextResponse.json({ deleted: 0, message: "정리할 항목이 없습니다" });
    }

    const invalidIds = invalid.map((e) => e.id);

    // CASCADE: ApiSnapshot, Coverage도 함께 삭제됨
    const deleted = await prisma.apiEntry.deleteMany({
      where: { id: { in: invalidIds } },
    });

    console.log(`[Cleanup API] 삭제 완료: ${deleted.count}개`);

    return NextResponse.json({
      deleted: deleted.count,
      message: `${deleted.count}개의 잘못된 API 항목이 정리되었습니다`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Cleanup API] 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
