(() => {
  if (window.__msubLoaded) return;
  window.__msubLoaded = true;

  // ================= Settings =================
  const LS = 'msub-settings-v1';
  const COLORS = ['#ffffff', '#ffd54a', '#7be0ff', '#a5ff8a', '#ff9ecb'];
  const MAX_LANGS = 4;
  const FALLBACK = [
    ['en', 'English'], ['fa', 'فارسی'], ['ar', 'العربية'], ['tr', 'Türkçe'], ['ru', 'Русский'],
    ['de', 'Deutsch'], ['fr', 'Français'], ['es', 'Español'], ['it', 'Italiano'], ['pt', 'Português'],
    ['zh-Hans', '中文 (简体)'], ['zh-Hant', '中文 (繁體)'], ['ja', '日本語'], ['ko', '한국어'],
    ['hi', 'हिन्दी'], ['ur', 'اردو'], ['id', 'Indonesia'], ['nl', 'Nederlands'], ['pl', 'Polski'],
    ['uk', 'Українська'], ['he', 'עברית'], ['sv', 'Svenska'], ['th', 'ไทย'], ['vi', 'Tiếng Việt'],
    ['tg', 'Тоҷикӣ'], ['uz', 'Oʻzbek'], ['az', 'Azərbaycan'], ['ku', 'Kurdî'], ['ps', 'پښتو']
  ];

  let S = { enabled: true, langs: [], size: 22, offset: 12, hideNative: true };
  try { Object.assign(S, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };

  // ================= Capture YouTube's own timedtext request (for the "pot" token) =================
  const _fetch = window.fetch.bind(window);
  let cap = null;

  function noteUrl(u) {
    try {
      if (!u) return;
      u = String(u);
      if (!u.includes('/api/timedtext')) return;
      const url = new URL(u, location.href);
      const pot = url.searchParams.get('pot');
      if (pot && (!cap || cap.searchParams.get('pot') !== pot)) {
        cap = url;
        setTimeout(retryErrors, 300);
      }
    } catch (e) {}
  }
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { noteUrl(u); return _open.apply(this, arguments); };
  window.fetch = function (input) {
    try { noteUrl(input instanceof Request ? input.url : input); } catch (e) {}
    return _fetch.apply(window, arguments);
  };

  // ================= Player data =================
  const txt = o => !o ? '' : (o.simpleText || (o.runs || []).map(r => r.text).join('') || '');

  function playerResponse() {
    const p = document.getElementById('movie_player');
    try { if (p && p.getPlayerResponse) return p.getPlayerResponse(); } catch (e) {}
    return window.ytInitialPlayerResponse;
  }
  function trackList() {
    const pr = playerResponse();
    const r = pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer;
    return {
      tracks: (r && r.captionTracks) || [],
      tlangs: (r && r.translationLanguages) || [],
      vid: pr && pr.videoDetails && pr.videoDetails.videoId
    };
  }
  function allLangs() {
    const { tracks, tlangs } = trackList();
    const map = new Map();
    tracks.forEach(t => map.set(t.languageCode, txt(t.name) || t.languageCode));
    (tlangs.length ? tlangs.map(l => [l.languageCode, txt(l.languageName)]) : FALLBACK)
      .forEach(([c, n]) => { if (!map.has(c)) map.set(c, n || c); });
    return map;
  }

  // ================= Loading subtitles =================
  const data = {};     // lang -> cues
  const states = {};   // lang -> 'loading' | 'ok' | 'err'
  const lastTry = {};
  let statusMsg = '';
  let curVid = null;

  async function loadLang(code) {
    const { tracks } = trackList();
    if (!tracks.length) throw new Error('no-captions');

    const pick = list => list.find(t => t.kind !== 'asr') || list[0];
    let native = pick(tracks.filter(t => t.languageCode === code));
    if (!native && !code.includes('-')) {
      native = pick(tracks.filter(t => t.languageCode.split('-')[0] === code));
    }
    const base = native || tracks.find(t => t.kind !== 'asr') || tracks[0];

    const url = new URL(base.baseUrl);
    url.searchParams.set('fmt', 'json3');
    if (!native) url.searchParams.set('tlang', code);
    if (cap) {
      for (const k of ['pot', 'potc', 'c', 'cver', 'cplayer', 'cbr', 'cbrver', 'cos', 'cosver', 'cplatform']) {
        const v = cap.searchParams.get(k);
        if (v !== null) url.searchParams.set(k, v);
      }
    }

    const res = await _fetch(url.href, { credentials: 'include' });
    const body = await res.text();
    if (!body) throw new Error('empty');
    const j = JSON.parse(body);

    const cues = [];
    for (const ev of j.events || []) {
      if (!ev.segs) continue;
      const text = ev.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const s = (ev.tStartMs || 0) / 1000;
      cues.push({ s, e: s + (ev.dDurationMs || 2000) / 1000, text });
    }
    cues.sort((a, b) => a.s - b.s);
    for (let i = 0; i < cues.length - 1; i++) {
      if (cues[i].e > cues[i + 1].s) cues[i].e = cues[i + 1].s;
    }
    if (!cues.length) throw new Error('empty');
    return cues;
  }

  function ensureLoaded() {
    if (!curVid) return;
    for (const c of S.langs) {
      if (data[c] || states[c] === 'loading') continue;
      if (states[c] === 'err' && Date.now() - (lastTry[c] || 0) < 8000) continue;
      states[c] = 'loading';
      lastTry[c] = Date.now();
      const vid = curVid;
      loadLang(c).then(cues => {
        if (vid !== curVid) return;
        data[c] = cues; states[c] = 'ok'; statusMsg = '';
      }).catch(e => {
        if (vid !== curVid) return;
        states[c] = 'err';
        statusMsg = e.message === 'no-captions'
          ? 'این ویدیو زیرنویس ندارد.'
          : 'یوتیوب دریافت زیرنویس رو قبول نکرد. یک بار دکمه CC خود یوتیوب رو روشن کن؛ بعدش خودکار دوباره تلاش می‌کنم.';
      }).finally(refreshPanel);
    }
    refreshPanel();
  }
  function retryErrors() {
    S.langs.forEach(c => { if (states[c] === 'err') { delete states[c]; delete lastTry[c]; } });
    ensureLoaded();
  }
  function resetForVideo() {
    for (const k of Object.keys(data)) delete data[k];
    for (const k of Object.keys(states)) delete states[k];
    for (const k of Object.keys(lastTry)) delete lastTry[k];
    statusMsg = ''; lastKey = '';
  }

  // ================= Overlay rendering =================
  let overlay = null;
  let lastKey = '';

  function active(cues, t) {
    let lo = 0, hi = cues.length - 1, idx = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (cues[m].s <= t) { idx = m; lo = m + 1; } else hi = m - 1;
    }
    return idx >= 0 && cues[idx].e > t ? cues[idx].text : '';
  }

  function ensureOverlay(player) {
    if (overlay && overlay.isConnected && overlay.parentNode === player) return;
    overlay = document.createElement('div');
    overlay.id = 'msub-overlay';
    player.appendChild(overlay);
    lastKey = '';
  }

  function render() {
    const player = document.getElementById('movie_player');
    const v = player && player.querySelector('video');
    if (!v) return;
    ensureOverlay(player);
    player.classList.toggle('msub-hide-native', S.enabled && S.hideNative && S.langs.length > 0);

    const fs = S.size * Math.max(0.6, player.clientHeight / 540);
    const t = v.currentTime;
    const texts = S.enabled ? S.langs.map(c => (data[c] ? active(data[c], t) : '')) : [];
    const key = texts.join('\u0001') + '|' + fs.toFixed(1) + '|' + S.offset + '|' + S.langs.join(',');
    if (key === lastKey) return;
    lastKey = key;

    overlay.style.fontSize = fs + 'px';
    overlay.style.bottom = S.offset + '%';
    overlay.textContent = '';
    texts.forEach((tx, i) => {
      if (!tx) return;
      const d = document.createElement('div');
      const sp = document.createElement('span');
      sp.className = 'msub-line';
      sp.dir = 'auto';
      sp.style.color = COLORS[i % COLORS.length];
      sp.textContent = tx;
      d.appendChild(sp);
      overlay.appendChild(d);
    });
  }
  (function loop() {
    try { render(); } catch (e) {}
    requestAnimationFrame(loop);
  })();

  // ================= UI =================
  const CSS = `
  .msub-hide-native .ytp-caption-window-container{display:none!important}
  #msub-overlay{position:absolute;left:4%;right:4%;text-align:center;pointer-events:none;z-index:59;font-family:Tahoma,Roboto,Arial,sans-serif}
  .msub-line{display:inline-block;background:rgba(8,8,8,.78);padding:2px 10px;margin:2px 0;border-radius:4px;line-height:1.45;text-shadow:0 1px 2px #000;unicode-bidi:plaintext}
  #msub-panel{display:none;position:absolute;top:12px;right:12px;width:310px;max-height:82%;overflow:auto;z-index:70;
    background:rgba(24,24,27,.97);color:#eee;border-radius:14px;padding:12px 14px;font:13px/1.5 Tahoma,Arial,sans-serif;direction:rtl;text-align:right;
    box-shadow:0 8px 30px rgba(0,0,0,.6);cursor:default}
  #msub-panel *{box-sizing:border-box;font-family:inherit}
  #msub-panel .mp-head{display:flex;justify-content:space-between;align-items:center;font-size:15px;margin-bottom:6px}
  #msub-panel .mp-sec{margin:12px 0 6px;color:#9aa0a6;font-size:12px}
  #msub-panel button{background:#3a3a3f;color:#eee;border:0;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:12px}
  #msub-panel button:hover{background:#505057}
  #msub-panel .mp-row{display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:8px;background:#2a2a2e;margin-bottom:4px}
  #msub-panel .mp-row .nm{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  #msub-panel .dot{width:10px;height:10px;border-radius:50%;flex:none}
  #msub-panel .mp-add{cursor:pointer;background:transparent;border-bottom:1px solid #333;border-radius:0;margin:0}
  #msub-panel .mp-add:hover{background:#2f2f34}
  #msub-panel .tag{font-size:10px;color:#8ab4f8}
  #msub-panel input[type=text]{width:100%;padding:7px 10px;border-radius:8px;border:1px solid #444;background:#1b1b1e;color:#eee;margin-bottom:6px}
  #msub-panel #mp-list{max-height:170px;overflow:auto;border-radius:8px;background:#222226}
  #msub-panel label{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0}
  #msub-panel input[type=range]{width:150px}
  #msub-panel #mp-msg{margin-top:10px;color:#ffb74d;font-size:12px}
  #msub-panel .empty{color:#777;padding:6px}
  `;

  // DOM helper (YouTube enforces Trusted Types, so innerHTML is NOT allowed)
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
      for (const k of Object.keys(props)) {
        if (k === 'class') e.className = props[k];
        else if (k === 'style') e.style.cssText = props[k];
        else if (k.startsWith('on')) e[k] = props[k];
        else e.setAttribute(k, props[k]);
      }
    }
    kids.flat().forEach(c => { if (c !== null && c !== undefined) e.append(c); });
    return e;
  }

  let panel = null;
  let query = '';

  function buildPanel(player) {
    if (panel && panel.isConnected) return;

    const inEn = h('input', { type: 'checkbox', id: 'mp-en' });
    const inSize = h('input', { type: 'range', id: 'mp-size', min: '12', max: '44' });
    const inOff = h('input', { type: 'range', id: 'mp-off', min: '3', max: '40' });
    const inHide = h('input', { type: 'checkbox', id: 'mp-hide' });
    const inQ = h('input', { type: 'text', id: 'mp-q', placeholder: 'جستجوی زبان...' });
    const btnClose = h('button', { id: 'mp-close' }, '✕');

    panel = h('div', { id: 'msub-panel' },
      h('div', { class: 'mp-head' }, h('b', null, '🌐 زیرنویس چندزبانه'), btnClose),
      h('label', null, h('span', null, 'فعال'), inEn),
      h('div', { class: 'mp-sec' }, `زیرنویس‌های انتخاب‌شده (حداکثر ${MAX_LANGS})`),
      h('div', { id: 'mp-sel' }),
      h('div', { class: 'mp-sec' }, 'افزودن زبان'),
      inQ,
      h('div', { id: 'mp-list' }),
      h('div', { class: 'mp-sec' }, 'تنظیمات'),
      h('label', null, h('span', null, 'اندازه متن'), inSize),
      h('label', null, h('span', null, 'فاصله از پایین'), inOff),
      h('label', null, h('span', null, 'مخفی کردن زیرنویس خود یوتیوب'), inHide),
      h('div', { id: 'mp-msg' })
    );
    player.appendChild(panel);

    ['click', 'dblclick', 'mousedown', 'mouseup', 'contextmenu', 'keydown', 'keyup', 'keypress', 'wheel'].forEach(ev =>
      panel.addEventListener(ev, e => e.stopPropagation()));

    btnClose.onclick = () => (panel.style.display = 'none');
    inEn.onchange = e => { S.enabled = e.target.checked; save(); lastKey = ''; };
    inSize.oninput = e => { S.size = +e.target.value; save(); };
    inOff.oninput = e => { S.offset = +e.target.value; save(); };
    inHide.onchange = e => { S.hideNative = e.target.checked; save(); };
    inQ.oninput = e => { query = e.target.value.trim().toLowerCase(); renderList(); };
    syncControls();
  }

  function syncControls() {
    if (!panel) return;
    panel.querySelector('#mp-en').checked = S.enabled;
    panel.querySelector('#mp-size').value = S.size;
    panel.querySelector('#mp-off').value = S.offset;
    panel.querySelector('#mp-hide').checked = S.hideNative;
  }

  function renderSelected() {
    const box = panel.querySelector('#mp-sel');
    const names = allLangs();
    box.textContent = '';
    if (!S.langs.length) {
      box.append(h('div', { class: 'empty' }, 'هنوز زبانی انتخاب نشده. از لیست پایین اضافه کن.'));
      return;
    }
    S.langs.forEach((c, i) => {
      const st = states[c] === 'ok' ? '✓' : states[c] === 'err' ? '⚠️' : '⏳';
      box.append(h('div', { class: 'mp-row' },
        h('span', { class: 'dot', style: 'background:' + COLORS[i % COLORS.length] }),
        h('span', { class: 'nm' }, names.get(c) || c),
        h('span', null, st),
        h('button', { onclick: () => move(i, -1) }, '↑'),
        h('button', { onclick: () => move(i, 1) }, '↓'),
        h('button', { onclick: () => { S.langs.splice(i, 1); save(); lastKey = ''; refreshPanel(); } }, '✕')
      ));
    });
  }
  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= S.langs.length) return;
    [S.langs[i], S.langs[j]] = [S.langs[j], S.langs[i]];
    save(); lastKey = ''; refreshPanel();
  }

  function renderList() {
    const box = panel.querySelector('#mp-list');
    const { tracks } = trackList();
    const nativeSet = new Set(tracks.map(t => t.languageCode));
    box.textContent = '';
    let n = 0;
    for (const [c, name] of allLangs()) {
      if (S.langs.includes(c)) continue;
      if (query && !name.toLowerCase().includes(query) && !c.toLowerCase().includes(query)) continue;
      box.append(h('div', {
        class: 'mp-row mp-add',
        onclick: () => {
          if (S.langs.length >= MAX_LANGS) { statusMsg = `حداکثر ${MAX_LANGS} زیرنویس می‌تونی انتخاب کنی.`; refreshPanel(); return; }
          S.langs.push(c); save(); statusMsg = ''; lastKey = ''; ensureLoaded(); refreshPanel();
        }
      }, h('span', { class: 'nm' }, name), h('span', { class: 'tag' }, nativeSet.has(c) ? 'اصلی' : 'ترجمه خودکار')));
      n++;
    }
    if (!n) box.append(h('div', { class: 'empty' }, 'موردی پیدا نشد.'));
  }

  function refreshPanel() {
    if (!panel || !panel.isConnected || panel.style.display !== 'block') return;
    renderSelected();
    renderList();
    panel.querySelector('#mp-msg').textContent = statusMsg;
  }

  function togglePanel() {
    const player = document.getElementById('movie_player');
    if (!player) return;
    buildPanel(player);
    const open = panel.style.display === 'block';
    panel.style.display = open ? 'none' : 'block';
    if (!open) { syncControls(); refreshPanel(); }
  }

  function ensureButton() {
    const player = document.getElementById('movie_player');
    if (!player) return;

    if (!document.getElementById('msub-style')) {
      const st = document.createElement('style');
      st.id = 'msub-style';
      st.textContent = CSS;
      document.documentElement.appendChild(st);
    }
    if (document.getElementById('msub-btn')) return;

    const btn = h('button', {
      id: 'msub-btn', class: 'ytp-button', title: 'زیرنویس چندزبانه',
      style: 'width:48px;font-size:19px;text-align:center;opacity:.95;cursor:pointer',
      onclick: e => { e.stopPropagation(); togglePanel(); }
    }, '🌐');

    const bar = player.querySelector('.ytp-right-controls');
    if (bar) {
      bar.insertBefore(btn, bar.firstChild);
    } else {
      // fallback: floating button
      btn.style.cssText = 'position:absolute;top:10px;left:10px;z-index:71;width:40px;height:40px;font-size:20px;background:rgba(0,0,0,.6);border-radius:50%;border:0;cursor:pointer';
      player.appendChild(btn);
    }
  }

  // ================= Main tick (handles YouTube SPA navigation) =================
  setInterval(() => {
    try {
      ensureButton();
      const { vid } = trackList();
      if (vid && vid !== curVid) { curVid = vid; resetForVideo(); }
      ensureLoaded();
    } catch (e) { console.warn('[Multi Subs]', e); }
  }, 1000);
})();
