import assert from "node:assert/strict";
import test from "node:test";

import type { OfferScope } from "../matching/detectOfferScope";
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

const offerScope: OfferScope = {
  detectedBrands: ["NED", "AIRNED"],
  dominantBrands: ["NED", "AIRNED", "LITENED"],
  keywords: ["NED", "AIRNED"],
  confidence: 1,
  reasons: ["NED family dominates"],
};

test("summarizes statuses before and after scope filtering", () => {
  const beforeResults = [
    result("ОК"),
    result("ОК"),
    result("Нет в КП"),
    result("Нет в КП"),
    result("Частичное совпадение"),
    result("Размер отличается"),
    result("Объем отличается"),
    result("Агрегированная позиция"),
    result("Количество в PDF не распознано"),
    result("Есть в КП, нет в спецификации"),
  ];
  const afterResults = [
    beforeResults[0],
    beforeResults[1],
    beforeResults[2],
    result("Вне области КП"),
    ...beforeResults.slice(4),
  ];

  assert.deepEqual(
    buildCompareSummary(
      2,
      [workItem],
      [workItem],
      beforeResults,
      afterResults,
      offerScope
    ),
    {
    pdfWorkItemsBeforeSplit: 2,
    pdfWorkItemsAfterSplit: 1,
    excelWorkItems: 1,
    totalResults: 10,
    offerScope,
    statusCountsBeforeScope: {
      "ОК": 2,
      "Объем отличается": 1,
      "Размер отличается": 1,
      "Частичное совпадение": 1,
      "Агрегированная позиция": 1,
      "Количество в PDF не распознано": 1,
      "Нет в КП": 2,
      "Вне области КП": 0,
      "Есть в КП, нет в спецификации": 1,
    },
    statusCountsAfterScope: {
      "ОК": 2,
      "Объем отличается": 1,
      "Размер отличается": 1,
      "Частичное совпадение": 1,
      "Агрегированная позиция": 1,
      "Количество в PDF не распознано": 1,
      "Нет в КП": 1,
      "Вне области КП": 1,
      "Есть в КП, нет в спецификации": 1,
    },
  }
  );
});

test("builds the full diagnostic payload", () => {
  const beforeResults = [result("Нет в КП")];
  const results = [result("Вне области КП")];
  const payload = buildCompareDebugResult(
    2,
    [workItem],
    [workItem],
    beforeResults,
    results,
    offerScope
  );

  assert.equal(payload.summary.totalResults, 1);
  assert.deepEqual(payload.summary.offerScope, offerScope);
  assert.equal(payload.summary.statusCountsBeforeScope["Нет в КП"], 1);
  assert.equal(payload.summary.statusCountsAfterScope["Вне области КП"], 1);
  assert.deepEqual(payload.pdfWorkItems, [workItem]);
  assert.deepEqual(payload.excelWorkItems, [workItem]);
  assert.deepEqual(payload.results, results);
});
