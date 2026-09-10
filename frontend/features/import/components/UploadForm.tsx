"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { docsUrl } from "@/lib/docs";

export interface UploadFormProps {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

export function UploadForm({ onUpload, disabled }: UploadFormProps) {
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
    <div className="rounded-lg border border-border bg-surface p-6">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
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
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isDragging ? "border-primary bg-surface-subtle" : "border-border"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <p className="text-sm font-medium text-text-primary">
          {selectedFile ? selectedFile.name : "ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์"}
        </p>
        <p className="text-xs text-text-muted">รองรับไฟล์ .xlsx เท่านั้น ขนาดไม่เกิน 20MB</p>
      </div>

      {!selectedFile && (
        <p className="mt-3 text-center text-xs text-text-muted">
          ไม่แน่ใจเรื่องรูปแบบไฟล์หรือขั้นตอน?{" "}
          <a
            href={docsUrl("/tasks/import-monthly-sales")}
            target="_blank"
            rel="noopener"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            ดูคู่มือการนำเข้าข้อมูล
          </a>
        </p>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          disabled={!selectedFile || isUploading || disabled}
          onClick={() => void handleUploadClick()}
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "กำลังตรวจสอบ..." : "ตรวจสอบก่อนนำเข้า"}
        </Button>
      </div>
    </div>
  );
}

export default UploadForm;
