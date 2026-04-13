// TC 추천 API — 미커버 API에 대해 Claude AI가 테스트 시나리오를 생성
// GET: 저장된 추천 목록 조회
// POST: 특정 모듈의 미커버 API에 대해 AI 추천 생성 + DB 저장

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// Anthropic 클라이언트를 모듈 레벨에서 초기화하면 API 키 미설정 시 오류 발생
// → 함수 호출 시점에 생성하여 키 검증 후 사용 (Lazy 초기화 패턴)
// Java의 지연 초기화(Lazy Initialization) 패턴과 동일
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.");
  }
  return new Anthropic({ apiKey });
}

// Claude가 반환하는 추천 항목 타입
interface AiRecommendation {
  suggestedTestName: string; // 테스트 메서드명 ex) "getSerial_returnsNonNullOnValidDevice"
  scenario: string;          // 테스트 시나리오 설명 (1~2문장)
  reasoning: string;         // 이 TC가 필요한 이유
  sampleCode: string;        // Kotlin/Java 샘플 코드 스니펫
}

/**
 * GET /api/recommendations?moduleId=xxx
 * 저장된 TC 추천 목록 반환 (moduleId 필터링)
 */
export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get("moduleId");

  console.log(`[Recommendations API] GET, moduleId: ${moduleId}`);

  try {
    const recommendations = await prisma.recommendation.findMany({
      where: moduleId
        ? { api: { moduleId } }
        : undefined,
      include: {
        api: {
          select: { id: true, className: true, methodName: true, params: true, returnType: true },
        },
      },
      orderBy: { generatedAt: "desc" },
    });

    // 클래스별 그룹핑 — 프론트엔드 렌더링 편의를 위해 서버에서 미리 그룹화
    // TypeScript의 reduce: Java의 Collectors.groupingBy와 동일한 역할
    const grouped = recommendations.reduce(
      (acc, rec) => {
        const key = rec.api.className;
        if (!acc[key]) acc[key] = [];
        acc[key].push(rec);
        return acc;
      },
      {} as Record<string, typeof recommendations>
    );

    return NextResponse.json({
      total: recommendations.length,
      grouped,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Recommendations API] GET 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/recommendations
 * 미커버 API에 대한 TC 추천 생성
 *
 * Body:
 *   moduleId - 대상 모듈 ID (필수)
 *   limit    - 한 번에 처리할 최대 API 수 (기본 10, 최대 20)
 *   replace  - true이면 기존 추천 삭제 후 재생성 (기본 false)
 */
export async function POST(req: NextRequest) {
  console.log("[Recommendations API] TC 추천 생성 요청");

  try {
    const body = await req.json() as {
      moduleId?: string;
      limit?: number;
      replace?: boolean;
    };

    const { moduleId, limit = 10, replace = false } = body;

    if (!moduleId) {
      return NextResponse.json({ error: "moduleId가 필요합니다" }, { status: 400 });
    }

    // 모듈 정보 조회
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true, name: true },
    });
    if (!module) {
      return NextResponse.json({ error: "모듈을 찾을 수 없습니다" }, { status: 404 });
    }

    // 미커버 API 조회 — Coverage 레코드가 없는 ApiEntry
    // replace=false 시 추천이 이미 있는 항목도 제외하기 위해 항상 recommendations 포함
    // Prisma의 none 필터: Java의 NOT EXISTS 서브쿼리와 동일
    const uncoveredApis = await prisma.apiEntry.findMany({
      where: {
        moduleId,
        coverages: { none: {} }, // 커버리지 레코드가 하나도 없는 항목
      },
      select: {
        id: true,
        className: true,
        methodName: true,
        params: true,
        returnType: true,
        isStatic: true,
        isDeprecated: true,
        recommendations: { select: { id: true }, take: 1 }, // 추천 존재 여부 확인용
      },
      orderBy: [{ className: "asc" }, { methodName: "asc" }],
      take: Math.min(limit, 20), // 최대 20개 제한 — Claude API 비용 절감
    });

    if (uncoveredApis.length === 0) {
      return NextResponse.json({
        generated: 0,
        message: "미커버 API가 없습니다",
      });
    }

    // replace 모드: 대상 API의 기존 추천 삭제 후 전체 재생성
    if (replace) {
      const apiIds = uncoveredApis.map((a) => a.id);
      await prisma.recommendation.deleteMany({
        where: { apiId: { in: apiIds } },
      });
      console.log(`[Recommendations API] 기존 추천 삭제: ${apiIds.length}개 API`);
    } else {
      // 이미 추천이 있는 API 필터링 — recommendations 배열이 비어있는 것만 처리
      // Prisma select에서 recommendations가 항상 포함됨 → 타입 안전
      const apisWithoutRecs = uncoveredApis.filter((a) => a.recommendations.length === 0);
      if (apisWithoutRecs.length === 0) {
        return NextResponse.json({
          generated: 0,
          message: "모든 미커버 API에 이미 추천이 존재합니다. '기존 추천 재생성' 옵션을 사용하세요",
        });
      }
      // 추천 없는 항목만 처리 대상으로 교체
      uncoveredApis.splice(0, uncoveredApis.length, ...apisWithoutRecs);
    }

    console.log(`[Recommendations API] ${uncoveredApis.length}개 API에 대해 Claude 추천 생성 시작`);

    // Claude에게 전달할 API 목록 형식화
    // 시그니처를 읽기 쉽게 정리: "static String getSerial(Context ctx)"
    const apiSummaries = uncoveredApis.map((api) => {
      const params = (api.params as string[]).join(", ");
      const staticMod = api.isStatic ? "static " : "";
      return `- ${api.className}.${api.methodName}(${params}): ${staticMod}${api.returnType}${api.isDeprecated ? " [deprecated]" : ""}`;
    }).join("\n");

    // ── Claude API 호출 ──────────────────────────────────────────
    // API 키가 없으면 getAnthropicClient()에서 명확한 오류 메시지 throw
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `당신은 Android SDK QA 전문가입니다. 아래 미테스트 API 목록에 대해 테스트 케이스를 추천해주세요.

모듈명: ${module.name}

미테스트 API 목록:
${apiSummaries}

각 API에 대해 JSON 배열 형식으로 응답해주세요. 반드시 아래 형식을 준수하세요:
[
  {
    "apiSignature": "ClassName.methodName",
    "suggestedTestName": "테스트_메서드명_camelCase",
    "scenario": "테스트 시나리오 한 줄 설명",
    "reasoning": "이 TC가 필요한 이유 (비즈니스/기술적 근거)",
    "sampleCode": "// Kotlin 샘플 코드\\n@Test\\nfun 테스트명() { ... }"
  }
]

주의사항:
- JSON 형식만 반환하세요 (마크다운 코드블록 없이)
- sampleCode는 Kotlin으로 작성하세요
- scenario는 1~2문장으로 간결하게
- deprecated API는 "deprecated API 호환성 테스트"로 표시하세요`,
        },
      ],
    });

    // Claude 응답 파싱
    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    console.log(`[Recommendations API] Claude 응답 수신 (${responseText.length}자)`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let aiResults: Array<AiRecommendation & { apiSignature: string }> = [];
    try {
      // JSON 파싱 — 마크다운 코드블록이 포함된 경우 제거
      const cleaned = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      aiResults = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[Recommendations API] JSON 파싱 실패:", parseErr);
      return NextResponse.json(
        { error: "Claude 응답 파싱 실패. 잠시 후 다시 시도해주세요", raw: responseText.slice(0, 200) },
        { status: 502 }
      );
    }

    // API 시그니처로 apiEntry.id 매핑
    // "ClassName.methodName" → apiEntry.id 룩업 맵
    // Java의 Map<String, String> 생성: stream().collect(Collectors.toMap(...))와 유사
    const signatureToId = new Map<string, string>(
      uncoveredApis.map((a) => [`${a.className}.${a.methodName}`, a.id])
    );

    // DB에 추천 저장
    let savedCount = 0;
    const saveErrors: string[] = [];

    for (const rec of aiResults) {
      const apiId = signatureToId.get(rec.apiSignature);
      if (!apiId) {
        console.warn(`[Recommendations API] 시그니처 매핑 실패: ${rec.apiSignature}`);
        saveErrors.push(`시그니처 없음: ${rec.apiSignature}`);
        continue;
      }

      try {
        await prisma.recommendation.create({
          data: {
            apiId,
            suggestedTestName: rec.suggestedTestName ?? "test_unnamed",
            scenario: rec.scenario ?? "",
            reasoning: rec.reasoning ?? "",
            sampleCode: rec.sampleCode ?? null,
          },
        });
        savedCount++;
      } catch (saveErr) {
        console.error(`[Recommendations API] 저장 실패: ${rec.apiSignature}`, saveErr);
        saveErrors.push(`저장 실패: ${rec.apiSignature}`);
      }
    }

    console.log(`[Recommendations API] 완료: ${savedCount}개 추천 저장, ${saveErrors.length}개 오류`);

    return NextResponse.json({
      generated: savedCount,
      requested: uncoveredApis.length,
      errors: saveErrors,
      message: `${savedCount}개의 TC 추천이 생성되었습니다`,
      tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Recommendations API] 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
