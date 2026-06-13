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

const normalizeText = (text: string) =>
  text.toLowerCase().replace(/\s+/g, " ").trim();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const containsKeyword = (text: string, keyword: string) =>
  new RegExp(
    `(^|[^а-яёa-z0-9])${escapeRegExp(keyword)}(?=$|[^а-яёa-z0-9])`,
    "i"
  ).test(text);

export const detectSpecificationPage = (text: string): boolean => {
  const normalizedText = normalizeText(text);
  const matchedKeywords = specificationKeywords.filter((keyword) =>
    containsKeyword(normalizedText, keyword)
  );
  const hasStrongTableMarker = strongTableMarkers.some((marker) =>
    containsKeyword(normalizedText, marker)
  );

  return matchedKeywords.length >= 3 && hasStrongTableMarker;
};
