import assert from "node:assert/strict";
import test from "node:test";

import { loadProjectPdfWorkItems } from "./loadProjectPdfWorkItems";

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
