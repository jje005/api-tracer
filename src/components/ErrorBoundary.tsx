"use client";

// React Error Boundary — 하위 컴포넌트 트리에서 발생한 에러를 잡아 폴백 UI를 표시
// Java의 try-catch와 유사하지만 컴포넌트 단위로 동작
// React 클래스 컴포넌트로만 구현 가능 (함수형 컴포넌트는 Error Boundary 불가)
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** 에러 발생 시 표시할 폴백 UI (기본값: 내장 에러 카드) */
  fallback?: ReactNode;
  /** 에러 발생 시 추가 처리 콜백 (로깅 등) */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    // Java의 필드 초기화와 동일 — TypeScript는 생성자에서 state 초기화
    this.state = { hasError: false, error: null };
  }

  /**
   * 렌더링 중 에러 발생 시 호출 — 폴백 UI로 전환
   * Java의 catch 블록과 유사: static이므로 상태 변경만 가능
   */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * 에러 세부 정보 처리 — 로깅, 에러 리포팅 서비스 연동 가능
   * getDerivedStateFromError와 달리 side effect 허용
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] 컴포넌트 에러 발생:", error.message);
    console.error("[ErrorBoundary] 컴포넌트 스택:", errorInfo.componentStack);
    this.props.onError?.(error, errorInfo);
  }

  /** 에러 상태 초기화 — "다시 시도" 버튼 클릭 시 호출 */
  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // 커스텀 폴백이 있으면 우선 사용
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 폴백 UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 rounded-lg border border-red-200 bg-red-50">
          <div className="text-red-500 text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-semibold text-red-700 mb-1">
            오류가 발생했습니다
          </h3>
          <p className="text-sm text-red-600 text-center mb-4 max-w-md">
            {this.state.error?.message ?? "알 수 없는 오류가 발생했습니다."}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 페이지 전체를 감싸는 풀스크린 에러 폴백
 * 대시보드, 목록 페이지처럼 전체 내용이 날아가면 안 되는 경우에 사용
 */
export function PageErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-5xl">⚠️</div>
      <h2 className="text-xl font-bold text-gray-800">페이지를 불러올 수 없습니다</h2>
      <p className="text-sm text-gray-500 max-w-md text-center">{error.message}</p>
      <button
        onClick={reset}
        className="mt-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
      >
        다시 시도
      </button>
    </div>
  );
}
