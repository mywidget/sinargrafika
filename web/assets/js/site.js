/* Panduan PrintPro POS — interaksi situs panduan. */
(() => {
  const html = document.documentElement;
  const body = document.body;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------------------------------------------------------- theme */
  const stored = localStorage.getItem('pp-theme');
  if (stored) html.dataset.theme = stored;
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches) html.dataset.theme = 'dark';

  const toggleTheme = () => {
    html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pp-theme', html.dataset.theme);
  };
  $$('[data-theme-toggle], #themeBtn').forEach((b) => b.addEventListener('click', toggleTheme));

  /* --------------------------------------------------------------- drawer */
  const menuBtn = $('#menuBtn');
  const scrim = $('#scrim');
  const closeNav = () => {
    body.classList.remove('nav-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    if (scrim) scrim.hidden = true;
  };
  if (menuBtn)
    menuBtn.addEventListener('click', () => {
      const open = body.classList.toggle('nav-open');
      menuBtn.setAttribute('aria-expanded', String(open));
      if (scrim) scrim.hidden = !open;
    });
  if (scrim) scrim.addEventListener('click', closeNav);
  $$('.nav-sub a, .nav-link').forEach((a) => a.addEventListener('click', closeNav));

  /* ------------------------------------------------------------- progress */
  const bar = $('#progress');
  const onScroll = () => {
    if (!bar) return;
    const max = html.scrollHeight - html.clientHeight;
    bar.style.width = `${max > 0 ? Math.min(100, (html.scrollTop / max) * 100) : 0}%`;
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------- scrollspy */
  const tocLinks = $$('.toc a[data-toc]');
  if (tocLinks.length) {
    const map = new Map(tocLinks.map((a) => [a.dataset.toc, a]));
    const heads = $$('main [id]').filter((h) => map.has(h.id));
    const setCurrent = (id) => {
      tocLinks.forEach((a) => a.classList.toggle('is-current', a.dataset.toc === id));
    };
    const spy = () => {
      let active = heads.length ? heads[0].id : null;
      for (const h of heads) {
        if (h.getBoundingClientRect().top <= 120) active = h.id;
        else break;
      }
      setCurrent(active);
    };
    document.addEventListener('scroll', spy, { passive: true });
    spy();
  }

  /* -------------------------------------------------------------- palette */
  const palette = $('#palette');
  const input = $('#q');
  const results = $('#results');
  const meta = $('#paletteMeta');
  let items = [];
  let loaded = null;
  let cursor = 0;

  const normalize = (s) =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

  const loadIndex = async () => {
    if (loaded) return loaded;
    loaded = fetch('search-index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        data.forEach((d) => {
          d.h = normalize(`${d.t} ${d.b}`);
          d.xn = normalize(d.x);
        });
        return data;
      })
      .catch(() => []);
    return loaded;
  };

  const snippet = (entry, terms) => {
    const text = entry.x;
    let at = -1;
    for (const t of terms) {
      const i = normalize(text).indexOf(t);
      if (i >= 0 && (at < 0 || i < at)) at = i;
    }
    if (at < 0) return text.slice(0, 170);
    const start = Math.max(0, at - 60);
    return `${start > 0 ? '…' : ''}${text.slice(start, start + 190)}…`;
  };

  const markIt = (text, terms) => {
    let out = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    for (const t of terms) {
      if (t.length < 2) continue;
      const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    }
    return out;
  };

  const search = (raw) => {
    const terms = normalize(raw).split(' ').filter((t) => t.length >= 2);
    if (!terms.length) return [];
    return items
      .map((d) => {
        let score = 0;
        for (const t of terms) {
          if (d.h.startsWith(t)) score += 12;
          else if (d.h.includes(t)) score += 7;
          const hits = d.xn.split(t).length - 1;
          score += Math.min(hits, 4) * 2;
        }
        return { d, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.d.n - b.d.n)
      .slice(0, 14)
      .map((r) => r.d);
  };

  const render = (raw) => {
    const terms = normalize(raw).split(' ').filter((t) => t.length >= 2);
    const found = search(raw);
    cursor = 0;
    if (!raw.trim()) {
      meta.textContent = `${items.length} bagian panduan · ketik untuk mencari`;
      results.innerHTML = '';
      return;
    }
    meta.textContent = found.length ? `${found.length} hasil untuk “${raw.trim()}”` : '';
    results.innerHTML = found.length
      ? found
          .map(
            (d, i) => `<li><button type="button" class="result${i === 0 ? ' is-active' : ''}" data-url="${d.u}">
              <span class="result-b">Bab ${String(d.n).padStart(2, '0')}</span>
              <span><span class="result-t">${markIt(d.t, terms)}</span>
              <span class="result-x">${markIt(snippet(d, terms), terms)}</span></span>
            </button></li>`,
          )
          .join('')
      : `<li><p class="result-empty">Tidak ada bagian yang cocok dengan “${raw.trim()}”. Coba kata kunci lain, misalnya <em>DP</em>, <em>piutang</em>, <em>opname</em>, <em>kiosk</em>, atau <em>surat jalan</em>.</p></li>`;
  };

  const move = (delta) => {
    const opts = $$('.result', results);
    if (!opts.length) return;
    cursor = (cursor + delta + opts.length) % opts.length;
    opts.forEach((o, i) => o.classList.toggle('is-active', i === cursor));
    opts[cursor].scrollIntoView({ block: 'nearest' });
  };

  const openPalette = async () => {
    if (!palette) return;
    palette.hidden = false;
    body.style.overflow = 'hidden';
    items = await loadIndex();
    if (input) {
      input.value = '';
      input.focus();
    }
    meta.textContent = `${items.length} bagian panduan · ketik untuk mencari`;
    results.innerHTML = '';
  };

  const closePalette = () => {
    if (!palette) return;
    palette.hidden = true;
    body.style.overflow = '';
  };

  ['searchTrigger', 'searchBtn', 'searchTriggerHome'].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', openPalette);
  });

  if (input) {
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => render(input.value), 90);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') {
        const pick = $$('.result', results)[cursor];
        if (pick) window.location.href = pick.dataset.url;
      }
    });
  }

  if (results)
    results.addEventListener('click', (e) => {
      const btn = e.target.closest('.result');
      if (btn) window.location.href = btn.dataset.url;
    });

  if (palette)
    palette.addEventListener('click', (e) => {
      if (e.target === palette) closePalette();
    });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (palette && palette.hidden) openPalette();
      else closePalette();
    } else if (e.key === 'Escape') {
      closePalette();
      closeLightbox();
      closeNav();
    }
  });

  /* -------------------------------------------------------------- lightbox */
  const box = $('#lightbox');
  const lbImg = $('#lbImg');
  const lbCap = $('#lbCaption');
  let shots = [];
  let lbIndex = 0;

  const showShot = (i) => {
    if (!box || !shots.length) return;
    lbIndex = (i + shots.length) % shots.length;
    const img = shots[lbIndex];
    lbImg.src = img.src;
    lbImg.alt = img.alt || '';
    const cap = img.parentElement.querySelector('figcaption');
    lbCap.textContent = cap ? cap.textContent : img.alt || '';
  };

  function closeLightbox() {
    if (!box || box.hidden) return;
    box.hidden = true;
    body.style.overflow = '';
  }

  const openLightbox = (img) => {
    if (!box) return;
    shots = $$('figure.shot img');
    box.hidden = false;
    body.style.overflow = 'hidden';
    showShot(shots.indexOf(img));
  };

  $$('figure.shot img').forEach((img) => {
    img.tabIndex = 0;
    img.addEventListener('click', () => openLightbox(img));
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(img); }
    });
  });

  const lbClose = $('#lbClose');
  const lbPrev = $('#lbPrev');
  const lbNext = $('#lbNext');
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbPrev) lbPrev.addEventListener('click', () => showShot(lbIndex - 1));
  if (lbNext) lbNext.addEventListener('click', () => showShot(lbIndex + 1));
  if (box)
    box.addEventListener('click', (e) => {
      if (e.target === box) closeLightbox();
    });
  document.addEventListener('keydown', (e) => {
    if (!box || box.hidden) return;
    if (e.key === 'ArrowLeft') showShot(lbIndex - 1);
    if (e.key === 'ArrowRight') showShot(lbIndex + 1);
  });

  /* ------------------------------------------------- prev/next bab shortcuts */
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || (palette && !palette.hidden) || (box && !box.hidden)) return;
    const sel = e.key === 'ArrowLeft' ? '.pager-link:not(.pager-next)' : '.pager-next';
    const link = $(sel);
    if (link) window.location.href = link.getAttribute('href');
  });

  /* ----------------------------------------------------------- deep links */
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }
})();
