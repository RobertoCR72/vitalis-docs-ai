// Extração de texto e chunking. Server-only.
import { extractText, getDocumentProxy } from "unpdf";

export interface RawChunk {
  chunk_index: number;
  content: string;
  page_start: number | null;
  page_end: number | null;
  section_title: string | null;
}

const TARGET_CHARS = 1200;
const OVERLAP_CHARS = 150;
const MIN_TOTAL_CHARS = 200;

export async function extractPdfPages(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text : [text];
}

function normalize(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectSection(text: string): string | null {
  const line = text.split("\n").find((l) => l.trim().length > 0)?.trim();
  if (!line) return null;
  if (line.length < 80 && /^([0-9]+[.)]|[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,})/.test(line)) {
    return line;
  }
  return null;
}

export function chunkPages(pages: string[]): { chunks: RawChunk[]; totalChars: number } {
  const normalized = pages.map(normalize);
  const totalChars = normalized.reduce((a, b) => a + b.length, 0);
  const chunks: RawChunk[] = [];
  let buffer = "";
  let bufferStartPage: number | null = null;
  let bufferEndPage: number | null = null;

  const flush = () => {
    if (buffer.trim().length < 50) return;
    chunks.push({
      chunk_index: chunks.length,
      content: buffer.trim(),
      page_start: bufferStartPage,
      page_end: bufferEndPage,
      section_title: detectSection(buffer),
    });
    // overlap
    buffer = buffer.slice(-OVERLAP_CHARS);
    bufferStartPage = bufferEndPage;
  };

  for (let i = 0; i < normalized.length; i++) {
    const pageNum = i + 1;
    const pageText = normalized[i];
    if (!pageText) continue;
    if (bufferStartPage === null) bufferStartPage = pageNum;
    bufferEndPage = pageNum;

    // Split page into paragraphs
    const parts = pageText.split(/\n\n+/);
    for (const part of parts) {
      if (buffer.length + part.length + 2 > TARGET_CHARS && buffer.length > 0) {
        flush();
      }
      buffer += (buffer.length ? "\n\n" : "") + part;
    }
  }
  flush();
  return { chunks, totalChars };
}

export function chunkPlainText(text: string): { chunks: RawChunk[]; totalChars: number } {
  return chunkPages([text]);
}

export function isLikelyScanned(totalChars: number, byteSize: number): boolean {
  // Menos de ~1 caractere por 1KB de PDF geralmente indica digitalização.
  return totalChars < MIN_TOTAL_CHARS || totalChars * 1024 < byteSize;
}
