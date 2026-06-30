import * as XLSX from "xlsx-js-style";
import type { CompareResult, WorkItem } from "./types";
import type {
  BatchCompareResult,
  BatchCompareSuccess,
  MatchedProjectDiscipline,
  OfferDiscipline,
} from "./projectPdf/loadBatchProjectPdfCompare";

const STATUS_EXTRA = "Есть в КП, нет в спецификации" as CompareResult["status"];
const STATUS_OK = "ОК" as CompareResult["status"];
const STATUS_MISSING = "Нет в КП" as CompareResult["status"];

const borderThin = { style: "thin", color: { rgb: "D1D5DB" } };
const borderMedium = { style: "medium", color: { rgb: "6B7280" } };

const baseBorder = {
  top: borderThin,
  bottom: borderThin,
  left: borderThin,
  right: borderThin,
};

const headerStyle = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "374151" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: baseBorder,
};

const blockHeaderStyle = {
  font: { bold: true, color: { rgb: "111827" } },
  fill: { fgColor: { rgb: "E5E7EB" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: borderMedium,
    bottom: borderMedium,
    left: borderMedium,
    right: borderMedium,
  },
};

const statusStyle: Record<string, { fill: string; font: string }> = {
  ["Совпадает"]: { fill: "DCFCE7", font: "166534" },
  ["Объем отличается"]: { fill: "FFEDD5", font: "9A3412" },
  ["Размер отличается"]: { fill: "EDE9FE", font: "6D28D9" },
  ["Нет в КП"]: { fill: "FEE2E2", font: "991B1B" },
  ["Есть в КП, нет в спецификации"]: { fill: "DBEAFE", font: "1D4ED8" },
  ["Частичное совпадение"]: { fill: "FEF9C3", font: "854D0E" },
  ["Агрегированная позиция"]: { fill: "E0F2FE", font: "075985" },
  ["Количество в PDF не распознано"]: { fill: "F5F3FF", font: "5B21B6" },
  ["Вне области КП"]: { fill: "F3F4F6", font: "4B5563" },
};

const disciplineLabel = (
  value: OfferDiscipline | MatchedProjectDiscipline | "text_pdf"
): string => {
  if (value === "ar_windows") return "АР окна / витражи";
  if (value === "ovik") return "ОВиК";
  if (value === "text_pdf") return "Текстовый PDF";
  if (value === "unknown") return "Не определено";
  if (value === "all_project") return "Весь проект";
  return "Не определено";
};

const strategyLabel = (value: string | undefined): string => {
  if (value === "pdf_text") return "Извлечение текста из PDF";
  if (value === "ar_windows_ocr") {
    return "Распознавание АР окон / витражей";
  }
  if (value === "fallback") return "Резервный режим";
  return "Не определено";
};

const statusLabel = (status: CompareResult["status"] | undefined): string => {
  if (status === STATUS_OK) return "Совпадает";
  return status ?? "";
};

const normalizeText = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();

const cleanComment = (result: CompareResult | undefined): string => {
  if (!result) return "Позиция не найдена в КП";
  if (result.status === STATUS_OK) {
    if (result.rate) return `Совпала позиция ${result.rate}`;
    if (result.offerName) return `Совпала позиция ${result.offerName}`;
    return "Позиция найдена в КП";
  }
  if (result.status === "Объем отличается") return "Объем отличается";
  if (result.status === "Размер отличается") return "Размер отличается";
  if (result.status === STATUS_MISSING) return "Позиция не найдена в КП";
  if (result.status === STATUS_EXTRA) {
    return "Позиция КП не найдена в спецификации";
  }
  if (result.status === "Частичное совпадение") {
    return "Найдено частичное совпадение, требуется проверка";
  }
  if (result.status === "Агрегированная позиция") {
    return "Позиция учтена через связанные строки КП";
  }
  if (result.status === "Количество в PDF не распознано") {
    return "Количество в проекте не распознано, требуется проверка";
  }
  if (result.status === "Вне области КП") {
    return "Позиция вне раздела этого КП";
  }

  return "Требуется проверка";
};

const successEntries = (batch: BatchCompareResult): BatchCompareSuccess[] =>
  batch.results.filter(
    (entry): entry is BatchCompareSuccess => entry.status === "success"
  );

const entriesForDiscipline = (
  batch: BatchCompareResult,
  discipline: Exclude<MatchedProjectDiscipline, "all_project">
): BatchCompareSuccess[] =>
  successEntries(batch).filter(
    (entry) =>
      entry.summary.detectedOfferDiscipline === discipline ||
      entry.summary.matchedProjectDiscipline === discipline
  );

const specKeyFromWorkItem = (item: WorkItem): string =>
  [
    item.position,
    item.rate,
    item.name,
    item.unit,
    item.projectVolume,
  ]
    .map(normalizeText)
    .join("|");

const specKeyFromCompareResult = (item: CompareResult): string =>
  [undefined, item.rate, item.name, item.unit, item.specVolume]
    .map(normalizeText)
    .join("|");

const findResultForSpec = (
  entry: BatchCompareSuccess,
  specItem: WorkItem
): CompareResult | undefined => {
  const key = specKeyFromWorkItem(specItem);

  return entry.compareResult.results.find(
    (result) =>
      result.status !== STATUS_EXTRA &&
      (specKeyFromCompareResult(result) === key ||
        normalizeText(result.name) === normalizeText(specItem.name))
  );
};

const addSheet = (
  workbook: XLSX.WorkBook,
  rows: unknown[][],
  name: string,
  columnWidths: number[],
  headerRows = 1
) => {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = columnWidths.map((wch) => ({ wch }));
  worksheet["!autofilter"] = { ref: worksheet["!ref"] ?? "A1:A1" };
  worksheet["!freeze"] = { xSplit: 0, ySplit: headerRows };
  styleWorksheet(worksheet, headerRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
};

const styleWorksheet = (worksheet: XLSX.WorkSheet, headerRows: number) => {
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");

  for (let row = range.s.r; row <= range.e.r; row++) {
    const rowValues: string[] = [];

    for (let col = range.s.c; col <= range.e.c; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[address];
      if (!cell) continue;

      rowValues.push(String(cell.v));
      cell.s = {
        alignment: { vertical: "top", wrapText: true },
        border: baseBorder,
      };

      if (row < headerRows) {
        cell.s = row === 0 && headerRows > 1 ? blockHeaderStyle : headerStyle;
      }
    }

    if (row < headerRows) continue;

    const foundStatus = rowValues.map((value) => statusStyle[value]).find(Boolean);
    if (!foundStatus) continue;

    for (let col = range.s.c; col <= range.e.c; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[address];
      if (!cell) continue;

      cell.s = {
        ...cell.s,
        fill: { fgColor: { rgb: foundStatus.fill } },
        font: { color: { rgb: foundStatus.font } },
      };
    }
  }
};

const summaryRows = (batch: BatchCompareResult): unknown[][] => [
  [
    "КП",
    "Определенный раздел КП",
    "Раздел проекта",
    "Позиций проекта использовано",
    "Позиций в КП",
    "Совпадает",
    "Объем отличается",
    "Размер отличается",
    "Нет в КП",
    "Лишнее в КП",
    "Предупреждение",
  ],
  ...batch.results.map((entry) => [
    entry.summary.offerFilename,
    disciplineLabel(entry.summary.detectedOfferDiscipline),
    disciplineLabel(entry.summary.matchedProjectDiscipline),
    entry.summary.projectWorkItemsUsedCount,
    entry.summary.excelOfferWorkItemsCount,
    entry.summary.okCount,
    entry.summary.volumeDiffCount,
    entry.summary.sizeDiffCount,
    entry.summary.missingCount,
    entry.summary.extraOfferCount,
    entry.summary.warning
      ? "Раздел КП не определен, сравнение выполнено со всем проектом"
      : entry.summary.error ?? "",
  ]),
];

const disciplineRows = (
  batch: BatchCompareResult,
  discipline: Exclude<MatchedProjectDiscipline, "all_project">
): unknown[][] => {
  const entries = entriesForDiscipline(batch, discipline);
  const specItems =
    discipline === "ar_windows" ? batch.arWindowsWorkItems : batch.ovikWorkItems;
  const topHeader = ["Спецификация", "", "", ""];
  const secondHeader = [
    "Позиция спецификации",
    "Наименование по спецификации",
    "Ед. изм.",
    "Кол-во по спецификации",
  ];

  for (const entry of entries) {
    topHeader.push(entry.summary.offerFilename, "", "", "", "", "");
    secondHeader.push(
      "Позиция в КП",
      "Наименование в КП",
      "Кол-во в КП",
      "Совпадение",
      "Статус",
      "Комментарий"
    );
  }

  const rows = specItems.map((specItem) => {
    const row: unknown[] = [
      specItem.position || specItem.rate || specItem.name,
      specItem.name,
      specItem.unit,
      specItem.projectVolume,
    ];

    for (const entry of entries) {
      const result = findResultForSpec(entry, specItem);

      row.push(
        result?.offerRate || result?.offerName || "",
        result?.offerName ?? "",
        result?.offerVolume ?? "",
        result?.similarity ? `${Math.round(result.similarity)}%` : "",
        statusLabel(result?.status ?? STATUS_MISSING),
        cleanComment(result)
      );
    }

    return row;
  });

  return [topHeader, secondHeader, ...rows];
};

const extraRows = (batch: BatchCompareResult): unknown[][] => [
  [
    "КП",
    "Раздел",
    "Позиция КП",
    "Наименование КП",
    "Кол-во в КП",
    "Статус",
    "Комментарий",
  ],
  ...successEntries(batch)
    .flatMap((entry) =>
      entry.compareResult.results
        .filter((result) => result.status === STATUS_EXTRA)
        .map((result) => [
          entry.summary.offerFilename,
          disciplineLabel(entry.summary.matchedProjectDiscipline),
          result.offerRate,
          result.offerName,
          result.offerVolume,
          statusLabel(result.status),
          cleanComment(result),
        ])
    )
    .sort((a, b) => `${a[1]} ${a[0]}`.localeCompare(`${b[1]} ${b[0]}`)),
];

const technicalRows = (batch: BatchCompareResult): unknown[][] => {
  const strategies = Array.from(
    new Set(
      successEntries(batch).flatMap(
        (entry) => entry.compareResult.technicalInfo.extractionStrategiesUsed
      )
    )
  );

  return [
    ["Показатель", "Значение"],
    ["Всего позиций проекта", batch.allProjectWorkItems.length],
    ["Позиции текстового PDF", batch.ovikWorkItems.length],
    ["Позиции АР окон", batch.arWindowsWorkItems.length],
    ["Позиции без раздела", batch.unknownWorkItems.length],
    [
      "Использованные стратегии извлечения",
      strategies.map(strategyLabel).join(", ") || "Не определено",
    ],
    [
      "Использован резервный режим",
      successEntries(batch).some(
        (entry) => entry.compareResult.technicalInfo.fallbackUsed
      )
        ? "Да"
        : "Нет",
    ],
  ];
};

export const buildBatchComparisonWorkbook = (
  batch: BatchCompareResult
): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  const disciplineWidths = [
    18, 55, 8, 12,
    ...Array.from({ length: Math.max(successEntries(batch).length, 1) }).flatMap(
      () => [18, 55, 12, 12, 22, 45]
    ),
  ];

  addSheet(workbook, summaryRows(batch), "Сводка", [
    30, 26, 24, 24, 16, 12, 18, 18, 14, 16, 48,
  ]);
  addSheet(
    workbook,
    disciplineRows(batch, "ar_windows"),
    "АР окна - витражи",
    disciplineWidths,
    2
  );
  addSheet(workbook, disciplineRows(batch, "ovik"), "ОВиК", disciplineWidths, 2);
  addSheet(workbook, extraRows(batch), "Лишние позиции КП", [
    30, 24, 20, 55, 12, 28, 45,
  ]);
  addSheet(workbook, technicalRows(batch), "Техническая информация", [36, 70]);

  return workbook;
};

export const exportBatchComparisonReport = (batch: BatchCompareResult) => {
  XLSX.writeFile(
    buildBatchComparisonWorkbook(batch),
    "tendercheck-batch-report.xlsx"
  );
};
