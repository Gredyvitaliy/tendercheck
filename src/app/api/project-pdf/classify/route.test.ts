import assert from "node:assert/strict";
import test from "node:test";

import { createPostHandler, POST } from "./route";

test("rejects a request without a PDF file", async () => {
  const response = await POST(
    new Request("http://localhost/api/project-pdf/classify", {
      method: "POST",
      body: new FormData(),
    })
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid file",
    details: "PDF file is required",
  });
});

test("rejects a non-PDF upload", async () => {
  const formData = new FormData();
  formData.set(
    "file",
    new File(["not a pdf"], "notes.txt", { type: "text/plain" })
  );

  const response = await POST(
    new Request("http://localhost/api/project-pdf/classify", {
      method: "POST",
      body: formData,
    })
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid file",
    details: "PDF file must use the .pdf extension",
  });
});

test("accepts a valid PDF and passes validated bytes to the classifier", async () => {
  let received: Uint8Array | undefined;
  const handler = createPostHandler(async (data) => {
    received = data;
    return { totalPages: 1 };
  });
  const formData = new FormData();
  formData.set(
    "file",
    new File(["%PDF-1.7\nbody"], "project.pdf", {
      type: "application/pdf",
    })
  );

  const response = await handler(
    new Request("http://localhost/api/project-pdf/classify", {
      method: "POST",
      body: formData,
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { totalPages: 1 });
  assert.equal(Buffer.from(received ?? []).subarray(0, 5).toString(), "%PDF-");
});

test("returns PDF validation errors with the safe 400 response shape", async () => {
  const formData = new FormData();
  formData.set(
    "file",
    new File(["not a pdf"], "project.pdf", { type: "application/pdf" })
  );

  const response = await POST(
    new Request("http://localhost/api/project-pdf/classify", {
      method: "POST",
      body: formData,
    })
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid file",
    details: "PDF signature is invalid",
  });
});

test("maps the PDF page limit to a validation response", async () => {
  const handler = createPostHandler(async () => {
    const error = new Error("PDF page limit exceeded");
    Object.assign(error, { code: "PDF_PAGE_LIMIT_EXCEEDED" });
    throw error;
  });
  const formData = new FormData();
  formData.set(
    "file",
    new File(["%PDF-1.7"], "project.pdf", { type: "application/pdf" })
  );

  const response = await handler(
    new Request("http://localhost/api/project-pdf/classify", {
      method: "POST",
      body: formData,
    })
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid file",
    details: "PDF page limit exceeded",
  });
});

test("does not expose stack traces in production responses", async () => {
  const handler = createPostHandler(
    async () => {
      throw new Error("classifier exploded");
    },
    "production"
  );
  const formData = new FormData();
  formData.set(
    "file",
    new File(["%PDF-1.7"], "project.pdf", { type: "application/pdf" })
  );

  const response = await handler(
    new Request("http://localhost/api/project-pdf/classify", {
      method: "POST",
      body: formData,
    })
  );
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error, "Failed to classify PDF");
  assert.equal("stack" in body, false);
});
