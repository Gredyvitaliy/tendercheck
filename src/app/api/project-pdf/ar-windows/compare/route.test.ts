import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createDefaultPipeline, createPostHandler, GET } from "./route";
import type { ArWindowsPdfExcelCompareResult } from "../../../../projectPdf/arWindows/compareArWindowsPdfWithExcelOffer";
import type { CompareResult, WorkItem } from "../../../../types";

const requestWithFiles = ({
  pdfContents = "%PDF-1.7",
  excelContents = "excel",
  includePdf = true,
  includeExcel = true,
}: {
  pdfContents?: string;
  excelContents?: string;
  includePdf?: boolean;
  includeExcel?: boolean;
} = {}) => {
  const formData = new FormData();

  if (includePdf) {
    formData.set(
      "pdf",
      new File([pdfContents], "project.pdf", { type: "application/pdf" })
    );
  }

  if (includeExcel) {
    formData.set(
      "excelOffer",
      new File([excelContents], "offer.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );
  }

  return new Request("http://localhost/api/project-pdf/ar-windows/compare", {
    method: "POST",
    body: formData,
  });
};

test("GET returns a diagnostic JSON response", async () => {
  const response = await GET();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    route: "ar-windows-compare",
  });
});

test("returns AR windows comparison response contract", async () => {
  const expected: ArWindowsPdfExcelCompareResult = {
    arWorkItemsCount: 23,
    excelOfferWorkItemsCount: 27,
    results: [],
    statusCounts: { "ОК": 21 },
    technicalInfo: {
      extractedTextLength: 0,
      pagesWithTextCount: 0,
      likelyScannedOrDrawingPdf: true,
      debugImagePath: "debug/ar-windows-page-1.png",
    },
    arWorkItems: [],
  };
  const handler = createPostHandler(async ({ pdfData, excelData }) => {
    assert.deepEqual(
      Array.from(pdfData.slice(0, 5)),
      Array.from(new TextEncoder().encode("%PDF-"))
    );
    assert.ok(excelData.byteLength > 0);
    return expected;
  });

  const response = await handler(requestWithFiles());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected);
});

test("requires a PDF file", async () => {
  const handler = createPostHandler(async () => {
    throw new Error("pipeline should not run");
  });

  const response = await handler(requestWithFiles({ includePdf: false }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid file",
    details: "PDF file is required",
  });
});

test("requires an Excel offer file", async () => {
  const handler = createPostHandler(async () => {
    throw new Error("pipeline should not run");
  });

  const response = await handler(requestWithFiles({ includeExcel: false }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid file",
    details: "Excel offer file is required",
  });
});

test("returns PDF validation errors as safe 400 JSON", async () => {
  const handler = createPostHandler(async () => {
    throw new Error("pipeline should not run");
  });

  const response = await handler(requestWithFiles({ pdfContents: "bad" }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid file",
    details: "PDF signature is invalid",
  });
});

test("returns JSON when the AR pipeline throws", async () => {
  const handler = createPostHandler(
    async () => {
      throw new Error("pipeline exploded");
    },
    "production"
  );

  const response = await handler(requestWithFiles());
  const text = await response.text();

  assert.equal(response.status, 500);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(JSON.parse(text), {
    error: "Failed to compare AR windows PDF with Excel offer",
  });
});

test("uses debug AR work items fallback when the canvas native binding is unavailable", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ar-windows-fallback-"));
  const fallbackWorkItemsPath = path.join(tempDir, "ar-windows-work-items.json");
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
      number: 2,
      name: "Offer B-1",
      rate: "B-1",
      unit: "шт",
      projectVolume: 1,
      rowType: "item",
    },
  ];
  const results: CompareResult[] = [
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

  try {
    await writeFile(fallbackWorkItemsPath, JSON.stringify(arWorkItems), "utf8");

    const handler = createPostHandler(
      createDefaultPipeline(
        async () => {
          throw new Error("Cannot find native binding for @napi-rs/canvas");
        },
        {
          fallbackWorkItemsPath,
          parseExcelOffer: () => excelWorkItems,
          compareItems: (actualArWorkItems, actualExcelWorkItems) => {
            assert.deepEqual(actualArWorkItems, arWorkItems);
            assert.deepEqual(actualExcelWorkItems, excelWorkItems);
            return results;
          },
        }
      ),
      "production"
    );

    const response = await handler(requestWithFiles());

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      arWorkItemsCount: 1,
      excelOfferWorkItemsCount: 1,
      results,
      statusCounts: { "ОК": 1 },
      technicalInfo: {
        extractedTextLength: 0,
        pagesWithTextCount: 0,
        likelyScannedOrDrawingPdf: true,
        debugImagePath: "",
        arFallbackUsed: true,
        arFallbackReason: "Cannot find native binding for @napi-rs/canvas",
      },
      arWorkItems,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("returns a JSON dependency error when canvas is unavailable and fallback is missing", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ar-windows-missing-"));
  const fallbackWorkItemsPath = path.join(tempDir, "missing-work-items.json");
  const handler = createPostHandler(
    createDefaultPipeline(
      async () => {
        throw new Error("Cannot find native binding for @napi-rs/canvas");
      },
      { fallbackWorkItemsPath }
    ),
    "production"
  );

  try {
    const response = await handler(requestWithFiles());

    assert.equal(response.status, 500);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await response.json(), {
      ok: false,
      error:
        "AR PDF render dependency is unavailable and fallback work items were not found",
      details: "Cannot find native binding for @napi-rs/canvas",
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
