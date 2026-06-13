import {
  countDistinctKeywords,
  normalizePageText,
} from "./pageTextUtils";

const specificationKeywords = [
  "спецификация",
  "ведомость",
  "оборудование",
  "наименование",
  "ед. изм",
  "кол-во",
  "количество",
  "марка",
  "тип",
] as const;

const strongTableMarkers = [
  "наименование",
  "ед. изм",
  "кол-во",
  "количество",
  "марка",
  "тип",
] as const;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const containsKeyword = (text: string, keyword: string) =>
  new RegExp(
    `(^|[^а-яёa-z0-9])${escapeRegExp(keyword)}(?=$|[^а-яёa-z0-9])`,
    "i"
  ).test(text);

export const detectSpecificationPage = (text: string): boolean => {
  const normalizedText = normalizePageText(text).replace(/\n/g, " ");
  const matchedKeywords = specificationKeywords.filter((keyword) =>
    containsKeyword(normalizedText, keyword)
  );
  const matchedKeywordCount = countDistinctKeywords(normalizedText, [
    ...matchedKeywords,
  ]);
  const hasStrongTableMarker = strongTableMarkers.some((marker) =>
    containsKeyword(normalizedText, marker)
  );

  return matchedKeywordCount >= 3 && hasStrongTableMarker;
};
