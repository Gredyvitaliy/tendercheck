import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

import { extractPdfPageTexts } from "../projectPdf/pdfTextExtractor";

export type DatasetDiscipline =
  | "ovik"
  | "ar"
  | "ar_windows"
  | "eom"
  | "vk"
  | "kj"
  | "unknown";

export type DatasetExcelType =
  | "offer_excel"
  | "estimate_excel"
  | "specification_excel"
  | "unknown_excel";

export interface ClassifiedPdfFile {
  filePath: string;
  discipline: DatasetDiscipline;
  confidence: number;
  reason: string;
}

export interface ClassifiedExcelFile {
  filePath: string;
  excelType: DatasetExcelType;
  confidence: number;
  reason: string;
}

export interface DatasetCandidateCase {
  caseName: string;
  discipline: DatasetDiscipline;
  projectPdf: string;
  offerFiles: string[];
  confidence: number;
  reason: string;
}

export interface DatasetScoutSummary {
  rootDir: string;
  pdfFound: number;
  excelFound: number;
  candidateCasesCount: number;
  disciplineCounts: Record<DatasetDiscipline, number>;
  errors: Array<{ filePath: string; error: string }>;
}

export interface DatasetScoutResult {
  pdfFiles: ClassifiedPdfFile[];
  excelFiles: ClassifiedExcelFile[];
  candidates: DatasetCandidateCase[];
  summary: DatasetScoutSummary;
}

export interface DatasetScoutOptions {
  outputDir?: string;
  extractPdfText?: (filePath: string) => Promise<string>;
  readExcelPreview?: (filePath: string) => Promise<string>;
}

interface ClassifyPdfInput {
  filePath: string;
  extractedText?: string;
}

interface ClassifyExcelInput {
  filePath: string;
  previewText?: string;
}

const DISCIPLINES: DatasetDiscipline[] = [
  "ovik",
  "ar",
  "ar_windows",
  "eom",
  "vk",
  "kj",
  "unknown",
];

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\\/_.(),;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasToken = (text: string, token: string): boolean => {
  const normalizedToken = normalizeText(token);

  if (/^[а-яa-z0-9]{1,4}$/i.test(normalizedToken)) {
    return new RegExp(`(^|\\s)${normalizedToken}(\\s|$)`, "i").test(text);
  }

  return text.includes(normalizedToken);
};

const countHits = (text: string, tokens: string[]): string[] =>
  tokens.filter((token) => hasToken(text, token));

const pdfSignals: Record<Exclude<DatasetDiscipline, "unknown">, string[]> = {
  eom: [
    "ЭОМ",
    "ЭС",
    "электроснабжение",
    "электрооборудование",
    "освещение",
    "кабель",
    "кабельная линия",
    "щит",
    "ВРУ",
    "шкаф",
    "автоматический выключатель",
  ],
  vk: [
    "ВК",
    "водоснабжение",
    "канализация",
    "водоотведение",
    "труба",
    "фитинг",
    "насос",
    "задвижка",
    "клапан",
    "сантехника",
  ],
  kj: [
    "КЖ",
    "конструкции железобетонные",
    "бетон",
    "арматура",
    "фундамент",
    "плита",
    "колонна",
    "балка",
    "монолит",
    "каркас",
  ],
  ar: [
    "АР",
    "архитектурные решения",
    "окна",
    "витражи",
    "двери",
    "перегородки",
    "фасад",
    "спецификация заполнения проемов",
  ],
  ar_windows: [
    "окна",
    "витражи",
    "ГОСТ 22233",
    "ГОСТ 24866",
    "алюминиевый профиль",
    "СПД",
    "спецификация окон",
    "спецификация витражей",
  ],
  ovik: [
    "ОВ",
    "ОВиК",
    "вентиляция",
    "кондиционирование",
    "воздуховод",
    "решетка",
    "клапан",
    "фильтр",
    "шумоглушитель",
    "вентилятор",
    "AIRNED",
    "LITENED",
    "NED",
  ],
};

const excelSignals: Record<Exclude<DatasetExcelType, "unknown_excel">, string[]> = {
  offer_excel: [
    "КП",
    "коммерческое предложение",
    "предложение",
    "поставщик",
    "подрядчик",
    "цена",
    "стоимость",
    "сумма",
    "артикул",
    "количество",
    "ед. изм.",
  ],
  estimate_excel: [
    "смета",
    "локальная смета",
    "ЛСР",
    "КС-2",
    "ФЕР",
    "ТЕР",
    "расценка",
    "стоимость работ",
  ],
  specification_excel: [
    "спецификация",
    "ведомость",
    "ВОР",
    "объем работ",
    "оборудование",
    "материалы",
  ],
};

const hasWindowMark = (text: string): boolean =>
  /(^|\s)[bв]\s*-\s*\d+\s*(\*|\((зер|зерк\.?|зеркальное)\))?/i.test(text);

const scoreDiscipline = (
  text: string,
  discipline: Exclude<DatasetDiscipline, "unknown">
) => {
  const hits = countHits(text, pdfSignals[discipline]);
  const windowBonus = discipline === "ar_windows" && hasWindowMark(text) ? 2 : 0;

  return {
    score: hits.length + windowBonus,
    hits,
  };
};

export const classifyPdfFile = ({
  filePath,
  extractedText = "",
}: ClassifyPdfInput): ClassifiedPdfFile => {
  const text = normalizeText(`${filePath} ${extractedText}`);
  const scores = (Object.keys(pdfSignals) as Exclude<DatasetDiscipline, "unknown">[])
    .map((discipline) => ({
      discipline,
      ...scoreDiscipline(text, discipline),
    }))
    .sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (!best || best.score === 0) {
    return {
      filePath,
      discipline: "unknown",
      confidence: 0.2,
      reason: "PDF discipline unknown: no strong local signals",
    };
  }

  return {
    filePath,
    discipline: best.discipline,
    confidence: Math.min(0.95, 0.35 + best.score * 0.12),
    reason: `PDF classified as ${best.discipline}: ${best.hits.slice(0, 5).join(", ")}`,
  };
};

export const classifyExcelFile = ({
  filePath,
  previewText = "",
}: ClassifyExcelInput): ClassifiedExcelFile => {
  const text = normalizeText(`${filePath} ${previewText}`);
  const scores = (Object.keys(excelSignals) as Exclude<DatasetExcelType, "unknown_excel">[])
    .map((excelType) => ({
      excelType,
      hits: countHits(text, excelSignals[excelType]),
    }))
    .map((entry) => ({ ...entry, score: entry.hits.length }))
    .sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (!best || best.score === 0) {
    return {
      filePath,
      excelType: "unknown_excel",
      confidence: 0.2,
      reason: "Excel type unknown: no strong local signals",
    };
  }

  return {
    filePath,
    excelType: best.excelType,
    confidence: Math.min(0.95, 0.35 + best.score * 0.12),
    reason: `Excel classified as ${best.excelType}: ${best.hits.slice(0, 5).join(", ")}`,
  };
};

const getCaseName = (filePath: string): string => path.basename(path.dirname(filePath));

const areRelated = (pdfPath: string, excelPath: string): boolean => {
  const pdfDir = path.dirname(pdfPath);
  const excelDir = path.dirname(excelPath);

  return (
    pdfDir === excelDir ||
    path.dirname(excelDir) === pdfDir ||
    path.dirname(pdfDir) === excelDir
  );
};

export const buildCandidateCases = ({
  rootDir,
  pdfFiles,
  excelFiles,
}: {
  rootDir: string;
  pdfFiles: ClassifiedPdfFile[];
  excelFiles: ClassifiedExcelFile[];
}): DatasetCandidateCase[] => {
  const candidates: DatasetCandidateCase[] = [];
  const offerExcels = excelFiles.filter(
    (file) => file.excelType === "offer_excel" || file.excelType === "unknown_excel"
  );

  for (const pdf of pdfFiles) {
    const relatedOffers = offerExcels.filter((excel) =>
      areRelated(pdf.filePath, excel.filePath)
    );

    if (relatedOffers.length === 0) continue;

    const excelPenalty = relatedOffers.some(
      (excel) => excel.excelType === "unknown_excel"
    )
      ? 0.15
      : 0;
    const disciplinePenalty = pdf.discipline === "unknown" ? 0.2 : 0;
    const relationBoost = 0.1;
    const averageExcelConfidence =
      relatedOffers.reduce((sum, excel) => sum + excel.confidence, 0) /
      relatedOffers.length;
    const confidence = Math.max(
      0.05,
      Math.min(
        0.98,
        (pdf.confidence + averageExcelConfidence) / 2 +
          relationBoost -
          excelPenalty -
          disciplinePenalty
      )
    );

    candidates.push({
      caseName: getCaseName(pdf.filePath) || path.basename(rootDir),
      discipline: pdf.discipline,
      projectPdf: pdf.filePath,
      offerFiles: relatedOffers.map((excel) => excel.filePath),
      confidence: Number(confidence.toFixed(2)),
      reason: [
        pdf.reason,
        `Excel offers: ${relatedOffers.map((excel) => path.basename(excel.filePath)).join(", ")}`,
        "Files are in the same folder or neighboring subfolder",
      ].join("; "),
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
};

const walkFiles = async (rootDir: string): Promise<string[]> => {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
};

const defaultExtractPdfText = async (filePath: string): Promise<string> => {
  const data = await readFile(filePath);
  const pages = await extractPdfPageTexts(data);

  return pages
    .slice(0, 5)
    .map((page) => page.text)
    .join("\n");
};

const defaultReadExcelPreview = async (filePath: string): Promise<string> => {
  const workbook = XLSX.read(await readFile(filePath), {
    type: "buffer",
    sheetRows: 20,
  });

  return workbook.SheetNames.slice(0, 3)
    .map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });

      return `${sheetName}\n${rows
        .flat()
        .map((value) => String(value))
        .join(" ")}`;
    })
    .join("\n");
};

const emptyDisciplineCounts = (): Record<DatasetDiscipline, number> =>
  Object.fromEntries(DISCIPLINES.map((discipline) => [discipline, 0])) as Record<
    DatasetDiscipline,
    number
  >;

const buildSummary = ({
  rootDir,
  pdfFiles,
  excelFiles,
  candidates,
  errors,
}: {
  rootDir: string;
  pdfFiles: ClassifiedPdfFile[];
  excelFiles: ClassifiedExcelFile[];
  candidates: DatasetCandidateCase[];
  errors: Array<{ filePath: string; error: string }>;
}): DatasetScoutSummary => {
  const disciplineCounts = emptyDisciplineCounts();

  for (const candidate of candidates) {
    disciplineCounts[candidate.discipline] += 1;
  }

  return {
    rootDir,
    pdfFound: pdfFiles.length,
    excelFound: excelFiles.length,
    candidateCasesCount: candidates.length,
    disciplineCounts,
    errors,
  };
};

export const runDatasetScout = async (
  rootDir: string,
  options: DatasetScoutOptions = {}
): Promise<DatasetScoutResult> => {
  const outputDir = options.outputDir ?? path.join(process.cwd(), "debug");
  const extractPdfText = options.extractPdfText ?? defaultExtractPdfText;
  const readExcelPreview = options.readExcelPreview ?? defaultReadExcelPreview;
  const allFiles = await walkFiles(rootDir);
  const pdfPaths = allFiles.filter((file) => file.toLowerCase().endsWith(".pdf"));
  const excelPaths = allFiles.filter((file) =>
    /\.(xlsx|xls)$/i.test(file)
  );
  const errors: Array<{ filePath: string; error: string }> = [];
  const pdfFiles: ClassifiedPdfFile[] = [];
  const excelFiles: ClassifiedExcelFile[] = [];

  for (const filePath of pdfPaths) {
    let extractedText = "";

    try {
      extractedText = await extractPdfText(filePath);
    } catch (error) {
      errors.push({
        filePath,
        error: error instanceof Error ? error.message : "Failed to read PDF",
      });
    }

    pdfFiles.push(classifyPdfFile({ filePath, extractedText }));
  }

  for (const filePath of excelPaths) {
    let previewText = "";

    try {
      previewText = await readExcelPreview(filePath);
    } catch (error) {
      errors.push({
        filePath,
        error: error instanceof Error ? error.message : "Failed to read Excel",
      });
    }

    excelFiles.push(classifyExcelFile({ filePath, previewText }));
  }

  const candidates = buildCandidateCases({ rootDir, pdfFiles, excelFiles });
  const summary = buildSummary({
    rootDir,
    pdfFiles,
    excelFiles,
    candidates,
    errors,
  });
  const result: DatasetScoutResult = {
    pdfFiles,
    excelFiles,
    candidates,
    summary,
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "dataset-candidates.json"),
    JSON.stringify(candidates, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(outputDir, "dataset-scout-summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );

  return result;
};

export const formatDatasetScoutConsoleSummary = (
  result: DatasetScoutResult
): string => {
  const lines = [
    "Dataset Scout summary",
    `PDF found: ${result.summary.pdfFound}`,
    `Excel found: ${result.summary.excelFound}`,
    `Candidate cases: ${result.summary.candidateCasesCount}`,
    "Disciplines:",
    ...DISCIPLINES.map(
      (discipline) =>
        `  ${discipline}: ${result.summary.disciplineCounts[discipline]}`
    ),
    "",
    "Top candidate cases:",
    ...result.candidates.slice(0, 20).map(
      (candidate, index) =>
        `${index + 1}. ${candidate.caseName} | ${candidate.discipline} | ${path.basename(
          candidate.projectPdf
        )} | offers: ${candidate.offerFiles.length} | confidence: ${candidate.confidence} | ${candidate.reason}`
    ),
  ];

  if (result.summary.errors.length > 0) {
    lines.push("", "Errors:");
    lines.push(
      ...result.summary.errors.map(
        (error) => `  ${path.basename(error.filePath)}: ${error.error}`
      )
    );
  }

  return lines.join("\n");
};
