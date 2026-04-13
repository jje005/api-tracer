// JAR/AAR 파싱 서비스
// AAR은 ZIP 형식이며 내부에 classes.jar가 존재
// JAR도 ZIP 형식이며 .class 파일들을 직접 포함

import fs from "fs";
import path from "path";
import yauzl from "yauzl";
// java-class-tools의 실제 export: JavaClassFileReader, Modifier 사용
// ClassReader → JavaClassFileReader, Opcodes.ACC_PUBLIC → Modifier.PUBLIC
import { JavaClassFileReader, Modifier } from "java-class-tools";

// ─── 타입 정의 ────────────────────────────────────────────────
// TypeScript interface: Java의 DTO/VO 클래스와 유사하나 런타임에 존재하지 않음
export interface ParsedApi {
  className: string;    // ex) "com.example.DeviceManager"
  methodName: string;   // ex) "getSerial"
  params: string[];     // ex) ["String", "int"]
  returnType: string;   // ex) "String"
  isStatic: boolean;
  isDeprecated: boolean;
}

export interface ParseResult {
  apis: ParsedApi[];
  totalClasses: number;
  errors: string[];
}

// ─── 파싱 옵션 ────────────────────────────────────────────────
// ParseOptions, DEFAULT_PARSE_OPTIONS는 @/lib/parseOptions에 정의됨
// 클라이언트 컴포넌트는 반드시 "@/lib/parseOptions"에서 직접 import할 것
// (이 파일은 Node.js 전용 모듈 포함 → 클라이언트 번들 포함 시 오류)
import { ParseOptions, DEFAULT_PARSE_OPTIONS } from "@/lib/parseOptions";
// 서버 사이드(API 라우트 등)에서 타입이 필요하면 "@/lib/parseOptions"에서 import
export type { ParseOptions };

// 제외 규칙 타입 (DB 모델과 동일하지만 서비스 레이어에서 별도 정의해 결합도 낮춤)
// Java의 DTO 패턴과 동일: DB 엔티티를 서비스 레이어에 직접 노출하지 않음
export interface ExcludeRuleInput {
  type: "CLASS" | "METHOD";
  className: string;       // 와일드카드 지원: "hmg.car.internal.*"
  methodName?: string | null;
  matchParams: boolean;
  params: string[];        // matchParams=true일 때 비교할 파라미터
}

// ─── 제외 규칙 적용 ───────────────────────────────────────────
/**
 * 파싱된 API 목록에 제외 규칙을 적용하여 필터링된 결과 반환
 * 파싱 후 DB 저장 전 단계에서 호출
 *
 * 와일드카드 패턴: "hmg.car.internal.*" → hmg.car.internal로 시작하는 모든 클래스
 * 정확한 매칭: "hmg.car.HmgActivityManager" → 해당 클래스만
 */
export function applyExcludeRules(
  apis: ParsedApi[],
  rules: ExcludeRuleInput[]
): { filtered: ParsedApi[]; excludedCount: number } {
  if (rules.length === 0) return { filtered: apis, excludedCount: 0 };

  const filtered = apis.filter((api) => {
    for (const rule of rules) {
      // 클래스명 매칭 (와일드카드 지원)
      // "hmg.car.*" → hmg.car.로 시작하는 모든 클래스
      // Java의 String.startsWith()와 동일한 prefix 매칭
      const classMatches = rule.className.endsWith(".*")
        ? api.className.startsWith(rule.className.slice(0, -2))   // ".*" 제거 후 prefix 비교
        : api.className === rule.className;

      if (!classMatches) continue;

      if (rule.type === "CLASS") {
        // 클래스 전체 제외
        return false;
      }

      // METHOD 타입: 메서드명 비교
      if (rule.methodName && api.methodName === rule.methodName) {
        if (!rule.matchParams) {
          // 파라미터 무관 — 메서드명만 일치하면 제외
          return false;
        }
        // 파라미터까지 비교 — JSON 직렬화 후 문자열 비교
        // TypeScript의 JSON.stringify: Java의 Arrays.equals()와 유사한 값 비교
        if (JSON.stringify(api.params) === JSON.stringify(rule.params)) {
          return false;
        }
      }
    }
    return true; // 어떤 규칙에도 해당하지 않으면 포함
  });

  const excludedCount = apis.length - filtered.length;
  if (excludedCount > 0) {
    console.log(`[JarParser] 제외 규칙 적용: ${excludedCount}개 API 제외됨`);
  }

  return { filtered, excludedCount };
}

// ─── JAR/AAR 파싱 진입점 ──────────────────────────────────────
/**
 * AAR 또는 JAR 파일을 파싱하여 Public API 목록을 반환
 * AAR의 경우 내부 classes.jar를 먼저 추출 후 파싱
 *
 * @param filePath - 업로드된 파일의 절대 경로
 * @param fileType - "AAR" | "JAR"
 * @param options  - 파싱 옵션 (미지정 시 DEFAULT_PARSE_OPTIONS 사용)
 */
export async function parseAarOrJar(
  filePath: string,
  fileType: "AAR" | "JAR",
  options?: Partial<ParseOptions>  // Partial: Java의 Optional 필드처럼 일부만 지정 가능
): Promise<ParseResult> {
  // 기본값과 전달된 옵션 병합 (Object spread: Java의 Map.putAll과 유사)
  const resolvedOptions: ParseOptions = { ...DEFAULT_PARSE_OPTIONS, ...options };
  console.log(`[JarParser] 파싱 시작: ${filePath} (타입: ${fileType})`);
  console.log(`[JarParser] 파싱 옵션:`, resolvedOptions);

  // AAR이면 내부 classes.jar 추출 후 JAR로 처리
  const jarPath =
    fileType === "AAR" ? await extractClassesJarFromAar(filePath) : filePath;

  console.log(`[JarParser] JAR 경로: ${jarPath}`);

  const result = await parseJar(jarPath, resolvedOptions);

  // AAR에서 임시 추출한 classes.jar 삭제
  if (fileType === "AAR" && jarPath !== filePath) {
    fs.unlinkSync(jarPath);
    console.log(`[JarParser] 임시 classes.jar 삭제 완료`);
  }

  // 중복 시그니처 제거 — stub JAR 특성상 인터페이스 + 구현 클래스가 동일 메서드를 공유
  // Map<signature, ParsedApi>: 같은 키는 마지막 값으로 덮어씀 (Java의 LinkedHashMap과 유사)
  const deduped = new Map<string, ParsedApi>();
  for (const api of result.apis) {
    // 시그니처 키: "className#methodName#param1,param2"
    const key = `${api.className}#${api.methodName}#${api.params.join(",")}`;
    deduped.set(key, api);
  }
  const dedupedApis = Array.from(deduped.values());

  console.log(
    `[JarParser] 파싱 완료: ${dedupedApis.length}개 API (중복 제거 전 ${result.apis.length}개), ${result.errors.length}개 오류`
  );
  return { ...result, apis: dedupedApis };
}

// ─── AAR에서 classes.jar 추출 ─────────────────────────────────
/**
 * AAR(ZIP) 파일에서 classes.jar를 임시 경로에 추출
 *
 * Java의 ZipInputStream과 동일한 역할을 yauzl로 수행
 * TypeScript의 Promise 기반 비동기 처리: Java의 Future/CompletableFuture와 유사
 */
async function extractClassesJarFromAar(aarPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempJarPath = aarPath.replace(/\.aar$/i, "_classes_temp.jar");

    console.log(`[JarParser] AAR에서 classes.jar 추출 중...`);

    // yauzl: Node.js용 ZIP 파일 리더
    yauzl.open(aarPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err ?? new Error("ZIP 열기 실패"));

      zipfile.readEntry();

      zipfile.on("entry", (entry: yauzl.Entry) => {
        // classes.jar 엔트리 찾기
        if (entry.fileName === "classes.jar") {
          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr || !readStream) {
              return reject(streamErr ?? new Error("스트림 열기 실패"));
            }

            const writeStream = fs.createWriteStream(tempJarPath);
            readStream.pipe(writeStream);
            writeStream.on("finish", () => {
              console.log(`[JarParser] classes.jar 추출 완료: ${tempJarPath}`);
              resolve(tempJarPath);
            });
            writeStream.on("error", reject);
          });
        } else {
          zipfile.readEntry(); // 다음 엔트리로
        }
      });

      zipfile.on("end", () => {
        // classes.jar를 못 찾은 경우
        if (!fs.existsSync(tempJarPath)) {
          reject(new Error("AAR 파일 내 classes.jar를 찾을 수 없습니다"));
        }
      });

      zipfile.on("error", reject);
    });
  });
}

// ─── JAR 파싱 ─────────────────────────────────────────────────
/**
 * JAR(ZIP) 파일의 모든 .class 파일을 파싱하여 Public API 추출
 */
async function parseJar(jarPath: string, options: ParseOptions): Promise<ParseResult> {
  const apis: ParsedApi[] = [];
  const errors: string[] = [];
  let totalClasses = 0;

  // JAR 내 모든 .class 파일을 버퍼로 읽기
  const classBuffers = await extractClassBuffersFromJar(jarPath);
  totalClasses = classBuffers.length;

  console.log(`[JarParser] 총 ${totalClasses}개 .class 파일 파싱 시작`);

  for (const { name, buffer } of classBuffers) {
    try {
      const classApis = parseClassFile(name, buffer, options);
      apis.push(...classApis);
    } catch (e) {
      const msg = `${name} 파싱 실패: ${e instanceof Error ? e.message : String(e)}`;
      errors.push(msg);
      console.warn(`[JarParser] ${msg}`);
    }
  }

  return { apis, totalClasses, errors };
}

// ─── JAR에서 .class 버퍼 추출 ────────────────────────────────
/**
 * JAR 내 모든 .class 파일을 Buffer 배열로 반환
 */
async function extractClassBuffersFromJar(
  jarPath: string
): Promise<Array<{ name: string; buffer: Buffer }>> {
  return new Promise((resolve, reject) => {
    const results: Array<{ name: string; buffer: Buffer }> = [];

    yauzl.open(jarPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err ?? new Error("ZIP 열기 실패"));

      zipfile.readEntry();

      zipfile.on("entry", (entry: yauzl.Entry) => {
        // .class 파일만 처리, 익명 클래스($) 포함
        if (entry.fileName.endsWith(".class")) {
          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr || !readStream) {
              zipfile.readEntry();
              return;
            }

            const chunks: Buffer[] = [];
            readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
            readStream.on("end", () => {
              results.push({
                name: entry.fileName,
                buffer: Buffer.concat(chunks),
              });
              zipfile.readEntry();
            });
            readStream.on("error", () => zipfile.readEntry());
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on("end", () => resolve(results));
      zipfile.on("error", reject);
    });
  });
}

// ─── .class 파일 파싱 ─────────────────────────────────────────
/**
 * 단일 .class 파일 바이트코드를 파싱하여 Public 메서드 목록 반환
 *
 * java-class-tools 라이브러리:
 * - JavaClassFileReader: 바이트코드에서 클래스 구조 파싱
 * - Modifier: 접근 제어자 플래그 상수 (Java의 Modifier.PUBLIC 등)
 */
function parseClassFile(fileName: string, buffer: Buffer, options: ParseOptions): ParsedApi[] {
  const reader = new JavaClassFileReader();
  // Buffer를 Uint8Array로 변환 (java-class-tools가 Uint8Array를 요구)
  const classFile = reader.read(new Uint8Array(buffer));

  const apis: ParsedApi[] = [];

  // ── 상수 풀 헬퍼 ───────────────────────────────────────────────
  // java-class-tools는 JVM 스펙과 동일하게 상수 풀을 1-indexed로 저장
  // constant_pool[0] = null(unused), 실제 데이터는 constant_pool[1] 부터 시작
  // → 인덱스에 -1 보정 없이 JVM 스펙의 원본 index를 그대로 사용해야 함
  // Java의 constantPool[index] 직접 접근과 동일한 개념
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cpEntry = (idx: number): any => classFile.constant_pool[idx];

  // CONSTANT_Utf8_info의 bytes 필드를 문자열로 변환
  // bytes는 number[] (UTF-8 바이트 배열) → Buffer로 변환 후 디코딩
  const cpUtf8 = (idx: number): string => {
    const entry = cpEntry(idx);
    if (!entry?.bytes) return "";
    if (Array.isArray(entry.bytes)) {
      return Buffer.from(entry.bytes).toString("utf8");
    }
    return String(entry.bytes);
  };

  // 클래스 자체가 public이 아니면 스킵
  if (!(classFile.access_flags & Modifier.PUBLIC)) {
    return apis;
  }

  // ACC_ANNOTATION (0x2000): @interface 어노테이션 타입 전체 스킵
  // @NonNull, @Target, @Retention 등 — annotation element가 abstract method로 파싱되어 API로 오인됨
  // Java: @interface MyAnno { String value(); } → value()가 public abstract method로 보임
  // options.filterAnnotationApis가 false이면 어노테이션도 API로 포함
  if (options.filterAnnotationApis && (classFile.access_flags & 0x2000)) {
    return apis;
  }

  // ACC_ENUM (0x4000): Enum 클래스 — values(), valueOf() 외 ordinal/name 등 컴파일러 생성 메서드 다수
  // Android에서 Enum을 API로 노출하는 경우는 드물므로 옵션으로 제외
  // Java: enum Color { RED, GREEN, BLUE } → Color.values(), Color.RED.ordinal() 등이 public method로 파싱
  if (options.filterEnumApis && (classFile.access_flags & 0x4000)) {
    return apis;
  }

  // 클래스명 추출 — JVM 상수 풀 2단계 역참조 (1-based 인덱스 직접 사용):
  //   this_class(1-based) → CONSTANT_Class_info → name_index(1-based) → CONSTANT_Utf8_info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classInfo = cpEntry(classFile.this_class) as any;
  const rawClassName = cpUtf8(classInfo?.name_index)
    || fileName.replace(/\.class$/, "");
  const className = rawClassName.replace(/\//g, ".");

  // 내부 클래스 ($가 포함된 경우) 스킵
  if (className.includes("$")) return apis;

  // 비정상 클래스명 필터 — JVM 타입 디스크립터가 클래스명으로 잘못 파싱된 경우
  // 정상: "hmg.car.am.HmgActivityManager"  (점으로 구분된 식별자)
  // 비정상: "Lhmg.car.am.HmgActivityManager;" (L prefix + 세미콜론)
  // 비정상: "[B" (배열 디스크립터)
  if (className.includes(";") || className.startsWith("[")) {
    console.warn(`[JarParser] 비정상 클래스명 스킵: "${className}"`);
    return apis;
  }

  // @Deprecated 어노테이션 체크 (1-based attribute_name_index 직접 사용)
  const isClassDeprecated =
    classFile.attributes?.some(
      (attr: { attribute_name_index: number }) =>
        cpUtf8(attr.attribute_name_index) === "Deprecated"
    ) ?? false;

  // Java Object 기본 메서드 — 모든 클래스가 가지므로 SDK API 아님
  const OBJECT_METHODS = new Set([
    "equals", "hashCode", "toString", "getClass",
    "wait", "notify", "notifyAll", "finalize",
  ]);

  // Enum 컴파일러 자동 생성 메서드
  const ENUM_UTIL_METHODS = new Set(["values", "valueOf", "ordinal", "name"]);

  // Parcelable 구현 메서드 — Android Parcelable 인터페이스의 보일러플레이트
  // 직렬화/역직렬화 구현체로, 외부 호출용 API가 아님
  // Java: implements Parcelable { writeToParcel(...), describeContents(), createFromParcel(...) }
  const PARCELABLE_METHODS = new Set([
    "writeToParcel", "describeContents", "createFromParcel",
  ]);

  // Binder/AIDL 관련 메서드 — IPC 통신 인프라 메서드, 실제 비즈니스 API 아님
  // Java: extends Binder / implements IBinder → asBinder(), onTransact() 등이 자동 생성
  const BINDER_METHODS = new Set([
    "asBinder", "onTransact", "transact", "attachInterface", "queryLocalInterface",
  ]);

  // 유효한 Java 메서드명 검증 패턴
  // 첫 글자: 영문자 또는 _ 또는 $ (사실상 알파벳으로 시작)
  // 이후: 영문자, 숫자, _, $ 허용
  // JVM 내부 특수문자(<, >, /, ;, [, L 등) 포함 시 컴파일러 생성 artifact
  const VALID_METHOD_NAME = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

  // 메서드 순회
  for (const method of classFile.methods ?? []) {
    // public 메서드만 추출
    if (!(method.access_flags & Modifier.PUBLIC)) continue;

    // synthetic (0x1000): 컴파일러 자동 생성 브릿지/람다
    if (method.access_flags & 0x1000) continue;

    // bridge (0x0040): 제네릭 타입 소거로 컴파일러 생성
    if (method.access_flags & 0x0040) continue;

    // 1-based name_index로 메서드명 추출
    const methodName = cpUtf8(method.name_index);

    // 생성자, 정적 초기화 블록 스킵
    if (methodName === "<init>" || methodName === "<clinit>") continue;

    // 유효하지 않은 메서드명 필터 — 파싱 오류로 descriptor나 annotation 값이 잡히는 경우 방지
    if (!VALID_METHOD_NAME.test(methodName)) {
      console.warn(`[JarParser] 비정상 메서드명 스킵: "${methodName}" in ${className}`);
      continue;
    }

    // Object 상속 메서드, Enum 유틸 메서드 제외 (항상 적용)
    if (OBJECT_METHODS.has(methodName) || ENUM_UTIL_METHODS.has(methodName)) continue;

    // Parcelable 구현 메서드 제외 (옵션)
    if (options.filterParcelableApis && PARCELABLE_METHODS.has(methodName)) {
      console.debug(`[JarParser] Parcelable 메서드 제외: ${className}.${methodName}`);
      continue;
    }

    // Binder/AIDL 메서드 제외 (옵션)
    if (options.filterBinderApis && BINDER_METHODS.has(methodName)) {
      console.debug(`[JarParser] Binder 메서드 제외: ${className}.${methodName}`);
      continue;
    }

    // 난독화 의심 메서드 제외 (옵션) — 메서드명 길이 ≤ 2 (a, b, B, ab 등)
    // ProGuard/R8로 난독화된 코드의 전형적 패턴
    // 단, 정상 메서드명이 짧을 수 있어 기본값은 off
    if (options.filterObfuscatedMethods && methodName.length <= 2) {
      console.debug(`[JarParser] 난독화 의심 메서드 제외: ${className}.${methodName}`);
      continue;
    }

    // 1-based descriptor_index로 디스크립터 추출
    const descriptor = cpUtf8(method.descriptor_index);

    // 디스크립터 유효성 검증 — '('로 시작해야 메서드 디스크립터
    if (!descriptor.startsWith("(")) {
      console.warn(`[JarParser] 비정상 디스크립터 스킵: "${descriptor}" for ${className}.${methodName}`);
      continue;
    }

    const { params, returnType } = parseDescriptor(descriptor);

    const isStatic = !!(method.access_flags & Modifier.STATIC);

    // 메서드별 @Deprecated 체크
    const isMethodDeprecated =
      method.attributes?.some(
        (attr: { attribute_name_index: number }) =>
          cpUtf8(attr.attribute_name_index) === "Deprecated"
      ) ?? false;

    apis.push({
      className,
      methodName,
      params,
      returnType,
      isStatic,
      isDeprecated: isClassDeprecated || isMethodDeprecated,
    });
  }

  return apis;
}

// ─── JVM 디스크립터 파싱 ──────────────────────────────────────
/**
 * JVM 메서드 디스크립터를 사람이 읽기 쉬운 타입 정보로 변환
 *
 * JVM 타입 디스크립터 형식:
 *   B=byte, C=char, D=double, F=float, I=int, J=long, S=short, Z=boolean, V=void
 *   L<classname>; = 객체 타입
 *   [<type> = 배열
 *
 * ex) "(Ljava/lang/String;I)V" → params: ["String", "int"], returnType: "void"
 */
function parseDescriptor(descriptor: string): {
  params: string[];
  returnType: string;
} {
  const parenClose = descriptor.indexOf(")");
  if (parenClose === -1) return { params: [], returnType: "void" };

  const paramPart = descriptor.slice(1, parenClose);
  const returnPart = descriptor.slice(parenClose + 1);

  return {
    params: parseTypeList(paramPart),
    returnType: parseSingleType(returnPart),
  };
}

function parseTypeList(typeStr: string): string[] {
  const types: string[] = [];
  let i = 0;

  while (i < typeStr.length) {
    const { type, length } = parseTypeAt(typeStr, i);
    types.push(type);
    i += length;
  }

  return types;
}

function parseSingleType(typeStr: string): string {
  return parseTypeAt(typeStr, 0).type;
}

function parseTypeAt(
  str: string,
  pos: number
): { type: string; length: number } {
  const primitiveMap: Record<string, string> = {
    B: "byte",
    C: "char",
    D: "double",
    F: "float",
    I: "int",
    J: "long",
    S: "short",
    Z: "boolean",
    V: "void",
  };

  const ch = str[pos];

  // 배열 타입: "[I" → "int[]", "[Ljava/lang/String;" → "String[]"
  if (ch === "[") {
    const inner = parseTypeAt(str, pos + 1);
    return { type: `${inner.type}[]`, length: 1 + inner.length };
  }

  // 객체 타입: "Ljava/lang/String;" → "String"
  if (ch === "L") {
    const end = str.indexOf(";", pos);
    const fullName = str.slice(pos + 1, end);
    // 패키지 경로 제거, 마지막 클래스명만 사용
    const simpleName = fullName.split("/").pop() ?? fullName;
    return { type: simpleName, length: end - pos + 1 };
  }

  // 기본 타입
  if (primitiveMap[ch]) {
    return { type: primitiveMap[ch], length: 1 };
  }

  return { type: "unknown", length: 1 };
}
