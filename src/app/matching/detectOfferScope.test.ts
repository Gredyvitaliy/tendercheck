import assert from "node:assert/strict";
import test from "node:test";

import type { CompareResult, WorkItem } from "../types";
import {
  applyOfferScopeToResults,
  detectOfferScope,
  isSpecItemInOfferScope,
} from "./detectOfferScope";

const item = (name: string, rate = ""): WorkItem => ({
  number: 1,
  name,
  rate,
  unit: "шт",
  projectVolume: 1,
  rowType: "item",
});

const missingResult = (name: string, rate = ""): CompareResult => ({
  name,
  rate,
  unit: "шт",
  specVolume: 1,
  offerName: "-",
  offerRate: "-",
  offerUnit: "-",
  offerVolume: "-",
  status: "Нет в КП",
  similarity: 0,
  reason: "Подходящая позиция в КП не найдена",
});

test("detects a dominant NED family scope", () => {
  const scope = detectOfferScope([
    item("Установка AIRNED A-100"),
    item("Вентилятор NED V-20"),
    item("Решетка LITENED R-10"),
    item("Клапан Арктос КВ-1"),
  ]);

  assert.deepEqual(scope.detectedBrands, [
    "NED",
    "AIRNED",
    "LITENED",
    "Арктос",
  ]);
  assert.deepEqual(scope.dominantBrands, ["NED", "AIRNED", "LITENED"]);
  assert.equal(scope.confidence, 0.75);
  assert.ok(scope.reasons.some((reason) => reason.includes("3 из 4")));
});

test("does not treat country and generic words as brands", () => {
  const scope = detectOfferScope([
    item("Вентилятор, Россия"),
    item("Отечественный клапан или аналог"),
    item("Импортный фильтр, РФ"),
  ]);

  assert.deepEqual(scope.detectedBrands, []);
  assert.deepEqual(scope.dominantBrands, []);
  assert.deepEqual(scope.keywords, []);
  assert.equal(scope.confidence, 0);
});

test("keeps mixed low-confidence brand evidence non-dominant", () => {
  const scope = detectOfferScope([
    item("Вентилятор NED"),
    item("Решетка Арктос"),
    item("Фильтр СовПлим"),
    item("Кондиционер KENTATSU"),
  ]);

  assert.deepEqual(scope.detectedBrands, [
    "NED",
    "Арктос",
    "СовПлим",
    "KENTATSU",
  ]);
  assert.deepEqual(scope.dominantBrands, []);
  assert.equal(scope.confidence, 0.25);
});

test("checks specification membership only for a confident NED scope", () => {
  const scope = detectOfferScope([
    item("Установка AIRNED A-100"),
    item("Вентилятор NED V-20"),
    item("Решетка LITENED R-10"),
  ]);

  assert.equal(isSpecItemInOfferScope(item("Агрегат NED V-30"), scope), true);
  assert.equal(
    isSpecItemInOfferScope(item("Решетка Арктос АМР"), scope),
    false
  );
  assert.equal(isSpecItemInOfferScope(item("Воздушный клапан"), scope), false);
});

test("keeps every specification item in scope when confidence is weak", () => {
  const scope = detectOfferScope([
    item("Вентилятор NED"),
    item("Решетка Арктос"),
  ]);

  assert.equal(isSpecItemInOfferScope(item("Решетка Арктос"), scope), true);
  assert.equal(isSpecItemInOfferScope(item("Воздушный клапан"), scope), true);
});

test("reclassifies only missing results outside a confident NED scope", () => {
  const scope = detectOfferScope([
    item("Установка AIRNED A-100"),
    item("Вентилятор NED V-20"),
    item("Решетка LITENED R-10"),
  ]);
  const partialResult: CompareResult = {
    ...missingResult("Решетка Арктос АМР"),
    status: "Частичное совпадение",
  };
  const original = [
    missingResult("Агрегат NED V-30"),
    missingResult("Решетка Арктос АМР"),
    missingResult("Воздушный клапан"),
    partialResult,
  ];

  const processed = applyOfferScopeToResults(original, scope);

  assert.deepEqual(
    processed.map((result) => result.status),
    [
      "Нет в КП",
      "Вне области КП",
      "Вне области КП",
      "Частичное совпадение",
    ]
  );
  assert.match(processed[1].reason, /NED/);
  assert.equal(processed[3], partialResult);
  assert.notEqual(processed, original);
});

test("does not reclassify results when scope confidence is weak", () => {
  const scope = detectOfferScope([
    item("Вентилятор NED"),
    item("Решетка Арктос"),
  ]);
  const original = [missingResult("Решетка Арктос АМР")];

  const processed = applyOfferScopeToResults(original, scope);

  assert.deepEqual(processed, original);
});
