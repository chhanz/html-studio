import { jsx as s, jsxs as a, Fragment as xe } from "react/jsx-runtime";
import { useAppApi as nt, useNavigate as Et, ChatEmbed as At } from "@kirocrew/app-sdk";
import { PageHeader as Ot, Card as _e, CardTitle as Pt } from "@kirocrew/app-sdk/ui";
import { useState as k, useEffect as W, useCallback as U, useRef as X, useMemo as me, useLayoutEffect as Mt } from "react";
const G = "/apps/html-studio/api";
class ee extends Error {
  constructor(t, n, r) {
    super(n ?? t), this.code = t, this.body = r;
  }
}
function Ft(e) {
  var l;
  const t = e;
  if ((l = t == null ? void 0 : t.body) != null && l.error)
    return new ee(t.body.error, t.body.detail, t.body);
  const n = String((t == null ? void 0 : t.message) ?? ""), r = /^API (\d{3}): ([\s\S]*)$/.exec(n);
  if (r) {
    const i = Number(r[1]);
    let d;
    try {
      d = JSON.parse(r[2]);
    } catch {
      d = void 0;
    }
    const u = typeof (d == null ? void 0 : d.error) == "string" && d.error || (i === 502 || i === 503 || i === 504 ? "backend_unavailable" : `http_${i}`);
    return new ee(u, typeof (d == null ? void 0 : d.detail) == "string" ? d.detail : n, d);
  }
  return new ee("request_failed", n || void 0);
}
function Lt(e) {
  const t = async (n) => {
    try {
      return await n;
    } catch (r) {
      throw Ft(r);
    }
  };
  return {
    status: () => t(e.get(`${G}/status`)),
    roots: () => t(e.get(`${G}/roots`)),
    addRoot: (n) => t(e.post(`${G}/roots/add`, { path: n })),
    pickStart: () => t(e.post(`${G}/roots/pick`, {})),
    pickStatus: (n) => t(e.get(`${G}/roots/pick?id=${encodeURIComponent(n)}`)),
    removeRoot: (n) => t(e.post(`${G}/roots/remove`, { path: n })),
    decks: () => t(e.get(`${G}/decks`)),
    previewStart: (n) => t(e.post(`${G}/preview/start`, { path: n })),
    previewStop: (n) => t(e.post(`${G}/preview/stop`, { path: n })),
    buildInfo: (n) => t(e.post(`${G}/build/info`, { path: n })),
    buildAdopt: (n) => t(e.post(`${G}/build/adopt`, { path: n })),
    build: (n, r = !1) => t(e.post(`${G}/build`, { path: n, trust: r })),
    buildStatus: (n) => t(e.get(`${G}/build?id=${encodeURIComponent(n)}`)),
    present: (n, r, l, i) => t(e.post(`${G}/present`, { path: n, slide: r, mode: l, language: i })),
    pdfStart: (n) => t(e.post(`${G}/pdf`, { path: n })),
    pdfStatus: (n) => t(e.get(`${G}/pdf?id=${encodeURIComponent(n)}`)),
    reveal: (n, r) => t(e.post(`${G}/reveal`, { path: n, file: r })),
    notesIndex: (n) => t(e.get(`${G}/notes?path=${encodeURIComponent(n)}`)),
    noteGet: (n, r) => t(e.get(`${G}/note?path=${encodeURIComponent(n)}&slide=${encodeURIComponent(r)}`)),
    sourceGet: (n, r) => t(e.get(`${G}/source?path=${encodeURIComponent(n)}&slide=${encodeURIComponent(r)}`)),
    sourceSave: (n, r, l, i) => t(e.post(`${G}/source`, i === null ? { path: n, slide: r, text: l } : { path: n, slide: r, text: l, mtime: i })),
    slidesReorder: (n, r) => t(e.post(`${G}/slides/reorder`, { path: n, order: r })),
    slidesAdd: (n, r, l = !1, i) => t(e.post(`${G}/slides/add`, i ? { path: n, after: r, duplicate: l, layout: i } : { path: n, after: r, duplicate: l })),
    tweakInfo: (n) => t(e.get(`${G}/design/tweak?path=${encodeURIComponent(n)}`)),
    tweakPreview: (n, r) => t(e.post(`${G}/design/tweak/preview`, { path: n, changes: r })),
    tweakApply: (n, r) => t(e.post(`${G}/design/tweak`, { path: n, changes: r })),
    deckNew: (n) => t(e.post(`${G}/decks/new`, n)),
    layouts: () => t(e.get(`${G}/layouts`)),
    layoutSave: (n, r, l) => t(e.post(`${G}/layouts`, { path: n, slide: r, name: l })),
    layoutDelete: (n) => t(e.post(`${G}/layouts/delete`, { id: n })),
    slidesArchive: (n, r) => t(e.post(`${G}/slides/archive`, { path: n, slide: r })),
    slidesRestore: (n, r, l) => t(e.post(`${G}/slides/restore`, { path: n, name: r, after: l })),
    slidesArchiveList: (n) => t(e.get(`${G}/slides/archive?path=${encodeURIComponent(n)}`)),
    noteSave: (n, r, l) => t(e.post(`${G}/note`, { path: n, slide: r, text: l })),
    checkStart: (n) => t(e.post(`${G}/check`, { path: n })),
    checkStatus: (n) => t(e.get(`${G}/check?id=${encodeURIComponent(n)}`)),
    pinsSend: (n, r, l) => t(e.post(`${G}/pins/send`, { path: n, pins: r, language: l })),
    pinsQueue: (n) => t(e.get(`${G}/pins/queue?path=${encodeURIComponent(n)}`)),
    pinsReply: (n, r, l, i) => t(e.post(`${G}/pins/reply`, { path: n, id: r, cid: l, text: i })),
    pinsDismiss: (n, r) => t(e.post(`${G}/pins/dismiss`, { path: n, id: r })),
    design: (n) => t(e.get(`${G}/design?path=${encodeURIComponent(n)}`)),
    writeTokens: (n) => t(e.post(`${G}/design/tokens`, { path: n }))
  };
}
function F({ active: e, danger: t, disabled: n, style: r, className: l = "", ...i }) {
  const d = t ? "var(--danger)" : e ? "var(--accent)" : "var(--muted)";
  return /* @__PURE__ */ s(
    "button",
    {
      type: "button",
      disabled: n,
      className: `px-2 py-0.5 rounded-md border text-[12px] transition-all ${n ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:text-text"} ${l}`,
      style: {
        borderColor: e ? "var(--accent)" : "var(--border)",
        color: d,
        fontWeight: e ? 600 : 400,
        background: "transparent",
        ...r
      },
      ...i
    }
  );
}
function qt({ t: e, result: t, pendingCommand: n, onTrust: r, onCancelTrust: l, onOpenIssue: i, onDismiss: d }) {
  const [u, c] = k(!1);
  if (n)
    return /* @__PURE__ */ a("div", { className: "rounded-md border p-3 text-[13px] flex flex-col gap-2", style: { borderColor: "var(--warn)" }, role: "dialog", "aria-label": e("build.trust.title"), children: [
      /* @__PURE__ */ s("div", { className: "font-semibold", children: e("build.trust.title") }),
      /* @__PURE__ */ s("p", { className: "m-0 text-muted", children: e("build.trust.body") }),
      /* @__PURE__ */ s(
        "pre",
        {
          className: "m-0 p-2 rounded-md text-[12px] overflow-auto whitespace-pre-wrap break-all",
          style: { background: "var(--bg)", border: "1px solid var(--border)", maxHeight: 160 },
          children: n
        }
      ),
      /* @__PURE__ */ a("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ s(F, { active: !0, onClick: r, children: e("build.trust.accept") }),
        /* @__PURE__ */ s(F, { onClick: l, children: e("build.trust.cancel") })
      ] })
    ] });
  if (!t || t.needsTrust) return null;
  const h = t.ok ? "var(--ok)" : "var(--danger)", m = ((t.durationMs ?? 0) / 1e3).toFixed(1), x = t.issues ?? [], g = [t.stdout, t.stderr].filter(Boolean).join(`
`).trim();
  return /* @__PURE__ */ a("div", { className: "rounded-md border p-3 text-[13px] flex flex-col gap-2", style: { borderColor: h }, role: "status", children: [
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2 flex-wrap", children: [
      /* @__PURE__ */ s("span", { className: "font-semibold", style: { color: h }, children: t.ok ? e("build.ok", { s: m }) : e("build.failed", { s: m }) }),
      /* @__PURE__ */ a("span", { className: "text-muted", children: [
        "· ",
        t.mode === "builtin" ? e("build.mode.builtin") : e("build.mode.external"),
        t.output ? ` · ${t.output}` : ""
      ] }),
      /* @__PURE__ */ a("span", { className: "ml-auto flex gap-1", children: [
        g && !t.ok && /* @__PURE__ */ s(F, { onClick: () => c((v) => !v), active: u, children: e("build.log") }),
        /* @__PURE__ */ s(F, { onClick: d, "aria-label": e("build.dismiss"), children: "✕" })
      ] })
    ] }),
    x.length > 0 && /* @__PURE__ */ s("ul", { className: "m-0 p-0 list-none flex flex-col gap-1", children: x.map((v, C) => /* @__PURE__ */ s("li", { children: /* @__PURE__ */ a(
      "button",
      {
        type: "button",
        onClick: () => i(v.file),
        className: "w-full text-left px-2 py-1 rounded-md cursor-pointer bg-transparent border-0 hover:bg-bg-hover",
        title: e("build.issue.open"),
        children: [
          /* @__PURE__ */ s("span", { className: "font-mono text-[12px]", style: { color: "var(--accent)" }, children: v.file }),
          /* @__PURE__ */ a("span", { className: "text-muted", children: [
            ": ",
            v.message
          ] })
        ]
      }
    ) }, C)) }),
    !t.ok && x.length === 0 && t.stderr && /* @__PURE__ */ s("p", { className: "m-0 text-muted whitespace-pre-wrap break-all", children: t.stderr.split(`
`).slice(-5).join(`
`) }),
    u && g && /* @__PURE__ */ s(
      "pre",
      {
        className: "m-0 p-2 rounded-md text-[11px] overflow-auto whitespace-pre-wrap break-all",
        style: { background: "var(--bg)", border: "1px solid var(--border)", maxHeight: 220 },
        children: g
      }
    )
  ] });
}
const Ce = { error: "var(--danger)", warning: "var(--warn)", info: "var(--muted)" };
function Se(e) {
  return `${e.rule}|${e.slideIndex}|${e.selector}|${e.otherSelector ?? ""}`;
}
function jt({ t: e, result: t, pinned: n, onJump: r, onFix: l, onFixAll: i, onClose: d }) {
  const u = t.issues, c = /* @__PURE__ */ new Map();
  for (const m of u) c.set(m.slideIndex, [...c.get(m.slideIndex) ?? [], m]);
  const h = u.filter((m) => !n.has(Se(m)));
  return /* @__PURE__ */ a("div", { className: "mb-2 rounded-md border border-border p-2 text-[12px]", "data-testid": "check-panel", role: "region", "aria-label": e("toolbar.check"), style: { flex: "0 1 auto", minHeight: 72, maxHeight: "45%", overflowY: "auto" }, children: [
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2 flex-wrap mb-1", children: [
      /* @__PURE__ */ s("span", { className: "font-medium text-text", children: u.length ? e("check.title", { n: u.length }) : e("check.clean", { n: t.slides }) }),
      Object.entries(t.counts).map(([m, x]) => /* @__PURE__ */ a("span", { className: "rounded-sm px-1", style: { border: `1px solid ${Ce[t.rules[m] ?? "info"]}`, color: Ce[t.rules[m] ?? "info"] }, "data-testid": "check-count", "data-rule": m, children: [
        e(`check.rule.${m}`),
        " ",
        x
      ] }, m)),
      t.disabled.length > 0 && /* @__PURE__ */ s("span", { className: "text-muted", children: e("check.disabled", { rules: t.disabled.join(", ") }) }),
      /* @__PURE__ */ a("span", { className: "ml-auto inline-flex gap-1", children: [
        h.length > 0 && /* @__PURE__ */ a(F, { onClick: i, children: [
          e("check.fix_all"),
          " (",
          h.length,
          ")"
        ] }),
        /* @__PURE__ */ s(F, { onClick: d, children: e("check.close") })
      ] })
    ] }),
    u.length > 0 && /* @__PURE__ */ s("ul", { className: "flex flex-col gap-0.5", children: [...c.entries()].map(([m, x]) => /* @__PURE__ */ a("li", { children: [
      /* @__PURE__ */ a("button", { type: "button", className: "text-muted font-medium hover:text-text bg-transparent border-0 cursor-pointer px-0", onClick: () => r(m), children: [
        m + 1,
        ". ",
        x[0].slideFile
      ] }),
      /* @__PURE__ */ s("ul", { className: "ml-3 flex flex-col gap-0.5", children: x.map((g) => {
        const v = Se(g), C = n.has(v);
        return /* @__PURE__ */ a("li", { className: "flex items-start gap-2", "data-testid": "check-issue", "data-rule": g.rule, "data-severity": g.severity, "data-pinned": C ? "true" : "false", children: [
          /* @__PURE__ */ s("span", { className: "flex-none rounded-sm px-1", style: { color: Ce[g.severity], border: `1px solid ${Ce[g.severity]}` }, children: e(`check.rule.${g.rule}`) }),
          /* @__PURE__ */ a("span", { className: "flex-1 min-w-0 text-muted", children: [
            /* @__PURE__ */ a("span", { className: "text-text", children: [
              g.tag,
              g.classes.length ? "." + g.classes.slice(0, 2).join(".") : ""
            ] }),
            g.text ? ` "${g.text.length > 60 ? g.text.slice(0, 57) + "..." : g.text}"` : "",
            g.detail ? ` · ${g.detail}` : ""
          ] }),
          /* @__PURE__ */ s(F, { onClick: () => l(g), disabled: C, title: e("check.fix"), children: C ? "✓" : e("check.fix") })
        ] }, v);
      }) })
    ] }, m)) })
  ] });
}
const Bt = "html-studio-";
async function st(e) {
  const t = new TextEncoder().encode(e), n = await crypto.subtle.digest("SHA-256", t), r = Array.from(new Uint8Array(n), (l) => l.toString(16).padStart(2, "0")).join("");
  return Bt + r.slice(0, 12);
}
function Ht({ deck: e, preview: t, build: n, language: r }) {
  const l = (t == null ? void 0 : t.slides.length) ?? e.slideCount, i = e.kind === "single" ? `single file: ${l} <section class="slide"> blocks in ${e.entry ?? "index.html"}` : `slides folder: ${l} slides in ${e.slidesDir}/ (one <section class="slide"> fragment per file, ordered by filename)`, d = t != null && t.css ? `Stylesheet: ${t.css}` : "Stylesheet: none (the studio applies its default theme)";
  let u = "Build: not applicable";
  n != null && n.command ? u = `Build: run \`${n.command}\`, which writes ${n.output}` : n != null && n.builtin && n.buildable && (u = `Build: HTML Studio's built-in assembler writes ${n.output}`);
  const c = r.startsWith("ko") ? "Korean" : "English";
  return [
    "You are attached to an HTML slide deck managed by HTML Studio.",
    `Deck: ${e.name}`,
    `Path: ${e.path} (this session's project directory)`,
    `Layout: ${i}`,
    d,
    u,
    "",
    "Conventions:",
    "- Edit the slide source files, never the built output.",
    "- Every slide is a 1280×720 stage; keep content inside it.",
    "- Speaker notes belong in notes/<slide>.md, never inside slide HTML.",
    "- No em/en dashes or middle dots (— – · •) in slide text; use plain punctuation or a pipe as a separator.",
    "- The studio previews files as saved; no server restart is needed after edits.",
    ...e.hasDesignMd ? ["- Design rules: follow DESIGN.md in the deck folder (colours, type, spacing, radii). Its CSS variables live in tokens.css (--color-<name>, --font-sans, --space-<name>, --radius-<name>, --type-<name>-size/weight/leading/tracking); use them instead of hard-coded values."] : [],
    `- Answer in ${c} throughout this session unless the user switches language.`,
    "",
    `Reply with a one-line acknowledgement in ${c} and wait for instructions.`
  ].join(`
`);
}
async function zt(e, t) {
  const n = await st(t), r = await e.get("/api/chat/slots");
  return (Array.isArray(r) ? r : []).find((i) => i.key === n) ?? null;
}
async function rt(e, t, n) {
  const r = await st(t.deck.path), l = await e.post("/api/chat/slots", { name: r, agent: "", title: n }), i = (l == null ? void 0 : l.key) || r;
  await e.post(`/api/chat/slots/${encodeURIComponent(i)}/project`, { project: t.deck.path });
  const d = !(l != null && l.messages);
  return d && await e.post("/api/chat?ws=1", { message: Ht(t), slot: i, agent: "" }), { key: i, created: d };
}
function ie({ size: e = 12 }) {
  return /* @__PURE__ */ a(xe, { children: [
    /* @__PURE__ */ s("style", { children: "@keyframes hs-spin { to { transform: rotate(360deg); } }" }),
    /* @__PURE__ */ s(
      "span",
      {
        "aria-hidden": !0,
        className: "inline-block rounded-full",
        style: {
          width: e,
          height: e,
          border: "2px solid var(--border)",
          borderTopColor: "var(--accent)",
          animation: "hs-spin 0.8s linear infinite"
        }
      }
    )
  ] });
}
function Ut({ t: e, locale: t, deck: n, preview: r, build: l, open: i, onToggle: d, refreshKey: u = 0, toolbar: c }) {
  const h = nt(), m = Et(), [x, g] = k("idle"), [v, C] = k(null), [o, S] = k(null);
  W(() => {
    let D = !1;
    if (C(null), S(null), !n) {
      g("idle");
      return;
    }
    return g("checking"), zt(h, n.path).then((E) => {
      D || (E ? (C(E.key), g("ready")) : g("none"));
    }).catch((E) => {
      D || (S(E instanceof Error ? E.message : String(E)), g("error"));
    }), () => {
      D = !0;
    };
  }, [h, n, u]);
  const T = U(async () => {
    if (n) {
      g("checking"), S(null);
      try {
        const { key: D } = await rt(h, { deck: n, preview: r, build: l, language: t }, e("chat.title", { name: n.name }));
        C(D), g("ready");
      } catch (D) {
        S(D instanceof Error ? D.message : String(D)), g("error");
      }
    }
  }, [h, n, r, l, t, e]);
  return /* @__PURE__ */ a("div", { className: "hs-fill min-h-0 flex flex-col", "data-testid": "deck-chat", "data-status": x, children: [
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2 flex-none", children: [
      /* @__PURE__ */ a(
        "button",
        {
          type: "button",
          onClick: d,
          "aria-expanded": i,
          "aria-controls": "deck-chat-body",
          title: e("chat.tagline"),
          className: "flex-1 min-w-0 flex items-center gap-2 py-1 px-1 -mx-1 rounded-md text-[15px] font-semibold text-text-strong hover:bg-bg-hover cursor-pointer bg-transparent border-0 text-left",
          children: [
            /* @__PURE__ */ s(
              "span",
              {
                "aria-hidden": !0,
                className: "inline-flex items-center justify-center w-5 h-5 text-[14px] text-muted transition-transform",
                style: { transform: i ? "rotate(90deg)" : "none" },
                children: "▸"
              }
            ),
            e("panel.chat")
          ]
        }
      ),
      /* @__PURE__ */ a("div", { className: "flex gap-1 items-center flex-none", children: [
        x === "checking" && /* @__PURE__ */ s(ie, {}),
        v && /* @__PURE__ */ a(F, { onClick: () => m(`/chat?sid=${encodeURIComponent(v)}`), title: e("chat.open_full_hint"), children: [
          e("chat.open_full"),
          " ↗"
        ] })
      ] })
    ] }),
    i && /* @__PURE__ */ a("div", { id: "deck-chat-body", className: "hs-fill min-h-0 flex flex-col mt-1", children: [
      n && c,
      !n && /* @__PURE__ */ s("p", { className: "text-sm text-muted", children: e("panel.chat.empty") }),
      n && x === "none" && /* @__PURE__ */ a("div", { className: "flex flex-col items-start gap-2", children: [
        /* @__PURE__ */ s("p", { className: "text-sm text-muted", children: e("chat.none", { name: n.name }) }),
        /* @__PURE__ */ s(F, { onClick: () => void T(), children: e("chat.start") })
      ] }),
      n && x === "error" && /* @__PURE__ */ a("div", { className: "text-[12px]", style: { color: "var(--danger)" }, role: "alert", children: [
        e("chat.failed"),
        /* @__PURE__ */ s("span", { className: "block text-muted break-all", children: o }),
        /* @__PURE__ */ s(F, { onClick: () => void T(), className: "mt-1", children: e("chat.retry") })
      ] }),
      n && x === "ready" && v && /* @__PURE__ */ s("div", { className: "hs-fill min-h-0 flex flex-col", "data-testid": "deck-chat-embed", "data-slot": v, children: /* @__PURE__ */ s(At, { slotKey: v, frameless: !0, startAtBottom: !0, placeholder: e("chat.placeholder", { name: n.name }) }) })
    ] })
  ] });
}
function Kt({ t: e, client: t, deckPath: n, slide: r, slideNumber: l, open: i, onToggle: d, onChanged: u, refreshKey: c = 0 }) {
  const [h, m] = k(""), [x, g] = k(""), [v, C] = k(!1), [o, S] = k("idle"), [T, D] = k(null), [E, N] = k([]), y = X(null), O = X({ deckPath: n, slide: r, text: "" });
  W(() => {
    if (y.current) {
      clearTimeout(y.current), y.current = null;
      const p = O.current;
      p.deckPath && p.slide && t.noteSave(p.deckPath, p.slide, p.text).catch(() => {
      });
    }
    let _ = !0;
    return C(!0), S("idle"), D(null), Promise.all([t.noteGet(n, r), t.notesIndex(n)]).then(([p, $]) => {
      _ && (m(p.text), g(p.file), O.current = { deckPath: n, slide: r, text: p.text }, N($.orphans), u($));
    }).catch((p) => _ && D(p instanceof ee ? p.code : "request_failed")).finally(() => _ && C(!1)), () => {
      _ = !1;
    };
  }, [t, n, r, c]);
  const z = async (_) => {
    S("saving");
    try {
      await t.noteSave(n, r, _);
      const p = await t.notesIndex(n);
      N(p.orphans), u(p), S("saved");
    } catch (p) {
      S("error"), D(p instanceof ee ? p.code : "request_failed");
    }
  }, j = (_) => {
    m(_), O.current = { deckPath: n, slide: r, text: _ }, S("dirty"), y.current && clearTimeout(y.current), y.current = setTimeout(() => {
      y.current = null, z(_);
    }, 800);
  }, w = () => {
    y.current && (clearTimeout(y.current), y.current = null, z(O.current.text));
  };
  W(() => () => w(), []);
  const P = o === "saving" ? e("notes.saving") : o === "saved" ? e("notes.saved") : o === "dirty" ? e("notes.unsaved") : o === "error" ? e("notes.save_failed") : "";
  return /* @__PURE__ */ a("div", { className: "hs-fill min-h-0 flex flex-col", "data-testid": "notes-panel", "data-save": o, children: [
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2 flex-none", children: [
      /* @__PURE__ */ a(
        "button",
        {
          type: "button",
          onClick: d,
          "aria-expanded": i,
          "aria-controls": "notes-body",
          title: e("notes.tagline"),
          className: "flex-1 min-w-0 flex items-center gap-2 py-1 px-1 -mx-1 rounded-md text-[15px] font-semibold text-text-strong hover:bg-bg-hover cursor-pointer bg-transparent border-0 text-left",
          children: [
            /* @__PURE__ */ s("span", { "aria-hidden": !0, className: "inline-flex items-center justify-center w-5 h-5 text-[14px] text-muted transition-transform", style: { transform: i ? "rotate(90deg)" : "none" }, children: "▸" }),
            e("notes.title", { n: l }),
            /* @__PURE__ */ s("span", { className: "font-normal text-[12px] text-muted truncate ml-1", title: e("notes.tagline"), children: i ? x : h.trim() ? e("notes.has") : "" })
          ]
        }
      ),
      /* @__PURE__ */ a("span", { className: "flex-none text-[12px] text-muted inline-flex items-center gap-1", role: "status", children: [
        (v || o === "saving") && /* @__PURE__ */ s(ie, {}),
        P
      ] })
    ] }),
    i && /* @__PURE__ */ a("div", { id: "notes-body", className: "hs-fill min-h-0 flex flex-col mt-1 gap-1", children: [
      /* @__PURE__ */ s(
        "textarea",
        {
          value: h,
          onChange: (_) => j(_.target.value),
          onBlur: w,
          disabled: v,
          placeholder: e("notes.placeholder"),
          "aria-label": e("notes.title", { n: l }),
          spellCheck: !1,
          className: "hs-fill min-h-0 w-full resize-none rounded-md border border-border bg-bg px-2 py-1 text-[13px] text-text font-mono",
          style: { minHeight: 96, lineHeight: 1.5 }
        }
      ),
      /* @__PURE__ */ a("div", { className: "flex items-center gap-2 text-[11px] text-muted flex-none flex-wrap", children: [
        /* @__PURE__ */ s("span", { children: e("notes.hint") }),
        T && /* @__PURE__ */ s("span", { style: { color: "var(--danger)" }, children: e(`error.${T}`) === `error.${T}` ? e("error.generic", { code: T }) : e(`error.${T}`) }),
        E.length > 0 && /* @__PURE__ */ a("span", { className: "ml-auto", title: E.join(", "), "data-testid": "notes-orphans", children: [
          e("notes.orphans", { n: E.length }),
          /* @__PURE__ */ s(F, { className: "ml-1", onClick: () => void t.reveal(n, `notes/${E[0]}`).catch(() => {
          }), children: e("notes.show") })
        ] })
      ] })
    ] })
  ] });
}
const Wt = /^<\/?[A-Za-z][\w:-]*/, Gt = /^[^\s"'<>\/=]+/, Vt = /^\s+/;
function Yt(e) {
  const t = [];
  let n = 0;
  const r = (i, d) => {
    if (!d) return;
    const u = t[t.length - 1];
    u && u[0] === i ? u[1] += d : t.push([i, d]);
  };
  let l = !1;
  for (; n < e.length; ) {
    const i = e.slice(n);
    if (i.startsWith("<!--")) {
      const h = i.indexOf("-->"), m = h < 0 ? i.length : h + 3;
      r("comment", i.slice(0, m)), n += m;
      continue;
    }
    if (l && !/^<\/style/i.test(i)) {
      const h = i.search(/<\/style/i), m = h < 0 ? i : i.slice(0, h);
      Qt(m, r), n += m.length;
      continue;
    }
    const d = Wt.exec(i);
    if (d) {
      r("tag", d[0]), n += d[0].length;
      const h = d[0].replace(/^<\/?/, "").toLowerCase(), m = d[0].startsWith("</");
      for (; n < e.length; ) {
        const x = e.slice(n), g = Vt.exec(x);
        if (g) {
          r("text", g[0]), n += g[0].length;
          continue;
        }
        if (x.startsWith("/>") || x.startsWith(">")) {
          const C = x.startsWith("/>") ? 2 : 1;
          r("tag", x.slice(0, C)), n += C;
          break;
        }
        if (x[0] === "=") {
          r("punct", "="), n += 1;
          continue;
        }
        if (x[0] === '"' || x[0] === "'") {
          const C = x[0], o = x.indexOf(C, 1), S = o < 0 ? x.length : o + 1;
          r("value", x.slice(0, S)), n += S;
          continue;
        }
        const v = Gt.exec(x);
        if (v) {
          r("attr", v[0]), n += v[0].length;
          continue;
        }
        r("text", x[0]), n += 1;
      }
      h === "style" && (l = !m);
      continue;
    }
    if (i[0] === "&") {
      const h = /^&[#\w]+;/.exec(i);
      if (h) {
        r("entity", h[0]), n += h[0].length;
        continue;
      }
    }
    const u = i.slice(1).search(/[<&]/), c = u < 0 ? i.length : u + 1;
    r("text", i.slice(0, c)), n += c;
  }
  return t;
}
function Qt(e, t) {
  let n = 0, r = 0;
  for (; n < e.length; ) {
    const l = e.slice(n);
    if (l.startsWith("/*")) {
      const u = l.indexOf("*/"), c = u < 0 ? l.length : u + 2;
      t("comment", l.slice(0, c)), n += c;
      continue;
    }
    if (l[0] === "{") {
      r++, t("punct", "{"), n++;
      continue;
    }
    if (l[0] === "}") {
      r = Math.max(0, r - 1), t("punct", "}"), n++;
      continue;
    }
    if (r) {
      const u = /^(\s*)([-\w]+)(\s*:\s*)([^;}]*)(;?)/.exec(l);
      if (u) {
        t("text", u[1]), t("css-prop", u[2]), t("punct", u[3]), t("css-value", u[4]), t("punct", u[5]), n += u[0].length;
        continue;
      }
    }
    const i = l.slice(1).search(/[{}]|\/\*/), d = i < 0 ? l.length : i + 1;
    t("text", l.slice(0, d)), n += d;
  }
}
function Ke(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const Jt = {
  comment: "var(--muted)",
  tag: "var(--accent)",
  attr: "var(--warn)",
  value: "var(--ok)",
  entity: "var(--danger)",
  "css-prop": "var(--accent)",
  "css-value": "var(--ok)",
  punct: "var(--muted)"
}, Pe = "12.5px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
function Xt({ t: e, client: t, deckPath: n, slide: r, slideNumber: l, drafts: i, refreshKey: d = 0, onSaved: u }) {
  const [c, h] = k(null), [m, x] = k(""), [g, v] = k("loading"), [C, o] = k(null), [S, T] = k(!1), D = X(null), E = X(null), N = X(m);
  N.current = m;
  const y = X(g);
  y.current = g;
  const O = U(
    async (f, b = !1) => {
      b || v("loading"), o(null), T(!1);
      try {
        const R = await t.sourceGet(n, r);
        h(R);
        const M = f ? i.get(r) : void 0;
        M && M.text !== R.text ? (x(M.text), v("dirty")) : (i.delete(r), x(R.text), (!b || R.text !== N.current || y.current === "loading") && v("clean"));
      } catch (R) {
        o(R instanceof ee ? R.code : "request_failed"), v("error");
      }
    },
    [t, n, r, i]
  );
  W(() => {
    O(!0);
  }, [O]);
  const z = X(!0);
  W(() => {
    if (z.current) {
      z.current = !1;
      return;
    }
    O(!0, !0);
  }, [d]);
  const j = g === "dirty" || g === "saving" && i.has(r), w = (f) => {
    x(f), c && (f === c.text ? (i.delete(r), v("clean")) : (i.set(r, { text: f, mtime: c.mtime }), v("dirty")));
  }, P = U(
    async (f = !1) => {
      if (!c) return;
      const b = N.current;
      v("saving"), o(null);
      try {
        const R = await t.sourceSave(n, r, b, f ? null : c.mtime);
        i.delete(r), h({ ...c, text: b, mtime: R.mtime }), T(!1), v("saved"), u(R);
      } catch (R) {
        const M = R instanceof ee ? R.code : "request_failed";
        if (M === "conflict") {
          T(!0), v("dirty");
          return;
        }
        o(M), v("error");
      }
    },
    [t, n, r, c, i, u]
  ), _ = (f) => {
    if (f.key === "Tab" && !f.metaKey && !f.ctrlKey && !f.altKey) {
      f.preventDefault();
      const b = f.currentTarget, { selectionStart: R, selectionEnd: M, value: V } = b;
      if (f.shiftKey) {
        const Y = V.lastIndexOf(`
`, R - 1) + 1, Q = V.slice(Y, Y + 2) === "  " ? 2 : V[Y] === " " ? 1 : 0;
        if (!Q) return;
        const re = V.slice(0, Y) + V.slice(Y + Q);
        w(re), requestAnimationFrame(() => b.setSelectionRange(Math.max(Y, R - Q), Math.max(Y, M - Q)));
      } else {
        const Y = V.slice(0, R) + "  " + V.slice(M);
        w(Y), requestAnimationFrame(() => b.setSelectionRange(R + 2, R + 2));
      }
    }
  }, p = me(() => {
    const f = Yt(m).map(([b, R]) => b === "text" ? Ke(R) : `<span style="color:${Jt[b]}${b === "comment" ? ";font-style:italic" : ""}">${Ke(R)}</span>`).join("");
    return m.endsWith(`
`) || m === "" ? f + " " : f;
  }, [m]), $ = me(() => m.split(`
`).length, [m]);
  Mt(() => {
    const f = D.current, b = E.current;
    !f || !b || (f.style.width = `${b.offsetWidth}px`, f.style.height = `${b.offsetHeight}px`);
  }, [p]);
  const A = g === "loading" ? e("code.loading") : g === "saving" ? e("code.saving") : g === "saved" ? e("code.saved") : g === "dirty" ? e("code.unsaved") : g === "error" ? e("code.error", { code: C ?? "" }) : "";
  return /* @__PURE__ */ a("div", { className: "flex flex-col min-h-0 flex-1", "data-testid": "code-editor", children: [
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2 mb-1 flex-none text-[12px]", children: [
      /* @__PURE__ */ a("span", { className: "font-medium truncate", children: [
        e("code.title", { n: l }),
        j && /* @__PURE__ */ s("span", { "aria-label": e("code.unsaved"), children: " ●" })
      ] }),
      /* @__PURE__ */ s("span", { className: "text-muted truncate", children: (c == null ? void 0 : c.file) ?? "" }),
      /* @__PURE__ */ s("span", { className: "flex-1" }),
      /* @__PURE__ */ a("span", { className: "text-muted", role: "status", "aria-live": "polite", children: [
        g === "saving" && /* @__PURE__ */ s(ie, {}),
        " ",
        A
      ] }),
      /* @__PURE__ */ s(F, { onClick: () => void O(!1), disabled: g === "loading" || g === "saving", title: e("code.reload_hint"), children: e("code.reload") }),
      /* @__PURE__ */ s(F, { onClick: () => void P(), active: g === "dirty", disabled: g !== "dirty", title: e("code.save_hint"), children: e("code.save") })
    ] }),
    S && /* @__PURE__ */ a("div", { className: "flex items-center gap-2 mb-1 flex-none text-[12px] rounded-md border px-2 py-1", role: "alert", style: { borderColor: "var(--warn)", color: "var(--warn)" }, children: [
      /* @__PURE__ */ s("span", { className: "flex-1", children: e("code.conflict") }),
      /* @__PURE__ */ s(F, { onClick: () => void O(!1), children: e("code.conflict_reload") }),
      /* @__PURE__ */ s(F, { danger: !0, onClick: () => void P(!0), children: e("code.conflict_overwrite") })
    ] }),
    /* @__PURE__ */ s("div", { className: "flex-1 min-h-0 rounded-md border border-border overflow-auto", style: { background: "var(--bg)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start", style: { minHeight: "100%" }, children: [
      /* @__PURE__ */ s("div", { "aria-hidden": !0, className: "select-none text-right flex-none px-2 py-2", style: { font: Pe, color: "var(--muted)", borderRight: "1px solid var(--border)", background: "var(--bg-hover)" }, children: Array.from({ length: $ }, (f, b) => /* @__PURE__ */ s("div", { children: b + 1 }, b)) }),
      /* @__PURE__ */ a("div", { className: "relative flex-1", style: { minWidth: 0 }, children: [
        /* @__PURE__ */ s(
          "pre",
          {
            ref: E,
            "aria-hidden": !0,
            className: "m-0 px-3 py-2 inline-block",
            style: { font: Pe, whiteSpace: "pre", minWidth: "100%", color: "var(--text)", tabSize: 2 },
            dangerouslySetInnerHTML: { __html: p }
          }
        ),
        /* @__PURE__ */ s(
          "textarea",
          {
            ref: D,
            value: m,
            onChange: (f) => w(f.target.value),
            onKeyDown: _,
            spellCheck: !1,
            autoCapitalize: "off",
            autoCorrect: "off",
            wrap: "off",
            disabled: g === "loading",
            "aria-label": e("code.title", { n: l }),
            className: "absolute left-0 top-0 m-0 px-3 py-2 border-0 outline-none resize-none overflow-hidden bg-transparent",
            style: { font: Pe, whiteSpace: "pre", color: "transparent", caretColor: "var(--text)", tabSize: 2, minWidth: "100%" }
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ s("div", { className: "text-[11px] text-muted mt-1 flex-none", children: e("code.hint") })
  ] });
}
function We(e) {
  return e.replace(/^\/Users\/[^/]+|^\/home\/[^/]+/, "~");
}
function Zt(e, t) {
  try {
    return new Intl.DateTimeFormat(t, { dateStyle: "medium", timeStyle: "short" }).format(e * 1e3);
  } catch {
    return new Date(e * 1e3).toLocaleString();
  }
}
function en(e) {
  const { t } = e, [n, r] = k(!1), [l, i] = k(!1), [d, u] = k(""), [c, h] = k(!1), m = async () => {
    if (d.trim()) {
      h(!0);
      try {
        await e.onAddRoot(d.trim()), u(""), i(!1);
      } finally {
        h(!1);
      }
    }
  }, x = async () => {
    h(!0);
    try {
      await e.onAddRoot();
    } finally {
      h(!1);
    }
  }, g = (o) => e.pickerSupported ? /* @__PURE__ */ a(F, { onClick: x, disabled: c || !e.connected, active: o, className: "inline-flex items-center gap-1.5", "data-testid": "folder-register", children: [
    c && /* @__PURE__ */ s(ie, {}),
    t(c ? "roots.picking" : "roots.add")
  ] }) : /* @__PURE__ */ s(F, { onClick: () => i((S) => !S), active: o || l, disabled: c || !e.connected, "data-testid": "folder-register", children: t("roots.add") }), v = l && /* @__PURE__ */ a(
    "form",
    {
      className: "flex gap-1",
      onSubmit: (o) => {
        o.preventDefault(), m();
      },
      children: [
        /* @__PURE__ */ s(
          "input",
          {
            autoFocus: !0,
            value: d,
            onChange: (o) => u(o.target.value),
            placeholder: t("roots.path_placeholder"),
            "aria-label": t("roots.add"),
            className: "flex-1 min-w-0 px-2 py-1 rounded-md border text-[12px]",
            style: { borderColor: "var(--border)", background: "var(--bg)", color: "var(--text)" }
          }
        ),
        /* @__PURE__ */ s(F, { active: !0, type: "submit", disabled: c || !d.trim(), children: t("roots.confirm") })
      ]
    }
  ), C = e.roots.length > 0;
  return /* @__PURE__ */ a("div", { className: "flex flex-col gap-2 text-[13px]", children: [
    C && /* @__PURE__ */ a("div", { className: "flex flex-col gap-1", "data-testid": "folders", children: [
      /* @__PURE__ */ a("div", { className: "flex items-center gap-2 text-[12px] text-muted", children: [
        /* @__PURE__ */ a("span", { className: "truncate flex-1", title: e.roots.join(`
`), children: [
          t("roots.summary", { first: We(e.roots[0]), more: e.roots.length - 1 }),
          e.roots.length > 1 ? ` (+${e.roots.length - 1})` : ""
        ] }),
        /* @__PURE__ */ s(F, { onClick: () => r((o) => !o), active: n, "aria-expanded": n, "aria-controls": "folders-body", style: { padding: "0 6px" }, children: t("roots.manage") })
      ] }),
      n && /* @__PURE__ */ a("div", { id: "folders-body", className: "flex flex-col gap-1 rounded-md border border-border p-2", children: [
        /* @__PURE__ */ s("ul", { className: "flex flex-col gap-1 m-0 p-0 list-none", children: e.roots.map((o) => /* @__PURE__ */ a("li", { className: "flex items-center gap-2 text-[12px] text-muted", title: o, children: [
          /* @__PURE__ */ s("span", { className: "truncate flex-1", children: We(o) }),
          /* @__PURE__ */ s(F, { danger: !0, onClick: () => e.onRemoveRoot(o), "aria-label": `${t("roots.remove")} ${o}`, style: { padding: "0 6px" }, children: t("roots.remove") })
        ] }, o)) }),
        /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-1", children: [
          g(!1),
          /* @__PURE__ */ a(F, { onClick: () => e.onRefresh(), disabled: c || e.loading || !e.connected, className: "inline-flex items-center gap-1.5", title: t("roots.rescan_hint"), children: [
            e.loading && !c && /* @__PURE__ */ s(ie, {}),
            t("roots.rescan")
          ] })
        ] }),
        v,
        /* @__PURE__ */ s("p", { className: "m-0 text-[11px] text-muted", children: t("roots.hint") })
      ] })
    ] }),
    C && e.onNew && /* @__PURE__ */ s(F, { onClick: e.onNew, disabled: c || !e.connected, active: !0, "data-testid": "deck-new", className: "self-start", children: t("newdeck.button") }),
    e.error && /* @__PURE__ */ a("p", { className: "m-0 text-[12px]", style: { color: "var(--danger)" }, role: "alert", children: [
      t(`error.${e.error}`) === `error.${e.error}` ? t("error.generic", { code: e.error }) : t(`error.${e.error}`),
      e.errorDetail && t(`error.${e.error}`) === `error.${e.error}` ? /* @__PURE__ */ s("span", { className: "block text-muted break-all", children: e.errorDetail }) : null
    ] }),
    e.connected ? C ? e.loading && e.decks.length === 0 ? /* @__PURE__ */ s("p", { className: "m-0 text-muted", children: t("decks.loading") }) : e.decks.length === 0 ? /* @__PURE__ */ s("p", { className: "m-0 text-muted", children: t("decks.none_found") }) : /* @__PURE__ */ s("ul", { className: "flex flex-col gap-1 m-0 p-0 list-none", role: "listbox", "aria-label": t("panel.decks"), children: e.decks.map((o) => {
      const S = o.id === e.selectedId;
      return /* @__PURE__ */ s("li", { children: /* @__PURE__ */ a(
        "button",
        {
          type: "button",
          role: "option",
          "aria-selected": S,
          onClick: () => e.onSelect(o),
          title: o.path,
          className: "w-full text-left px-2 py-1.5 rounded-md border cursor-pointer transition-all",
          style: {
            borderColor: S ? "var(--accent)" : "var(--border)",
            background: S ? "var(--bg-hover)" : "transparent",
            color: "var(--text)"
          },
          children: [
            /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ s("span", { className: "font-medium truncate flex-1", children: o.name }),
              /* @__PURE__ */ s("span", { className: "text-[11px] text-muted whitespace-nowrap", children: t("decks.slide_count", { n: o.slideCount }) })
            ] }),
            /* @__PURE__ */ a("div", { className: "text-[11px] text-muted truncate", children: [
              Zt(o.modifiedAt, e.locale),
              o.kind === "single" ? ` · ${t("decks.kind.single")}` : "",
              o.hasDesignMd ? " · DESIGN.md" : "",
              o.hasStudioJson ? " · studio.json" : ""
            ] })
          ]
        }
      ) }, o.id);
    }) }) : /* @__PURE__ */ a("div", { className: "flex flex-col gap-2 rounded-md border p-3", style: { borderStyle: "dashed" }, "data-testid": "folders-empty", children: [
      /* @__PURE__ */ s("p", { className: "m-0 text-muted", children: t("panel.decks.empty") }),
      /* @__PURE__ */ s("div", { children: g(!0) }),
      v
    ] }) : /* @__PURE__ */ a("p", { className: "m-0 text-muted inline-flex items-center gap-2", children: [
      /* @__PURE__ */ s(ie, {}),
      " ",
      t("status.connecting")
    ] })
  ] });
}
function tn(e) {
  const t = e.classes.length ? "." + e.classes.slice(0, 2).join(".") : "", n = e.elementId ? `#${e.elementId}` : "";
  return `${e.tag}${n}${t}`;
}
function ot(e, t, n) {
  return {
    ...e,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    index: n,
    slideFile: t,
    comment: "",
    status: "new",
    createdAt: Date.now()
  };
}
const Fe = "hs.pins.";
function nn(e) {
  try {
    const t = localStorage.getItem(Fe + e), n = t ? JSON.parse(t) : null;
    return Array.isArray(n) ? n : [];
  } catch {
    return [];
  }
}
function sn(e, t) {
  try {
    t.length ? localStorage.setItem(Fe + e, JSON.stringify(t)) : localStorage.removeItem(Fe + e);
  } catch {
  }
}
const Me = {
  new: "var(--accent)",
  sent: "var(--warn)",
  done: "var(--ok)",
  question: "var(--danger)"
};
function rn({ t: e, pins: t, current: n, activeId: r, sending: l, sendError: i, onComment: d, onRemove: u, onJump: c, onClearAll: h, onSend: m, onReply: x, onDismissDone: g }) {
  if (t.length === 0) return null;
  const v = t.filter((S) => S.status === "new"), C = v.some((S) => !S.comment.trim()), o = t.filter((S) => S.status === "done");
  return /* @__PURE__ */ a("div", { className: "mt-2 rounded-md border border-border p-2 text-[12px]", "data-testid": "pins-panel", style: { flex: "0 1 auto", minHeight: 96, maxHeight: "45%", overflowY: "auto" }, children: [
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2 mb-1 flex-wrap", children: [
      /* @__PURE__ */ s("span", { className: "font-medium text-text", children: e("pins.title", { n: t.length }) }),
      /* @__PURE__ */ s("span", { className: "text-muted", children: i ? /* @__PURE__ */ a("span", { style: { color: "var(--danger)" }, children: [
        e("pins.send_failed"),
        ": ",
        i
      ] }) : C && v.length ? e("pins.need_comment") : e("pins.hint") }),
      /* @__PURE__ */ a("span", { className: "ml-auto inline-flex gap-1", children: [
        o.length > 0 && /* @__PURE__ */ s(F, { onClick: g, children: e("pins.dismiss_done") }),
        /* @__PURE__ */ s(F, { onClick: h, children: e("pins.clear") }),
        /* @__PURE__ */ a(
          F,
          {
            active: !0,
            onClick: m,
            disabled: l || v.length === 0 || C,
            title: e("pins.send_hint"),
            className: "inline-flex items-center gap-1",
            "data-testid": "pins-send",
            children: [
              l && /* @__PURE__ */ s(ie, {}),
              l ? e("pins.sending") : `${e("pins.send")} (${v.length})`
            ]
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ s("ul", { className: "flex flex-col gap-1", children: t.map((S) => /* @__PURE__ */ s(on, { t: e, pin: S, current: n, active: S.id === r, onComment: d, onRemove: u, onJump: c, onReply: x }, S.id)) })
  ] });
}
function on({ t: e, pin: t, current: n, active: r, onComment: l, onRemove: i, onJump: d, onReply: u }) {
  const [c, h] = k(""), m = t.status !== "new";
  return /* @__PURE__ */ a(
    "li",
    {
      "data-testid": "pin",
      "data-pin-id": t.id,
      "data-status": t.status,
      "data-how": t.how ?? "",
      className: "flex items-start gap-2 rounded-md p-1",
      style: { background: r ? "var(--bg-hover)" : void 0 },
      children: [
        /* @__PURE__ */ s(
          "button",
          {
            type: "button",
            onClick: () => d(t.slideIndex, t.id),
            className: "flex-none rounded-full text-white text-[11px] font-semibold",
            style: { width: 20, height: 20, lineHeight: "20px", background: Me[t.status], textAlign: "center" },
            title: e("pins.jump", { n: t.slideIndex + 1 }),
            "aria-label": e("pins.jump", { n: t.slideIndex + 1 }),
            children: t.index
          }
        ),
        /* @__PURE__ */ a("div", { className: "flex-1 min-w-0", children: [
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2 text-muted truncate", children: [
            /* @__PURE__ */ s("span", { className: "text-text", children: t.slideFile }),
            /* @__PURE__ */ s("span", { className: "truncate", title: t.selector, children: tn(t) }),
            t.text && /* @__PURE__ */ a("span", { className: "truncate", children: [
              '"',
              t.text,
              '"'
            ] }),
            /* @__PURE__ */ s("span", { className: "ml-auto flex-none rounded-sm px-1", style: { color: Me[t.status], border: `1px solid ${Me[t.status]}` }, "data-testid": "pin-status", children: e(`pins.status.${t.status}`) }),
            t.slideIndex === n && t.how && t.how !== "cid" && t.how !== "selector" && /* @__PURE__ */ s("span", { style: { color: "var(--warn)" }, children: t.how === "lost" ? e("pins.lost") : e("pins.moved") })
          ] }),
          m ? /* @__PURE__ */ s("div", { className: "mt-1 text-text", children: t.comment }) : /* @__PURE__ */ s(
            "input",
            {
              type: "text",
              value: t.comment,
              onChange: (x) => l(t.id, x.target.value),
              placeholder: e("pins.placeholder"),
              "aria-label": e("pins.comment_for", { n: t.index }),
              autoFocus: r && !t.comment,
              className: "mt-1 w-full rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-text"
            }
          ),
          t.thread && t.thread.length > 0 && /* @__PURE__ */ s("ul", { className: "mt-1 flex flex-col gap-0.5", "data-testid": "pin-thread", children: t.thread.map((x, g) => /* @__PURE__ */ a("li", { className: x.role === "agent" ? "text-muted" : "text-text", children: [
            x.role === "agent" ? "↳ " : "↪ ",
            x.text
          ] }, g)) }),
          t.status === "question" && /* @__PURE__ */ a(
            "form",
            {
              className: "mt-1 flex gap-1",
              onSubmit: (x) => {
                x.preventDefault(), c.trim() && (u(t.id, c.trim()), h(""));
              },
              children: [
                /* @__PURE__ */ s(
                  "input",
                  {
                    type: "text",
                    value: c,
                    onChange: (x) => h(x.target.value),
                    placeholder: e("pins.reply_placeholder"),
                    "aria-label": e("pins.reply_placeholder"),
                    className: "flex-1 rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-text"
                  }
                ),
                /* @__PURE__ */ s(F, { type: "submit", disabled: !c.trim(), children: e("pins.reply") })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ s(F, { onClick: () => i(t.id), "aria-label": e("pins.remove"), title: e("pins.remove"), children: "×" })
      ]
    }
  );
}
const Ge = 1280, Ve = 720;
function an({ t: e, url: t, baseUrl: n, startSlide: r, slideCount: l, onClose: i, openPresenter: d, onPosition: u }) {
  const c = X(null), h = X(null), [m, x] = k(r), g = X(m);
  g.current = m;
  const v = `${n}/present/state`, C = X(-1), [o, S] = k(!1), T = X(o);
  T.current = o;
  const [D, E] = k(!1), N = X({}), y = X(null), O = X(null), z = U(() => {
    const L = y.current, q = O.current;
    if (!L || !q) return;
    const B = q.getBoundingClientRect(), J = window.devicePixelRatio || 1;
    (L.width !== Math.round(B.width * J) || L.height !== Math.round(B.height * J)) && (L.width = Math.round(B.width * J), L.height = Math.round(B.height * J));
    const Z = L.getContext("2d");
    if (!Z) return;
    Z.setTransform(1, 0, 0, 1, 0, 0), Z.clearRect(0, 0, L.width, L.height);
    const I = Math.min(B.width / Ge, B.height / Ve);
    Z.setTransform(I * J, 0, 0, I * J, (B.width - Ge * I) / 2 * J, (B.height - Ve * I) / 2 * J), Z.strokeStyle = "#ef4444", Z.lineWidth = 4, Z.lineCap = "round", Z.lineJoin = "round";
    for (const H of N.current[String(g.current - 1)] || [])
      if (H.pts.length) {
        Z.beginPath(), Z.moveTo(H.pts[0][0], H.pts[0][1]), H.pts.length === 1 && Z.lineTo(H.pts[0][0] + 0.1, H.pts[0][1]);
        for (let ae = 1; ae < H.pts.length; ae++) Z.lineTo(H.pts[ae][0], H.pts[ae][1]);
        Z.stroke();
      }
    L.dataset.strokes = String((N.current[String(g.current - 1)] || []).length);
  }, []), j = U((L) => {
    const q = N.current;
    if (L.op === "reset") {
      N.current = {};
      return;
    }
    const B = String(L.slide);
    if (L.op === "clear") {
      delete q[B];
      return;
    }
    const J = q[B] || (q[B] = []);
    if (L.op === "start") J.push({ id: L.id, pts: L.pts.slice() });
    else {
      const Z = J.find((I) => I.id === L.id);
      Z && Z.pts.push(...L.pts);
    }
  }, []), w = X(0), P = U(
    (L) => {
      w.current += 1, fetch(v, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: "audience", ...L }) }).then((q) => q.json()).then((q) => {
        C.current = q.seq;
      }).catch(() => {
      }).finally(() => {
        w.current -= 1;
      });
    },
    [v]
  ), [_, p] = k(!1), [$, A] = k(!0), [f, b] = k(null), R = X(null);
  R.current = f;
  const M = X(null), V = X(!1), Y = X(!1), Q = `${t}?hs=present`, re = U(() => {
    V.current || (V.current = !0, i(), document.fullscreenElement && document.exitFullscreen().catch(() => {
    }));
  }, [i]), te = U(() => {
    const L = c.current;
    if (!L) return;
    const q = () => L.requestFullscreen().catch(() => {
    }), B = document.fullscreenElement;
    B !== L && (B ? document.exitFullscreen().then(q, q) : q());
  }, []), oe = U((L) => {
    var q, B;
    (B = (q = h.current) == null ? void 0 : q.contentWindow) == null || B.postMessage(L, "*");
  }, []), ne = U(
    (L) => {
      const q = Math.max(1, Math.min(l || L, L));
      x(q), P({ index: q - 1 }), oe({ type: "hs-go", index: q - 1 });
      const B = h.current;
      B && (B.src = `${Q}#${q}`);
    },
    [P, oe, l, Q]
  );
  W(() => {
    z();
  }, [m, z]);
  const pe = U((L) => {
    const q = h.current;
    if (!q) return;
    const B = q.getBoundingClientRect();
    oe({ type: "hs-hit", x: L.clientX - B.left, y: L.clientY - B.top });
  }, [oe]);
  W(() => {
    let L = !0, q = !1;
    fetch(v, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: "audience", index: r - 1, black: !1, ink: { op: "reset" } }) }).then((H) => H.json()).then((H) => {
      C.current = H.seq;
    }).catch(() => {
    }).finally(() => {
      q = !0;
    }), d == null || d(r);
    const B = (H) => {
      var ae;
      if (L && (E(H.presenter), H.ink ? (N.current = H.ink, z()) : (ae = H.ink_ops) != null && ae.length && (H.ink_ops.forEach(j), z()), H.seq !== C.current)) {
        if (C.current = H.seq, typeof H.index == "number" && H.index + 1 !== g.current) {
          const he = H.index + 1;
          x(he), oe({ type: "hs-go", index: H.index });
          const ve = h.current;
          ve && (ve.src = `${Q}#${he}`);
        }
        typeof H.black == "boolean" && H.black !== T.current && S(H.black);
      }
    };
    let J = null;
    try {
      J = new EventSource(`${n}/present/events`), J.onmessage = (H) => {
        if (!(!q || w.current > 0))
          try {
            B(JSON.parse(H.data));
          } catch {
          }
      };
    } catch {
      J = null;
    }
    const Z = async () => {
      if (!(!q || w.current > 0))
        try {
          B(await (await fetch(v)).json());
        } catch {
        }
    };
    Z();
    const I = setInterval(Z, J ? 1e3 : 100);
    return window.addEventListener("resize", z), () => {
      L = !1, clearInterval(I), J == null || J.close(), window.removeEventListener("resize", z), fetch(v, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: "audience", ink: { op: "reset" } }), keepalive: !0 }).catch(() => {
      }), u == null || u(g.current);
    };
  }, []), W(() => {
    var J;
    (J = c.current) == null || J.focus(), te();
    const L = () => {
      const Z = !!document.fullscreenElement;
      p(Z), Z ? Y.current = !0 : Y.current && re();
    };
    document.addEventListener("fullscreenchange", L);
    let q = !1;
    const B = setInterval(() => {
      if (V.current) return;
      window.innerHeight >= screen.height - 40 && window.innerWidth >= screen.width - 40 ? q = !0 : q && re();
    }, 250);
    return () => {
      document.removeEventListener("fullscreenchange", L), clearInterval(B), document.fullscreenElement && document.exitFullscreen().catch(() => {
      });
    };
  }, []), W(() => {
    const L = (q) => {
      var J;
      const B = q.data;
      q.source !== ((J = h.current) == null ? void 0 : J.contentWindow) || !B || (B.type === "hs-slide" && typeof B.index == "number" ? x(B.index + 1) : B.type === "hs-exit" ? re() : B.type === "hs-zoom" && B.kind === "img" && typeof B.src == "string" ? b({ kind: "img", src: B.src, alt: B.alt ?? "" }) : B.type === "hs-zoom" && B.kind === "svg" && typeof B.svg == "string" && b({ kind: "svg", svg: B.svg }));
    };
    return window.addEventListener("message", L), () => window.removeEventListener("message", L);
  }, [re]), W(() => {
    const L = (q) => {
      if (!(q.metaKey || q.ctrlKey || q.altKey)) {
        if (q.key === "Escape")
          R.current ? b(null) : re();
        else if (q.key === "ArrowRight" || q.key === "PageDown" || q.key === " " || q.key === "Enter")
          b(null), ne(m + 1);
        else if (q.key === "ArrowLeft" || q.key === "PageUp" || q.key === "Backspace")
          b(null), ne(m - 1);
        else if (q.key === "Home") ne(1);
        else if (q.key === "End") ne(l);
        else return;
        q.preventDefault(), q.stopPropagation();
      }
    };
    return window.addEventListener("keydown", L, !0), () => window.removeEventListener("keydown", L, !0);
  }, [m, ne, re, l]);
  const fe = () => {
    A(!0), M.current && clearTimeout(M.current), M.current = setTimeout(() => A(!1), 2500);
  };
  W(() => (fe(), () => {
    M.current && clearTimeout(M.current);
  }), []);
  const le = { color: "#ddd", borderColor: "#555" };
  return /* @__PURE__ */ a(
    "div",
    {
      ref: c,
      role: "dialog",
      "aria-label": e("present.title"),
      tabIndex: -1,
      onMouseMove: fe,
      className: "fixed inset-0 flex flex-col outline-none",
      style: { zIndex: 1e3, background: "#000", cursor: $ ? "default" : "none" },
      children: [
        /* @__PURE__ */ a("div", { ref: O, className: "flex-1 w-full h-full relative min-h-0", children: [
          /* @__PURE__ */ s(
            "iframe",
            {
              ref: h,
              src: `${Q}#${r}`,
              title: e("present.title"),
              sandbox: "allow-scripts allow-same-origin",
              tabIndex: -1,
              className: "absolute inset-0 w-full h-full border-0"
            }
          ),
          /* @__PURE__ */ s("canvas", { ref: y, "data-testid": "present-ink", "aria-hidden": !0, className: "absolute inset-0 w-full h-full pointer-events-none", style: { zIndex: 5 } }),
          o && /* @__PURE__ */ s("div", { "data-testid": "present-black", className: "absolute inset-0", style: { background: "#000", zIndex: 6 } })
        ] }),
        /* @__PURE__ */ s("div", { "data-testid": "present-shield", className: "absolute inset-0", onClick: pe }),
        f && /* @__PURE__ */ s(
          "div",
          {
            "data-testid": "present-zoom",
            role: "img",
            "aria-label": f.kind === "img" && f.alt || e("present.zoom"),
            className: "absolute inset-0 flex items-center justify-center",
            style: { background: "rgba(0,0,0,.92)", cursor: "zoom-out" },
            onClick: () => b(null),
            children: f.kind === "img" ? /* @__PURE__ */ s("img", { src: f.src, alt: f.alt, style: { maxWidth: "96vw", maxHeight: "96vh", objectFit: "contain" } }) : /* @__PURE__ */ s("img", { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(f.svg)}`, alt: "", style: { maxWidth: "96vw", maxHeight: "96vh", objectFit: "contain" } })
          }
        ),
        /* @__PURE__ */ a(
          "div",
          {
            className: "absolute left-0 right-0 bottom-0 flex items-center gap-2 px-3 py-2 text-[12px] transition-opacity",
            style: { background: "rgba(0,0,0,.6)", color: "#ddd", opacity: $ ? 1 : 0, zIndex: 10 },
            children: [
              /* @__PURE__ */ s(F, { onClick: () => ne(m - 1), disabled: m <= 1, "aria-label": e("viewer.prev"), style: le, children: "◂" }),
              /* @__PURE__ */ a("span", { className: "tabular-nums", children: [
                m,
                " / ",
                l
              ] }),
              /* @__PURE__ */ s(F, { onClick: () => ne(m + 1), disabled: m >= l, "aria-label": e("viewer.next"), style: le, children: "▸" }),
              /* @__PURE__ */ s("span", { className: "ml-3 text-[11px]", style: { color: "#999" }, children: e("present.keys") }),
              /* @__PURE__ */ a("span", { className: "ml-3 inline-flex items-center gap-1 text-[11px]", "data-testid": "present-presenter", "data-on": D ? "true" : "false", style: { color: D ? "#4ade80" : "#999" }, children: [
                /* @__PURE__ */ s("span", { "aria-hidden": !0, className: "inline-block rounded-full", style: { width: 7, height: 7, background: D ? "#22c55e" : "#666" } }),
                e(D ? "present.presenter_on" : "present.presenter_off")
              ] }),
              /* @__PURE__ */ a("span", { className: "ml-auto flex gap-1", children: [
                d && /* @__PURE__ */ a(F, { onClick: () => void d(m), style: le, title: e("present.presenter_hint"), children: [
                  e("present.presenter_window"),
                  " ↗"
                ] }),
                /* @__PURE__ */ s(
                  F,
                  {
                    onClick: () => {
                      S((L) => (P({ black: !L }), !L));
                    },
                    active: o,
                    "aria-pressed": o,
                    style: le,
                    children: e("presenter.black")
                  }
                ),
                !_ && /* @__PURE__ */ s(F, { onClick: te, style: le, children: e("present.fullscreen") }),
                /* @__PURE__ */ s(F, { onClick: re, style: le, children: e("present.close") })
              ] })
            ]
          }
        )
      ]
    }
  );
}
const ln = ["summarize", "draft-next", "notes", "check", "tighten"];
function cn(e, t) {
  const n = t.language.startsWith("ko") ? "Korean" : "English", r = `slide ${t.slideNumber} of ${t.slideCount} (${t.slideFile})`, l = t.hasDesignMd ? " Follow DESIGN.md / tokens.css." : "", i = " No em/en dashes or middle dots in slide text; keep the slide inside its 1280x720 stage.";
  switch (e) {
    case "summarize":
      return `Summarize ${r} in ${n}: three short bullets on what it says and one line on what a presenter should stress. Do not edit any file.`;
    case "draft-next":
      return `Draft the NEXT slide after ${r}. Read that slide and its neighbours for context and continuity, then create a new slide file right after it in the same folder, following the existing filename numbering (leave room between numbers) and the deck's existing markup patterns and classes.` + l + i + ` Reply in ${n} with the new file name and a one-line description.`;
    case "notes":
      return `Write speaker notes for ${r} into ${t.notesFile} (Markdown, in ${n}): 4 to 6 talking points plus one transition sentence to the next slide. Do not touch the slide HTML. Reply with one line when done.`;
    case "check":
      return `Review ${r} and reply in ${n}, without editing anything: (1) text that overflows or is likely clipped, (2) wording that is vague, redundant or too long for a slide, (3) inconsistencies with the neighbouring slides. Keep it to at most six bullets; if all is fine say so in one line.`;
    case "tighten":
      return `Tighten the text of ${r}: shorter sentences, fewer words, same meaning and structure. Edit the slide file directly; keep every heading, class and layout element.` + l + i + ` Reply in ${n} with one line on what changed.`;
  }
}
function dn({ t: e, slideNumber: t, disabled: n = !1, onRun: r }) {
  const [l, i] = k(null), [d, u] = k(null), c = async (h) => {
    i(h), u(null);
    try {
      await r(h), u({ kind: "ok", text: e("quick.sent") });
    } catch (m) {
      u({ kind: "err", text: `${e("quick.failed")}: ${m instanceof Error ? m.message : String(m)}` });
    } finally {
      i(null), setTimeout(() => u(null), 4e3);
    }
  };
  return /* @__PURE__ */ a("div", { className: "flex items-center gap-1 flex-wrap flex-none mb-1 text-[12px]", role: "group", "aria-label": e("quick.label", { n: t }), "data-testid": "quick-chips", children: [
    /* @__PURE__ */ s("span", { className: "text-muted mr-1", children: e("quick.label", { n: t }) }),
    ln.map((h) => /* @__PURE__ */ a(F, { onClick: () => void c(h), disabled: n || l !== null, title: e(`quick.hint.${h}`), "data-action": h, className: "inline-flex items-center gap-1", children: [
      l === h && /* @__PURE__ */ s(ie, {}),
      e(`quick.${h}`)
    ] }, h)),
    d && /* @__PURE__ */ s("span", { role: "status", className: "ml-1", style: { color: d.kind === "ok" ? "var(--ok)" : "var(--danger)" }, children: d.text })
  ] });
}
const at = "html-studio.collapsed";
function Ye() {
  try {
    const e = JSON.parse(localStorage.getItem(at) || "{}");
    return e && typeof e == "object" ? e : {};
  } catch {
    return {};
  }
}
function Re(e, t = !0) {
  const [n, r] = k(() => {
    const i = Ye()[e];
    return typeof i == "boolean" ? !i : t;
  }), l = U(
    (i) => {
      r(i);
      try {
        localStorage.setItem(at, JSON.stringify({ ...Ye(), [e]: !i }));
      } catch {
      }
    },
    [e]
  );
  return [n, l];
}
function Qe({ id: e, title: t, badge: n, actions: r, defaultOpen: l = !0, forceOpen: i = null, grow: d = !1, children: u }) {
  const [c, h] = Re(e, l);
  return W(() => {
    i !== null && i !== c && h(i);
  }, [i]), /* @__PURE__ */ a("section", { "data-grow": c && d ? "true" : "false", className: `flex flex-col min-h-0 ${c && d ? "flex-1" : "flex-none"}`, children: [
    /* @__PURE__ */ a("div", { className: "flex items-center gap-1", children: [
      /* @__PURE__ */ a(
        "button",
        {
          type: "button",
          onClick: () => h(!c),
          "aria-expanded": c,
          "aria-controls": `${e}-body`,
          className: "flex-1 flex items-center gap-2 py-2 px-1 -mx-1 rounded-md text-[13px] font-semibold text-text hover:bg-bg-hover cursor-pointer bg-transparent border-0 text-left",
          children: [
            /* @__PURE__ */ s(
              "span",
              {
                "aria-hidden": !0,
                className: "inline-flex items-center justify-center w-5 h-5 text-[14px] text-muted transition-transform",
                style: { transform: c ? "rotate(90deg)" : "none" },
                children: "▸"
              }
            ),
            t,
            n !== void 0 && /* @__PURE__ */ s("span", { className: "font-normal text-muted", children: n })
          ]
        }
      ),
      r && /* @__PURE__ */ s("div", { className: "flex items-center gap-1", children: r })
    ] }),
    c && /* @__PURE__ */ s("div", { id: `${e}-body`, className: `min-h-0 overflow-y-auto pl-1 pr-1 ${d ? "flex-1" : ""}`, children: u })
  ] });
}
function $e({ src: e, stageWidth: t, stageHeight: n, lazy: r = !1, title: l, className: i = "", reloadKey: d = 0, fit: u = "width", interactive: c = !1, frameRef: h }) {
  const m = X(null), [x, g] = k({ w: 0, h: 0 }), [v, C] = k(!r);
  W(() => {
    const T = m.current;
    if (!T) return;
    const D = new ResizeObserver((E) => {
      for (const N of E) g({ w: N.contentRect.width, h: N.contentRect.height });
    });
    return D.observe(T), () => D.disconnect();
  }, []), W(() => {
    if (!r || v) return;
    const T = m.current;
    if (!T) return;
    const D = new IntersectionObserver(
      (E) => {
        E.some((N) => N.isIntersecting) && C(!0);
      },
      { rootMargin: "200px" }
    );
    return D.observe(T), () => D.disconnect();
  }, [r, v]);
  const o = u === "contain" ? x.w > 0 && x.h > 0 ? Math.min(x.w / t, x.h / n) : 0 : x.w > 0 ? x.w / t : 0, S = v && o > 0 && /* @__PURE__ */ s(
    "iframe",
    {
      ref: h,
      src: e,
      title: l,
      sandbox: c ? "allow-scripts allow-same-origin" : "allow-same-origin",
      tabIndex: -1,
      className: `absolute top-0 left-0 border-0 ${c ? "" : "pointer-events-none"}`,
      style: { width: t, height: n, transform: `scale(${o})`, transformOrigin: "top left" }
    },
    `${d}:${c ? "i" : "s"}`
  );
  if (u === "contain") {
    const T = Math.floor(t * o), D = Math.floor(n * o);
    return (
      // Absolutely positioned so it can never be taller than the flex parent that
      // hands it its space (a percentage height would keep a stale value while
      // siblings grow and then overlap them).
      /* @__PURE__ */ s("div", { ref: m, className: "absolute inset-0 flex items-center justify-center", "data-testid": "slide-fit", children: o > 0 && /* @__PURE__ */ s("div", { className: `relative overflow-hidden ${i}`, style: { width: T, height: D, background: "#fff" }, "data-testid": "slide-stage", children: S }) })
    );
  }
  return /* @__PURE__ */ s("div", { ref: m, className: `relative overflow-hidden ${i}`, style: { aspectRatio: `${t} / ${n}`, background: "#fff" }, children: S });
}
function un({ t: e, preview: t, current: n, onSelect: r, reloadKey: l, withNotes: i, notesLabel: d = "Has notes", arrange: u }) {
  const c = X(null), h = X(null), [m, x] = k(null), g = (N) => {
    h.current = N, x(N);
  }, [v, C] = k(null), [o, S] = k(null);
  W(() => {
    var y;
    const N = (y = c.current) == null ? void 0 : y.querySelector(`[data-index="${n}"]`);
    N == null || N.scrollIntoView({ block: "nearest" });
  }, [n]), W(() => {
    S(null);
  }, [n, t.slides]);
  const T = (N, y) => {
    if (!u || N === y || y < 0 || y >= t.slides.length) return;
    const O = t.slides.slice(), [z] = O.splice(N, 1);
    O.splice(y, 0, z), u.onReorder(O);
  }, D = (N) => {
    const y = h.current;
    y !== null && (T(y, N), g(null), C(null));
  }, E = !u || u.busy;
  return /* @__PURE__ */ a("div", { className: "flex flex-col gap-2", children: [
    u && /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        onClick: () => u.onAdd(t.slides[n] ?? null),
        disabled: E,
        className: "w-full rounded-md py-1 text-[12px] cursor-pointer bg-transparent text-muted hover:text-text",
        style: { border: "1px dashed var(--border)" },
        "data-testid": "strip-add",
        children: e("strip.add")
      }
    ),
    /* @__PURE__ */ s("ol", { ref: c, className: "m-0 p-0 list-none grid gap-2", style: { gridTemplateColumns: "1fr" }, children: t.slides.map((N, y) => {
      const O = y === n, z = v === y && m !== null && m !== y;
      return /* @__PURE__ */ a(
        "li",
        {
          "data-index": y,
          draggable: !!u && !u.busy,
          onDragStart: (j) => {
            g(y), j.dataTransfer.effectAllowed = "move", j.dataTransfer.setData("text/plain", N);
          },
          onDragOver: (j) => {
            h.current !== null && (j.preventDefault(), j.dataTransfer.dropEffect = "move", v !== y && C(y));
          },
          onDragLeave: () => {
            v === y && C(null);
          },
          onDrop: (j) => {
            j.preventDefault(), D(y);
          },
          onDragEnd: () => {
            g(null), C(null);
          },
          className: "relative",
          style: {
            opacity: m === y ? 0.5 : 1,
            boxShadow: z ? m !== null && m < y ? "0 3px 0 0 var(--accent)" : "0 -3px 0 0 var(--accent)" : void 0,
            borderRadius: 6
          },
          children: [
            /* @__PURE__ */ a(
              "button",
              {
                type: "button",
                onClick: () => r(y),
                "aria-current": O ? "true" : void 0,
                title: N,
                className: "w-full text-left rounded-md p-1 cursor-pointer bg-transparent",
                style: {
                  border: `2px solid ${O ? "var(--accent)" : "var(--border)"}`
                },
                children: [
                  /* @__PURE__ */ s(
                    $e,
                    {
                      src: `${t.baseUrl}/slide/${y}`,
                      stageWidth: t.stage.width,
                      stageHeight: t.stage.height,
                      lazy: !0,
                      title: N,
                      reloadKey: l,
                      className: "rounded-sm"
                    }
                  ),
                  /* @__PURE__ */ a("div", { className: "flex items-center gap-2 mt-1 text-[11px] text-muted", children: [
                    /* @__PURE__ */ s("span", { className: "font-medium", style: { color: O ? "var(--accent)" : void 0 }, children: y + 1 }),
                    /* @__PURE__ */ s("span", { className: "truncate", children: N }),
                    (i == null ? void 0 : i.has(N)) && /* @__PURE__ */ s("span", { className: "ml-auto flex-none", title: d, "aria-label": d, "data-testid": "strip-note", style: { color: "var(--accent)" }, children: "≡" })
                  ] })
                ]
              }
            ),
            u && O && /* @__PURE__ */ a("div", { className: "absolute", style: { right: 6, top: 6 }, children: [
              /* @__PURE__ */ s(
                F,
                {
                  onClick: () => S(o === y ? null : y),
                  "aria-haspopup": "menu",
                  "aria-expanded": o === y,
                  "aria-label": e("strip.menu"),
                  title: e("strip.menu"),
                  disabled: u.busy,
                  style: { background: "var(--bg)", padding: "0 6px" },
                  children: "⋯"
                }
              ),
              o === y && /* @__PURE__ */ s("div", { role: "menu", className: "absolute right-0 mt-1 rounded-md border border-border flex flex-col p-1 text-[12px]", style: { background: "var(--bg)", minWidth: 140, zIndex: 20, boxShadow: "0 4px 14px rgba(0,0,0,.18)" }, children: [
                ["strip.move_up", () => T(y, y - 1), y === 0],
                ["strip.move_down", () => T(y, y + 1), y >= t.slides.length - 1],
                ["strip.duplicate", () => u.onDuplicate(N), !1],
                ["strip.save_layout", () => u.onSaveLayout(N), !1],
                ["strip.archive", () => u.onArchive(N), t.slides.length <= 1]
              ].map(([j, w, P]) => /* @__PURE__ */ s(
                "button",
                {
                  type: "button",
                  role: "menuitem",
                  disabled: P || u.busy,
                  onClick: () => {
                    S(null), w();
                  },
                  className: "text-left px-2 py-1 rounded bg-transparent border-0 cursor-pointer hover:text-text",
                  style: { color: P ? "var(--muted)" : j === "strip.archive" ? "var(--danger)" : "var(--text)", opacity: P ? 0.6 : 1 },
                  children: e(j)
                },
                j
              )) })
            ] })
          ]
        },
        N
      );
    }) })
  ] });
}
function hn({ t: e, client: t, preview: n, mode: r, after: l, saveSlide: i, deckPath: d, busy: u, onPick: c, onClose: h }) {
  const [m, x] = k(null), [g, v] = k(null), [C, o] = k(""), [S, T] = k(!1), [D, E] = k(null), N = X(null), y = () => t.layouts().then((p) => x(p.items)).catch((p) => v(p instanceof ee ? p.code : "request_failed"));
  W(() => {
    y();
  }, []), W(() => {
    var p;
    r === "save" && ((p = N.current) == null || p.focus());
  }, [r]);
  const O = async () => {
    if (!(!i || !C.trim())) {
      T(!0), v(null);
      try {
        const p = await t.layoutSave(d, i, C.trim());
        E(p.name), o(""), await y();
      } catch (p) {
        v(p instanceof ee ? p.code : "request_failed");
      } finally {
        T(!1);
      }
    }
  }, z = async (p) => {
    v(null);
    try {
      await t.layoutDelete(p), await y();
    } catch ($) {
      v($ instanceof ee ? $.code : "request_failed");
    }
  }, j = (p) => p.builtin ? e(`layout.${p.id}`) : p.name ?? p.id, w = (m == null ? void 0 : m.filter((p) => p.builtin)) ?? [], P = (m == null ? void 0 : m.filter((p) => !p.builtin)) ?? [], _ = (p) => /* @__PURE__ */ s("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }, children: p.map(($) => /* @__PURE__ */ a("div", { className: "flex flex-col gap-1", "data-testid": "layout-card", "data-layout": $.id, children: [
    /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        disabled: u || r === "save",
        onClick: () => c($.id, l),
        "aria-label": e("layout.insert", { name: j($) }),
        className: "rounded-md p-1 bg-transparent cursor-pointer text-left",
        style: { border: "2px solid var(--border)" },
        children: /* @__PURE__ */ s($e, { src: `${n.baseUrl}/layout/${$.id}`, stageWidth: n.stage.width, stageHeight: n.stage.height, title: j($), className: "rounded-sm" })
      }
    ),
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2 text-[12px]", children: [
      /* @__PURE__ */ s("span", { className: "truncate", children: j($) }),
      !$.builtin && /* @__PURE__ */ s(F, { danger: !0, className: "ml-auto", onClick: () => void z($.id), disabled: u, "aria-label": e("layout.delete", { name: j($) }), children: e("layout.delete_short") })
    ] })
  ] }, $.id)) });
  return /* @__PURE__ */ s("div", { className: "fixed inset-0", style: { zIndex: 900, background: "rgba(0,0,0,.45)", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center" }, onClick: h, children: /* @__PURE__ */ a(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": e(r === "save" ? "layout.save_title" : "layout.title"),
      className: "rounded-lg border border-border",
      style: { display: "flex", flexDirection: "column", flex: "0 0 auto", background: "var(--bg)", width: "min(920px, 92vw)", height: "auto", maxHeight: "86vh", boxShadow: "0 12px 40px rgba(0,0,0,.3)" },
      onClick: (p) => p.stopPropagation(),
      children: [
        /* @__PURE__ */ a("div", { className: "flex-none px-4 py-3 border-b border-border", style: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12, flex: "0 0 auto" }, children: [
          /* @__PURE__ */ a("div", { className: "flex flex-col", children: [
            /* @__PURE__ */ s("span", { className: "font-semibold text-[14px]", children: e(r === "save" ? "layout.save_title" : "layout.title") }),
            /* @__PURE__ */ s("span", { className: "text-[12px] text-muted", children: e(r === "save" ? "layout.save_hint" : "layout.hint") })
          ] }),
          /* @__PURE__ */ s("span", { className: "flex-1" }),
          u && /* @__PURE__ */ s(ie, {}),
          /* @__PURE__ */ s(F, { onClick: h, children: e("layout.close") })
        ] }),
        /* @__PURE__ */ a("div", { className: "px-4 py-3 overflow-auto flex-1 min-h-0", style: { display: "flex", flexDirection: "column", gap: 16, flex: "0 1 auto" }, children: [
          g && /* @__PURE__ */ s("p", { className: "m-0 text-[12px]", role: "alert", style: { color: "var(--danger)" }, children: e("error.generic", { code: g }) }),
          r === "save" && i && /* @__PURE__ */ a("div", { className: "flex gap-4 items-start", children: [
            /* @__PURE__ */ s("div", { style: { width: 260, flex: "none" }, children: /* @__PURE__ */ s($e, { src: `${n.baseUrl}/slide/${n.slides.indexOf(i)}`, stageWidth: n.stage.width, stageHeight: n.stage.height, title: i, className: "rounded-sm border border-border" }) }),
            /* @__PURE__ */ a(
              "form",
              {
                className: "flex flex-col gap-2 flex-1",
                onSubmit: (p) => {
                  p.preventDefault(), O();
                },
                children: [
                  /* @__PURE__ */ s("label", { className: "text-[12px] text-muted", htmlFor: "layout-name", children: e("layout.name_label") }),
                  /* @__PURE__ */ s(
                    "input",
                    {
                      id: "layout-name",
                      ref: N,
                      value: C,
                      onChange: (p) => o(p.target.value),
                      maxLength: 60,
                      className: "rounded-md border border-border px-2 py-1 text-[13px]",
                      style: { background: "var(--bg)", color: "var(--text)" },
                      placeholder: e("layout.name_placeholder")
                    }
                  ),
                  /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ s(F, { type: "submit", active: !0, disabled: S || !C.trim(), children: e("layout.save") }),
                    S && /* @__PURE__ */ s(ie, {}),
                    D && /* @__PURE__ */ s("span", { className: "text-[12px]", role: "status", style: { color: "var(--ok)" }, children: e("layout.saved", { name: D }) })
                  ] }),
                  /* @__PURE__ */ s("p", { className: "m-0 text-[11px] text-muted", children: e("layout.save_note") })
                ]
              }
            )
          ] }),
          m === null && !g ? /* @__PURE__ */ a("p", { className: "m-0 text-[12px] text-muted inline-flex items-center gap-2", children: [
            /* @__PURE__ */ s(ie, {}),
            " ",
            e("viewer.loading")
          ] }) : /* @__PURE__ */ a(xe, { children: [
            /* @__PURE__ */ a("div", { children: [
              /* @__PURE__ */ s("div", { className: "text-[12px] font-medium mb-2", children: e("layout.builtin") }),
              _(w)
            ] }),
            /* @__PURE__ */ a("div", { children: [
              /* @__PURE__ */ s("div", { className: "text-[12px] font-medium mb-2", children: e("layout.mine") }),
              P.length ? _(P) : /* @__PURE__ */ s("p", { className: "m-0 text-[12px] text-muted", children: e("layout.mine_empty") })
            ] })
          ] })
        ] })
      ]
    }
  ) });
}
const it = "hs.newDeck";
function mn() {
  try {
    return JSON.parse(localStorage.getItem(it) || "{}");
  } catch {
    return {};
  }
}
function pn(e) {
  return e.replace(/[^\p{L}\p{N}_\- ]/gu, "").trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "deck";
}
function fn({ t: e, client: t, roots: n, decks: r, onCreated: l, onClose: i }) {
  var Z;
  const d = me(mn, []), [u, c] = k(""), [h, m] = k(d.presenter ?? ""), [x, g] = k(""), [v, C] = k(""), [o, S] = k(""), [T, D] = k(d.themeKind ?? "default"), [E, N] = k(d.accent ?? "#6d5efc"), [y, O] = k(d.bg ?? "#ffffff"), [z, j] = k(d.fg ?? "#1f2430"), [w, P] = k(d.font ?? ""), [_, p] = k(((Z = r[0]) == null ? void 0 : Z.path) ?? ""), [$, A] = k(n.includes(d.root ?? "") ? d.root : n[0] ?? ""), [f, b] = k(""), [R, M] = k(!1), [V, Y] = k(d.askOutline ?? !0), [Q, re] = k(!1), [te, oe] = k(null);
  W(() => {
    R || b(pn(u));
  }, [u, R]);
  const ne = r.filter((I) => I.hasDesignMd || I.hasStudioJson), pe = u.trim() && f.trim() && $ && !Q && (T !== "copy" || _), fe = async () => {
    if (!pe) return;
    re(!0), oe(null);
    const I = T === "design" ? { kind: "design", accent: E, bg: y, fg: z, font: w.trim() || void 0 } : T === "copy" ? { kind: "copy", from: _ } : { kind: "default" }, H = { root: $, folder: f.trim(), title: u.trim(), presenter: h.trim(), purpose: x.trim(), audience: v.trim(), sources: o.trim(), theme: I };
    try {
      const ae = await t.deckNew(H);
      try {
        localStorage.setItem(it, JSON.stringify({ presenter: h.trim(), root: $, themeKind: T, accent: E, bg: y, fg: z, font: w.trim(), askOutline: V }));
      } catch {
      }
      l(ae.deck, V, H);
    } catch (ae) {
      oe(ae instanceof ee ? ae.code : "request_failed"), re(!1);
    }
  }, le = "rounded-md border border-border px-2 py-1 text-[13px] w-full", L = { background: "var(--bg)", color: "var(--text)" }, q = (I, H, ae, he) => /* @__PURE__ */ a("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ s("label", { htmlFor: I, className: "text-[12px] text-muted", children: H }),
    ae,
    he && /* @__PURE__ */ s("span", { className: "text-[11px] text-muted", children: he })
  ] }), B = (I, H) => /* @__PURE__ */ a("fieldset", { className: "m-0 p-0 border-0 flex flex-col gap-2", children: [
    /* @__PURE__ */ s("legend", { className: "text-[12px] font-semibold mb-1 p-0", children: I }),
    H
  ] }), J = (I, H, ae, he) => /* @__PURE__ */ a("label", { htmlFor: I, className: "flex items-center gap-2 text-[12px]", children: [
    /* @__PURE__ */ s("input", { id: I, type: "color", value: ae, onChange: (ve) => he(ve.target.value), "aria-label": H, style: { width: 28, height: 22, padding: 0, border: "1px solid var(--border)", background: "transparent" } }),
    H,
    " ",
    /* @__PURE__ */ s("span", { className: "text-muted", children: ae })
  ] });
  return /* @__PURE__ */ s("div", { className: "fixed inset-0", style: { zIndex: 900, background: "rgba(0,0,0,.45)", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center" }, onClick: i, children: /* @__PURE__ */ a(
    "form",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": e("newdeck.title"),
      className: "rounded-lg border border-border",
      style: { display: "flex", flexDirection: "column", flex: "0 0 auto", background: "var(--bg)", width: "min(720px, 92vw)", maxHeight: "88vh", boxShadow: "0 12px 40px rgba(0,0,0,.3)" },
      onClick: (I) => I.stopPropagation(),
      onSubmit: (I) => {
        I.preventDefault(), fe();
      },
      children: [
        /* @__PURE__ */ a("div", { className: "flex-none px-4 py-3 border-b border-border", style: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }, children: [
          /* @__PURE__ */ a("div", { className: "flex flex-col", children: [
            /* @__PURE__ */ s("span", { className: "font-semibold text-[14px]", children: e("newdeck.title") }),
            /* @__PURE__ */ s("span", { className: "text-[12px] text-muted", children: e("newdeck.hint") })
          ] }),
          /* @__PURE__ */ s("span", { className: "flex-1" }),
          /* @__PURE__ */ s(F, { type: "button", onClick: i, disabled: Q, children: e("layout.close") })
        ] }),
        /* @__PURE__ */ a("div", { className: "px-4 py-3 overflow-auto", style: { display: "flex", flexDirection: "column", gap: 18, flex: "0 1 auto" }, children: [
          B(
            e("newdeck.group_deck"),
            /* @__PURE__ */ a(xe, { children: [
              q("nd-title", e("newdeck.f_title"), /* @__PURE__ */ s("input", { id: "nd-title", className: le, style: L, value: u, onChange: (I) => c(I.target.value), required: !0, autoFocus: !0, maxLength: 200 })),
              q("nd-presenter", e("newdeck.f_presenter"), /* @__PURE__ */ s("input", { id: "nd-presenter", className: le, style: L, value: h, onChange: (I) => m(I.target.value), maxLength: 120 })),
              q("nd-purpose", e("newdeck.f_purpose"), /* @__PURE__ */ s("textarea", { id: "nd-purpose", className: le, style: { ...L, minHeight: 48 }, value: x, onChange: (I) => g(I.target.value), maxLength: 4e3 })),
              q("nd-audience", e("newdeck.f_audience"), /* @__PURE__ */ s("input", { id: "nd-audience", className: le, style: L, value: v, onChange: (I) => C(I.target.value), maxLength: 400 })),
              q("nd-sources", e("newdeck.f_sources"), /* @__PURE__ */ s("textarea", { id: "nd-sources", className: le, style: { ...L, minHeight: 64 }, value: o, onChange: (I) => S(I.target.value), maxLength: 4e3 }), e("newdeck.f_sources_hint"))
            ] })
          ),
          B(
            e("newdeck.group_theme"),
            /* @__PURE__ */ a(xe, { children: [
              /* @__PURE__ */ s("div", { className: "flex flex-wrap gap-3 text-[12px]", role: "radiogroup", "aria-label": e("newdeck.group_theme"), children: ["default", "design", "copy"].map((I) => /* @__PURE__ */ a("label", { className: "inline-flex items-center gap-1", children: [
                /* @__PURE__ */ s("input", { type: "radio", name: "theme", value: I, checked: T === I, onChange: () => D(I), disabled: I === "copy" && !ne.length }),
                e(`newdeck.theme_${I}`)
              ] }, I)) }),
              T === "design" && /* @__PURE__ */ a("div", { className: "flex flex-wrap gap-4 items-center", children: [
                J("nd-accent", e("newdeck.c_accent"), E, N),
                J("nd-bg", e("newdeck.c_bg"), y, O),
                J("nd-fg", e("newdeck.c_fg"), z, j),
                /* @__PURE__ */ a("label", { htmlFor: "nd-font", className: "flex items-center gap-2 text-[12px]", children: [
                  e("newdeck.c_font"),
                  /* @__PURE__ */ s("input", { id: "nd-font", className: "rounded-md border border-border px-2 py-1 text-[12px]", style: { ...L, width: 160 }, value: w, onChange: (I) => P(I.target.value), placeholder: "Pretendard", maxLength: 80 })
                ] })
              ] }),
              T === "copy" && /* @__PURE__ */ s("select", { className: le, style: L, value: _, onChange: (I) => p(I.target.value), "aria-label": e("newdeck.theme_copy_from"), children: ne.map((I) => /* @__PURE__ */ s("option", { value: I.path, children: I.name }, I.path)) })
            ] })
          ),
          B(
            e("newdeck.group_where"),
            /* @__PURE__ */ a("div", { className: "flex gap-3 flex-wrap", children: [
              /* @__PURE__ */ a("div", { className: "flex flex-col gap-1", style: { flex: "1 1 260px" }, children: [
                /* @__PURE__ */ s("label", { htmlFor: "nd-root", className: "text-[12px] text-muted", children: e("newdeck.f_root") }),
                /* @__PURE__ */ s("select", { id: "nd-root", className: le, style: L, value: $, onChange: (I) => A(I.target.value), children: n.map((I) => /* @__PURE__ */ s("option", { value: I, children: I.replace(/^\/Users\/[^/]+|^\/home\/[^/]+/, "~") }, I)) })
              ] }),
              /* @__PURE__ */ a("div", { className: "flex flex-col gap-1", style: { flex: "1 1 200px" }, children: [
                /* @__PURE__ */ s("label", { htmlFor: "nd-folder", className: "text-[12px] text-muted", children: e("newdeck.f_folder") }),
                /* @__PURE__ */ s(
                  "input",
                  {
                    id: "nd-folder",
                    className: le,
                    style: L,
                    value: f,
                    onChange: (I) => {
                      M(!0), b(I.target.value);
                    },
                    maxLength: 80
                  }
                )
              ] })
            ] })
          ),
          /* @__PURE__ */ a("label", { className: "inline-flex items-center gap-2 text-[12px]", children: [
            /* @__PURE__ */ s("input", { type: "checkbox", checked: V, onChange: (I) => Y(I.target.checked) }),
            e("newdeck.ask_outline")
          ] }),
          te && /* @__PURE__ */ s("p", { className: "m-0 text-[12px]", role: "alert", style: { color: "var(--danger)" }, children: e(`newdeck.err_${te}`) === `newdeck.err_${te}` ? e("error.generic", { code: te }) : e(`newdeck.err_${te}`) })
        ] }),
        /* @__PURE__ */ a("div", { className: "flex-none px-4 py-3 border-t border-border", style: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ s("span", { className: "flex-1" }),
          Q && /* @__PURE__ */ s(ie, {}),
          /* @__PURE__ */ s(F, { type: "submit", active: !0, disabled: !pe, children: e("newdeck.create") })
        ] })
      ]
    }
  ) });
}
const gn = ["colors", "font", "typography", "spacing", "rounded"];
function Je(e) {
  const t = /^(-?\d+(?:\.\d+)?)(px|rem|em|%|vw|vh)?$/.exec(e.trim());
  return t ? { n: Number(t[1]), unit: t[2] ?? "" } : null;
}
function xn({ t: e, client: t, deckPath: n, design: r, onWriteTokens: l, tokensBusy: i = !1, onPreview: d, onApplied: u, onClose: c }) {
  const [h, m] = k(null), [x, g] = k({}), [v, C] = k(null), [o, S] = k(!1), [T, D] = k(!1), E = X(null), N = () => t.tweakInfo(n).then((p) => {
    m(p), C(null);
  }).catch((p) => C(p instanceof ee ? p.code : "request_failed"));
  W(() => {
    N();
  }, [n]);
  const y = (p) => {
    E.current && clearTimeout(E.current), E.current = setTimeout(() => {
      t.tweakPreview(n, p).then(() => d()).catch(($) => C($ instanceof ee ? $.code : "request_failed"));
    }, 120);
  }, O = (p, $) => {
    D(!1);
    const A = { ...x };
    $.trim() === p.value.trim() ? delete A[p.var] : A[p.var] = $, g(A), y(A);
  }, z = () => {
    E.current && clearTimeout(E.current), g({}), D(!1), y({});
  }, j = async () => {
    E.current && (clearTimeout(E.current), E.current = null), S(!0), C(null);
    try {
      const p = await t.tweakApply(n, x);
      g({}), D(!0), u(p.rebuild), await N();
    } catch (p) {
      C(p instanceof ee ? p.code : "request_failed");
    } finally {
      S(!1);
    }
  };
  W(
    () => () => {
      E.current && clearTimeout(E.current), t.tweakPreview(n, {}).then(() => d()).catch(() => {
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n]
  );
  const w = me(() => {
    var $;
    const p = {};
    for (const A of (h == null ? void 0 : h.items) ?? []) (p[$ = A.group] || (p[$] = [])).push(A);
    return gn.filter((A) => {
      var f;
      return (f = p[A]) == null ? void 0 : f.length;
    }).map((A) => [A, p[A]]);
  }, [h]), P = Object.keys(x).length, _ = (p) => {
    const $ = x[p.var] ?? p.value, A = p.var in x;
    if (p.kind === "color") {
      const f = /^#[0-9a-f]{6}$/i.test($) ? $ : "#000000";
      return /* @__PURE__ */ s("input", { type: "color", value: f, onChange: (b) => O(p, b.target.value), "aria-label": p.name, style: { width: 34, height: 24, padding: 0, border: `1px solid ${A ? "var(--accent)" : "var(--border)"}`, background: "transparent" } });
    }
    if (p.kind === "length") {
      const f = Je(p.value), b = Je($) ?? f;
      if (f && b) {
        const R = Math.max(Math.abs(f.n) * 2, f.n === 0 ? 100 : 1), M = f.unit === "rem" || f.unit === "em" ? 0.05 : 1;
        return /* @__PURE__ */ a("span", { className: "inline-flex items-center gap-2", children: [
          /* @__PURE__ */ s("input", { type: "range", min: 0, max: R, step: M, value: b.n, onChange: (V) => O(p, `${V.target.value}${f.unit}`), "aria-label": p.name, style: { width: 110 } }),
          /* @__PURE__ */ s(
            "input",
            {
              type: "number",
              step: M,
              value: b.n,
              onChange: (V) => O(p, `${V.target.value}${f.unit}`),
              "aria-label": `${p.name} value`,
              className: "rounded border border-border px-1 text-[12px]",
              style: { width: 64, background: "var(--bg)", color: "var(--text)" }
            }
          ),
          /* @__PURE__ */ s("span", { className: "text-muted text-[11px]", children: f.unit })
        ] });
      }
    }
    return /* @__PURE__ */ s("input", { value: $, onChange: (f) => O(p, f.target.value), "aria-label": p.name, className: "rounded border border-border px-1 text-[12px]", style: { width: 150, background: "var(--bg)", color: "var(--text)" } });
  };
  return /* @__PURE__ */ a("div", { className: "flex flex-col min-h-0 h-full text-[12px]", "data-testid": "tweak-panel", style: { borderLeft: "1px solid var(--border)", paddingLeft: 12 }, children: [
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2 mb-2 flex-none", children: [
      /* @__PURE__ */ s("span", { className: "font-semibold text-[13px]", children: e("tweak.title") }),
      /* @__PURE__ */ s("span", { className: "flex-1" }),
      /* @__PURE__ */ s(F, { onClick: c, children: e("layout.close") })
    ] }),
    /* @__PURE__ */ s("p", { className: "m-0 mb-2 text-muted flex-none", children: h != null && h.hasDesign ? e("tweak.hint_design") : e("tweak.hint_default") }),
    (h == null ? void 0 : h.hasDesign) && h.layered && /* @__PURE__ */ s("p", { className: "m-0 mb-2 text-muted flex-none", children: e("tweak.hint_layered", { css: h.css ?? "" }) }),
    (h == null ? void 0 : h.hasDesign) && r && !r.empty && (!r.tokensExists || r.tokensStale || h.css !== "tokens.css" && !h.layered) && /* @__PURE__ */ a("div", { className: "mb-2 flex-none flex items-center gap-2 flex-wrap rounded-md border px-2 py-1", style: { borderColor: "var(--warn)" }, children: [
      /* @__PURE__ */ s("span", { style: { color: "var(--warn)" }, children: r.tokensExists ? r.tokensStale ? e("theme.tokens.stale") : e("tweak.hint_no_tokens") : e("theme.tokens.missing") }),
      l && /* @__PURE__ */ a(F, { onClick: l, disabled: i || o, className: "inline-flex items-center gap-1", title: e("theme.tokens.hint"), children: [
        i && /* @__PURE__ */ s(ie, {}),
        r.tokensExists ? e("theme.tokens.update") : e("theme.tokens.write")
      ] })
    ] }),
    v && /* @__PURE__ */ s("p", { className: "m-0 mb-2", role: "alert", style: { color: "var(--danger)" }, children: e("error.generic", { code: v }) }),
    /* @__PURE__ */ a("div", { className: "flex-1 min-h-0 overflow-auto flex flex-col gap-3 pr-1", children: [
      !h && !v && /* @__PURE__ */ a("span", { className: "inline-flex items-center gap-2 text-muted", children: [
        /* @__PURE__ */ s(ie, {}),
        " ",
        e("viewer.loading")
      ] }),
      w.map(([p, $]) => /* @__PURE__ */ a("div", { children: [
        /* @__PURE__ */ s("div", { className: "font-medium mb-1", children: e(`tweak.group_${p}`) }),
        /* @__PURE__ */ s("div", { className: "flex flex-col gap-1", children: $.map((A) => {
          const f = A.var in x;
          return /* @__PURE__ */ a("div", { className: "flex items-center gap-2", "data-testid": "tweak-item", "data-var": A.var, "data-changed": f ? "true" : void 0, children: [
            /* @__PURE__ */ a("span", { className: "truncate", style: { width: 120, color: f ? "var(--accent)" : void 0 }, title: A.var, children: [
              f ? "● " : "",
              A.name
            ] }),
            _(A),
            f && /* @__PURE__ */ s(F, { onClick: () => O(A, A.value), "aria-label": e("tweak.revert_one", { name: A.name }), style: { padding: "0 6px" }, children: "↺" })
          ] }, A.var);
        }) })
      ] }, p))
    ] }),
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2 mt-2 flex-none flex-wrap", children: [
      /* @__PURE__ */ s(F, { onClick: () => void j(), active: !0, disabled: !P || o, children: e("tweak.apply") }),
      /* @__PURE__ */ s(F, { onClick: z, disabled: !P || o, children: e("tweak.revert_all") }),
      o && /* @__PURE__ */ s(ie, {}),
      /* @__PURE__ */ s("span", { className: "text-muted", role: "status", children: o ? e("tweak.applying") : T ? e("tweak.applied") : P ? e("tweak.dirty", { n: P }) : "" })
    ] }),
    /* @__PURE__ */ s("p", { className: "m-0 mt-1 text-[11px] text-muted flex-none", children: e("tweak.note") })
  ] });
}
function Xe({ t: e, preview: t, current: n, onChange: r, reloadKey: l, selectMode: i = !1, frameRef: d }) {
  const u = t.slides.length, c = () => r(Math.max(0, n - 1)), h = () => r(Math.min(u - 1, n + 1));
  return W(() => {
    const m = (x) => {
      const g = x.target;
      g && ["INPUT", "TEXTAREA", "SELECT"].includes(g.tagName) || (x.key === "ArrowLeft" || x.key === "PageUp" ? (x.preventDefault(), c()) : x.key === "ArrowRight" || x.key === "PageDown" ? (x.preventDefault(), h()) : x.key === "Home" ? r(0) : x.key === "End" && r(u - 1));
    };
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [n, u]), u === 0 ? /* @__PURE__ */ s("p", { className: "text-sm text-muted", children: e("deck.summary.no_slides") }) : /* @__PURE__ */ a("div", { className: "flex flex-col gap-2 flex-1", style: { minHeight: 170 }, children: [
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2 text-[12px] text-muted flex-none", children: [
      /* @__PURE__ */ s(F, { onClick: c, disabled: n === 0, "aria-label": e("viewer.prev"), children: "◂" }),
      /* @__PURE__ */ a("span", { className: "tabular-nums", "aria-live": "polite", children: [
        n + 1,
        " / ",
        u
      ] }),
      /* @__PURE__ */ s(F, { onClick: h, disabled: n >= u - 1, "aria-label": e("viewer.next"), children: "▸" }),
      /* @__PURE__ */ s("span", { className: "truncate ml-2", title: t.slides[n], children: t.slides[n] }),
      /* @__PURE__ */ s("span", { className: "ml-auto", children: t.css ? t.css === "tokens.css" ? e("viewer.tokens_theme") : t.css : e("viewer.default_theme") })
    ] }),
    /* @__PURE__ */ s("div", { className: "flex-1 min-h-0 relative", children: /* @__PURE__ */ s(
      $e,
      {
        src: `${t.baseUrl}/slide/${n}${i ? "?hs=select" : ""}`,
        stageWidth: t.stage.width,
        stageHeight: t.stage.height,
        title: t.slides[n],
        reloadKey: l,
        fit: "contain",
        interactive: i,
        frameRef: d,
        className: "rounded-md border border-border"
      }
    ) })
  ] });
}
const Ze = ["primary", "secondary", "accent", "canvas-soft", "canvas", "surface", "ink", "hairline"];
function vn({ t: e, info: t, onOpenTheme: n }) {
  const r = t.design;
  if (!t.present || !r || t.empty) return null;
  const l = Object.keys(r.colors), i = [...Ze.filter((c) => c in r.colors), ...l.filter((c) => !Ze.includes(c))].slice(0, 8), d = l.length - i.length, u = t.tokensExists ? t.tokensStale ? "stale" : "fresh" : "missing";
  return /* @__PURE__ */ a(
    "button",
    {
      type: "button",
      onClick: n,
      className: "mb-2 flex-none flex items-center gap-2 flex-wrap text-[12px] text-muted bg-transparent border-0 p-0 cursor-pointer hover:text-text text-left",
      "data-testid": "theme-row",
      "data-tokens": u,
      title: e("theme.row_hint"),
      children: [
        /* @__PURE__ */ s("span", { className: "font-medium text-text", children: r.name || "DESIGN.md" }),
        /* @__PURE__ */ a("span", { className: "inline-flex items-center gap-1", "aria-label": e("theme.colors"), children: [
          i.map((c) => /* @__PURE__ */ s(
            "span",
            {
              title: `${c} ${r.colors[c]}`,
              "data-testid": "theme-swatch",
              "data-name": c,
              className: "inline-block rounded-sm border border-border",
              style: { width: 14, height: 14, background: r.colors[c] }
            },
            c
          )),
          d > 0 && /* @__PURE__ */ a("span", { children: [
            "+",
            d
          ] })
        ] }),
        r.font.family && /* @__PURE__ */ s("span", { className: "truncate", children: r.font.family }),
        u !== "fresh" && /* @__PURE__ */ a("span", { className: "inline-flex items-center gap-1", style: { color: "var(--warn)" }, children: [
          /* @__PURE__ */ s("span", { "aria-hidden": !0, className: "inline-block rounded-full", style: { width: 6, height: 6, background: "var(--warn)" } }),
          e(u === "missing" ? "theme.tokens.missing" : "theme.tokens.stale")
        ] })
      ]
    }
  );
}
function kn(e) {
  const [t, n] = k("connecting"), [r, l] = k(null), [i, d] = k([]), [u, c] = k([]), [h, m] = k(!1), [x, g] = k(null), [v, C] = k(null), [o, S] = k(null), [T, D] = k(null), [E, N] = k(null), y = u.find((P) => P.id === o) ?? null, O = U(async () => {
    m(!0), g(null);
    try {
      const P = await e.decks();
      d(P.roots), c(P.decks);
    } catch (P) {
      g(P instanceof ee ? P.code : "request_failed");
    } finally {
      m(!1);
    }
  }, [e]);
  W(() => {
    let P = !0, _ = null, p = 0;
    const $ = async () => {
      if (P)
        try {
          const f = await e.status();
          if (!P) return;
          l(f), n("connected"), await O();
        } catch {
          if (!P) return;
          n(p === 0 ? "connecting" : "error"), p += 1, _ = setTimeout($, Math.min(1e3 * p, 5e3));
        }
    };
    $();
    const A = () => {
      _ && (clearTimeout(_), _ = null, $());
    };
    return window.addEventListener("focus", A), () => {
      P = !1, _ && clearTimeout(_), window.removeEventListener("focus", A);
    };
  }, [e, O]), W(() => {
    if (t !== "connected") return;
    const P = setInterval(() => {
      document.visibilityState === "visible" && e.decks().then((_) => {
        d(_.roots), c((p) => JSON.stringify(p.map(($) => [$.id, $.slideCount, $.modifiedAt])) === JSON.stringify(_.decks.map(($) => [$.id, $.slideCount, $.modifiedAt])) ? p : _.decks);
      }).catch(() => {
      });
    }, 1e4);
    return () => clearInterval(P);
  }, [e, t]);
  const z = U(
    async (P) => {
      g(null), C(null), m(!0);
      try {
        if (P) {
          const _ = await e.addRoot(P);
          d(_.roots);
        } else {
          const _ = await e.pickStart();
          let p = _;
          for (; p.state === "pending"; )
            await new Promise(($) => setTimeout($, 700)), p = await e.pickStatus(_.id);
          if (p.state === "cancelled") return;
          if (p.state === "error") throw new ee(p.error ?? "folder_chooser_failed", p.detail);
          d(p.roots ?? []);
        }
      } catch (_) {
        g(_ instanceof ee ? _.code : "request_failed"), C(_ instanceof ee ? _.message : String(_));
        return;
      } finally {
        m(!1);
      }
      await O();
    },
    [e, O]
  ), j = U(
    async (P) => {
      g(null), m(!0);
      try {
        const _ = await e.removeRoot(P);
        d(_.roots), c((p) => p.filter(($) => $.root !== P)), y && y.root === P && S(null);
      } catch (_) {
        g(_ instanceof ee ? _.code : "request_failed");
        return;
      } finally {
        m(!1);
      }
      await O();
    },
    [e, O, y]
  );
  return {
    conn: t,
    status: r,
    roots: i,
    decks: u,
    setDecks: c,
    loading: h,
    error: x,
    errorDetail: v,
    selectedId: o,
    selected: y,
    decksForce: T,
    slidesForce: E,
    refresh: O,
    addRoot: z,
    removeRoot: j,
    selectDeck: (P) => {
      S(P.id), D(!1), N(!0), setTimeout(() => {
        D(null), N(null);
      }, 0);
    }
  };
}
function bn(e) {
  const [t, n] = Re("notes", !1), [r, l] = k(null), [i, d] = k(0);
  W(() => {
    l(null);
  }, [e]);
  const u = me(() => new Set((r == null ? void 0 : r.withNotes) ?? []), [r]), c = U(() => {
    l(null), d((m) => m + 1);
  }, []), h = U(() => d((m) => m + 1), []);
  return { notesOpen: t, setNotesOpen: n, notesIndex: r, setNotesIndex: l, notesRefresh: i, withNotes: u, invalidate: c, bump: h };
}
function yn({ client: e, selected: t, setDecks: n, onExternalChange: r }) {
  const [l, i] = k(null), [d, u] = k(null), [c, h] = k(0), [m, x] = k(0), g = U(() => x((N) => N + 1), []), [v, C] = k("slides"), [o, S] = k(0), T = X(/* @__PURE__ */ new Map()), D = X(null);
  W(() => {
    if (!t) {
      i(null);
      return;
    }
    let N = !0;
    const y = t.path;
    return i(null), u(null), h(0), e.previewStart(y).then((O) => N && i(O)).catch((O) => N && u(O instanceof ee ? O.code : "request_failed")), () => {
      N = !1, e.previewStop(y).catch(() => {
      });
    };
  }, [e, t == null ? void 0 : t.path]), W(() => {
    const N = (y) => {
      var z;
      const O = y.data;
      !O || O.type !== "hs-slide" || typeof O.index != "number" || y.source === ((z = D.current) == null ? void 0 : z.contentWindow) && h(O.index);
    };
    return window.addEventListener("message", N), () => window.removeEventListener("message", N);
  }, []), W(() => {
    C("slides");
  }, [t == null ? void 0 : t.path]);
  const E = U(async () => {
    if (!(!t || !l))
      try {
        const N = await e.previewStart(t.path), y = N.slides.length !== l.slides.length || N.slides.some((z, j) => z !== l.slides[j]), O = N.modifiedAt !== void 0 && l.modifiedAt !== void 0 && N.modifiedAt > l.modifiedAt;
        (y || O || N.css !== l.css) && (i(N), x((z) => z + 1), S((z) => z + 1), r(), y && (n((z) => z.map((j) => j.id === t.id ? { ...j, slideCount: N.slides.length, slides: N.slides } : j)), h((z) => Math.min(z, Math.max(0, N.slides.length - 1)))));
      } catch {
      }
  }, [e, t, l, n, r]);
  return W(() => {
    if (!t || !l) return;
    const N = setInterval(() => {
      document.visibilityState === "visible" && E();
    }, 2500);
    return () => clearInterval(N);
  }, [t, l, E]), {
    preview: l,
    setPreview: i,
    previewError: d,
    setPreviewError: u,
    current: c,
    setCurrent: h,
    reloadKey: m,
    bumpReload: g,
    viewMode: v,
    setViewMode: C,
    externalChanges: o,
    draftsRef: T,
    outputFrameRef: D,
    syncDeck: E
  };
}
function wn({ client: e, selected: t, preview: n, externalChanges: r, t: l, setViewMode: i, setCurrent: d, bumpReload: u }) {
  const [c, h] = k(null), [m, x] = k(!1), [g, v] = k(null), [C, o] = k(null), [S, T] = k(() => {
    try {
      return JSON.parse(localStorage.getItem("hs.scriptIgnored") || "[]");
    } catch {
      return [];
    }
  });
  W(() => localStorage.setItem("hs.scriptIgnored", JSON.stringify(S)), [S]), W(() => {
    if (v(null), o(null), !t) {
      h(null);
      return;
    }
    let A = !0;
    return e.buildInfo(t.path).then((f) => A && h(f)).catch((f) => {
      console.warn("[html-studio] build/info failed", f), A && h(null);
    }), () => {
      A = !1;
    };
  }, [e, t == null ? void 0 : t.path]), W(() => {
    !t || !r || e.buildInfo(t.path).then(h).catch(() => {
    });
  }, [e, t == null ? void 0 : t.path, r]);
  const D = U(
    async (A) => {
      if (!A || !("ok" in A || "job" in A)) return null;
      if ("ok" in A) return A;
      for (; ; ) {
        await new Promise((b) => setTimeout(b, 1e3));
        const f = await e.buildStatus(A.job);
        if (f.state === "done" && f.result) return f.result;
        if (f.state === "error") return { ok: !1, mode: "external", stderr: f.detail || f.error || "build_failed" };
      }
    },
    [e]
  ), E = U(
    (A, f) => {
      !A || "skipped" in A || ("job" in A && x(!0), D(A).then((b) => {
        b && (v(b), b.ok && u(), e.buildInfo(f).then(h).catch(() => {
        }));
      }).finally(() => x(!1)));
    },
    [D, e, u]
  ), N = U(
    async (A = !1) => {
      if (t) {
        x(!0), o(null);
        try {
          const f = await e.build(t.path, A);
          if ("ok" in f && f.needsTrust && f.command) {
            o(f.command);
            return;
          }
          const b = await D(f);
          v(b), b.ok && setTimeout(() => v((M) => M === b ? null : M), 8e3), u();
          const R = await e.buildInfo(t.path);
          h(R), b.ok && b.output && i("output");
        } catch (f) {
          v({ ok: !1, mode: "external", stderr: f instanceof ee ? f.code : "request_failed" });
        } finally {
          x(!1);
        }
      }
    },
    [e, t, D, u, i]
  ), y = U(() => {
    t && e.buildAdopt(t.path).then((A) => (h(A), N(!1))).catch(() => {
    });
  }, [e, t, N]), O = U(() => {
    t && T((A) => [...A, t.path]);
  }, [t]), z = t && (c != null && c.script) && c.suggestedCommand && !c.command && !S.includes(t.path) ? { script: c.script, command: c.suggestedCommand } : null, j = (A) => {
    if (!n) return;
    const f = n.slides.indexOf(A);
    f >= 0 && (i("slides"), d(f));
  }, w = n && (c != null && c.outputExists) ? `${n.baseUrl}/${c.output}` : null, P = !n || !c || n.slides.length === 0 ? null : c.command ? w : `${n.baseUrl}/show`, _ = !!(c != null && c.command && c.outputExists && c.outputStale), p = !!t && !!n && n.slides.length > 0 && !m && ((c == null ? void 0 : c.buildable) ?? !1), $ = t ? c ? c.buildable ? c.builtin ? l("build.mode.builtin") : c.command ?? "" : l("build.hint.single_file") : l("build.hint.loading") : "";
  return {
    buildInfo: c,
    building: m,
    buildResult: g,
    setBuildResult: v,
    pendingCommand: C,
    setPendingCommand: o,
    runBuild: N,
    showRebuild: E,
    adoptScript: y,
    ignoreScript: O,
    scriptOffer: z,
    openIssue: j,
    outputUrl: w,
    showUrl: P,
    outputStale: _,
    canBuild: p,
    buildHint: $
  };
}
function Nn({ api: e, selected: t, preview: n, buildInfo: r, current: l, locale: i, t: d, bumpReload: u, bumpNotes: c }) {
  const [h, m] = Re("chat", !1), [x, g] = k(0), v = U(() => g((S) => S + 1), []), C = U(
    async (S, T, D) => {
      const { key: E } = await rt(e, { deck: S, preview: (D == null ? void 0 : D.preview) ?? n, build: (D == null ? void 0 : D.build) ?? r, language: i }, d("chat.title", { name: S.name }));
      return await e.post("/api/chat?ws=1", { message: T, slot: E, agent: "" }), E;
    },
    [e, n, r, i, d]
  ), o = U(
    async (S) => {
      if (!t || !n) return;
      const T = n.slides[l] ?? String(l + 1), D = t.kind === "single" ? t.entry ?? T : `${t.slidesDir}/${T}`, E = `notes/${T.replace(/\.html?$/i, "").replace(/#/g, "-")}.md`, N = cn(S, {
        slideFile: D,
        slideNumber: l + 1,
        slideCount: n.slides.length,
        notesFile: E,
        language: i,
        hasDesignMd: t.hasDesignMd
      });
      await C(t, N), v(), m(!0), (S === "tighten" || S === "draft-next") && setTimeout(u, 8e3), S === "notes" && setTimeout(c, 8e3);
    },
    [t, n, l, i, C, v, m, u, c]
  );
  return { chatOpen: h, setChatOpen: m, chatRefresh: x, bumpChat: v, post: C, runQuickAction: o };
}
function lt(e, t, n) {
  const r = t.slides[n] ?? String(n + 1);
  return (e == null ? void 0 : e.kind) === "single" ? e.entry ?? r : `${(e == null ? void 0 : e.slidesDir) ?? "slides"}/${r}`;
}
function _n({ client: e, selected: t, preview: n, current: r, locale: l, setCurrent: i, setViewMode: d, bumpReload: u, postToChat: c, bumpChat: h }) {
  const [m, x] = k(!1), [g, v] = k([]), [C, o] = k(null), S = X(null), T = U((f) => {
    S.current = f;
  }, []);
  W(() => {
    x(!1), o(null), v(t ? nn(t.path) : []);
  }, [t == null ? void 0 : t.path]), W(() => {
    t && sn(t.path, g);
  }, [g, t == null ? void 0 : t.path]);
  const D = U(() => {
    var R;
    const f = (R = S.current) == null ? void 0 : R.contentWindow;
    if (!f) return;
    const b = g.filter((M) => M.slideIndex === r).map((M) => ({ id: M.id, index: M.index, status: M.status, cid: M.cid, selector: M.selector, rect: M.rect, comment: M.comment }));
    f.postMessage({ type: "hs-pins", pins: b }, "*");
  }, [g, r]);
  W(() => {
    m && D();
  }, [D, m]), W(() => {
    const f = (b) => {
      var M;
      if (b.source !== ((M = S.current) == null ? void 0 : M.contentWindow)) return;
      const R = b.data;
      if (!(!R || typeof R.type != "string")) {
        if (R.type === "hs-select-ready")
          D();
        else if (R.type === "hs-capture" && typeof R.selector == "string" && n) {
          const V = R, Y = lt(t, n, V.slideIndex);
          v((Q) => {
            const re = Q.reduce((oe, ne) => Math.max(oe, ne.index), 0) + 1, te = ot(V, Y, re);
            return o(te.id), [...Q, te];
          });
        } else if (R.type === "hs-anchored" && Array.isArray(R.pins)) {
          const V = new Map(R.pins.map((Y) => [Y.id, Y.how]));
          v((Y) => Y.some((Q) => V.has(Q.id) && Q.how !== V.get(Q.id)) ? Y.map((Q) => V.has(Q.id) ? { ...Q, how: V.get(Q.id) } : Q) : Y);
        }
      }
    };
    return window.addEventListener("message", f), () => window.removeEventListener("message", f);
  }, [n, D, t == null ? void 0 : t.kind, t == null ? void 0 : t.entry, t == null ? void 0 : t.slidesDir]);
  const E = U((f, b) => v((R) => R.map((M) => M.id === f ? { ...M, comment: b } : M)), []), N = U((f) => v((b) => b.filter((R) => R.id !== f)), []), y = U(
    (f, b) => {
      i(f), o(b), d("slides");
    },
    [i, d]
  ), [O, z] = k(!1), [j, w] = k(null), P = U(async () => {
    if (!t || O) return;
    const f = g.filter((b) => b.status === "new" && b.comment.trim());
    if (f.length) {
      z(!0), w(null);
      try {
        const b = await e.pinsSend(t.path, f, l);
        await c(t, b.prompt);
        const R = new Map(b.comments.map((M) => [M.pinId, M.cid]));
        v((M) => M.map((V) => R.has(V.id) ? { ...V, status: "sent", batchId: b.id, batchCid: R.get(V.id), thread: [] } : V)), h();
      } catch (b) {
        w(b instanceof ee ? b.code : b instanceof Error ? b.message : "request_failed");
      } finally {
        z(!1);
      }
    }
  }, [e, t, g, O, l, c, h]), _ = g.some((f) => f.status === "sent");
  W(() => {
    if (!t || !_) return;
    let f = !0;
    const b = async () => {
      try {
        const { batches: M } = await e.pinsQueue(t.path);
        if (!f) return;
        const V = new Map(M.flatMap((Q) => Q.comments.map((re) => [re.cid, { c: re, state: Q.state }])));
        let Y = !1;
        v((Q) => {
          let re = !1;
          const te = Q.map((oe) => {
            const ne = oe.batchCid ? V.get(oe.batchCid) : void 0;
            return !ne || ne.c.status === oe.status ? oe : (re = !0, (ne.c.status === "done" || ne.c.status === "question") && (Y = Y || ne.state === "done"), { ...oe, status: ne.c.status, thread: ne.c.thread });
          });
          return re ? te : Q;
        }), Y && u();
      } catch (M) {
        console.warn("[html-studio] pins/queue failed", M);
      }
    };
    b();
    const R = setInterval(b, 3e3);
    return () => {
      f = !1, clearInterval(R);
    };
  }, [e, t == null ? void 0 : t.path, _]);
  const p = U(
    async (f, b) => {
      const R = g.find((M) => M.id === f);
      if (!(!t || !(R != null && R.batchCid) || !R.batchId))
        try {
          await e.pinsReply(t.path, R.batchId, R.batchCid, b);
          const M = `Re pin [${R.batchCid}] (${R.slideFile} > ${R.selector}): ${b}
Continue with that comment and report again with report.py (--cid ${R.batchCid}).`;
          await c(t, M), v((V) => V.map((Y) => Y.id === f ? { ...Y, status: "sent", thread: [...Y.thread ?? [], { role: "user", text: b, ts: Date.now() }] } : Y));
        } catch (M) {
          w(M instanceof ee ? M.code : M instanceof Error ? M.message : "request_failed");
        }
    },
    [e, t, g, c]
  ), $ = U(() => {
    const f = new Set(g.filter((b) => b.status === "done" && b.batchId).map((b) => b.batchId));
    if (v((b) => b.filter((R) => R.status !== "done")), t)
      for (const b of f)
        g.some((R) => R.batchId === b && R.status !== "done") || e.pinsDismiss(t.path, b).catch(() => {
        });
  }, [g, t, e]), A = me(() => new Set(g.map((f) => f.issueKey).filter((f) => !!f)), [g]);
  return {
    selectMode: m,
    setSelectMode: x,
    pins: g,
    setPins: v,
    activePin: C,
    setViewerFrame: T,
    updatePinComment: E,
    removePin: N,
    jumpToPin: y,
    sending: O,
    sendError: j,
    sendPins: P,
    replyToPin: p,
    dismissDone: $,
    pinnedIssues: A
  };
}
function Cn({ client: e, selected: t, preview: n, t: r, setPins: l, pinnedIssues: i }) {
  const [d, u] = k(null), [c, h] = k(null), [m, x] = k(null);
  W(() => {
    u(null), h(null), x(null);
  }, [t == null ? void 0 : t.path]);
  const g = U(async () => {
    if (!(!t || (d == null ? void 0 : d.state) === "running")) {
      x(null), h(null);
      try {
        const o = await e.checkStart(t.path);
        u(o);
      } catch (o) {
        x(o instanceof ee ? o.code : "request_failed");
      }
    }
  }, [e, t, d == null ? void 0 : d.state]);
  W(() => {
    if (!d || d.state !== "running") return;
    let o = !0;
    const S = setInterval(async () => {
      try {
        const T = await e.checkStatus(d.id);
        if (!o || T.state === "running") return;
        u(T), T.state === "done" && T.result ? h(T.result) : x(T.error ?? "check_failed");
      } catch (T) {
        if (!o) return;
        u(null), x(T instanceof ee ? T.code : "request_failed");
      }
    }, 700);
    return () => {
      o = !1, clearInterval(S);
    };
  }, [e, d == null ? void 0 : d.id, d == null ? void 0 : d.state]);
  const v = U(
    (o) => {
      if (!n) return;
      const S = Se(o), T = lt(t, n, o.slideIndex), D = {
        slideIndex: o.slideIndex,
        cid: null,
        selector: o.selector,
        tag: o.tag,
        elementId: null,
        classes: o.classes,
        text: o.text,
        rect: o.rect ?? { x: 0, y: 0, w: 0, h: 0 },
        src: o.src ?? null
      }, E = `check.fixcomment.${o.rule}`, N = r(E) === E ? r(`check.rule.${o.rule}`) : r(E);
      l((y) => {
        if (y.some((j) => j.issueKey === S)) return y;
        const O = y.reduce((j, w) => Math.max(j, w.index), 0) + 1, z = ot(D, T, O);
        return [...y, { ...z, comment: o.detail ? `${N} (${o.detail})` : N, issueKey: S }];
      });
    },
    [n, t == null ? void 0 : t.kind, t == null ? void 0 : t.entry, t == null ? void 0 : t.slidesDir, r, l]
    // eslint-disable-line react-hooks/exhaustive-deps
  ), C = U(() => {
    if (c)
      for (const o of c.issues) i.has(Se(o)) || v(o);
  }, [c, i, v]);
  return { checkJob: d, checkResult: c, setCheckResult: h, checkError: m, runCheck: g, fixIssue: v, fixAllIssues: C };
}
function Sn({ client: e, selected: t, preview: n, current: r, setPreview: l, setDecks: i, setCurrent: d, bumpReload: u, invalidateNotes: c, showRebuild: h }) {
  const [m, x] = k(!1), [g, v] = k(null), [C, o] = k([]), [S, T] = k(!1);
  W(() => {
    if (o([]), v(null), !t) return;
    let w = !0;
    return e.slidesArchiveList(t.path).then((P) => w && o(P.items)).catch(() => {
    }), () => {
      w = !1;
    };
  }, [e, t == null ? void 0 : t.path]);
  const D = U(
    (w, P) => {
      if (l((_) => _ && { ..._, slides: w.slides }), t && i((_) => _.map((p) => p.id === t.id ? { ...p, slideCount: w.slides.length } : p)), u(), c(), P) {
        const _ = w.slides.indexOf(P);
        _ >= 0 && d(_);
      } else d((_) => Math.min(_, Math.max(0, w.slides.length - 1)));
      t && h(w.rebuild, t.path), t && e.slidesArchiveList(t.path).then((_) => o(_.items)).catch(() => {
      });
    },
    [e, t, h, l, i, d, u, c]
  ), E = U(
    async (w, P = !0) => {
      x(!0), v(null);
      try {
        const _ = await w();
        D(_, P ? _.name : void 0);
      } catch (_) {
        v(_ instanceof ee ? _.code : "request_failed");
      } finally {
        x(!1);
      }
    },
    [D]
  ), [N, y] = k(null);
  W(() => {
    y(null);
  }, [t == null ? void 0 : t.path]);
  const O = me(
    () => t ? {
      busy: m,
      onAdd: (w) => y({ mode: "insert", after: w }),
      onDuplicate: (w) => void E(() => e.slidesAdd(t.path, w, !0)),
      onSaveLayout: (w) => y({ mode: "save", after: w, slide: w }),
      onReorder: (w) => {
        const P = n == null ? void 0 : n.slides[r], _ = P ? w.indexOf(P) : -1;
        E(async () => {
          const p = await e.slidesReorder(t.path, w);
          return { ...p, name: _ >= 0 ? p.slides[_] : void 0 };
        });
      },
      onArchive: (w) => void E(() => e.slidesArchive(t.path, w), !1)
    } : void 0,
    [t, m, n, r, E, e]
  ), z = U(
    (w) => {
      t && E(() => e.slidesRestore(t.path, w, (n == null ? void 0 : n.slides[r]) ?? null));
    },
    [e, t, n, r, E]
  ), j = U(
    (w, P) => {
      t && (y(null), E(() => e.slidesAdd(t.path, P, !1, w)));
    },
    [e, t, E]
  );
  return { arrangeBusy: m, arrangeError: g, archived: C, archiveOpen: S, setArchiveOpen: T, arrangeActions: O, restore: z, picker: N, setPicker: y, insertLayout: j };
}
function $n({ client: e, selected: t, setPreview: n, setPreviewError: r, bumpReload: l }) {
  const [i, d] = k(null), [u, c] = k(!1), [h, m] = k(!1);
  W(() => {
    if (!t || !t.hasDesignMd) {
      d(null);
      return;
    }
    let v = !0;
    return e.design(t.path).then((C) => v && d(C)).catch((C) => {
      console.warn("[html-studio] design failed", C), v && d(null);
    }), () => {
      v = !1;
    };
  }, [e, t == null ? void 0 : t.path, t == null ? void 0 : t.hasDesignMd]);
  const x = U(async () => {
    if (t) {
      c(!0);
      try {
        const v = await e.writeTokens(t.path);
        d(v);
        const C = await e.previewStart(t.path);
        n(C), l();
      } catch (v) {
        r(v instanceof ee ? v.code : "request_failed");
      } finally {
        c(!1);
      }
    }
  }, [e, t, n, r, l]), g = U(() => {
    t && (l(), e.previewStart(t.path).then(n).catch(() => {
    }), e.design(t.path).then(d).catch(() => {
    }));
  }, [e, t, n, l]);
  return { designInfo: i, tokensBusy: u, tweakOpen: h, setTweakOpen: m, writeTokens: x, onApplied: g };
}
function Rn(e, t) {
  const [n, r] = k(null), [l, i] = k(null);
  W(() => {
    r(null), i(null);
  }, [t == null ? void 0 : t.path]);
  const d = U(async () => {
    if (t) {
      i(null);
      try {
        let c = await e.pdfStart(t.path);
        for (r(c); c.state === "running"; )
          await new Promise((h) => setTimeout(h, 1e3)), c = await e.pdfStatus(c.id), r(c);
        c.state === "error" && i(c.error ?? "pdf_failed");
      } catch (c) {
        r(null), i(c instanceof ee ? c.code : "request_failed");
      }
    }
  }, [e, t]), u = U(() => {
    r(null), i(null);
  }, []);
  return { pdf: n, pdfError: l, exportPdf: d, dismiss: u };
}
function et({ key: e, initial: t, min: n, max: r, fromPointer: l }) {
  const [i, d] = k(() => {
    try {
      const h = Number(localStorage.getItem(e));
      return h >= n && h <= r ? h : t;
    } catch {
      return t;
    }
  }), u = X(null), c = U(
    (h) => {
      const m = u.current;
      if (!m) return;
      h.preventDefault();
      const x = h.currentTarget;
      x.setPointerCapture(h.pointerId);
      const g = m.getBoundingClientRect(), v = (o) => d(Math.min(r, Math.max(n, l(o, g)))), C = () => {
        x.removeEventListener("pointermove", v), x.removeEventListener("pointerup", C), x.removeEventListener("pointercancel", C), d((o) => {
          try {
            localStorage.setItem(e, String(o));
          } catch {
          }
          return o;
        });
      };
      x.addEventListener("pointermove", v), x.addEventListener("pointerup", C), x.addEventListener("pointercancel", C);
    },
    [e, n, r, l]
  );
  return { ratio: i, boxRef: u, onPointerDown: c };
}
function Dn() {
  const e = X(null), [t, n] = k(0);
  return W(() => {
    const r = e.current;
    if (!r) return;
    const l = new ResizeObserver(() => n(r.getBoundingClientRect().bottom));
    return l.observe(r), n(r.getBoundingClientRect().bottom), () => l.disconnect();
  }, []), { headRef: e, headH: t };
}
const In = {
  "app.title": "HTML Studio",
  "app.subtitle": "View, edit, check and present HTML slide decks",
  "status.connecting": "Connecting to backend…",
  "status.connected": "Backend connected",
  "status.error": "Backend unreachable",
  "lang.label": "Language",
  "lang.auto": "Auto",
  "sidebar.collapse": "Hide sidebar",
  "sidebar.expand": "Show sidebar",
  "panel.decks": "Decks",
  "panel.decks.empty": "Register a folder to look for decks in. New decks are created inside a registered folder too.",
  "panel.slides": "Slides",
  "panel.slides.empty": "Select a deck to list its slides here.",
  "panel.preview": "Preview",
  "panel.preview.empty": "Select a deck to preview it here.",
  "panel.chat": "Deck chat",
  "panel.chat.empty": "Select a deck to chat about it.",
  "roots.add": "Register folder",
  "roots.picking": "Opening folder chooser…",
  "roots.path_placeholder": "~/Documents/decks",
  "roots.confirm": "Add",
  "roots.remove": "Remove",
  "decks.loading": "Scanning…",
  "decks.none_found": "No decks found in these folders. A deck is a folder with a slides/ directory of .html files or a studio.json.",
  "decks.slide_count": "{n} slides",
  "deck.summary.path": "Path",
  "deck.summary.slides": "Slides",
  "deck.summary.slides_dir": "Slides folder",
  "deck.summary.theme": "Theme",
  "deck.summary.theme_default": "Built-in default",
  "deck.summary.no_slides": "This deck has no slide files yet.",
  "toolbar.build": "Build",
  "toolbar.check": "Check",
  "toolbar.present": "Present",
  "toolbar.pdf": "PDF",
  "footer.version": "Version",
  "error.generic": "Request failed ({code})",
  "error.not_found": "That folder does not exist.",
  "error.not_a_directory": "That path is not a folder.",
  "error.outside_home": "Folders must be inside your home directory.",
  "error.relative_path": "Enter an absolute path.",
  "error.empty_path": "Enter a path.",
  "error.picker_unsupported": "The folder chooser is not available here. Type a path instead.",
  "error.request_failed": "Could not reach the backend.",
  "viewer.prev": "Previous slide",
  "viewer.next": "Next slide",
  "viewer.loading": "Starting preview…",
  "viewer.default_theme": "Built-in theme",
  "build.ok": "Build succeeded · {s}s",
  "build.failed": "Build failed · {s}s",
  "build.mode.builtin": "Built-in assembler",
  "build.mode.external": "Deck build command",
  "build.log": "Log",
  "build.dismiss": "Dismiss",
  "build.issue.open": "Open this slide",
  "build.trust.title": "Run this deck's build command?",
  "build.trust.body": "This command is declared in the deck's studio.json and will run inside the deck folder. Only continue if you trust where this deck came from. Your choice is remembered for this exact command.",
  "build.trust.accept": "Trust and build",
  "build.trust.cancel": "Cancel",
  "view.label": "View",
  "view.slides": "Slides",
  "view.output": "Built output",
  "view.output_hint": "Showing the built deck. Use its own keys to navigate (usually ← / →).",
  "build.hint.loading": "Checking build settings…",
  "build.hint.single_file": "Single-file deck: already built. Add a build command in studio.json to rebuild it.",
  "decks.kind.single": "single file",
  "error.backend_unavailable": "The backend is not running. Turn the app off and on in the App Store.",
  "error.deck_not_allowed": "That deck is not inside one of your deck folders.",
  "error.folder_chooser_failed": "The folder chooser could not be opened.",
  "error.picker_busy": "A folder chooser is already open.",
  "error.path_required": "Enter a path.",
  "error.unknown_route": "The running backend is older than the app UI. Turn the app off and on in the App Store to restart it.",
  "present.hint": "Present full-screen from the current slide; the presenter window opens in your browser",
  "present.need_output": "Build the deck first: this deck is built by its own command, and the show is its output",
  "pdf.hint": "Export every slide to PDF (one slide per page)",
  "pdf.done": "PDF saved ({kb} KB)",
  "pdf.reveal": "Show in folder",
  "error.no_output": "Build the deck first.",
  "error.no_browser": "No headless Chromium found. Install Google Chrome, or set HTML_STUDIO_CHROME to a Chromium binary.",
  "error.pdf_timeout": "PDF rendering timed out.",
  "error.pdf_failed": "PDF rendering failed.",
  "error.open_failed": "Could not open the system browser.",
  "present.title": "Presentation",
  "present.zoom": "Enlarged image",
  "present.keys": "← → or click: navigate · click an image: enlarge · Esc: exit",
  "present.fullscreen": "Fullscreen",
  "present.close": "Exit",
  "chat.title": "HTML Studio · {name}",
  "chat.failed": "Could not open the deck chat",
  "chat.none": "No session for {name} yet.",
  "chat.start": "Start deck chat",
  "chat.retry": "Retry",
  "chat.open_full": "Open in Chat",
  "chat.open_full_hint": "Open this session on the Chat page",
  "chat.placeholder": "Ask for a change to {name}…",
  "split.label": "Resize preview and chat",
  "chat.tagline": "ask the agent to change this deck; it works inside the deck folder",
  "theme.colors": "Theme colours",
  "theme.empty": "DESIGN.md has no tokens the studio understands",
  "theme.tokens.missing": "tokens.css not generated",
  "theme.tokens.stale": "tokens.css is out of date",
  "theme.tokens.fresh": "tokens.css up to date",
  "theme.tokens.write": "Generate tokens.css",
  "theme.tokens.update": "Update tokens.css",
  "theme.tokens.hint": "Write CSS variables from DESIGN.md into the deck folder; the preview uses them right away",
  "theme.tokens.own_css_hint": "This deck styles itself with {css}; tokens.css is written next to it for that stylesheet to import",
  "viewer.tokens_theme": "Built-in theme + tokens.css",
  "toolbar.select": "Select",
  "select.hint": "Click an element in the preview to pin a comment on it",
  "select.on_hint": "Selection on: click an element to add a pin. Click Select again to stop.",
  "pins.title": "Pins ({n})",
  "pins.hint": "Pin comments, then send them to the deck chat in one batch.",
  "pins.clear": "Clear all",
  "pins.jump": "Go to slide {n}",
  "pins.placeholder": "What should change here?",
  "pins.comment_for": "Comment for pin {n}",
  "pins.remove": "Remove pin",
  "pins.lost": "element not found",
  "pins.moved": "re-anchored by position",
  "pins.send": "Send to agent",
  "pins.sending": "Sending",
  "pins.send_hint": "Write the pins to a batch and hand it to this deck's chat session",
  "pins.need_comment": "Every pin needs a comment before sending",
  "pins.status.new": "draft",
  "pins.status.sent": "sent",
  "pins.status.done": "done",
  "pins.status.question": "question",
  "pins.reply": "Reply",
  "pins.reply_placeholder": "Answer the agent's question",
  "pins.dismiss_done": "Dismiss finished",
  "pins.send_failed": "Could not send the pins",
  "check.hint": "Check every slide: overflow, clipping, overlap, broken images, contrast, punctuation",
  "check.running": "Checking {n} slides",
  "check.title": "Check: {n} issues",
  "check.clean": "Check: no issues in {n} slides",
  "check.fix": "Fix",
  "check.fix_all": "Pin all",
  "check.close": "Close",
  "check.disabled": "Disabled in studio.json: {rules}",
  "check.failed": "Check failed",
  "check.rule.overflow": "Leaves the slide",
  "check.rule.clipped": "Content cut off",
  "check.rule.overlap": "Overlapping elements",
  "check.rule.broken-image": "Image missing",
  "check.rule.missing-cover": "First slide is not a cover",
  "check.rule.contrast": "Low contrast",
  "check.rule.external-resource": "External resource",
  "check.rule.inline-font-size": "Inline font-size",
  "check.rule.check-error": "Could not measure slide",
  "check.fixcomment.overflow": "Keep this inside the 1280x720 slide",
  "check.fixcomment.clipped": "Make the cut-off content fit or shorten it",
  "check.fixcomment.overlap": "Separate these overlapping elements",
  "check.fixcomment.broken-image": "Fix or replace this missing image",
  "check.fixcomment.missing-cover": "Make the first slide a cover slide",
  "check.fixcomment.contrast": "Increase the text/background contrast to at least the required ratio",
  "check.fixcomment.external-resource": "Bundle this resource into the deck (assets/ or img/) instead of loading it from the web",
  "check.fixcomment.inline-font-size": "Move this font-size into the stylesheet or use a deck class",
  "check.rule.punctuation": "Dash or middle dot in text",
  "check.fixcomment.punctuation": "Rewrite without em/en dashes and middle dots; use plain punctuation or a pipe",
  "quick.label": "Quick actions for slide {n}",
  "quick.summarize": "Summarize",
  "quick.draft-next": "Draft next slide",
  "quick.notes": "Write notes",
  "quick.check": "Review",
  "quick.tighten": "Tighten text",
  "quick.sent": "Sent to the deck chat",
  "quick.failed": "Could not send",
  "quick.hint.summarize": "Three bullets on what this slide says (no edits)",
  "quick.hint.draft-next": "Create the following slide from this one's context",
  "quick.hint.notes": "Speaker notes into notes/<slide>.md",
  "quick.hint.check": "Wording and layout review of this slide (no edits)",
  "quick.hint.tighten": "Shorter text, same meaning, edits the slide",
  "notes.title": "Notes for slide {n}",
  "notes.tagline": "speaker notes, kept in notes/ and never shown on the slide",
  "notes.has": "has notes",
  "notes.placeholder": "Talking points for this slide (Markdown). Saved automatically.",
  "notes.hint": "Markdown. Not included in the built deck or the PDF; shown in the presenter view.",
  "notes.saving": "Saving",
  "notes.saved": "Saved",
  "notes.unsaved": "Unsaved",
  "notes.save_failed": "Save failed",
  "notes.orphans": "{n} note(s) without a slide",
  "notes.show": "Show",
  "strip.has_notes": "Has notes",
  "presenter.black": "Black",
  "present.presenter_on": "Presenter window connected",
  "present.presenter_off": "No presenter window",
  "present.presenter_window": "Presenter window",
  "present.presenter_hint": "Open the presenter window (notes, next slide, timer, pen) in your browser; drag it to your own screen",
  "view.code": "Code",
  "code.title": "Slide {n} source",
  "code.loading": "Loading",
  "code.saving": "Saving",
  "code.saved": "Saved",
  "code.unsaved": "Unsaved changes",
  "code.error": "Could not save ({code})",
  "code.save": "Save",
  "code.save_hint": "Save to disk. Rebuilds the deck when it has been built.",
  "code.reload": "Reload",
  "code.reload_hint": "Load the file from disk again (drops unsaved changes)",
  "code.conflict": "This file changed on disk since you opened it (the agent or another editor wrote it).",
  "code.conflict_reload": "Reload from disk",
  "code.conflict_overwrite": "Overwrite with mine",
  "code.hint": "Tab indents. Saving refreshes the preview and the strip; a built deck is rebuilt.",
  "split.code_label": "Resize editor and preview",
  "strip.add": "+ Add slide after this one",
  "strip.menu": "Slide actions",
  "strip.move_up": "Move up",
  "strip.move_down": "Move down",
  "strip.duplicate": "Duplicate",
  "strip.archive": "Archive",
  "strip.archive_box": "Archive ({n})",
  "strip.restore": "Restore",
  "strip.restore_hint": "Put this slide back after the current one",
  "strip.save_layout": "Save as layout",
  "layout.title": "Add a slide",
  "layout.hint": "Pick a layout; it is inserted after the current slide, shown here in this deck's own stylesheet.",
  "layout.save_title": "Save as layout",
  "layout.save_hint": "Store this slide as a reusable layout for every deck.",
  "layout.close": "Close",
  "layout.builtin": "Built-in layouts",
  "layout.mine": "My layouts",
  "layout.mine_empty": "None yet. Use Save as layout in a slide's menu.",
  "layout.insert": "Insert {name}",
  "layout.delete": "Delete layout {name}",
  "layout.delete_short": "Delete",
  "layout.name_label": "Layout name",
  "layout.name_placeholder": "e.g. Quarterly KPI row",
  "layout.save": "Save",
  "layout.saved": "Saved as {name}",
  "layout.save_note": "The slide is copied as is, including deck-relative paths such as img/. In another deck those may need fixing.",
  "layout.blank": "Blank",
  "layout.cover": "Cover",
  "layout.agenda": "Agenda",
  "layout.divider": "Section divider",
  "layout.two-column": "Two columns",
  "layout.table": "Table",
  "layout.kpi": "Key numbers",
  "layout.image-caption": "Image with caption",
  "newdeck.button": "New deck",
  "newdeck.needs_root": "Register a folder first: the deck is created inside one of your folders",
  "newdeck.title": "New deck",
  "newdeck.hint": "A folder with studio.json, a cover and an agenda slide, and brief.md for the agent.",
  "newdeck.group_deck": "Deck",
  "newdeck.f_title": "Title",
  "newdeck.f_presenter": "Presenter",
  "newdeck.f_purpose": "Purpose",
  "newdeck.f_audience": "Audience",
  "newdeck.f_sources": "Source material",
  "newdeck.f_sources_hint": "File paths, links, or points to cover. Saved to brief.md and handed to the agent.",
  "newdeck.group_theme": "Theme",
  "newdeck.theme_default": "Built-in default",
  "newdeck.theme_design": "Colours and font (writes DESIGN.md + tokens.css)",
  "newdeck.theme_copy": "Copy from another deck",
  "newdeck.theme_copy_from": "Deck to copy the theme from",
  "newdeck.c_accent": "Accent",
  "newdeck.c_bg": "Background",
  "newdeck.c_fg": "Text",
  "newdeck.c_font": "Font",
  "newdeck.group_where": "Location",
  "newdeck.f_root": "Folder (registered)",
  "newdeck.f_folder": "Deck folder name",
  "newdeck.ask_outline": "Open the deck chat and ask the agent for an outline",
  "newdeck.create": "Create deck",
  "newdeck.err_exists": "A folder with that name already exists.",
  "newdeck.err_bad_folder": "Folder name: letters, digits, space, dot, dash or underscore; not starting with a dot.",
  "newdeck.err_missing_title": "A title is needed.",
  "newdeck.err_no_theme_to_copy": "That deck has no stylesheet or DESIGN.md to copy.",
  "toolbar.tweak": "Theme",
  "toolbar.tweak_hint": "Edit the theme's colours, font, sizes and spacing with live preview; Apply writes tokens.css",
  "tweak.title": "Edit theme",
  "tweak.hint_design": "Variables declared in DESIGN.md. Changes show at once; Apply writes them to DESIGN.md and tokens.css.",
  "tweak.hint_default": "This deck has no DESIGN.md: these are the built-in theme's hooks. Apply creates DESIGN.md and tokens.css for it.",
  "tweak.group_colors": "Colours",
  "tweak.group_font": "Font",
  "tweak.group_typography": "Type sizes",
  "tweak.group_spacing": "Spacing",
  "tweak.group_rounded": "Corners",
  "tweak.apply": "Apply to tokens.css",
  "tweak.revert_all": "Revert all",
  "tweak.revert_one": "Revert {name}",
  "tweak.applying": "Applying",
  "tweak.applied": "Applied",
  "tweak.dirty": "{n} changed, not applied",
  "tweak.note": "Colours hard-coded in the deck's own CSS are not variables and stay as they are.",
  "tweak.hint_no_tokens": "tokens.css is not the deck's stylesheet yet, so slides do not read these variables until you Apply (which generates it) or the slides use them.",
  "toolbar.group_view": "View and tools",
  "toolbar.group_actions": "Actions",
  "theme.row_hint": "Open the theme panel",
  "tweak.hint_layered": "This deck has its own stylesheet ({css}). tokens.css is loaded underneath it as a variables layer, so only values the stylesheet reads as variables change.",
  "roots.summary": "Folders: {first}",
  "roots.manage": "Manage",
  "roots.rescan": "Rescan",
  "roots.rescan_hint": "Read the folders again now (they are rescanned every few seconds anyway)",
  "roots.hint": "Every subfolder with a slides/ directory or a studio.json is listed as a deck.",
  "build.script.found": "This deck has {script}. Build with it ({command}) instead of the built-in assembler?",
  "build.script.use": "Use {script}",
  "build.script.ignore": "Keep built-in",
  "build.stale": "Slides changed since the last build. The show and the output view still show the old build."
}, Tn = {
  "app.title": "HTML Studio",
  "app.subtitle": "HTML 슬라이드 덱을 보고, 고치고, 점검하고, 발표합니다",
  "status.connecting": "백엔드 연결 중…",
  "status.connected": "백엔드 연결됨",
  "status.error": "백엔드에 연결할 수 없음",
  "lang.label": "언어",
  "lang.auto": "자동",
  "sidebar.collapse": "사이드바 숨기기",
  "sidebar.expand": "사이드바 보이기",
  "panel.decks": "덱",
  "panel.decks.empty": "덱을 찾을 폴더를 먼저 등록하세요. 새 덱도 등록된 폴더 안에 만들어집니다.",
  "panel.slides": "슬라이드",
  "panel.slides.empty": "덱을 선택하면 슬라이드가 여기에 표시됩니다.",
  "panel.preview": "미리보기",
  "panel.preview.empty": "덱을 선택하면 여기에 표시됩니다.",
  "panel.chat": "덱 채팅",
  "panel.chat.empty": "덱을 선택하면 그 덱에 대해 대화할 수 있습니다.",
  "roots.add": "폴더 등록",
  "roots.picking": "폴더 선택 창 여는 중…",
  "roots.path_placeholder": "~/Documents/decks",
  "roots.confirm": "추가",
  "roots.remove": "제거",
  "decks.loading": "검색 중…",
  "decks.none_found": "이 폴더에서 덱을 찾지 못했습니다. 덱은 .html 파일이 든 slides/ 폴더 또는 studio.json이 있는 폴더입니다.",
  "decks.slide_count": "{n}장",
  "deck.summary.path": "경로",
  "deck.summary.slides": "슬라이드",
  "deck.summary.slides_dir": "슬라이드 폴더",
  "deck.summary.theme": "테마",
  "deck.summary.theme_default": "기본 내장 테마",
  "deck.summary.no_slides": "이 덱에는 아직 슬라이드 파일이 없습니다.",
  "toolbar.build": "빌드",
  "toolbar.check": "점검",
  "toolbar.present": "발표",
  "toolbar.pdf": "PDF",
  "footer.version": "버전",
  "error.generic": "요청 실패 ({code})",
  "error.not_found": "해당 폴더가 존재하지 않습니다.",
  "error.not_a_directory": "폴더가 아닙니다.",
  "error.outside_home": "홈 디렉토리 안의 폴더만 추가할 수 있습니다.",
  "error.relative_path": "절대 경로를 입력하세요.",
  "error.empty_path": "경로를 입력하세요.",
  "error.picker_unsupported": "이 환경에서는 폴더 선택 창을 사용할 수 없습니다. 경로를 입력하세요.",
  "error.request_failed": "백엔드에 연결할 수 없습니다.",
  "viewer.prev": "이전 슬라이드",
  "viewer.next": "다음 슬라이드",
  "viewer.loading": "미리보기 준비 중…",
  "viewer.default_theme": "기본 내장 테마",
  "build.ok": "빌드 성공 · {s}초",
  "build.failed": "빌드 실패 · {s}초",
  "build.mode.builtin": "내장 조립기",
  "build.mode.external": "덱 빌드 명령",
  "build.log": "로그",
  "build.dismiss": "닫기",
  "build.issue.open": "이 슬라이드 열기",
  "build.trust.title": "이 덱의 빌드 명령을 실행할까요?",
  "build.trust.body": "이 명령은 덱의 studio.json에 적혀 있으며 덱 폴더 안에서 실행됩니다. 덱의 출처를 신뢰할 때만 계속하세요. 이 명령 그대로에 대해서만 선택이 기억됩니다.",
  "build.trust.accept": "신뢰하고 빌드",
  "build.trust.cancel": "취소",
  "view.label": "보기",
  "view.slides": "슬라이드",
  "view.output": "빌드 결과",
  "view.output_hint": "빌드된 덱을 표시 중입니다. 덱 자체 키로 이동하세요(보통 ← / →).",
  "build.hint.loading": "빌드 설정 확인 중…",
  "build.hint.single_file": "단일 파일 덱: 이미 빌드된 상태입니다. 다시 빌드하려면 studio.json에 빌드 명령을 추가하세요.",
  "decks.kind.single": "단일 파일",
  "error.backend_unavailable": "백엔드가 실행 중이 아닙니다. App Store에서 앱을 끄고 다시 켜세요.",
  "error.deck_not_allowed": "그 덱은 등록한 덱 폴더 안에 없습니다.",
  "error.folder_chooser_failed": "폴더 선택 창을 열 수 없습니다.",
  "error.picker_busy": "폴더 선택 창이 이미 열려 있습니다.",
  "error.path_required": "경로를 입력하세요.",
  "error.unknown_route": "실행 중인 백엔드가 앱 UI보다 오래된 버전입니다. App Store에서 앱을 끄고 다시 켜 백엔드를 재시작하세요.",
  "present.hint": "현재 슬라이드부터 전체화면 발표. 발표자 창이 브라우저로 함께 열립니다",
  "present.need_output": "먼저 빌드하세요. 이 덱은 자체 빌드 명령으로 만들어지고, 발표 화면은 그 산출물입니다",
  "pdf.hint": "모든 슬라이드를 PDF로 내보내기(슬라이드 1장 = 1페이지)",
  "pdf.done": "PDF 저장됨 ({kb} KB)",
  "pdf.reveal": "폴더에서 보기",
  "error.no_output": "먼저 덱을 빌드하세요.",
  "error.no_browser": "헤드리스 Chromium을 찾을 수 없습니다. Google Chrome을 설치하거나 HTML_STUDIO_CHROME에 Chromium 경로를 지정하세요.",
  "error.pdf_timeout": "PDF 렌더링 시간이 초과되었습니다.",
  "error.pdf_failed": "PDF 렌더링에 실패했습니다.",
  "error.open_failed": "시스템 브라우저를 열 수 없습니다.",
  "present.title": "발표",
  "present.zoom": "확대한 이미지",
  "present.keys": "← → 또는 클릭: 이동 · 이미지 클릭: 확대 · Esc: 종료",
  "present.fullscreen": "전체화면",
  "present.close": "종료",
  "chat.title": "HTML Studio · {name}",
  "chat.failed": "덱 채팅을 열 수 없습니다",
  "chat.none": "{name}의 세션이 아직 없습니다.",
  "chat.start": "덱 채팅 시작",
  "chat.retry": "다시 시도",
  "chat.open_full": "채팅 화면에서 열기",
  "chat.open_full_hint": "이 세션을 채팅 페이지에서 열기",
  "chat.placeholder": "{name}에 바꿀 점을 말해 주세요…",
  "split.label": "미리보기/채팅 크기 조절",
  "chat.tagline": "에이전트에게 이 덱의 수정을 요청합니다. 덱 폴더 안에서 작업합니다",
  "theme.colors": "테마 색상",
  "theme.empty": "DESIGN.md에 스튜디오가 이해하는 토큰이 없습니다",
  "theme.tokens.missing": "tokens.css 미생성",
  "theme.tokens.stale": "tokens.css가 오래됨",
  "theme.tokens.fresh": "tokens.css 최신",
  "theme.tokens.write": "tokens.css 생성",
  "theme.tokens.update": "tokens.css 갱신",
  "theme.tokens.hint": "DESIGN.md의 값을 CSS 변수로 덱 폴더에 씁니다. 미리보기에 바로 적용됩니다",
  "theme.tokens.own_css_hint": "이 덱은 {css}로 스타일을 정합니다. tokens.css는 그 스타일시트가 불러 쓰도록 옆에 생성됩니다",
  "viewer.tokens_theme": "내장 테마 + tokens.css",
  "toolbar.select": "선택",
  "select.hint": "미리보기에서 요소를 클릭해 핀 코멘트를 남깁니다",
  "select.on_hint": "선택 모드: 요소를 클릭하면 핀이 추가됩니다. 끄려면 [선택]을 다시 누르세요.",
  "pins.title": "핀 ({n})",
  "pins.hint": "핀에 코멘트를 적고, 한 번에 덱 채팅으로 보내세요.",
  "pins.clear": "모두 지우기",
  "pins.jump": "{n}번 슬라이드로",
  "pins.placeholder": "여기를 어떻게 바꿀까요?",
  "pins.comment_for": "핀 {n} 코멘트",
  "pins.remove": "핀 제거",
  "pins.lost": "요소를 찾지 못함",
  "pins.moved": "위치로 다시 찾음",
  "pins.send": "에이전트에 보내기",
  "pins.sending": "보내는 중",
  "pins.send_hint": "핀을 한 묶음으로 만들어 이 덱의 채팅 세션에 넘깁니다",
  "pins.need_comment": "보내기 전에 모든 핀에 코멘트를 적어 주세요",
  "pins.status.new": "초안",
  "pins.status.sent": "보냄",
  "pins.status.done": "완료",
  "pins.status.question": "질문",
  "pins.reply": "답하기",
  "pins.reply_placeholder": "에이전트의 질문에 답하기",
  "pins.dismiss_done": "완료된 핀 정리",
  "pins.send_failed": "핀을 보내지 못했습니다",
  "check.hint": "모든 슬라이드 점검: 넘침, 잘림, 겹침, 이미지 유실, 대비, 문장부호",
  "check.running": "{n}장 점검 중",
  "check.title": "점검: {n}건",
  "check.clean": "점검: {n}장 모두 이상 없음",
  "check.fix": "고치기",
  "check.fix_all": "모두 핀으로",
  "check.close": "닫기",
  "check.disabled": "studio.json에서 끔: {rules}",
  "check.failed": "점검 실패",
  "check.rule.overflow": "슬라이드 밖으로 나감",
  "check.rule.clipped": "내용 잘림",
  "check.rule.overlap": "요소 겹침",
  "check.rule.broken-image": "이미지 유실",
  "check.rule.missing-cover": "첫 슬라이드가 커버가 아님",
  "check.rule.contrast": "대비 부족",
  "check.rule.external-resource": "외부 리소스",
  "check.rule.inline-font-size": "인라인 font-size",
  "check.rule.check-error": "슬라이드를 측정하지 못함",
  "check.fixcomment.overflow": "1280x720 슬라이드 안에 들어오게 해줘",
  "check.fixcomment.clipped": "잘린 내용이 들어가도록 맞추거나 줄여줘",
  "check.fixcomment.overlap": "겹치는 요소들을 떨어뜨려줘",
  "check.fixcomment.broken-image": "유실된 이미지를 고치거나 바꿔줘",
  "check.fixcomment.missing-cover": "첫 슬라이드를 커버 슬라이드로 만들어줘",
  "check.fixcomment.contrast": "글자와 배경 대비를 요구 비율 이상으로 올려줘",
  "check.fixcomment.external-resource": "이 리소스를 웹에서 불러오지 말고 덱 안(assets/ 또는 img/)에 포함해줘",
  "check.fixcomment.inline-font-size": "이 font-size를 스타일시트나 덱 클래스로 옮겨줘",
  "check.rule.punctuation": "대시 또는 중앙 점 사용",
  "check.fixcomment.punctuation": "엠 대시와 중앙 점 없이 다시 써줘. 일반 문장부호나 세로줄(|)을 써줘",
  "quick.label": "{n}번 슬라이드 빠른 작업",
  "quick.summarize": "요약",
  "quick.draft-next": "다음 슬라이드 초안",
  "quick.notes": "노트 써줘",
  "quick.check": "리뷰",
  "quick.tighten": "간결하게",
  "quick.sent": "덱 채팅으로 보냈습니다",
  "quick.failed": "보내지 못했습니다",
  "quick.hint.summarize": "이 슬라이드 내용 요약 세 줄 (파일 수정 없음)",
  "quick.hint.draft-next": "이 슬라이드 맥락으로 다음 슬라이드 파일 생성",
  "quick.hint.notes": "발표자 노트를 notes/<슬라이드>.md에 작성",
  "quick.hint.check": "이 슬라이드의 표현과 레이아웃 리뷰 (수정 없음)",
  "quick.hint.tighten": "뜻은 그대로, 문장을 짧게. 슬라이드 파일 수정",
  "notes.title": "{n}번 슬라이드 노트",
  "notes.tagline": "발표자 노트. notes/에 저장되며 슬라이드에는 나타나지 않습니다",
  "notes.has": "노트 있음",
  "notes.placeholder": "이 슬라이드에서 말할 내용 (Markdown). 자동 저장됩니다.",
  "notes.hint": "Markdown. 빌드 결과물과 PDF에는 포함되지 않고 발표자 뷰에 표시됩니다.",
  "notes.saving": "저장 중",
  "notes.saved": "저장됨",
  "notes.unsaved": "저장 안 됨",
  "notes.save_failed": "저장 실패",
  "notes.orphans": "슬라이드 없는 노트 {n}개",
  "notes.show": "보기",
  "strip.has_notes": "노트 있음",
  "presenter.black": "블랙",
  "present.presenter_on": "발표자 창 연결됨",
  "present.presenter_off": "발표자 창 없음",
  "present.presenter_window": "발표자 창",
  "present.presenter_hint": "발표자 창(노트, 다음 슬라이드, 타이머, 펜)을 브라우저로 엽니다. 본인 화면으로 옮겨 두세요",
  "view.code": "코드",
  "code.title": "{n}번 슬라이드 소스",
  "code.loading": "불러오는 중",
  "code.saving": "저장 중",
  "code.saved": "저장됨",
  "code.unsaved": "저장 안 된 변경",
  "code.error": "저장 실패 ({code})",
  "code.save": "저장",
  "code.save_hint": "디스크에 저장. 빌드된 덱이면 다시 빌드합니다.",
  "code.reload": "다시 불러오기",
  "code.reload_hint": "파일을 디스크에서 다시 읽습니다 (저장 안 된 변경은 사라짐)",
  "code.conflict": "파일을 연 뒤에 디스크 내용이 바뀌었습니다 (에이전트나 다른 편집기가 썼습니다).",
  "code.conflict_reload": "디스크에서 다시 불러오기",
  "code.conflict_overwrite": "내 변경으로 덮어쓰기",
  "code.hint": "Tab 들여쓰기. 저장하면 미리보기와 스트립이 갱신되고, 빌드된 덱은 다시 빌드됩니다.",
  "split.code_label": "편집기와 미리보기 크기 조절",
  "strip.add": "+ 이 다음에 슬라이드 추가",
  "strip.menu": "슬라이드 작업",
  "strip.move_up": "위로",
  "strip.move_down": "아래로",
  "strip.duplicate": "복제",
  "strip.archive": "보관",
  "strip.archive_box": "보관함 ({n})",
  "strip.restore": "복원",
  "strip.restore_hint": "현재 슬라이드 다음으로 되돌립니다",
  "strip.save_layout": "레이아웃으로 저장",
  "layout.title": "슬라이드 추가",
  "layout.hint": "레이아웃을 고르면 현재 슬라이드 다음에 들어갑니다. 이 덱의 스타일시트로 보여줍니다.",
  "layout.save_title": "레이아웃으로 저장",
  "layout.save_hint": "이 슬라이드를 모든 덱에서 쓸 수 있는 레이아웃으로 저장합니다.",
  "layout.close": "닫기",
  "layout.builtin": "기본 레이아웃",
  "layout.mine": "내 레이아웃",
  "layout.mine_empty": "아직 없습니다. 슬라이드 메뉴의 [레이아웃으로 저장]을 쓰세요.",
  "layout.insert": "{name} 넣기",
  "layout.delete": "레이아웃 {name} 삭제",
  "layout.delete_short": "삭제",
  "layout.name_label": "레이아웃 이름",
  "layout.name_placeholder": "예: 분기 KPI 한 줄",
  "layout.save": "저장",
  "layout.saved": "{name}(으)로 저장됨",
  "layout.save_note": "슬라이드를 그대로 복사합니다(img/ 같은 덱 상대경로 포함). 다른 덱에서는 그 부분을 손봐야 할 수 있습니다.",
  "layout.blank": "빈 슬라이드",
  "layout.cover": "커버",
  "layout.agenda": "아젠다",
  "layout.divider": "섹션 구분",
  "layout.two-column": "2단",
  "layout.table": "표",
  "layout.kpi": "핵심 숫자",
  "layout.image-caption": "이미지와 설명",
  "newdeck.button": "새 덱",
  "newdeck.needs_root": "먼저 폴더를 등록하세요. 덱은 등록된 폴더 안에 만들어집니다",
  "newdeck.title": "새 덱",
  "newdeck.hint": "studio.json, 커버와 아젠다 슬라이드, 에이전트용 brief.md가 든 폴더를 만듭니다.",
  "newdeck.group_deck": "덱",
  "newdeck.f_title": "제목",
  "newdeck.f_presenter": "발표자",
  "newdeck.f_purpose": "목적",
  "newdeck.f_audience": "청중",
  "newdeck.f_sources": "기반 자료",
  "newdeck.f_sources_hint": "파일 경로, 링크, 다룰 내용. brief.md에 저장되고 에이전트에게 전달됩니다.",
  "newdeck.group_theme": "테마",
  "newdeck.theme_default": "기본 내장 테마",
  "newdeck.theme_design": "색과 글꼴 지정 (DESIGN.md + tokens.css 생성)",
  "newdeck.theme_copy": "다른 덱에서 가져오기",
  "newdeck.theme_copy_from": "테마를 가져올 덱",
  "newdeck.c_accent": "강조",
  "newdeck.c_bg": "배경",
  "newdeck.c_fg": "글자",
  "newdeck.c_font": "글꼴",
  "newdeck.group_where": "위치",
  "newdeck.f_root": "폴더 (등록된 것)",
  "newdeck.f_folder": "덱 폴더 이름",
  "newdeck.ask_outline": "덱 채팅을 열고 에이전트에게 개요를 요청",
  "newdeck.create": "덱 만들기",
  "newdeck.err_exists": "같은 이름의 폴더가 이미 있습니다.",
  "newdeck.err_bad_folder": "폴더 이름은 글자, 숫자, 공백, 점, 대시, 밑줄만 가능하고 점으로 시작할 수 없습니다.",
  "newdeck.err_missing_title": "제목이 필요합니다.",
  "newdeck.err_no_theme_to_copy": "그 덱에는 복사할 스타일시트나 DESIGN.md가 없습니다.",
  "toolbar.tweak": "테마 수정",
  "toolbar.tweak_hint": "테마의 색·글꼴·크기·여백을 실시간 미리보기로 수정합니다. 적용하면 tokens.css에 씁니다",
  "tweak.title": "테마 수정",
  "tweak.hint_design": "DESIGN.md에 선언된 변수입니다. 바꾸면 바로 보이고, 적용하면 DESIGN.md와 tokens.css에 기록됩니다.",
  "tweak.hint_default": "이 덱에는 DESIGN.md가 없어 기본 테마의 항목을 보여줍니다. 적용하면 DESIGN.md와 tokens.css를 새로 만듭니다.",
  "tweak.group_colors": "색상",
  "tweak.group_font": "글꼴",
  "tweak.group_typography": "글자 크기",
  "tweak.group_spacing": "여백",
  "tweak.group_rounded": "모서리",
  "tweak.apply": "tokens.css에 적용",
  "tweak.revert_all": "모두 되돌리기",
  "tweak.revert_one": "{name} 되돌리기",
  "tweak.applying": "적용 중",
  "tweak.applied": "적용됨",
  "tweak.dirty": "{n}개 변경, 미적용",
  "tweak.note": "덱 자체 CSS에 직접 적힌 색은 변수가 아니라 조정되지 않습니다.",
  "tweak.hint_no_tokens": "아직 tokens.css가 이 덱의 스타일시트가 아니어서, 적용(생성)하기 전에는 슬라이드가 이 변수를 읽지 않을 수 있습니다.",
  "toolbar.group_view": "보기와 도구",
  "toolbar.group_actions": "작업",
  "theme.row_hint": "테마 패널 열기",
  "tweak.hint_layered": "이 덱은 자체 스타일시트({css})를 씁니다. tokens.css는 그 아래 변수 층으로 함께 로드되므로, 스타일시트가 변수로 읽는 값만 바뀝니다.",
  "roots.summary": "폴더: {first}",
  "roots.manage": "관리",
  "roots.rescan": "다시 읽기",
  "roots.rescan_hint": "폴더를 지금 다시 읽습니다 (몇 초마다 자동으로도 읽습니다)",
  "roots.hint": "slides/ 폴더나 studio.json이 있는 하위 폴더가 덱으로 나열됩니다.",
  "build.script.found": "이 덱에 {script}가 있습니다. 내장 조립기 대신 이 스크립트({command})로 빌드할까요?",
  "build.script.use": "{script} 사용",
  "build.script.ignore": "내장 조립기 유지",
  "build.stale": "마지막 빌드 뒤에 슬라이드가 바뀌었습니다. 발표 화면과 산출물 보기는 아직 이전 빌드입니다."
}, tt = { en: In, ko: Tn }, ct = "html-studio.lang", En = ["en", "ko"];
function An(e) {
  return e !== "auto" ? e : ((typeof navigator < "u" ? navigator.language : "en") || "en").toLowerCase().startsWith("ko") ? "ko" : "en";
}
function On() {
  try {
    const e = localStorage.getItem(ct);
    if (e === "en" || e === "ko" || e === "auto") return e;
  } catch {
  }
  return "auto";
}
function Pn(e, t, n) {
  let r = tt[e][t] ?? tt.en[t] ?? t;
  if (n)
    for (const [l, i] of Object.entries(n)) r = r.replaceAll(`{${l}}`, String(i));
  return r;
}
function Mn() {
  const [e, t] = k(On), [, n] = k(0);
  W(() => {
    const d = () => n((u) => u + 1);
    return window.addEventListener("languagechange", d), () => window.removeEventListener("languagechange", d);
  }, []);
  const r = U((d) => {
    t(d);
    try {
      localStorage.setItem(ct, d);
    } catch {
    }
  }, []), l = An(e);
  return { t: me(
    () => (d, u) => Pn(l, d, u),
    [l]
  ), locale: l, pref: e, setPref: r };
}
function Hn() {
  const e = nt(), t = me(() => Lt(e), [e]), { t: n, locale: r, pref: l, setPref: i } = Mn(), { conn: d, status: u, roots: c, decks: h, setDecks: m, loading: x, error: g, errorDetail: v, selectedId: C, selected: o, decksForce: S, slidesForce: T, refresh: D, addRoot: E, removeRoot: N, selectDeck: y } = kn(t), [O, z] = Re("sidebar", !0), j = bn(o == null ? void 0 : o.path), { preview: w, setPreview: P, previewError: _, setPreviewError: p, current: $, setCurrent: A, reloadKey: f, bumpReload: b, viewMode: R, setViewMode: M, externalChanges: V, draftsRef: Y, outputFrameRef: Q, syncDeck: re } = yn({
    client: t,
    selected: o,
    setDecks: m,
    onExternalChange: j.invalidate
  }), te = wn({ client: t, selected: o, preview: w, externalChanges: V, t: n, setViewMode: M, setCurrent: A, bumpReload: b }), { buildInfo: oe, building: ne, buildResult: pe, pendingCommand: fe, runBuild: le, showRebuild: L, outputUrl: q, showUrl: B, canBuild: J, buildHint: Z } = te, I = Nn({ api: e, selected: o, preview: w, buildInfo: oe, current: $, locale: r, t: n, bumpReload: b, bumpNotes: j.bump }), H = _n({ client: t, selected: o, preview: w, current: $, locale: r, setCurrent: A, setViewMode: M, bumpReload: b, postToChat: I.post, bumpChat: I.bumpChat }), { selectMode: ae, setSelectMode: he, activePin: ve, setViewerFrame: dt } = H, ke = Cn({ client: t, selected: o, preview: w, t: n, setPins: H.setPins, pinnedIssues: H.pinnedIssues }), { checkJob: ce, checkResult: Le, checkError: be } = ke, De = Sn({ client: t, selected: o, preview: w, current: $, setPreview: P, setDecks: m, setCurrent: A, bumpReload: b, invalidateNotes: j.invalidate, showRebuild: L }), { arrangeBusy: qe, arrangeError: je, archived: Ie, archiveOpen: Te, setArchiveOpen: ut, arrangeActions: ht, picker: ye, setPicker: mt } = De, we = $n({ client: t, selected: o, setPreview: P, setPreviewError: p, bumpReload: b }), { designInfo: Ee, tweakOpen: Ne, setTweakOpen: Ae } = we, { pdf: se, pdfError: ge, exportPdf: pt, dismiss: ft } = Rn(t, o), gt = et({ key: "hs.chatRatio", initial: 0.4, min: 0.15, max: 0.8, fromPointer: (K, de) => (de.bottom - K.clientY) / de.height }), xt = et({ key: "hs.codeRatio", initial: 0.45, min: 0.15, max: 0.75, fromPointer: (K, de) => (K.clientY - de.top) / de.height }), { ratio: Be, boxRef: vt, onPointerDown: kt } = gt, { ratio: He, boxRef: bt, onPointerDown: yt } = xt, { headRef: wt, headH: ze } = Dn(), [Nt, Ue] = k(!1), _t = U(() => {
    !o || !B || Ue(!0);
  }, [o, B]), [Ct, Oe] = k(!1), St = U(
    async (K, de, ue) => {
      if (Oe(!1), await D(), y(K), !!de)
        try {
          const Dt = r.startsWith("ko") ? "Korean" : "English", It = [
            "This deck was just created with the new deck wizard. brief.md in the deck folder holds the same answers.",
            `Title: ${ue.title}`,
            ue.presenter ? `Presenter: ${ue.presenter}` : "",
            ue.purpose ? `Purpose: ${ue.purpose}` : "",
            ue.audience ? `Audience: ${ue.audience}` : "",
            ue.sources ? `Source material:
${ue.sources}` : "",
            "",
            `Propose an outline for this deck as a numbered list of slide titles with one line each on what the slide shows (answer in ${Dt}). Do not create files yet; wait for my go-ahead.`
          ].filter((Tt) => Tt !== "").join(`
`);
          await I.post(K, It, { preview: null, build: null }), I.setChatOpen(!0);
        } catch {
        }
    },
    [D, r, I]
    // eslint-disable-line react-hooks/exhaustive-deps
  ), $t = n(d === "connecting" ? "status.connecting" : d === "connected" ? "status.connected" : "status.error"), Rt = O ? "minmax(200px, 1fr) minmax(320px, 4fr)" : "36px minmax(320px, 4fr)";
  return /* @__PURE__ */ a("div", { className: "flex flex-col min-h-0", lang: r, children: [
    /* @__PURE__ */ a("div", { ref: wt, children: [
      /* @__PURE__ */ s(Ot, { title: n("app.title"), subtitle: n("app.subtitle") }),
      /* @__PURE__ */ a("div", { className: "px-6 pb-3 flex items-center gap-3 text-[12px] flex-wrap", children: [
        /* @__PURE__ */ a("span", { className: "inline-flex items-center gap-2 text-muted", role: "status", "aria-live": "polite", children: [
          /* @__PURE__ */ s(Fn, { conn: d }),
          $t,
          u ? ` · ${n("footer.version")} ${u.version}` : "",
          " · ui 1451"
        ] }),
        /* @__PURE__ */ a("div", { className: "ml-auto inline-flex items-center gap-1", role: "group", "aria-label": n("lang.label"), children: [
          /* @__PURE__ */ s("span", { className: "text-muted mr-1", children: n("lang.label") }),
          ["auto", ...En].map((K) => /* @__PURE__ */ s(F, { active: l === K, "aria-pressed": l === K, onClick: () => i(K), children: K === "auto" ? n("lang.auto") : K.toUpperCase() }, K))
        ] })
      ] })
    ] }),
    /* @__PURE__ */ a(
      "div",
      {
        className: "hs-grid px-6 pb-6 grid gap-3",
        style: {
          gridTemplateColumns: Rt,
          gridAutoRows: "minmax(0, 1fr)",
          height: ze ? `calc(100dvh - ${Math.round(ze)}px)` : void 0,
          minHeight: 320
        },
        children: [
          /* @__PURE__ */ s("style", { children: `
          @media (max-width: 1100px) { .hs-grid { grid-template-columns: 1fr !important; grid-auto-rows: auto !important; height: auto !important; } }
          /* The host Card is a plain block with unknown inner wrappers. Turn the whole
             chain from the grid cell down to the section body into min-height:0 flex
             columns, so the body is the ONE element that scrolls. */
          .hs-grid > div { min-height: 0; display: flex; flex-direction: column; }
          .hs-grid > div > *, .hs-grid > div > * > * { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
          /* Right column: two cards share the height (inline flex-basis on each wrapper). */
          .hs-grid .hs-right > div > * { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
          .hs-grid .hs-right > div > * > * { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
          .hs-grid .hs-right-chat[style*="0 0 auto"] > * > *, .hs-grid .hs-right-notes[style*="0 0 auto"] > * > * { flex: 0 0 auto; }
          .hs-grid .hs-fill { flex: 1 1 auto; min-height: 0; }
          .hs-grid .hs-scroll { overflow-y: auto !important; }
          .hs-grid section[data-grow="true"] { flex: 1 1 auto; min-height: 0; }
          .hs-grid section[data-grow="true"] > [id$="-body"] { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
        ` }),
          O ? /* @__PURE__ */ s("div", { className: "min-h-0 flex flex-col", children: /* @__PURE__ */ s(_e, { children: /* @__PURE__ */ a("div", { className: "flex flex-col min-h-0 hs-fill", children: [
            /* @__PURE__ */ s("div", { className: "flex items-center justify-end -mt-1 -mr-1 flex-none", children: /* @__PURE__ */ s(F, { onClick: () => z(!1), "aria-label": n("sidebar.collapse"), title: n("sidebar.collapse"), children: "◂" }) }),
            /* @__PURE__ */ s(
              Qe,
              {
                id: "decks",
                title: n("panel.decks"),
                badge: h.length ? `(${h.length})` : void 0,
                forceOpen: S,
                grow: !o,
                children: /* @__PURE__ */ s(
                  en,
                  {
                    t: n,
                    locale: r,
                    roots: c,
                    decks: h,
                    selectedId: C,
                    loading: x,
                    error: g,
                    errorDetail: v,
                    pickerSupported: (u == null ? void 0 : u.pickerSupported) ?? /Mac/i.test(navigator.platform),
                    connected: d === "connected",
                    onSelect: y,
                    onAddRoot: E,
                    onRemoveRoot: N,
                    onRefresh: async () => {
                      await D(), await re();
                    },
                    onNew: () => Oe(!0)
                  }
                )
              }
            ),
            /* @__PURE__ */ s("div", { className: "my-2 border-t border-border flex-none" }),
            /* @__PURE__ */ s(
              Qe,
              {
                id: "slides",
                title: n("panel.slides"),
                badge: o ? `(${o.slideCount})` : void 0,
                defaultOpen: !1,
                forceOpen: T,
                grow: !0,
                children: o ? w ? w.slides.length ? /* @__PURE__ */ a(xe, { children: [
                  /* @__PURE__ */ s(un, { t: n, preview: w, current: $, onSelect: A, reloadKey: f, withNotes: j.withNotes, notesLabel: n("strip.has_notes"), arrange: ht }),
                  je && /* @__PURE__ */ s("p", { className: "m-0 mt-2 text-[12px]", role: "alert", style: { color: "var(--danger)" }, children: n("error.generic", { code: je }) }),
                  Ie.length > 0 && /* @__PURE__ */ a("div", { className: "mt-3 text-[12px]", "data-testid": "archive-list", children: [
                    /* @__PURE__ */ a(
                      "button",
                      {
                        type: "button",
                        onClick: () => ut((K) => !K),
                        "aria-expanded": Te,
                        className: "w-full text-left bg-transparent border-0 p-0 cursor-pointer text-muted hover:text-text",
                        children: [
                          Te ? "▾" : "▸",
                          " ",
                          n("strip.archive_box", { n: Ie.length })
                        ]
                      }
                    ),
                    Te && /* @__PURE__ */ s("ul", { className: "m-0 mt-1 p-0 list-none flex flex-col gap-1", children: Ie.map((K) => /* @__PURE__ */ a("li", { className: "flex items-center gap-2", children: [
                      /* @__PURE__ */ s("span", { className: "truncate flex-1 text-muted", title: K.file, children: K.name }),
                      /* @__PURE__ */ s(
                        F,
                        {
                          disabled: qe,
                          onClick: () => De.restore(K.name),
                          title: n("strip.restore_hint"),
                          children: n("strip.restore")
                        }
                      )
                    ] }, K.name)) })
                  ] })
                ] }) : /* @__PURE__ */ s("p", { className: "m-0 text-[12px] text-muted", children: n("deck.summary.no_slides") }) : _ ? /* @__PURE__ */ s("p", { className: "m-0 text-[12px]", style: { color: "var(--danger)" }, children: n("error.generic", { code: _ }) }) : /* @__PURE__ */ a("p", { className: "m-0 text-[12px] text-muted inline-flex items-center gap-2", children: [
                  /* @__PURE__ */ s(ie, {}),
                  " ",
                  n("viewer.loading")
                ] }) : /* @__PURE__ */ s("p", { className: "m-0 text-[12px] text-muted", children: n("panel.slides.empty") })
              }
            )
          ] }) }) }) : /* @__PURE__ */ s("div", { className: "flex flex-col items-center pt-2", children: /* @__PURE__ */ s(F, { onClick: () => z(!0), "aria-label": n("sidebar.expand"), title: n("sidebar.expand"), children: "▸" }) }),
          /* @__PURE__ */ a("div", { ref: vt, className: "hs-right min-h-0 flex flex-col", children: [
            /* @__PURE__ */ s("div", { className: "hs-right-preview min-h-0 flex flex-col", style: { flex: "1 1 0" }, children: /* @__PURE__ */ s(_e, { children: /* @__PURE__ */ a("div", { className: "hs-fill min-h-0 flex flex-col", children: [
              /* @__PURE__ */ a("div", { className: "flex items-center justify-between gap-2 mb-2 flex-wrap flex-none", children: [
                /* @__PURE__ */ s(Pt, { children: o ? o.name : n("panel.preview") }),
                /* @__PURE__ */ a("div", { className: "flex gap-3 flex-wrap items-center", children: [
                  /* @__PURE__ */ a("div", { className: "flex gap-1 items-center", role: "group", "aria-label": n("toolbar.group_view"), children: [
                    w && /* @__PURE__ */ s("div", { className: "inline-flex rounded-md border border-border overflow-hidden mr-1", role: "group", "aria-label": n("view.label"), children: (q ? ["slides", "output", "code"] : ["slides", "code"]).map((K) => /* @__PURE__ */ s(
                      "button",
                      {
                        type: "button",
                        onClick: () => M(K),
                        "aria-pressed": R === K,
                        className: "px-2 py-0.5 text-[12px] cursor-pointer border-0",
                        style: {
                          background: R === K ? "var(--bg-hover)" : "transparent",
                          color: R === K ? "var(--accent)" : "var(--muted)",
                          fontWeight: R === K ? 600 : 400
                        },
                        children: n(`view.${K}`)
                      },
                      K
                    )) }),
                    /* @__PURE__ */ s(
                      F,
                      {
                        onClick: () => he((K) => !K),
                        active: ae,
                        "aria-pressed": ae,
                        disabled: !w || R !== "slides",
                        title: n("select.hint"),
                        children: n("toolbar.select")
                      }
                    ),
                    /* @__PURE__ */ s(F, { onClick: () => Ae((K) => !K), active: Ne, "aria-pressed": Ne, disabled: !o || !w, title: n("toolbar.tweak_hint"), "data-testid": "toolbar-tweak", children: n("toolbar.tweak") })
                  ] }),
                  /* @__PURE__ */ a("div", { className: "flex gap-1 items-center", role: "group", "aria-label": n("toolbar.group_actions"), children: [
                    /* @__PURE__ */ a(
                      F,
                      {
                        onClick: () => le(!1),
                        disabled: !J,
                        className: "inline-flex items-center gap-1.5",
                        title: Z,
                        children: [
                          ne && /* @__PURE__ */ s(ie, {}),
                          n("toolbar.build")
                        ]
                      }
                    ),
                    /* @__PURE__ */ a(
                      F,
                      {
                        onClick: () => void ke.runCheck(),
                        disabled: !w || (ce == null ? void 0 : ce.state) === "running",
                        title: n("check.hint"),
                        className: "inline-flex items-center gap-1.5",
                        children: [
                          (ce == null ? void 0 : ce.state) === "running" && /* @__PURE__ */ s(ie, {}),
                          (ce == null ? void 0 : ce.state) === "running" && w ? n("check.running", { n: w.slides.length }) : n("toolbar.check")
                        ]
                      }
                    ),
                    /* @__PURE__ */ a(
                      F,
                      {
                        onClick: () => void pt(),
                        disabled: !w || (se == null ? void 0 : se.state) === "running",
                        title: n("pdf.hint"),
                        className: "inline-flex items-center gap-1.5",
                        children: [
                          (se == null ? void 0 : se.state) === "running" && /* @__PURE__ */ s(ie, {}),
                          n("toolbar.pdf")
                        ]
                      }
                    ),
                    /* @__PURE__ */ s(F, { active: !0, onClick: _t, disabled: !B, title: n(B ? "present.hint" : "present.need_output"), children: n("toolbar.present") })
                  ] })
                ] })
              ] }),
              o && ((se == null ? void 0 : se.state) === "done" || ge) && /* @__PURE__ */ a(
                "div",
                {
                  className: "mb-2 flex-none rounded-md border p-2 text-[12px] flex items-center gap-2 flex-wrap",
                  style: { borderColor: ge ? "var(--danger)" : "var(--ok)" },
                  role: "status",
                  children: [
                    ge ? /* @__PURE__ */ a("span", { style: { color: "var(--danger)" }, children: [
                      n(`error.${ge}`) === `error.${ge}` ? n("error.generic", { code: ge }) : n(`error.${ge}`),
                      se != null && se.detail ? /* @__PURE__ */ s("span", { className: "block text-muted break-all", children: se.detail }) : null
                    ] }) : /* @__PURE__ */ a(xe, { children: [
                      /* @__PURE__ */ s("span", { style: { color: "var(--ok)" }, children: n("pdf.done", { kb: Math.round(((se == null ? void 0 : se.bytes) ?? 0) / 1024) }) }),
                      /* @__PURE__ */ s("span", { className: "text-muted break-all", children: se == null ? void 0 : se.output }),
                      /* @__PURE__ */ s(F, { onClick: () => (se == null ? void 0 : se.output) && o && void t.reveal(o.path, se.output.slice(o.path.length + 1)), children: n("pdf.reveal") })
                    ] }),
                    /* @__PURE__ */ s(F, { className: "ml-auto", onClick: ft, "aria-label": n("build.dismiss"), children: "✕" })
                  ]
                }
              ),
              o && Ee && /* @__PURE__ */ s(vn, { t: n, info: Ee, onOpenTheme: () => Ae(!0) }),
              o && be && /* @__PURE__ */ a("div", { className: "mb-2 flex-none rounded-md border p-2 text-[12px]", style: { borderColor: "var(--danger)", color: "var(--danger)" }, role: "alert", children: [
                n("check.failed"),
                ": ",
                n(`error.${be}`) === `error.${be}` ? n("error.generic", { code: be }) : n(`error.${be}`),
                ce != null && ce.detail ? /* @__PURE__ */ s("span", { className: "block text-muted break-all", children: ce.detail }) : null
              ] }),
              o && Le && /* @__PURE__ */ s(
                jt,
                {
                  t: n,
                  result: Le,
                  pinned: H.pinnedIssues,
                  onJump: (K) => {
                    A(K), M("slides");
                  },
                  onFix: ke.fixIssue,
                  onFixAll: ke.fixAllIssues,
                  onClose: () => ke.setCheckResult(null)
                }
              ),
              o && te.outputStale && /* @__PURE__ */ a("div", { className: "mb-2 flex-none rounded-md border p-2 text-[12px] flex flex-wrap items-center gap-2", style: { borderColor: "var(--warn)" }, role: "status", "data-testid": "build-stale-notice", children: [
                /* @__PURE__ */ s("span", { className: "flex-1 min-w-0", children: n("build.stale") }),
                /* @__PURE__ */ a(F, { active: !0, onClick: () => le(!1), disabled: !J, className: "inline-flex items-center gap-1.5", children: [
                  ne && /* @__PURE__ */ s(ie, {}),
                  n("toolbar.build")
                ] })
              ] }),
              o && te.scriptOffer && /* @__PURE__ */ a("div", { className: "mb-2 flex-none rounded-md border p-3 text-[13px] flex flex-wrap items-center gap-2", style: { borderColor: "var(--border)" }, role: "status", "data-testid": "build-script-notice", children: [
                /* @__PURE__ */ s("span", { className: "flex-1 min-w-0", children: n("build.script.found", { script: te.scriptOffer.script, command: te.scriptOffer.command }) }),
                /* @__PURE__ */ s(F, { active: !0, onClick: te.adoptScript, children: n("build.script.use", { script: te.scriptOffer.script }) }),
                /* @__PURE__ */ s(F, { onClick: te.ignoreScript, children: n("build.script.ignore") })
              ] }),
              o && (pe || fe) && /* @__PURE__ */ s("div", { className: "mb-2 flex-none overflow-y-auto", style: { maxHeight: "40%" }, children: /* @__PURE__ */ s(
                qt,
                {
                  t: n,
                  result: pe,
                  pendingCommand: fe,
                  onTrust: () => le(!0),
                  onCancelTrust: () => te.setPendingCommand(null),
                  onOpenIssue: te.openIssue,
                  onDismiss: () => te.setBuildResult(null)
                }
              ) }),
              /* @__PURE__ */ a("div", { className: "flex min-h-0 flex-1", style: { gap: Ne ? 12 : 0 }, children: [
                /* @__PURE__ */ s("div", { className: "flex flex-col min-h-0 min-w-0 flex-1", children: o && w ? R === "code" && w.slides[$] ? /* @__PURE__ */ a("div", { ref: bt, className: "flex flex-col min-h-0 flex-1", "data-testid": "code-view", children: [
                  /* @__PURE__ */ s("div", { className: "min-w-0 min-h-0 flex flex-col overflow-hidden", style: { flex: `0 0 calc(${Math.round(He * 1e3) / 10}% - 6px)` }, children: /* @__PURE__ */ s(Xe, { t: n, preview: w, current: $, onChange: A, reloadKey: f }) }),
                  /* @__PURE__ */ s(
                    "div",
                    {
                      role: "separator",
                      "aria-orientation": "horizontal",
                      "aria-label": n("split.code_label"),
                      "aria-valuenow": Math.round(He * 100),
                      "data-testid": "code-split-handle",
                      onPointerDown: yt,
                      className: "flex-none flex items-center justify-center",
                      style: { flex: "0 0 12px", height: 12, cursor: "row-resize", touchAction: "none" },
                      children: /* @__PURE__ */ s("div", { className: "rounded-full", style: { flex: "0 0 3px", width: 40, height: 3, background: "var(--border-strong, var(--border))", opacity: 0.8 } })
                    }
                  ),
                  /* @__PURE__ */ s("div", { className: "min-w-0 min-h-0 flex flex-col flex-1 overflow-hidden", children: /* @__PURE__ */ s(
                    Xt,
                    {
                      t: n,
                      client: t,
                      deckPath: o.path,
                      slide: w.slides[$],
                      slideNumber: $ + 1,
                      drafts: Y.current,
                      refreshKey: f,
                      onSaved: (K) => {
                        b(), L(K.rebuild, o.path);
                      }
                    }
                  ) })
                ] }) : R === "output" && q ? /* @__PURE__ */ a("div", { className: "flex flex-col gap-2 min-h-0", children: [
                  /* @__PURE__ */ s("div", { className: "text-[12px] text-muted", children: n("view.output_hint") }),
                  /* @__PURE__ */ s(
                    "div",
                    {
                      className: "w-full rounded-md border border-border overflow-hidden",
                      style: { aspectRatio: "16 / 9", background: "#111" },
                      children: /* @__PURE__ */ s(
                        "iframe",
                        {
                          ref: Q,
                          src: `${q}#${$ + 1}`,
                          title: (oe == null ? void 0 : oe.output) ?? "output",
                          sandbox: "allow-scripts allow-same-origin",
                          className: "w-full h-full border-0"
                        },
                        f
                      )
                    }
                  )
                ] }) : /* @__PURE__ */ a(xe, { children: [
                  ae && /* @__PURE__ */ s("div", { className: "mb-1 flex-none text-[12px]", style: { color: "var(--accent)" }, role: "status", children: n("select.on_hint") }),
                  /* @__PURE__ */ s(Xe, { t: n, preview: w, current: $, onChange: A, reloadKey: f, selectMode: ae, frameRef: dt }),
                  /* @__PURE__ */ s(
                    rn,
                    {
                      t: n,
                      pins: H.pins,
                      current: $,
                      activeId: ve,
                      sending: H.sending,
                      sendError: H.sendError,
                      onComment: H.updatePinComment,
                      onRemove: H.removePin,
                      onJump: H.jumpToPin,
                      onClearAll: () => H.setPins([]),
                      onSend: () => void H.sendPins(),
                      onReply: (K, de) => void H.replyToPin(K, de),
                      onDismissDone: H.dismissDone
                    }
                  )
                ] }) : /* @__PURE__ */ s(
                  "div",
                  {
                    className: "w-full rounded-md border border-border flex items-center justify-center",
                    style: { aspectRatio: "16 / 9", borderStyle: "dashed", minHeight: 160 },
                    children: o ? _ ? /* @__PURE__ */ s("p", { className: "text-sm text-center px-4", style: { color: "var(--danger)" }, children: n("error.generic", { code: _ }) }) : /* @__PURE__ */ a("p", { className: "text-sm text-muted inline-flex items-center gap-2", children: [
                      /* @__PURE__ */ s(ie, {}),
                      " ",
                      n("viewer.loading")
                    ] }) : /* @__PURE__ */ s("p", { className: "text-sm text-muted text-center px-4", children: n("panel.preview.empty") })
                  }
                ) }),
                Ne && o && w && /* @__PURE__ */ s("div", { className: "min-h-0 flex-none", style: { width: 300 }, children: /* @__PURE__ */ s(
                  xn,
                  {
                    t: n,
                    client: t,
                    deckPath: o.path,
                    design: Ee,
                    tokensBusy: we.tokensBusy,
                    onWriteTokens: () => void we.writeTokens(),
                    onPreview: b,
                    onApplied: (K) => {
                      we.onApplied(), L(K, o.path), D();
                    },
                    onClose: () => Ae(!1)
                  }
                ) })
              ] })
            ] }) }) }),
            Ct && /* @__PURE__ */ s(fn, { t: n, client: t, roots: c, decks: h, onCreated: (K, de, ue) => void St(K, de, ue), onClose: () => Oe(!1) }),
            ye && o && w && /* @__PURE__ */ s(
              hn,
              {
                t: n,
                client: t,
                preview: w,
                mode: ye.mode,
                after: ye.after,
                saveSlide: ye.slide,
                deckPath: o.path,
                busy: qe,
                onClose: () => mt(null),
                onPick: De.insertLayout
              }
            ),
            o && w && w.slides[$] && /* @__PURE__ */ s("div", { className: "hs-right-notes min-h-0 flex flex-col", style: { flex: j.notesOpen ? "0 0 22%" : "0 0 auto", marginTop: 12 }, children: /* @__PURE__ */ s(_e, { children: /* @__PURE__ */ s(
              Kt,
              {
                t: n,
                client: t,
                deckPath: o.path,
                slide: w.slides[$],
                slideNumber: $ + 1,
                open: j.notesOpen,
                onToggle: () => j.setNotesOpen(!j.notesOpen),
                onChanged: j.setNotesIndex,
                refreshKey: j.notesRefresh + f
              }
            ) }) }),
            I.chatOpen ? /* @__PURE__ */ s(
              "div",
              {
                role: "separator",
                "aria-orientation": "horizontal",
                "aria-label": n("split.label"),
                "aria-valuenow": Math.round(Be * 100),
                "data-testid": "split-handle",
                onPointerDown: kt,
                className: "flex-none flex items-center justify-center",
                style: { flex: "0 0 12px", height: 12, cursor: "row-resize", touchAction: "none" },
                children: /* @__PURE__ */ s("div", { className: "rounded-full", style: { flex: "0 0 3px", width: 40, height: 3, background: "var(--border-strong, var(--border))", opacity: 0.8 } })
              }
            ) : /* @__PURE__ */ s("div", { style: { flex: "0 0 12px", height: 12 } }),
            /* @__PURE__ */ s("div", { className: "hs-right-chat min-h-0 flex flex-col", style: { flex: I.chatOpen ? `0 0 ${Math.round(Be * 1e3) / 10}%` : "0 0 auto" }, children: /* @__PURE__ */ s(_e, { children: /* @__PURE__ */ s(
              Ut,
              {
                t: n,
                locale: r,
                deck: o,
                preview: w,
                build: oe,
                open: I.chatOpen,
                onToggle: () => I.setChatOpen(!I.chatOpen),
                refreshKey: I.chatRefresh,
                toolbar: w ? /* @__PURE__ */ s(dn, { t: n, slideNumber: $ + 1, onRun: I.runQuickAction }) : null
              }
            ) }) })
          ] })
        ]
      }
    ),
    Nt && o && B && w && /* @__PURE__ */ s(
      an,
      {
        t: n,
        url: B,
        baseUrl: w.baseUrl,
        startSlide: $ + 1,
        slideCount: w.slides.length,
        onClose: () => Ue(!1),
        onPosition: (K) => A(K - 1),
        openPresenter: async (K) => {
          await t.present(o.path, K, "presenter", r);
        }
      }
    )
  ] });
}
function Fn({ conn: e }) {
  const t = e === "connected" ? "bg-ok" : e === "error" ? "bg-danger" : "bg-warn", n = e === "connected" ? "#22c55e" : e === "error" ? "#ef4444" : "#eab308";
  return /* @__PURE__ */ s(
    "span",
    {
      "aria-hidden": !0,
      className: `inline-block w-2 h-2 rounded-full ${t}`,
      style: { backgroundColor: `var(--${t.slice(3)}, ${n})` }
    }
  );
}
export {
  Hn as default
};
