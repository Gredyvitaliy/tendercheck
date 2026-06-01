import type { WorkItem, CompareResult } from "./types";
import { normalizeText } from "./utils";
import { extractItemFeatures } from "./itemFeatures";
const getPrimaryMark = (item: WorkItem) => {
  const rateFeatures = extractItemFeatures(item.rate || "");

  if (rateFeatures.marks.length > 0) {
    return rateFeatures.marks[0];
  }

  const nameFeatures = extractItemFeatures(item.name || "");

  return nameFeatures.marks[nameFeatures.marks.length - 1] || "";
};

const groupWorkItems = (items: WorkItem[]) => {
  return Object.values(
    items.reduce((acc, item) => {
      const features = extractItemFeatures(item);

      const mark = getPrimaryMark(item);
      const itemType = features.itemType || "";

      const key = mark
        ? normalizeText(`${itemType} ${mark}`)
        : normalizeText(`${item.name} ${item.rate} ${item.unit}`);

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

   groupedOfferItems.forEach((offer, offerIndex) => {
  if (usedOfferIndexes.has(offerIndex)) {
    return;
  }

  const specFeatures = extractItemFeatures(spec);
  const offerFeatures = extractItemFeatures(offer);

  const specPrimaryMark = getPrimaryMark(spec);
  const offerPrimaryMark = getPrimaryMark(offer);

  if (
    specPrimaryMark &&
    offerPrimaryMark &&
    specPrimaryMark !== offerPrimaryMark
  ) {
    return;
  }

  if (
    specFeatures.itemType !== "прочее" &&
    offerFeatures.itemType !== "прочее" &&
    specFeatures.itemType !== offerFeatures.itemType
  ) {
    return;
  }

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

if (specPrimaryMark && offerPrimaryMark && specPrimaryMark === offerPrimaryMark) {
  similarity += 60;
}

if (specFeatures.dimensions.length && offerFeatures.dimensions.length) {
  const hasSameDimension = specFeatures.dimensions.some((dimension) =>
    offerFeatures.dimensions.includes(dimension)
  );

  if (hasSameDimension) {
    similarity += 30;
  } else {
    similarity -= 80;
  }
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
        bestMatchIndex = offerIndex;
      }
    });

   if (!bestMatch || bestSimilarity < 50) {
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
  };
}

    usedOfferIndexes.add(bestMatchIndex);
    const finalSpecFeatures = extractItemFeatures(spec);
const finalOfferFeatures = extractItemFeatures(bestMatch);
console.log("FINAL FEATURES CHECK", {
  specName: spec.name,
  specRate: spec.rate,
  offerName: bestMatch.name,
  offerRate: bestMatch.rate,
  specMarks: finalSpecFeatures.marks,
  offerMarks: finalOfferFeatures.marks,
  specDimensions: finalSpecFeatures.dimensions,
  offerDimensions: finalOfferFeatures.dimensions,
});
const finalSpecPrimaryMark = getPrimaryMark(spec);
const finalOfferPrimaryMark = getPrimaryMark(bestMatch);

const hasSameFinalMark =
  finalSpecPrimaryMark &&
  finalOfferPrimaryMark &&
  finalSpecPrimaryMark === finalOfferPrimaryMark;

const hasDifferentDimensions =
  finalSpecFeatures.dimensions.length > 0 &&
  finalOfferFeatures.dimensions.length > 0 &&
  !finalSpecFeatures.dimensions.some((dimension) =>
    finalOfferFeatures.dimensions.includes(dimension)
  );
if (hasDifferentDimensions) {
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
  };
}
if (
  hasSameFinalMark &&
  !hasDifferentDimensions &&
  Number(spec.projectVolume) === Number(bestMatch.projectVolume)
) {
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
    similarity: 100,
  };
}

    if (bestSimilarity < 80) {
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
      similarity: bestSimilarity,
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
    }));

  return [...comparison, ...extraOfferItems];
};