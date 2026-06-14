import assert from "node:assert/strict";
import test from "node:test";

import {
  exportSpecificationSectionText,
  formatSpecificationSectionDebugOutput,
} from "./exportSpecificationSectionText";

const section = {
  startPage: 21,
  endPage: 22,
  sheetCount: 2,
  reason: "test section",
};

test("exports only pages inside the specification section", () => {
  const output = exportSpecificationSectionText(
    [
      { pageNumber: 20, text: "До раздела" },
      {
        pageNumber: 21,
        text: [
          "Лист 1",
          "Поз. Наименование Ед. изм. Кол.",
          "1 Вентилятор канальный шт 2",
          "Примечание",
        ].join("\n"),
      },
      {
        pageNumber: 22,
        text: [
          "Лист 2",
          "2 Воздуховод прямоугольный м2 12.5",
          "Конец листа",
        ].join("\n"),
      },
      { pageNumber: 23, text: "После раздела" },
    ],
    section
  );

  assert.deepEqual(
    output.pages.map((page) => page.pageNumber),
    [21, 22]
  );
  assert.deepEqual(output.pages[0].firstLines, [
    "Лист 1",
    "Поз. Наименование Ед. изм. Кол.",
    "1 Вентилятор канальный шт 2",
    "Примечание",
  ]);
  assert.ok(
    output.pages[0].positionLikeLines.includes(
      "1 Вентилятор канальный шт 2"
    )
  );
  assert.ok(
    output.pages[1].positionLikeLines.includes(
      "2 Воздуховод прямоугольный м2 12.5"
    )
  );
});

test("formats section metadata and page debug blocks", () => {
  const output = exportSpecificationSectionText(
    [{ pageNumber: 21, text: "Лист 1\n1 Клапан шт 3" }],
    {
      startPage: 21,
      endPage: 21,
      sheetCount: 1,
      reason: "detected",
    }
  );
  const formatted = formatSpecificationSectionDebugOutput(output);

  assert.match(formatted, /Specification section: pages 21-21, sheets 1/);
  assert.match(formatted, /PAGE 21/);
  assert.match(formatted, /POSITION-LIKE LINES/);
  assert.match(formatted, /1 Клапан шт 3/);
});
