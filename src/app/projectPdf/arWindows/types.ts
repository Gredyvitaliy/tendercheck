export interface ArWindowSpecificationRow {
  mark: string;
  designation: string;
  name: string;
  area: string;
  quantity: string;
  mass: string;
  note: string;
}

export type ArWindowSpecificationColumn = keyof ArWindowSpecificationRow;

export interface ArWindowsExtractionDebugInfo {
  pageNumber: number;
  imagePath: string;
}

export interface ArWindowsExtractionResult {
  columns: ArWindowSpecificationColumn[];
  rows: ArWindowSpecificationRow[];
  extractionStatus: "debug-image-exported";
  debug: ArWindowsExtractionDebugInfo;
}
