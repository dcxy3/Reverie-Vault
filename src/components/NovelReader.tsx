import { useEffect, useRef } from "react";
import type { ReadingItem, ReadingTextDocument } from "../types";

export function NovelReader({ item, document, onProgress, onClose }: {
  item: ReadingItem;
  document: ReadingTextDocument;
  onProgress: (location: string, chapter: string) => void;
  onClose: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const callbacks = useRef({ onProgress, onClose });
  callbacks.current = { onProgress, onClose };
  useEffect(() => {
    const handle = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== "reverie-reader") return;
      const data = event.data;
      if (data.type === "ready") frame.current.contentWindow?.postMessage({ channel: "reverie-reader", type: "open", document,
        location: item.lastReadLocation, chapter: item.lastReadChapter, legacyPage: item.lastReadPage }, "*");
      if (data.type === "progress" && typeof data.location === "string" && data.location.length < 4096) callbacks.current.onProgress(data.location, String(data.chapter || "正文"));
      if (data.type === "close") callbacks.current.onClose();
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [item.id, document]);
  return <section className="novel-reader-overlay" role="dialog" aria-modal="true" aria-label={item.title}>
    <iframe ref={frame} title={`${item.title} 阅读器`} src="./reader.html" sandbox="allow-scripts allow-same-origin" />
  </section>;
}
