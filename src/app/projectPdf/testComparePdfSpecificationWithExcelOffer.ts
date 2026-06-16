import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { compareWorkItems } from "../compare";
import {
  applyOfferScopeToResults,
  detectOfferScope,
  type OfferScope,
} from "../matching/detectOfferScope";
import { parseOfferExcelData } from "../parsers";
import type {
  CompareResult,
  CompareResultStatus,
  WorkItem,
} from "../types";
import { detectSpecificationSection } from "./detectSpecificationSection";
import { extractSpecificationRowCandidates } from "./extractSpecificationRows";
import { mapPdfCandidatesToWorkItems } from "./mapPdfCandidatesToWorkItems";
import { extractPdfPageTexts } from "./pdfTextExtractor";
import { splitPdfCompositeWorkItems } from "./splitPdfCompositeWorkItems";

const defaultOutputPath = "debug/pdf-vs-excel-compare-result.json";

const compareStatuses: CompareResultStatus[] = [
  "ОК",
  "Объем отличается",
  "Размер отличается",
  "Частичное совпадение",
  "Агрегированная позиция",
  "Количество в PDF не распознано",
  "Нет в КП",
  "Вне области КП",
  "Есть в КП, нет в спецификации",
];

export interface PdfExcelCompareSummary {
  pdfWorkItemsBeforeSplit: number;
  pdfWorkItemsAfterSplit: number;
  excelWorkItems: number;
  totalResults: number;
  offerScope: OfferScope;
  statusCountsBeforeScope: Record<CompareResultStatus, number>;
  statusCountsAfterScope: Record<CompareResultStatus, number>;
}

export interface PdfExcelCompareDebugResult {
  summary: PdfExcelCompareSummary;
  pdfWorkItems: WorkItem[];
  excelWorkItems: WorkItem[];
  results: CompareResult[];
}

export const buildCompareSummary = (
  pdfWorkItemsBeforeSplit: number,
  pdfWorkItems: WorkItem[],
  excelWorkItems: WorkItem[],
  resultsBeforeScope: CompareResult[],
  resultsAfterScope: CompareResult[],
  offerScope: OfferScope
): PdfExcelCompareSummary => {
  const countStatuses = (
    results: CompareResult[]
  ): Record<CompareResultStatus, number> => {
  const statusCounts = Object.fromEntries(
    compareStatuses.map((status) => [status, 0])
  ) as Record<CompareResultStatus, number>;

  for (const result of results) {
    statusCounts[result.status] += 1;
  }

    return statusCounts;
  };

  return {
    pdfWorkItemsBeforeSplit,
    pdfWorkItemsAfterSplit: pdfWorkItems.length,
    excelWorkItems: excelWorkItems.length,
    totalResults: resultsAfterScope.length,
    offerScope,
    statusCountsBeforeScope: countStatuses(resultsBeforeScope),
    statusCountsAfterScope: countStatuses(resultsAfterScope),
  };
};

export const buildCompareDebugResult = (
  pdfWorkItemsBeforeSplit: number,
  pdfWorkItems: WorkItem[],
  excelWorkItems: WorkItem[],
  resultsBeforeScope: CompareResult[],
  resultsAfterScope: CompareResult[],
  offerScope: OfferScope
): PdfExcelCompareDebugResult => ({
  summary: buildCompareSummary(
    pdfWorkItemsBeforeSplit,
    pdfWorkItems,
    excelWorkItems,
    resultsBeforeScope,
    resultsAfterScope,
    offerScope
  ),
  pdfWorkItems,
  excelWorkItems,
  results: resultsAfterScope,
});

export const comparePdfSpecificationWithExcelOffer = async (
  pdfPath: string,
  excelPath: string,
  outputPath = defaultOutputPath
): Promise<string> => {
  const [pdfFile, excelFile] = await Promise.all([
    readFile(pdfPath),
    readFile(excelPath),
  ]);
  const pdfData = new Uint8Array(
    pdfFile.buffer,
    pdfFile.byteOffset,
    pdfFile.byteLength
  );
  const excelData = new Uint8Array(
    excelFile.buffer,
    excelFile.byteOffset,
    excelFile.byteLength
  );

  const pages = await extractPdfPageTexts(pdfData);
  const specificationSection = detectSpecificationSection(pages);

  if (!specificationSection) {
    throw new Error("Specification section was not found");
  }

  const candidates = extractSpecificationRowCandidates(
    pages,
    specificationSection
  );
  const unsplitPdfWorkItems = mapPdfCandidatesToWorkItems(candidates);
  const pdfWorkItems = splitPdfCompositeWorkItems(unsplitPdfWorkItems);
  const excelWorkItems = parseOfferExcelData(excelData);
  const offerScope = detectOfferScope(excelWorkItems);
  const resultsBeforeScope = compareWorkItems(pdfWorkItems, excelWorkItems);
  const results = applyOfferScopeToResults(resultsBeforeScope, offerScope);
  const debugResult = buildCompareDebugResult(
    unsplitPdfWorkItems.length,
    pdfWorkItems,
    excelWorkItems,
    resultsBeforeScope,
    results,
    offerScope
  );
  const resolvedOutputPath = resolve(outputPath);

  console.log(
    `Specification section: pages ${specificationSection.startPage}-` +
      `${specificationSection.endPage}, sheets ` +
      `${specificationSection.sheetCount}`
  );
  console.log(
    `PDF WorkItems before split: ` +
      `${debugResult.summary.pdfWorkItemsBeforeSplit}`
  );
  console.log(
    `PDF WorkItems after split: ` +
      `${debugResult.summary.pdfWorkItemsAfterSplit}`
  );
  console.log(`Excel offer WorkItems: ${debugResult.summary.excelWorkItems}`);
  console.log("Detected offer scope:");
  console.log(
    JSON.stringify(
      {
        detectedBrands: offerScope.detectedBrands,
        dominantBrands: offerScope.dominantBrands,
        confidence: offerScope.confidence,
        reasons: offerScope.reasons,
      },
      null,
      2
    )
  );
  console.log("Status counts before scope filtering:");
  for (const status of compareStatuses) {
    console.log(
      `- ${status}: ${debugResult.summary.statusCountsBeforeScope[status]}`
    );
  }
  console.log("Status counts after scope filtering:");
  for (const status of compareStatuses) {
    console.log(
      `- ${status}: ${debugResult.summary.statusCountsAfterScope[status]}`
    );
  }
  console.log("First 30 comparison results:");
  console.log(JSON.stringify(results.slice(0, 30), null, 2));

  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(
    resolvedOutputPath,
    JSON.stringify(debugResult, null, 2),
    "utf8"
  );

  return resolvedOutputPath;
};

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule) {
  const pdfPath = process.argv[2];
  const excelPath = process.argv[3];

  if (!pdfPath || !excelPath) {
    console.error(
      "Usage: npx tsx " +
        "src/app/projectPdf/testComparePdfSpecificationWithExcelOffer.ts " +
        "<pdf-path> <excel-offer-path>"
    );
    process.exitCode = 1;
  } else {
    comparePdfSpecificationWithExcelOffer(pdfPath, excelPath)
      .then((writtenPath) => {
        console.log(`Debug comparison result: ${writtenPath}`);
      })
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
  }
}
