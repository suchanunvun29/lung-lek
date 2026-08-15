import { NextFunction, Request, Response } from "express";
import multer from "multer";

const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    const isXlsxExtension = file.originalname.toLowerCase().endsWith(".xlsx");
    const isXlsxMimeType = file.mimetype === XLSX_MIME_TYPE;
    if (!isXlsxExtension || !isXlsxMimeType) {
      return callback(new Error("Only .xlsx files are supported"));
    }
    callback(null, true);
  },
}).single("file");

export function uploadExcelFile(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${error.message}` });
    }
    if (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid file upload" });
    }
    next();
  });
}
