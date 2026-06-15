# Offer Scope Analysis Design

## Goal

Distinguish specification items that are genuinely missing from a partial
contractor offer from items that are outside the offer's detected brand scope.

## Constraints

- Do not change the Matching Engine.
- Apply scope analysis after `compareWorkItems`.
- Preserve current behavior when scope confidence is insufficient.
- Do not treat country or generic origin words as brands.
- Keep the existing Excel parsing and PDF parsing pipelines unchanged.

## Brand Dictionary

The first version recognizes these brands:

- NED
- AIRNED
- LITENED
- Arktos (`Арктос`)
- SovPlym (`СовПлим`)
- KENTATSU
- DAICHI
- MUELLER

The following values are explicitly excluded from scope signals:

- Россия
- РФ
- отечественный
- импортный
- аналог

Brand matching is case-insensitive and searches the combined `name` and `rate`
fields of each `WorkItem`. The detector returns canonical display names.

## Scope Detection

`detectOfferScope(excelWorkItems)` returns:

```ts
{
  detectedBrands: string[];
  dominantBrands: string[];
  keywords: string[];
  confidence: number;
  reasons: string[];
}
```

The detector counts rows containing each known brand. A brand family is
considered dominant only when it has enough evidence both absolutely and
relative to the branded offer rows. Confidence is normalized to the `0..1`
range and reflects the share of branded rows belonging to the dominant family.

For the first safe pass, automatic filtering is enabled only when the
NED/AIRNED/LITENED family confidently dominates the offer. Other recognized
brands are still reported in diagnostics but do not independently activate
filtering.

If no family reaches the confidence threshold, `dominantBrands` is empty and
all comparison statuses remain unchanged.

## Scope Membership

`isSpecItemInOfferScope(specItem, offerScope)` behaves as follows:

- With no confident scope, return `true` to preserve existing behavior.
- With a dominant NED family, return `true` only for items containing NED,
  AIRNED, or LITENED.
- Items containing another recognized brand are outside scope.
- Unbranded items are outside a confident brand-specific scope because the
  offer does not claim to cover them.

The function accepts a `WorkItem`. A small adapter reconstructs the relevant
fields from a missing `CompareResult` for post-processing.

## Result Post-processing

A pure post-processing function receives the original `CompareResult[]` and
the detected scope:

- Only results currently having status `Нет в КП` are considered.
- In-scope missing results remain `Нет в КП`.
- Out-of-scope missing results become `Вне области КП`.
- All matches, partial matches, differences, and extra offer rows remain
  unchanged.
- The reason is augmented with a concise scope explanation.

`Вне области КП` is added to `CompareResultStatus` so existing filtering,
rendering, export, and debug code remain type-safe.

## UI

After parsing the Excel offer, the PDF comparison flow will:

1. Detect the offer scope.
2. Run the existing Matching Engine.
3. Apply scope post-processing.
4. Store and render the processed results.

The technical panel will show:

- detected brands;
- dominant brands;
- confidence;
- reasons;
- `Нет в КП в зоне КП`;
- `Вне области КП`;
- status counts before and after scope filtering.

The main result filters and summary cards will include the new status. Excel
specification mode will retain the existing comparison behavior; scope
post-processing is initially limited to the PDF project mode.

## CLI And Debug Output

`testComparePdfSpecificationWithExcelOffer.ts` will detect and apply scope after
matching. Its debug JSON will retain existing fields and add scope diagnostics
plus before/after status counts under `summary`.

Console output will print:

- detected brands;
- dominant brands;
- confidence;
- reasons;
- status counts before scope filtering;
- status counts after scope filtering.

## Tests

Tests will cover:

- detection of a dominant NED family;
- exclusion of country and generic words;
- weak or mixed evidence preserving old behavior;
- NED-family specification items remaining in scope;
- other brands and unbranded items becoming out of scope under confident NED
  scope;
- post-processing changing only `Нет в КП`;
- summary/debug counts before and after filtering;
- the new status in UI-facing shared types and export handling.
