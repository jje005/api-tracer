// 전역 삭제 진행 상태 스토어 (Zustand)
// Zustand: React Context/Redux 없이 전역 상태 관리 — Java의 Singleton 서비스와 유사
// 페이지 이동 후에도 삭제 진행 상태를 유지하기 위해 사용
import { create } from "zustand";

export interface DeletionTask {
  id: string;       // 고유 작업 ID (모듈/프로젝트 ID)
  label: string;    // 표시 레이블 (예: "모듈 'auth-lib' 삭제 중...")
  type: "module" | "project";
}

interface DeletionStore {
  tasks: DeletionTask[];

  /** 삭제 작업 시작 시 등록 */
  addTask: (task: DeletionTask) => void;

  /** 삭제 완료/실패 시 제거 */
  removeTask: (id: string) => void;
}

// create<T>(): Zustand 스토어 생성 — Java의 @Singleton + Observable 조합과 유사
export const useDeletionStore = create<DeletionStore>((set) => ({
  tasks: [],

  addTask: (task) =>
    set((state) => ({
      // 중복 방지: 같은 ID가 이미 있으면 교체
      tasks: [...state.tasks.filter((t) => t.id !== task.id), task],
    })),

  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    })),
}));
