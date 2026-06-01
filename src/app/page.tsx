"use client";

import { useState } from "react";
import type { WorkItem, CompareResult } from "./types";
import { normalizeText } from "./utils";
import { parseSpecExcel, parseOfferExcel } from "./parsers";
import { exportResultsToExcel } from "./exportReport";
import { compareWorkItems } from "./compare";

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
  const comparison = compareWorkItems(specItems, offerItems);
  setResults(comparison);
};
  const getStatusClass = (status: CompareResult["status"]) => {
    if (status === "ОК") return "text-green-700 bg-green-100";
    if (status === "Объем отличается") return "text-orange-700 bg-orange-100";
    if (status === "Размер отличается")
  return "text-purple-700 bg-purple-100";
    if (status === "Частичное совпадение") return "text-yellow-700 bg-yellow-100";
    if (status === "Есть в КП, нет в спецификации")
  return "text-blue-700 bg-blue-100";
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

  <button
    onClick={() => setStatusFilter("Есть в КП, нет в спецификации")}
    className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 rounded-lg text-sm font-semibold"
  >
    Лишнее в КП
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