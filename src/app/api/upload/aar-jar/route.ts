// AAR/JAR 파일 업로드 + 파싱 API Route
// Next.js App Router의 Route Handler: Java Spring의 @PostMapping과 유사
// 파일 업로드 → 임시 저장 → 파싱 → DB 저장의 흐름

import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { parseAarOrJar, applyExcludeRules } from "@/lib/services/jarParserService";
import { ParseOptions, DEFAULT_PARSE_OPTIONS } from "@/lib/parseOptions";
import { apiError, apiSuccess, getErrorMessage } from "@/lib/apiResponse";

// 업로드 파일 저장 기본 경로
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

// Next.js Route Handler 설정: 대용량 파일 업로드를 위해 body 파싱 비활성화
// Java의 @MultipartConfig와 유사
export const config = {
  api: { bodyParser: false },
};

/**
 * POST /api/upload/aar-jar
 *
 * multipart/form-data로 AAR 또는 JAR 파일을 받아 파싱 후 DB에 저장
 * FormData 필드:
 *   - file: AAR/JAR 파일 (필수)
 *   - projectId: 소속 프로젝트 ID (필수)
 *   - moduleName: 모듈명 (필수)
 *   - version: 버전 문자열 ex) "1.0.0" (필수)
 */
export async function POST(req: NextRequest) {
  console.log("[Upload API] 파일 업로드 요청 수신");

  try {
    const formData = await req.formData();

    // FormData에서 필드 추출
    // TypeScript의 as 캐스팅: Java의 (Type) 형변환과 유사하나 런타임 검사 없음
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const moduleName = formData.get("moduleName") as string | null;
    const version = formData.get("version") as string | null;
    // parseOptions: FormData는 문자열만 지원 → JSON.parse로 역직렬화
    const parseOptionsStr = formData.get("parseOptions") as string | null;
    const requestOptions: Partial<ParseOptions> | null = parseOptionsStr
      ? JSON.parse(parseOptionsStr)
      : null;

    // 입력값 검증
    if (!file || !projectId || !moduleName || !version) {
      return apiError.badRequest("file, projectId, moduleName, version 필드가 필요합니다");
    }

    // 파일 확장자로 타입 판별
    const fileName = file.name.toLowerCase();
    const fileType = fileName.endsWith(".aar")
      ? "AAR"
      : fileName.endsWith(".jar")
      ? "JAR"
      : null;

    if (!fileType) {
      return apiError.badRequest(".aar 또는 .jar 파일만 허용됩니다");
    }

    console.log(`[Upload API] 파일명: ${file.name}, 크기: ${file.size} bytes`);

    // 업로드 디렉토리 생성 (없으면)
    const uploadPath = path.join(UPLOAD_DIR, projectId, moduleName);
    await mkdir(uploadPath, { recursive: true });

    // 파일을 디스크에 저장
    // Next.js의 File은 Web API File이므로 arrayBuffer()로 Buffer 변환
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const savedFilePath = path.join(
      uploadPath,
      `${version}_${Date.now()}_${file.name}`
    );
    await writeFile(savedFilePath, fileBuffer);

    console.log(`[Upload API] 파일 저장 완료: ${savedFilePath}`);

    // 프로젝트 존재 확인
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return apiError.notFound("존재하지 않는 프로젝트입니다");
    }

    // 모듈 upsert — 파싱 옵션 포함
    const module = await prisma.module.upsert({
      where: { projectId_name: { projectId, name: moduleName } },
      update: requestOptions ? { parseOptions: requestOptions } : {},
      create: {
        projectId,
        name: moduleName,
        type: fileType,
        parseOptions: requestOptions ?? DEFAULT_PARSE_OPTIONS,
      },
    });

    console.log(`[Upload API] 모듈 처리 완료: ${module.id}`);

    // 저장된 옵션 + 요청 옵션 병합
    const storedOptions = (module.parseOptions as Partial<ParseOptions>) ?? {};
    const resolvedParseOptions: ParseOptions = {
      ...DEFAULT_PARSE_OPTIONS,
      ...storedOptions,
      ...requestOptions,
    };
    console.log(`[Upload API] 적용 파싱 옵션:`, resolvedParseOptions);

    // 버전 중복 확인
    const existingVersion = await prisma.moduleVersion.findUnique({
      where: {
        moduleId_version: { moduleId: module.id, version },
      },
    });
    if (existingVersion) {
      return apiError.conflict(`버전 ${version}은 이미 업로드되어 있습니다`);
    }

    // AAR/JAR 파싱 실행 (resolvedParseOptions 적용)
    console.log(`[Upload API] 파싱 시작...`);
    const parseResult = await parseAarOrJar(savedFilePath, fileType, resolvedParseOptions);

    // ── 제외 규칙 적용 ─────────────────────────────────────────
    let excludedCount = 0;
    const excludeRules = await prisma.excludeRule.findMany({ where: { projectId } });
    const { filtered: filteredApis, excludedCount: cnt } = applyExcludeRules(
      parseResult.apis,
      excludeRules.map((r) => ({
        type: r.type,
        className: r.className,
        methodName: r.methodName,
        matchParams: r.matchParams,
        params: r.params as string[],
      }))
    );
    excludedCount = cnt;
    if (excludedCount > 0) {
      console.log(`[Upload API] 제외 규칙 ${excludeRules.length}개 적용 → ${excludedCount}개 API 제외`);
    }
    parseResult.apis = filteredApis;

    // ── 트랜잭션 전 사전 조회 ──────────────────────────────────
    // 루프 안 count() 쿼리 제거: 기존 apiEntry ID를 한 번에 Set으로 캐싱
    const existingEntries = await prisma.apiEntry.findMany({
      where: { moduleId: module.id },
      select: { id: true },
    });
    const existingApiIdSet = new Set(existingEntries.map((e) => e.id));
    console.log(`[Upload API] 기존 ApiEntry ${existingApiIdSet.size}개 캐싱 완료`);

    // 트랜잭션으로 버전 + API 목록 + 스냅샷 저장 (타임아웃 60초)
    // Prisma transaction: Java의 @Transactional과 유사
    const saved = await prisma.$transaction(async (tx) => {
      // 1. ModuleVersion 생성
      const moduleVersion = await tx.moduleVersion.create({
        data: {
          moduleId: module.id,
          version,
          filePath: savedFilePath,
        },
      });
      console.log(`[Upload API] 버전 레코드 생성: ${moduleVersion.id}`);

      // 2. ApiEntry upsert (루프) + 스냅샷 데이터 수집
      let newCount = 0;
      let sameCount = 0;
      const processedApiIds = new Set<string>();
      // 스냅샷 페이로드를 메모리에 수집 후 createMany로 일괄 저장
      const snapshotPayload: Array<{
        moduleVersionId: string;
        apiEntryId: string;
        changeType: "ADDED" | "SAME";
      }> = [];

      for (const api of parseResult.apis) {
        const apiEntry = await tx.apiEntry.upsert({
          where: {
            moduleId_className_methodName_params: {
              moduleId: module.id,
              className: api.className,
              methodName: api.methodName,
              params: api.params,
            },
          },
          update: {
            returnType: api.returnType,
            isStatic: api.isStatic,
            isDeprecated: api.isDeprecated,
          },
          create: {
            moduleId: module.id,
            className: api.className,
            methodName: api.methodName,
            params: api.params,
            returnType: api.returnType,
            isStatic: api.isStatic,
            isDeprecated: api.isDeprecated,
          },
        });

        if (processedApiIds.has(apiEntry.id)) continue;
        processedApiIds.add(apiEntry.id);

        // Set 룩업으로 신규 여부 판별 (DB 쿼리 없음)
        const isNew = !existingApiIdSet.has(apiEntry.id);
        snapshotPayload.push({
          moduleVersionId: moduleVersion.id,
          apiEntryId: apiEntry.id,
          changeType: isNew ? "ADDED" : "SAME",
        });
        isNew ? newCount++ : sameCount++;
      }

      // 3. ApiSnapshot 일괄 저장
      await tx.apiSnapshot.createMany({
        data: snapshotPayload,
        skipDuplicates: true,
      });

      console.log(`[Upload API] API 저장 완료: 신규 ${newCount}개, 유지 ${sameCount}개`);
      return { moduleVersion, newCount, sameCount };
    }, { timeout: 60_000 }); // 대용량 JAR 대비 60초

    return apiSuccess.created({
      success: true,
      message: "파싱 및 저장 완료",
      moduleId: module.id,
      versionId: saved.moduleVersion.id,
      totalApis: parseResult.apis.length,
      newApis: saved.newCount,
      totalClasses: parseResult.totalClasses,
      parseErrors: parseResult.errors,
    });
  } catch (e) {
    const message = getErrorMessage(e);
    console.error(`[Upload API] 오류 발생:`, message);
    return apiError.internal(`파일 처리 중 오류가 발생했습니다: ${message}`);
  }
}
