// 제외 규칙 전역 동기화 스토어 (Zustand)
// ApiExplorer(모듈 상세)와 ExcludeRulesPanel(업로드 페이지)이 서로 다른 페이지에 있어
// 직접적인 prop 전달이 불가능 — Zustand로 변경 이벤트를 공유
//
// [Java 비교] Java의 Observer 패턴 / EventBus와 유사
// 규칙이 추가/삭제될 때마다 해당 projectId의 version을 증가시켜
// 구독 컴포넌트들이 re-fetch 하도록 트리거
import { create } from "zustand";

interface ExcludeRulesStore {
  // projectId → 변경 카운터 (숫자가 바뀌면 해당 프로젝트 규칙이 변경됨)
  // Record<string, number>: Java의 Map<String, Integer>와 동일
  versions: Record<string, number>;

  /**
   * 특정 프로젝트의 제외 규칙이 변경되었음을 알림
   * 구독 중인 ExcludeRulesPanel이 자동으로 re-fetch
   */
  notifyChanged: (projectId: string) => void;

  /**
   * 현재 버전 값 반환 (ExcludeRulesPanel의 useEffect dep으로 사용)
   */
  getVersion: (projectId: string) => number;
}

export const useExcludeRulesStore = create<ExcludeRulesStore>((set, get) => ({
  versions: {},

  notifyChanged: (projectId) =>
    set((state) => ({
      versions: {
        ...state.versions,
        // 기존 값 +1, 없으면 1로 초기화
        [projectId]: (state.versions[projectId] ?? 0) + 1,
      },
    })),

  getVersion: (projectId) => get().versions[projectId] ?? 0,
}));
