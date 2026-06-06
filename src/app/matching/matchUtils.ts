import type { WorkItem } from "../types";
import { normalizeText } from "../utils";
import { extractItemFeatures } from "../itemFeatures";

export const getPrimaryMark = (item: WorkItem) => {
  const rateFeatures = extractItemFeatures(item.rate || "");

  if (rateFeatures.marks.length > 0) {
    return rateFeatures.marks[0];
  }

  const nameFeatures = extractItemFeatures(item.name || "");

  return nameFeatures.marks[nameFeatures.marks.length - 1] || "";
};

export const isAirnedInstallation = (item: WorkItem) => {
  const text = normalizeText(`${item.name} ${item.rate}`);

  return text.includes("установка") && text.includes("airned");
};

export const getAirnedCode = (item: WorkItem) => {
  const text = normalizeText(`${item.name} ${item.rate}`)
    .replace(/\s+/g, "")
    .replace(/[–—]/g, "-");

  const match = text.match(/airned[-/]?[a-zа-я0-9./-]+/i);

  return match ? match[0].replace(/[^a-zа-я0-9./-]/gi, "") : "";
};

export const getPlainItemKind = (item: WorkItem) => {
  const text = normalizeText(`${item.name} ${item.rate}`);

  if (text.includes("вентилятор")) return "вентилятор";
  if (text.includes("шумоглушитель")) return "шумоглушитель";
  if (text.includes("корпус фильтра")) return "корпус фильтра";
  if (text.includes("фильтр")) return "фильтр";
  if (text.includes("крыш")) return "крышка";
  if (text.includes("воздухозабор")) return "воздухозаборная решетка";
  if (text.includes("воздухораспредел")) return "воздухораспределитель";
  if (text.includes("сетка")) return "сетка";
  if (text.includes("регулятор")) return "регулятор";
  if (text.includes("диффузор")) return "диффузор";
  if (text.includes("вставка")) return "вставка";
  if (text.includes("заслонка")) return "заслонка";
  if (text.includes("клапан")) return "клапан";
  if (text.includes("решетка") || text.includes("решётка")) return "решетка";
  if (text.includes("установка")) return "установка";
  if (text.includes("блок")) return "блок";
  if (text.includes("кабель")) return "кабель";
  if (text.includes("адаптер")) return "адаптер";

  return "";
};

export const getStrictModelKey = (item: WorkItem) => {
  const text = normalizeText(`${item.name} ${item.rate}`)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[()]/g, " ")
    .replace(/[.,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const patterns = [
    /[a-zа-я]{2,}\s*\d{1,4}\s*[-x/ ]\s*\d{1,4}[a-zа-я0-9/-]*/gi,
    /[a-zа-я]{2,}\s*[-/ ]\s*[a-zа-я]*\d+[a-zа-я0-9/-]*/gi,
  ];

  const matches: string[] = [];

  patterns.forEach((pattern) => {
    const found = text.match(pattern) || [];
    matches.push(...found);
  });

  const cleaned = matches
    .map((match) =>
      match
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-zа-я0-9]/gi, "")
    )
    .filter((match) => match.length >= 4);

  if (!cleaned.length) return "";

  return cleaned[cleaned.length - 1];
};

export const requiresStrictModelMatch = (kind: string) => {
  return [
    "вставка",
    "вентилятор",
    "шумоглушитель",
    "корпус фильтра",
    "фильтр",
    "крышка",
    "заслонка",
    "клапан",
    "решетка",
    "воздухозаборная решетка",
    "воздухораспределитель",
  ].includes(kind);
};

export const calculateTextSimilarity = (spec: WorkItem, offer: WorkItem) => {
  const specName = normalizeText(`${spec.name} ${spec.rate}`);
  const offerName = normalizeText(`${offer.name} ${offer.rate}`);

  const words = specName.split(" ").filter((word) => word.length > 2);
  const matchedWords = words.filter((word) => offerName.includes(word));

  let similarity =
    words.length > 0 ? (matchedWords.length / words.length) * 100 : 0;

  const specTokens = specName.split(" ");
  const offerTokens = offerName.split(" ");

  const importantTokens = specTokens.filter((token) =>
    /[a-zа-я]+[0-9]+|[0-9]+[a-zа-я]+|[0-9]+x[0-9]+/i.test(token)
  );

  const matchedImportantTokens = importantTokens.filter((token) =>
    offerTokens.includes(token)
  );

  similarity += matchedImportantTokens.length * 20;

  if (similarity > 100) similarity = 100;
  if (similarity < 0) similarity = 0;

  return similarity;
};

export const extractModelCodes = (text: string) => {
  const normalized = normalizeText(text)
    .replace(/[()]/g, " ")
    .replace(/[.,;]/g, " ")
    .replace(/[–—]/g, "-");

  const codes = new Set<string>();

  const compactMatches =
    normalized.match(/[a-zа-я]+[-/]?[a-zа-я0-9]*\d+[a-zа-я0-9/-]*/gi) || [];

  compactMatches.forEach((code) => {
    if (code.trim().length >= 3) {
      codes.add(code.trim());
    }
  });

  const brandSizeMatches =
    normalized.match(/[a-zа-я]{2,}\s+\d{1,4}[-x/]\d{1,4}[a-zа-я0-9/-]*/gi) ||
    [];

  brandSizeMatches.forEach((code) => {
    if (code.trim().length >= 5) {
      codes.add(code.trim());
    }
  });

  return Array.from(codes);
};

export const normalizeModelCode = (code: string) => {
  return normalizeText(code).replace(/[^a-zа-я0-9]/gi, "");
};

export const codesMatch = (specCodes: string[], offerCodes: string[]) => {
  return specCodes.some((specCode) => {
    const normalizedSpecCode = normalizeModelCode(specCode);

    return offerCodes.some((offerCode) => {
      const normalizedOfferCode = normalizeModelCode(offerCode);

      if (normalizedSpecCode.length < 5 || normalizedOfferCode.length < 5) {
        return false;
      }

      if (normalizedSpecCode === normalizedOfferCode) {
        return true;
      }

      const shorter =
        normalizedSpecCode.length < normalizedOfferCode.length
          ? normalizedSpecCode
          : normalizedOfferCode;

      const longer =
        normalizedSpecCode.length >= normalizedOfferCode.length
          ? normalizedSpecCode
          : normalizedOfferCode;

      return shorter.length >= 6 && longer.includes(shorter);
    });
  });
};

export const haveDifferentDimensions = (spec: WorkItem, offer: WorkItem) => {
  const specFeatures = extractItemFeatures(spec);
  const offerFeatures = extractItemFeatures(offer);

  if (!specFeatures.dimensions.length || !offerFeatures.dimensions.length) {
    return false;
  }

  return !specFeatures.dimensions.some((dimension) =>
    offerFeatures.dimensions.includes(dimension)
  );
};