import assert from "node:assert/strict";
import test from "node:test";

import type { WorkItem } from "../types";
import { splitPdfCompositeWorkItems } from "./splitPdfCompositeWorkItems";

const item = (name: string, position = "3.10"): WorkItem => ({
  number: 9,
  name,
  rate: "",
  unit: "шт",
  projectVolume: 1,
  rowType: "item",
  position,
});

test("splits a structured LITENED composite into quantified children", () => {
  const result = splitPdfCompositeWorkItems([
    item(
      "П14 (L=4500м3/ч, Pc=700Па) " +
        "Корпус фильтра LITENED 80-50 FRUM NED шт 1 «или аналог» " +
        "Вставка карманная DFUM 80-50 G3 NED шт 1 «или аналог» " +
        "Заслонка CHR 80-50 NED шт 2 «или аналог» " +
        "Шумоглушитель LITENED 80-50 NKD NED"
    ),
  ]);

  assert.equal(result.length, 4);
  assert.deepEqual(
    result.map(({ name, unit, projectVolume, position }) => ({
      name,
      unit,
      projectVolume,
      position,
    })),
    [
      {
        name: "Корпус фильтра LITENED 80-50 FRUM NED",
        unit: "шт",
        projectVolume: 1,
        position: "3.10.1",
      },
      {
        name: "Вставка карманная DFUM 80-50 G3 NED",
        unit: "шт",
        projectVolume: 1,
        position: "3.10.2",
      },
      {
        name: "Заслонка CHR 80-50 NED",
        unit: "шт",
        projectVolume: 2,
        position: "3.10.3",
      },
      {
        name: "Шумоглушитель LITENED 80-50 NKD NED",
        unit: "",
        projectVolume: 0,
        position: "3.10.4",
      },
    ]
  );
  assert.equal(result[0].debugReason, "split from composite PDF item");
  assert.equal(result[0].parentPosition, "3.10");
});

test("splits mixed quantity units in a K1 composite", () => {
  const result = splitPdfCompositeWorkItems([
    item(
      "K1 (К1.1, К1.2) " +
        "Наружный блок KSRN105 KENTATSU шт 3 «или аналог» " +
        "Внутренний блок KSGN105 KENTATSU шт 3 «или аналог» " +
        "Труба медная MUELLER «или аналог» Ø9,52 м 20 " +
        "Ø15,88 м 20 Изоляция трубчатая",
      "2.1"
    ),
  ]);

  assert.deepEqual(
    result.map((child) => [
      child.name,
      child.unit,
      child.projectVolume,
      child.position,
    ]),
    [
      ["Наружный блок KSRN105 KENTATSU", "шт", 3, "2.1.1"],
      ["Внутренний блок KSGN105 KENTATSU", "шт", 3, "2.1.2"],
      ["Труба медная MUELLER Ø9,52", "м", 20, "2.1.3"],
      ["Ø15,88", "м", 20, "2.1.4"],
      ["Изоляция трубчатая", "", 0, "2.1.5"],
    ]
  );
});

test("keeps a single AIRNED installation unchanged", () => {
  const source = item(
    "П10.1 (L=17085м3/ч) Установка AIRNED-" +
      "R21L/B1/K1/F1/F5/H1/G1/N1.2/C1.2.8/V1.4.P80.R-15x15 NED",
    "3.1"
  );

  assert.deepEqual(splitPdfCompositeWorkItems([source]), [
    { ...source, number: 0 },
  ]);
});

test("keeps a simple item unchanged and renumbers the output", () => {
  const source = item("Зонт вытяжной ЗВ-1 шт 2", "4.1");

  assert.deepEqual(splitPdfCompositeWorkItems([source]), [
    { ...source, number: 0 },
  ]);
});
