import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { compareWorkItems } from "../../../../compare";
import { parseOfferExcelData } from "../../../../parsers";
import {
  FileValidationError,
  normalizeFileName,
  validateExcelFile,
  validatePdfFile,
} from "../../../../security/fileValidation";
import type { CompareResult, WorkItem } from "../../../../types";
import type { ArWindowsPdfExcelCompareResult } from "../../../../projectPdf/arWindows/compareArWindowsPdfWithExcelOffer";

export const runtime = "nodejs";

export const GET = (): Response =>
  NextResponse.json({ ok: true, route: "ar-windows-compare" });

type NodeEnvironment = "development" | "production" | "test" | undefined;

type ArWindowsComparePipeline = (input: {
  pdfData: Uint8Array;
  excelData: ArrayBuffer;
}) => Promise<ArWindowsPdfExcelCompareResult>;

type ArWindowsCompareModule = typeof import("../../../../projectPdf/arWindows/compareArWindowsPdfWithExcelOffer");

type ArWindowsCompareModuleImporter = () => Promise<ArWindowsCompareModule>;

const DEFAULT_FALLBACK_WORK_ITEMS_PATH = path.join(
  process.cwd(),
  "debug",
  "ar-windows-work-items.json"
);

class ArPdfRenderDependencyUnavailableError extends Error {
  constructor(
    public readonly details: string,
    message = "AR PDF render dependency is unavailable"
  ) {
    super(message);
    this.name = "ArPdfRenderDependencyUnavailableError";
  }
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRenderDependencyUnavailable = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("cannot find native binding") ||
    message.includes("@napi-rs/canvas") ||
    message.includes("canvas")
  );
};

const countStatuses = (results: CompareResult[]): Record<string, number> =>
  results.reduce<Record<string, number>>((counts, result) => {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
    return counts;
  }, {});

interface ArWindowsFallbackOptions {
  fallbackWorkItemsPath?: string;
  parseExcelOffer?: (data: ArrayBuffer | Uint8Array) => WorkItem[];
  compareItems?: (projectItems: WorkItem[], offerItems: WorkItem[]) => CompareResult[];
}

const readFallbackWorkItems = async (
  fallbackWorkItemsPath: string
): Promise<WorkItem[]> =>
  JSON.parse(await readFile(fallbackWorkItemsPath, "utf8")) as WorkItem[];

const compareWithFallbackWorkItems = async ({
  excelData,
  fallbackReason,
  fallbackWorkItemsPath = DEFAULT_FALLBACK_WORK_ITEMS_PATH,
  parseExcelOffer = parseOfferExcelData,
  compareItems = compareWorkItems,
}: {
  excelData: ArrayBuffer | Uint8Array;
  fallbackReason: string;
} & ArWindowsFallbackOptions): Promise<ArWindowsPdfExcelCompareResult> => {
  const arWorkItems = await readFallbackWorkItems(fallbackWorkItemsPath);
  const excelOfferWorkItems = parseExcelOffer(excelData);
  const results = compareItems(arWorkItems, excelOfferWorkItems);

  return {
    arWorkItemsCount: arWorkItems.length,
    excelOfferWorkItemsCount: excelOfferWorkItems.length,
    results,
    statusCounts: countStatuses(results),
    technicalInfo: {
      extractedTextLength: 0,
      pagesWithTextCount: 0,
      likelyScannedOrDrawingPdf: true,
      debugImagePath: "",
      arFallbackUsed: true,
      arFallbackReason: fallbackReason,
    },
    arWorkItems,
  };
};

export const createDefaultPipeline =
  (
    importer: ArWindowsCompareModuleImporter = () =>
      import(
        "../../../../projectPdf/arWindows/compareArWindowsPdfWithExcelOffer"
      ),
    fallbackOptions: ArWindowsFallbackOptions = {}
  ): ArWindowsComparePipeline =>
  async ({ pdfData, excelData }) => {
    try {
      const { compareArWindowsPdfWithExcelOffer } = await importer();

      return await compareArWindowsPdfWithExcelOffer({ pdfData, excelData });
    } catch (error) {
      if (isRenderDependencyUnavailable(error)) {
        const details = getErrorMessage(error);

        try {
          return await compareWithFallbackWorkItems({
            excelData,
            fallbackReason: details,
            ...fallbackOptions,
          });
        } catch {
          throw new ArPdfRenderDependencyUnavailableError(
            details,
            "AR PDF render dependency is unavailable and fallback work items were not found"
          );
        }
      }

      throw error;
    }
  };

const defaultPipeline: ArWindowsComparePipeline = createDefaultPipeline();

const getFormFile = (
  formData: FormData,
  names: string[],
  details: string
): File => {
  for (const name of names) {
    const file = formData.get(name);

    if (file instanceof File) {
      return file;
    }
  }

  throw new FileValidationError("FILE_NAME_INVALID", details);
};

export const createPostHandler =
  (
    pipeline: ArWindowsComparePipeline = defaultPipeline,
    environment: NodeEnvironment = process.env.NODE_ENV
  ) =>
  async (request: Request): Promise<Response> => {
    const startedAt = performance.now();
    let fileMetadata:
      | {
          pdfFilename?: string;
          pdfSize?: number;
          excelFilename?: string;
          excelSize?: number;
        }
      | undefined;

    try {
      const formData = await request.formData();
      const pdfFile = getFormFile(
        formData,
        ["pdf", "file"],
        "PDF file is required"
      );
      const excelFile = getFormFile(
        formData,
        ["excelOffer", "offer", "excel"],
        "Excel offer file is required"
      );

      fileMetadata = {
        pdfFilename: normalizeFileName(pdfFile.name),
        pdfSize: pdfFile.size,
        excelFilename: normalizeFileName(excelFile.name),
        excelSize: excelFile.size,
      };

      const [validatedPdf, excelData] = await Promise.all([
        validatePdfFile(pdfFile),
        Promise.resolve(validateExcelFile(excelFile)).then(async () =>
          excelFile.arrayBuffer()
        ),
      ]);
      const result = await pipeline({
        pdfData: validatedPdf.data,
        excelData,
      });

      console.info("AR windows PDF compare completed", {
        ...fileMetadata,
        arWorkItemsCount: result.arWorkItemsCount,
        excelOfferWorkItemsCount: result.excelOfferWorkItemsCount,
        statusCounts: result.statusCounts,
        processingTimeMs: Math.round(performance.now() - startedAt),
      });

      return NextResponse.json(result);
    } catch (error) {
      const processingTimeMs = Math.round(performance.now() - startedAt);

      if (error instanceof FileValidationError) {
        console.warn("AR windows PDF compare validation failed", {
          ...fileMetadata,
          processingTimeMs,
          errorCode: error.code,
        });
        return NextResponse.json(
          { error: "Invalid file", details: error.details },
          { status: 400 }
        );
      }

      if (error instanceof ArPdfRenderDependencyUnavailableError) {
        console.error("AR windows PDF render dependency unavailable", {
          ...fileMetadata,
          processingTimeMs,
          details: error.details,
        });
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
            details: error.details,
          },
          { status: 500 }
        );
      }

      console.error("AR windows PDF compare failed", {
        ...fileMetadata,
        processingTimeMs,
        errorCode: "AR_WINDOWS_COMPARE_FAILED",
      });

      const body: { error: string; stack?: string } = {
        error: "Failed to compare AR windows PDF with Excel offer",
      };
      if (environment === "development" && error instanceof Error) {
        body.stack = error.stack;
      }

      return NextResponse.json(body, { status: 500 });
    }
  };

export const POST = createPostHandler();
