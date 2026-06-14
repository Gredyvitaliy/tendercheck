import assert from "node:assert/strict";
import test from "node:test";

import { toPdfData } from "./pdfTextExtractor";

test("converts an ArrayBuffer to Uint8Array", () => {
  const source = new Uint8Array([1, 2, 3]).buffer;
  const result = toPdfData(source);

  assert.equal(result.constructor, Uint8Array);
  assert.deepEqual([...result], [1, 2, 3]);
});

test("copies a Node Buffer into a plain Uint8Array", () => {
  const source = Buffer.from([4, 5, 6]);
  const result = toPdfData(source);

  assert.equal(result.constructor, Uint8Array);
  assert.equal(Buffer.isBuffer(result), false);
  assert.deepEqual([...result], [4, 5, 6]);
  assert.notEqual(result.buffer, source.buffer);
});
