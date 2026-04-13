// 파싱 옵션 타입 및 기본값 — 클라이언트/서버 양쪽에서 안전하게 import 가능
// jarParserService.ts는 Node.js 전용 모듈(fs, yauzl, java-class-tools)을 포함하므로
// 클라이언트 컴포넌트에서 직접 import 하면 번들 오류 발생 → 이 파일로 분리

// ─── 파싱 옵션 인터페이스 ─────────────────────────────────────
export interface ParseOptions {
  filterEnumApis: boolean;          // ACC_ENUM(0x4000) — Enum 클래스 전체 메서드 제외
  filterAnnotationApis: boolean;    // ACC_ANNOTATION(0x2000) — @interface 어노테이션 제외
  filterParcelableApis: boolean;    // Parcelable 구현 메서드 제외 (writeToParcel, describeContents 등)
  filterBinderApis: boolean;        // Binder 관련 메서드 제외 (asBinder, onTransact 등)
  filterObfuscatedMethods: boolean; // 난독화 의심 메서드 제외 (메서드명 길이 ≤ 2)
}

// ─── 기본 파싱 옵션 ───────────────────────────────────────────
export const DEFAULT_PARSE_OPTIONS: ParseOptions = {
  filterEnumApis: true,
  filterAnnotationApis: true,
  filterParcelableApis: true,
  filterBinderApis: true,
  filterObfuscatedMethods: false,
};

// ─── UI 메타데이터 ────────────────────────────────────────────
// 업로드 페이지 + 모듈 상세 페이지 양쪽에서 동일하게 사용
export const PARSE_OPTION_ITEMS: Array<{
  key: keyof ParseOptions;
  label: string;
  description: string;
}> = [
  {
    key: "filterEnumApis",
    label: "Enum 클래스 제외",
    description: "Enum 타입의 모든 메서드를 API 목록에서 제외합니다",
  },
  {
    key: "filterAnnotationApis",
    label: "@interface 제외",
    description: "@interface 어노테이션 타입 메서드를 API 목록에서 제외합니다",
  },
  {
    key: "filterParcelableApis",
    label: "Parcelable 메서드 제외",
    description: "writeToParcel, describeContents, createFromParcel을 제외합니다",
  },
  {
    key: "filterBinderApis",
    label: "Binder 메서드 제외",
    description: "asBinder, onTransact, transact, attachInterface 등을 제외합니다",
  },
  {
    key: "filterObfuscatedMethods",
    label: "난독화 메서드 제외",
    description: "메서드명 길이 ≤ 2인 난독화 의심 메서드를 제외합니다 (기본 off)",
  },
];
