import { compareWorkItems } from "../compare";
import type { CompareResult, WorkItem } from "../types";
import type { ProjectPdfWorkItemsResponse } from "../api/project-pdf/work-items/route";
import type { PdfTextLayerDiagnostics } from "./pdfTextDiagnostics";
import {
  loadProjectPdfWorkItems,
  ProjectPdfProcessingError,
} from "./loadProjectPdfWorkItems";
import type {
  ArWindowsPdfExcelCompareResult,
  ArWindowsPdfExcelTechnicalInfo,
} from "./arWindows/compareArWindowsPdfWithExcelOffer";
import { loadArWindowsPdfCompare } from "./arWindows/loadArWindowsPdfCompare";

export type UnifiedPdfProjectMode = "auto" | "text" | "arWindows";
export type ExtractionStrategy = "pdf_text" | "ar_windows_ocr";

export interface UnifiedPdfProjectTechnicalInfo {
  totalProjectWorkItemsCount: number;
  textPdfWorkItemsCount: number;
  arWindowsWorkItemsCount: number;
  extractionStrategiesUsed: ExtractionStrategy[];
  fallbackUsed: boolean;
  fallbackReason?: string;
  textPdfTechnicalInfo?: PdfTextLayerDiagnostics;
  arWindowsTechnicalInfo?: ArWindowsPdfExcelTechnicalInfo;
}

export interface UnifiedPdfProjectCompareResult {
  workItems: WorkItem[];
  results: CompareResult[];
  statusCounts: Record<string, number>;
  technicalInfo: UnifiedPdfProjectTechnicalInfo;
  textPdfResult?: ProjectPdfWorkItemsResponse;
  arWindowsResult?: ArWindowsPdfExcelCompareResult;
}

export interface LoadUnifiedProjectPdfCompareInput {
  mode: UnifiedPdfProjectMode;
  pdfFile: File;
  excelOfferFile: File;
  offerItems: WorkItem[];
  loadTextPdfWorkItems?: (
    file: File
  ) => Promise<ProjectPdfWorkItemsResponse>;
  loadArWindowsPdfCompare?: (
    pdfFile: File,
    excelOfferFile: File
  ) => Promise<ArWindowsPdfExcelCompareResult>;
}

const countStatuses = (
  comparison: CompareResult[]
): Record<string, number> =>
  comparison.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});

const withMetadata = (
  items: WorkItem[],
  sourceDiscipline: NonNullable<WorkItem["sourceDiscipline"]>,
  extractionStrategy: NonNullable<WorkItem["extractionStrategy"]>
): WorkItem[] =>
  items.map((item) => ({
    ...item,
    sourceDiscipline,
    extractionStrategy,
  }));

const getDeduplicationKey = (item: WorkItem): string =>
  [
    item.position ?? "",
    item.name,
    item.rate,
    item.unit,
    String(item.projectVolume),
  ]
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");

const dedupeWorkItems = (items: WorkItem[]): WorkItem[] => {
  const seen = new Set<string>();
  const deduped: WorkItem[] = [];

  for (const item of items) {
    const key = getDeduplicationKey(item);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
};

const shouldTryArAfterText = (
  result: ProjectPdfWorkItemsResponse | undefined,
  textErrorTechnicalInfo: PdfTextLayerDiagnostics | undefined
) => {
  if (!result) {
    return textErrorTechnicalInfo?.likelyScannedOrDrawingPdf === true;
  }

  return (
    result.workItems.length === 0 ||
    result.technicalInfo.likelyScannedOrDrawingPdf
  );
};

export const loadUnifiedProjectPdfCompare = async ({
  mode,
  pdfFile,
  excelOfferFile,
  offerItems,
  loadTextPdfWorkItems = loadProjectPdfWorkItems,
  loadArWindowsPdfCompare: loadArCompare = loadArWindowsPdfCompare,
}: LoadUnifiedProjectPdfCompareInput): Promise<UnifiedPdfProjectCompareResult> => {
  let textPdfResult: ProjectPdfWorkItemsResponse | undefined;
  let arWindowsResult: ArWindowsPdfExcelCompareResult | undefined;
  let textErrorTechnicalInfo: PdfTextLayerDiagnostics | undefined;
  let fallbackReason: string | undefined;

  if (mode === "text" || mode === "auto") {
    try {
      textPdfResult = await loadTextPdfWorkItems(pdfFile);
    } catch (error) {
      if (
        mode === "auto" &&
        error instanceof ProjectPdfProcessingError &&
        error.technicalInfo?.likelyScannedOrDrawingPdf
      ) {
        textErrorTechnicalInfo = error.technicalInfo;
        fallbackReason = error.message;
      } else {
        throw error;
      }
    }
  }

  const shouldLoadAr =
    mode === "arWindows" ||
    (mode === "auto" && shouldTryArAfterText(textPdfResult, textErrorTechnicalInfo));

  if (mode === "auto" && shouldLoadAr && !fallbackReason) {
    fallbackReason =
      textPdfResult && textPdfResult.workItems.length === 0
        ? "text_pdf_returned_no_work_items"
        : "text_pdf_likely_scanned_or_drawing";
  }

  if (shouldLoadAr) {
    arWindowsResult = await loadArCompare(pdfFile, excelOfferFile);
  }

  const textItems = textPdfResult
    ? withMetadata(textPdfResult.workItems, "text_pdf", "pdf_text")
    : [];
  const arItems = arWindowsResult
    ? withMetadata(arWindowsResult.arWorkItems, "ar_windows", "ar_windows_ocr")
    : [];
  const workItems = dedupeWorkItems([...textItems, ...arItems]);
  const results = compareWorkItems(workItems, offerItems);
  const extractionStrategiesUsed: ExtractionStrategy[] = [];

  if (textPdfResult) {
    extractionStrategiesUsed.push("pdf_text");
  }

  if (arWindowsResult) {
    extractionStrategiesUsed.push("ar_windows_ocr");
  }

  return {
    workItems,
    results,
    statusCounts: countStatuses(results),
    technicalInfo: {
      totalProjectWorkItemsCount: workItems.length,
      textPdfWorkItemsCount: textPdfResult?.workItems.length ?? 0,
      arWindowsWorkItemsCount: arWindowsResult?.arWorkItems.length ?? 0,
      extractionStrategiesUsed,
      fallbackUsed: Boolean(fallbackReason || arWindowsResult?.technicalInfo.arFallbackUsed),
      fallbackReason:
        fallbackReason ?? arWindowsResult?.technicalInfo.arFallbackReason,
      textPdfTechnicalInfo:
        textPdfResult?.technicalInfo ?? textErrorTechnicalInfo,
      arWindowsTechnicalInfo: arWindowsResult?.technicalInfo,
    },
    textPdfResult,
    arWindowsResult,
  };
};
