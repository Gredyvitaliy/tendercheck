import { detectSpecificationSection } from "../../../projectPdf/detectSpecificationSection";
import { extractSpecificationRowCandidates } from "../../../projectPdf/extractSpecificationRows";
import { mapPdfCandidatesToWorkItems } from "../../../projectPdf/mapPdfCandidatesToWorkItems";
import { extractPdfPageTexts } from "../../../projectPdf/pdfTextExtractor";
import { splitPdfCompositeWorkItems } from "../../../projectPdf/splitPdfCompositeWorkItems";
import type { WorkItem } from "../../../types";
import {
  FileValidationError,
  normalizeFileName,
  validatePdfFile,
} from "../../../security/fileValidation";

export const runtime = "nodejs";

type NodeEnvironment = "development" | "production" | "test" | undefined;

type SpecificationSection = NonNullable<
  ReturnType<typeof detectSpecificationSection>
>;

export interface ProjectPdfWorkItemsResponse {
  specificationSection: SpecificationSection;
  beforeSplitCount: number;
  afterSplitCount: number;
  workItems: WorkItem[];
}

type ProjectPdfPipeline = (
  data: Uint8Array
) => Promise<ProjectPdfWorkItemsResponse>;

class SpecificationSectionNotFoundError extends Error {
  readonly code = "SPECIFICATION_SECTION_NOT_FOUND";

  constructor() {
    super("Specification section was not found");
    this.name = "SpecificationSectionNotFoundError";
  }
}

const processProjectPdf: ProjectPdfPipeline = async (data) => {
  const pages = await extractPdfPageTexts(data);
  const specificationSection = detectSpecificationSection(pages);

  if (!specificationSection) {
    throw new SpecificationSectionNotFoundError();
  }

  const candidates = extractSpecificationRowCandidates(
    pages,
    specificationSection
  );
  const beforeSplit = mapPdfCandidatesToWorkItems(candidates);
  const workItems = splitPdfCompositeWorkItems(beforeSplit);

  return {
    specificationSection,
    beforeSplitCount: beforeSplit.length,
    afterSplitCount: workItems.length,
    workItems,
  };
};

const hasErrorCode = (
  error: unknown,
  code: string
): error is Error & { code: string } =>
  error instanceof Error && "code" in error && error.code === code;

export const createPostHandler =
  (
    pipeline: ProjectPdfPipeline = processProjectPdf,
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
      const result = await pipeline(validated.data);

      console.info("PDF work items completed", {
        ...fileMetadata,
        processingTimeMs: Math.round(performance.now() - startedAt),
      });

      return Response.json(result);
    } catch (error) {
      const processingTimeMs = Math.round(performance.now() - startedAt);

      if (error instanceof FileValidationError) {
        console.warn("PDF work items validation failed", {
          ...fileMetadata,
          processingTimeMs,
          errorCode: error.code,
        });
        return Response.json(
          { error: "Invalid file", details: error.details },
          { status: 400 }
        );
      }

      if (hasErrorCode(error, "SPECIFICATION_SECTION_NOT_FOUND")) {
        console.warn("PDF work items processing failed", {
          ...fileMetadata,
          processingTimeMs,
          errorCode: error.code,
        });
        return Response.json(
          { error: "PDF processing failed", details: error.message },
          { status: 422 }
        );
      }

      if (hasErrorCode(error, "PDF_PAGE_LIMIT_EXCEEDED")) {
        return Response.json(
          { error: "Invalid file", details: "PDF page limit exceeded" },
          { status: 400 }
        );
      }

      console.error("PDF work items failed", {
        ...fileMetadata,
        processingTimeMs,
        errorCode: "PDF_WORK_ITEMS_FAILED",
      });

      const body: { error: string; stack?: string } = {
        error: "Failed to process PDF",
      };
      if (environment === "development" && error instanceof Error) {
        body.stack = error.stack;
      }

      return Response.json(body, { status: 500 });
    }
  };

export const POST = createPostHandler();
