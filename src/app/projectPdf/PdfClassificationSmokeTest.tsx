"use client";

import { useState } from "react";

import type { PdfClassificationSummary } from "./analyzePdfClassification";
import type { PdfPageClass } from "./classifyPdfPage";

const pageClasses: PdfPageClass[] = [
  "specification",
  "equipment-selection",
  "local-exhaust-table",
  "general-data",
  "commercial-letter",
  "unknown",
];

export default function PdfClassificationSmokeTest() {
  const [result, setResult] =
    useState<PdfClassificationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePdfUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/project-pdf/classify", {
        method: "POST",
        body: formData,
      });
      const responseBody = (await response.json()) as
        | PdfClassificationSummary
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in responseBody && responseBody.error
            ? responseBody.error
            : "Failed to classify PDF"
        );
      }

      setResult(responseBody as PdfClassificationSummary);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to classify PDF"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mb-8 rounded-xl bg-white p-6 shadow">
      <h2 className="mb-2 text-xl font-semibold">
        PDF classification smoke-test
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Техническая проверка классификации страниц PDF без извлечения позиций.
      </p>

      <input
        type="file"
        accept="application/pdf,.pdf"
        onChange={handlePdfUpload}
        disabled={isLoading}
        aria-label="Загрузить PDF для классификации"
      />

      {isLoading && (
        <p className="mt-4 text-sm text-blue-700">
          PDF обрабатывается...
        </p>
      )}

      {error && (
        <p className="mt-4 text-sm font-semibold text-red-700">{error}</p>
      )}

      {result && (
        <div className="mt-6 space-y-4 text-sm">
          <p>
            <strong>Total pages:</strong> {result.totalPages}
          </p>

          <p>
            <strong>Specification section:</strong>{" "}
            {result.specificationSection
              ? `pages ${result.specificationSection.startPage}-` +
                `${result.specificationSection.endPage}, sheets ` +
                `${result.specificationSection.sheetCount}`
              : "not found"}
          </p>

          <div>
            <h3 className="mb-2 font-semibold">Aggregate</h3>
            <ul className="space-y-1">
              {pageClasses.map((type) => (
                <li key={type}>
                  {type}: {result.aggregate[type]}
                </li>
              ))}
            </ul>
          </div>

          <p>
            <strong>Specification pages:</strong>{" "}
            {result.specificationPages.length > 0
              ? result.specificationPages.join(", ")
              : "none"}
          </p>

          {result.selectedPages.page41 && (
            <p>
              <strong>Page 41:</strong>{" "}
              {result.selectedPages.page41.type}, score{" "}
              {result.selectedPages.page41.score}
            </p>
          )}

          {result.selectedPages.page118 && (
            <p>
              <strong>Page 118:</strong>{" "}
              {result.selectedPages.page118.type}, score{" "}
              {result.selectedPages.page118.score}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
