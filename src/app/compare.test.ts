import assert from "node:assert/strict";
import test from "node:test";

import { compareWorkItems } from "./compare";
import type { WorkItem } from "./types";

const item = (overrides: Partial<WorkItem>): WorkItem => ({
  number: 1,
  name: "Item",
  rate: "",
  unit: "шт",
  projectVolume: 1,
  rowType: "item",
  ...overrides,
});

const findSpecResult = (results: ReturnType<typeof compareWorkItems>, name: string) => {
  const result = results.find((entry) => entry.name === name);

  assert.ok(result, `Expected result for ${name}`);

  return result;
};

test("marks AIRNED parent installation as aggregated when child scope items are matched", () => {
  const parent = item({
    name: "П10.1 Установка AIRNED с комплектующими",
    rate: "AIRNED-50-30",
  });
  const child = item({
    number: 2,
    name: "Воздухоохладитель LITENED RW",
    rate: "LITENED 50-30 RW",
  });
  const offerChild = item({
    name: "Воздухоохладитель LITENED RW",
    rate: "LITENED 50-30 RW",
  });

  const results = compareWorkItems([parent, child], [offerChild]);
  const parentResult = findSpecResult(results, parent.name);

  assert.equal(parentResult.status, "Агрегированная позиция");
  assert.match(parentResult.reason, /комплект/i);
});

test("does not report ordinary volume difference when PDF quantity is not recognized", () => {
  const spec = item({
    name: "Воздухоохладитель LITENED RW",
    rate: "LITENED 50-30 RW",
    unit: "",
    projectVolume: 0,
  });
  const offer = item({
    name: "Воздухоохладитель LITENED RW",
    rate: "LITENED 50-30 RW",
    unit: "шт",
    projectVolume: 1,
  });

  const [result] = compareWorkItems([spec], [offer]);

  assert.equal(result.status, "Количество в PDF не распознано");
  assert.match(result.reason, /Количество в PDF не распознано/i);
});

test("rejects partial equipment matches with different explicit equipment tokens", () => {
  const spec = item({
    name: "Воздухоохладитель LITENED 50-30 RW",
    rate: "LITENED 50-30 RW",
  });
  const offer = item({
    name: "Секция гликолевого рекуператора LITENED 50-30 RGV",
    rate: "LITENED 50-30 RGV",
  });

  const [result] = compareWorkItems([spec], [offer]);

  assert.equal(result.status, "Нет в КП");
  assert.equal(result.offerName, "-");
  assert.match(result.reason, /RW.*RGV|RGV.*RW/i);
});

test("rejects RW to PSK equipment match despite same LITENED size", () => {
  const spec = item({
    name: "Воздухоохладитель водяной LITENED 50-30 RW (левый) NED",
    rate: "LITENED 50-30 RW",
  });
  const offer = item({
    name: "Пустая секция под заслонку LITENED 50-30 PSK",
    rate: "LITENED 50-30 PSK",
  });

  const [result] = compareWorkItems([spec], [offer]);

  assert.notEqual(result.status, "Частичное совпадение");
  assert.equal(result.status, "Нет в КП");
  assert.equal(result.offerName, "-");
});

test("rejects RW cooler to roof equipment match despite overlapping LITENED size", () => {
  const spec = item({
    name: "Воздухоохладитель водяной LITENED 50-30 RW (левый) NED",
    rate: "LITENED 50-30 RW",
  });
  const offer = item({
    name: "Крыша LITENED 50-25 (50-30) L=1000 мм",
    rate: "LITENED 50-25 (50-30) L=1000 мм",
  });

  const [result] = compareWorkItems([spec], [offer]);

  assert.notEqual(result.status, "ОК");
  assert.notEqual(result.status, "Объем отличается");
  assert.notEqual(result.status, "Частичное совпадение");
  assert.equal(result.status, "Нет в КП");
  assert.equal(result.offerName, "-");
});

test("rejects RW cooler to grille equipment match despite same LITENED size", () => {
  const spec = item({
    name: "Воздухоохладитель водяной LITENED 50-30 RW (левый) NED",
    rate: "LITENED 50-30 RW",
  });
  const offer = item({
    name: "Воздухозаборная решетка LITENED 50-30 М",
    rate: "LITENED 50-30 М",
  });

  const [result] = compareWorkItems([spec], [offer]);

  assert.equal(result.status, "Нет в КП");
  assert.equal(result.offerName, "-");
});

test("allows RW cooler to match another RW cooler", () => {
  const spec = item({
    name: "Воздухоохладитель водяной LITENED 50-30 RW (левый) NED",
    rate: "LITENED 50-30 RW",
  });
  const offer = item({
    name: "Воздухоохладитель водяной LITENED 50-30 RW левый",
    rate: "LITENED 50-30 RW",
  });

  const [result] = compareWorkItems([spec], [offer]);

  assert.notEqual(result.status, "Нет в КП");
  assert.notEqual(result.offerName, "-");
});
