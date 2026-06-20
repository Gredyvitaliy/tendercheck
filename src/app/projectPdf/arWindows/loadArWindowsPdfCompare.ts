import type { ArWindowsPdfExcelCompareResult } from "./compareArWindowsPdfWithExcelOffer";

type ErrorResponse = {
  error?: string;
  details?: string;
};

const HTML_RESPONSE_MESSAGE =
  "API вернул HTML вместо JSON. Проверьте server console.";

const buildHtmlResponseMessage = (
  response: Response,
  responseText: string
): string => {
  const preview = responseText.slice(0, 300);

  return `${HTML_RESPONSE_MESSAGE} HTTP ${response.status}. First 300 chars: ${preview}`;
};

const looksLikeJson = (text: string): boolean => {
  const trimmed = text.trim();

  return trimmed.startsWith("{") || trimmed.startsWith("[");
};

const looksLikeHtml = (text: string): boolean => {
  const trimmed = text.trim().toLowerCase();

  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
};

const parseJsonResponse = (
  text: string
): ArWindowsPdfExcelCompareResult | ErrorResponse | null => {
  if (!looksLikeJson(text)) {
    return null;
  }

  return JSON.parse(text) as ArWindowsPdfExcelCompareResult | ErrorResponse;
};

export class ArWindowsPdfCompareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArWindowsPdfCompareError";
  }
}

export const loadArWindowsPdfCompare = async (
  pdfFile: File,
  excelOfferFile: File,
  fetcher: typeof fetch = fetch
): Promise<ArWindowsPdfExcelCompareResult> => {
  const formData = new FormData();
  formData.set("pdf", pdfFile);
  formData.set("excelOffer", excelOfferFile);

  const response = await fetcher("/api/project-pdf/ar-windows/compare", {
    method: "POST",
    body: formData,
  });
  const responseText = await response.text();
  const body = parseJsonResponse(responseText);

  if (!response.ok) {
    if (looksLikeHtml(responseText)) {
      throw new ArWindowsPdfCompareError(
        buildHtmlResponseMessage(response, responseText)
      );
    }

    const errorBody = body as ErrorResponse | null;
    throw new ArWindowsPdfCompareError(
      errorBody?.details ??
        errorBody?.error ??
        responseText.trim() ??
        "Failed to compare AR windows PDF with Excel offer"
    );
  }

  if (!body) {
    throw new ArWindowsPdfCompareError(
      looksLikeHtml(responseText)
        ? buildHtmlResponseMessage(response, responseText)
        : "API returned a non-JSON response"
    );
  }

  return body as ArWindowsPdfExcelCompareResult;
};
