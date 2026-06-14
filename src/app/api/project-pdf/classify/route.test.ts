import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "./route";

test("rejects a request without a PDF file", async () => {
  const response = await POST(
    new Request("http://localhost/api/project-pdf/classify", {
      method: "POST",
      body: new FormData(),
    })
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "PDF file is required",
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

  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), {
    error: "Only PDF files are supported",
  });
});
