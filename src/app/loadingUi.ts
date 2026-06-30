export type CompareMode = "single" | "batch";

export interface ControlsDisabledInput {
  isProcessing: boolean;
  processingError?: string;
}

export interface ExportDisabledInput {
  compareMode: CompareMode;
  resultsCount: number;
  hasBatchResult: boolean;
  isProcessing: boolean;
  isExporting: boolean;
}

export const getCompareButtonLabel = (
  compareMode: CompareMode,
  isProcessing: boolean
): string => {
  if (isProcessing) {
    return compareMode === "batch"
      ? "Идёт пакетная проверка..."
      : "Идёт сравнение...";
  }

  return compareMode === "batch" ? "Проверить все КП" : "Сравнить файлы";
};

export const getLoadingMessage = (compareMode: CompareMode): string =>
  compareMode === "batch"
    ? "Проверяем проектные PDF и КП. Не закрывайте страницу."
    : "Обрабатываем PDF и КП. Это может занять до нескольких минут.";

export const getProcessingSteps = (): string[] => [
  "Загружаем файлы",
  "Извлекаем позиции из проекта",
  "Читаем КП",
  "Сравниваем позиции",
  "Формируем результат",
];

export const getExportButtonLabel = (isExporting: boolean): string =>
  isExporting ? "Формируем Excel..." : "Скачать отчет Excel";

export const getControlsDisabled = ({
  isProcessing,
}: ControlsDisabledInput): boolean => isProcessing;

export const getExportDisabled = ({
  compareMode,
  resultsCount,
  hasBatchResult,
  isProcessing,
  isExporting,
}: ExportDisabledInput): boolean => {
  if (isProcessing || isExporting) return true;

  return compareMode === "batch" ? !hasBatchResult : resultsCount === 0;
};
