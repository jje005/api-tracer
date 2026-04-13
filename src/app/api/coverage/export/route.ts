// 커버리지 데이터 CSV 내보내기 API Route
// GET /api/coverage/export?projectId=xxx
// UTF-8 BOM 포함으로 엑셀 한글 깨짐 방지
// Java의 @GetMapping + HttpServletResponse.setHeader()와 유사하게 응답 헤더 직접 설정
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/coverage/export
 * 프로젝트의 전체 API + 커버리지 현황을 CSV로 다운로드
 * @param projectId - 내보낼 프로젝트 ID (쿼리 파라미터)
 */
export async function GET(req: NextRequest) {
  // TypeScript: URL 파라미터는 항상 string | null 반환
  // Java의 @RequestParam(required = true)과 달리 직접 null 체크 필요
  const projectId = req.nextUrl.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId 필요" }, { status: 400 });
  }

  console.log(`[Coverage Export] CSV 내보내기 시작: projectId=${projectId}`);

  try {
    // 프로젝트 존재 여부 확인
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다" }, { status: 404 });
    }

    // 해당 프로젝트의 모든 API + 커버리지 조회
    // include 중첩: Java의 @OneToMany + @ManyToOne fetch join과 유사
    const apis = await prisma.apiEntry.findMany({
      where: {
        module: { projectId },
      },
      include: {
        module: { select: { name: true } },
        coverages: {
          include: {
            testCase: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { module: { name: "asc" } },
        { className: "asc" },
        { methodName: "asc" },
      ],
    });

    console.log(`[Coverage Export] 조회된 API 수: ${apis.length}`);

    // CSV 특수문자 이스케이프 처리
    // 쉼표, 줄바꿈, 큰따옴표 포함 시 큰따옴표로 감싸기 (RFC 4180 규격)
    // Java의 StringUtils와 유사한 순수 함수로 처리
    const escapeCsv = (s: string): string => {
      if (s.includes(",") || s.includes("\n") || s.includes('"')) {
        // 내부 큰따옴표는 ""로 이스케이프
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    // CSV 헤더 정의
    const header = "모듈명,클래스명,메서드명,파라미터,반환타입,커버여부,테스트케이스";

    // 각 API를 CSV 행으로 변환
    // TypeScript의 배열 map/filter/join: Java Stream API와 유사하나 더 간결
    const rows = apis.map((api) => {
      const covered = api.coverages.length > 0 ? "커버됨" : "미커버";
      const tcNames = api.coverages.map((c) => c.testCase.name).join("|");
      // params는 Json 타입이므로 string[] 캐스팅 후 세미콜론으로 조인
      const params = (api.params as string[]).join(";");

      return [
        escapeCsv(api.module.name),
        escapeCsv(api.className),
        escapeCsv(api.methodName),
        escapeCsv(params),
        escapeCsv(api.returnType),
        covered,
        escapeCsv(tcNames),
      ].join(",");
    });

    // BOM(U+FEFF) 추가: 엑셀에서 UTF-8 파일을 올바르게 읽기 위한 바이트 순서 표시
    // Java의 OutputStreamWriter(new FileOutputStream(...), StandardCharsets.UTF_8)와 유사하나
    // 엑셀 호환성을 위해 BOM 문자를 수동으로 추가해야 함
    const csv = "\uFEFF" + [header, ...rows].join("\n");

    // 파일명에 날짜 포함 (ISO 형식 앞 10자리: YYYY-MM-DD)
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `coverage_${project.name}_${dateStr}.csv`;

    console.log(`[Coverage Export] CSV 생성 완료: ${rows.length}행, 파일명: ${fileName}`);

    // NextResponse로 파일 다운로드 응답 반환
    // Java의 response.setHeader("Content-Disposition", "attachment; filename=...") 와 동일
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Coverage Export] 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
