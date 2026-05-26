"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type WorkItem = {
  number: string | number;
  name: string;
  rate: string;
  unit: string;
  projectVolume: number | string;
};

type CompareResult = {
  name: string;
  rate: string;
  unit: string;
  specVolume: number | string;
  offerVolume: number | string;
  status: "ОК" | "Объем отличается" | "Нет в КП";
};

function parseExcel(file: File, callback: (items: WorkItem[]) => void) {
  const reader = new FileReader();

  reader.onload = (evt) => {
    const binaryStr = evt.target?.result;
    const workbook = XLSX.read(binaryStr, { type: "binary" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);
    console.log(rawData);
    console.log("Первые 5 строк:", rawData.slice(0, 5));
console.log("Колонки первой строки:", Object.keys(rawData[0] || {}));

const normalized: WorkItem[] = rawData
  .map((row) => {
    // Старый формат
    if (row["__EMPTY"]) {
      return {
        number: row["__EMPTY"],
        name: row["АР3.2  АПЧ. 2 этаж. Корпус №150"] || "",
        rate: String(row["__EMPTY_1"] || "").replace(/\s+/g, ""),
        unit: row["__EMPTY_2"] || "",
        projectVolume: row["__EMPTY_3"] || "",
      };
    }

    // Новый формат спецификации
    if (row["Наименование и техническая характеристика"]) {
      return {
        number: row["__rowNum__"] || "",
        name: row["Наименование и техническая характеристика"] || "",
        rate: String(row["Обоснование"] || "").replace(/\s+/g, ""),
        unit: row["Ед.изм"] || "",
        projectVolume: row["Количество"] || "",
      };
    }

    // Формат КП
    if (row["Раздел / система"] && (row["Кол-во"] || row["Количество"])) {
      return {
        number: row["__rowNum__"] || "",
        name: row["Раздел / система"] || "",
        rate: String(row["Обоснование"] || row["Артикул"] || "").replace(/\s+/g, ""),
        unit: row["Ед. изм."] || row["Ед.изм"] || "",
        projectVolume: row["Кол-во"] || row["Количество"] || "",
      };
    }

    return null;
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
      const matchedOffer = offerItems.find(
        (offer) =>
          offer.rate === spec.rate &&
          offer.unit === spec.unit
      );

      if (!matchedOffer) {
        return {
          name: spec.name,
          rate: spec.rate,
          unit: spec.unit,
          specVolume: spec.projectVolume,
          offerVolume: "-",
          status: "Нет в КП",
        };
      }

      if (Number(spec.projectVolume) !== Number(matchedOffer.projectVolume)) {
        return {
          name: spec.name,
          rate: spec.rate,
          unit: spec.unit,
          specVolume: spec.projectVolume,
          offerVolume: matchedOffer.projectVolume,
          status: "Объем отличается",
        };
      }

      return {
        name: spec.name,
        rate: spec.rate,
        unit: spec.unit,
        specVolume: spec.projectVolume,
        offerVolume: matchedOffer.projectVolume,
        status: "ОК",
      };
    });

    setResults(comparison);
  };

  const getStatusClass = (status: CompareResult["status"]) => {
    if (status === "ОК") return "text-green-700 bg-green-100";
    if (status === "Объем отличается") return "text-orange-700 bg-orange-100";
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
              <th className="border p-2">Статус</th>
            </tr>
          </thead>

          <tbody>
            {results.map((item, index) => (
              <tr key={index}>
                <td className="border p-2">{item.name}</td>
                <td className="border p-2">{item.rate}</td>
                <td className="border p-2">{item.unit}</td>
                <td className="border p-2">{item.specVolume}</td>
                <td className="border p-2">{item.offerVolume}</td>
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