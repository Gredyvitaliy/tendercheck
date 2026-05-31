import * as XLSX from "xlsx-js-style";
import type { WorkItem } from "./types";

export function parseSpecExcel(file: File, callback: (items: WorkItem[]) => void) {
  const reader = new FileReader();

  reader.onload = (evt) => {
    const binaryStr = evt.target?.result;
    const workbook = XLSX.read(binaryStr, { type: "binary" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
});
const normalized: WorkItem[] = rawData
  .map((row, index) => {
    if (!Array.isArray(row)) return null;

    const name = String(row[1] || "").trim();
    const model = String(row[2] || "").trim();
    const unit = String(row[12] || "").trim();
    const quantityRaw = row[13];
const quantityNumber = Number(
  String(quantityRaw || "").replace(",", ".").trim()
);

if (!name) return null;

if (!unit) return null;

if (!quantityRaw || Number.isNaN(quantityNumber)) return null;

    // пропускаем разделы вида 3.1.1
    if (/^\d+(\.\d+)+/.test(name)) {
  return null;
}

    return {
      number: index,
      name,
      rate: model,
      unit,
     projectVolume: quantityNumber,
rowType: "item",
    };
  })
  .filter(Boolean) as WorkItem[];

    callback(normalized);
  };

  reader.readAsBinaryString(file);
}
export function parseOfferExcel(file: File, callback: (items: WorkItem[]) => void) {
  const reader = new FileReader();

  reader.onload = (evt) => {
    const binaryStr = evt.target?.result;
    const workbook = XLSX.read(binaryStr, { type: "binary" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
});
const normalized: WorkItem[] = rawData
  .map((row, index) => {
    if (!Array.isArray(row)) return null;

    const name = String(row[2] || "").trim();
    const unit = String(row[3] || "").trim();
    const quantity = row[4] || "";

    if (!name) return null;

    return {
      number: index,
      name,
      rate: "",
      unit,
      projectVolume: quantity,
      rowType: "item",
    };
  })
  .filter(Boolean) as WorkItem[];

callback(normalized);
  };

  reader.readAsBinaryString(file);
}