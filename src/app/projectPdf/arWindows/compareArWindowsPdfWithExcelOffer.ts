import path from "node:path";

import { compareWorkItems } from "../../compare";
import { parseOfferExcelData } from "../../parsers";
import type { CompareResult, WorkItem } from "../../types";
import {
  getPdfTextLayerDiagnostics,
  type PdfTextLayerDiagnostics,
} from "../pdfTextDiagnostics";
import { extractPdfPageTexts } from "../pdfTextExtractor";
import { extractArWindowsSpecificationDebug } from "./extractArWindowsSpecification";
import { mapArWindowsRowsToWorkItems } from "./mapArWindowsRowsToWorkItems";
import { recognizeArWindowsSpecificationRows } from "./recognizeArWindowsSpecificationRows";
import type { ArWindowSpecificationRow } from "./types";

const DEFAULT_DEBUG_IMAGE_PATH = path.join(
  process.cwd(),
  "debug",
  "ar-windows-page-1.png"
);

const countStatuses = (results: CompareResult[]): Record<string, number> =>
  results.reduce<Record<string, number>>((counts, result) => {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
    return counts;
  }, {});

export interface ArWindowsPdfExcelTechnicalInfo
  extends PdfTextLayerDiagnostics {
  debugImagePath: string;
  arFallbackUsed?: boolean;
  arFallbackReason?: string;
}

export interface ArWindowsPdfExcelCompareResult {
  arWorkItemsCount: number;
  excelOfferWorkItemsCount: number;
  results: CompareResult[];
  statusCounts: Record<string, number>;
  technicalInfo: ArWindowsPdfExcelTechnicalInfo;
  arWorkItems: WorkItem[];
}

export interface CompareArWindowsPdfWithExcelOfferDependencies {
  getPdfDiagnostics?: (pdfData: Uint8Array) => Promise<PdfTextLayerDiagnostics>;
  renderDebugImage?: (input: {
    pdfData: Uint8Array;
    outputPath: string;
    pageNumber: number;
  }) => Promise<unknown>;
  recognizeRows?: (input: {
    imagePath: string;
  }) => Promise<ArWindowSpecificationRow[]>;
  mapRowsToWorkItems?: (rows: ArWindowSpecificationRow[]) => WorkItem[];
  parseExcelOffer?: (data: ArrayBuffer | Uint8Array) => WorkItem[];
  compareItems?: (projectItems: WorkItem[], offerItems: WorkItem[]) => CompareResult[];
}

export interface CompareArWindowsPdfWithExcelOfferInput {
  pdfData: Uint8Array;
  excelData: ArrayBuffer | Uint8Array;
  debugImagePath?: string;
  pageNumber?: number;
  dependencies?: CompareArWindowsPdfWithExcelOfferDependencies;
}

export const getArWindowsPdfTextDiagnostics = async (
  pdfData: Uint8Array
): Promise<PdfTextLayerDiagnostics> => {
  const pages = await extractPdfPageTexts(pdfData);

  return getPdfTextLayerDiagnostics(pages);
};

export const compareArWindowsPdfWithExcelOffer = async ({
  pdfData,
  excelData,
  debugImagePath = DEFAULT_DEBUG_IMAGE_PATH,
  pageNumber = 1,
  dependencies = {},
}: CompareArWindowsPdfWithExcelOfferInput): Promise<ArWindowsPdfExcelCompareResult> => {
  const getPdfDiagnostics =
    dependencies.getPdfDiagnostics ?? getArWindowsPdfTextDiagnostics;
  const renderDebugImage =
    dependencies.renderDebugImage ??
    ((input) => extractArWindowsSpecificationDebug(input));
  const recognizeRows =
    dependencies.recognizeRows ?? recognizeArWindowsSpecificationRows;
  const mapRowsToWorkItems =
    dependencies.mapRowsToWorkItems ?? mapArWindowsRowsToWorkItems;
  const parseExcelOffer = dependencies.parseExcelOffer ?? parseOfferExcelData;
  const compareItems = dependencies.compareItems ?? compareWorkItems;

  const technicalInfo = await getPdfDiagnostics(pdfData);

  await renderDebugImage({
    pdfData,
    outputPath: debugImagePath,
    pageNumber,
  });

  const rows = await recognizeRows({ imagePath: debugImagePath });
  const arWorkItems = mapRowsToWorkItems(rows);
  const excelOfferWorkItems = parseExcelOffer(excelData);
  const results = compareItems(arWorkItems, excelOfferWorkItems);
  const statusCounts = countStatuses(results);

  return {
    arWorkItemsCount: arWorkItems.length,
    excelOfferWorkItemsCount: excelOfferWorkItems.length,
    results,
    statusCounts,
    technicalInfo: {
      ...technicalInfo,
      debugImagePath,
    },
    arWorkItems,
  };
};
