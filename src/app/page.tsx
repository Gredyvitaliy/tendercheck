"use client";

import { useState } from "react";
import type {
  WorkItem,
  CompareResult,
} from "./types";
import { parseSpecExcel, parseOfferExcel } from "./parsers";
import { exportResultsToExcel } from "./exportReport";
import { compareWorkItems } from "./compare";
import {
  applyOfferScopeToResults,
  detectOfferScope,
  type OfferScope,
} from "./matching/detectOfferScope";
import {
  ProjectPdfProcessingError,
  loadProjectPdfWorkItems,
} from "./projectPdf/loadProjectPdfWorkItems";
import {
  ArWindowsPdfCompareError,
  loadArWindowsPdfCompare,
} from "./projectPdf/arWindows/loadArWindowsPdfCompare";
import type { PdfTextLayerDiagnostics } from "./projectPdf/pdfTextDiagnostics";
import {
  loadUnifiedProjectPdfCompare,
  type UnifiedPdfProjectTechnicalInfo,
} from "./projectPdf/loadUnifiedProjectPdfCompare";

type SpecificationSource = "excel" | "pdf";
type PdfProjectMode = "auto" | "text" | "arWindows";

type PdfDiagnostics = {
  mode?: PdfProjectMode;
  beforeSplitCount?: number;
  afterSplitCount?: number;
  arWorkItemsCount?: number;
  excelOfferWorkItemsCount?: number;
  technicalInfo?: PdfTextLayerDiagnostics;
  unifiedTechnicalInfo?: UnifiedPdfProjectTechnicalInfo;
  offerScope: OfferScope;
  statusCountsBeforeScope: Record<string, number>;
  statusCountsAfterScope: Record<string, number>;
};

const countStatuses = (
  comparison: CompareResult[]
): Record<string, number> =>
  comparison.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});

export default function Home() {
  const [specificationSource, setSpecificationSource] =
    useState<SpecificationSource>("excel");
  const [pdfProjectMode, setPdfProjectMode] =
    useState<PdfProjectMode>("auto");
  const [specItems, setSpecItems] = useState<WorkItem[]>([]);
  const [offerItems, setOfferItems] = useState<WorkItem[]>([]);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [projectPdf, setProjectPdf] = useState<File | null>(null);
  const [offerFile, setOfferFile] = useState<File | null>(null);
  const [pdfDiagnostics, setPdfDiagnostics] =
    useState<PdfDiagnostics | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    CompareResult["status"] | "Все"
  >("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadResetKey, setUploadResetKey] = useState(0);

  const handleSpecUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  parseSpecExcel(file, (items) => {
    setSpecItems(items);
  });
};

  const handleProjectPdfUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0] ?? null;
    setProjectPdf(file);
    setPdfDiagnostics(null);
    setProcessingError("");
    setResults([]);
  };

  const handleOfferUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setOfferFile(file);
  setPdfDiagnostics(null);
  setProcessingError("");
  setResults([]);

  parseOfferExcel(file, (items) => {
    setOfferItems(items);
  });
};

  const clearAllData = () => {
    setSpecItems([]);
    setOfferItems([]);
    setResults([]);
    setProjectPdf(null);
    setOfferFile(null);
    setPdfProjectMode("auto");
    setPdfDiagnostics(null);
    setProcessingError("");
    setIsProcessing(false);
    setSearchQuery("");
    setStatusFilter("Все");
    setUploadResetKey((prev) => prev + 1);
  };

  const compareFiles = async () => {
    setProcessingError("");

    if (specificationSource === "excel") {
      if (offerItems.length === 0) {
        setProcessingError("Загрузите Excel КП подрядчика");
        return;
      }

      if (specItems.length === 0) {
        setProcessingError("Загрузите Excel спецификацию");
        return;
      }

      setPdfDiagnostics(null);
      setResults(compareWorkItems(specItems, offerItems));
      return;
    }

    if (!projectPdf) {
      setProcessingError("Загрузите PDF проекта");
      return;
    }

    if (pdfProjectMode === "auto") {
      if (offerItems.length === 0 || !offerFile) {
        setProcessingError("Р—Р°РіСЂСѓР·РёС‚Рµ Excel РљРџ РїРѕРґСЂСЏРґС‡РёРєР°");
        return;
      }

      setIsProcessing(true);

      try {
        const unifiedResult = await loadUnifiedProjectPdfCompare({
          mode: "auto",
          pdfFile: projectPdf,
          excelOfferFile: offerFile,
          offerItems,
        });
        const offerScope = detectOfferScope(offerItems);
        const comparison = applyOfferScopeToResults(
          unifiedResult.results,
          offerScope
        );
        const statusCountsAfterScope = countStatuses(comparison);

        setSpecItems(unifiedResult.workItems);
        setPdfDiagnostics({
          mode: "auto",
          beforeSplitCount: unifiedResult.textPdfResult?.beforeSplitCount,
          afterSplitCount: unifiedResult.textPdfResult?.afterSplitCount,
          arWorkItemsCount:
            unifiedResult.technicalInfo.arWindowsWorkItemsCount,
          excelOfferWorkItemsCount: offerItems.length,
          technicalInfo:
            unifiedResult.technicalInfo.textPdfTechnicalInfo ??
            unifiedResult.technicalInfo.arWindowsTechnicalInfo,
          unifiedTechnicalInfo: unifiedResult.technicalInfo,
          offerScope,
          statusCountsBeforeScope: unifiedResult.statusCounts,
          statusCountsAfterScope,
        });
        setResults(comparison);

        console.info("Unified PDF project comparison", {
          technicalInfo: unifiedResult.technicalInfo,
          statusCountsBeforeScope: unifiedResult.statusCounts,
          statusCountsAfterScope,
        });
      } catch (error) {
        setResults([]);
        setPdfDiagnostics(null);
        setProcessingError(
          error instanceof Error
            ? error.message
            : "РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±СЂР°Р±РѕС‚Р°С‚СЊ PDF РїСЂРѕРµРєС‚Р°"
        );
      } finally {
        setIsProcessing(false);
      }

      return;
    }

    if (pdfProjectMode === "arWindows") {
      if (!offerFile) {
        setProcessingError("Загрузите Excel КП подрядчика");
        return;
      }

      setIsProcessing(true);

      try {
        const arResult = await loadArWindowsPdfCompare(projectPdf, offerFile);
        const offerScope = detectOfferScope(offerItems);

        setSpecItems(arResult.arWorkItems);
        setPdfDiagnostics({
          mode: "arWindows",
          arWorkItemsCount: arResult.arWorkItemsCount,
          excelOfferWorkItemsCount: arResult.excelOfferWorkItemsCount,
          technicalInfo: arResult.technicalInfo,
          unifiedTechnicalInfo: {
            totalProjectWorkItemsCount: arResult.arWorkItems.length,
            textPdfWorkItemsCount: 0,
            arWindowsWorkItemsCount: arResult.arWorkItemsCount,
            extractionStrategiesUsed: ["ar_windows_ocr"],
            fallbackUsed: Boolean(arResult.technicalInfo.arFallbackUsed),
            fallbackReason: arResult.technicalInfo.arFallbackReason,
            arWindowsTechnicalInfo: arResult.technicalInfo,
          },
          offerScope,
          statusCountsBeforeScope: arResult.statusCounts,
          statusCountsAfterScope: arResult.statusCounts,
        });
        setResults(arResult.results);

        console.info("AR windows PDF project comparison", {
          arWorkItemsCount: arResult.arWorkItemsCount,
          excelOfferWorkItemsCount: arResult.excelOfferWorkItemsCount,
          statusCounts: arResult.statusCounts,
          technicalInfo: arResult.technicalInfo,
        });
      } catch (error) {
        setResults([]);
        setPdfDiagnostics(null);
        setProcessingError(
          error instanceof ArWindowsPdfCompareError || error instanceof Error
            ? error.message
            : "Не удалось сравнить PDF АР окна / витражи с Excel КП"
        );
      } finally {
        setIsProcessing(false);
      }

      return;
    }

    if (offerItems.length === 0) {
      setProcessingError("Загрузите Excel КП подрядчика");
      return;
    }

    setIsProcessing(true);

    try {
      const pdfResult = await loadProjectPdfWorkItems(projectPdf);
      const offerScope = detectOfferScope(offerItems);
      const comparisonBeforeScope = compareWorkItems(
        pdfResult.workItems,
        offerItems
      );
      const comparison = applyOfferScopeToResults(
        comparisonBeforeScope,
        offerScope
      );
      const statusCountsBeforeScope = countStatuses(comparisonBeforeScope);
      const statusCountsAfterScope = countStatuses(comparison);

      setSpecItems(pdfResult.workItems);
      setPdfDiagnostics({
        mode: "text",
        beforeSplitCount: pdfResult.beforeSplitCount,
        afterSplitCount: pdfResult.afterSplitCount,
        technicalInfo: pdfResult.technicalInfo,
        unifiedTechnicalInfo: {
          totalProjectWorkItemsCount: pdfResult.workItems.length,
          textPdfWorkItemsCount: pdfResult.workItems.length,
          arWindowsWorkItemsCount: 0,
          extractionStrategiesUsed: ["pdf_text"],
          fallbackUsed: false,
          textPdfTechnicalInfo: pdfResult.technicalInfo,
        },
        offerScope,
        statusCountsBeforeScope,
        statusCountsAfterScope,
      });
      setResults(comparison);

      console.info("PDF project comparison", {
        pdfWorkItemsBeforeSplit: pdfResult.beforeSplitCount,
        pdfWorkItemsAfterSplit: pdfResult.afterSplitCount,
        excelOfferWorkItems: offerItems.length,
        offerScope,
        statusCountsBeforeScope,
        statusCountsAfterScope,
      });
    } catch (error) {
      setResults([]);
      setPdfDiagnostics(
        error instanceof ProjectPdfProcessingError && error.technicalInfo
          ? {
              technicalInfo: error.technicalInfo,
              offerScope: detectOfferScope(offerItems),
              statusCountsBeforeScope: {},
              statusCountsAfterScope: {},
            }
          : null
      );
      setProcessingError(
        error instanceof Error
          ? error.message
          : "Не удалось обработать PDF проекта"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusClass = (status: CompareResult["status"]) => {
    if (status === "ОК") return "text-green-700 bg-green-100";
    if (status === "Объем отличается") return "text-orange-700 bg-orange-100";
    if (status === "Размер отличается") return "text-purple-700 bg-purple-100";
    if (status === "Частичное совпадение")
      return "text-yellow-700 bg-yellow-100";
    if (status === "Вне области КП")
      return "text-gray-700 bg-gray-100";
    if (status === "Есть в КП, нет в спецификации")
      return "text-blue-700 bg-blue-100";

    return "text-red-700 bg-red-100";
  };

  const okCount = results.filter((item) => item.status === "ОК").length;

  const volumeDiffCount = results.filter(
    (item) => item.status === "Объем отличается"
  ).length;

  const sizeDiffCount = results.filter(
    (item) => item.status === "Размер отличается"
  ).length;

  const partialCount = results.filter(
    (item) => item.status === "Частичное совпадение"
  ).length;

  const missingCount = results.filter(
    (item) => item.status === "Нет в КП"
  ).length;

  const aggregatedCount = results.filter(
    (item) => item.status === "Агрегированная позиция"
  ).length;

  const unrecognizedQuantityCount = results.filter(
    (item) => item.status === "Количество в PDF не распознано"
  ).length;

  const outOfScopeCount = results.filter(
    (item) => item.status === "Вне области КП"
  ).length;

  const extraOfferCount = results.filter(
    (item) => item.status === "Есть в КП, нет в спецификации"
  ).length;

  const filteredResults = results
    .filter((item) => statusFilter === "Все" || item.status === statusFilter)
    .filter((item) => {
      const query = searchQuery.toLowerCase().trim();

      if (!query) return true;

      return [
        item.name,
        item.rate,
        item.unit,
        String(item.specVolume),
        item.offerName,
        item.offerRate,
        item.offerUnit,
        String(item.offerVolume),
        item.status,
        String(item.similarity || ""),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

  return (
    <main className="min-h-screen bg-gray-100 p-10">
      <h1 className="text-4xl font-bold mb-6 text-gray-800">TenderCheck</h1>

      <p className="mb-6 text-lg text-gray-600">
        Сравнение спецификации и КП подрядчика
      </p>

      <div className="mb-6 rounded-xl bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-semibold">
          Источник спецификации
        </h2>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="specification-source"
              value="excel"
              checked={specificationSource === "excel"}
              onChange={() => {
                setSpecificationSource("excel");
                setProjectPdf(null);
                setPdfDiagnostics(null);
                setProcessingError("");
                setResults([]);
                setUploadResetKey((prev) => prev + 1);
              }}
            />
            Excel спецификация
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="specification-source"
              value="pdf"
              checked={specificationSource === "pdf"}
              onChange={() => {
                setSpecificationSource("pdf");
                setSpecItems([]);
                setPdfDiagnostics(null);
                setProcessingError("");
                setResults([]);
                setUploadResetKey((prev) => prev + 1);
              }}
            />
            PDF проект
          </label>
        </div>
        {specificationSource === "pdf" && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-gray-700">
              Режим обработки PDF
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pdf-project-mode"
                  value="auto"
                  checked={pdfProjectMode === "auto"}
                  onChange={() => {
                    setPdfProjectMode("auto");
                    setPdfDiagnostics(null);
                    setProcessingError("");
                    setResults([]);
                  }}
                />
                Авто / весь проект
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pdf-project-mode"
                  value="text"
                  checked={pdfProjectMode === "text"}
                  onChange={() => {
                    setPdfProjectMode("text");
                    setPdfDiagnostics(null);
                    setProcessingError("");
                    setResults([]);
                  }}
                />
                Обычная спецификация
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pdf-project-mode"
                  value="arWindows"
                  checked={pdfProjectMode === "arWindows"}
                  onChange={() => {
                    setPdfProjectMode("arWindows");
                    setPdfDiagnostics(null);
                    setProcessingError("");
                    setResults([]);
                  }}
                />
                АР окна / витражи
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">
            1. Эталон / спецификация
          </h2>

          {specificationSource === "excel" ? (
            <input
              key={`spec-${uploadResetKey}`}
              type="file"
              accept=".xlsx, .xls"
              onChange={handleSpecUpload}
              aria-label="Загрузить Excel спецификацию"
            />
          ) : (
            <input
              key={`pdf-${uploadResetKey}`}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleProjectPdfUpload}
              aria-label="Загрузить PDF проекта"
              disabled={isProcessing}
            />
          )}

          <p className="mt-4 text-sm text-gray-600">
            {specificationSource === "excel"
              ? `Загружено позиций: ${specItems.length}`
              : projectPdf
                ? `Выбран файл: ${projectPdf.name}`
                : "PDF проекта не выбран"}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">2. КП подрядчика</h2>

          <input
            key={`offer-${uploadResetKey}`}
            type="file"
            accept=".xlsx, .xls"
            onChange={handleOfferUpload}
            disabled={isProcessing}
          />

          <p className="mt-4 text-sm text-gray-600">
            Загружено позиций: {offerItems.length}
          </p>
        </div>
      </div>

      <button
        onClick={() => void compareFiles()}
        disabled={isProcessing}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl text-lg mb-8"
      >
        {isProcessing ? "Обработка PDF..." : "Сравнить файлы"}
      </button>

      <button
        onClick={() => exportResultsToExcel(results)}
        disabled={results.length === 0}
        className="ml-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl text-lg mb-8"
      >
        Скачать отчет Excel
      </button>

      <button
        onClick={clearAllData}
        disabled={
          specItems.length === 0 &&
          offerItems.length === 0 &&
          results.length === 0 &&
          projectPdf === null &&
          offerFile === null
        }
        className="ml-4 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl text-lg mb-8"
      >
        Очистить файлы
      </button>

      <div className="mb-8 rounded-xl bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-semibold">
          Техническая информация
        </h2>
        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <p>
            Состояние:{" "}
            {isProcessing
              ? "обработка PDF"
              : processingError
                ? "ошибка"
                : results.length > 0
                  ? "сравнение завершено"
                  : "ожидание файлов"}
          </p>
          <p>
            PDF mode:{" "}
            {specificationSource === "pdf"
              ? pdfProjectMode === "arWindows"
                ? "АР окна / витражи"
                : "Обычная спецификация"
              : "-"}
          </p>
          <p>Excel offer WorkItems: {offerItems.length}</p>
          <p>
            Unified PDF mode:{" "}
            {specificationSource === "pdf" ? pdfProjectMode : "-"}
          </p>
          <p>
            Total project WorkItems:{" "}
            {pdfDiagnostics?.unifiedTechnicalInfo
              ?.totalProjectWorkItemsCount ?? "-"}
          </p>
          <p>
            Text PDF WorkItems count:{" "}
            {pdfDiagnostics?.unifiedTechnicalInfo?.textPdfWorkItemsCount ??
              "-"}
          </p>
          <p>
            AR windows WorkItems count:{" "}
            {pdfDiagnostics?.unifiedTechnicalInfo?.arWindowsWorkItemsCount ??
              "-"}
          </p>
          <p>
            Extraction strategies used:{" "}
            {pdfDiagnostics?.unifiedTechnicalInfo?.extractionStrategiesUsed.join(
              ", "
            ) || "-"}
          </p>
          <p>
            Fallback used:{" "}
            {pdfDiagnostics?.unifiedTechnicalInfo
              ? String(pdfDiagnostics.unifiedTechnicalInfo.fallbackUsed)
              : "-"}
          </p>
          <p>
            Fallback reason:{" "}
            {pdfDiagnostics?.unifiedTechnicalInfo?.fallbackReason || "-"}
          </p>
          <p>
            AR WorkItems count:{" "}
            {pdfDiagnostics?.arWorkItemsCount ?? "-"}
          </p>
          <p>
            AR Excel offer WorkItems count:{" "}
            {pdfDiagnostics?.excelOfferWorkItemsCount ?? "-"}
          </p>
          <p>
            PDF WorkItems before split:{" "}
            {pdfDiagnostics?.beforeSplitCount ?? "-"}
          </p>
          <p>
            PDF WorkItems after split:{" "}
            {pdfDiagnostics?.afterSplitCount ?? "-"}
          </p>
          <p>
            PDF extractedTextLength:{" "}
            {pdfDiagnostics?.technicalInfo?.extractedTextLength ?? "-"}
          </p>
          <p>
            PDF pagesWithTextCount:{" "}
            {pdfDiagnostics?.technicalInfo?.pagesWithTextCount ?? "-"}
          </p>
          <p>
            PDF likelyScannedOrDrawingPdf:{" "}
            {pdfDiagnostics?.technicalInfo
              ? String(
                  pdfDiagnostics.technicalInfo.likelyScannedOrDrawingPdf
                )
              : "-"}
          </p>
          <p>ОК: {okCount}</p>
          <p>Объем отличается: {volumeDiffCount}</p>
          <p>Размер отличается: {sizeDiffCount}</p>
          <p>Частичное совпадение: {partialCount}</p>
          <p>Агрегированная позиция: {aggregatedCount}</p>
          <p>Количество в PDF не распознано: {unrecognizedQuantityCount}</p>
          <p>Нет в КП в зоне КП: {missingCount}</p>
          <p>Вне области КП: {outOfScopeCount}</p>
          <p>Есть в КП, нет в спецификации: {extraOfferCount}</p>
          <p>
            Detected brands:{" "}
            {pdfDiagnostics?.offerScope.detectedBrands.join(", ") || "-"}
          </p>
          <p>
            Dominant brands:{" "}
            {pdfDiagnostics?.offerScope.dominantBrands.join(", ") || "-"}
          </p>
          <p>
            Scope confidence:{" "}
            {pdfDiagnostics
              ? `${Math.round(pdfDiagnostics.offerScope.confidence * 100)}%`
              : "-"}
          </p>
          <p className="md:col-span-2">
            Scope reasons:{" "}
            {pdfDiagnostics?.offerScope.reasons.join("; ") || "-"}
          </p>
          <p className="md:col-span-2">
            Counts before scope:{" "}
            {pdfDiagnostics
              ? JSON.stringify(pdfDiagnostics.statusCountsBeforeScope)
              : "-"}
          </p>
          <p className="md:col-span-2">
            Counts after scope:{" "}
            {pdfDiagnostics
              ? JSON.stringify(pdfDiagnostics.statusCountsAfterScope)
              : "-"}
          </p>
        </div>
        {processingError && (
          <p className="mt-4 font-semibold text-red-700">
            {processingError}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow overflow-auto">
        <h2 className="text-2xl font-semibold mb-4">Результат сравнения</h2>

        <div className="mb-4 flex gap-3 items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по позициям, моделям, статусам..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm"
          />

          <button
            onClick={() => setSearchQuery("")}
            disabled={!searchQuery}
            className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 px-4 py-3 rounded-xl text-sm font-semibold"
          >
            Очистить
          </button>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          Найдено строк: {filteredResults.length} из {results.length}
        </div>

        <div className="mb-4 flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter("Все")}
            className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Все
          </button>

          <button
            onClick={() => setStatusFilter("ОК")}
            className="bg-green-100 hover:bg-green-200 text-green-800 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            ОК
          </button>

          <button
            onClick={() => setStatusFilter("Объем отличается")}
            className="bg-orange-100 hover:bg-orange-200 text-orange-800 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Объем отличается
          </button>

          <button
            onClick={() => setStatusFilter("Размер отличается")}
            className="bg-purple-100 hover:bg-purple-200 text-purple-800 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Размер отличается
          </button>

          <button
            onClick={() => setStatusFilter("Частичное совпадение")}
            className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Частичное совпадение
          </button>

          <button
            onClick={() => setStatusFilter("Нет в КП")}
            className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Нет в КП
          </button>

          <button
            onClick={() => setStatusFilter("Агрегированная позиция")}
            className="bg-sky-100 hover:bg-sky-200 text-sky-800 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Агрегированная
          </button>

          <button
            onClick={() => setStatusFilter("Количество в PDF не распознано")}
            className="bg-violet-100 hover:bg-violet-200 text-violet-800 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Количество не распознано
          </button>

          <button
            onClick={() => setStatusFilter("Вне области КП")}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Вне области КП
          </button>

          <button
            onClick={() => setStatusFilter("Есть в КП, нет в спецификации")}
            className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Лишнее в КП
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-7 gap-4">
          <div className="bg-green-50 text-green-800 rounded-xl p-4 font-semibold">
            ✅ ОК: {okCount}
          </div>

          <div className="bg-orange-50 text-orange-800 rounded-xl p-4 font-semibold">
            ⚠️ Объем отличается: {volumeDiffCount}
          </div>

          <div className="bg-purple-50 text-purple-800 rounded-xl p-4 font-semibold">
            📏 Размер отличается: {sizeDiffCount}
          </div>

          <div className="bg-yellow-50 text-yellow-800 rounded-xl p-4 font-semibold">
            🟡 Частичное совпадение: {partialCount}
          </div>

          <div className="bg-red-50 text-red-800 rounded-xl p-4 font-semibold">
            ❌ Нет в КП: {missingCount}
          </div>

          <div className="bg-gray-50 text-gray-800 rounded-xl p-4 font-semibold">
            Вне области КП: {outOfScopeCount}
          </div>

          <div className="bg-blue-50 text-blue-800 rounded-xl p-4 font-semibold">
            🔵 Лишнее в КП: {extraOfferCount}
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Наименование работы</th>
              <th className="border p-2">Расценка</th>
              <th className="border p-2">Ед. изм.</th>
              <th className="border p-2">Объем по спецификации</th>
              <th className="border p-2">Позиция в КП</th>
              <th className="border p-2">Модель / артикул КП</th>
              <th className="border p-2">Объем по КП</th>
              <th className="border p-2">Совпадение</th>
              <th className="border p-2">Причина</th>
              <th className="border p-2">Статус</th>
            </tr>
          </thead>

          <tbody>
            {filteredResults.map((item, index) => (
              <tr key={index}>
                <td className="border p-2">{item.name}</td>
                <td className="border p-2">{item.rate}</td>
                <td className="border p-2">{item.unit}</td>
                <td className="border p-2">{item.specVolume}</td>
                <td className="border p-2">{item.offerName}</td>
                <td className="border p-2">{item.offerRate}</td>
                <td className="border p-2">{item.offerVolume}</td>
                <td className="border p-2">
                  {item.similarity ? `${Math.round(item.similarity)}%` : "-"}
                </td>
                <td className="border p-2">
  {item.similarity ? `${Math.round(item.similarity)}%` : "-"}
</td>
<td className="border p-2">{item.reason || "-"}</td>
<td className="border p-2">
  <span
    className={`px-3 py-1 rounded-full font-semibold ${getStatusClass(
      item.status
    )}`}
  >
    {item.status}
  </span>
</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
