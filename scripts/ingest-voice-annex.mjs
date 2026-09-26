// Extract the approved voice-agent source PDF into page-preserving passages.
// Run: node scripts/ingest-voice-annex.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const source = "corpus/pdf/1790246023182_Annex_1__List_of_Data_Sources.pdf";
const output = "corpus/voice-annex-passages.json";
const sectionTitles = [
  "Transparency & Municipal Projects",
  "Urban Mobility",
  "Architecture, Green Spaces & Urban Utilities",
  "Education",
  "Healthcare",
  "District Administration",
  "Services (Commerce, Tourism, Investment, Youth)",
  "Other Public Services",
];
const pdf = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(source)) }).promise;
const pageTexts = [];

for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = content.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .replace(//g, ":")
    .replace(/\s*/g, "(")
    .replace(/\s+/g, " ")
    .replace(/\s+:/g, ":")
    .trim();
  if (!text) throw new Error(`No extractable text on page ${pageNumber}`);
  pageTexts.push(text);
}

const pages = [];
for (let pageIndex = 0; pageIndex < pageTexts.length; pageIndex += 1) {
  const pageNumber = pageIndex + 1;
  const pageText = pageTexts[pageIndex];
  const localSections = sectionTitles.filter((_, index) => pageNumber === 1 ? index < 5 : index >= 5);
  const contentStart = pageNumber === 1 ? pageText.indexOf("Transparency & Municipal Projects") : pageText.indexOf("District Administration");
  const body = pageText.slice(contentStart);
  const matches = localSections
    .map((section) => ({ section, index: body.indexOf(section) }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index);
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = matches[i + 1]?.index ?? body.length;
    const { section } = matches[i];
    const text = body.slice(start, end).replace(/\s+/g, " ").trim();
    if (!text) throw new Error(`No text for ${section} on page ${pageNumber}`);
    pages.push({ page: pageNumber, section, text });
  }
}

mkdirSync("corpus/raw", { recursive: true });
writeFileSync(output, `${JSON.stringify(pages, null, 2)}\n`);
writeFileSync("corpus/raw/voice-annex.txt", `${pageTexts.join("\n\n")}\n`);
console.log(`Extracted ${pages.length} section passages from ${source}`);
