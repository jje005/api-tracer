// 모듈 목록에서 사용하는 삭제 버튼 (클라이언트 컴포넌트)
// Link 카드 안에 있지만 클릭 이벤트를 카드 이동과 분리해야 하므로 별도 컴포넌트
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RefreshCw } from "lucide-react";
import { useDeletionStore } from "@/lib/stores/deletionStore";

interface ModuleDeleteButtonProps {
  moduleId: string;
  moduleName: string;
}

export function ModuleDeleteButton({ moduleId, moduleName }: ModuleDeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const { addTask, removeTask } = useDeletionStore();

  const handleDelete = async (e: React.MouseEvent) => {
    // 클릭 이벤트가 부모 Link 컴포넌트로 전파되지 않도록 차단
    // Java Servlet의 event.stopPropagation()과 동일
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`"${moduleName}" 모듈을 삭제하시겠습니까?\n모든 버전, API, 커버리지 데이터가 함께 삭제됩니다.`)) return;

    setDeleting(true);
    // 전역 삭제 진행 등록 — 페이지 이동해도 하단 토스트로 표시됨
    addTask({ id: moduleId, label: `모듈 "${moduleName}" 삭제 중...`, type: "module" });
    console.log(`[ModuleDeleteButton] 삭제 요청: ${moduleId}`);

    try {
      const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "삭제 실패");
        return;
      }
      // 목록 새로고침 (서버 컴포넌트 재요청)
      router.refresh();
    } catch (e) {
      console.error("[ModuleDeleteButton] 삭제 오류:", e);
      alert("삭제 중 오류가 발생했습니다");
    } finally {
      setDeleting(false);
      removeTask(moduleId);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
      title={`${moduleName} 삭제`}
    >
      {deleting
        ? <RefreshCw size={15} className="animate-spin" />
        : <Trash2 size={15} />
      }
    </button>
  );
}
