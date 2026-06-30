import assert from "node:assert/strict";
import test from "node:test";

import {
  getCompareButtonLabel,
  getLoadingMessage,
  getProcessingSteps,
  getExportButtonLabel,
  getControlsDisabled,
  getExportDisabled,
} from "./loadingUi";

test("button disabled while single compare is loading", () => {
  assert.equal(getControlsDisabled({ isProcessing: true }), true);
  assert.equal(getCompareButtonLabel("single", true), "Идёт сравнение...");
});

test("button disabled while batch compare is loading", () => {
  assert.equal(getControlsDisabled({ isProcessing: true }), true);
  assert.equal(
    getCompareButtonLabel("batch", true),
    "Идёт пакетная проверка..."
  );
});

test("loading message is shown for single and batch compare", () => {
  assert.equal(
    getLoadingMessage("single"),
    "Обрабатываем PDF и КП. Это может занять до нескольких минут."
  );
  assert.equal(
    getLoadingMessage("batch"),
    "Проверяем проектные PDF и КП. Не закрывайте страницу."
  );
  assert.deepEqual(getProcessingSteps(), [
    "Загружаем файлы",
    "Извлекаем позиции из проекта",
    "Читаем КП",
    "Сравниваем позиции",
    "Формируем результат",
  ]);
});

test("export button shows forming Excel while exporting", () => {
  assert.equal(getExportButtonLabel(true), "Формируем Excel...");
});

test("controls are re-enabled after error", () => {
  assert.equal(
    getControlsDisabled({ isProcessing: false, processingError: "Ошибка" }),
    false
  );
});

test("export is disabled while processing or exporting", () => {
  assert.equal(
    getExportDisabled({
      compareMode: "single",
      resultsCount: 1,
      hasBatchResult: false,
      isProcessing: true,
      isExporting: false,
    }),
    true
  );
  assert.equal(
    getExportDisabled({
      compareMode: "batch",
      resultsCount: 0,
      hasBatchResult: true,
      isProcessing: false,
      isExporting: true,
    }),
    true
  );
});
