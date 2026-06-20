import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { compareWorkItems } from "../../compare";
import { parseOfferExcelData } from "../../parsers";
import type { CompareResult, WorkItem } from "../../types";

const DEFAULT_AR_WORK_ITEMS_PATH = path.join(
  process.cwd(),
  "debug",
  "ar-windows-work-items.json"
);
const DEFAULT_OUTPUT_PATH = path.join(
  process.cwd(),
  "debug",
  "ar-windows-vs-excel-compare-result.json"
);
const EXCEL_PARSER_INFO = {
  functionName: "parseOfferExcelData",
  moduleName: "src/app/parsers.ts",
  browserEntryPoint: "parseOfferExcel",
} as const;

type ExcelOfferPreviewItem = Pick<
  WorkItem,
  "name" | "unit" | "projectVolume" | "position"
>;

export interface ArWindowsExcelCompareSummary {
  arWorkItems: number;
  excelWorkItems: number;
  totalResults: number;
  excelParser: typeof EXCEL_PARSER_INFO;
  excelOfferPreview: ExcelOfferPreviewItem[];
  statusCounts: Record<string, number>;
}

export interface ArWindowsExcelCompareDebugResult {
  summary: ArWindowsExcelCompareSummary;
  pdfWorkItems: WorkItem[];
  excelWorkItems: WorkItem[];
  results: CompareResult[];
}

interface CompareArWindowsWithExcelOfferOptions {
  arWorkItemsPath?: string;
  outputPath?: string;
  logger?: (message: string) => void;
}

export const countCompareStatuses = (
  results: CompareResult[]
): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const result of results) {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
  }

  return counts;
};

const buildExcelOfferPreview = (
  excelWorkItems: WorkItem[]
): ExcelOfferPreviewItem[] =>
  excelWorkItems.slice(0, 10).map((item) => ({
    name: item.name,
    unit: item.unit,
    projectVolume: item.projectVolume,
    position: item.position,
  }));

export const buildArWindowsExcelCompareDebugResult = (
  arWorkItems: WorkItem[],
  excelWorkItems: WorkItem[],
  results: CompareResult[]
): ArWindowsExcelCompareDebugResult => ({
  summary: {
    arWorkItems: arWorkItems.length,
    excelWorkItems: excelWorkItems.length,
    totalResults: results.length,
    excelParser: EXCEL_PARSER_INFO,
    excelOfferPreview: buildExcelOfferPreview(excelWorkItems),
    statusCounts: countCompareStatuses(results),
  },
  pdfWorkItems: arWorkItems,
  excelWorkItems,
  results,
});

const readWorkItemsJson = async (filePath: string): Promise<WorkItem[]> =>
  JSON.parse(await readFile(filePath, "utf8")) as WorkItem[];

export const readExcelFileAsBrowserArrayBuffer = async (
  filePath: string | URL
): Promise<ArrayBuffer> => {
  const file = await readFile(filePath);

  return file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength
  ) as ArrayBuffer;
};

export const compareArWindowsWithExcelOffer = async (
  excelPath: string,
  options: CompareArWindowsWithExcelOfferOptions = {}
): Promise<string> => {
  const logger = options.logger ?? console.log;
  const resolvedArWorkItemsPath = path.resolve(
    options.arWorkItemsPath ?? DEFAULT_AR_WORK_ITEMS_PATH
  );
  const resolvedExcelPath = path.resolve(excelPath);
  const resolvedOutputPath = path.resolve(
    options.outputPath ?? DEFAULT_OUTPUT_PATH
  );
  const [arWorkItems, excelFile] = await Promise.all([
    readWorkItemsJson(resolvedArWorkItemsPath),
    readExcelFileAsBrowserArrayBuffer(resolvedExcelPath),
  ]);
  const excelWorkItems = parseOfferExcelData(excelFile);
  const results = compareWorkItems(arWorkItems, excelWorkItems);
  const debugResult = buildArWindowsExcelCompareDebugResult(
    arWorkItems,
    excelWorkItems,
    results
  );

  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(
    resolvedOutputPath,
    `${JSON.stringify(debugResult, null, 2)}\n`,
    "utf8"
  );

  logger(`AR WorkItems count: ${debugResult.summary.arWorkItems}`);
  logger(
    "Excel parser: " +
      `${debugResult.summary.excelParser.functionName} ` +
      `(${debugResult.summary.excelParser.moduleName}, ` +
      `browser entry: ${debugResult.summary.excelParser.browserEntryPoint})`
  );
  logger(`Excel offer WorkItems count: ${debugResult.summary.excelWorkItems}`);
  logger(
    "First 10 Excel offer WorkItems:\n" +
      JSON.stringify(debugResult.summary.excelOfferPreview, null, 2)
  );
  logger("Status counts:");
  for (const [status, count] of Object.entries(debugResult.summary.statusCounts)) {
    logger(`- ${status}: ${count}`);
  }
  logger(
    `First 20 comparison results:\n${JSON.stringify(results.slice(0, 20), null, 2)}`
  );
  logger(`Debug comparison result: ${resolvedOutputPath}`);

  return resolvedOutputPath;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const excelPath = process.argv[2];

  if (!excelPath) {
    console.error(
      "Usage: npx tsx " +
        "src/app/projectPdf/arWindows/testCompareArWindowsWithExcelOffer.ts " +
        "<excel-path>"
    );
    process.exit(1);
  }

  compareArWindowsWithExcelOffer(excelPath).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
