import {
  formatDatasetScoutConsoleSummary,
  runDatasetScout,
} from "./datasetScout";

const main = async () => {
  const folderPath = process.argv[2];

  if (!folderPath) {
    console.error(
      'Usage: npx tsx src/app/dataset/runDatasetScout.ts "<folder-path>"'
    );
    process.exitCode = 1;
    return;
  }

  try {
    const result = await runDatasetScout(folderPath);
    console.log(formatDatasetScoutConsoleSummary(result));
    console.log("");
    console.log("Written debug/dataset-candidates.json");
    console.log("Written debug/dataset-scout-summary.json");
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Dataset Scout failed"
    );
    process.exitCode = 1;
  }
};

void main();
