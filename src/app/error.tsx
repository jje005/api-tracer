"use client";

// Next.js App Router 글로벌 에러 페이지
// 서버 컴포넌트에서 throw된 에러를 잡아 표시
// Java Spring의 @ControllerAdvice + @ExceptionHandler와 유사한 역할
// "use client" 필수 — error.tsx는 항상 클라이언트 컴포넌트여야 함
import { useEffect } from "react";
import { PageErrorFallback } from "@/components/ErrorBoundary";

interface ErrorPageProps {
  error: Error & { digest?: string }; // digest: Next.js가 서버 에러에 부여하는 고유 ID
  reset: () => void;                   // 세그먼트 재렌더링 트리거
}

/**
 * 글로벌 에러 페이지
 * App Router의 각 route segment에서 처리되지 않은 에러가 여기로 버블링됨
 */
export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // 에러 발생 시 콘솔 로그 (프로덕션에서는 Sentry 등 에러 수집 서비스로 대체)
    console.error("[GlobalError]", error.message, error.digest ? `(digest: ${error.digest})` : "");
  }, [error]);

  return <PageErrorFallback error={error} reset={reset} />;
}
