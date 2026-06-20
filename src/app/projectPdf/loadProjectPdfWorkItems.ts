import type { ProjectPdfWorkItemsResponse } from "../api/project-pdf/work-items/route";
import type { PdfTextLayerDiagnostics } from "./pdfTextDiagnostics";

type ErrorResponse = {
  error?: string;
  details?: string;
  technicalInfo?: PdfTextLayerDiagnostics;
};

export class ProjectPdfProcessingError extends Error {
  constructor(
    message: string,
    public readonly technicalInfo?: PdfTextLayerDiagnostics
  ) {
    super(message);
    this.name = "ProjectPdfProcessingError";
  }
}

export const loadProjectPdfWorkItems = async (
  file: File,
  fetcher: typeof fetch = fetch
): Promise<ProjectPdfWorkItemsResponse> => {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetcher("/api/project-pdf/work-items", {
    method: "POST",
    body: formData,
  });
  const body = (await response.json()) as
    | ProjectPdfWorkItemsResponse
    | ErrorResponse;

  if (!response.ok) {
    const errorBody = body as ErrorResponse;
    throw new ProjectPdfProcessingError(
      errorBody.details ??
        errorBody.error ??
        "Failed to process PDF project",
      errorBody.technicalInfo
    );
  }

  return body as ProjectPdfWorkItemsResponse;
};
