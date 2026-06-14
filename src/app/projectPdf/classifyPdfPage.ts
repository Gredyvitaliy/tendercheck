import { normalizePageText } from "./pageTextUtils";

export type PdfPageClass =
  | "specification"
  | "equipment-selection"
  | "local-exhaust-table"
  | "general-data"
  | "commercial-letter"
  | "unknown";

export interface PdfPageClassification {
  pageNumber: number;
  type: PdfPageClass;
  score: number;
  reasons: string[];
}

export type PdfPageScore = Omit<PdfPageClassification, "pageNumber">;

type ScoreAccumulator = {
  score: number;
  reasons: string[];
};

const tableColumns = [
  "поз.",
  "обозначение",
  "наименование",
  "ед. изм.",
  "ед. изм",
  "кол.",
  "масса",
  "примечание",
] as const;

const specificationColumnGroups = [
  ["поз."],
  ["обозначение"],
  ["наименование"],
  ["ед. изм.", "ед. изм"],
  ["кол."],
  ["масса"],
  ["примечание"],
] as const;

const engineeringItems = [
  "вентилятор",
  "клапан",
  "воздуховод",
  "шумоглушитель",
  "решетка",
  "решётка",
  "диффузор",
  "зонт",
  "насос",
  "фильтр",
] as const;

const tiePriority: PdfPageClass[] = [
  "commercial-letter",
  "equipment-selection",
  "local-exhaust-table",
  "general-data",
  "specification",
];

const matchedPhrases = (
  text: string,
  phrases: readonly string[]
): string[] => phrases.filter((phrase) => text.includes(phrase));

const matchedPhraseGroups = (
  text: string,
  groups: readonly (readonly string[])[]
): string[] =>
  groups.flatMap((group) => {
    const match = group.find((phrase) => text.includes(phrase));
    return match ? [match] : [];
  });

const hasEquipmentCode = (text: string): boolean =>
  /(?:^|[^а-яёa-z0-9])[пв]\s?\d+(?:\.\d+)+(?![а-яёa-z0-9])/iu.test(
    text
  );

const addPhraseGroup = (
  result: ScoreAccumulator,
  text: string,
  phrases: readonly string[],
  weight: number,
  reason: string
): string[] => {
  const matches = matchedPhrases(text, phrases);

  if (matches.length > 0) {
    result.score += weight;
    result.reasons.push(`${reason}: ${matches.join(", ")}`);
  }

  return matches;
};

const addMatchedItems = (
  result: ScoreAccumulator,
  text: string,
  items: readonly string[],
  weightPerItem: number,
  reason: string
): string[] => {
  const matches = [...new Set(matchedPhrases(text, items))];

  if (matches.length > 0) {
    result.score += matches.length * weightPerItem;
    result.reasons.push(`${reason}: ${matches.join(", ")}`);
  }

  return matches;
};

const makeScore = (
  type: Exclude<PdfPageClass, "unknown">,
  result: ScoreAccumulator
): PdfPageScore => ({
  type,
  score: result.score,
  reasons: result.reasons,
});

export const scoreSpecification = (
  normalizedText: string
): PdfPageScore => {
  const result: ScoreAccumulator = { score: 0, reasons: [] };

  const strongTitles = addPhraseGroup(
    result,
    normalizedText,
    [
      "спецификация оборудования",
      "спецификация изделий",
      "спецификация материалов",
    ],
    20,
    "Найден заголовок спецификации"
  );
  addPhraseGroup(
    result,
    normalizedText,
    ["оборудования, изделий и материалов"],
    8,
    "Найдена характерная формулировка спецификации"
  );

  const columns = matchedPhraseGroups(
    normalizedText,
    specificationColumnGroups
  );
  if (columns.length > 0) {
    result.score += columns.length * 2;
    result.reasons.push(
      `Найдены колонки спецификации: ${columns.join(", ")}`
    );
  }

  const items = addMatchedItems(
    result,
    normalizedText,
    engineeringItems,
    1,
    "Найдены инженерные позиции"
  );

  if (columns.length >= 4 && items.length >= 2) {
    result.score += 5;
    result.reasons.push(
      "Табличные колонки сочетаются с инженерными позициями"
    );
  }

  const hasStrongTitle = strongTitles.length > 0;
  const hasStrongTableShape = columns.length >= 4 && items.length >= 2;

  if (
    (!hasStrongTitle && !hasStrongTableShape) ||
    result.score < 10
  ) {
    result.reasons.push(
      "Отклонено как слабая спецификация: недостаточно сильных признаков"
    );
    result.score = 0;
  }

  return makeScore("specification", result);
};

export const scoreEquipmentSelection = (
  normalizedText: string
): PdfPageScore => {
  const result: ScoreAccumulator = { score: 0, reasons: [] };

  addPhraseGroup(
    result,
    normalizedText,
    ["подбор оборудования"],
    20,
    "Похоже на лист подбора оборудования"
  );
  addPhraseGroup(
    result,
    normalizedText,
    ["вентиляционная установка", "наименование установки"],
    9,
    "Найдены признаки вентиляционной установки"
  );
  const parameters = addMatchedItems(
    result,
    normalizedText,
    ["параметры установки", "расход воздуха", "полное давление"],
    4,
    "Найдены параметры подбора"
  );

  if (normalizedText.includes("airned")) {
    result.score += 6;
    result.reasons.push("Найден производитель AIRNED");
  }

  if (hasEquipmentCode(normalizedText)) {
    result.score += 5;
    result.reasons.push("Найден код вентиляционной установки");
  }

  if (parameters.length >= 2) {
    result.score += 4;
    result.reasons.push("Присутствует набор расчётных параметров установки");
  }

  return makeScore("equipment-selection", result);
};

export const scoreLocalExhaustTable = (
  normalizedText: string
): PdfPageScore => {
  const result: ScoreAccumulator = { score: 0, reasons: [] };

  addPhraseGroup(
    result,
    normalizedText,
    ["местный отсос", "местные отсосы"],
    20,
    "Найден заголовок местных отсосов"
  );
  addPhraseGroup(
    result,
    normalizedText,
    ["зонт местного отсоса"],
    10,
    "Найден зонт местного отсоса"
  );
  addPhraseGroup(
    result,
    normalizedText,
    ["расход удаляемого воздуха"],
    8,
    "Найден расход удаляемого воздуха"
  );
  addPhraseGroup(
    result,
    normalizedText,
    ["укрытие"],
    4,
    "Найдено укрытие источника"
  );

  return makeScore("local-exhaust-table", result);
};

export const scoreGeneralData = (
  normalizedText: string
): PdfPageScore => {
  const result: ScoreAccumulator = { score: 0, reasons: [] };

  addPhraseGroup(
    result,
    normalizedText,
    ["общие данные"],
    20,
    "Найден заголовок общих данных"
  );
  addMatchedItems(
    result,
    normalizedText,
    [
      "ведомость рабочих чертежей",
      "ведомость ссылочных",
      "основные показатели",
      "пояснительная записка",
    ],
    8,
    "Найдены разделы общих данных"
  );

  if (normalizedText.includes("нормативн")) {
    result.score += 5;
    result.reasons.push("Найдены ссылки на нормативные документы");
  }

  return makeScore("general-data", result);
};

export const scoreCommercialLetter = (
  normalizedText: string
): PdfPageScore => {
  const result: ScoreAccumulator = { score: 0, reasons: [] };

  const commercialTitle = addPhraseGroup(
    result,
    normalizedText,
    ["коммерческое предложение"],
    20,
    "Найдено коммерческое предложение"
  );
  addPhraseGroup(
    result,
    normalizedText,
    ["номер коммерческого предложения"],
    10,
    "Найден номер коммерческого предложения"
  );
  addMatchedItems(
    result,
    normalizedText,
    [
      "исх. №",
      "кому",
      "с уважением",
      "стоимость",
      "срок поставки",
      "условия оплаты",
      "настоящим предлагаем",
    ],
    6,
    "Найдены признаки делового письма"
  );

  const commercialTableColumns = matchedPhrases(
    normalizedText,
    tableColumns
  );
  if (commercialTitle.length > 0 && commercialTableColumns.length >= 2) {
    result.score += 12;
    result.reasons.push(
      "Коммерческое предложение содержит товарную таблицу"
    );
  }

  return makeScore("commercial-letter", result);
};

export function classifyPdfPage(
  pageNumber: number,
  rawText: string
): PdfPageClassification {
  const normalizedText = normalizePageText(rawText);
  const scores = [
    scoreSpecification(normalizedText),
    scoreEquipmentSelection(normalizedText),
    scoreLocalExhaustTable(normalizedText),
    scoreGeneralData(normalizedText),
    scoreCommercialLetter(normalizedText),
  ];
  const highestScore = Math.max(...scores.map((result) => result.score));

  if (highestScore <= 0) {
    return {
      pageNumber,
      type: "unknown",
      score: 0,
      reasons: [],
    };
  }

  const winner = tiePriority
    .map((type) => scores.find((result) => result.type === type))
    .find((result) => result?.score === highestScore);

  if (!winner) {
    return {
      pageNumber,
      type: "unknown",
      score: 0,
      reasons: [],
    };
  }

  return {
    pageNumber,
    type: winner.type,
    score: winner.score,
    reasons: winner.reasons,
  };
}
