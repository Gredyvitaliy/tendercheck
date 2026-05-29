"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type WorkItem = {
  number: string | number;
  name: string;
  rate: string;
  unit: string;
  projectVolume: number | string;
  rowType: "group" | "item";
};

type CompareResult = {
  name: string;
  rate: string;
  unit: string;
  specVolume: number | string;
  offerVolume: number | string;
 status: "ОК" | "Объем отличается" | "Частичное совпадение" | "Нет в КП";
  similarity?: number;
};
const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^а-яa-z0-9]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const findColumn = (row: any, possibleNames: string[]) => {
  const keys = Object.keys(row);

  return keys.find((key) => {
    const normalizedKey = normalizeText(key);

    return possibleNames.some((name) =>
      normalizedKey.includes(normalizeText(name))
    );
  });
};

function parseExcel(file: File, callback: (items: WorkItem[]) => void) {
  const reader = new FileReader();

  reader.onload = (evt) => {
    const binaryStr = evt.target?.result;
    const workbook = XLSX.read(binaryStr, { type: "binary" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
});
const dataRows = rawData.slice(1);

console.log(
  "Объект первой позиции:",
  rawData[5]
);
console.log(
  "Первые 30 строк:",
  dataRows.slice(0, 30)
);
console.log(
  "Позиция пример:",
  dataRows[5]
);
    console.log("RAW DATA:", rawData.slice(0, 5));
    const firstRow = rawData[0] || {};
    console.log(
  "Первые 10 строк с колонками:",
  rawData.slice(0, 10).map((row) => Object.keys(row))
);

const nameColumn = "1";
const quantityColumn = "13";
const unitColumn = "12";

console.log("Найдена колонка name:", nameColumn);
console.log("Найдена колонка quantity:", quantityColumn);
console.log("Найдена колонка unit:", unitColumn);

console.log("Найдена колонка name:", nameColumn);
console.log("Найдена колонка quantity:", quantityColumn);
console.log("Найдена колонка unit:", unitColumn);
    console.log(rawData);
    console.log("Первые 5 строк:", rawData.slice(0, 5));
console.log("Колонки первой строки:", Object.keys(rawData[0] || {}));

const normalized: WorkItem[] = rawData
  .map((row, index) => {
    if (!Array.isArray(row)) return null;

    const name = row[1] || "";
    const model = row[2] || "";
    const unit = row[12] || "";
    const quantity = row[13] || "";

    if (!name) return null;

    return {
      number: index,
      name: String(name),
      rate: String(model),
      unit: String(unit),
      projectVolume: quantity,
      rowType: quantity ? "item" : "group",
    };
  })
.filter(Boolean) as WorkItem[];

    callback(normalized);
  };

  reader.readAsBinaryString(file);
}

export default function Home() {
  const [specItems, setSpecItems] = useState<WorkItem[]>([]);
  const [offerItems, setOfferItems] = useState<WorkItem[]>([]);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [showOnlyMatches, setShowOnlyMatches] = useState(false);

  const handleSpecUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseExcel(file, setSpecItems);
  };

  const handleOfferUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseExcel(file, setOfferItems);
  };

const compareFiles = () => {
const comparison: CompareResult[] = specItems.map((spec) => {
    let bestMatch: WorkItem | undefined;
    let bestSimilarity = 0;

    offerItems.forEach((offer) => {
      const specName = normalizeText(spec.name);
const offerName = normalizeText(offer.name);

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

if (similarity > 100) {
  similarity = 100;
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

  return (
    <main className="min-h-screen bg-gray-100 p-10">
      <h1 className="text-4xl font-bold mb-6 text-gray-800">TenderCheck</h1>

      <p className="mb-6 text-lg text-gray-600">
        Сравнение спецификации и КП подрядчика
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">1. Эталон / спецификация</h2>
          <input type="file" accept=".xlsx, .xls" onChange={handleSpecUpload} />
          <p className="mt-4 text-sm text-gray-600">
            Загружено позиций: {specItems.length}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">2. КП подрядчика</h2>
          <input type="file" accept=".xlsx, .xls" onChange={handleOfferUpload} />
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
  onClick={() => setShowOnlyMatches(!showOnlyMatches)}
  className="ml-4 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl text-lg mb-8"
>
  {showOnlyMatches ? "Показать все" : "Показать только совпадения"}
</button>

      <div className="bg-white rounded-xl p-6 shadow overflow-auto">
        <h2 className="text-2xl font-semibold mb-4">Результат сравнения</h2>

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
            {results
  .filter((item) => !showOnlyMatches || item.status !== "Нет в КП")
  .map((item, index) => (
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