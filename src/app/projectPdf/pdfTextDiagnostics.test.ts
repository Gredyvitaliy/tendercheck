import assert from "node:assert/strict";
import test from "node:test";

import { getPdfTextLayerDiagnostics } from "./pdfTextDiagnostics";

test("marks a PDF with an empty text layer as scanned or drawing-only", () => {
  const diagnostics = getPdfTextLayerDiagnostics([
    { pageNumber: 1, text: "" },
    { pageNumber: 2, text: "   " },
  ]);

  assert.deepEqual(diagnostics, {
    extractedTextLength: 0,
    pagesWithTextCount: 0,
    likelyScannedOrDrawingPdf: true,
  });
});

test("does not mark a normal text PDF as scanned or drawing-only", () => {
  const diagnostics = getPdfTextLayerDiagnostics([
    {
      pageNumber: 1,
      text: "D24-PRJ-RD-2509-P-2-ОВ2.1.СО Спецификация оборудования Лист 1 Листов 19",
    },
  ]);

  assert.equal(diagnostics.extractedTextLength > 50, true);
  assert.equal(diagnostics.pagesWithTextCount, 1);
  assert.equal(diagnostics.likelyScannedOrDrawingPdf, false);
});
