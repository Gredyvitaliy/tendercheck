import * as XLSX from "xlsx-js-style";
import type { WorkItem } from "./types";
import { normalizeText } from "./utils";

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

    const findHeaderRowIndex = () => {
      return rawData.findIndex((row) => {
        if (!Array.isArray(row)) return false;

        const rowText = row.map((cell) => normalizeText(String(cell || ""))).join(" ");

        return (
          rowText.includes("наименование") &&
          (rowText.includes("кол") ||
            rowText.includes("количество") ||
            rowText.includes("объем") ||
            rowText.includes("объём"))
        );
      });
    };

    const findColumnIndex = (headerRow: any[], possibleNames: string[]) => {
      return headerRow.findIndex((cell) => {
        const normalizedCell = normalizeText(String(cell || ""));

        return possibleNames.some((name) =>
          normalizedCell.includes(normalizeText(name))
        );
      });
    };

    const parseQuantity = (value: any) => {
      const text = String(value || "").replace(",", ".").trim();

      if (!text) return null;

      const match = text.match(/\d+(\.\d+)?/);

      if (!match) return null;

      const quantity = Number(match[0]);

      if (Number.isNaN(quantity)) return null;

      return quantity;
    };

    const extractUnitFromQuantity = (value: any) => {
      const text = String(value || "").trim();

      const unitMatch = text.match(/[а-яa-zм²㎡]+/i);

      return unitMatch ? unitMatch[0] : "";
    };

    const headerRowIndex = findHeaderRowIndex();

    const headerRow =
      headerRowIndex >= 0 && Array.isArray(rawData[headerRowIndex])
        ? rawData[headerRowIndex]
        : [];

    const nameIndex =
      findColumnIndex(headerRow, ["наименование", "наименование работы"]) >= 0
        ? findColumnIndex(headerRow, ["наименование", "наименование работы"])
        : 1;

    const markIndex =
  findColumnIndex(headerRow, ["марка"]) >= 0
    ? findColumnIndex(headerRow, ["марка"])
    : -1;

    const modelIndex =
      findColumnIndex(headerRow, ["обозначение", "модель", "артикул", "расценка"]) >= 0
        ? findColumnIndex(headerRow, ["обозначение", "модель", "артикул", "расценка"])
        : 2;

    const unitIndex =
      findColumnIndex(headerRow, ["ед изм", "единица", "ед. изм"]) >= 0
        ? findColumnIndex(headerRow, ["ед изм", "единица", "ед. изм"])
        : -1;

    const quantityIndex =
      findColumnIndex(headerRow, ["кол", "количество", "объем", "объём", "к во"]) >= 0
        ? findColumnIndex(headerRow, ["кол", "количество", "объем", "объём", "к во"])
        : 13;

    const dataStartIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;

    const normalized: WorkItem[] = rawData
      .slice(dataStartIndex)
      .map((row, index) => {
        if (!Array.isArray(row)) return null;

        const name = String(row[nameIndex] || "").trim();

const rawMark = String(row[markIndex] || "").trim();

const mark = /^\d+([.,]0+)?$/.test(rawMark)
  ? `В-${rawMark.replace(/[.,]0+$/, "")}`
  : rawMark;

const model = String(row[modelIndex] || "").trim();

        const quantityRaw = row[quantityIndex];
        const quantityNumber = parseQuantity(quantityRaw);

        const unitFromColumn =
          unitIndex >= 0 ? String(row[unitIndex] || "").trim() : "";

        const unitFromQuantity = extractUnitFromQuantity(quantityRaw);

        const unit = unitFromColumn || unitFromQuantity || "шт";

        if (!name) return null;
        if (quantityNumber === null) return null;

        if (/^\d+(\.\d+)+$/.test(name)) {
          return null;
        }

        return {
          number: index,
          name,
          rate: [
  /^\d+([.,]0+)?$/.test(String(row[markIndex] ?? "").trim())
    ? `В-${String(row[markIndex] ?? "").trim().replace(/[.,]0+$/, "")}`
    : String(row[markIndex] ?? "").trim(),
  model,
].filter(Boolean).join(" "),
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

    const findHeaderRowIndex = () => {
      return rawData.findIndex((row) => {
        if (!Array.isArray(row)) return false;

        const rowText = row
          .map((cell) => normalizeText(String(cell || "")))
          .join(" ");

        return (
          rowText.includes("наименование") &&
          (rowText.includes("кол") ||
            rowText.includes("количество") ||
            rowText.includes("объем") ||
            rowText.includes("объём"))
        );
      });
    };

    const findColumnIndex = (headerRow: any[], possibleNames: string[]) => {
      return headerRow.findIndex((cell) => {
        const normalizedCell = normalizeText(String(cell || ""));

        return possibleNames.some((name) =>
          normalizedCell.includes(normalizeText(name))
        );
      });
    };

    const parseQuantity = (value: any) => {
      const text = String(value || "").replace(",", ".").trim();

      if (!text) return null;

      const match = text.match(/\d+(\.\d+)?/);

      if (!match) return null;

      const quantity = Number(match[0]);

      if (Number.isNaN(quantity)) return null;

      return quantity;
    };

    const extractUnitFromHeader = (value: any) => {
      const text = String(value || "").toLowerCase();

      if (text.includes("шт")) return "шт";
      if (text.includes("м2") || text.includes("м²")) return "м²";
      if (text.includes("м3") || text.includes("м³")) return "м³";
      if (text.includes("м")) return "м";

      return "";
    };

    const extractMarkFromText = (value: any) => {
  const text = String(value || "").replace(/[–—]/g, "-");

  const match = text.match(
  /(?:^|[^а-яa-z0-9/])((?:ВП|BP|В|B|ПД|PD)\s*-\s*\d+)/i
);

  if (!match) return "";

  let cleaned = match[1]
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[–—]/g, "-");

  cleaned = cleaned.replace(/^BP/, "ВП");
  cleaned = cleaned.replace(/^B/, "В");
  cleaned = cleaned.replace(/^PD/, "ПД");

  if (/^ВП\d/.test(cleaned)) {
    cleaned = cleaned.replace(/^ВП/, "ВП-");
  }

  if (/^ПД\d/.test(cleaned)) {
    cleaned = cleaned.replace(/^ПД/, "ПД-");
  }

  if (/^В\d/.test(cleaned)) {
    cleaned = cleaned.replace(/^В/, "В-");
  }

  return cleaned;
};

    const headerRowIndex = findHeaderRowIndex();

    const headerRow =
      headerRowIndex >= 0 && Array.isArray(rawData[headerRowIndex])
        ? rawData[headerRowIndex]
        : [];

    const nameIndex =
      findColumnIndex(headerRow, ["наименование", "наименование работы"]) >= 0
        ? findColumnIndex(headerRow, ["наименование", "наименование работы"])
        : 1;

    // Важно: не ищем "№" и "позиция", потому что это часто просто номер строки.
    const markIndex =
      findColumnIndex(headerRow, ["марка"]) >= 0
        ? findColumnIndex(headerRow, ["марка"])
        : -1;

    const modelIndex =
      findColumnIndex(headerRow, ["обозначение", "модель", "артикул", "гост"]) >= 0
        ? findColumnIndex(headerRow, ["обозначение", "модель", "артикул", "гост"])
        : 2;

    const quantityIndex =
      findColumnIndex(headerRow, ["кол", "количество", "к во"]) >= 0
        ? findColumnIndex(headerRow, ["кол", "количество", "к во"])
        : 3;

    const unitFromQuantityHeader = extractUnitFromHeader(headerRow[quantityIndex]);

    const dataStartIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;

    const normalized: WorkItem[] = rawData
      .slice(dataStartIndex)
      .map((row, index) => {
        if (!Array.isArray(row)) return null;

        const name = String(row[nameIndex] || "").trim();

        const rawMark =
          markIndex >= 0 ? String(row[markIndex] || "").trim() : "";

        const markFromName = extractMarkFromText(name);
        const markFromColumn = extractMarkFromText(rawMark);

        const offerMark = markFromName || markFromColumn || rawMark;

        const model = String(row[modelIndex] || "").trim();

        const quantityRaw = row[quantityIndex];
        const quantityNumber = parseQuantity(quantityRaw);

        const normalizedName = normalizeText(name);
        const normalizedMark = normalizeText(offerMark);

        if (!name) return null;
        if (quantityNumber === null) return null;

        if (
          normalizedName.includes("итого") ||
          normalizedName.includes("сумма") ||
          normalizedName.includes("стоимость") ||
          normalizedName.includes("доставка") ||
          normalizedName.includes("условия") ||
          normalizedName.includes("ндс") ||
          normalizedName.includes("коммерческое предложение") ||
          normalizedName.includes("наименование")
        ) {
          return null;
        }

        if (
          normalizedMark.includes("марка") ||
          normalizedMark.includes("позиция") ||
          normalizedMark.includes("поз")
        ) {
          return null;
        }

        return {
          number: index,
          name,
          rate: [offerMark, model].filter(Boolean).join(" "),
          unit: unitFromQuantityHeader || "шт",
          projectVolume: quantityNumber,
          rowType: "item",
        };
      })
      .filter(Boolean) as WorkItem[];

    callback(normalized);
  };

  reader.readAsBinaryString(file);
}
