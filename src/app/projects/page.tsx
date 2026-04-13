// 프로젝트 관리 페이지 — 이름 수정, 삭제
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FolderOpen, Pencil, Trash2, Check, X, RefreshCw,
  AlertTriangle, Plus, Boxes, FileCode2, BarChart3, Calendar,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  moduleCount: number;
  totalApiCount: number;
  // API에서 추가된 필드 — 커버리지 % 및 마지막 파싱 날짜
  // TypeScript: 인터페이스는 Java의 DTO 클래스와 유사하나 런타임 오버헤드 없음
  coveragePercent: number;
  lastParsedAt: string | null;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // 이름 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // 삭제 확인 상태
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 새 프로젝트 생성
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── 이름 수정 ─────────────────────────────────────────────────
  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setEditName(p.name);
    setDeleteConfirmId(null);
  };

  const handleRename = async (projectId: string) => {
    if (!editName.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, name: editName.trim() } : p));
        setEditingId(null);
      }
    } finally {
      setRenaming(false);
    }
  };

  // ── 프로젝트 삭제 ─────────────────────────────────────────────
  const handleDelete = async (projectId: string) => {
    setDeletingId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        setDeleteConfirmId(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  // ── 새 프로젝트 생성 ──────────────────────────────────────────
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        setShowCreate(false);
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">프로젝트 관리</h2>
          <p className="text-muted-foreground mt-1">프로젝트 이름 수정 및 삭제</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setDeleteConfirmId(null); setEditingId(null); }}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm"
        >
          <Plus size={14} /> 새 프로젝트
        </button>
      </div>

      {/* 새 프로젝트 생성 폼 */}
      {showCreate && (
        <div className="rounded-lg border p-4 flex gap-2">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            placeholder="프로젝트 이름"
            className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button onClick={handleCreate} disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">
            {creating ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            생성
          </button>
          <button onClick={() => setShowCreate(false)}
            className="px-3 py-2 rounded-md border text-sm hover:bg-accent">
            <X size={13} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw size={14} className="animate-spin" /> 로딩 중...
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <FolderOpen size={36} className="mx-auto mb-3 opacity-40" />
          <p>프로젝트가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="rounded-lg border p-4 space-y-3">
              {/* 프로젝트 헤더 */}
              <div className="flex items-center justify-between gap-3">
                {editingId === p.id ? (
                  // 이름 편집 모드
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(p.id); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 border rounded-md px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button onClick={() => handleRename(p.id)} disabled={renaming}
                      className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      {renaming ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-md border hover:bg-accent">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  // 표시 모드
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderOpen size={16} className="text-muted-foreground shrink-0" />
                    <span className="font-semibold truncate">{p.name}</span>
                  </div>
                )}

                {editingId !== p.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(p)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="이름 수정">
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(deleteConfirmId === p.id ? null : p.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="프로젝트 삭제">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* 통계 */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Boxes size={11} /> 모듈 {p.moduleCount}개
                </span>
                <span className="flex items-center gap-1">
                  <FileCode2 size={11} /> API {p.totalApiCount}개
                </span>
                {/* 마지막 파싱 날짜: null이면 표시하지 않음 */}
                {p.lastParsedAt && (
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {/* ISO 문자열을 한국 날짜 형식으로 변환 */}
                    {new Date(p.lastParsedAt).toLocaleDateString("ko-KR")} 파싱
                  </span>
                )}
              </div>

              {/* 커버리지 게이지 — totalApiCount > 0일 때만 표시 */}
              {p.totalApiCount > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <BarChart3 size={11} /> 커버리지
                    </span>
                    <span className={`font-semibold ${
                      p.coveragePercent >= 80 ? "text-green-600"
                      : p.coveragePercent >= 50 ? "text-yellow-600"
                      : "text-red-500"
                    }`}>
                      {p.coveragePercent}%
                    </span>
                  </div>
                  {/* 진행률 바: h-1.5 + rounded 스타일 */}
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        p.coveragePercent >= 80 ? "bg-green-500"
                        : p.coveragePercent >= 50 ? "bg-yellow-500"
                        : "bg-red-400"
                      }`}
                      style={{ width: `${p.coveragePercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 바로가기 버튼 영역 */}
              {/* Link: next/link — 클라이언트 사이드 네비게이션 (Java의 href와 다르게 풀 리로드 없음) */}
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href="/modules"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs hover:bg-accent transition-colors"
                >
                  <Boxes size={11} /> 모듈 목록
                </Link>
                <Link
                  href={`/coverage`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs hover:bg-accent transition-colors"
                >
                  <BarChart3 size={11} /> 커버리지
                </Link>
              </div>

              {/* 삭제 확인 인라인 */}
              {deleteConfirmId === p.id && (
                <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertTriangle size={14} />
                    <span className="font-medium">프로젝트를 삭제하면 모든 모듈, API, 버전 데이터가 삭제됩니다.</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs hover:opacity-90 disabled:opacity-50">
                      {deletingId === p.id ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      {deletingId === p.id ? "삭제 중..." : "삭제 확인"}
                    </button>
                    <button onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1.5 rounded-md border text-xs hover:bg-accent">
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => router.push("/upload")}
        className="text-sm text-muted-foreground hover:text-foreground underline"
      >
        ← 파일 업로드로 돌아가기
      </button>
    </div>
  );
}
