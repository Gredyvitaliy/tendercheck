import { analyzePdfClassification } from "../../../projectPdf/analyzePdfClassification";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "PDF file is required" },
        { status: 400 }
      );
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return Response.json(
        { error: "Only PDF files are supported" },
        { status: 415 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfData = new Uint8Array(arrayBuffer);
    const result = await analyzePdfClassification(pdfData);

    return Response.json(result);
  } catch (error) {
    console.error("PDF classification failed:", error);
    return Response.json(
      { error: "Failed to classify PDF" },
      { status: 500 }
    );
  }
}
