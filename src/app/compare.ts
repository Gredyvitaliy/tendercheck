import type { WorkItem, CompareResult } from "./types";
import { normalizeText } from "./utils";
import { extractItemFeatures } from "./itemFeatures";
import { detectItemStrategy } from "./matching/detectStrategy";
import {
  calculateTextSimilarity,
  codesMatch,
  extractModelCodes,
  getPrimaryMark,
  haveDifferentDimensions,
} from "./matching/matchUtils";

const groupWorkItems = (items: WorkItem[]) => {
  return Object.values(
    items.reduce((acc, item, itemIndex) => {
      const features = extractItemFeatures(item);
      const mark = getPrimaryMark(item);
      const itemType = features.itemType || "";

      const key = mark
        ? normalizeText(`${itemType} ${mark}`)
        : `row-${itemIndex}-${normalizeText(
            `${item.name} ${item.rate} ${item.unit}`
          )}`;

      if (!acc[key]) {
        acc[key] = { ...item };
        return acc;
      }

      acc[key].projectVolume =
        Number(acc[key].projectVolume || 0) + Number(item.projectVolume || 0);

      return acc;
    }, {} as Record<string, WorkItem>)
  );
};

const isAirnedInstallation = (item: WorkItem) => {
  const text = normalizeText(`${item.name} ${item.rate}`);

  return text.includes("установка") && text.includes("airned");
};

const getAirnedCode = (item: WorkItem) => {
  const text = normalizeText(`${item.name} ${item.rate}`)
    .replace(/\s+/g, "")
    .replace(/[–—]/g, "-");

  const match = text.match(/airned[-/]?[a-zа-я0-9./-]+/i);

  return match ? match[0].replace(/[^a-zа-я0-9./-]/gi, "") : "";
};

const getPlainItemKind = (item: WorkItem) => {
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

const getStrictModelKey = (item: WorkItem) => {
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

const requiresStrictModelMatch = (kind: string) => {
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

export const compareWorkItems = (
  specItems: WorkItem[],
  offerItems: WorkItem[]
): CompareResult[] => {
  const groupedSpecItems = groupWorkItems(specItems);
  const groupedOfferItems = groupWorkItems(offerItems);

  const usedOfferIndexes = new Set<number>();

  const comparison: CompareResult[] = groupedSpecItems.map((spec) => {
    let bestMatch: WorkItem | undefined;
    let bestMatchIndex = -1;
    let bestSimilarity = 0;
    let bestReason = "";

    const specFeatures = extractItemFeatures(spec);
    const specPrimaryMark = getPrimaryMark(spec);
    const specPlainKind = getPlainItemKind(spec);
    const specStrictModelKey = getStrictModelKey(spec);
    const specStrategy = detectItemStrategy(spec);

    groupedOfferItems.forEach((offer, offerIndex) => {
      if (usedOfferIndexes.has(offerIndex)) {
        return;
      }

      const offerFeatures = extractItemFeatures(offer);
      const offerPrimaryMark = getPrimaryMark(offer);
      const offerPlainKind = getPlainItemKind(offer);
      const offerStrictModelKey = getStrictModelKey(offer);
      const offerStrategy = detectItemStrategy(offer);
     

      if (isAirnedInstallation(spec) || isAirnedInstallation(offer)) {
        const specAirnedCode = getAirnedCode(spec);
        const offerAirnedCode = getAirnedCode(offer);

        if (!specAirnedCode || !offerAirnedCode) {
          return;
        }

        if (specAirnedCode !== offerAirnedCode) {
          return;
        }
      }

      if (
        !specPrimaryMark &&
        !offerPrimaryMark &&
        specPlainKind &&
        offerPlainKind &&
        specPlainKind !== offerPlainKind
      ) {
        return;
      }

      if (
        !specPrimaryMark &&
        !offerPrimaryMark &&
        specPlainKind &&
        offerPlainKind &&
        specPlainKind === offerPlainKind &&
        requiresStrictModelMatch(specPlainKind) &&
        specStrictModelKey &&
        offerStrictModelKey &&
        specStrictModelKey !== offerStrictModelKey
      ) {
        return;
      }

      if (specPrimaryMark && offerPrimaryMark) {
        if (specPrimaryMark !== offerPrimaryMark) {
          return;
        }
      }

      if (
        specFeatures.itemType !== "прочее" &&
        offerFeatures.itemType !== "прочее" &&
        specFeatures.itemType !== offerFeatures.itemType
      ) {
        return;
      }

      let similarity = calculateTextSimilarity(spec, offer);

      const specCodes = extractModelCodes(`${spec.name} ${spec.rate}`);
      const offerCodes = extractModelCodes(`${offer.name} ${offer.rate}`);

      const hasSameCode = codesMatch(specCodes, offerCodes);

      const hasModelCodes =
        !specPrimaryMark &&
        !offerPrimaryMark &&
        specCodes.length > 0 &&
        offerCodes.length > 0;

      if (hasModelCodes && !hasSameCode) {
        return;
      }

      if (
        !specPrimaryMark &&
        !offerPrimaryMark &&
        hasSameCode &&
        specPlainKind &&
        offerPlainKind &&
        specPlainKind === offerPlainKind
      ) {
        similarity = Math.max(similarity, 85);
      }

      if (
        specPrimaryMark &&
        offerPrimaryMark &&
        specPrimaryMark === offerPrimaryMark
      ) {
        similarity += 60;
      }

      if (haveDifferentDimensions(spec, offer)) {
        similarity -= 30;
      }

      if (similarity > 100) similarity = 100;
      if (similarity < 0) similarity = 0;

     if (similarity > bestSimilarity) {
  bestSimilarity = similarity;
  bestMatch = offer;
  bestMatchIndex = offerIndex;

  const strategyReason =
    specStrategy === offerStrategy
      ? `Стратегия: ${specStrategy}. `
      : `Стратегия: ${specStrategy}, КП: ${offerStrategy}. `;

  if (isAirnedInstallation(spec) || isAirnedInstallation(offer)) {
    bestReason = `${strategyReason}Совпал полный код AIRNED`;
  } else if (
    specPrimaryMark &&
    offerPrimaryMark &&
    specPrimaryMark === offerPrimaryMark
  ) {
    bestReason = `${strategyReason}Совпала марка: ${specPrimaryMark}`;
  } else if (
    hasSameCode &&
    specPlainKind &&
    offerPlainKind &&
    specPlainKind === offerPlainKind
  ) {
    bestReason = `${strategyReason}Совпал тип "${specPlainKind}" и модель/код`;
  } else {
    bestReason = `${strategyReason}Текстовое совпадение: ${Math.round(
      similarity
    )}%`;
  }
}
    });

    const missingThreshold = specPrimaryMark ? 50 : 30;

    if (!bestMatch || bestSimilarity < missingThreshold) {
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
        similarity: 0,
        reason:
  bestSimilarity > 0
    ? `Стратегия: ${specStrategy}. Лучшее совпадение ${Math.round(
        bestSimilarity
      )}%, ниже порога ${missingThreshold}%`
    : `Стратегия: ${specStrategy}. Подходящая позиция в КП не найдена`,
      };
    }

    usedOfferIndexes.add(bestMatchIndex);

    const offerPrimaryMark = getPrimaryMark(bestMatch);

    const hasSameMark =
      specPrimaryMark && offerPrimaryMark && specPrimaryMark === offerPrimaryMark;

    const dimensionsAreDifferent = haveDifferentDimensions(spec, bestMatch);

    if (hasSameMark && dimensionsAreDifferent) {
      return {
        name: spec.name,
        rate: spec.rate,
        unit: spec.unit,
        specVolume: spec.projectVolume,

        offerName: bestMatch.name,
        offerRate: bestMatch.rate,
        offerUnit: bestMatch.unit,
        offerVolume: bestMatch.projectVolume,

        status: "Размер отличается",
        similarity: bestSimilarity,
        reason: bestReason || "Позиция найдена, но размер отличается",
      };
    }

    if (Number(spec.projectVolume) !== Number(bestMatch.projectVolume)) {
      return {
        name: spec.name,
        rate: spec.rate,
        unit: spec.unit,
        specVolume: spec.projectVolume,

        offerName: bestMatch.name,
        offerRate: bestMatch.rate,
        offerUnit: bestMatch.unit,
        offerVolume: bestMatch.projectVolume,

        status: "Объем отличается",
        similarity: bestSimilarity,
        reason: bestReason || "Позиция найдена, но объем отличается",
      };
    }

    const partialThreshold = specPrimaryMark ? 80 : 65;

    if (bestSimilarity < partialThreshold && !hasSameMark) {
      return {
        name: spec.name,
        rate: spec.rate,
        unit: spec.unit,
        specVolume: spec.projectVolume,

        offerName: bestMatch.name,
        offerRate: bestMatch.rate,
        offerUnit: bestMatch.unit,
        offerVolume: bestMatch.projectVolume,

        status: "Частичное совпадение",
        similarity: bestSimilarity,
        reason: bestReason || `Слабое совпадение: ${Math.round(bestSimilarity)}%`,
      };
    }

    return {
      name: spec.name,
      rate: spec.rate,
      unit: spec.unit,
      specVolume: spec.projectVolume,

      offerName: bestMatch.name,
      offerRate: bestMatch.rate,
      offerUnit: bestMatch.unit,
      offerVolume: bestMatch.projectVolume,

      status: "ОК",
      similarity: hasSameMark ? 100 : bestSimilarity,
      reason: bestReason || "Позиция совпала",
    };
  });

  const extraOfferItems: CompareResult[] = groupedOfferItems
    .filter((_, offerIndex) => !usedOfferIndexes.has(offerIndex))
    .map((offer) => ({
      name: "-",
      rate: "-",
      unit: "-",
      specVolume: "-",

      offerName: offer.name,
      offerRate: offer.rate,
      offerUnit: offer.unit,
      offerVolume: offer.projectVolume,

      status: "Есть в КП, нет в спецификации",
      similarity: 0,
      reason: "Позиция КП не была использована в сравнении",
    }));

  return [...comparison, ...extraOfferItems];
};
