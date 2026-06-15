import assert from "node:assert/strict";
import test from "node:test";

import {
  EXCEL_MAX_SIZE_BYTES,
  FileValidationError,
  PDF_MAX_SIZE_BYTES,
  normalizeFileName,
  validateExcelFile,
  validatePdfFile,
} from "./fileValidation";

const pdfFile = (
  contents: BlobPart[] = ["%PDF-1.7\n"],
  name = "document.pdf",
  type = "application/pdf"
) => new File(contents, name, { type });

const withReportedSize = (file: File, size: number): File => {
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const assertValidationError = async (
  action: () => Promise<unknown>,
  details: string
) => {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof FileValidationError);
    assert.equal(error.details, details);
    return true;
  });
};

test("normalizes a filename and removes path-like prefixes", () => {
  assert.equal(normalizeFileName(" C:\\fakepath\\report.pdf "), "report.pdf");
  assert.equal(normalizeFileName("../folder/repo\u0301rt.pdf"), "repórt.pdf");
});

test("accepts a valid PDF with application/pdf MIME", async () => {
  const result = await validatePdfFile(pdfFile());

  assert.equal(result.normalizedName, "document.pdf");
  assert.deepEqual([...result.data.slice(0, 5)], [...Buffer.from("%PDF-")]);
});

test("accepts a valid PDF with an empty MIME", async () => {
  const result = await validatePdfFile(pdfFile(["%PDF-1.4"], "scan.pdf", ""));

  assert.equal(result.mimeType, "");
});

test("rejects an empty PDF", async () => {
  await assertValidationError(
    () => validatePdfFile(pdfFile([])),
    "File is empty"
  );
});

test("rejects a PDF larger than 100 MB before reading it", async () => {
  const file = withReportedSize(pdfFile(), PDF_MAX_SIZE_BYTES + 1);
  let read = false;
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => {
      read = true;
      return new ArrayBuffer(0);
    },
  });

  await assertValidationError(
    () => validatePdfFile(file),
    "PDF file exceeds the 100 MB limit"
  );
  assert.equal(read, false);
});

test("rejects a .txt file at the PDF boundary", async () => {
  await assertValidationError(
    () => validatePdfFile(pdfFile(["%PDF-1.7"], "notes.txt")),
    "PDF file must use the .pdf extension"
  );
});

test("rejects a PDF with an unsupported MIME", async () => {
  await assertValidationError(
    () => validatePdfFile(pdfFile(["%PDF-1.7"], "notes.pdf", "text/plain")),
    "PDF MIME type must be application/pdf or empty"
  );
});

test("rejects a .pdf file without the PDF magic bytes", async () => {
  await assertValidationError(
    () => validatePdfFile(pdfFile(["not a pdf"])),
    "PDF signature is invalid"
  );
});

test("accepts .xlsx and .xls Excel files", () => {
  assert.equal(
    validateExcelFile(new File(["data"], "spec.xlsx")).normalizedName,
    "spec.xlsx"
  );
  assert.equal(
    validateExcelFile(new File(["data"], "offer.XLS")).normalizedName,
    "offer.XLS"
  );
});

test("rejects empty and oversized Excel files", () => {
  assert.throws(
    () => validateExcelFile(new File([], "spec.xlsx")),
    (error: unknown) =>
      error instanceof FileValidationError && error.details === "File is empty"
  );

  const oversized = withReportedSize(
    new File(["data"], "spec.xlsx"),
    EXCEL_MAX_SIZE_BYTES + 1
  );
  assert.throws(
    () => validateExcelFile(oversized),
    (error: unknown) =>
      error instanceof FileValidationError &&
      error.details === "Excel file exceeds the 50 MB limit"
  );
});

test("rejects unsupported Excel extensions", () => {
  assert.throws(
    () => validateExcelFile(new File(["data"], "spec.csv")),
    (error: unknown) =>
      error instanceof FileValidationError &&
      error.details === "Excel file must use the .xlsx or .xls extension"
  );
});
