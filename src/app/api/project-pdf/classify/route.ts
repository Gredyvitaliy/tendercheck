import { analyzePdfClassification } from "../../../projectPdf/analyzePdfClassification";
import {
  FileValidationError,
  normalizeFileName,
  validatePdfFile,
} from "../../../security/fileValidation";

export const runtime = "nodejs";

type PdfClassifier = (data: Uint8Array) => Promise<unknown>;
type NodeEnvironment = "development" | "production" | "test" | undefined;

const isPageLimitError = (
  error: unknown
): error is Error & { code: "PDF_PAGE_LIMIT_EXCEEDED"; pageCount?: number } =>
  error instanceof Error &&
  "code" in error &&
  error.code === "PDF_PAGE_LIMIT_EXCEEDED";

const getResultPageCount = (result: unknown): number | undefined => {
  if (
    typeof result === "object" &&
    result !== null &&
    "totalPages" in result &&
    typeof result.totalPages === "number"
  ) {
    return result.totalPages;
  }

  return undefined;
};

export const createPostHandler =
  (
    classify: PdfClassifier,
    environment: NodeEnvironment = process.env.NODE_ENV
  ) =>
  async (request: Request): Promise<Response> => {
    const startedAt = performance.now();
    let fileMetadata:
      | { filename: string; size: number; mimeType: string }
      | undefined;

    try {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        throw new FileValidationError(
          "FILE_NAME_INVALID",
          "PDF file is required"
        );
      }

      fileMetadata = {
        filename: normalizeFileName(file.name),
        size: file.size,
        mimeType: file.type,
      };

      const validated = await validatePdfFile(file);
      const result = await classify(validated.data);
      const pageCount = getResultPageCount(result);

      console.info("PDF classification completed", {
        ...fileMetadata,
        pageCount,
        processingTimeMs: Math.round(performance.now() - startedAt),
      });

      return Response.json(result);
    } catch (error) {
      const processingTimeMs = Math.round(performance.now() - startedAt);

      if (error instanceof FileValidationError) {
        console.warn("PDF validation failed", {
          ...fileMetadata,
          processingTimeMs,
          errorCode: error.code,
        });
        return Response.json(
          { error: "Invalid file", details: error.details },
          { status: 400 }
        );
      }

      if (isPageLimitError(error)) {
        console.warn("PDF validation failed", {
          ...fileMetadata,
          pageCount: error.pageCount,
          processingTimeMs,
          errorCode: error.code,
        });
        return Response.json(
          { error: "Invalid file", details: "PDF page limit exceeded" },
          { status: 400 }
        );
      }

      console.error("PDF classification failed", {
        ...fileMetadata,
        processingTimeMs,
        errorCode: "PDF_CLASSIFICATION_FAILED",
      });

      const body: { error: string; stack?: string } = {
        error: "Failed to classify PDF",
      };
      if (environment === "development" && error instanceof Error) {
        body.stack = error.stack;
      }

      return Response.json(body, { status: 500 });
    }
  };

export const POST = createPostHandler(analyzePdfClassification);
