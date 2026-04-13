# API Tracer

AAR/JAR-based Android API coverage tracking tool built with Next.js and Prisma.

Android SDK 모듈(AAR/JAR)의 Public API를 파싱하고, 테스트 케이스(TC)와의 커버리지를 분석하는 웹 기반 도구입니다.

---

## 주요 기능

- **AAR/JAR 파싱** — 경로 지정 또는 파일 업로드로 Public API 자동 추출
- **버전 관리** — 동일 모듈의 다중 버전 관리 및 버전 간 API 변경 Diff
- **TC 커버리지 분석** — Java/Kotlin TC 폴더를 스캔하여 API 커버리지 자동 계산
- **커버리지 리포트** — 클래스·메서드 단위 커버리지 시각화 및 CSV 내보내기
- **파싱 옵션** — Enum·Annotation·Parcelable·Binder API 필터링, 난독화 메서드 제외
- **제외 규칙** — 프로젝트별 클래스/메서드 제외 규칙 관리
- **프로젝트 관리** — 여러 모듈을 프로젝트 단위로 그룹핑

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL + Prisma ORM |
| UI | Tailwind CSS + Shadcn UI |
| State | Zustand |

---

## 시작하기

### 사전 요구사항

- Node.js 18+
- PostgreSQL

### 설치

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에서 DATABASE_URL 설정

# DB 마이그레이션
npx prisma migrate deploy
npx prisma generate

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### 환경변수

```env
# .env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"

# TC 추천 기능 사용 시 (선택)
ANTHROPIC_API_KEY="sk-ant-..."
```

---

## 프로젝트 구조

```
src/
├── app/                  # Next.js App Router 페이지 및 API Route
│   ├── api/              # REST API 엔드포인트
│   ├── modules/          # 모듈 목록 및 상세
│   ├── coverage/         # 커버리지 리포트
│   ├── diff/             # 버전 비교
│   ├── tc/               # TC 관리
│   └── recommendations/  # TC 추천
├── components/           # React 컴포넌트
└── lib/
    ├── services/         # 비즈니스 로직 (파싱, 커버리지 계산)
    ├── stores/           # Zustand 상태 관리
    └── prisma.ts         # Prisma 클라이언트

prisma/
├── schema.prisma         # DB 스키마
└── migrations/           # 마이그레이션 이력
```

---

## 사용 흐름

```
1. 프로젝트 생성 (/projects)
2. AAR/JAR 업로드 또는 경로 등록 (/upload)
3. TC 폴더 경로 등록 (/tc)
4. 커버리지 확인 (/coverage)
5. 미커버 API 확인 후 추가 TC 작성
```

---

## 라이선스

MIT
