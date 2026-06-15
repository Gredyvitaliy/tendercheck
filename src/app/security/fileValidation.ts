export const PDF_MAX_SIZE_BYTES = 100 * 1024 * 1024;
export const EXCEL_MAX_SIZE_BYTES = 50 * 1024 * 1024;

export type FileValidationErrorCode =
  | "FILE_EMPTY"
  | "FILE_NAME_INVALID"
  | "PDF_EXTENSION_INVALID"
  | "PDF_MIME_INVALID"
  | "PDF_SIZE_EXCEEDED"
  | "PDF_SIGNATURE_INVALID"
  | "EXCEL_EXTENSION_INVALID"
  | "EXCEL_SIZE_EXCEEDED";

export class FileValidationError extends Error {
  constructor(
    public readonly code: FileValidationErrorCode,
    public readonly details: string
  ) {
    super(details);
    this.name = "FileValidationError";
  }
}

export interface ValidatedFileMetadata {
  normalizedName: string;
  size: number;
  mimeType: string;
}

export interface ValidatedPdfFile extends ValidatedFileMetadata {
  data: Uint8Array;
}

const PDF_SIGNATURE = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

export const normalizeFileName = (name: string): string => {
  const normalized = name.normalize("NFC").trim();
  const segments = normalized.split(/[\\/]/);
  return segments.at(-1)?.trim() ?? "";
};

const validateCommonFile = (file: File): ValidatedFileMetadata => {
  const normalizedName = normalizeFileName(file.name);

  if (!normalizedName || normalizedName === "." || normalizedName === "..") {
    throw new FileValidationError(
      "FILE_NAME_INVALID",
      "Filename is invalid"
    );
  }

  if (file.size === 0) {
    throw new FileValidationError("FILE_EMPTY", "File is empty");
  }

  return {
    normalizedName,
    size: file.size,
    mimeType: file.type.toLowerCase(),
  };
};

const hasPdfSignature = (data: Uint8Array): boolean =>
  PDF_SIGNATURE.every((byte, index) => data[index] === byte);

export const validatePdfFile = async (
  file: File
): Promise<ValidatedPdfFile> => {
  const metadata = validateCommonFile(file);

  if (!metadata.normalizedName.toLowerCase().endsWith(".pdf")) {
    throw new FileValidationError(
      "PDF_EXTENSION_INVALID",
      "PDF file must use the .pdf extension"
    );
  }

  if (
    metadata.mimeType !== "" &&
    metadata.mimeType !== "application/pdf"
  ) {
    throw new FileValidationError(
      "PDF_MIME_INVALID",
      "PDF MIME type must be application/pdf or empty"
    );
  }

  if (metadata.size > PDF_MAX_SIZE_BYTES) {
    throw new FileValidationError(
      "PDF_SIZE_EXCEEDED",
      "PDF file exceeds the 100 MB limit"
    );
  }

  const data = new Uint8Array(await file.arrayBuffer());

  if (!hasPdfSignature(data)) {
    throw new FileValidationError(
      "PDF_SIGNATURE_INVALID",
      "PDF signature is invalid"
    );
  }

  return { ...metadata, data };
};

export const validateExcelFile = (file: File): ValidatedFileMetadata => {
  const metadata = validateCommonFile(file);
  const lowerName = metadata.normalizedName.toLowerCase();

  if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
    throw new FileValidationError(
      "EXCEL_EXTENSION_INVALID",
      "Excel file must use the .xlsx or .xls extension"
    );
  }

  if (metadata.size > EXCEL_MAX_SIZE_BYTES) {
    throw new FileValidationError(
      "EXCEL_SIZE_EXCEEDED",
      "Excel file exceeds the 50 MB limit"
    );
  }

  return metadata;
};
