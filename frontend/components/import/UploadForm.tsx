"use client";

import { useRef, useState } from "react";

interface UploadFormProps {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

export default function UploadForm({ onUpload, disabled }: UploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("รองรับเฉพาะไฟล์ .xlsx เท่านั้น");
      return;
    }
    setSelectedFile(file);
  }

  async function handleUploadClick() {
    if (!selectedFile) return;
    setIsUploading(true);
    setError(null);
    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          isDragging ? "border-zinc-900 bg-zinc-50" : "border-zinc-300"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <p className="text-sm font-medium text-zinc-700">
          {selectedFile ? selectedFile.name : "ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์"}
        </p>
        <p className="text-xs text-zinc-400">รองรับไฟล์ .xlsx เท่านั้น ขนาดไม่เกิน 20MB</p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!selectedFile || isUploading || disabled}
          onClick={() => void handleUploadClick()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "กำลังนำเข้า..." : "นำเข้าไฟล์"}
        </button>
      </div>
    </div>
  );
}
