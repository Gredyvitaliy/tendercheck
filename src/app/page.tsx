"use client";

import { useState } from "react";
import * as XLSX from "xlsx-js-style";
import type { WorkItem, CompareResult } from "./types";
import { normalizeText } from "./utils";
import { parseSpecExcel, parseOfferExcel } from "./parsers";

const findColumn = (row: any, possibleNames: string[]) => {
  const keys = Object.keys(row);

  return keys.find((key) => {
    const normalizedKey = normalizeText(key);

    return possibleNames.some((name) =>
      normalizedKey.includes(normalizeText(name))
    );
  });
};
export default function Home() {
  const [specItems, setSpecItems] = useState<WorkItem[]>([]);
  const [offerItems, setOfferItems] = useState<WorkItem[]>([]);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [statusFilter, setStatusFilter] = useState<
  CompareResult["status"] | "Все"
>("Все");
const [searchQuery, setSearchQuery] = useState("");
const [uploadResetKey, setUploadResetKey] = useState(0);

  const handleSpecUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseSpecExcel(file, setSpecItems);
  };

  const handleOfferUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseOfferExcel(file, setOfferItems);
  };

  const clearAllData = () => {
  setSpecItems([]);
  setOfferItems([]);
  setResults([]);
  setSearchQuery("");
  setStatusFilter("Все");
  setUploadResetKey((prev) => prev + 1);
};

const compareFiles = () => {
  const groupedSpecItems: WorkItem[] = Object.values(
  specItems.reduce((acc, item) => {
    const key = normalizeText(`${item.name} ${item.rate} ${item.unit}`);

    if (!acc[key]) {
      acc[key] = { ...item };
      return acc;
    }

    acc[key].projectVolume =
      Number(acc[key].projectVolume || 0) + Number(item.projectVolume || 0);

    return acc;
  }, {} as Record<string, WorkItem>)
);
const groupedOfferItems: WorkItem[] = Object.values(
  offerItems.reduce((acc, item) => {
    const key = normalizeText(`${item.name} ${item.rate} ${item.unit}`);

    if (!acc[key]) {
      acc[key] = { ...item };
      return acc;
    }

    acc[key].projectVolume =
      Number(acc[key].projectVolume || 0) + Number(item.projectVolume || 0);

    return acc;
  }, {} as Record<string, WorkItem>)
);
const comparison: CompareResult[] = groupedSpecItems.map((spec) => {
    let bestMatch: WorkItem | undefined;
    let bestSimilarity = 0;

    groupedOfferItems.forEach((offer) => {
      const specName = normalizeText(`${spec.name} ${spec.rate}`);
const offerName = normalizeText(`${offer.name} ${offer.rate}`);

      const words = specName.split(" ").filter((word) => word.length > 2);

      const matchedWords = words.filter((word) => offerName.includes(word));

     let similarity =
  words.length > 0 ? (matchedWords.length / words.length) * 100 : 0;

const specTokens = specName.split(" ");
const offerTokens = offerName.split(" ");

const importantTokens = specTokens.filter((token) =>
  /[a-z]+[0-9]+|[0-9]+[a-z]+|[0-9]+x[0-9]+/i.test(token)
);

const matchedImportantTokens = importantTokens.filter((token) =>
  offerTokens.includes(token)
);

similarity += matchedImportantTokens.length * 20;
const dimensionsSpec =
  specName.match(/\d+\-\d+|\d+x\d+/g) || [];

const dimensionsOffer =
  offerName.match(/\d+\-\d+|\d+x\d+/g) || [];

if (
  dimensionsSpec.length &&
  dimensionsOffer.length &&
  dimensionsSpec.join() !== dimensionsOffer.join()
) {
  similarity -= 50;
}

if (similarity > 100) {
  similarity = 100;
}
if (similarity < 0) {
  similarity = 0;
}

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = offer;
      }
    });

    if (!bestMatch || bestSimilarity < 30) {
     return {
  name: spec.name,
  rate: spec.rate,
  unit: spec.unit,
  specVolume: spec.projectVolume,

  offerName: "-",
  offerRate: "-",
  offerUnit: "-",
  offerVolume: "-",

  status: "Нет в КП",
  similarity: bestSimilarity,
};
    }
if (bestSimilarity < 80) {
  return {
    name: spec.name,
    rate: spec.rate,
    unit: spec.unit,
    specVolume: spec.projectVolume,
    offerVolume: bestMatch.projectVolume,
    offerName: bestMatch.name,
offerRate: bestMatch.rate,
offerUnit: bestMatch.unit,
    status: "Частичное совпадение",
    similarity: bestSimilarity,
  };
}
    if (Number(spec.projectVolume) !== Number(bestMatch.projectVolume)) {
      return {
        name: spec.name,
        rate: spec.rate,
        unit: spec.unit,
        specVolume: spec.projectVolume,
        offerVolume: bestMatch.projectVolume,
        offerName: bestMatch.name,
offerRate: bestMatch.rate,
offerUnit: bestMatch.unit,
        status: "Объем отличается",
        similarity: bestSimilarity,
      };
    }

    return {
      name: spec.name,
      rate: spec.rate,
      unit: spec.unit,
      specVolume: spec.projectVolume,
      offerVolume: bestMatch.projectVolume,
      offerName: bestMatch.name,
offerRate: bestMatch.rate,
offerUnit: bestMatch.unit,
      status: "ОК",
      similarity: bestSimilarity,
    };
  });

  setResults(comparison);
};

  const getStatusClass = (status: CompareResult["status"]) => {
    if (status === "ОК") return "text-green-700 bg-green-100";
    if (status === "Объем отличается") return "text-orange-700 bg-orange-100";
    if (status === "Частичное совпадение") return "text-yellow-700 bg-yellow-100";
    return "text-red-700 bg-red-100";
  };
  const okCount = results.filter(
  (item) => item.status === "ОК"
).length;

const volumeDiffCount = results.filter(
  (item) => item.status === "Объем отличается"
).length;

const partialCount = results.filter(
  (item) => item.status === "Частичное совпадение"
).length;

const missingCount = results.filter(
  (item) => item.status === "Нет в КП"
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
  const getStatusComment = (item: CompareResult) => {
  if (item.status === "ОК") {
    return "Позиция найдена в КП, объем совпадает.";
  }

  if (item.status === "Объем отличается") {
    return "Позиция найдена, но объем по спецификации отличается от объема в КП.";
  }

  if (item.status === "Частичное совпадение") {
    return "Найдена похожая позиция. Требуется ручная проверка наименования, модели или характеристик.";
  }

  return "Позиция из спецификации не найдена в КП.";
};
const exportResultsToExcel = () => {
  const summaryData = [
    { "Статус": "ОК", "Количество": okCount },
    { "Статус": "Объем отличается", "Количество": volumeDiffCount },
    { "Статус": "Частичное совпадение", "Количество": partialCount },
    { "Статус": "Нет в КП", "Количество": missingCount },
  ];

  const exportData = results.map((item) => ({
    "Позиция по спецификации": item.name,
    "Модель / артикул спецификации": item.rate,
    "Ед. изм. спецификации": item.unit,
    "Объем по спецификации": item.specVolume,

    "Позиция в КП": item.offerName,
    "Модель / артикул КП": item.offerRate,
    "Ед. изм. КП": item.offerUnit,
    "Объем по КП": item.offerVolume,

    "Совпадение": item.similarity ? `${Math.round(item.similarity)}%` : "-",
    "Статус": item.status,
    "Комментарий": getStatusComment(item),
  }));

  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 15 }];

  const summaryRange = XLSX.utils.decode_range(summarySheet["!ref"] || "A1:B1");

  for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });

    if (summarySheet[cellAddress]) {
      summarySheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "374151" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
  }

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Сводка");

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  worksheet["!cols"] = [
    { wch: 55 },
    { wch: 30 },
    { wch: 18 },
    { wch: 22 },
    { wch: 55 },
    { wch: 30 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 25 },
    { wch: 45 },
  ];

 worksheet["!autofilter"] = {
  ref: worksheet["!ref"] || "A1:K1",
};

const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:K1");

const borderStyle = {
  top: { style: "thin", color: { rgb: "D1D5DB" } },
  bottom: { style: "thin", color: { rgb: "D1D5DB" } },
  left: { style: "thin", color: { rgb: "D1D5DB" } },
  right: { style: "thin", color: { rgb: "D1D5DB" } },
};

const headerStyle = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "374151" } },
  alignment: {
    horizontal: "center",
    vertical: "center",
    wrapText: true,
  },
  border: borderStyle,
};
for (let col = range.s.c; col <= range.e.c; col++) {
  const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });

  if (worksheet[cellAddress]) {
    worksheet[cellAddress].s = headerStyle;
  }
}

for (let row = 1; row <= range.e.r; row++) {
  const statusCellAddress = XLSX.utils.encode_cell({ r: row, c: 9 });
  const statusCell = worksheet[statusCellAddress];

  if (!statusCell) continue;

  const status = String(statusCell.v);

  let fillColor = "FEE2E2";
  let fontColor = "991B1B";

  if (status === "ОК") {
    fillColor = "DCFCE7";
    fontColor = "166534";
  }

  if (status === "Объем отличается") {
    fillColor = "FFEDD5";
    fontColor = "9A3412";
  }

  if (status === "Частичное совпадение") {
    fillColor = "FEF9C3";
    fontColor = "854D0E";
  }

  if (status === "Нет в КП") {
    fillColor = "FEE2E2";
    fontColor = "991B1B";
  }

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = worksheet[cellAddress];

    if (!cell) continue;

    cell.s = {
      fill: { fgColor: { rgb: fillColor } },
      alignment: {
        vertical: "top",
        wrapText: true,
      },
      border: borderStyle,
      font:
        col === 9
          ? { bold: true, color: { rgb: fontColor } }
          : { color: { rgb: "111827" } },
    };
  }
}

  XLSX.utils.book_append_sheet(workbook, worksheet, "Детальный отчет");

  XLSX.writeFile(workbook, "tendercheck-report.xlsx");
};
  return (
    <main className="min-h-screen bg-gray-100 p-10">
      <h1 className="text-4xl font-bold mb-6 text-gray-800">TenderCheck</h1>

      <p className="mb-6 text-lg text-gray-600">
        Сравнение спецификации и КП подрядчика
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">1. Эталон / спецификация</h2>
          <input
  key={`spec-${uploadResetKey}`}
  type="file"
  accept=".xlsx, .xls"
  onChange={handleSpecUpload}
/>
          <p className="mt-4 text-sm text-gray-600">
            Загружено позиций: {specItems.length}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">2. КП подрядчика</h2>

         <input
  key={`offer-${uploadResetKey}`}
  type="file"
  accept=".xlsx, .xls"
  onChange={handleOfferUpload}
/>

          <p className="mt-4 text-sm text-gray-600">
            Загружено позиций: {offerItems.length}
          </p>
        </div>
      </div>

      <button
        onClick={compareFiles}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-lg mb-8"
      >
        Сравнить файлы
    </button>
    <button
  onClick={exportResultsToExcel}
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
    results.length === 0
  }
  className="ml-4 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl text-lg mb-8"
>
  Очистить файлы
</button>


      <div className="bg-white rounded-xl p-6 shadow overflow-auto">
        <h2 className="text-2xl font-semibold mb-4">Результат сравнения</h2>
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        
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
</div>
  <div className="bg-green-50 text-green-800 rounded-xl p-4 font-semibold">
    ✅ ОК: {okCount}
  </div>

  <div className="bg-orange-50 text-orange-800 rounded-xl p-4 font-semibold">
    ⚠️ Объем отличается: {volumeDiffCount}
  </div>

  <div className="bg-yellow-50 text-yellow-800 rounded-xl p-4 font-semibold">
    🟡 Частичное совпадение: {partialCount}
  </div>

  <div className="bg-red-50 text-red-800 rounded-xl p-4 font-semibold">
    ❌ Нет в КП: {missingCount}
  </div>
</div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Наименование работы</th>
              <th className="border p-2">Расценка</th>
              <th className="border p-2">Ед. изм.</th>
              <th className="border p-2">Объем по спецификации</th>
              <th className="border p-2">Объем по КП</th>
              <th className="border p-2">Совпадение</th>
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
                <td className="border p-2">{item.offerVolume}</td>
                <td className="border p-2">
  {item.similarity ? `${Math.round(item.similarity)}%` : "-"}
</td>
                <td className="border p-2">
                  <span className={`px-3 py-1 rounded-full font-semibold ${getStatusClass(item.status)}`}>
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