import assert from "node:assert/strict";
import test from "node:test";

import { summarizePdfPageClassifications } from "./analyzePdfClassification";

test("overrides a detected specification section and builds the UI summary", () => {
  const pages = [
    {
      pageNumber: 21,
      text: "DOC.ОВ.СО Спецификация оборудования, изделий и материалов Лист 1 Листов 3",
    },
    { pageNumber: 22, text: "AIRNED П10.1" },
    { pageNumber: 23, text: "Наименование Масса" },
    { pageNumber: 41, text: "Подбор оборудования AIRNED П10.1" },
    {
      pageNumber: 118,
      text: "Коммерческое предложение Стоимость С уважением",
    },
  ];

  const result = summarizePdfPageClassifications(pages);

  assert.equal(result.totalPages, 5);
  assert.deepEqual(result.specificationSection, {
    startPage: 21,
    endPage: 23,
    sheetCount: 3,
    reason:
      "Найден титульный лист раздела спецификации: page 21, листов 3",
  });
  assert.deepEqual(result.specificationPages, [21, 22, 23]);
  assert.equal(result.aggregate.specification, 3);
  assert.equal(result.aggregate["equipment-selection"], 1);
  assert.equal(result.aggregate["commercial-letter"], 1);
  assert.equal(result.selectedPages.page41?.type, "equipment-selection");
  assert.equal(result.selectedPages.page118?.type, "commercial-letter");
  assert.ok(
    result.pages[1].reasons.some((reason) =>
      reason.includes("pages 21-23")
    )
  );
});

test("returns null selected pages when the PDF does not contain them", () => {
  const result = summarizePdfPageClassifications([
    { pageNumber: 1, text: "Титульный лист" },
  ]);

  assert.equal(result.specificationSection, null);
  assert.deepEqual(result.specificationPages, []);
  assert.equal(result.selectedPages.page41, null);
  assert.equal(result.selectedPages.page118, null);
  assert.equal(result.aggregate.unknown, 1);
});
