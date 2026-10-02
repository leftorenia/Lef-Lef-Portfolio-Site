const projectUrl = new URL('../../', import.meta.url).href;
const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com']);
const shortYoutubeHosts = new Set(['youtu.be', 'www.youtu.be']);

// Convert only known provider URLs into players; other HTTPS URLs remain links.
export function resolveWorkVideo(source, options = {}) {
  if (typeof source !== 'string' || !source.trim()) return null;
  const input = source.trim();
  if (/^[\/\\]|\\|%2f|%5c/i.test(input)) return null;
  const base = options.projectUrl ?? projectUrl;
  const page = options.pageUrl ?? (typeof document !== 'undefined' ? document.baseURI : base);
  let url;
  try { url = new URL(input, page); } catch { return null; }
  const isLocal = url.origin === new URL(base).origin;
  const isAbsolute = /^[a-z][\w+.-]*:/i.test(input);
  if (url.username || url.password || (isAbsolute ? url.protocol !== 'https:' : !isLocal)) return null;
  if (!['https:', 'http:'].includes(url.protocol)) return null;

  const host = url.hostname;
  if (youtubeHosts.has(host) || shortYoutubeHosts.has(host)) {
    const path = url.pathname.split('/').filter(Boolean);
    const id = shortYoutubeHosts.has(host) ? (path.length === 1 ? path[0] : '')
      : url.pathname === '/watch' ? url.searchParams.get('v')
      : ['embed', 'shorts', 'live'].includes(path[0]) && path.length === 2 ? path[1] : '';
    if (!/^[\w-]{11}$/.test(id ?? '')) return null;
    return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${id}`, href: `https://www.youtube.com/watch?v=${id}` };
  }

  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const match = host === 'player.vimeo.com' ? /^\/video\/(\d+)\/?$/.exec(url.pathname)
      : /^\/(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/.exec(url.pathname);
    if (!match) return null;
    const hash = match[2] ?? url.searchParams.get('h');
    if (hash && !/^[a-zA-Z0-9]+$/.test(hash)) return null;
    return {
      kind: 'embed', src: `https://player.vimeo.com/video/${match[1]}${hash ? `?h=${hash}` : ''}`,
      href: `https://vimeo.com/${match[1]}${hash ? `/${hash}` : ''}`,
    };
  }

  if (isLocal) {
    if (!url.href.startsWith(base)) return null;
    const path = url.pathname.slice(new URL(base).pathname.length);
    if (!/^assets\/videos\/works\/[a-z0-9-]+\/[a-z0-9-]+\.(?:mp4|webm)$/i.test(path)) return null;
    return { kind: 'file', src: url.href, href: url.href };
  }
  if (/\.(?:mp4|webm)$/i.test(url.pathname)) return { kind: 'file', src: url.href, href: url.href };
  return { kind: 'link', href: url.href };
}

export function renderWorkVideo(section, options = {}) {
  const source = section.getAttribute('data-work-video-url') ?? '';
  const resolved = resolveWorkVideo(source, { pageUrl: section.ownerDocument.baseURI, ...options });
  const frame = section.querySelector('.work-video-frame');
  const link = section.querySelector('.work-video-source');
  if (!frame || !link) return false;
  if (!resolved) {
    frame.replaceChildren();
    section.hidden = true;
    link.hidden = true;
    section.setAttribute('data-work-video-ready', '');
    return false;
  }
  if (section.getAttribute('data-work-video-ready') === source) return true;

  frame.replaceChildren();
  frame.hidden = resolved.kind === 'link';
  const title = section.getAttribute('data-work-video-title') || '作品動画';
  if (resolved.kind !== 'link') {
    const player = section.ownerDocument.createElement(resolved.kind === 'file' ? 'video' : 'iframe');
    player.setAttribute('src', resolved.src);
    if (resolved.kind === 'file') {
      player.setAttribute('aria-label', title);
      player.setAttribute('controls', '');
      player.setAttribute('playsinline', '');
      player.setAttribute('preload', 'metadata');
      player.textContent = '動画を再生できない場合は、下のリンクから開いてください。';
    } else {
      player.setAttribute('title', title);
      player.setAttribute('loading', 'lazy');
      player.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      player.setAttribute('allow', 'fullscreen; picture-in-picture; encrypted-media');
      player.setAttribute('allowfullscreen', '');
    }
    frame.append(player);
  }
  link.setAttribute('href', resolved.href);
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener noreferrer');
  link.textContent = resolved.kind === 'file' ? '動画ファイルを開く ↗' : '動画を元のサイトで開く ↗';
  link.hidden = false;
  section.hidden = false;
  section.setAttribute('data-work-video-ready', source);
  return true;
}

export function bootWorkMedia(root = typeof document !== 'undefined' ? document : undefined, options = {}) {
  if (!root?.querySelectorAll) return 0;
  return [...root.querySelectorAll('[data-work-video-url]')]
    .reduce((count, section) => count + Number(renderWorkVideo(section, options)), 0);
}

if (typeof document !== 'undefined') {
  const start = () => bootWorkMedia(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
