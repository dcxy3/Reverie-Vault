import type { ReadingTextDocument } from "../types";
export function escapeHtml(value: string): string;
export function splitTextChapters(document: ReadingTextDocument): Array<{ title: string; paragraphs: string[] }>;
export function makeTextBook(document: ReadingTextDocument): any;
export function legacyTextPosition(document: ReadingTextDocument, pageNumber?: number): { index: number; paragraph: number; offset: number };
