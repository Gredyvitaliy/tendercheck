import assert from "node:assert/strict";
import test from "node:test";

import {
  loadProjectPdfWorkItems,
  ProjectPdfProcessingError,
} from "./loadProjectPdfWorkItems";

test("uploads a PDF and returns the work item response", async () => {
  const expected = {
    specificationSection: {
      startPage: 21,
      endPage: 39,
      sheetCount: 19,
      reason: "test",
    },
    beforeSplitCount: 83,
    afterSplitCount: 271,
    technicalInfo: {
      extractedTextLength: 5000,
      pagesWithTextCount: 19,
      likelyScannedOrDrawingPdf: false,
    },
    workItems: [],
  };
  let receivedBody: BodyInit | null | undefined;
  const fetcher: typeof fetch = async (_input, init) => {
    receivedBody = init?.body;
    return Response.json(expected);
  };

  const result = await loadProjectPdfWorkItems(
    new File(["%PDF-1.7"], "project.pdf", {
      type: "application/pdf",
    }),
    fetcher
  );

  assert.deepEqual(result, expected);
  assert.ok(receivedBody instanceof FormData);
  assert.ok(receivedBody.get("file") instanceof File);
});

test("throws API error details for a failed PDF upload", async () => {
  const fetcher: typeof fetch = async () =>
    Response.json(
      { error: "Invalid file", details: "PDF signature is invalid" },
      { status: 400 }
    );

  await assert.rejects(
    () =>
      loadProjectPdfWorkItems(
        new File(["bad"], "project.pdf"),
        fetcher
      ),
    /PDF signature is invalid/
  );
});

test("preserves technical info from a failed PDF upload", async () => {
  const technicalInfo = {
    extractedTextLength: 0,
    pagesWithTextCount: 0,
    likelyScannedOrDrawingPdf: true,
  };
  const fetcher: typeof fetch = async () =>
    Response.json(
      {
        error: "PDF processing failed",
        details:
          "PDF не содержит извлекаемого текстового слоя. Для этого файла нужен OCR/распознавание чертежа.",
        technicalInfo,
      },
      { status: 422 }
    );

  await assert.rejects(
    async () =>
      loadProjectPdfWorkItems(
        new File(["%PDF-1.7"], "project.pdf", {
          type: "application/pdf",
        }),
        fetcher
      ),
    (error) =>
      error instanceof ProjectPdfProcessingError &&
      error.message ===
        "PDF не содержит извлекаемого текстового слоя. Для этого файла нужен OCR/распознавание чертежа." &&
      assert.deepEqual(error.technicalInfo, technicalInfo) === undefined
  );
});
