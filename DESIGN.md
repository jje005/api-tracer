# AAR/JAR API 커버리지 분석 웹 — 설계 문서

> 최종 업데이트: 2026-04-07

---

## 1. 프로젝트 개요

AAR/JAR 파일을 업로드하면 내부 Public API를 자동 파싱·목록화하고,
개발된 TC(Test Case) 소스코드를 분석하여 API 커버리지를 시각화한다.
버전 간 API 변경사항(추가/삭제/변경) 비교 및 AI 기반 TC 추천도 제공한다.

### 핵심 Pain Point 해결
| 문제 | 솔루션 |
|------|--------|
| 사람이 직접 AAR/JAR 파싱 → API 누락 | 자동 파싱으로 100% API 목록화 |
| TC 작성 누락 여부 수동 확인 | 커버리지 리포트 자동 생성 |
| 버전 업데이트 시 변경 API 추적 불가 | 버전 간 Diff 비교 뷰 제공 |
| 추가할 TC 파악 어려움 | AI 기반 TC 추천 |

---

## 2. 기술 스택

| 분류 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Next.js 14+ (App Router) | 서버 액션으로 대용량 파일 처리 |
| 언어 | TypeScript | 타입 안전성 |
| UI | Tailwind CSS + Shadcn UI | 빠른 UI 구성 |
| 상태 관리 | Zustand | 경량 전역 상태 |
| DB | PostgreSQL + Prisma ORM | 버전 관리·복잡 쿼리 대응 |
| JAR 파싱 | `java-class-tools` (npm) | Node.js 바이트코드 직접 파싱 |
| TC 파싱 | 정규식 + AST 텍스트 분석 | Java/Kotlin 메서드 호출 추출 |
| AI 추천 | Anthropic Claude API | TC 추천 문장 생성 |
| 차트 | Recharts | 커버리지 시각화 |
| 파일 저장 | 로컬 파일시스템 (추후 S3 대응) | 업로드 파일 원본 보관 |

---

## 3. 시스템 아키텍처

```
┌────────────────────────────────────────────────────────────────┐
│                       Next.js 14 App                           │
│                                                                │
│  ┌──────────────────────┐    ┌─────────────────────────────┐  │
│  │     Frontend          │    │        API Routes            │  │
│  │  (React, App Router)  │    │                             │  │
│  │                       │◄──►│  /api/upload/aar-jar        │  │
│  │  Pages:               │    │  /api/modules               │  │
│  │  - Dashboard          │    │  /api/modules/[id]/apis     │  │
│  │  - Upload             │    │  /api/versions              │  │
│  │  - Modules            │    │  /api/versions/diff         │  │
│  │  - Coverage           │    │  /api/tc/upload             │  │
│  │  - Version Diff       │    │  /api/tc/analyze            │  │
│  │  - Recommendations    │    │  /api/coverage              │  │
│  │                       │    │  /api/recommendations       │  │
│  │  Zustand Stores       │    └──────────────┬──────────────┘  │
│  └──────────────────────┘                   │                  │
│                                    ┌─────────▼──────────┐      │
│                                    │   Service Layer     │      │
│                                    │                    │      │
│                                    │ JarParserService   │      │
│                                    │ TcAnalyzerService  │      │
│                                    │ DiffService        │      │
│                                    │ CoverageService    │      │
│                                    │ AiRecommendService │      │
│                                    │ [SpreadsheetService]│     │
│                                    │  (확장 예정)        │      │
│                                    └─────────┬──────────┘      │
│                                              │                  │
│                                    ┌─────────▼──────────┐      │
│                                    │  PostgreSQL (Prisma)│      │
│                                    └────────────────────┘      │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. 데이터 모델 (DB Schema)

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Project    │       │     Module       │       │    ApiEntry      │
│──────────────│       │──────────────────│       │──────────────────│
│ id           │──┐    │ id               │──┐    │ id               │
│ name         │  └───►│ projectId        │  └───►│ moduleId         │
│ description  │       │ name             │       │ className        │
│ createdAt    │       │ type(AAR/JAR)    │       │ methodName       │
└──────────────┘       │ createdAt        │       │ params (JSON)    │
                       └──────────────────┘       │ returnType       │
                                                  │ accessModifier   │
                                                  │ isStatic         │
                                                  │ isDeprecated     │
                                                  └──────────────────┘
                                                          │
┌──────────────────┐       ┌──────────────────┐          │
│  ModuleVersion   │       │   ApiSnapshot    │          │
│──────────────────│       │──────────────────│          │
│ id               │──┐    │ id               │          │
│ moduleId         │  └───►│ moduleVersionId  │          │
│ version (string) │       │ apiEntryId       │◄─────────┘
│ filePath         │       │ changeType       │
│ uploadedAt       │       │ (ADDED/REMOVED/  │
└──────────────────┘       │  MODIFIED/SAME)  │
                           └──────────────────┘

┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  TestSuite   │       │    TestCase      │       │    Coverage      │
│──────────────│       │──────────────────│       │──────────────────│
│ id           │──┐    │ id               │       │ id               │
│ name         │  └───►│ suiteId          │──┐    │ apiEntryId       │
│ language     │       │ name             │  └───►│ testCaseId       │
│ (JAVA/KOTLIN)│       │ filePath         │       │ status           │
│ uploadedAt   │       │ content          │       │ (COVERED/PARTIAL/│
└──────────────┘       │ calledApis(JSON) │       │  UNCOVERED)      │
                       └──────────────────┘       └──────────────────┘

┌──────────────────────┐
│   Recommendation     │
│──────────────────────│
│ id                   │
│ apiEntryId           │
│ suggestedTestName    │
│ scenario             │
│ reasoning            │
│ generatedAt          │
└──────────────────────┘

-- 확장 예정 (Phase N) --
┌──────────────────────┐
│  PropertySpec        │  ← 엑셀 Property 명세서 파싱 대응
│──────────────────────│
│ id                   │
│ moduleId             │
│ propertyName         │
│ type                 │
│ description          │
│ sourceFile           │  ← 원본 엑셀 파일 경로
└──────────────────────┘
```

---

## 5. 파싱 전략

### 5-1. AAR/JAR 파싱

```
[AAR 업로드]
  └─ ZIP 해제
      └─ classes.jar 추출
          └─ .class 파일 목록
              └─ java-class-tools로 바이트코드 파싱
                  └─ public 메서드: className, methodName, params, returnType
                      └─ DB 저장 (ApiEntry + ApiSnapshot)

[JAR 업로드]
  └─ ZIP 해제
      └─ .class 파일 목록
          └─ (이하 동일)
```

**추출 대상 정보:**
- `public` / `public static` 메서드
- 메서드 파라미터 타입 목록
- 반환 타입
- `@Deprecated` 어노테이션 여부

### 5-2. TC 파싱 (Java/Kotlin)

```
[TC 소스 업로드 (.java / .kt)]
  └─ 파일 텍스트 읽기
      └─ 정규식 패턴 매칭
          └─ 메서드 호출 패턴: SomeClass.methodName(...)
              └─ DB의 ApiEntry와 매핑
                  └─ Coverage 레코드 생성
```

**매핑 방식:**
1. TC 내 `클래스명.메서드명` 패턴 추출
2. ApiEntry 테이블에서 `className + methodName` 으로 조회
3. 매칭되면 `COVERED`, 일부만 매칭되면 `PARTIAL`

### 5-3. Property 명세서 파싱 (확장 예정)

```
[엑셀(.xlsx) 업로드]          ← Phase N에서 구현
  └─ SheetJS(xlsx) 파싱
      └─ 컬럼 매핑 설정 UI
          └─ PropertySpec 테이블 저장
              └─ API 목록과 교차 분석
```

서비스 레이어에 `SpreadsheetService` 인터페이스만 정의해두고,
실제 구현은 추후 추가. 라우트도 `/api/upload/spec` 예약.

---

## 6. 버전 비교 (Diff) 설계

### 버전 관리 구조

```
Module (name: "core-sdk")
  ├─ ModuleVersion (version: "1.0.0", uploadedAt: 2026-01-01)
  │    └─ ApiSnapshot × N  (changeType: SAME or ADDED ...)
  └─ ModuleVersion (version: "1.1.0", uploadedAt: 2026-04-07)
       └─ ApiSnapshot × N  (changeType: ADDED/REMOVED/MODIFIED/SAME)
```

### Diff 알고리즘

```
두 ModuleVersion (v_old, v_new) 비교:

1. v_old의 ApiEntry 목록 → Map<signature, ApiEntry>
   (signature = className + "." + methodName + "(" + params + ")")

2. v_new의 ApiEntry 목록 순회:
   - signature가 Map에 없음 → ADDED
   - signature가 있고 returnType 동일 → SAME
   - signature가 있고 returnType 변경 → MODIFIED

3. Map에 남은 항목 → REMOVED

결과: ApiSnapshot에 changeType 저장
```

### Diff UI

```
┌──────────────────────────────────────────────────────────┐
│  core-sdk  v1.0.0  ──►  v1.1.0  비교                     │
├──────────────────────────────────────────────────────────┤
│  [+ 3 추가]  [- 1 삭제]  [~ 2 변경]  [= 47 동일]         │
├──────────────────────────────────────────────────────────┤
│  + DeviceManager.getSerialNumber() : String              │
│  + DeviceManager.getBatteryLevel() : int                 │
│  + NetworkManager.ping(String host) : boolean            │
│  - AudioManager.setVolume(int) : void  ← 삭제됨          │
│  ~ Config.getTimeout() : int → long   ← 반환타입 변경     │
│  ~ Config.init(Context) → init(Context, boolean)         │
└──────────────────────────────────────────────────────────┘
```

---

## 7. 페이지 구조 (App Router)

```
app/
├── page.tsx                        # 대시보드 (요약 통계 카드)
│
├── upload/
│   └── page.tsx                    # AAR/JAR 파일 업로드 + 버전 입력
│
├── modules/
│   ├── page.tsx                    # 전체 모듈 목록
│   └── [moduleId]/
│       ├── page.tsx                # 모듈 상세 + API 테이블
│       └── versions/
│           └── page.tsx            # 버전 목록 + Diff 선택
│
├── diff/
│   └── page.tsx                    # 두 버전 선택 → API Diff 뷰
│
├── tc/
│   ├── page.tsx                    # TC 파일 업로드 + 목록
│   └── [tcId]/
│       └── page.tsx                # TC 상세 + 커버된 API 목록
│
├── coverage/
│   └── page.tsx                    # 전체 커버리지 리포트
│
└── recommendations/
    └── page.tsx                    # AI TC 추천 목록
```

---

## 8. API Routes

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/upload/aar-jar` | AAR/JAR 업로드 + 파싱 + DB 저장 |
| GET | `/api/modules` | 모듈 목록 조회 |
| GET | `/api/modules/[id]` | 모듈 상세 (최신 버전 API 목록) |
| GET | `/api/modules/[id]/versions` | 버전 목록 |
| GET | `/api/diff?v1=&v2=` | 두 버전 Diff 결과 |
| POST | `/api/tc/upload` | TC 소스 업로드 + 파싱 |
| GET | `/api/tc` | TC 목록 |
| POST | `/api/coverage/analyze` | 전체 커버리지 재계산 |
| GET | `/api/coverage` | 커버리지 리포트 |
| POST | `/api/recommendations` | 미커버 API → AI TC 추천 생성 |
| GET | `/api/recommendations` | 추천 목록 조회 |
| POST | `/api/upload/spec` | (예약) 엑셀 명세서 업로드 |

---

## 9. Zustand Store 구조

```typescript
uploadStore     // 업로드 진행 상태, 파싱 로그
moduleStore     // 모듈/API 목록 캐시, 선택 상태
diffStore       // 비교할 버전 선택, Diff 결과 캐시
coverageStore   // 커버리지 데이터, 필터 상태
tcStore         // TC 목록, 선택 상태
filterStore     // 검색어, 필터 (changeType, status 등)
```

---

## 10. 개발 단계 (Phases)

### Phase 1 — 기반 + AAR/JAR 파싱 (MVP)
- [ ] Next.js 14 프로젝트 초기화 (TypeScript + Tailwind + Shadcn)
- [ ] PostgreSQL + Prisma 설정 및 Schema 마이그레이션
- [ ] AAR/JAR 업로드 + 파싱 서비스 구현
- [ ] 모듈/API 목록 UI

### Phase 2 — 버전 관리 + Diff
- [ ] 버전 업로드 시 ModuleVersion 생성
- [ ] Diff 알고리즘 구현 (DiffService)
- [ ] Diff 비교 UI (추가/삭제/변경 색상 구분)

### Phase 3 — TC 분석 + 커버리지
- [ ] TC 소스 업로드 + 파싱 (Java/Kotlin)
- [ ] API ↔ TC 매핑 로직
- [ ] 커버리지 리포트 UI (Recharts)

### Phase 4 — AI TC 추천
- [ ] Claude API 연동
- [ ] 미커버 API → 추천 TC 생성 프롬프트 설계
- [ ] 추천 결과 카드 UI

### Phase N — 엑셀 명세서 파싱 (확장)
- [ ] SpreadsheetService 구현 (SheetJS)
- [ ] 컬럼 매핑 설정 UI
- [ ] PropertySpec → API 목록 교차 분석

---

## 11. 디렉토리 구조 (예정)

```
TsStudy/
├── app/                        # Next.js App Router 페이지
├── components/
│   ├── upload/                 # FileDropzone, UploadProgress
│   ├── modules/                # ModuleCard, ApiTable
│   ├── diff/                   # DiffTable, ChangeTypeBadge
│   ├── coverage/               # CoverageBar, CoverageMatrix
│   ├── tc/                     # TcCard, CalledApiList
│   ├── recommendations/        # TcSuggestionCard
│   └── ui/                     # Shadcn 공용 컴포넌트
├── lib/
│   ├── services/
│   │   ├── jarParserService.ts
│   │   ├── tcAnalyzerService.ts
│   │   ├── diffService.ts
│   │   ├── coverageService.ts
│   │   ├── aiRecommendService.ts
│   │   └── spreadsheetService.ts  ← 인터페이스만 정의 (Phase N)
│   ├── prisma.ts               # Prisma Client 싱글톤
│   └── utils.ts
├── stores/                     # Zustand stores
├── prisma/
│   └── schema.prisma           # DB 스키마
├── public/
├── DESIGN.md                   # 이 문서
└── CLAUDE.md
```
