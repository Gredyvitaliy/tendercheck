import type { CompareResult, WorkItem } from "../types";

export type OfferScope = {
  detectedBrands: string[];
  dominantBrands: string[];
  keywords: string[];
  confidence: number;
  reasons: string[];
};

type BrandDefinition = {
  name: string;
  pattern: RegExp;
};

const brandDefinitions: BrandDefinition[] = [
  {
    name: "NED",
    pattern: /(^|[^A-ZА-ЯЁ0-9])NED(?=$|[^A-ZА-ЯЁ0-9])/iu,
  },
  { name: "AIRNED", pattern: /AIRNED/iu },
  { name: "LITENED", pattern: /LITENED/iu },
  { name: "Арктос", pattern: /АРКТОС/iu },
  { name: "СовПлим", pattern: /СОВПЛИМ/iu },
  { name: "KENTATSU", pattern: /KENTATSU/iu },
  { name: "DAICHI", pattern: /DAICHI/iu },
  { name: "MUELLER", pattern: /MUELLER/iu },
];

const nedFamily = new Set(["NED", "AIRNED", "LITENED"]);
const minimumDominantRows = 2;
const dominantShareThreshold = 0.6;

const getItemText = (item: Pick<WorkItem, "name" | "rate">): string =>
  `${item.name} ${item.rate}`.trim();

const getBrands = (item: Pick<WorkItem, "name" | "rate">): string[] => {
  const text = getItemText(item);

  return brandDefinitions
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => name);
};

export const detectOfferScope = (
  excelWorkItems: WorkItem[]
): OfferScope => {
  const brandRows = excelWorkItems.map(getBrands);
  const detectedBrands = brandDefinitions
    .map(({ name }) => name)
    .filter((brand) => brandRows.some((brands) => brands.includes(brand)));
  const brandedRows = brandRows.filter((brands) => brands.length > 0);
  const nedFamilyRows = brandedRows.filter((brands) =>
    brands.some((brand) => nedFamily.has(brand))
  ).length;
  const confidence =
    brandedRows.length === 0 ? 0 : nedFamilyRows / brandedRows.length;
  const hasDominantNedFamily =
    nedFamilyRows >= minimumDominantRows &&
    confidence >= dominantShareThreshold;
  const dominantBrands = hasDominantNedFamily
    ? ["NED", "AIRNED", "LITENED"]
    : [];
  const reasons =
    brandedRows.length === 0
      ? ["Известные бренды в КП не обнаружены"]
      : hasDominantNedFamily
        ? [
            `Семейство NED найдено в ${nedFamilyRows} из ${brandedRows.length} брендированных позиций КП`,
          ]
        : [
            `Семейство NED найдено в ${nedFamilyRows} из ${brandedRows.length} брендированных позиций КП; уверенный scope не определен`,
          ];

  return {
    detectedBrands,
    dominantBrands,
    keywords: detectedBrands,
    confidence,
    reasons,
  };
};

export const isSpecItemInOfferScope = (
  specItem: WorkItem,
  offerScope: OfferScope
): boolean => {
  if (offerScope.dominantBrands.length === 0) {
    return true;
  }

  const brands = getBrands(specItem);

  return brands.some((brand) => nedFamily.has(brand));
};

export const applyOfferScopeToResults = (
  results: CompareResult[],
  offerScope: OfferScope
): CompareResult[] => {
  if (offerScope.dominantBrands.length === 0) {
    return [...results];
  }

  return results.map((result) => {
    if (result.status !== "Нет в КП") {
      return result;
    }

    const specItem: WorkItem = {
      number: 0,
      name: result.name,
      rate: result.rate,
      unit: result.unit,
      projectVolume:
        typeof result.specVolume === "number" ? result.specVolume : 0,
      rowType: "item",
    };

    if (isSpecItemInOfferScope(specItem, offerScope)) {
      return result;
    }

    return {
      ...result,
      status: "Вне области КП",
      reason: `${result.reason}. Позиция не относится к определенной области КП: ${offerScope.dominantBrands.join(", ")}`,
    };
  });
};
