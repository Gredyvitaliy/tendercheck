export const normalizePageText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

export const countDistinctKeywords = (
  text: string,
  keywords: string[]
): number =>
  [...new Set(keywords)].filter(
    (keyword) => keyword.length > 0 && text.includes(keyword)
  ).length;
