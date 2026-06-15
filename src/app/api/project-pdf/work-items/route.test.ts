import assert from "node:assert/strict";
import test from "node:test";

import { createPostHandler } from "./route";

const requestWithFile = (contents = "%PDF-1.7") => {
  const formData = new FormData();
  formData.set(
    "file",
    new File([contents], "project.pdf", { type: "application/pdf" })
  );
  return new Request("http://localhost/api/project-pdf/work-items", {
    method: "POST",
    body: formData,
  });
};

test("returns the PDF work item response contract", async () => {
  const workItems = [
    {
      number: 0,
      name: "Fan",
      rate: "",
      unit: "шт",
      projectVolume: 1,
      rowType: "item" as const,
    },
  ];
  const handler = createPostHandler(async () => ({
    specificationSection: {
      startPage: 21,
      endPage: 39,
      sheetCount: 19,
      reason: "test",
    },
    beforeSplitCount: 1,
    afterSplitCount: 1,
    workItems,
  }));

  const response = await handler(requestWithFile());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    specificationSection: {
      startPage: 21,
      endPage: 39,
      sheetCount: 19,
      reason: "test",
    },
    beforeSplitCount: 1,
    afterSplitCount: 1,
    workItems,
  });
});

test("returns validation errors as safe 400 JSON", async () => {
  const handler = createPostHandler(async () => {
    throw new Error("pipeline should not run");
  });

  const response = await handler(requestWithFile("not a pdf"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid file",
    details: "PDF signature is invalid",
  });
});

test("returns a readable error when the specification section is absent", async () => {
  const handler = createPostHandler(async () => {
    const error = new Error("Specification section was not found");
    Object.assign(error, { code: "SPECIFICATION_SECTION_NOT_FOUND" });
    throw error;
  });

  const response = await handler(requestWithFile());

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    error: "PDF processing failed",
    details: "Specification section was not found",
  });
});

test("does not expose stack traces in production", async () => {
  const handler = createPostHandler(
    async () => {
      throw new Error("pipeline exploded");
    },
    "production"
  );

  const response = await handler(requestWithFile());
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error, "Failed to process PDF");
  assert.equal("stack" in body, false);
});
