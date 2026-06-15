import assert from "node:assert/strict";
import test from "node:test";

import * as XLSX from "xlsx-js-style";

import { parseOfferExcelData } from "./parsers";

test("parses offer WorkItems from Node-compatible workbook bytes", () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["#", "Name", "Model", "Quantity"],
    [1, "Supply fan", "FAN-100", 2],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Offer");
  const data = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer;

  const items = parseOfferExcelData(new Uint8Array(data));

  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Supply fan");
  assert.equal(items[0].rate, "FAN-100");
  assert.equal(items[0].projectVolume, 2);
  assert.equal(items[0].rowType, "item");
});
