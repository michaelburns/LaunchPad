// PowerShell editor — CodeMirror 6 + LaunchPad theme. This file is the bundle
// entry; run `npm run build:editor` to produce wwwroot/lib/codemirror/ps-editor.bundle.js.
// Loaded as a module on Edit and Create pages. The companion <textarea> stays in
// the DOM (form submission carries its value); we mirror CM's doc into it on every change.

import { basicSetup, EditorView } from "codemirror";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { StreamLanguage, syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { tags } from "@lezer/highlight";

const lpTheme = EditorView.theme({
  "&": {
    color: "var(--fg-0)",
    backgroundColor: "oklch(8% 0.012 260)",
    fontFamily: "var(--mono)",
    fontVariationSettings: "var(--rec-mono)",
    fontSize: "var(--t-ui)",
    border: "1px solid var(--rule)",
    borderRadius: "4px",
    minHeight: "420px",
  },
  "&.cm-focused": {
    outline: "none",
    borderColor: "var(--accent)",
    boxShadow: "0 0 0 3px var(--accent-glow)",
  },
  ".cm-scroller": {
    fontFamily: "var(--mono)",
    fontVariationSettings: "var(--rec-mono)",
    lineHeight: "1.6",
  },
  ".cm-content": { caretColor: "var(--accent)", padding: "12px 0" },
  ".cm-line": { padding: "0 12px" },
  ".cm-cursor, .cm-cursor-primary": {
    borderLeftColor: "var(--accent)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "oklch(45% 0.080 60 / 0.45)",
  },
  ".cm-gutters": {
    backgroundColor: "oklch(11% 0.014 260)",
    color: "var(--fg-3)",
    border: "none",
    borderRight: "1px solid var(--rule)",
    fontFamily: "var(--mono)",
    fontVariationSettings: "var(--rec-mono-tight)",
    paddingRight: "6px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "oklch(13% 0.014 260)",
    color: "var(--fg-1)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklab, var(--accent) 5%, transparent)",
  },
  ".cm-matchingBracket": {
    color: "var(--accent)",
    outline: "1px solid color-mix(in oklab, var(--accent) 50%, transparent)",
    backgroundColor: "transparent",
  },
  ".cm-nonmatchingBracket": { color: "var(--fail)" },
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in oklab, var(--warn) 25%, transparent)",
    outline: "1px solid var(--warn)",
  },
  ".cm-tooltip, .cm-panels": {
    backgroundColor: "oklch(17% 0.014 260)",
    color: "var(--fg-1)",
    border: "1px solid var(--rule-strong)",
  },
}, { dark: true });

const lpHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--accent)" },
  { tag: tags.controlKeyword, color: "var(--accent)" },
  { tag: tags.operatorKeyword, color: "var(--accent)" },
  { tag: tags.string, color: "oklch(76% 0.130 80)" },
  { tag: tags.special(tags.string), color: "oklch(76% 0.130 80)" },
  { tag: tags.comment, color: "var(--fg-3)", fontStyle: "italic" },
  { tag: tags.number, color: "oklch(66% 0.090 220)" },
  { tag: tags.bool, color: "oklch(66% 0.090 220)" },
  { tag: tags.null, color: "oklch(66% 0.090 220)" },
  { tag: tags.variableName, color: "var(--fg-0)" },
  { tag: tags.operator, color: "var(--fg-2)" },
  { tag: tags.bracket, color: "var(--fg-2)" },
  { tag: tags.brace, color: "var(--fg-2)" },
  { tag: tags.paren, color: "var(--fg-2)" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "oklch(68% 0.130 145)" },
  { tag: tags.propertyName, color: "var(--fg-1)" },
  { tag: tags.atom, color: "var(--accent)" },
  { tag: tags.invalid, color: "var(--fail)" },
  { tag: tags.meta, color: "var(--fg-2)" },
]);

// ---------- Mount editors -----------------------------------------
const editorViews = new Map();

document.querySelectorAll("[data-script-editor]").forEach((mount) => {
  const targetId = mount.getAttribute("data-target");
  const ta = document.getElementById(targetId);
  if (!ta) return;
  const initial = ta.value || "";

  const view = new EditorView({
    doc: initial,
    extensions: [
      basicSetup,
      StreamLanguage.define(powerShell),
      lpTheme,
      syntaxHighlighting(lpHighlight),
      keymap.of([indentWithTab]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          ta.value = view.state.doc.toString();
          ta.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }),
    ],
    parent: mount,
  });
  editorViews.set(targetId, view);
});

// ---------- Platform-aware kbd hint -------------------------------
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
document.querySelectorAll("[data-kbd-save]").forEach((kbd) => {
  kbd.textContent = isMac ? "⌘S" : "Ctrl+S";
});

// ---------- ⌘S / Ctrl+S submits the author form ------------------
document.addEventListener("keydown", (e) => {
  if (!(e.metaKey || e.ctrlKey)) return;
  if (e.key.toLowerCase() !== "s") return;
  const form = document.querySelector("[data-author-form]");
  if (!form) return;
  e.preventDefault();
  form.requestSubmit ? form.requestSubmit() : form.submit();
});

// ---------- Dirty-state + draft autosave + restore prompt --------
const form = document.querySelector("[data-author-form]");
const draftKey = form ? form.getAttribute("data-draft-key") : null;

if (form) {
  let dirty = false;
  let submitting = false;
  const dot = document.querySelector("[data-dirty-dot]");
  const setDirty = (v) => {
    dirty = v;
    if (dot) {
      if (v) dot.removeAttribute("hidden");
      else dot.setAttribute("hidden", "");
    }
  };
  form.addEventListener("input", () => setDirty(true));
  form.addEventListener("change", () => setDirty(true));
  form.addEventListener("submit", () => {
    submitting = true;
    if (draftKey) {
      try { localStorage.removeItem(draftKey); } catch (_) {}
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (!submitting && dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  // Local draft autosave + restore.
  if (draftKey) {
    const ta = form.querySelector('textarea[name="Script"]');
    const saveDraft = debounce(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          script: ta ? ta.value : "",
          ts: Date.now(),
        }));
      } catch (_) {}
    }, 500);
    form.addEventListener("input", saveDraft);

    // Offer to restore on load if a draft is newer than what the server rendered.
    const restoreSlot = document.querySelector("[data-draft-restore]");
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw && restoreSlot && ta) {
        const draft = JSON.parse(raw);
        if (draft && typeof draft.script === "string" && draft.script !== ta.value && draft.script.trim() !== "") {
          renderRestorePrompt(restoreSlot, draft, ta);
        }
      }
    } catch (_) {}
  }
}

function debounce(fn, ms) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ---------- Live param preview ------------------------------------
// Posts the current editor body to /PowerShell/PreviewParams; the server returns
// the param block as the launch UI would render it. Strips the $ prefix and
// surfaces parse errors as a quiet warning rather than an alarm.
const previewSlot = document.querySelector("[data-params-preview]");
if (form && previewSlot) {
  const tokenInput = form.querySelector('input[name="__RequestVerificationToken"]');
  const ta = form.querySelector('textarea[name="Script"]');

  const fetchPreview = async () => {
    if (!tokenInput || !ta) return;
    const body = ta.value || "";
    try {
      const fd = new URLSearchParams();
      fd.set("body", body);
      fd.set("__RequestVerificationToken", tokenInput.value);
      const res = await fetch("/PowerShell/PreviewParams", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: fd.toString(),
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = await res.json();
      renderPreview(previewSlot, data.parameters || [], data.errors || []);
    } catch (_) {
      // Network blip — leave the previous render visible.
    }
  };
  const debouncedPreview = debounce(fetchPreview, 800);

  // Run once on init so the preview reflects whatever loaded into the editor
  // (scaffold for Create, existing script for Edit).
  fetchPreview();
  form.addEventListener("input", debouncedPreview);
}

function renderPreview(slot, params, errors) {
  slot.classList.remove("is-error", "is-empty");
  if (errors.length > 0) {
    slot.classList.add("is-error");
    slot.removeAttribute("hidden");
    slot.innerHTML =
      `<span class="params-preview__label">syntax</span>`
      + `<span class="params-preview__msg">${escapeHtmlPreview(errors[0].message)} (line ${errors[0].line})</span>`;
    return;
  }
  if (params.length === 0) {
    slot.classList.add("is-empty");
    slot.removeAttribute("hidden");
    slot.innerHTML =
      `<span class="params-preview__label">launch</span>`
      + `<span class="params-preview__msg">no params · launches immediately</span>`;
    return;
  }
  slot.removeAttribute("hidden");
  const pills = params.map((p) =>
    `<span class="arg">`
    + `<span class="arg__k">${escapeHtmlPreview(p.key)}</span>`
    + `<span class="arg__sep">:</span>`
    + `<span class="arg__v">${escapeHtmlPreview(p.type)}</span>`
    + `</span>`
  ).join("");
  slot.innerHTML = `<span class="params-preview__label">launch will ask for</span>${pills}`;
}

function escapeHtmlPreview(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function fmtAgo(ts) {
  const t = (Date.now() - ts) / 1000;
  if (t < 60) return Math.max(0, Math.floor(t)) + "s ago";
  if (t < 3600) return Math.floor(t / 60) + "m ago";
  if (t < 86400) return Math.floor(t / 3600) + "h ago";
  return Math.floor(t / 86400) + "d ago";
}

function renderRestorePrompt(slot, draft, ta) {
  const ago = fmtAgo(draft.ts);
  slot.innerHTML = `
    <span class="draft-pill__label">unsaved draft from ${ago}</span>
    <button type="button" class="draft-pill__action" data-restore>restore</button>
    <button type="button" class="draft-pill__action draft-pill__action--ghost" data-discard>discard</button>
  `;
  slot.removeAttribute("hidden");
  slot.querySelector("[data-restore]").addEventListener("click", () => {
    // Set the textarea, then re-create the editor's doc by re-dispatching an input.
    // Simplest: replace CM doc directly.
    const mount = document.querySelector("[data-script-editor]");
    const targetId = mount && mount.getAttribute("data-target");
    const view = targetId ? editorViews.get(targetId) : null;
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: draft.script },
      });
    } else if (ta) {
      ta.value = draft.script;
    }
    slot.setAttribute("hidden", "");
  });
  slot.querySelector("[data-discard]").addEventListener("click", () => {
    try { localStorage.removeItem(slot.closest("form").getAttribute("data-draft-key")); } catch (_) {}
    slot.setAttribute("hidden", "");
  });
}
