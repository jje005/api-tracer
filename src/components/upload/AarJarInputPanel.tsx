// AAR/JAR 입력 패널 — 경로 직접 입력 탭 + 파일 직접 선택 탭 통합
// 두 가지 방식으로 파일을 지정할 수 있음:
//   1. 경로 탭: 서버 파일시스템 경로 입력 → /api/parse/aar-jar 사용
//   2. 파일 탭: OS 파일 대화상자로 파일 선택 → /api/upload/aar-jar (FormData) 사용
"use client";

import { useState, useRef, useCallback } from "react";
import { FolderOpen, Upload, File, X } from "lucide-react";
import { PathInputForm } from "./PathInputForm";
import { formatFileSize } from "@/lib/utils";

// ─── 타입 정의 ────────────────────────────────────────────────
// 부모 컴포넌트로 전달할 입력 결과
// TypeScript의 discriminated union 패턴: mode 값으로 타입을 구분
// Java의 sealed class / instanceof 패턴과 유사한 개념
export type AarJarInput =
  | {
      mode: "path";
      dirPath: string;
      fileName?: string; // 특정 파일 지정 (폴더 내 여러 파일 중 하나)
      files: Array<{ fileName: string; sizeBytes: number }>;
    }
  | {
      mode: "file";
      fileObject: File; // Web API File 객체 — 브라우저에서만 존재
      files: Array<{ fileName: string; sizeBytes: number }>;
    };

type InputMode = "path" | "file";

interface AarJarInputPanelProps {
  // onInput: 입력이 확정될 때 호출 (경로 검증 완료 또는 파일 선택 시)
  onInput: (input: AarJarInput) => void;
}

export function AarJarInputPanel({ onInput }: AarJarInputPanelProps) {
  const [mode, setMode] = useState<InputMode>("path");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // useRef: DOM 요소에 직접 접근 (Java의 getElementById와 유사, 렌더링과 무관)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 경로 탭: PathInputForm validated 콜백
  const handlePathValidated = useCallback(
    (dirPath: string, files: Array<{ fileName: string; sizeBytes: number }>) => {
      console.log(`[AarJarInputPanel] 경로 검증 완료: ${dirPath}, 파일 ${files.length}개`);
      onInput({ mode: "path", dirPath, files, fileName: files[0]?.fileName });
    },
    [onInput]
  );

  // 파일 탭: 파일 객체를 받아 부모에게 전달
  const handleFileSelect = useCallback(
    (file: File) => {
      // 확장자 검증 (.aar, .jar만 허용)
      if (!/\.(aar|jar)$/i.test(file.name)) {
        alert(".aar 또는 .jar 파일만 선택할 수 있습니다");
        return;
      }
      console.log(`[AarJarInputPanel] 파일 선택: ${file.name} (${file.size} bytes)`);
      setSelectedFile(file);
      onInput({
        mode: "file",
        fileObject: file,
        files: [{ fileName: file.name, sizeBytes: file.size }],
      });
    },
    [onInput]
  );

  // <input type="file"> change 이벤트
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    // input value 초기화: 같은 파일 재선택 시에도 onChange 발생하도록
    e.target.value = "";
  };

  // 드래그 앤 드롭
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  // 탭 전환 시 선택 파일 초기화
  const switchMode = (newMode: InputMode) => {
    setMode(newMode);
    if (newMode !== "file") setSelectedFile(null);
  };

  return (
    <div className="space-y-3">
      {/* ── 탭 버튼 ───────────────────────────────────────────── */}
      {/* bg-muted로 탭 컨테이너를 감싸고 선택된 탭은 bg-background + shadow */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => switchMode("path")}
          className={[
            "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-colors",
            mode === "path"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <FolderOpen size={14} />
          경로 직접 입력
        </button>
        <button
          type="button"
          onClick={() => switchMode("file")}
          className={[
            "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-colors",
            mode === "file"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <Upload size={14} />
          파일 직접 선택
        </button>
      </div>

      {/* ── 탭 콘텐츠 ─────────────────────────────────────────── */}
      {mode === "path" ? (
        // 탭 1: 경로 입력 (기존 PathInputForm 재사용)
        <PathInputForm type="AAR_JAR" onValidated={handlePathValidated} />
      ) : (
        // 탭 2: OS 파일 대화상자 + 드래그 앤 드롭
        <div>
          {/* 숨겨진 file input — accept로 확장자 제한 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".aar,.jar"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* 드롭존 / 파일 선택 영역 */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={[
              "cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
              isDragOver
                ? "border-primary bg-primary/5"
                : selectedFile
                ? "border-green-400 bg-green-50"
                : "border-border hover:border-primary/50 hover:bg-muted/50",
            ].join(" ")}
          >
            {selectedFile ? (
              // 파일 선택 완료 상태
              <div className="flex items-center justify-center gap-3">
                <File size={24} className="text-green-600 shrink-0" />
                <div className="text-left min-w-0">
                  <p className="font-medium text-sm text-green-700 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
                {/* X 버튼: 파일 선택 해제 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // 클릭 이벤트가 드롭존까지 전파되지 않도록
                    setSelectedFile(null);
                  }}
                  className="ml-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              // 파일 미선택 상태
              <div>
                <Upload size={28} className="mx-auto text-muted-foreground mb-2 opacity-60" />
                <p className="text-sm font-medium">클릭하거나 파일을 여기에 끌어다 놓으세요</p>
                <p className="text-xs text-muted-foreground mt-1">.aar, .jar 파일만 허용</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
