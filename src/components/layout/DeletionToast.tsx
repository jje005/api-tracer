// 전역 삭제 진행 알림 바 — 페이지 이동 후에도 하단에 고정 표시
"use client";

import { useDeletionStore } from "@/lib/stores/deletionStore";
import { RefreshCw, X } from "lucide-react";

/**
 * 삭제 진행 중인 작업이 있을 때 화면 하단에 고정 표시되는 토스트 바.
 * layout.tsx에서 렌더링되므로 페이지 이동과 무관하게 유지된다.
 */
export function DeletionToast() {
  const { tasks, removeTask } = useDeletionStore();

  // 진행 중인 작업이 없으면 렌더링하지 않음
  if (tasks.length === 0) return null;

  return (
    // fixed: 뷰포트 기준 고정 위치 — 스크롤/페이지 이동에 영향 없음
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-background shadow-lg"
        >
          {/* 스피너 아이콘 */}
          <RefreshCw size={14} className="animate-spin text-muted-foreground shrink-0" />

          {/* 작업 레이블 */}
          <span className="text-sm flex-1">{task.label}</span>

          {/* 수동 닫기 버튼 (오류 발생 등으로 상태가 남아있을 때) */}
          <button
            onClick={() => removeTask(task.id)}
            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="알림 닫기"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
