import assert from "node:assert/strict";
import test from "node:test";

import type { CompareResult, WorkItem } from "../types";
import {
  buildCompareDebugResult,
  buildCompareSummary,
} from "./testComparePdfSpecificationWithExcelOffer";

const result = (status: CompareResult["status"]): CompareResult => ({
  name: "Spec item",
  rate: "",
  unit: "шт",
  specVolume: 1,
  offerName: "Offer item",
  offerRate: "",
  offerUnit: "шт",
  offerVolume: 1,
  status,
  similarity: 80,
  reason: "test",
});

const workItem: WorkItem = {
  number: 0,
  name: "Item",
  rate: "",
  unit: "шт",
  projectVolume: 1,
  rowType: "item",
};

test("summarizes every real CompareResult status", () => {
  const results = [
    result("ОК"),
    result("ОК"),
    result("Нет в КП"),
    result("Частичное совпадение"),
    result("Размер отличается"),
    result("Объем отличается"),
    result("Есть в КП, нет в спецификации"),
  ];

  assert.deepEqual(buildCompareSummary(2, [workItem], [workItem], results), {
    pdfWorkItemsBeforeSplit: 2,
    pdfWorkItemsAfterSplit: 1,
    excelWorkItems: 1,
    totalResults: 7,
    statusCounts: {
      "ОК": 2,
      "Объем отличается": 1,
      "Размер отличается": 1,
      "Частичное совпадение": 1,
      "Нет в КП": 1,
      "Есть в КП, нет в спецификации": 1,
    },
  });
});

test("builds the full diagnostic payload", () => {
  const results = [result("ОК")];
  const payload = buildCompareDebugResult(
    2,
    [workItem],
    [workItem],
    results
  );

  assert.equal(payload.summary.totalResults, 1);
  assert.deepEqual(payload.pdfWorkItems, [workItem]);
  assert.deepEqual(payload.excelWorkItems, [workItem]);
  assert.deepEqual(payload.results, results);
});
