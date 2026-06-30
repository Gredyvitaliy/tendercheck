import { compareWorkItems } from "../compare";
import type { CompareResult, WorkItem } from "../types";
import {
  loadUnifiedProjectPdfCompare,
  type UnifiedPdfProjectCompareResult,
  type UnifiedPdfProjectMode,
} from "./loadUnifiedProjectPdfCompare";

export type OfferDiscipline = "ar_windows" | "ovik" | "unknown";
export type MatchedProjectDiscipline =
  | "ar_windows"
  | "ovik"
  | "all_project";
export type BatchOfferDisciplineOverride =
  | "auto"
  | "ar_windows"
  | "ovik"
  | "all_project";

export interface BatchOfferInput {
  file: File;
  offerItems: WorkItem[];
  disciplineOverride?: BatchOfferDisciplineOverride;
}

export interface BatchCompareSummary {
  offerFilename: string;
  excelOfferWorkItemsCount: number;
  totalProjectWorkItemsCount: number;
  projectWorkItemsUsedCount: number;
  detectedOfferDiscipline: OfferDiscipline;
  matchedProjectDiscipline: MatchedProjectDiscipline;
  okCount: number;
  volumeDiffCount: number;
  sizeDiffCount: number;
  missingCount: number;
  extraOfferCount: number;
  warning?: string;
  error?: string;
}

export interface BatchCompareSuccess {
  id: string;
  status: "success";
  summary: BatchCompareSummary;
  compareResult: UnifiedPdfProjectCompareResult;
}

export interface BatchCompareFailure {
  id: string;
  status: "failed";
  summary: BatchCompareSummary;
  error: string;
}

export type BatchCompareEntry = BatchCompareSuccess | BatchCompareFailure;

export interface BatchCompareResult {
  results: BatchCompareEntry[];
  allProjectWorkItems: WorkItem[];
  ovikWorkItems: WorkItem[];
  arWindowsWorkItems: WorkItem[];
  unknownWorkItems: WorkItem[];
}

export interface RunUnifiedCompareInput {
  mode: UnifiedPdfProjectMode;
  projectPdf: File;
  offerFile: File;
  offerItems: WorkItem[];
}

export interface LoadProjectPdfInput {
  mode: UnifiedPdfProjectMode;
  projectPdf: File;
  seedOfferFile: File;
  seedOfferItems: WorkItem[];
}

export interface LoadBatchProjectPdfCompareInput {
  mode: UnifiedPdfProjectMode;
  projectPdf?: File;
  projectPdfs?: File[];
  offers: BatchOfferInput[];
  projectWorkItems?: WorkItem[];
  loadProjectPdf?: (
    input: LoadProjectPdfInput
  ) => Promise<UnifiedPdfProjectCompareResult>;
  runCompare?: (projectItems: WorkItem[], offerItems: WorkItem[]) => CompareResult[];
  runUnifiedCompare?: (
    input: RunUnifiedCompareInput
  ) => Promise<UnifiedPdfProjectCompareResult>;
}

const UNKNOWN_DISCIPLINE_WARNING =
  "Offer discipline unknown; compared against all project work items";

const countStatuses = (
  comparison: CompareResult[]
): Record<string, number> =>
  comparison.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});

const countStatus = (
  results: CompareResult[],
  status: CompareResult["status"]
): number => results.filter((result) => result.status === status).length;

const buildId = (file: File, index: number): string => `${index}-${file.name}`;

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();

const itemSearchText = (item: WorkItem): string =>
  normalizeText(
    [
      item.position,
      item.name,
      item.rate,
      item.unit,
      String(item.projectVolume),
    ]
      .filter(Boolean)
      .join(" ")
  );

const hasWindowMark = (text: string): boolean =>
  /(?:^|[^a-zа-я0-9])[bв]\s*-\s*\d+\s*(?:\*|\((?:зер|зерк\.?|зеркальное)\))?/i.test(
    text
  );

const countMatches = (text: string, patterns: RegExp[]): number =>
  patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);

const scoreArWindows = (workItems: WorkItem[], fileName: string): number => {
  const text = normalizeText(
    `${fileName} ${workItems.map(itemSearchText).join(" ")}`
  );
  const sizeMatches = text.match(/\b\d{3,5}\s*(?:x|х|×)\s*\d{3,5}\b/g) ?? [];

  return (
    (hasWindowMark(text) ? 3 : 0) +
    countMatches(text, [
      /витраж/,
      /окн[ао]?/,
      /алюминиев(?:ый|ого|ом)? профиль/,
      /гост\s*22233/,
      /гост\s*24866/,
    ]) +
    Math.min(sizeMatches.length, 3)
  );
};

const scoreOvik = (workItems: WorkItem[], fileName: string): number => {
  const text = normalizeText(
    `${fileName} ${workItems.map(itemSearchText).join(" ")}`
  );

  return countMatches(text, [
    /овик/,
    /вентиляц/,
    /воздуховод/,
    /клапан/,
    /решетк/,
    /фильтр/,
    /шумоглуш/,
    /\bned\b/,
    /\blitened\b/,
    /\bairned\b/,
    /\bkorf\b/,
    /\bveza\b/,
    /\bвеза\b/,
  ]);
};

export const classifyOfferDiscipline = (
  workItems: WorkItem[],
  fileName: string
): OfferDiscipline => {
  const arScore = scoreArWindows(workItems, fileName);
  const ovikScore = scoreOvik(workItems, fileName);

  if (arScore >= 3 && arScore > ovikScore) {
    return "ar_windows";
  }

  if (ovikScore >= 2 && ovikScore >= arScore) {
    return "ovik";
  }

  return "unknown";
};

const inferSourceDiscipline = (
  item: WorkItem
): NonNullable<WorkItem["sourceDiscipline"]> => {
  if (item.sourceDiscipline) {
    return item.sourceDiscipline;
  }

  if (item.extractionStrategy === "ar_windows_ocr") {
    return "ar_windows";
  }

  if (item.extractionStrategy === "pdf_text") {
    return "text_pdf";
  }

  return "unknown";
};

const inferExtractionStrategy = (
  item: WorkItem
): NonNullable<WorkItem["extractionStrategy"]> => {
  if (item.extractionStrategy) {
    return item.extractionStrategy;
  }

  return inferSourceDiscipline(item) === "ar_windows"
    ? "ar_windows_ocr"
    : "pdf_text";
};

const annotateProjectItems = (
  items: WorkItem[],
  sourceFileName: string
): WorkItem[] =>
  items.map((item) => ({
    ...item,
    sourceFileName: item.sourceFileName ?? sourceFileName,
    sourceDiscipline: inferSourceDiscipline(item),
    extractionStrategy: inferExtractionStrategy(item),
  }));

const getDeduplicationKey = (item: WorkItem): string =>
  [
    item.sourceFileName ?? "",
    item.position ?? "",
    item.name,
    item.rate,
    item.unit,
    String(item.projectVolume),
  ]
    .map((part) => normalizeText(part))
    .join("|");

const dedupeWorkItems = (items: WorkItem[]): WorkItem[] => {
  const seen = new Set<string>();
  const deduped: WorkItem[] = [];

  for (const item of items) {
    const key = getDeduplicationKey(item);

    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
};

const groupProjectWorkItems = (items: WorkItem[]) => {
  const allProjectWorkItems = dedupeWorkItems(items);
  const arWindowsWorkItems = allProjectWorkItems.filter(
    (item) => item.sourceDiscipline === "ar_windows"
  );
  const ovikWorkItems = allProjectWorkItems.filter(
    (item) =>
      item.sourceDiscipline === "ovik" || item.sourceDiscipline === "text_pdf"
  );
  const unknownWorkItems = allProjectWorkItems.filter(
    (item) => item.sourceDiscipline === "unknown" || !item.sourceDiscipline
  );

  return {
    allProjectWorkItems,
    ovikWorkItems,
    arWindowsWorkItems,
    unknownWorkItems,
  };
};

const defaultRunUnifiedCompare = ({
  mode,
  projectPdf,
  offerFile,
  offerItems,
}: RunUnifiedCompareInput) =>
  loadUnifiedProjectPdfCompare({
    mode,
    pdfFile: projectPdf,
    excelOfferFile: offerFile,
    offerItems,
  });

const defaultLoadProjectPdf = ({
  mode,
  projectPdf,
  seedOfferFile,
  seedOfferItems,
}: LoadProjectPdfInput) =>
  loadUnifiedProjectPdfCompare({
    mode,
    pdfFile: projectPdf,
    excelOfferFile: seedOfferFile,
    offerItems: seedOfferItems,
  });

const buildSuccessSummary = (
  file: File,
  offerItems: WorkItem[],
  result: UnifiedPdfProjectCompareResult,
  totalProjectWorkItemsCount: number,
  detectedOfferDiscipline: OfferDiscipline,
  matchedProjectDiscipline: MatchedProjectDiscipline,
  warning?: string
): BatchCompareSummary => ({
  offerFilename: file.name,
  excelOfferWorkItemsCount: offerItems.length,
  totalProjectWorkItemsCount,
  projectWorkItemsUsedCount: result.workItems.length,
  detectedOfferDiscipline,
  matchedProjectDiscipline,
  okCount: countStatus(result.results, "ОК" as CompareResult["status"]),
  volumeDiffCount: countStatus(
    result.results,
    "Объем отличается" as CompareResult["status"]
  ),
  sizeDiffCount: countStatus(
    result.results,
    "Размер отличается" as CompareResult["status"]
  ),
  missingCount: countStatus(
    result.results,
    "Нет в КП" as CompareResult["status"]
  ),
  extraOfferCount: countStatus(
    result.results,
    "Есть в КП, нет в спецификации" as CompareResult["status"]
  ),
  warning,
});

const buildFailureSummary = (
  file: File,
  offerItems: WorkItem[],
  totalProjectWorkItemsCount: number,
  error: string
): BatchCompareSummary => ({
  offerFilename: file.name,
  excelOfferWorkItemsCount: offerItems.length,
  totalProjectWorkItemsCount,
  projectWorkItemsUsedCount: 0,
  detectedOfferDiscipline: "unknown",
  matchedProjectDiscipline: "all_project",
  okCount: 0,
  volumeDiffCount: 0,
  sizeDiffCount: 0,
  missingCount: 0,
  extraOfferCount: 0,
  error,
});

const selectProjectItems = (
  offer: BatchOfferInput,
  groupedProjectItems: ReturnType<typeof groupProjectWorkItems>
) => {
  const detectedOfferDiscipline = classifyOfferDiscipline(
    offer.offerItems,
    offer.file.name
  );
  const override = offer.disciplineOverride ?? "auto";
  const effectiveDiscipline =
    override === "auto" ? detectedOfferDiscipline : override;

  if (effectiveDiscipline === "ar_windows") {
    return {
      projectItems: groupedProjectItems.arWindowsWorkItems,
      detectedOfferDiscipline,
      matchedProjectDiscipline: "ar_windows" as const,
      warning: undefined,
    };
  }

  if (effectiveDiscipline === "ovik") {
    return {
      projectItems: groupedProjectItems.ovikWorkItems,
      detectedOfferDiscipline,
      matchedProjectDiscipline: "ovik" as const,
      warning: undefined,
    };
  }

  return {
    projectItems: groupedProjectItems.allProjectWorkItems,
    detectedOfferDiscipline,
    matchedProjectDiscipline: "all_project" as const,
    warning:
      effectiveDiscipline === "unknown" ? UNKNOWN_DISCIPLINE_WARNING : undefined,
  };
};

const buildRoutedCompareResult = (
  projectItems: WorkItem[],
  offerItems: WorkItem[],
  results: CompareResult[],
  totalProjectWorkItemsCount: number
): UnifiedPdfProjectCompareResult => ({
  workItems: projectItems,
  results,
  statusCounts: countStatuses(results),
  technicalInfo: {
    totalProjectWorkItemsCount,
    textPdfWorkItemsCount: projectItems.filter(
      (item) => item.sourceDiscipline === "text_pdf" || item.sourceDiscipline === "ovik"
    ).length,
    arWindowsWorkItemsCount: projectItems.filter(
      (item) => item.sourceDiscipline === "ar_windows"
    ).length,
    extractionStrategiesUsed: Array.from(
      new Set(
        projectItems
          .map((item) => item.extractionStrategy)
          .filter(Boolean) as NonNullable<WorkItem["extractionStrategy"]>[]
      )
    ),
    fallbackUsed: projectItems.some(
      (item) => item.extractionStrategy === "fallback"
    ),
  },
});

const loadProjectWorkItems = async ({
  mode,
  projectPdf,
  projectPdfs,
  offers,
  projectWorkItems,
  loadProjectPdf,
}: Pick<
  LoadBatchProjectPdfCompareInput,
  "mode" | "projectPdf" | "projectPdfs" | "offers" | "projectWorkItems" | "loadProjectPdf"
>): Promise<WorkItem[] | null> => {
  if (projectWorkItems) {
    return annotateProjectItems(projectWorkItems, "project");
  }

  const shouldLoadProjectItems =
    Boolean(projectPdfs?.length) || Boolean(loadProjectPdf);
  const files = projectPdfs ?? (shouldLoadProjectItems && projectPdf ? [projectPdf] : []);

  if (files.length === 0 || offers.length === 0) {
    return null;
  }

  const seedOffer = offers[0];
  const projectItems: WorkItem[] = [];
  const runLoadProjectPdf = loadProjectPdf ?? defaultLoadProjectPdf;

  for (const file of files) {
    const result = await runLoadProjectPdf({
      mode,
      projectPdf: file,
      seedOfferFile: seedOffer.file,
      seedOfferItems: seedOffer.offerItems,
    });

    projectItems.push(...annotateProjectItems(result.workItems, file.name));
  }

  return projectItems;
};

export const loadBatchProjectPdfCompare = async ({
  mode,
  projectPdf,
  projectPdfs,
  offers,
  projectWorkItems,
  loadProjectPdf,
  runCompare = compareWorkItems,
  runUnifiedCompare = defaultRunUnifiedCompare,
}: LoadBatchProjectPdfCompareInput): Promise<BatchCompareResult> => {
  const projectItems = await loadProjectWorkItems({
    mode,
    projectPdf,
    projectPdfs,
    offers,
    projectWorkItems,
    loadProjectPdf,
  });

  if (projectItems) {
    const groupedProjectItems = groupProjectWorkItems(projectItems);
    const results: BatchCompareEntry[] = [];

    for (const [index, offer] of offers.entries()) {
      const id = buildId(offer.file, index);

      try {
        const {
          projectItems: selectedProjectItems,
          detectedOfferDiscipline,
          matchedProjectDiscipline,
          warning,
        } = selectProjectItems(offer, groupedProjectItems);
        const comparison = runCompare(selectedProjectItems, offer.offerItems);
        const compareResult = buildRoutedCompareResult(
          selectedProjectItems,
          offer.offerItems,
          comparison,
          groupedProjectItems.allProjectWorkItems.length
        );

        results.push({
          id,
          status: "success",
          summary: buildSuccessSummary(
            offer.file,
            offer.offerItems,
            compareResult,
            groupedProjectItems.allProjectWorkItems.length,
            detectedOfferDiscipline,
            matchedProjectDiscipline,
            warning
          ),
          compareResult,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to compare offer";

        results.push({
          id,
          status: "failed",
          summary: buildFailureSummary(
            offer.file,
            offer.offerItems,
            groupedProjectItems.allProjectWorkItems.length,
            message
          ),
          error: message,
        });
      }
    }

    return {
      results,
      ...groupedProjectItems,
    };
  }

  const results: BatchCompareEntry[] = [];

  for (const [index, offer] of offers.entries()) {
    const id = buildId(offer.file, index);

    try {
      if (!projectPdf) {
        throw new Error("Project PDF is required");
      }

      const compareResult = await runUnifiedCompare({
        mode,
        projectPdf,
        offerFile: offer.file,
        offerItems: offer.offerItems,
      });

      results.push({
        id,
        status: "success",
        summary: buildSuccessSummary(
          offer.file,
          offer.offerItems,
          compareResult,
          compareResult.technicalInfo.totalProjectWorkItemsCount,
          classifyOfferDiscipline(offer.offerItems, offer.file.name),
          "all_project"
        ),
        compareResult,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to compare offer";

      results.push({
        id,
        status: "failed",
        summary: buildFailureSummary(offer.file, offer.offerItems, 0, message),
        error: message,
      });
    }
  }

  const allProjectWorkItems = results.flatMap((entry) =>
    entry.status === "success" ? entry.compareResult.workItems : []
  );
  const groupedProjectItems = groupProjectWorkItems(allProjectWorkItems);

  return {
    results,
    ...groupedProjectItems,
  };
};

export const getSelectedBatchResult = (
  batch: BatchCompareResult | null,
  id: string | null
): BatchCompareEntry | undefined =>
  batch?.results.find((result) => result.id === id);
