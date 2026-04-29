(function () {
  'use strict';

  const isTypingTarget = (el) => {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  };

  const ago = (date) => {
    const t = (Date.now() - date.getTime()) / 1000;
    if (t < 60) return Math.max(0, Math.floor(t)) + 's';
    if (t < 3600) return Math.floor(t / 60) + 'm';
    if (t < 86400) return Math.floor(t / 3600) + 'h';
    return Math.floor(t / 86400) + 'd';
  };
  const agoLong = (date) => ago(date) + ' ago';

  const STATUS_TOKEN = {
    Completed: 'completed', Running: 'running', Started: 'running',
    Failed: 'failed', Scheduled: 'scheduled', Recurring: 'scheduled',
    Cancelled: 'warning'
  };
  const STATUS_LABEL = {
    Completed: 'completed', Running: 'running', Started: 'running',
    Failed: 'failed', Scheduled: 'scheduled', Recurring: 'recurring',
    Cancelled: 'cancelled', Pending: 'pending'
  };
  const STATUS_SHORT = {
    Completed: 'ok', Running: 'run', Started: 'run',
    Failed: 'fail', Scheduled: 'sch', Recurring: 'rec', Cancelled: 'cnl'
  };

  // ---------- Command palette ----------------------------------
  // Universal ⌘K palette: navigate, search, launch saved scripts, and (admin only)
  // run ad-hoc PowerShell with `> snippet`. Output streams in place via the same
  // typed-segment renderer used on Details. Lazy-loads its data on first open.

  const paletteEl = document.querySelector('[data-palette]');
  const paletteIsAdmin = paletteEl && paletteEl.getAttribute('data-palette-admin') === 'true';

  const paletteState = {
    loaded: false,
    data: null,            // { recents: [...], scripts: [...] }
    activeIndex: 0,
    visibleRows: [],       // current navigable row data, in DOM order
    mode: 'search',        // 'search' | 'adhoc'
    runningJobId: null,    // when ad-hoc is running
    pollHandle: null,
  };

  const paletteInput   = paletteEl && paletteEl.querySelector('[data-palette-input]');
  const paletteCaret   = paletteEl && paletteEl.querySelector('[data-palette-caret]');
  const palettePs      = paletteEl && paletteEl.querySelector('[data-palette-powershell]');
  const paletteBody    = paletteEl && paletteEl.querySelector('[data-palette-body]');
  const paletteSect    = paletteEl && paletteEl.querySelector('[data-palette-sections]');
  const paletteOutput  = paletteEl && paletteEl.querySelector('[data-palette-output]');
  const paletteLoading = paletteEl && paletteEl.querySelector('[data-palette-loading]');
  const paletteHint    = paletteEl && paletteEl.querySelector('[data-palette-hint]');

  function openPalette() {
    if (!paletteEl) return;
    if (!paletteEl.hasAttribute('hidden')) return; // already open
    paletteEl.removeAttribute('hidden');
    paletteEl.setAttribute('aria-hidden', 'false');
    if (!paletteState.loaded) {
      loadPaletteData();
    } else {
      renderPaletteSections('');
    }
    setPaletteMode('search');
    paletteInput.value = '';
    paletteInput.focus();
  }

  function closePalette() {
    if (!paletteEl || paletteEl.hasAttribute('hidden')) return;
    if (paletteState.pollHandle) {
      clearInterval(paletteState.pollHandle);
      paletteState.pollHandle = null;
    }
    paletteEl.setAttribute('hidden', '');
    paletteEl.setAttribute('aria-hidden', 'true');
    paletteEl.classList.remove('is-adhoc');
  }

  async function loadPaletteData() {
    if (!paletteLoading || !paletteSect) return;
    paletteLoading.removeAttribute('hidden');
    paletteSect.setAttribute('hidden', '');
    try {
      const res = await fetch('/Home/PaletteData', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('palette data ' + res.status);
      paletteState.data = await res.json();
      paletteState.loaded = true;
    } catch (_) {
      paletteState.data = { recents: [], scripts: [] };
      paletteState.loaded = true;
    } finally {
      paletteLoading.setAttribute('hidden', '');
      paletteSect.removeAttribute('hidden');
      renderPaletteSections('');
    }
  }

  function setPaletteMode(mode) {
    paletteState.mode = mode;
    if (mode === 'adhoc') {
      paletteEl.classList.add('is-adhoc');
      paletteInput.setAttribute('hidden', '');
      paletteCaret.textContent = '›';
      palettePs.removeAttribute('hidden');
      palettePs.value = '';
      palettePs.focus();
      paletteSect.setAttribute('hidden', '');
      paletteOutput.setAttribute('hidden', '');
      paletteOutput.innerHTML = '';
      paletteHint.innerHTML =
        '<kbd class="accent">⇧↵</kbd> run · <kbd>esc</kbd> cancel · <span class="accent">admin</span> · runs on this host';
    } else {
      paletteEl.classList.remove('is-adhoc');
      paletteInput.removeAttribute('hidden');
      paletteCaret.textContent = '›';
      palettePs.setAttribute('hidden', '');
      paletteSect.removeAttribute('hidden');
      paletteOutput.setAttribute('hidden', '');
      paletteHint.innerHTML = '<kbd>↑↓</kbd> move · <kbd>↵</kbd> open · <kbd>esc</kbd> close';
    }
  }

  function renderPaletteSections(query) {
    if (!paletteSect || !paletteState.data) return;
    const q = (query || '').trim().toLowerCase();
    const data = paletteState.data;

    let recents = data.recents || [];
    let scripts = data.scripts || [];
    if (q) {
      recents = recents.filter((r) => (r.name || '').toLowerCase().includes(q));
      scripts = scripts.filter((s) => (s.name || '').toLowerCase().includes(q)
                                  || (s.category || '').toLowerCase().includes(q));
    }

    const actions = paletteIsAdmin
      ? [
          { kind: 'action', glyph: '+', label: 'new script…',     href: '/PowerShell/Create' },
          { kind: 'action', glyph: '@', label: 'manage users…',   href: '/Admin/UserList' },
          { kind: 'action', glyph: '◇', label: 'manage categories…', href: '/Admin/CategoryList' },
          { kind: 'action', glyph: '⌗', label: 'open audit',      href: '/Scripts/Jobs' },
        ].filter((a) => !q || a.label.toLowerCase().includes(q))
      : [
          { kind: 'action', glyph: '⌗', label: 'open audit',      href: '/Scripts/Jobs' },
        ];

    paletteState.visibleRows = [];
    let html = '';

    if (recents.length) {
      html += '<div class="palette__section"><span class="palette__section-label">recent</span>';
      recents.forEach((r) => {
        const idx = paletteState.visibleRows.length;
        paletteState.visibleRows.push({ kind: 'launch', id: r.id, name: r.name });
        html += rowHtml(idx, '▶', r.name, `${r.count}× last 7d`, '↵');
      });
      html += '</div>';
    }

    if (scripts.length) {
      html += '<div class="palette__section"><span class="palette__section-label">scripts</span>';
      scripts.forEach((s) => {
        const idx = paletteState.visibleRows.length;
        paletteState.visibleRows.push({ kind: 'open', id: s.id, name: s.name });
        html += rowHtml(idx, ' ', s.name, s.category || '', '↵');
      });
      html += '</div>';
    }

    if (actions.length) {
      html += '<div class="palette__section"><span class="palette__section-label">actions</span>';
      actions.forEach((a) => {
        const idx = paletteState.visibleRows.length;
        paletteState.visibleRows.push({ kind: 'nav', href: a.href, name: a.label });
        html += rowHtml(idx, a.glyph, a.label, '', '↵');
      });
      html += '</div>';
    }

    if (paletteState.visibleRows.length === 0) {
      const tip = paletteIsAdmin
        ? 'no matches — type <kbd>&gt;</kbd> to run powershell'
        : 'no matches — try a different keyword';
      html = '<div class="palette__empty">' + tip + '</div>';
    }

    paletteSect.innerHTML = html;
    paletteState.activeIndex = 0;
    renderPaletteActive();
  }

  function rowHtml(idx, glyph, label, meta, kbd) {
    return ''
      + `<div class="palette__row" data-idx="${idx}">`
      +   `<span class="glyph">${escapeHtml(glyph || ' ')}</span>`
      +   `<span class="label">${escapeHtml(label)}</span>`
      +   (meta ? `<span class="meta">${escapeHtml(meta)}</span>` : '')
      +   `<span class="kbd-hint">${escapeHtml(kbd)}</span>`
      + '</div>';
  }

  function renderPaletteActive() {
    if (!paletteSect) return;
    const rows = paletteSect.querySelectorAll('.palette__row');
    rows.forEach((el, i) => {
      el.classList.toggle('is-active', i === paletteState.activeIndex);
    });
    if (rows[paletteState.activeIndex]) {
      rows[paletteState.activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function activateRow(idx) {
    const row = paletteState.visibleRows[idx];
    if (!row) return;
    if (row.kind === 'launch') {
      // Launch a saved script — submit the same Run POST the home roster uses.
      submitLaunch(row.id);
      return;
    }
    if (row.kind === 'open') {
      window.location.href = '/PowerShell/Details/' + encodeURIComponent(row.id);
      return;
    }
    if (row.kind === 'nav') {
      window.location.href = row.href;
      return;
    }
  }

  function submitLaunch(scriptId) {
    // Find the antiforgery token from any form on the page (every page has one
    // because the topbar/shortcuts include forms; if none, fall back to a fresh
    // GET that pulls one).
    const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
    if (!tokenInput) {
      // No token on this page — navigate to Details where launching is deliberate.
      window.location.href = '/PowerShell/Details/' + encodeURIComponent(scriptId);
      return;
    }
    const f = document.createElement('form');
    f.method = 'post';
    f.action = '/PowerShell/Run/' + encodeURIComponent(scriptId);
    f.style.display = 'none';
    const t = document.createElement('input');
    t.type = 'hidden';
    t.name = '__RequestVerificationToken';
    t.value = tokenInput.value;
    f.appendChild(t);
    document.body.appendChild(f);
    f.submit();
  }

  async function submitAdHoc(snippet) {
    const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
    if (!tokenInput) { console.warn('no antiforgery token'); return; }
    paletteOutput.removeAttribute('hidden');
    paletteSect.setAttribute('hidden', '');
    paletteOutput.innerHTML = '<pre class="seg-text">$ submitting…</pre>';

    const fd = new URLSearchParams();
    fd.set('snippet', snippet);
    fd.set('__RequestVerificationToken', tokenInput.value);

    let res;
    try {
      res = await fetch('/PowerShell/AdHoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: fd.toString(),
        credentials: 'same-origin',
      });
    } catch (e) {
      paletteOutput.innerHTML = `<pre class="seg-text">ERROR: ${escapeHtml(e.message)}</pre>`;
      return;
    }
    if (!res.ok) {
      const txt = await res.text();
      paletteOutput.innerHTML = `<pre class="seg-text">ERROR: ${escapeHtml(txt)}</pre>`;
      return;
    }
    const data = await res.json();
    paletteState.runningJobId = data.jobId;

    // Poll JobPulse every 1.2s; render the segments inline.
    const tick = async () => {
      try {
        const r = await fetch('/PowerShell/JobPulse/' + paletteState.runningJobId, { credentials: 'same-origin' });
        if (!r.ok) return;
        const j = await r.json();
        renderPaletteOutput(j.outcome || '');
        if (j.status === 'Completed' || j.status === 'Failed' || j.status === 'Cancelled') {
          if (paletteState.pollHandle) clearInterval(paletteState.pollHandle);
          paletteState.pollHandle = null;
          paletteHint.innerHTML =
            `${j.status.toLowerCase()} · <kbd>esc</kbd> close · <kbd>⇧↵</kbd> run another`;
        }
      } catch (_) {}
    };
    tick();
    paletteState.pollHandle = setInterval(tick, 1200);
  }

  function renderPaletteOutput(raw) {
    if (!paletteOutput) return;
    let segments = null;
    if (raw && (raw[0] === '[' || raw[0] === '{')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) segments = parsed;
      } catch (_) {}
    }
    if (!segments) {
      paletteOutput.innerHTML = `<pre class="seg-text">${escapeHtml(raw || '$ waiting for output…')}</pre>`;
      return;
    }
    paletteOutput.innerHTML = segments.map((seg) => {
      if (seg.t === 'source') {
        return `<pre class="seg-source">${escapeHtml(seg.v || '')}</pre>`;
      }
      if (seg.t === 'text') {
        return `<pre class="seg-text">${escapeHtml(seg.v || '')}</pre>`;
      }
      if (seg.t === 'table') {
        // Use the same table render as Details — see renderSegmentsHtml in the
        // outputEl block. Inline a slim version here so we don't depend on
        // outputEl being present on this page.
        const cols = seg.cols || [];
        const rows = seg.rows || [];
        const colsHtml = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
        const rowsHtml = rows.map((row) =>
          `<tr>${cols.map((_, i) => {
            const v = row[i];
            const text = v === null || v === undefined ? '∅' : escapeHtml(String(v));
            return `<td>${text}</td>`;
          }).join('')}</tr>`
        ).join('');
        return `<div class="seg-table">`
          + `<div class="seg-table__head"><span class="seg-table__count">${rows.length} ${rows.length === 1 ? 'row' : 'rows'}</span></div>`
          + `<div class="seg-table__scroll"><table><thead><tr>${colsHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`
          + `</div>`;
      }
      return '';
    }).join('');
    paletteOutput.scrollTop = paletteOutput.scrollHeight;
  }

  if (paletteEl) {
    // Open via the topbar chip.
    document.querySelectorAll('[data-palette-open]').forEach((b) =>
      b.addEventListener('click', () => openPalette()));

    // Close button + click outside the panel.
    paletteEl.addEventListener('click', (e) => {
      if (e.target === paletteEl) closePalette();
      if (e.target.closest('[data-palette-close]')) closePalette();
    });

    // Search input typing → re-render sections, or flip into ad-hoc mode on `>`
    paletteInput.addEventListener('input', (e) => {
      const v = e.target.value;
      if (paletteIsAdmin && v.startsWith('>')) {
        // Strip the `>` and seed the ad-hoc input with whatever followed
        const seed = v.slice(1).replace(/^\s+/, '');
        setPaletteMode('adhoc');
        if (seed) palettePs.value = seed;
        return;
      }
      renderPaletteSections(v);
    });

    paletteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        paletteState.activeIndex = Math.min(paletteState.activeIndex + 1, paletteState.visibleRows.length - 1);
        renderPaletteActive();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        paletteState.activeIndex = Math.max(paletteState.activeIndex - 1, 0);
        renderPaletteActive();
      } else if (e.key === 'Enter') {
        if (paletteState.visibleRows.length === 0) return;
        e.preventDefault();
        activateRow(paletteState.activeIndex);
      }
    });

    // Click any row to activate.
    paletteSect.addEventListener('click', (e) => {
      const row = e.target.closest('.palette__row');
      if (!row) return;
      const idx = parseInt(row.getAttribute('data-idx'), 10);
      if (!Number.isNaN(idx)) activateRow(idx);
    });

    // Ad-hoc PowerShell input — Shift+Enter to run, Esc to back out.
    palettePs.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (paletteState.runningJobId && paletteState.pollHandle) {
          clearInterval(paletteState.pollHandle);
          paletteState.pollHandle = null;
        }
        setPaletteMode('search');
        paletteInput.value = '';
        paletteInput.focus();
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const snippet = palettePs.value.trim();
        if (snippet) submitAdHoc(snippet);
      }
    });
  }

  // ---------- Shortcuts panel ----------------------------------
  const panel = document.querySelector('.shortcuts');
  const toggleShortcuts = (force) => {
    if (!panel) return;
    const willOpen = force === undefined ? panel.hasAttribute('hidden') : force;
    if (willOpen) {
      panel.removeAttribute('hidden');
      panel.setAttribute('aria-hidden', 'false');
    } else {
      panel.setAttribute('hidden', '');
      panel.setAttribute('aria-hidden', 'true');
    }
  };
  document.querySelectorAll('[data-shortcuts-toggle]').forEach((b) =>
    b.addEventListener('click', () => toggleShortcuts())
  );

  // Click any [data-shortcuts-open="<tab-name>"] anchor to open the panel directly
  // on a specific tab — used by inline links like "how access works ›".
  const switchPanelTab = (name) => {
    if (!panel) return;
    panel.querySelectorAll('[data-tab]').forEach((t) => {
      const active = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panel.querySelectorAll('[data-pane]').forEach((p) => {
      if (p.getAttribute('data-pane') === name) p.removeAttribute('hidden');
      else p.setAttribute('hidden', '');
    });
  };
  document.querySelectorAll('[data-shortcuts-open]').forEach((a) => {
    a.style.cursor = 'pointer';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = a.getAttribute('data-shortcuts-open') || 'keys';
      switchPanelTab(tab);
      toggleShortcuts(true);
    });
  });
  if (panel) {
    panel.addEventListener('click', (e) => {
      if (e.target === panel) toggleShortcuts(false);
    });
    panel.querySelectorAll('[data-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        const name = tab.getAttribute('data-tab');
        panel.querySelectorAll('[data-tab]').forEach((t) => {
          const active = t === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        panel.querySelectorAll('[data-pane]').forEach((p) => {
          if (p.getAttribute('data-pane') === name) p.removeAttribute('hidden');
          else p.setAttribute('hidden', '');
        });
      });
    });
  }

  // ---------- Roster filter + keyboard nav ---------------------
  const roster = document.querySelector('[data-roster]');
  const filterInput = document.querySelector('[data-roster-filter]');
  const filterClearBtn = document.querySelector('[data-roster-filter-clear]');
  const visibleCountEl = document.querySelector('[data-visible-count]');
  const rows = roster ? Array.from(roster.querySelectorAll('[data-row]')) : [];

  const visibleRows = () => rows.filter((r) => r.style.display !== 'none');

  let selectedIndex = -1;
  const renderSelection = () => {
    rows.forEach((r) => r.classList.remove('is-selected'));
    const v = visibleRows();
    if (selectedIndex >= 0 && selectedIndex < v.length) {
      const row = v[selectedIndex];
      row.classList.add('is-selected');
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };
  const moveSelection = (delta) => {
    const v = visibleRows();
    if (v.length === 0) return;
    if (selectedIndex < 0) selectedIndex = delta > 0 ? 0 : v.length - 1;
    else selectedIndex = (selectedIndex + delta + v.length) % v.length;
    renderSelection();
  };
  const openSelected = () => {
    const v = visibleRows();
    if (v.length === 0) return false;
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    const row = v[idx];
    const link = row.querySelector('[data-open]') || row.querySelector('[data-row-link]');
    if (link) { link.click(); return true; }
    return false;
  };

  const applyFilter = (q) => {
    if (!roster) return;
    const needle = (q || '').trim().toLowerCase();
    let n = 0;
    rows.forEach((r) => {
      const key = r.getAttribute('data-filter-key') || '';
      const match = !needle || key.includes(needle);
      r.style.display = match ? '' : 'none';
      if (match) n++;
    });
    if (visibleCountEl) visibleCountEl.textContent = String(n);
    roster.classList.toggle('is-empty', n === 0 && needle.length > 0);
    if (filterClearBtn) {
      if (needle.length > 0) filterClearBtn.removeAttribute('hidden');
      else filterClearBtn.setAttribute('hidden', '');
    }
    const v = visibleRows();
    if (selectedIndex >= v.length) selectedIndex = v.length - 1;
    renderSelection();
  };

  const clearFilter = () => {
    if (!filterInput) return;
    filterInput.value = '';
    applyFilter('');
    filterInput.focus();
  };

  // ---------- URL state sync (filter + sort) ------------------
  // Mirror the filter and sort state into the URL so the view is bookmarkable
  // and survives reload. Uses replaceState (no history clutter on every keystroke).
  const updateUrlState = (q, sortKey, sortDir) => {
    const u = new URL(window.location.href);
    if (q && q.length > 0) u.searchParams.set('q', q);
    else u.searchParams.delete('q');
    if (sortKey) {
      u.searchParams.set('sort', sortKey);
      u.searchParams.set('dir', sortDir || 'asc');
    } else {
      u.searchParams.delete('sort');
      u.searchParams.delete('dir');
    }
    history.replaceState({}, '', u);
  };
  const readUrlState = () => {
    const u = new URL(window.location.href);
    return {
      q:       u.searchParams.get('q')    || '',
      sortKey: u.searchParams.get('sort') || null,
      sortDir: u.searchParams.get('dir')  || 'asc',
    };
  };

  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      applyFilter(e.target.value);
      const { sortKey, sortDir } = readUrlState();
      updateUrlState(e.target.value, sortKey, sortDir);
    });
    filterInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (filterInput.value) { clearFilter(); }
        else { filterInput.blur(); }
      } else if (e.key === 'Enter') {
        const v = visibleRows();
        if (v.length === 0) return;
        const target = v[Math.max(0, selectedIndex)];
        const link = target && (target.querySelector('[data-open]') || target.querySelector('[data-row-link]'));
        if (link) { e.preventDefault(); link.click(); }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault(); moveSelection(1); filterInput.blur();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); moveSelection(-1); filterInput.blur();
      }
    });
  }
  if (filterClearBtn) filterClearBtn.addEventListener('click', clearFilter);

  // ---------- Roster sort ------------------------------------
  // Click a column header to sort; click again to flip direction; click a third
  // time to clear. State is mirrored into ?sort=&dir= for bookmarkability.
  const STATUS_RANK = { running: 0, failed: 1, scheduled: 2, completed: 3, warning: 4, pending: 5 };

  const getSortValue = (row, key) => {
    if (key === 'name') {
      const a = row.querySelector('.col-name a');
      return (a ? a.textContent : '').toLowerCase();
    }
    if (key === 'author') {
      const c = row.querySelector('.col-author');
      return (c ? c.textContent.trim() : '').toLowerCase();
    }
    if (key === 'last-status') {
      const pill = row.querySelector('[data-status-cell] [data-state]');
      const state = pill ? pill.getAttribute('data-state') : null;
      if (state in STATUS_RANK) return STATUS_RANK[state];
      return 100; // never-run sorts last
    }
    if (key === 'last-run') {
      const cell = row.querySelector('[data-last-iso]');
      const iso = cell ? cell.getAttribute('data-last-iso') : '';
      return iso ? new Date(iso).getTime() : 0;
    }
    return '';
  };

  const sortHeaders = roster ? roster.querySelectorAll('th[data-sort-key]') : [];

  const renderSortIndicator = (key, dir) => {
    sortHeaders.forEach((th) => {
      const k = th.getAttribute('data-sort-key');
      const active = k === key && key !== null;
      th.classList.toggle('is-sorted', active);
      th.classList.toggle('is-sorted-desc', active && dir === 'desc');
      th.setAttribute('aria-sort', active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none');
    });
  };

  const applySort = (key, dir) => {
    if (!roster) return;
    if (!key) {
      // Restore document order — original DOM order represents the server-side
      // alphabetical-by-name default. We snapshotted that order on init below.
      const tbody = roster.querySelector('tbody');
      if (originalRowOrder.length) {
        originalRowOrder.forEach((r) => tbody.appendChild(r));
      }
      renderSortIndicator(null, null);
      return;
    }
    const tbody = roster.querySelector('tbody');
    const arr = Array.from(tbody.querySelectorAll('[data-row]'));
    arr.sort((a, b) => {
      const av = getSortValue(a, key);
      const bv = getSortValue(b, key);
      let cmp;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return dir === 'desc' ? -cmp : cmp;
    });
    arr.forEach((r) => tbody.appendChild(r));
    renderSortIndicator(key, dir);
  };

  const originalRowOrder = roster ? Array.from(roster.querySelectorAll('[data-row]')) : [];

  sortHeaders.forEach((th) => {
    const cycle = () => {
      const key = th.getAttribute('data-sort-key');
      const { sortKey: curKey, sortDir: curDir, q } = readUrlState();
      let nextKey = key;
      let nextDir = 'asc';
      if (curKey === key) {
        if (curDir === 'asc') nextDir = 'desc';
        else { nextKey = null; nextDir = null; }  // third click clears
      }
      applySort(nextKey, nextDir);
      updateUrlState(q, nextKey, nextDir);
    };
    th.addEventListener('click', cycle);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycle(); }
    });
  });

  // Apply initial state from URL on load.
  if (roster) {
    const init = readUrlState();
    if (init.q) {
      filterInput.value = init.q;
      applyFilter(init.q);
    }
    if (init.sortKey) {
      applySort(init.sortKey, init.sortDir);
    }
  }

  // ---------- Heartbeat (live state) ---------------------------
  const HEARTBEAT_MS = 5000;
  const dock = document.querySelector('[data-running-dock]');
  const dockName = document.querySelector('[data-running-name]');
  const dockAgo = document.querySelector('[data-running-iso]');
  const railList = document.querySelector('[data-rail-list]');
  const railEmpty = document.querySelector('[data-rail-empty]');
  const railMore = document.querySelector('[data-rail-more]');
  const summaryJobsBlock = document.querySelector('[data-jobs-block]');
  const summaryFailedBlock = document.querySelector('[data-failed-block]');
  const summaryJobsTotal = document.querySelector('[data-jobs-total]');
  const summaryFailedCount = document.querySelector('[data-failed-count]');
  const rowsByScript = new Map();
  rows.forEach((r) => {
    const id = r.getAttribute('data-script-id');
    if (id) rowsByScript.set(id, r);
  });

  const setRunningRow = (scriptId) => {
    rows.forEach((r) => r.classList.toggle('is-running', r.getAttribute('data-script-id') === scriptId));
  };

  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  const updateDock = (running) => {
    if (!dock) return;
    if (running) {
      dock.style.display = '';
      dock.setAttribute('href', '/PowerShell/Details/' + running.scriptId);
      dock.setAttribute('title', 'Running: ' + (running.name || 'unknown'));
      if (dockName) dockName.textContent = running.name || '(unknown)';
      if (dockAgo) {
        dockAgo.setAttribute('data-running-iso', running.date);
        dockAgo.textContent = ago(new Date(running.date));
      }
      document.body.setAttribute('data-running', 'true');
    } else {
      dock.style.display = 'none';
      document.body.setAttribute('data-running', 'false');
    }
  };

  const updateRail = (recent) => {
    if (!railList) return;
    if (!recent || recent.length === 0) {
      railList.style.display = 'none';
      if (railMore) railMore.style.display = 'none';
      if (railEmpty) railEmpty.style.display = '';
      return;
    }
    railList.style.display = '';
    if (railMore) railMore.style.display = '';
    if (railEmpty) railEmpty.style.display = 'none';
    railList.innerHTML = recent.map((j) => {
      const token = STATUS_TOKEN[j.status] || 'pending';
      const label = STATUS_LABEL[j.status] || j.status.toLowerCase();
      const short = STATUS_SHORT[j.status] || '—';
      const name = escapeHtml(j.name || '(deleted)');
      const when = ago(new Date(j.date));
      return `<li data-rail-iso="${escapeHtml(j.date)}">`
        + `<span class="status" data-state="${token}" title="${escapeHtml(label)}">${escapeHtml(short)}</span>`
        + `<span class="name" title="${name}">${name}</span>`
        + `<span class="when">${escapeHtml(when)}</span>`
        + '</li>';
    }).join('');
  };

  // First line of an outcome string, capped — used for the failed-row tooltip.
  // Outcome is now segment JSON for structured runs; try to parse and extract the
  // first text segment, otherwise treat the input as plain text.
  const firstLineOf = (s) => {
    if (!s) return '';
    let candidate = s;
    if (s.length > 0 && (s[0] === '[' || s[0] === '{')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          const firstText = parsed.find((seg) => seg && seg.t === 'text' && seg.v);
          if (firstText) candidate = firstText.v;
        }
      } catch (_) { /* fall through to raw text */ }
    }
    const i = candidate.indexOf('\n');
    let line = i >= 0 ? candidate.slice(0, i) : candidate;
    line = line.trim();
    return line.length > 200 ? line.slice(0, 200) + '…' : line;
  };

  const updateRowStatuses = (running, recent) => {
    // Build a per-script "latest job" map from recent (already ordered desc).
    const latestByScript = new Map();
    (recent || []).forEach((j) => {
      const k = String(j.scriptId);
      if (!latestByScript.has(k)) latestByScript.set(k, j);
    });
    rows.forEach((row) => {
      const id = row.getAttribute('data-script-id');
      const cell = row.querySelector('[data-status-cell]');
      const lastCell = row.querySelector('[data-last-cell]');
      if (!cell) return;
      const isRunning = running && String(running.scriptId) === id;
      if (isRunning) {
        cell.innerHTML = '<span class="status" data-state="running">running</span>';
        if (lastCell) {
          lastCell.setAttribute('data-last-iso', running.date);
          lastCell.textContent = ago(new Date(running.date));
        }
        return;
      }
      const j = latestByScript.get(id);
      if (j) {
        const token = STATUS_TOKEN[j.status] || 'pending';
        const label = STATUS_LABEL[j.status] || j.status.toLowerCase();
        // Failed rows expose the first line of outcome as a native tooltip so
        // operators can peek at the failure reason without clicking through.
        const titleAttr = (j.status === 'Failed' && j.outcome)
          ? ` title="${escapeHtml(firstLineOf(j.outcome))}"`
          : '';
        cell.innerHTML = `<span class="status" data-state="${token}"${titleAttr}>${escapeHtml(label)}</span>`;
        if (lastCell) {
          lastCell.setAttribute('data-last-iso', j.date);
          lastCell.textContent = ago(new Date(j.date));
        }
      }
      // If no recent job and the row already shows "never run", leave it. The
      // server-rendered initial state handles never-run rows correctly.
    });
    // Heartbeat re-paints rows but doesn't move them; if a sort is active in
    // the URL, re-apply it so the ordering stays consistent with the new data.
    const { sortKey, sortDir } = readUrlState();
    if (sortKey) applySort(sortKey, sortDir);
  };

  const updateSummary = (failed, completed) => {
    const total = (failed || 0) + (completed || 0);
    if (summaryJobsBlock) summaryJobsBlock.style.display = total > 0 ? '' : 'none';
    if (summaryJobsTotal) summaryJobsTotal.textContent = String(total);
    if (summaryFailedBlock) summaryFailedBlock.style.display = (failed || 0) > 0 ? '' : 'none';
    if (summaryFailedCount) summaryFailedCount.textContent = String(failed || 0);
  };

  const refreshAgoLabels = () => {
    if (dockAgo && dock && dock.style.display !== 'none') {
      const iso = dockAgo.getAttribute('data-running-iso');
      if (iso) dockAgo.textContent = ago(new Date(iso));
    }
    document.querySelectorAll('[data-last-iso]').forEach((el) => {
      const iso = el.getAttribute('data-last-iso');
      if (iso) el.textContent = ago(new Date(iso));
    });
    document.querySelectorAll('[data-rail-iso]').forEach((li) => {
      const iso = li.getAttribute('data-rail-iso');
      if (!iso) return;
      const when = li.querySelector('.when');
      if (when) when.textContent = ago(new Date(iso));
    });
  };

  let heartbeatInflight = false;
  const heartbeat = async () => {
    if (heartbeatInflight) return;
    heartbeatInflight = true;
    try {
      const r = await fetch('/Home/Heartbeat', { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' });
      if (!r.ok) return;
      const data = await r.json();
      updateDock(data.running);
      setRunningRow(data.running ? String(data.running.scriptId) : null);
      updateRowStatuses(data.running, data.recent);
      updateRail(data.recent);
      updateSummary(data.failed24h, data.completed24h);
    } catch (_) {
      // network blip — try again next tick.
    } finally {
      heartbeatInflight = false;
    }
  };

  // Only poll on pages that have something to update (the home roster, or the topbar dock).
  const shouldPoll = !!(roster || dock);
  if (shouldPoll) {
    setInterval(heartbeat, HEARTBEAT_MS);
    setInterval(refreshAgoLabels, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) heartbeat(); });
  }

  // ---------- Details page ------------------------------------
  const detailsRoot = document.querySelector('[data-details]');
  if (detailsRoot) {
    const scriptId = detailsRoot.getAttribute('data-script-id');
    const runningStrip = detailsRoot.querySelector('[data-running-strip]');
    const runningUser = detailsRoot.querySelector('[data-running-user]');
    const runningElapsed = detailsRoot.querySelector('[data-running-elapsed]');
    const outputEl = detailsRoot.querySelector('[data-output]');
    const outputMeta = detailsRoot.querySelector('[data-output-meta]');
    const historyBody = detailsRoot.querySelector('[data-history-body]');
    const historyMeta = detailsRoot.querySelector('[data-history-meta]');

    const elapsedFor = (iso) => {
      if (!iso) return '';
      const t = (Date.now() - new Date(iso).getTime()) / 1000;
      if (t < 60) return Math.max(0, Math.floor(t)) + 's';
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      if (m < 60) return m + 'm' + (s < 10 ? '0' : '') + s + 's';
      const h = Math.floor(m / 60);
      const mr = m % 60;
      return h + 'h' + (mr < 10 ? '0' : '') + mr + 'm';
    };

    const tickElapsed = () => {
      if (!runningStrip || runningStrip.hasAttribute('hidden')) return;
      const iso = runningElapsed && runningElapsed.getAttribute('data-running-iso');
      if (iso && runningElapsed) runningElapsed.textContent = 'elapsed ' + elapsedFor(iso);
    };
    setInterval(tickElapsed, 1000);

    const isAtBottom = (el) => el && (el.scrollHeight - el.scrollTop - el.clientHeight) < 8;

    // ---------- Typed segment renderer --------------------------
    // Job.Outcome is now a JSON array of segments (text | table). Pre-feature jobs
    // stored plain text — those parse-fail and render as a single text segment via
    // the fallback below. The renderer is mode-aware: 'structured' paints tables
    // as real <table> elements; 'raw' flattens everything to plain text.
    let outputMode = 'structured';
    let lastRendered = ''; // last raw string we rendered, to skip no-op repaints

    const parseSegments = (raw) => {
      if (!raw || typeof raw !== 'string') return null;
      const t = raw.trimStart();
      if (!t.startsWith('[') && !t.startsWith('{')) return null;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)
            && parsed.every((s) => s && typeof s === 'object' && typeof s.t === 'string')) {
          return parsed;
        }
      } catch (_) { /* not JSON; treat as plain text */ }
      return null;
    };

    const cellClass = (v) => {
      if (v === null || v === undefined) return 'is-null';
      if (typeof v === 'number') return 'is-num';
      if (typeof v === 'boolean') return v ? 'is-bool-true' : 'is-bool-false';
      return '';
    };
    const cellDisplay = (v) => {
      if (v === null || v === undefined) return '∅';
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      return String(v);
    };

    const VISIBLE_COL_CAP = 8;
    const VISIBLE_ROW_CAP = 200;

    const renderSegmentsHtml = (segments) => segments.map((seg) => {
      if (seg.t === 'text') {
        const v = seg.v || '';
        if (!v) return '';
        return `<pre class="seg-text">${escapeHtml(v)}</pre>`;
      }
      if (seg.t === 'table') {
        const cols = seg.cols || [];
        const rows = seg.rows || [];
        const totalCols = cols.length;
        const hasExtras = totalCols > VISIBLE_COL_CAP;
        const totalRows = rows.length;
        const cappedRows = totalRows > VISIBLE_ROW_CAP ? rows.slice(0, VISIBLE_ROW_CAP) : rows;

        const colsHtml = cols.map((c, i) => {
          const extra = (hasExtras && i >= VISIBLE_COL_CAP) ? ' data-extra="1"' : '';
          return `<th data-col-idx="${i}"${extra}>${escapeHtml(c)}</th>`;
        }).join('');

        const rowsHtml = cappedRows.map((row) => renderTableRow(row, cols, hasExtras)).join('');

        const visibleCols = hasExtras ? VISIBLE_COL_CAP : totalCols;
        const moreColsChip = hasExtras
          ? `<button type="button" class="seg-table__more" data-more aria-pressed="false">+${totalCols - VISIBLE_COL_CAP} more cols</button>`
          : '';
        const moreRowsChip = totalRows > VISIBLE_ROW_CAP
          ? `<button type="button" class="seg-table__more" data-more-rows="1" aria-pressed="false">show all ${totalRows} rows</button>`
          : '';
        const filterInput = totalRows > 4
          ? '<input type="search" class="seg-table__filter" placeholder="filter…" autocomplete="off" spellcheck="false" aria-label="Filter rows">'
          : '';

        return ''
          + `<div class="seg-table" data-row-count="${totalRows}" data-visible-cap="${visibleCols}" data-visible-row-cap="${cappedRows.length}">`
          + '<div class="seg-table__head">'
          +   `<span class="seg-table__count"><span class="visible-of-total" data-visible-count>${cappedRows.length}</span> / ${totalRows} ${totalRows === 1 ? 'row' : 'rows'}</span>`
          +   moreColsChip
          +   moreRowsChip
          +   filterInput
          + '</div>'
          + '<div class="seg-table__scroll"><table>'
          +   `<thead><tr>${colsHtml}</tr></thead>`
          +   `<tbody>${rowsHtml}</tbody>`
          + '</table></div>'
          + '</div>';
      }
      return '';
    }).join('');

    // Render a single tbody <tr> from a row + cols. Extracted so it can be reused
    // by the incremental-append path during streaming.
    const renderTableRow = (row, cols, hasExtras) => {
      const tds = cols.map((_, i) => {
        const v = row[i];
        const cls = cellClass(v);
        const text = escapeHtml(cellDisplay(v));
        const title = (v !== null && v !== undefined) ? ` title="${escapeHtml(String(v))}"` : '';
        const extra = (hasExtras && i >= VISIBLE_COL_CAP) ? ' data-extra="1"' : '';
        return `<td class="${cls}"${title}${extra}>${text}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    };

    // Flatten segments to plain text — used by the 'raw' toggle and as a fallback.
    const flattenSegments = (segments) => segments.map((seg) => {
      if (seg.t === 'text') return seg.v || '';
      if (seg.t === 'table') {
        const cols = seg.cols || [];
        const rows = seg.rows || [];
        if (cols.length === 0 || rows.length === 0) return '';
        // Compute column widths from the data so the text view aligns.
        const widths = cols.map((c, i) => Math.max(
          c.length,
          ...rows.map((r) => String(r[i] === null || r[i] === undefined ? '' : r[i]).length)
        ));
        const pad = (s, w) => String(s).padEnd(w);
        const head = cols.map((c, i) => pad(c, widths[i])).join('  ');
        const sep  = widths.map((w) => '─'.repeat(w)).join('  ');
        const body = rows.map((r) => cols.map((_, i) => {
          const v = r[i];
          return pad(v === null || v === undefined ? '' : String(v), widths[i]);
        }).join('  ')).join('\n');
        return `${head}\n${sep}\n${body}`;
      }
      return '';
    }).join('\n\n');

    // Last-rendered segment array, kept around so we can do incremental appends
    // during streaming instead of full repaints (preserves operator's sort/filter).
    let lastSegments = null;

    // Quick structural-equality check for two segments. Coarse: text segments
    // compare on .v; table segments compare on cols length + first row pointer.
    // This only needs to detect "is this the same content I already rendered."
    const segmentsExtensible = (oldSegs, newSegs) => {
      if (!oldSegs || !newSegs) return null;
      if (newSegs.length < oldSegs.length) return null;
      // All segments before the last common one must be identical content.
      for (let i = 0; i < oldSegs.length - 1; i++) {
        const a = oldSegs[i];
        const b = newSegs[i];
        if (!a || !b || a.t !== b.t) return null;
        if (a.t === 'text' && a.v !== b.v) return null;
        if (a.t === 'table') {
          if (!arraysShallowEqual(a.cols || [], b.cols || [])) return null;
          if ((a.rows || []).length !== (b.rows || []).length) return null;
        }
      }
      // The trailing segment of the old list — accept if (a) identical or (b) it's
      // a table that's been extended with more rows in the new list.
      const oldLast = oldSegs[oldSegs.length - 1];
      const newAt   = newSegs[oldSegs.length - 1];
      let extendedTable = null;
      if (oldLast && newAt) {
        if (oldLast.t === 'table' && newAt.t === 'table'
            && arraysShallowEqual(oldLast.cols || [], newAt.cols || [])
            && (newAt.rows || []).length >= (oldLast.rows || []).length) {
          extendedTable = (newAt.rows || []).slice((oldLast.rows || []).length);
        } else if (oldLast.t === 'text' && newAt.t === 'text') {
          // Text continues if new value starts with old value.
          if (typeof newAt.v === 'string' && typeof oldLast.v === 'string'
              && newAt.v.startsWith(oldLast.v)) {
            // No DOM mutation needed for text-prefix-equal case other than the
            // extra characters; we'll just full-repaint that one text node.
            extendedTable = null;
          } else if (oldLast.v !== newAt.v) {
            return null;
          }
        } else if (oldLast.t !== newAt.t) {
          return null;
        }
      }
      // Anything in newSegs beyond oldSegs.length is brand-new content to append.
      const trailingNewSegments = newSegs.slice(oldSegs.length);
      return { extendedTable, trailingNewSegments };
    };

    const arraysShallowEqual = (a, b) => {
      if (a === b) return true;
      if (!a || !b || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    };

    // Apply an incremental update to the output container instead of replacing
    // its innerHTML. Returns true on success, false to fall back to full repaint.
    const applyIncrementalUpdate = (newSegs, mode) => {
      if (mode !== 'structured') return false; // raw mode is a single <pre>; just full-repaint
      const ext = segmentsExtensible(lastSegments, newSegs);
      if (!ext) return false;

      // Update the trailing text segment (if it grew character-wise).
      const oldLast = lastSegments[lastSegments.length - 1];
      const newAt = newSegs[lastSegments.length - 1];
      if (oldLast && newAt && oldLast.t === 'text' && newAt.t === 'text' && oldLast.v !== newAt.v) {
        const segNodes = outputEl.querySelectorAll('.seg-text, .seg-table');
        const targetNode = segNodes[lastSegments.length - 1];
        if (targetNode && targetNode.classList.contains('seg-text')) {
          targetNode.textContent = newAt.v || '';
        }
      }

      // Append new rows to the trailing table, if any.
      if (ext.extendedTable && ext.extendedTable.length > 0) {
        const segNodes = outputEl.querySelectorAll('.seg-text, .seg-table');
        const tableNode = segNodes[lastSegments.length - 1];
        if (tableNode && tableNode.classList.contains('seg-table')) {
          const cols = newAt.cols || [];
          const totalCols = cols.length;
          const hasExtras = totalCols > VISIBLE_COL_CAP;
          const tbody = tableNode.querySelector('tbody');
          if (tbody) {
            const rowHtml = ext.extendedTable.map((r) => renderTableRow(r, cols, hasExtras)).join('');
            tbody.insertAdjacentHTML('beforeend', rowHtml);
            // Update the row counter in the head.
            const totalNow = (newAt.rows || []).length;
            const counter = tableNode.querySelector('[data-visible-count]');
            if (counter) counter.textContent = String(visibleRowCountFor(tbody));
            const countLabel = tableNode.querySelector('.seg-table__count');
            if (countLabel) {
              const visible = visibleRowCountFor(tbody);
              countLabel.innerHTML = `<span class="visible-of-total" data-visible-count>${visible}</span> / ${totalNow} ${totalNow === 1 ? 'row' : 'rows'}`;
            }
            // Re-apply the active filter so new rows respect it.
            const filterInput = tableNode.querySelector('.seg-table__filter');
            if (filterInput && filterInput.value) applyFilterToTable(tableNode);
          }
        }
      }

      // Append entirely new trailing segments (text or table) as fresh HTML.
      if (ext.trailingNewSegments.length > 0) {
        const html = renderSegmentsHtml(ext.trailingNewSegments);
        outputEl.insertAdjacentHTML('beforeend', html);
      }

      lastSegments = newSegs;
      return true;
    };

    const visibleRowCountFor = (tbody) =>
      Array.from(tbody.querySelectorAll('tr')).filter((tr) => !tr.hasAttribute('hidden')).length;

    const renderInto = (raw, mode) => {
      const wasAtBottom = isAtBottom(outputEl);
      const segments = parseSegments(raw);

      // Try incremental update first when streaming new structured content.
      if (segments && segments.length > 0 && mode === 'structured' && lastSegments) {
        if (applyIncrementalUpdate(segments, mode)) {
          if (wasAtBottom) outputEl.scrollTop = outputEl.scrollHeight;
          return;
        }
      }

      let html;
      const isPlaceholder = !raw || raw.length === 0
        || (typeof raw === 'string' && raw.startsWith('$ '));
      const placeholder = !raw || raw.length === 0 ? '$ no output yet' : raw;

      if (segments && segments.length > 0) {
        html = mode === 'raw'
          ? `<pre class="seg-text">${escapeHtml(flattenSegments(segments))}</pre>`
          : renderSegmentsHtml(segments);
        lastSegments = segments;
      } else {
        // Plain text or pre-feature outcome — render as a single text segment.
        html = `<pre class="seg-text">${escapeHtml(placeholder)}</pre>`;
        lastSegments = null;
      }
      outputEl.classList.toggle('is-empty', isPlaceholder && !segments);
      outputEl.innerHTML = html;
      if (wasAtBottom) outputEl.scrollTop = outputEl.scrollHeight;
    };

    const updateOutput = (running, recent) => {
      if (!outputEl) return;
      let raw = '';
      let meta;
      if (running) {
        raw = running.outcome && running.outcome.length > 0 ? running.outcome : '';
        meta = 'running · streaming live';
        outputEl.classList.add('is-running');
      } else if (recent && recent.length > 0) {
        const last = recent[0];
        raw = last.outcome && last.outcome.length > 0 ? last.outcome : '';
        meta = 'last run · ' + agoLong(new Date(last.started)) + ' · ' + (last.status || '').toLowerCase();
        outputEl.classList.remove('is-running');
      } else {
        raw = '';
        meta = 'no runs yet';
        outputEl.classList.remove('is-running');
      }
      if (outputMeta) outputMeta.textContent = meta;
      if (raw === lastRendered) return; // no change, no repaint
      lastRendered = raw;
      renderInto(raw || '', outputMode);
    };

    // ---------- Table interactions: sort / filter / more cols ----
    // Delegated handlers on the output block. State (sort, filter, all-cols) lives
    // on the .seg-table element via dataset; heartbeat repaints reset it (acceptable
    // tradeoff — operators interact with tables on completed runs, not mid-stream).
    const sortValue = (cell) => {
      if (!cell) return null;
      const cls = cell.className || '';
      const text = cell.getAttribute('title') ?? cell.textContent;
      if (cls.includes('is-null')) return [3, 0]; // nulls sort last
      if (cls.includes('is-num')) {
        const n = parseFloat(text);
        return [0, isNaN(n) ? 0 : n];
      }
      if (cls.includes('is-bool-true'))  return [1, 0];
      if (cls.includes('is-bool-false')) return [1, 1];
      return [2, String(text).toLowerCase()];
    };

    const compareKeys = (a, b) => {
      if (a[0] !== b[0]) return a[0] - b[0];
      if (typeof a[1] === 'number' && typeof b[1] === 'number') return a[1] - b[1];
      return String(a[1]).localeCompare(String(b[1]));
    };

    const sortTable = (table, colIdx, dir) => {
      const tbody = table.querySelector('tbody');
      if (!tbody) return;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.sort((tra, trb) => {
        const a = sortValue(tra.cells[colIdx]);
        const b = sortValue(trb.cells[colIdx]);
        const cmp = compareKeys(a, b);
        return dir === 'desc' ? -cmp : cmp;
      });
      rows.forEach((r) => tbody.appendChild(r));
      // Update header indicator
      table.querySelectorAll('thead th').forEach((th, i) => {
        const active = i === colIdx;
        th.classList.toggle('is-sorted', active);
        th.classList.toggle('is-sort-desc', active && dir === 'desc');
      });
      table.dataset.sortCol = String(colIdx);
      table.dataset.sortDir = dir || '';
    };

    const restoreSort = (table) => {
      // Restore "natural" insertion order. We don't persist the original index in
      // each row, so this is best-effort: clear indicators and let the next manual
      // sort happen from the now-shuffled state.
      table.querySelectorAll('thead th').forEach((th) => {
        th.classList.remove('is-sorted', 'is-sort-desc');
      });
      delete table.dataset.sortCol;
      delete table.dataset.sortDir;
    };

    const applyFilterToTable = (segTable) => {
      const input = segTable.querySelector('.seg-table__filter');
      const needle = (input && input.value || '').trim().toLowerCase();
      const rows = segTable.querySelectorAll('tbody tr');
      let visible = 0;
      rows.forEach((tr) => {
        if (!needle) {
          tr.removeAttribute('hidden');
          visible++;
          return;
        }
        const hay = Array.from(tr.cells).map((c) => c.textContent.toLowerCase()).join(' ');
        const match = hay.includes(needle);
        if (match) { tr.removeAttribute('hidden'); visible++; }
        else { tr.setAttribute('hidden', ''); }
      });
      const counter = segTable.querySelector('[data-visible-count]');
      if (counter) counter.textContent = String(visible);
    };

    if (outputEl) {
      outputEl.addEventListener('click', (e) => {
        // Sort
        const th = e.target.closest('.seg-table thead th[data-col-idx]');
        if (th) {
          const segTable = th.closest('.seg-table');
          const idx = parseInt(th.getAttribute('data-col-idx'), 10);
          const curCol = parseInt(segTable.dataset.sortCol ?? '-1', 10);
          const curDir = segTable.dataset.sortDir || '';
          let nextDir;
          if (curCol === idx) {
            if (curDir === 'asc') nextDir = 'desc';
            else if (curDir === 'desc') nextDir = ''; // third click clears
            else nextDir = 'asc';
          } else {
            nextDir = 'asc';
          }
          if (nextDir === '') restoreSort(segTable);
          else sortTable(segTable, idx, nextDir);
          return;
        }
        // More cols toggle
        const moreBtn = e.target.closest('.seg-table__more[data-more]');
        if (moreBtn) {
          const segTable = moreBtn.closest('.seg-table');
          const showing = segTable.classList.toggle('all-cols');
          moreBtn.classList.toggle('is-active', showing);
          moreBtn.setAttribute('aria-pressed', showing ? 'true' : 'false');
          const total = segTable.querySelectorAll('thead th').length;
          moreBtn.textContent = showing
            ? `hide ${total - VISIBLE_COL_CAP} cols`
            : `+${total - VISIBLE_COL_CAP} more cols`;
          return;
        }

        // Show-all-rows toggle
        const moreRowsBtn = e.target.closest('.seg-table__more[data-more-rows]');
        if (moreRowsBtn) {
          const segTable = moreRowsBtn.closest('.seg-table');
          const totalRows = parseInt(segTable.dataset.rowCount || '0', 10);
          const renderedNow = segTable.querySelectorAll('tbody tr').length;
          if (renderedNow >= totalRows) return; // already showing all

          // Re-fetch the segment data from lastSegments — find the matching table
          // by index relative to the rendered seg nodes.
          const segNodes = Array.from(outputEl.querySelectorAll('.seg-text, .seg-table'));
          const segIdx = segNodes.indexOf(segTable);
          if (segIdx === -1 || !lastSegments || !lastSegments[segIdx]) return;
          const seg = lastSegments[segIdx];
          if (seg.t !== 'table') return;

          const cols = seg.cols || [];
          const rows = seg.rows || [];
          const hasExtras = cols.length > VISIBLE_COL_CAP;
          const tbody = segTable.querySelector('tbody');
          const remaining = rows.slice(renderedNow);
          tbody.insertAdjacentHTML('beforeend',
            remaining.map((r) => renderTableRow(r, cols, hasExtras)).join(''));

          moreRowsBtn.remove(); // one-shot
          const counter = segTable.querySelector('.seg-table__count');
          if (counter) counter.innerHTML =
            `<span class="visible-of-total" data-visible-count>${rows.length}</span> / ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`;
          // Re-apply filter so newly-rendered rows respect it.
          const filterInput = segTable.querySelector('.seg-table__filter');
          if (filterInput && filterInput.value) applyFilterToTable(segTable);
          return;
        }
      });

      outputEl.addEventListener('input', (e) => {
        if (e.target.matches('.seg-table__filter')) {
          const segTable = e.target.closest('.seg-table');
          applyFilterToTable(segTable);
        }
      });
    }

    // Initial paint from the server-rendered data-output-raw attribute (so the page
    // shows the outcome correctly before the first heartbeat tick lands).
    if (outputEl) {
      const initialRaw = outputEl.getAttribute('data-output-raw') || '';
      lastRendered = initialRaw;
      renderInto(initialRaw, outputMode);
    }

    // Toggle wiring: structured ↔ raw.
    document.querySelectorAll('[data-output-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-output-mode');
        if (next === outputMode) return;
        outputMode = next;
        document.querySelectorAll('[data-output-mode]').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        renderInto(lastRendered, outputMode);
      });
    });

    const argsStrip = detailsRoot.querySelector('[data-running-args]');
    const argsList = detailsRoot.querySelector('[data-running-args-list]');

    const renderArgs = (args) => {
      if (!argsStrip || !argsList) return;
      if (!args || Object.keys(args).length === 0) {
        argsStrip.setAttribute('hidden', '');
        argsList.innerHTML = '';
        return;
      }
      argsStrip.removeAttribute('hidden');
      argsList.innerHTML = Object.keys(args).map((k) =>
        `<span class="arg"><span class="arg__k">${escapeHtml(k)}</span>`
        + `<span class="arg__sep">=</span>`
        + `<span class="arg__v">${escapeHtml(args[k])}</span></span>`
      ).join('');
    };

    const updateRunningStrip = (running) => {
      if (!runningStrip) return;
      if (running) {
        runningStrip.removeAttribute('hidden');
        if (runningUser) runningUser.textContent = running.userName || '';
        if (runningElapsed) {
          runningElapsed.setAttribute('data-running-iso', running.started);
          runningElapsed.textContent = 'elapsed ' + elapsedFor(running.started);
        }
        renderArgs(running.args);
      } else {
        runningStrip.setAttribute('hidden', '');
        renderArgs(null);
      }
    };

    const STATUS_TOKEN_D = STATUS_TOKEN;
    const renderHistory = (recent) => {
      if (!historyBody) return;
      if (!recent || recent.length === 0) {
        historyBody.innerHTML = '<tr><td colspan="4"><div class="empty">$ no runs yet</div></td></tr>';
        if (historyMeta) historyMeta.innerHTML = '<span data-numeric>0</span> recent runs';
        return;
      }
      const rows = recent.map((j) => {
        const token = STATUS_TOKEN_D[j.status] || 'pending';
        const label = (j.status || '').toLowerCase();
        const iso = j.started;
        const when = agoLong(new Date(iso));
        const hasOut = j.outcome && j.outcome.length > 0;
        const safeUser = escapeHtml(j.userName || '');
        const safeOutcome = escapeHtml(j.outcome || '');
        return `<tr data-job-id="${j.id}">`
          + `<td class="col-user">${safeUser}</td>`
          + `<td class="col-when" data-when-iso="${escapeHtml(iso)}">${escapeHtml(when)}</td>`
          + `<td><span class="status" data-state="${token}">${escapeHtml(label)}</span></td>`
          + `<td class="col-act">${hasOut ? `<button type="button" class="toggle-output" data-toggle-output="${j.id}">view ›</button>` : ''}</td>`
          + `</tr>`
          + (hasOut
            ? `<tr class="history-output" data-output-row="${j.id}" hidden><td colspan="4"><pre>${safeOutcome}</pre></td></tr>`
            : '');
      }).join('');
      historyBody.innerHTML = rows;
      if (historyMeta) historyMeta.innerHTML = `<span data-numeric>${recent.length}</span> recent runs`;
    };

    let detailsInflight = false;
    const detailsPulse = async () => {
      if (detailsInflight) return;
      detailsInflight = true;
      try {
        const r = await fetch('/PowerShell/Pulse/' + encodeURIComponent(scriptId), { credentials: 'same-origin' });
        if (!r.ok) return;
        const data = await r.json();
        updateRunningStrip(data.running);
        updateOutput(data.running, data.recent);
        renderHistory(data.recent);
      } catch (_) {} finally {
        detailsInflight = false;
      }
    };

    // Faster cadence while a job is running, slower when idle.
    let detailsInterval = null;
    const restartInterval = () => {
      if (detailsInterval) clearInterval(detailsInterval);
      const fast = runningStrip && !runningStrip.hasAttribute('hidden');
      detailsInterval = setInterval(detailsPulse, fast ? 2000 : 5000);
    };
    restartInterval();
    // Re-evaluate cadence after each pulse.
    const observer = new MutationObserver(restartInterval);
    if (runningStrip) observer.observe(runningStrip, { attributes: true, attributeFilter: ['hidden'] });

    // Toggle outcome rows in history.
    detailsRoot.addEventListener('click', (e) => {
      const t = e.target.closest('[data-toggle-output]');
      if (!t) return;
      const id = t.getAttribute('data-toggle-output');
      const row = detailsRoot.querySelector('[data-output-row="' + id + '"]');
      if (!row) return;
      if (row.hasAttribute('hidden')) {
        row.removeAttribute('hidden');
        t.textContent = 'hide ›';
      } else {
        row.setAttribute('hidden', '');
        t.textContent = 'view ›';
      }
    });

    // Generic arm-then-fire submit. Any form with [data-arm-form] gets the same pattern:
    // first submit → button visually arms (style + label swap), 4s decay; second submit fires.
    // Optional [data-armed-label] on the button overrides the confirm label (default: "confirm").
    document.querySelectorAll('[data-arm-form]').forEach((form) => {
      const btn = form.querySelector('[data-arm-btn]') || form.querySelector('button[type="submit"]');
      if (!btn) return;
      let armed = false;
      let armTimer = null;
      if (!btn.dataset.originalLabel) btn.dataset.originalLabel = btn.textContent.trim();
      const armedLabel = btn.dataset.armedLabel || 'confirm';
      const disarm = () => {
        armed = false;
        btn.removeAttribute('data-armed');
        btn.textContent = btn.dataset.originalLabel;
        clearTimeout(armTimer);
      };
      form.addEventListener('submit', (e) => {
        if (!armed) {
          e.preventDefault();
          armed = true;
          btn.setAttribute('data-armed', 'true');
          btn.textContent = armedLabel;
          btn.focus();
          armTimer = setTimeout(disarm, 4000);
        }
      });
    });

    // 'r' shortcut for the launch form specifically.
    const launchForm = document.querySelector('[data-launch-form]');
    if (launchForm) {
      const launchBtn = launchForm.querySelector('[data-launch-btn]');
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'r') return;
        if (isTypingTarget(e.target)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        if (launchBtn && launchBtn.getAttribute('data-armed') !== 'true') {
          launchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        } else if (launchBtn) {
          launchForm.requestSubmit ? launchForm.requestSubmit() : launchForm.submit();
        }
      });
    }
  }

  // ---------- Global keymap ------------------------------------
  let gLeader = false;
  let gTimer = null;
  const armG = () => {
    gLeader = true;
    clearTimeout(gTimer);
    gTimer = setTimeout(() => { gLeader = false; }, 1200);
  };
  const disarmG = () => { gLeader = false; clearTimeout(gTimer); };

  // ---------- Custom select (lp-select) ------------------------
  // Progressive enhancement: any <select data-lp-select> gets a styled trigger
  // + popup listbox so the dropdown matches the design system instead of falling
  // back to the OS-native popup. The native select stays in the DOM (just hidden)
  // so form submission still carries the value.
  function enhanceSelect(select) {
    if (select.dataset.lpEnhanced) return;
    select.dataset.lpEnhanced = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'lp-select';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'lp-select__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const trigText = document.createElement('span');
    trigText.className = 'lp-select__value';
    const trigCaret = document.createElement('span');
    trigCaret.className = 'lp-select__caret';
    trigCaret.setAttribute('aria-hidden', 'true');
    trigCaret.textContent = '▾';
    trigger.appendChild(trigText);
    trigger.appendChild(trigCaret);

    const listbox = document.createElement('ul');
    listbox.className = 'lp-select__listbox';
    listbox.setAttribute('role', 'listbox');
    listbox.hidden = true;

    wrapper.insertBefore(trigger, select);
    wrapper.appendChild(listbox);

    const usableOptions = () =>
      Array.from(select.options).filter((o) => !o.disabled && o.value !== '');

    const updateTrigger = () => {
      const sel = select.options[select.selectedIndex];
      const isEmpty = !sel || sel.value === '' || sel.disabled;
      trigger.classList.toggle('is-empty', isEmpty);
      // Show the placeholder option's text on empty state, otherwise the chosen option.
      const placeholder = Array.from(select.options).find((o) => o.value === '' || o.disabled);
      trigText.textContent = isEmpty
        ? (placeholder ? placeholder.text : 'select…')
        : sel.text;
    };

    let activeIndex = 0;

    const buildListbox = () => {
      listbox.innerHTML = '';
      usableOptions().forEach((opt) => {
        const li = document.createElement('li');
        li.className = 'lp-select__option';
        li.setAttribute('role', 'option');
        li.setAttribute('data-value', opt.value);
        li.textContent = opt.text;
        if (opt.value === select.value) li.classList.add('is-selected');
        listbox.appendChild(li);
      });
    };

    const setActive = (idx) => {
      activeIndex = idx;
      listbox.querySelectorAll('.lp-select__option').forEach((el, i) => {
        el.classList.toggle('is-active', i === idx);
        if (i === idx) el.scrollIntoView({ block: 'nearest' });
      });
    };

    const open = () => {
      buildListbox();
      listbox.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const opts = usableOptions();
      const idx = opts.findIndex((o) => o.value === select.value);
      setActive(idx >= 0 ? idx : 0);
    };

    const close = () => {
      listbox.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    };

    const choose = (idx) => {
      const opts = usableOptions();
      const opt = opts[idx];
      if (!opt) return;
      select.value = opt.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      updateTrigger();
      close();
      trigger.focus();
    };

    trigger.addEventListener('click', () => {
      if (listbox.hidden) open(); else close();
    });

    listbox.addEventListener('click', (e) => {
      const li = e.target.closest('.lp-select__option');
      if (!li) return;
      const idx = Array.from(listbox.children).indexOf(li);
      choose(idx);
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (listbox.hidden) open();
      }
    });

    wrapper.addEventListener('keydown', (e) => {
      if (listbox.hidden) return;
      const opts = usableOptions();
      if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIndex + 1, opts.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
      else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
      else if (e.key === 'End') { e.preventDefault(); setActive(opts.length - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(activeIndex); }
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target) && !listbox.hidden) close();
    });

    updateTrigger();
  }

  document.querySelectorAll('select[data-lp-select]').forEach(enhanceSelect);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel && !panel.hasAttribute('hidden')) {
      toggleShortcuts(false);
      e.preventDefault();
      return;
    }
    if (isTypingTarget(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) {
      // ⌘K / Ctrl+K → open the universal command palette from anywhere. The home
      // page still has `/` to focus the filter; ⌘K is reserved for the palette
      // so the muscle memory works the same on every page.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (typeof openPalette === 'function') openPalette();
      }
      return;
    }
    if (gLeader) {
      const k = e.key.toLowerCase();
      if (k === 'h') { window.location.href = '/'; e.preventDefault(); }
      else if (k === 'a') { window.location.href = '/Scripts/Jobs'; e.preventDefault(); }
      else if (k === 'u') { window.location.href = '/Admin/UserList'; e.preventDefault(); }
      else if (k === 'c') { window.location.href = '/Admin/CategoryList'; e.preventDefault(); }
      disarmG();
      return;
    }
    switch (e.key) {
      case '/':
        if (filterInput) { e.preventDefault(); filterInput.focus(); filterInput.select(); }
        break;
      case 'j':
        if (rows.length) { e.preventDefault(); moveSelection(1); }
        break;
      case 'k':
        if (rows.length) { e.preventDefault(); moveSelection(-1); }
        break;
      case 'Enter':
        if (rows.length && selectedIndex >= 0) { e.preventDefault(); openSelected(); }
        break;
      case '?':
        e.preventDefault();
        toggleShortcuts();
        break;
      case 'g':
        armG();
        break;
    }
  });
})();
