import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx-js-style";

import type { CompareResult, WorkItem } from "./types";
import type { BatchCompareResult } from "./projectPdf/loadBatchProjectPdfCompare";
import { buildBatchComparisonWorkbook } from "./exportBatchReport";
import { exportResultsToExcel } from "./exportReport";

const ok = "ОК" as CompareResult["status"];
const missing = "Нет в КП" as CompareResult["status"];
const extra = "Есть в КП, нет в спецификации" as CompareResult["status"];

const projectItem = (
  name: string,
  rate: string,
  sourceDiscipline: NonNullable<WorkItem["sourceDiscipline"]>,
  position?: string
): WorkItem => ({
  number: 1,
  position,
  name,
  rate,
  unit: "шт",
  projectVolume: 1,
  rowType: "item",
  sourceFileName: sourceDiscipline === "ar_windows" ? "ar.pdf" : "ovik.pdf",
  sourceDiscipline,
  extractionStrategy:
    sourceDiscipline === "ar_windows" ? "ar_windows_ocr" : "pdf_text",
});

const compare = (
  spec: WorkItem,
  status: CompareResult["status"],
  offerName = spec.name,
  reason = "Стратегия: mark-based"
): CompareResult => ({
  name: spec.name,
  rate: spec.rate,
  unit: spec.unit,
  specVolume: spec.projectVolume,
  offerName,
  offerRate: spec.rate,
  offerUnit: spec.unit,
  offerVolume: 1,
  status,
  similarity: status === ok ? 100 : 0,
  reason,
});

const entry = (
  id: string,
  offerFilename: string,
  detectedOfferDiscipline: "ar_windows" | "ovik" | "unknown",
  matchedProjectDiscipline: "ar_windows" | "ovik" | "all_project",
  workItems: WorkItem[],
  results: CompareResult[]
): BatchCompareResult["results"][number] => ({
  id,
  status: "success",
  summary: {
    offerFilename,
    detectedOfferDiscipline,
    matchedProjectDiscipline,
    projectWorkItemsUsedCount: workItems.length,
    totalProjectWorkItemsCount: 3,
    excelOfferWorkItemsCount: 2,
    okCount: results.filter((item) => item.status === ok).length,
    volumeDiffCount: 0,
    sizeDiffCount: 0,
    missingCount: results.filter((item) => item.status === missing).length,
    extraOfferCount: results.filter((item) => item.status === extra).length,
    warning:
      detectedOfferDiscipline === "unknown"
        ? "Offer discipline unknown; compared against all project work items"
        : undefined,
  },
  compareResult: {
    workItems,
    results,
    statusCounts: {},
    technicalInfo: {
      totalProjectWorkItemsCount: 3,
      textPdfWorkItemsCount: workItems.filter(
        (item) => item.sourceDiscipline === "text_pdf"
      ).length,
      arWindowsWorkItemsCount: workItems.filter(
        (item) => item.sourceDiscipline === "ar_windows"
      ).length,
      extractionStrategiesUsed: ["pdf_text"],
      fallbackUsed: false,
    },
  },
});

const sheetRows = (workbook: XLSX.WorkBook, name: string): unknown[][] =>
  XLSX.utils.sheet_to_json(workbook.Sheets[name], {
    header: 1,
    defval: "",
  }) as unknown[][];

const flattenCustomerSheets = (workbook: XLSX.WorkBook): string =>
  ["Сводка", "АР окна - витражи", "ОВиК", "Лишние позиции КП"]
    .flatMap((name) => sheetRows(workbook, name))
    .flat()
    .join(" ");

const batchFixture = (): BatchCompareResult => {
  const arB7 = projectItem("B-7(зерк)", "B-7", "ar_windows", "B-7");
  const arB9 = projectItem("B-9", "B-9", "ar_windows", "B-9");
  const ovik = projectItem("LITENED вентиляция", "LITENED", "text_pdf", "1");
  const arExtra: CompareResult = {
    name: "",
    rate: "",
    unit: "",
    specVolume: "",
    offerName: "Доп. окно",
    offerRate: "B-99",
    offerUnit: "шт",
    offerVolume: 1,
    status: extra,
    similarity: 0,
    reason: "Strategy: equipment",
  };

  return {
    allProjectWorkItems: [arB7, arB9, ovik],
    arWindowsWorkItems: [arB7, arB9],
    ovikWorkItems: [ovik],
    unknownWorkItems: [],
    results: [
      entry("1", "kp-windows-1.xlsx", "ar_windows", "ar_windows", [arB7, arB9], [
        compare(arB7, ok),
        compare(arB9, missing, ""),
        arExtra,
      ]),
      entry("2", "kp-windows-2.xlsx", "ar_windows", "ar_windows", [arB7, arB9], [
        compare(arB7, ok, arB7.name, "Совпала марка B-7"),
        compare(arB9, ok, arB9.name, "Совпала марка B-9"),
      ]),
      entry("3", "kp-ovik.xlsx", "ovik", "ovik", [ovik], [
        compare(ovik, ok, ovik.name, "Стратегия: equipment"),
      ]),
    ],
  };
};

test("batch report creates required sheets", () => {
  const workbook = buildBatchComparisonWorkbook(batchFixture());

  assert.ok(workbook.Sheets["Сводка"]);
  assert.ok(workbook.Sheets["АР окна - витражи"]);
  assert.ok(workbook.Sheets["ОВиК"]);
  assert.ok(workbook.Sheets["Лишние позиции КП"]);
  assert.ok(workbook.Sheets["Техническая информация"]);
});

test("batch summary headers and values are Russian", () => {
  const rows = sheetRows(buildBatchComparisonWorkbook(batchFixture()), "Сводка");

  assert.deepEqual(rows[0], [
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
  ]);
  assert.equal(rows[1][1], "АР окна / витражи");
  assert.equal(rows[3][2], "ОВиК");
});

test("batch report AR sheet has KP1 and KP2 side-by-side with two-level header", () => {
  const rows = sheetRows(buildBatchComparisonWorkbook(batchFixture()), "АР окна - витражи");

  assert.equal(rows[0][0], "Спецификация");
  assert.equal(rows[0][4], "kp-windows-1.xlsx");
  assert.equal(rows[0][10], "kp-windows-2.xlsx");
  assert.deepEqual(rows[1].slice(0, 10), [
    "Позиция спецификации",
    "Наименование по спецификации",
    "Ед. изм.",
    "Кол-во по спецификации",
    "Позиция в КП",
    "Наименование в КП",
    "Кол-во в КП",
    "Совпадение",
    "Статус",
    "Комментарий",
  ]);
  assert.equal(rows.filter((row) => row[0] === "B-7").length, 1);
});

test("batch report creates OViK sheet separately", () => {
  const rows = sheetRows(buildBatchComparisonWorkbook(batchFixture()), "ОВиК");

  assert.equal(rows.some((row) => row.includes("LITENED вентиляция")), true);
});

test("AR KP does not appear on OViK sheet", () => {
  const header = sheetRows(buildBatchComparisonWorkbook(batchFixture()), "ОВиК")
    .flat()
    .join(" ");

  assert.equal(header.includes("kp-windows-1.xlsx"), false);
  assert.equal(header.includes("kp-windows-2.xlsx"), false);
});

test("OViK KP does not appear on AR sheet", () => {
  const header = sheetRows(
    buildBatchComparisonWorkbook(batchFixture()),
    "АР окна - витражи"
  )
    .flat()
    .join(" ");

  assert.equal(header.includes("kp-ovik.xlsx"), false);
});

test("extra offer items go to separate sheet with Russian headers", () => {
  const rows = sheetRows(
    buildBatchComparisonWorkbook(batchFixture()),
    "Лишние позиции КП"
  );

  assert.deepEqual(rows[0], [
    "КП",
    "Раздел",
    "Позиция КП",
    "Наименование КП",
    "Кол-во в КП",
    "Статус",
    "Комментарий",
  ]);
  assert.equal(rows.some((row) => row.includes("Доп. окно")), true);
});

test("customer sheets do not expose internal English terms", () => {
  const text = flattenCustomerSheets(buildBatchComparisonWorkbook(batchFixture()));

  for (const forbidden of [
    "Strategy:",
    "mark-based",
    "equipment",
    "matchedProjectDiscipline",
    "detectedOfferDiscipline",
    "sourceDiscipline",
    "extractionStrategy",
    "ar_windows",
    "text_pdf",
    "all_project",
    "unknown",
    "OK",
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});

test("batch customer sheets use client statuses and comments", () => {
  const text = flattenCustomerSheets(buildBatchComparisonWorkbook(batchFixture()));

  assert.equal(text.includes("Совпадает"), true);
  assert.equal(text.includes("Позиция не найдена в КП"), true);
  assert.equal(text.includes("Позиция КП не найдена в спецификации"), true);
});

test("single export still works", () => {
  assert.equal(typeof exportResultsToExcel, "function");
});
