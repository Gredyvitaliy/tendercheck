import assert from "node:assert/strict";
import test from "node:test";

import {
  ArWindowsPdfCompareError,
  loadArWindowsPdfCompare,
} from "./loadArWindowsPdfCompare";

test("uploads PDF and Excel offer to the AR windows compare route", async () => {
  const expected = {
    arWorkItemsCount: 23,
    excelOfferWorkItemsCount: 27,
    results: [],
    statusCounts: {},
    technicalInfo: {
      extractedTextLength: 0,
      pagesWithTextCount: 0,
      likelyScannedOrDrawingPdf: true,
      debugImagePath: "debug/ar-windows-page-1.png",
    },
    arWorkItems: [],
  };
  let receivedBody: BodyInit | null | undefined;
  const fetcher: typeof fetch = async (_input, init) => {
    receivedBody = init?.body;
    return Response.json(expected);
  };

  const result = await loadArWindowsPdfCompare(
    new File(["%PDF-1.7"], "project.pdf", { type: "application/pdf" }),
    new File(["excel"], "offer.xlsx"),
    fetcher
  );

  assert.deepEqual(result, expected);
  assert.ok(receivedBody instanceof FormData);
  assert.ok(receivedBody.get("pdf") instanceof File);
  assert.ok(receivedBody.get("excelOffer") instanceof File);
});

test("throws API error details for a failed AR windows compare upload", async () => {
  const fetcher: typeof fetch = async () =>
    Response.json(
      { error: "Invalid file", details: "Excel offer file is required" },
      { status: 400 }
    );

  await assert.rejects(
    () =>
      loadArWindowsPdfCompare(
        new File(["%PDF-1.7"], "project.pdf"),
        new File([""], "offer.xlsx"),
        fetcher
      ),
    (error) =>
      error instanceof ArWindowsPdfCompareError &&
      error.message === "Excel offer file is required"
  );
});

test("throws a readable error when the API returns HTML instead of JSON", async () => {
  const html = "<!DOCTYPE html><html><body>Not found</body></html>";
  const fetcher: typeof fetch = async () =>
    new Response(html, {
      status: 404,
      headers: { "content-type": "text/html" },
    });

  await assert.rejects(
    () =>
      loadArWindowsPdfCompare(
        new File(["%PDF-1.7"], "project.pdf"),
        new File(["excel"], "offer.xlsx"),
        fetcher
      ),
    (error) =>
      error instanceof ArWindowsPdfCompareError &&
      error.message.includes("API вернул HTML вместо JSON") &&
      error.message.includes("HTTP 404") &&
      error.message.includes(html)
  );
});

test("throws response text when a non-JSON API error is not HTML", async () => {
  const fetcher: typeof fetch = async () =>
    new Response("service unavailable", { status: 503 });

  await assert.rejects(
    () =>
      loadArWindowsPdfCompare(
        new File(["%PDF-1.7"], "project.pdf"),
        new File(["excel"], "offer.xlsx"),
        fetcher
      ),
    (error) =>
      error instanceof ArWindowsPdfCompareError &&
      error.message === "service unavailable"
  );
});
