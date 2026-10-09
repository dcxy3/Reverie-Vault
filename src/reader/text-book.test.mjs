import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, legacyTextPosition, splitTextChapters } from './text-book.mjs';
test('按章节和段落组织小说而不按屏幕切断正文', () => {
  const text = '长段落'.repeat(1000);
  const chapters = splitTextChapters({ content: `第一章 开始\r\n${text}\r\n第二章 继续\n正文` });
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].paragraphs[0], text);
  assert.equal(chapters[1].title, '第二章 继续');
});
test('文本内容转义，不能成为可执行 HTML', () => {
  assert.equal(escapeHtml('<script>"&</script>'), '&lt;script&gt;&quot;&amp;&lt;/script&gt;');
});
test('文件夹章节及 Markdown 标题可识别', () => {
  assert.deepEqual(splitTextChapters({ chapters: [{ title: '卷一', content: '# 起点\n正文' }, { title: '卷二', content: '更多正文' }] }).map(c => c.title), ['起点', '卷二']);
});
test('旧版固定页码转换为段落内文本位置', () => {
  const document = { content: '第一章 开始\n' + '文'.repeat(1600) + '\n第二章 继续\n后续正文' };
  assert.deepEqual(legacyTextPosition(document, 1), { index: 0, paragraph: 0, offset: 780 });
  assert.deepEqual(legacyTextPosition(document, 3), { index: 1, paragraph: 0, offset: 0 });
});
