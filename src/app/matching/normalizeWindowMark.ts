const CYRILLIC_VE = /[\u0412\u0432]/g;
const DASHES = /[\u2010-\u2015\u2212]/g;
const MIRROR_SUFFIX = /^(?:\*|\((?:\u0437\u0435\u0440|\u0437\u0435\u0440\u043a\.?|\u0437\u0435\u0440\u043a\u0430\u043b\u044c\u043d\u043e\u0435)\))$/;

export const normalizeWindowMark = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(CYRILLIC_VE, "b")
    .replace(DASHES, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")")
    .replace(/\s*\*/g, "*")
    .trim();

  const match = normalized.match(/^((?:bp|pd|b))-?0*(\d+)(.*)$/);

  if (!match) {
    return normalized.replace(/\s+/g, "");
  }

  const [, prefix, number, suffix] = match;
  const normalizedSuffix = suffix.replace(/\s+/g, "");
  const significantSuffix = /\d/.test(normalizedSuffix)
    ? ""
    : normalizedSuffix.replace(MIRROR_SUFFIX, "(mirror)");

  return `${prefix}-${Number.parseInt(number, 10)}${significantSuffix}`;
};
