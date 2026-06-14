import assert from "node:assert/strict";
import test from "node:test";

import { detectSpecificationSection } from "./detectSpecificationSection";

test("detects a specification section from its title sheet", () => {
  const section = detectSpecificationSection([
    { pageNumber: 20, text: "Рабочий чертёж" },
    {
      pageNumber: 21,
      text: "D24-PRJ-RD-2509-P-2-ОВ2.1.СО Спецификация оборудования, изделий и материалов Стадия Р Лист 1 Листов 19",
    },
    { pageNumber: 22, text: "Лист 2" },
  ]);

  assert.deepEqual(section, {
    startPage: 21,
    endPage: 39,
    sheetCount: 19,
    reason:
      "Найден титульный лист раздела спецификации: page 21, листов 19",
  });
});

test("detects a section by the СО document code", () => {
  const section = detectSpecificationSection([
    {
      pageNumber: 8,
      text: "ABC-ОВ.СО Стадия Р Лист 1 Листов 3",
    },
  ]);

  assert.equal(section?.startPage, 8);
  assert.equal(section?.endPage, 10);
  assert.equal(section?.sheetCount, 3);
});

test("detects sheet metadata extracted in PDF stamp column order", () => {
  const section = detectSpecificationSection([
    {
      pageNumber: 21,
      text: "D24-PRJ-RD-2509-P-2-ОВ2.1.СО Спецификация оборудования, изделий и материалов Стадия Лист Листов Проверил Иванов Р 1 19 ГИП",
    },
  ]);

  assert.equal(section?.startPage, 21);
  assert.equal(section?.endPage, 39);
  assert.equal(section?.sheetCount, 19);
});

test("does not detect a section without sheet metadata", () => {
  const section = detectSpecificationSection([
    {
      pageNumber: 5,
      text: "Спецификация оборудования, изделий и материалов",
    },
  ]);

  assert.equal(section, null);
});

test("does not detect an unrelated multi-sheet document", () => {
  const section = detectSpecificationSection([
    {
      pageNumber: 5,
      text: "Общие данные Лист 1 Листов 19",
    },
  ]);

  assert.equal(section, null);
});
