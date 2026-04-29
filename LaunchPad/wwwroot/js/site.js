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
  const firstLineOf = (s) => {
    if (!s) return '';
    const i = s.indexOf('\n');
    let line = i >= 0 ? s.slice(0, i) : s;
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

    let lastOutputLength = outputEl ? outputEl.textContent.length : 0;
    const isAtBottom = (el) => el && (el.scrollHeight - el.scrollTop - el.clientHeight) < 8;

    const updateOutput = (running, recent) => {
      if (!outputEl) return;
      const wasAtBottom = isAtBottom(outputEl);
      let text;
      let meta;
      if (running) {
        text = running.outcome && running.outcome.length > 0 ? running.outcome : '$ waiting for output…';
        meta = 'running · output appears when the run completes';
        outputEl.classList.add('is-running');
      } else if (recent && recent.length > 0) {
        const last = recent[0];
        text = last.outcome && last.outcome.length > 0 ? last.outcome : '$ no output captured';
        meta = 'last run · ' + agoLong(new Date(last.started)) + ' · ' + (last.status || '').toLowerCase();
        outputEl.classList.remove('is-running');
      } else {
        text = '$ no output yet';
        meta = 'no runs yet';
        outputEl.classList.remove('is-running');
      }
      outputEl.classList.toggle('is-empty', text.startsWith('$ '));
      if (text !== outputEl.textContent) {
        outputEl.textContent = text;
        if (wasAtBottom) outputEl.scrollTop = outputEl.scrollHeight;
      }
      if (outputMeta) outputMeta.textContent = meta;
    };

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
