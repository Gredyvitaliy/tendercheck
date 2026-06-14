import assert from "node:assert/strict";
import test from "node:test";

import { extractSpecificationRowCandidates } from "./extractSpecificationRows";

const section = { startPage: 21, endPage: 22 };

test("groups multi-line specification positions and extracts fields", () => {
  const candidates = extractSpecificationRowCandidates(
    [
      {
        pageNumber: 21,
        text: [
          "D24-PRJ-RD-2509-P-2-ОВ2.1.СО",
          "Лист 1",
          "Поз.",
          "Наименование и техническая характеристика",
          "3.1. П10.1 (L=17085м3/ч, Pс=1000Па)",
          "Установка AIRNED-",
          "R21L/B1/K1/F1/F5/H1",
          "NED к-т 1 «или аналог»",
          "3.2. В10.1 (L=17085м3/ч, Pс=700Па)",
          "Установка крышная AIRNED-R18L",
          "NED комплект 2",
        ].join("\n"),
      },
    ],
    section
  );

  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates[0].rawLines, [
    "3.1. П10.1 (L=17085м3/ч, Pс=1000Па)",
    "Установка AIRNED-",
    "R21L/B1/K1/F1/F5/H1",
    "NED к-т 1 «или аналог»",
  ]);
  assert.equal(candidates[0].position, "3.1");
  assert.equal(candidates[0].unit, "к-т");
  assert.equal(candidates[0].quantity, 1);
  assert.match(candidates[0].name, /Установка AIRNED/);
  assert.equal(candidates[0].confidence, 1);
  assert.equal(candidates[1].position, "3.2");
  assert.equal(candidates[1].unit, "комплект");
  assert.equal(candidates[1].quantity, 2);
});

test("starts a candidate from an equipment system code", () => {
  const candidates = extractSpecificationRowCandidates(
    [
      {
        pageNumber: 21,
        text: [
          "П10.1 Установка приточная AIRNED",
          "NED шт 1",
        ].join("\n"),
      },
    ],
    section
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].position, "П10.1");
  assert.equal(candidates[0].unit, "шт");
  assert.equal(candidates[0].quantity, 1);
});

test("filters pages outside the section and does not cross page boundaries", () => {
  const candidates = extractSpecificationRowCandidates(
    [
      { pageNumber: 20, text: "1 Вентилятор шт 1" },
      {
        pageNumber: 21,
        text: "1 Вентилятор канальный\nмодель V1 шт 2",
      },
      {
        pageNumber: 22,
        text: "продолжение с предыдущей страницы\n2 Клапан шт 3",
      },
      { pageNumber: 23, text: "3 Насос шт 1" },
    ],
    section
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.position),
    ["1", "2"]
  );
  assert.equal(
    candidates[0].rawLines.includes(
      "продолжение с предыдущей страницы"
    ),
    false
  );
  assert.equal(candidates[1].pageNumber, 22);
});

test("keeps partial candidates with transparent confidence reasons", () => {
  const candidates = extractSpecificationRowCandidates(
    [{ pageNumber: 21, text: "15 Крепление монтажное" }],
    section
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].position, "15");
  assert.equal(candidates[0].unit, undefined);
  assert.equal(candidates[0].quantity, undefined);
  assert.equal(candidates[0].confidence, 0.5);
  assert.deepEqual(candidates[0].reasons, [
    "Найдена позиция",
    "Найдено оборудование или материал",
  ]);
});

test("skips numbered notes and section headings", () => {
  const candidates = extractSpecificationRowCandidates(
    [
      {
        pageNumber: 21,
        text: [
          "Примечание:",
          "1) Если указанного типа недостаточно, уточнить данные.",
          "2) Запас на длину воздуховодов принят 30%.",
          "2. Кондиционирование",
          "Оборудование",
          "2.1. Вентилятор канальный шт 2",
        ].join("\n"),
      },
    ],
    section
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].position, "2.1");
});
