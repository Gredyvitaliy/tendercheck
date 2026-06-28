import assert from "node:assert/strict";
import test from "node:test";

import type { WorkItem } from "../types";
import type { ProjectPdfWorkItemsResponse } from "../api/project-pdf/work-items/route";
import type { ArWindowsPdfExcelCompareResult } from "./arWindows/compareArWindowsPdfWithExcelOffer";
import {
  ProjectPdfProcessingError,
} from "./loadProjectPdfWorkItems";
import {
  loadUnifiedProjectPdfCompare,
} from "./loadUnifiedProjectPdfCompare";

const workItem = (overrides: Partial<WorkItem>): WorkItem => ({
  number: 1,
  name: "Item",
  rate: "",
  unit: "шт",
  projectVolume: 1,
  rowType: "item",
  ...overrides,
});

const pdfFile = new File(["%PDF-1.7"], "project.pdf", {
  type: "application/pdf",
});
const excelFile = new File(["excel"], "offer.xlsx");

const textResponse = (
  workItems: WorkItem[],
  likelyScannedOrDrawingPdf = false
): ProjectPdfWorkItemsResponse => ({
  specificationSection: {
    startPage: 1,
    endPage: 2,
    sheetCount: 2,
    reason: "test",
  },
  beforeSplitCount: workItems.length,
  afterSplitCount: workItems.length,
  technicalInfo: {
    extractedTextLength: likelyScannedOrDrawingPdf ? 0 : 1200,
    pagesWithTextCount: likelyScannedOrDrawingPdf ? 0 : 2,
    likelyScannedOrDrawingPdf,
  },
  workItems,
});

const arResponse = (workItems: WorkItem[]): ArWindowsPdfExcelCompareResult => ({
  arWorkItemsCount: workItems.length,
  excelOfferWorkItemsCount: 1,
  results: [],
  statusCounts: {},
  technicalInfo: {
    extractedTextLength: 0,
    pagesWithTextCount: 0,
    likelyScannedOrDrawingPdf: true,
    debugImagePath: "debug/ar-windows-page-1.png",
  },
  arWorkItems: workItems,
});

test("auto mode returns text PDF WorkItems when text pipeline works", async () => {
  const textItem = workItem({ name: "Text item" });
  let arCalls = 0;

  const result = await loadUnifiedProjectPdfCompare({
    mode: "auto",
    pdfFile,
    excelOfferFile: excelFile,
    offerItems: [textItem],
    loadTextPdfWorkItems: async () => textResponse([textItem]),
    loadArWindowsPdfCompare: async () => {
      arCalls += 1;
      return arResponse([workItem({ name: "AR item" })]);
    },
  });

  assert.equal(arCalls, 0);
  assert.deepEqual(
    result.workItems.map((item) => item.name),
    ["Text item"]
  );
  assert.equal(result.technicalInfo.totalProjectWorkItemsCount, 1);
  assert.equal(result.technicalInfo.textPdfWorkItemsCount, 1);
  assert.equal(result.technicalInfo.arWindowsWorkItemsCount, 0);
  assert.deepEqual(result.technicalInfo.extractionStrategiesUsed, ["pdf_text"]);
});

test("auto mode can include AR windows WorkItems", async () => {
  const arItem = workItem({ name: "AR item", position: "B-7" });

  const result = await loadUnifiedProjectPdfCompare({
    mode: "auto",
    pdfFile,
    excelOfferFile: excelFile,
    offerItems: [arItem],
    loadTextPdfWorkItems: async () => textResponse([], true),
    loadArWindowsPdfCompare: async () => arResponse([arItem]),
  });

  assert.deepEqual(
    result.workItems.map((item) => item.name),
    ["AR item"]
  );
  assert.equal(result.technicalInfo.totalProjectWorkItemsCount, 1);
  assert.equal(result.technicalInfo.textPdfWorkItemsCount, 0);
  assert.equal(result.technicalInfo.arWindowsWorkItemsCount, 1);
  assert.equal(result.technicalInfo.fallbackUsed, true);
  assert.equal(
    result.technicalInfo.fallbackReason,
    "text_pdf_returned_no_work_items"
  );
  assert.deepEqual(result.technicalInfo.extractionStrategiesUsed, [
    "pdf_text",
    "ar_windows_ocr",
  ]);
});

test("auto mode does not duplicate the same WorkItems", async () => {
  const duplicate = workItem({
    name: "B-7 Window",
    rate: "B-7",
    position: "B-7",
  });

  const result = await loadUnifiedProjectPdfCompare({
    mode: "auto",
    pdfFile,
    excelOfferFile: excelFile,
    offerItems: [duplicate],
    loadTextPdfWorkItems: async () => textResponse([duplicate], true),
    loadArWindowsPdfCompare: async () => arResponse([duplicate]),
  });

  assert.equal(result.workItems.length, 1);
  assert.equal(result.technicalInfo.totalProjectWorkItemsCount, 1);
  assert.equal(result.technicalInfo.textPdfWorkItemsCount, 1);
  assert.equal(result.technicalInfo.arWindowsWorkItemsCount, 1);
  assert.equal(result.technicalInfo.fallbackUsed, true);
  assert.equal(
    result.technicalInfo.fallbackReason,
    "text_pdf_likely_scanned_or_drawing"
  );
  assert.deepEqual(result.technicalInfo.extractionStrategiesUsed, [
    "pdf_text",
    "ar_windows_ocr",
  ]);
});

test("manual OViK mode still works", async () => {
  const textItem = workItem({ name: "Text item" });

  const result = await loadUnifiedProjectPdfCompare({
    mode: "text",
    pdfFile,
    excelOfferFile: excelFile,
    offerItems: [textItem],
    loadTextPdfWorkItems: async () => textResponse([textItem]),
    loadArWindowsPdfCompare: async () => arResponse([]),
  });

  assert.deepEqual(
    result.workItems.map((item) => item.extractionStrategy),
    ["pdf_text"]
  );
  assert.equal(result.technicalInfo.textPdfWorkItemsCount, 1);
  assert.equal(result.technicalInfo.arWindowsWorkItemsCount, 0);
});

test("manual AR windows mode still works", async () => {
  const arItem = workItem({ name: "AR item", position: "B-7" });
  let textCalls = 0;

  const result = await loadUnifiedProjectPdfCompare({
    mode: "arWindows",
    pdfFile,
    excelOfferFile: excelFile,
    offerItems: [arItem],
    loadTextPdfWorkItems: async () => {
      textCalls += 1;
      return textResponse([]);
    },
    loadArWindowsPdfCompare: async () => arResponse([arItem]),
  });

  assert.equal(textCalls, 0);
  assert.deepEqual(
    result.workItems.map((item) => item.extractionStrategy),
    ["ar_windows_ocr"]
  );
  assert.equal(result.technicalInfo.textPdfWorkItemsCount, 0);
  assert.equal(result.technicalInfo.arWindowsWorkItemsCount, 1);
});

test("auto mode falls back to AR when text PDF reports scanned diagnostics", async () => {
  const arItem = workItem({ name: "AR item", position: "B-7" });

  const result = await loadUnifiedProjectPdfCompare({
    mode: "auto",
    pdfFile,
    excelOfferFile: excelFile,
    offerItems: [arItem],
    loadTextPdfWorkItems: async () => {
      throw new ProjectPdfProcessingError("scanned", {
        extractedTextLength: 0,
        pagesWithTextCount: 0,
        likelyScannedOrDrawingPdf: true,
      });
    },
    loadArWindowsPdfCompare: async () => arResponse([arItem]),
  });

  assert.equal(result.technicalInfo.fallbackUsed, true);
  assert.equal(result.technicalInfo.fallbackReason, "scanned");
  assert.deepEqual(
    result.workItems.map((item) => item.name),
    ["AR item"]
  );
});
