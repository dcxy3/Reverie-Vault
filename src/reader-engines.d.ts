declare module "pdfjs-dist/web/pdf_viewer.mjs" {
  export * from "pdfjs-dist/types/web/pdf_viewer";
  export { EventBus } from "pdfjs-dist/types/web/event_utils";
}

declare module "foliate-js/view.js" {
  export function makeBook(file: File): Promise<any>;
}
declare module "*.mjs";
