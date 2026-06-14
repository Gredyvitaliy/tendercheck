import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyPdfPage,
  scoreCommercialLetter,
  scoreEquipmentSelection,
  scoreGeneralData,
  scoreLocalExhaustTable,
  scoreSpecification,
} from "./classifyPdfPage";
import { normalizePageText } from "./pageTextUtils";

test("classifies a specification page", () => {
  const result = classifyPdfPage(
    10,
    "Спецификация оборудования, изделий и материалов Поз. Обозначение Наименование Ед. изм. Кол. Масса Примечание Вентилятор Клапан"
  );

  assert.equal(result.type, "specification");
  assert.ok(result.score > 0);
  assert.ok(result.reasons.length > 0);
});

test("rejects a weak specification with only table words", () => {
  const score = scoreSpecification(
    normalizePageText("Наименование Масса Фильтр")
  );
  const classification = classifyPdfPage(
    17,
    "Наименование Масса Фильтр"
  );

  assert.equal(score.score, 0);
  assert.ok(
    score.reasons.some((reason) =>
      reason.toLowerCase().includes("слаб")
    )
  );
  assert.equal(classification.type, "unknown");
  assert.deepEqual(classification.reasons, []);
});

test("rejects four specification columns with fewer than two items", () => {
  const result = classifyPdfPage(
    18,
    "Поз. Обозначение Наименование Примечание Фильтр"
  );

  assert.equal(result.type, "unknown");
});

test("accepts four specification columns with two engineering items", () => {
  const result = classifyPdfPage(
    19,
    "Поз. Обозначение Наименование Примечание Фильтр Вентилятор"
  );

  assert.equal(result.type, "specification");
  assert.ok(result.score >= 10);
});

test("rejects a specification score below ten without a strong title", () => {
  const result = scoreSpecification(
    normalizePageText("Оборудования, изделий и материалов")
  );

  assert.equal(result.score, 0);
  assert.ok(
    result.reasons.some((reason) =>
      reason.toLowerCase().includes("слаб")
    )
  );
});

test("does not infer a specification continuation from one page", () => {
  const result = classifyPdfPage(
    20,
    "Поз. Обозначение Наименование Кол. Крепление монтажное шт 4"
  );

  assert.equal(result.type, "unknown");
});

test("rejects a table with only two specification columns", () => {
  const result = classifyPdfPage(
    21,
    "Наименование Обозначение Крепление монтажное шт 4"
  );

  assert.equal(result.type, "unknown");
});

test("equipment selection wins over specification-like columns", () => {
  const result = classifyPdfPage(
    22,
    "Поз. Обозначение Наименование Кол. шт Подбор оборудования AIRNED П10.1"
  );

  assert.equal(result.type, "equipment-selection");
});

test("commercial letter wins over specification-like columns", () => {
  const result = classifyPdfPage(
    23,
    "Поз. Обозначение Наименование Кол. шт Коммерческое предложение Стоимость"
  );

  assert.equal(result.type, "commercial-letter");
});

test("classifies an equipment selection page", () => {
  const result = classifyPdfPage(
    11,
    "Подбор оборудования Вентиляционная установка П10.1 Параметры установки Расход воздуха Полное давление AIRNED"
  );

  assert.equal(result.type, "equipment-selection");
});

test("classifies a local exhaust table", () => {
  const result = classifyPdfPage(
    12,
    "Местные отсосы Укрытие Зонт местного отсоса Расход удаляемого воздуха"
  );

  assert.equal(result.type, "local-exhaust-table");
});

test("classifies a general data page", () => {
  const result = classifyPdfPage(
    13,
    "Общие данные Ведомость рабочих чертежей Ведомость ссылочных документов Основные показатели Нормативные документы"
  );

  assert.equal(result.type, "general-data");
});

test("commercial letter defeats specification-like table content", () => {
  const result = classifyPdfPage(
    14,
    "Коммерческое предложение Исх. № Кому Настоящим предлагаем Стоимость Срок поставки Условия оплаты С уважением Наименование Ед. изм. Кол. Примечание Вентилятор"
  );

  assert.equal(result.type, "commercial-letter");
  assert.ok(
    result.reasons.some((reason) =>
      reason.toLowerCase().includes("коммерчес")
    )
  );
});

test("commercial letter wins an equal title score", () => {
  const result = classifyPdfPage(
    15,
    "Коммерческое предложение Спецификация оборудования"
  );

  assert.equal(result.type, "commercial-letter");
});

test("returns unknown for unrelated text", () => {
  assert.deepEqual(classifyPdfPage(16, "Титульный лист проекта"), {
    pageNumber: 16,
    type: "unknown",
    score: 0,
    reasons: [],
  });
});

test("each scoring function returns its own type and reasons", () => {
  const cases = [
    [scoreSpecification, "спецификация материалов"],
    [scoreEquipmentSelection, "подбор оборудования"],
    [scoreLocalExhaustTable, "местный отсос"],
    [scoreGeneralData, "общие данные"],
    [scoreCommercialLetter, "коммерческое предложение"],
  ] as const;

  for (const [score, text] of cases) {
    const result = score(normalizePageText(text));

    assert.ok(result.score > 0);
    assert.ok(result.reasons.length > 0);
    assert.notEqual(result.type, "unknown");
  }
});
