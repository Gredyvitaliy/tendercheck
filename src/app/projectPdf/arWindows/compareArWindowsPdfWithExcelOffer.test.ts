import assert from "node:assert/strict";
import test from "node:test";

import { compareArWindowsPdfWithExcelOffer } from "./compareArWindowsPdfWithExcelOffer";
import type { ArWindowSpecificationRow } from "./types";
import type { CompareResult, WorkItem } from "../../types";

const row = (mark: string, quantity: string): ArWindowSpecificationRow => ({
  mark,
  designation: "GOST",
  name: "Window",
  area: "",
  quantity,
  mass: "",
  note: "",
});

test("renders AR PDF, parses Excel offer, and returns UI compare counts", async () => {
  const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const excelData = new Uint8Array([1, 2, 3]);
  const arWorkItems: WorkItem[] = [
    {
      number: 1,
      name: "B-1 GOST Window",
      rate: "",
      unit: "шт",
      projectVolume: 1,
      rowType: "item",
      position: "B-1",
    },
  ];
  const excelWorkItems: WorkItem[] = [
    {
      number: 1,
      name: "Offer B-1",
      rate: "B-1",
      unit: "шт",
      projectVolume: 1,
      rowType: "item",
    },
  ];
  const compareResults: CompareResult[] = [
    {
      name: "B-1 GOST Window",
      rate: "",
      unit: "шт",
      specVolume: 1,
      offerName: "Offer B-1",
      offerRate: "B-1",
      offerUnit: "шт",
      offerVolume: 1,
      status: "ОК",
      similarity: 100,
      reason: "",
    },
  ];
  let renderedImagePath = "";

  const result = await compareArWindowsPdfWithExcelOffer({
    pdfData,
    excelData,
    debugImagePath: "debug/test-ar-windows-page-1.png",
    dependencies: {
      getPdfDiagnostics: async (actualPdfData) => {
        assert.deepEqual(actualPdfData, pdfData);
        return {
          extractedTextLength: 0,
          pagesWithTextCount: 0,
          likelyScannedOrDrawingPdf: true,
        };
      },
      renderDebugImage: async (input) => {
        assert.deepEqual(input.pdfData, pdfData);
        assert.equal(input.pageNumber, 1);
        renderedImagePath = input.outputPath;
      },
      recognizeRows: async ({ imagePath }) => {
        assert.equal(imagePath, renderedImagePath);
        return [row("B-1", "1")];
      },
      mapRowsToWorkItems: (rows) => {
        assert.deepEqual(rows, [row("B-1", "1")]);
        return arWorkItems;
      },
      parseExcelOffer: (actualExcelData) => {
        assert.deepEqual(actualExcelData, excelData);
        return excelWorkItems;
      },
      compareItems: (projectItems, offerItems) => {
        assert.deepEqual(projectItems, arWorkItems);
        assert.deepEqual(offerItems, excelWorkItems);
        return compareResults;
      },
    },
  });

  assert.deepEqual(result, {
    arWorkItemsCount: 1,
    excelOfferWorkItemsCount: 1,
    results: compareResults,
    statusCounts: { "ОК": 1 },
    technicalInfo: {
      extractedTextLength: 0,
      pagesWithTextCount: 0,
      likelyScannedOrDrawingPdf: true,
      debugImagePath: "debug/test-ar-windows-page-1.png",
    },
    arWorkItems,
  });
});
