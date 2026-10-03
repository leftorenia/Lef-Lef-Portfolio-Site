import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

// Simulate the documented copy-and-replace workflow, without publishing a dummy work.
export function createWorkTemplateFixture({ slug = 'aurora-study', title = 'AURORA STUDY', videoUrl = '' } = {}) {
  const fields = {
    SLUG: slug, TITLE: title, SUMMARY: '青い光と粒子による表現の研究。',
    CATCHPHRASE_LINE_1: '光の向こうに、新しい世界。',
    CATCHPHRASE_LINE_2: '粒子で描く、ひとときの風景。',
    DESCRIPTION_LINE_1: '作品の概要です。', DESCRIPTION_LINE_2: '体験の説明です。',
    DESCRIPTION_LINE_3: '制作の工夫です。', DESCRIPTION_LINE_4: '作品の補足です。',
    COVER_WIDTH: '1920', COVER_HEIGHT: '1072', COVER_ALT: '青い光に包まれる人物',
    IMAGE_01_WIDTH: '1920', IMAGE_01_HEIGHT: '1080', IMAGE_01_ALT: '青い粒子の表現', IMAGE_01_CAPTION: 'BLUE LIGHT',
    IMAGE_02_WIDTH: '1920', IMAGE_02_HEIGHT: '1080', IMAGE_02_ALT: '紫の粒子の表現', IMAGE_02_CAPTION: 'VIOLET LIGHT',
    TECHNOLOGY_1: 'UNITY', TECHNOLOGY_2: 'SHADER', WORK_NUMBER: 'W.003', CATEGORY: 'VFX STUDY',
  };
  function fill(file) {
    const path = join(root, 'docs/templates', file);
    assert.ok(existsSync(path), `copy source is missing: docs/templates/${file}`);
    return readFileSync(path, 'utf8').replace(/\{\{([A-Z0-9_]+)\}\}/g, (token, key) => {
      assert.ok(Object.hasOwn(fields, key), `unknown replacement field: ${token}`);
      return fields[key];
    });
  }
  const detail = fill('work-detail.html').replace('data-work-video-url=""', `data-work-video-url="${videoUrl}"`);
  const card = fill('work-card.html');
  const directory = mkdtempSync(join(tmpdir(), 'lef-work-template-'));
  for (const file of ['index.html', 'about.html', 'contact.html']) cpSync(join(root, file), join(directory, file));
  for (const folder of ['assets', 'works']) cpSync(join(root, folder), join(directory, folder), { recursive: true });
  const pageDirectory = join(directory, 'works', slug);
  const images = join(directory, 'assets/images/works', slug);
  mkdirSync(pageDirectory, { recursive: true });
  mkdirSync(images, { recursive: true });
  for (const [source, target] of [['cover.jpg', 'cover.jpg'], ['blue-effects.jpg', 'detail-01.jpg'], ['cosmo-effects.jpg', 'detail-02.jpg']]) {
    cpSync(join(root, 'assets/images/works/immersnap', source), join(images, target));
  }
  if (videoUrl.startsWith('../../assets/videos/works/')) {
    const videoPath = join(directory, 'assets/videos/works', slug);
    mkdirSync(videoPath, { recursive: true });
    writeFileSync(join(videoPath, 'demo.mp4'), 'test-only video URL fixture');
  }
  writeFileSync(join(pageDirectory, 'index.html'), detail);
  const works = readFileSync(join(root, 'works.html'), 'utf8')
    .replace(/(<section\b[^>]*class="works-grid"[^>]*>)/, `$1\n${card}`);
  writeFileSync(join(directory, 'works.html'), works);
  return { directory, detail, card, works };
}
