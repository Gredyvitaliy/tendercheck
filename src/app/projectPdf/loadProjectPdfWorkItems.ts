import type { ProjectPdfWorkItemsResponse } from "../api/project-pdf/work-items/route";

type ErrorResponse = {
  error?: string;
  details?: string;
};

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
    throw new Error(
      errorBody.details ??
        errorBody.error ??
        "Failed to process PDF project"
    );
  }

  return body as ProjectPdfWorkItemsResponse;
};
