// 파일 드래그&드롭 업로드 컴포넌트 (클라이언트 컴포넌트)
"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileArchive, X, CheckCircle2, AlertCircle } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

// TypeScript interface로 컴포넌트 Props 정의
// Java의 메서드 파라미터와 달리 컴포넌트에 넘기는 데이터/콜백을 한 곳에 명세
interface FileDropzoneProps {
  onUploadSuccess?: (result: UploadResult) => void;
  projectId: string;
}

interface UploadResult {
  moduleId: string;
  versionId: string;
  totalApis: number;
  newApis: number;
}

// 업로드 상태 타입 (union type)
// Java의 enum과 유사하나 TypeScript에서는 문자열 리터럴 union을 더 자주 사용
type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadState {
  status: UploadStatus;
  progress: number;
  message: string;
  result?: UploadResult;
}

export function FileDropzone({ onUploadSuccess, projectId }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [moduleName, setModuleName] = useState("");
  const [version, setVersion] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    message: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 드래그 이벤트 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  }, []);

  const validateAndSetFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".aar") && !name.endsWith(".jar")) {
      setUploadState({
        status: "error",
        progress: 0,
        message: ".aar 또는 .jar 파일만 업로드 가능합니다",
      });
      return;
    }
    setSelectedFile(file);
    setUploadState({ status: "idle", progress: 0, message: "" });

    // 파일명에서 모듈명/버전 자동 추출 시도
    // ex) "core-sdk-1.2.3.aar" → moduleName: "core-sdk", version: "1.2.3"
    const baseName = file.name.replace(/\.(aar|jar)$/i, "");
    const versionMatch = baseName.match(/[-_](\d+\.\d+[\.\d]*)$/);
    if (versionMatch) {
      setVersion(versionMatch[1]);
      setModuleName(baseName.replace(versionMatch[0], ""));
    } else {
      setModuleName(baseName);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !moduleName.trim() || !version.trim()) return;

    setUploadState({ status: "uploading", progress: 30, message: "파일 업로드 중..." });

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("projectId", projectId);
      formData.append("moduleName", moduleName.trim());
      formData.append("version", version.trim());

      setUploadState({ status: "uploading", progress: 60, message: "AAR/JAR 파싱 중..." });

      const res = await fetch("/api/upload/aar-jar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "업로드 실패");
      }

      setUploadState({
        status: "success",
        progress: 100,
        message: `완료! API ${data.totalApis}개 파싱 (신규 ${data.newApis}개)`,
        result: data,
      });

      onUploadSuccess?.(data);
      console.log("[FileDropzone] 업로드 성공:", data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      console.error("[FileDropzone] 업로드 실패:", msg);
      setUploadState({ status: "error", progress: 0, message: msg });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setModuleName("");
    setVersion("");
    setUploadState({ status: "idle", progress: 0, message: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* 드롭존 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={[
          "relative border-2 border-dashed rounded-lg p-10 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : selectedFile
            ? "border-green-400 bg-green-50"
            : "border-border hover:border-primary/50 cursor-pointer",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".aar,.jar"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) validateAndSetFile(file);
          }}
        />

        {selectedFile ? (
          <div className="space-y-1">
            <FileArchive size={32} className="mx-auto text-green-500" />
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(selectedFile.size)}
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); handleReset(); }}
              className="mt-2 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 mx-auto"
            >
              <X size={12} /> 파일 변경
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload size={32} className="mx-auto text-muted-foreground" />
            <p className="font-medium">AAR / JAR 파일을 드래그하거나 클릭하여 선택</p>
            <p className="text-sm text-muted-foreground">.aar, .jar 파일 지원</p>
          </div>
        )}
      </div>

      {/* 메타 정보 입력 */}
      {selectedFile && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">모듈명</label>
            <input
              type="text"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder="ex) core-sdk"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">버전</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="ex) 1.2.3"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {/* 업로드 상태 */}
      {uploadState.status === "uploading" && (
        <div className="space-y-2">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{uploadState.message}</p>
        </div>
      )}

      {uploadState.status === "success" && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle2 size={16} />
          {uploadState.message}
        </div>
      )}

      {uploadState.status === "error" && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle size={16} />
          {uploadState.message}
        </div>
      )}

      {/* 업로드 버튼 */}
      {selectedFile && uploadState.status !== "success" && (
        <button
          onClick={handleUpload}
          disabled={
            !moduleName.trim() ||
            !version.trim() ||
            uploadState.status === "uploading"
          }
          className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {uploadState.status === "uploading" ? "처리 중..." : "업로드 및 파싱 시작"}
        </button>
      )}
    </div>
  );
}
