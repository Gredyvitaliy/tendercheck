export interface PdfSpecificationRowCandidate {
  pageNumber: number;
  rawLines: string[];
  position?: string;
  name: string;
  unit?: string;
  quantity?: number;
  confidence: number;
  reasons: string[];
}

type PdfPageText = {
  pageNumber: number;
  text: string;
};

type SpecificationSectionRange = {
  startPage: number;
  endPage: number;
};

const serviceLinePatterns = [
  /^d\d.*\.со$/iu,
  /^изм\./iu,
  /^кол\.?$/iu,
  /^уч\.?$/iu,
  /^лист(?:ов)?(?:\s|$)/iu,
  /^стадия(?:\s|$)/iu,
  /^разраб\./iu,
  /^провери/iu,
  /^гип(?:\s|$)/iu,
  /^рук\.?пр\./iu,
  /^н\.\s*контр\./iu,
  /^ооо(?:\s|$)/iu,
  /^сро-/iu,
  /^согласовано(?:\s|$)/iu,
  /^взам\.\s*инв\./iu,
  /^подп\.\s*и\s*дата/iu,
  /^инв\.\s*№/iu,
  /^формат\s+[аa]\d/iu,
  /^поз\.?$/iu,
  /^наименование(?:\s|$)/iu,
  /^характеристика$/iu,
  /^тип,\s*марка/iu,
  /^обозначение(?:\s|$)/iu,
  /^документа,?$/iu,
  /^опросного\s+листа/iu,
  /^код$/iu,
  /^продукции$/iu,
  /^поставщик$/iu,
  /^ед\.\s*изме-/iu,
  /^ре-$/iu,
  /^ния$/iu,
  /^кол-$/iu,
  /^во$/iu,
  /^масса$/iu,
  /^1\s*ед\./iu,
  /^кг$/iu,
  /^приме-$/iu,
  /^чание$/iu,
  /^примечани[ея]:?$/iu,
] as const;

const numericPositionPattern =
  /^(\d+(?:\.\d+)*)(?:[.)])?\s+/u;

const numberedNotePattern = /^\d+\)\s+/u;

const integerSectionHeadingPattern = /^\d+\.\s+/u;

const systemCodePattern =
  /(?:^|\s)([пвк]\d+(?:\.\d+)+)(?=\s|$)/iu;

const equipmentMaterialPattern =
  /вентилятор|клапан|воздуховод|шумоглушитель|реш[её]тка|диффузор|зонт|насос|фильтр|установка|кондиционер|блок|адаптер|кабель|труба|изоляц|лента|сталь|конструкц|креплен|заслонка|вставка|секци|нагревател|охладител|материал|хомут|болт|гайка|анкер|профиль|агрегат/iu;

const unitTokenPattern =
  /(?:^|\s)(шт|кг|м[23²³]?|м\.п\.|к-т|компл(?:ект)?)(?=\s|$)/iu;

const unitQuantityPattern =
  /(?:^|\s)(шт|кг|м[23²³]?|м\.п\.|к-т|компл(?:ект)?)\s+(\d+(?:[.,]\d+)?)(?=\s|$)/iu;

const commercialEndingPattern =
  /\s*[«"]?или\s+аналог[»"]?\s*$/iu;

const splitLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const isServiceLine = (line: string): boolean =>
  numberedNotePattern.test(line) ||
  serviceLinePatterns.some((pattern) => pattern.test(line));

const extractStartPosition = (line: string): string | undefined => {
  const numericMatch = line.match(numericPositionPattern);
  if (numericMatch) {
    return numericMatch[1];
  }

  if (equipmentMaterialPattern.test(line)) {
    return line.match(systemCodePattern)?.[1];
  }

  return undefined;
};

const isCandidateStart = (line: string): boolean =>
  (numericPositionPattern.test(line) &&
    !(
      integerSectionHeadingPattern.test(line) &&
      !equipmentMaterialPattern.test(line) &&
      !unitTokenPattern.test(line)
    )) ||
  (systemCodePattern.test(line) &&
    equipmentMaterialPattern.test(line));

const extractUnitAndQuantity = (
  lines: string[]
): { unit?: string; quantity?: number } => {
  const priorityLines = [
    lines[0],
    lines.at(-1),
    ...lines.slice(1, -1),
  ].filter((line): line is string => Boolean(line));

  for (const line of priorityLines) {
    const match = line.match(unitQuantityPattern);
    if (match) {
      return {
        unit: match[1],
        quantity: Number.parseFloat(match[2].replace(",", ".")),
      };
    }
  }

  const allText = lines.join(" ");
  const unit = allText.match(unitTokenPattern)?.[1];

  return unit ? { unit } : {};
};

const cleanCandidateName = (
  lines: string[],
  position?: string
): string => {
  let name = lines.join(" ");

  if (position) {
    const escapedPosition = position.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    name = name.replace(
      new RegExp(`^${escapedPosition}[.)]?\\s*`, "iu"),
      ""
    );
  }

  name = name
    .replace(commercialEndingPattern, "")
    .replace(
      new RegExp(
        `${unitTokenPattern.source}\\s+\\d+(?:[.,]\\d+)?\\s*$`,
        "iu"
      ),
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  return name;
};

const finalizeCandidate = (
  pageNumber: number,
  rawLines: string[]
): PdfSpecificationRowCandidate | null => {
  if (rawLines.length === 0) {
    return null;
  }

  const position = extractStartPosition(rawLines[0]);
  const { unit, quantity } = extractUnitAndQuantity(rawLines);
  const name = cleanCandidateName(rawLines, position);
  const hasEquipmentOrMaterial =
    equipmentMaterialPattern.test(rawLines.join(" "));
  const reasons: string[] = [];

  if (position) reasons.push("Найдена позиция");
  if (unit) reasons.push("Найдена единица измерения");
  if (quantity !== undefined) reasons.push("Найдено количество");
  if (hasEquipmentOrMaterial) {
    reasons.push("Найдено оборудование или материал");
  }

  return {
    pageNumber,
    rawLines: [...rawLines],
    position,
    name,
    unit,
    quantity,
    confidence: reasons.length * 0.25,
    reasons,
  };
};

export function extractSpecificationRowCandidates(
  pages: PdfPageText[],
  specificationSection: SpecificationSectionRange
): PdfSpecificationRowCandidate[] {
  const candidates: PdfSpecificationRowCandidate[] = [];

  for (const page of pages) {
    if (
      page.pageNumber < specificationSection.startPage ||
      page.pageNumber > specificationSection.endPage
    ) {
      continue;
    }

    let currentLines: string[] = [];

    const flushCurrent = () => {
      const candidate = finalizeCandidate(
        page.pageNumber,
        currentLines
      );
      if (candidate) {
        candidates.push(candidate);
      }
      currentLines = [];
    };

    for (const line of splitLines(page.text)) {
      if (isServiceLine(line)) {
        continue;
      }

      if (isCandidateStart(line)) {
        flushCurrent();
        currentLines = [line];
        continue;
      }

      if (currentLines.length > 0) {
        currentLines.push(line);
      }
    }

    flushCurrent();
  }

  return candidates;
}
