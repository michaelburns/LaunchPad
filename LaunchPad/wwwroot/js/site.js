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

        const colsHtml = cols.map((c, i) => {
          const extra = (hasExtras && i >= VISIBLE_COL_CAP) ? ' data-extra="1"' : '';
          return `<th data-col-idx="${i}"${extra}>${escapeHtml(c)}</th>`;
        }).join('');

        const rowsHtml = rows.map((row) => {
          const tds = cols.map((_, i) => {
            const v = row[i];
            const cls = cellClass(v);
            const text = escapeHtml(cellDisplay(v));
            const title = (v !== null && v !== undefined) ? ` title="${escapeHtml(String(v))}"` : '';
            const extra = (hasExtras && i >= VISIBLE_COL_CAP) ? ' data-extra="1"' : '';
            return `<td class="${cls}"${title}${extra}>${text}</td>`;
          }).join('');
          return `<tr>${tds}</tr>`;
        }).join('');

        const visibleCols = hasExtras ? VISIBLE_COL_CAP : totalCols;
        const moreChip = hasExtras
          ? `<button type="button" class="seg-table__more" data-more aria-pressed="false">+${totalCols - VISIBLE_COL_CAP} more cols</button>`
          : '';
        const filterInput = rows.length > 4
          ? '<input type="search" class="seg-table__filter" placeholder="filter…" autocomplete="off" spellcheck="false" aria-label="Filter rows">'
          : '';

        return ''
          + '<div class="seg-table" data-row-count="' + rows.length + '" data-visible-cap="' + visibleCols + '">'
          + '<div class="seg-table__head">'
          +   `<span class="seg-table__count"><span class="visible-of-total" data-visible-count>${rows.length}</span> / ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}</span>`
          +   moreChip
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

    const renderInto = (raw, mode) => {
      const wasAtBottom = isAtBottom(outputEl);
      const segments = parseSegments(raw);

      let html;
      const isPlaceholder = !raw || raw.length === 0
        || (typeof raw === 'string' && raw.startsWith('$ '));
      const placeholder = !raw || raw.length === 0 ? '$ no output yet' : raw;

      if (segments && segments.length > 0) {
        html = mode === 'raw'
          ? `<pre class="seg-text">${escapeHtml(flattenSegments(segments))}</pre>`
          : renderSegmentsHtml(segments);
      } else {
        // Plain text or pre-feature outcome — render as a single text segment.
        html = `<pre class="seg-text">${escapeHtml(placeholder)}</pre>`;
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
        const moreBtn = e.target.closest('.seg-table__more');
        if (moreBtn) {
          const segTable = moreBtn.closest('.seg-table');
          const showing = segTable.classList.toggle('all-cols');
          moreBtn.classList.toggle('is-active', showing);
          moreBtn.setAttribute('aria-pressed', showing ? 'true' : 'false');
          if (showing) {
            const total = segTable.querySelectorAll('thead th').length;
            moreBtn.textContent = `hide ${total - VISIBLE_COL_CAP} cols`;
          } else {
            const total = segTable.querySelectorAll('thead th').length;
            moreBtn.textContent = `+${total - VISIBLE_COL_CAP} more cols`;
          }
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && filterInput) {
        e.preventDefault();
        filterInput.focus();
        filterInput.select();
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
