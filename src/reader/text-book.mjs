const heading = /^(?:第[一二三四五六七八九十百千万两〇零0-9]+[章节卷回部篇].*|chapter\s+\d+.*|#{1,6}\s+.+)$/i;
export const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Split at paragraph boundaries; the engine, not a character count, lays out pages.
export function splitTextChapters(document) {
  const result = [];
  for (const source of document.chapters?.length ? document.chapters : [{ title: '正文', content: document.content || '' }]) {
    let title = source.title, paragraphs = [], length = 0;
    const flush = () => {
      if (paragraphs.length) result.push({ title, paragraphs });
      paragraphs = []; length = 0;
    };
    for (const raw of source.content.replace(/\r\n?/g, '\n').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (heading.test(line)) { flush(); title = line.replace(/^#{1,6}\s+/, ''); continue; }
      if (length > 24000) flush();
      paragraphs.push(line); length += line.length;
    }
    flush();
    if (!result.length) result.push({ title, paragraphs: ['这本轻小说没有可显示的正文。'] });
  }
  return result;
}

export function makeTextBook(document) {
  const chapters = splitTextChapters(document);
  const urls = new Map();
  const html = index => `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body><h2>${escapeHtml(chapters[index].title)}</h2>${chapters[index].paragraphs.map(text => `<p>${escapeHtml(text)}</p>`).join('')}</body></html>`;
  return {
    metadata: { title: document.title, language: 'zh-CN' },
    sections: chapters.map((chapter, index) => ({
      id: String(index), size: chapter.paragraphs.join('').length,
      load: () => {
        if (!urls.has(index)) urls.set(index, URL.createObjectURL(new Blob([html(index)], { type: 'text/html' })));
        return urls.get(index);
      },
      unload: () => { URL.revokeObjectURL(urls.get(index)); urls.delete(index); },
      createDocument: () => new DOMParser().parseFromString(html(index), 'text/html'),
    })),
    toc: chapters.map((chapter, index) => ({ label: chapter.title, href: String(index) })),
    resolveHref: href => ({ index: Number(href) }),
    splitTOCHref: href => [String(href), null],
    getTOCFragment: doc => doc.body,
    destroy: () => { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); },
  };
}

// Migrate the previous reader's 780-character page number to a text anchor.
export function legacyTextPosition(document, pageNumber = 0) {
  const starts = [];
  let absolute = 0;
  for (const source of document.chapters?.length ? document.chapters : [{ content: document.content || '' }]) {
    let pageSize = 0;
    for (const raw of source.content.replace(/\r/g, '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (heading.test(line)) { pageSize = 0; continue; }
      for (let start = 0; start < line.length; start += 780) {
        const length = Math.min(780, line.length - start);
        if (pageSize + length > 780) pageSize = 0;
        if (!pageSize) starts.push(absolute);
        pageSize += length;
        absolute += length;
      }
    }
  }
  let offset = starts[Math.max(0, Math.min(pageNumber, starts.length - 1))] || 0;
  const chapters = splitTextChapters(document);
  for (const [index, chapter] of chapters.entries()) {
    for (const [paragraph, text] of chapter.paragraphs.entries()) {
      if (offset < text.length) return { index, paragraph, offset };
      offset -= text.length;
    }
  }
  return { index: 0, paragraph: 0, offset: 0 };
}
