import { jsx as s, jsxs as i, Fragment as we } from "react/jsx-runtime";
import { useAppApi as Ue, useNavigate as jt, ChatEmbed as Bt } from "@kirocrew/app-sdk";
import { PageHeader as Ht, Card as Ie, CardTitle as zt } from "@kirocrew/app-sdk/ui";
import { useState as x, useEffect as V, useCallback as K, useRef as Z, useMemo as be, useLayoutEffect as Ut } from "react";
const Y = "/apps/html-studio/api";
class ee extends Error {
  constructor(t, n, r) {
    super(n ?? t), this.code = t, this.body = r;
  }
}
function Wt(e) {
  var o;
  const t = e;
  if ((o = t == null ? void 0 : t.body) != null && o.error)
    return new ee(t.body.error, t.body.detail, t.body);
  const n = String((t == null ? void 0 : t.message) ?? ""), r = /^API (\d{3}): ([\s\S]*)$/.exec(n);
  if (r) {
    const a = Number(r[1]);
    let l;
    try {
      l = JSON.parse(r[2]);
    } catch {
      l = void 0;
    }
    const h = typeof (l == null ? void 0 : l.error) == "string" && l.error || (a === 502 || a === 503 || a === 504 ? "backend_unavailable" : `http_${a}`);
    return new ee(h, typeof (l == null ? void 0 : l.detail) == "string" ? l.detail : n, l);
  }
  return new ee("request_failed", n || void 0);
}
function ct(e) {
  const t = async (n) => {
    try {
      return await n;
    } catch (r) {
      throw Wt(r);
    }
  };
  return {
    status: () => t(e.get(`${Y}/status`)),
    roots: () => t(e.get(`${Y}/roots`)),
    addRoot: (n) => t(e.post(`${Y}/roots/add`, { path: n })),
    pickStart: () => t(e.post(`${Y}/roots/pick`, {})),
    pickStatus: (n) => t(e.get(`${Y}/roots/pick?id=${encodeURIComponent(n)}`)),
    removeRoot: (n) => t(e.post(`${Y}/roots/remove`, { path: n })),
    decks: () => t(e.get(`${Y}/decks`)),
    previewStart: (n) => t(e.post(`${Y}/preview/start`, { path: n })),
    previewStop: (n) => t(e.post(`${Y}/preview/stop`, { path: n })),
    buildInfo: (n) => t(e.post(`${Y}/build/info`, { path: n })),
    buildAdopt: (n) => t(e.post(`${Y}/build/adopt`, { path: n })),
    build: (n, r = !1) => t(e.post(`${Y}/build`, { path: n, trust: r })),
    buildStatus: (n) => t(e.get(`${Y}/build?id=${encodeURIComponent(n)}`)),
    present: (n, r, o, a) => t(e.post(`${Y}/present`, { path: n, slide: r, mode: o, language: a })),
    pdfStart: (n) => t(e.post(`${Y}/pdf`, { path: n })),
    pdfStatus: (n) => t(e.get(`${Y}/pdf?id=${encodeURIComponent(n)}`)),
    reveal: (n, r) => t(e.post(`${Y}/reveal`, { path: n, file: r })),
    notesIndex: (n) => t(e.get(`${Y}/notes?path=${encodeURIComponent(n)}`)),
    noteGet: (n, r) => t(e.get(`${Y}/note?path=${encodeURIComponent(n)}&slide=${encodeURIComponent(r)}`)),
    sourceGet: (n, r) => t(e.get(`${Y}/source?path=${encodeURIComponent(n)}&slide=${encodeURIComponent(r)}`)),
    sourceSave: (n, r, o, a) => t(e.post(`${Y}/source`, a === null ? { path: n, slide: r, text: o } : { path: n, slide: r, text: o, mtime: a })),
    slidesReorder: (n, r) => t(e.post(`${Y}/slides/reorder`, { path: n, order: r })),
    slidesAdd: (n, r, o = !1, a) => t(e.post(`${Y}/slides/add`, a ? { path: n, after: r, duplicate: o, layout: a } : { path: n, after: r, duplicate: o })),
    tweakInfo: (n) => t(e.get(`${Y}/design/tweak?path=${encodeURIComponent(n)}`)),
    tweakPreview: (n, r) => t(e.post(`${Y}/design/tweak/preview`, { path: n, changes: r })),
    tweakApply: (n, r) => t(e.post(`${Y}/design/tweak`, { path: n, changes: r })),
    deckNew: (n) => t(e.post(`${Y}/decks/new`, n)),
    layouts: () => t(e.get(`${Y}/layouts`)),
    layoutSave: (n, r, o) => t(e.post(`${Y}/layouts`, { path: n, slide: r, name: o })),
    layoutDelete: (n) => t(e.post(`${Y}/layouts/delete`, { id: n })),
    slidesArchive: (n, r) => t(e.post(`${Y}/slides/archive`, { path: n, slide: r })),
    slidesRestore: (n, r, o) => t(e.post(`${Y}/slides/restore`, { path: n, name: r, after: o })),
    slidesArchiveList: (n) => t(e.get(`${Y}/slides/archive?path=${encodeURIComponent(n)}`)),
    noteSave: (n, r, o) => t(e.post(`${Y}/note`, { path: n, slide: r, text: o })),
    checkStart: (n) => t(e.post(`${Y}/check`, { path: n })),
    checkStatus: (n) => t(e.get(`${Y}/check?id=${encodeURIComponent(n)}`)),
    pinsSend: (n, r, o) => t(e.post(`${Y}/pins/send`, { path: n, pins: r, language: o })),
    pinsQueue: (n) => t(e.get(`${Y}/pins/queue?path=${encodeURIComponent(n)}`)),
    pinsReply: (n, r, o, a) => t(e.post(`${Y}/pins/reply`, { path: n, id: r, cid: o, text: a })),
    pinsDismiss: (n, r) => t(e.post(`${Y}/pins/dismiss`, { path: n, id: r })),
    design: (n) => t(e.get(`${Y}/design?path=${encodeURIComponent(n)}`)),
    writeTokens: (n) => t(e.post(`${Y}/design/tokens`, { path: n }))
  };
}
function M({ active: e, danger: t, disabled: n, style: r, className: o = "", ...a }) {
  const l = t ? "var(--danger)" : e ? "var(--accent)" : "var(--muted)";
  return /* @__PURE__ */ s(
    "button",
    {
      type: "button",
      disabled: n,
      className: `px-2 py-0.5 rounded-md border text-[12px] transition-all ${n ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:text-text"} ${o}`,
      style: {
        borderColor: e ? "var(--accent)" : "var(--border)",
        color: l,
        fontWeight: e ? 600 : 400,
        background: "transparent",
        ...r
      },
      ...a
    }
  );
}
function Kt({ t: e, result: t, pendingCommand: n, onTrust: r, onCancelTrust: o, onOpenIssue: a, onDismiss: l }) {
  const [h, c] = x(!1);
  if (n)
    return /* @__PURE__ */ i("div", { className: "rounded-md border p-3 text-[13px] flex flex-col gap-2", style: { borderColor: "var(--warn)" }, role: "dialog", "aria-label": e("build.trust.title"), children: [
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
      /* @__PURE__ */ i("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ s(M, { active: !0, onClick: r, children: e("build.trust.accept") }),
        /* @__PURE__ */ s(M, { onClick: o, children: e("build.trust.cancel") })
      ] })
    ] });
  if (!t || t.needsTrust) return null;
  const u = t.ok ? "var(--ok)" : "var(--danger)", v = ((t.durationMs ?? 0) / 1e3).toFixed(1), p = t.issues ?? [], f = [t.stdout, t.stderr].filter(Boolean).join(`
`).trim();
  return /* @__PURE__ */ i("div", { className: "rounded-md border p-3 text-[13px] flex flex-col gap-2", style: { borderColor: u }, role: "status", children: [
    /* @__PURE__ */ i("div", { className: "flex items-center gap-2 flex-wrap", children: [
      /* @__PURE__ */ s("span", { className: "font-semibold", style: { color: u }, children: t.ok ? e("build.ok", { s: v }) : e("build.failed", { s: v }) }),
      /* @__PURE__ */ i("span", { className: "text-muted", children: [
        "· ",
        t.mode === "builtin" ? e("build.mode.builtin") : e("build.mode.external"),
        t.output ? ` · ${t.output}` : ""
      ] }),
      /* @__PURE__ */ i("span", { className: "ml-auto flex gap-1", children: [
        f && !t.ok && /* @__PURE__ */ s(M, { onClick: () => c((g) => !g), active: h, children: e("build.log") }),
        /* @__PURE__ */ s(M, { onClick: l, "aria-label": e("build.dismiss"), children: "✕" })
      ] })
    ] }),
    p.length > 0 && /* @__PURE__ */ s("ul", { className: "m-0 p-0 list-none flex flex-col gap-1", children: p.map((g, I) => /* @__PURE__ */ s("li", { children: /* @__PURE__ */ i(
      "button",
      {
        type: "button",
        onClick: () => a(g.file),
        className: "w-full text-left px-2 py-1 rounded-md cursor-pointer bg-transparent border-0 hover:bg-bg-hover",
        title: e("build.issue.open"),
        children: [
          /* @__PURE__ */ s("span", { className: "font-mono text-[12px]", style: { color: "var(--accent)" }, children: g.file }),
          /* @__PURE__ */ i("span", { className: "text-muted", children: [
            ": ",
            g.message
          ] })
        ]
      }
    ) }, I)) }),
    !t.ok && p.length === 0 && t.stderr && /* @__PURE__ */ s("p", { className: "m-0 text-muted whitespace-pre-wrap break-all", children: t.stderr.split(`
`).slice(-5).join(`
`) }),
    h && f && /* @__PURE__ */ s(
      "pre",
      {
        className: "m-0 p-2 rounded-md text-[11px] overflow-auto whitespace-pre-wrap break-all",
        style: { background: "var(--bg)", border: "1px solid var(--border)", maxHeight: 220 },
        children: f
      }
    )
  ] });
}
const De = { error: "var(--danger)", warning: "var(--warn)", info: "var(--muted)" };
function Te(e) {
  return `${e.rule}|${e.slideIndex}|${e.selector}|${e.otherSelector ?? ""}`;
}
const ve = 50;
function Gt({ t: e, result: t, pinned: n, draftCount: r, pinAllLeft: o, onJump: a, onFix: l, onFixAll: h, onRerun: c, onClose: u }) {
  const v = t.issues, p = t.unmeasured ?? [], f = /* @__PURE__ */ new Map();
  for (const R of v) f.set(R.slideIndex, [...f.get(R.slideIndex) ?? [], R]);
  const g = v.filter((R) => !n.has(Te(R))), I = Math.max(0, ve - r), d = Math.min(g.length, I);
  return /* @__PURE__ */ i("div", { className: "mb-2 rounded-md border border-border p-2 text-[12px]", "data-testid": "check-panel", role: "region", "aria-label": e("toolbar.check"), style: { flex: "0 1 auto", minHeight: 72, maxHeight: "45%", overflowY: "auto" }, children: [
    p.length > 0 && /* @__PURE__ */ i("div", { className: "mb-1 rounded-sm px-2 py-1 flex flex-wrap items-center gap-2", role: "status", "data-testid": "check-partial-notice", style: { border: "1px solid var(--warn)", color: "var(--text)", background: "var(--bg)" }, children: [
      /* @__PURE__ */ s("span", { className: "flex-1 min-w-0", children: e("check.partial", { n: p.length, total: t.slides }) }),
      /* @__PURE__ */ s(M, { onClick: c, "data-testid": "check-rerun", children: e("check.retry") })
    ] }),
    /* @__PURE__ */ i("div", { className: "flex items-center gap-2 flex-wrap mb-1", children: [
      /* @__PURE__ */ s("span", { className: "font-medium text-text", children: v.length ? e("check.title", { n: v.length }) : e("check.clean", { n: t.slides }) }),
      Object.entries(t.counts).map(([R, y]) => /* @__PURE__ */ i("span", { className: "rounded-sm px-1", style: { border: `1px solid ${De[t.rules[R] ?? "info"]}`, color: De[t.rules[R] ?? "info"] }, "data-testid": "check-count", "data-rule": R, children: [
        e(`check.rule.${R}`),
        " ",
        y
      ] }, R)),
      t.disabled.length > 0 && /* @__PURE__ */ s("span", { className: "text-muted", children: e("check.disabled", { rules: t.disabled.join(", ") }) }),
      /* @__PURE__ */ i("span", { className: "ml-auto inline-flex gap-1", children: [
        g.length > 0 && /* @__PURE__ */ i(M, { onClick: () => h(r), disabled: d === 0, title: d < g.length ? e("check.fix_all_limit", { max: ve }) : void 0, "data-testid": "check-fix-all", children: [
          e("check.fix_all"),
          " (",
          d < g.length ? `${d}/${g.length}` : g.length,
          ")"
        ] }),
        /* @__PURE__ */ s(M, { onClick: u, children: e("check.close") })
      ] })
    ] }),
    (o > 0 || g.length > 0 && d < g.length) && /* @__PURE__ */ s("div", { className: "mb-1 rounded-sm px-2 py-1", role: "status", "data-testid": "check-batch-notice", style: { border: "1px solid var(--warn)", color: "var(--text)", background: "var(--bg)" }, children: o > 0 ? e("check.fix_all_left", { n: o, max: ve }) : e("check.fix_all_limit", { max: ve }) }),
    v.length > 0 && /* @__PURE__ */ s("ul", { className: "flex flex-col gap-0.5", children: [...f.entries()].map(([R, y]) => /* @__PURE__ */ i("li", { children: [
      /* @__PURE__ */ i("button", { type: "button", className: "text-muted font-medium hover:text-text bg-transparent border-0 cursor-pointer px-0", onClick: () => a(R), children: [
        R + 1,
        ". ",
        y[0].slideFile
      ] }),
      /* @__PURE__ */ s("ul", { className: "ml-3 flex flex-col gap-0.5", children: y.map((k) => {
        const w = Te(k), _ = n.has(w);
        return /* @__PURE__ */ i("li", { className: "flex items-start gap-2", "data-testid": "check-issue", "data-rule": k.rule, "data-severity": k.severity, "data-pinned": _ ? "true" : "false", children: [
          /* @__PURE__ */ s("span", { className: "flex-none rounded-sm px-1", style: { color: De[k.severity], border: `1px solid ${De[k.severity]}` }, children: e(`check.rule.${k.rule}`) }),
          /* @__PURE__ */ i("span", { className: "flex-1 min-w-0 text-muted", children: [
            /* @__PURE__ */ i("span", { className: "text-text", children: [
              k.tag,
              k.classes.length ? "." + k.classes.slice(0, 2).join(".") : ""
            ] }),
            k.text ? ` "${k.text.length > 60 ? k.text.slice(0, 57) + "..." : k.text}"` : "",
            k.detail ? ` · ${k.detail}` : ""
          ] }),
          /* @__PURE__ */ s(M, { onClick: () => l(k), disabled: _, title: e("check.fix"), children: _ ? "✓" : e("check.fix") })
        ] }, w);
      }) })
    ] }, R)) })
  ] });
}
const Vt = "html-studio-";
async function dt(e) {
  const t = new TextEncoder().encode(e), n = await crypto.subtle.digest("SHA-256", t), r = Array.from(new Uint8Array(n), (o) => o.toString(16).padStart(2, "0")).join("");
  return Vt + r.slice(0, 12);
}
function Yt({ deck: e, preview: t, build: n, language: r }) {
  const o = (t == null ? void 0 : t.slides.length) ?? e.slideCount, a = e.kind === "single" ? `single file: ${o} <section class="slide"> blocks in ${e.entry ?? "index.html"}` : `slides folder: ${o} slides in ${e.slidesDir}/ (one <section class="slide"> fragment per file, ordered by filename)`, l = t != null && t.css ? `Stylesheet: ${t.css}` : "Stylesheet: none (the studio applies its default theme)";
  let h = "Build: not applicable";
  n != null && n.command ? h = `Build: run \`${n.command}\`, which writes ${n.output}` : n != null && n.builtin && n.buildable && (h = `Build: HTML Studio's built-in assembler writes ${n.output}`);
  const c = r.startsWith("ko") ? "Korean" : "English";
  return [
    "You are attached to an HTML slide deck managed by HTML Studio.",
    `Deck: ${e.name}`,
    `Path: ${e.path} (this session's project directory)`,
    `Layout: ${a}`,
    l,
    h,
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
async function Qt(e, t) {
  const n = await dt(t), r = await e.get("/api/chat/slots");
  return (Array.isArray(r) ? r : []).find((a) => a.key === n) ?? null;
}
async function ut(e, t, n) {
  const r = await dt(t.deck.path), o = await e.post("/api/chat/slots", { name: r, agent: "", title: n }), a = (o == null ? void 0 : o.key) || r;
  await e.post(`/api/chat/slots/${encodeURIComponent(a)}/project`, { project: t.deck.path });
  const l = !(o != null && o.messages);
  return l && await e.post("/api/chat?ws=1", { message: Yt(t), slot: a, agent: "" }), { key: a, created: l };
}
function ae({ size: e = 12 }) {
  return /* @__PURE__ */ i(we, { children: [
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
function Jt({ t: e, locale: t, deck: n, preview: r, build: o, open: a, onToggle: l, refreshKey: h = 0, toolbar: c }) {
  const u = Ue(), v = jt(), [p, f] = x("idle"), [g, I] = x(null), [d, R] = x(null);
  V(() => {
    let k = !1;
    if (I(null), R(null), !n) {
      f("idle");
      return;
    }
    return f("checking"), Qt(u, n.path).then((w) => {
      k || (w ? (I(w.key), f("ready")) : f("none"));
    }).catch((w) => {
      k || (R(w instanceof Error ? w.message : String(w)), f("error"));
    }), () => {
      k = !0;
    };
  }, [u, n, h]);
  const y = K(async () => {
    if (n) {
      f("checking"), R(null);
      try {
        const { key: k } = await ut(u, { deck: n, preview: r, build: o, language: t }, e("chat.title", { name: n.name }));
        I(k), f("ready");
      } catch (k) {
        R(k instanceof Error ? k.message : String(k)), f("error");
      }
    }
  }, [u, n, r, o, t, e]);
  return /* @__PURE__ */ i("div", { className: "hs-fill min-h-0 flex flex-col", "data-testid": "deck-chat", "data-status": p, children: [
    /* @__PURE__ */ i("div", { className: "flex items-center gap-2 flex-none", children: [
      /* @__PURE__ */ i(
        "button",
        {
          type: "button",
          onClick: l,
          "aria-expanded": a,
          "aria-controls": "deck-chat-body",
          title: e("chat.tagline"),
          className: "flex-1 min-w-0 flex items-center gap-2 py-1 px-1 -mx-1 rounded-md text-[15px] font-semibold text-text-strong hover:bg-bg-hover cursor-pointer bg-transparent border-0 text-left",
          children: [
            /* @__PURE__ */ s(
              "span",
              {
                "aria-hidden": !0,
                className: "inline-flex items-center justify-center w-5 h-5 text-[14px] text-muted transition-transform",
                style: { transform: a ? "rotate(90deg)" : "none" },
                children: "▸"
              }
            ),
            e("panel.chat")
          ]
        }
      ),
      /* @__PURE__ */ i("div", { className: "flex gap-1 items-center flex-none", children: [
        p === "checking" && /* @__PURE__ */ s(ae, {}),
        g && /* @__PURE__ */ i(M, { onClick: () => v(`/chat?sid=${encodeURIComponent(g)}`), title: e("chat.open_full_hint"), children: [
          e("chat.open_full"),
          " ↗"
        ] })
      ] })
    ] }),
    a && /* @__PURE__ */ i("div", { id: "deck-chat-body", className: "hs-fill min-h-0 flex flex-col mt-1", children: [
      n && c,
      !n && /* @__PURE__ */ s("p", { className: "text-sm text-muted", children: e("panel.chat.empty") }),
      n && p === "none" && /* @__PURE__ */ i("div", { className: "flex flex-col items-start gap-2", children: [
        /* @__PURE__ */ s("p", { className: "text-sm text-muted", children: e("chat.none", { name: n.name }) }),
        /* @__PURE__ */ s(M, { onClick: () => void y(), children: e("chat.start") })
      ] }),
      n && p === "error" && /* @__PURE__ */ i("div", { className: "text-[12px]", style: { color: "var(--danger)" }, role: "alert", children: [
        e("chat.failed"),
        /* @__PURE__ */ s("span", { className: "block text-muted break-all", children: d }),
        /* @__PURE__ */ s(M, { onClick: () => void y(), className: "mt-1", children: e("chat.retry") })
      ] }),
      n && p === "ready" && g && /* @__PURE__ */ s("div", { className: "hs-fill min-h-0 flex flex-col", "data-testid": "deck-chat-embed", "data-slot": g, children: /* @__PURE__ */ s(Bt, { slotKey: g, frameless: !0, startAtBottom: !0, placeholder: e("chat.placeholder", { name: n.name }) }) })
    ] })
  ] });
}
function Xt({ t: e, client: t, deckPath: n, slide: r, slideNumber: o, open: a, onToggle: l, onChanged: h, refreshKey: c = 0 }) {
  const [u, v] = x(""), [p, f] = x(""), [g, I] = x(!1), [d, R] = x("idle"), [y, k] = x(null), [w, _] = x([]), N = Z(null), A = Z({ deckPath: n, slide: r, text: "" });
  V(() => {
    if (N.current) {
      clearTimeout(N.current), N.current = null;
      const m = A.current;
      m.deckPath && m.slide && t.noteSave(m.deckPath, m.slide, m.text).catch(() => {
      });
    }
    let S = !0;
    return I(!0), R("idle"), k(null), Promise.all([t.noteGet(n, r), t.notesIndex(n)]).then(([m, D]) => {
      S && (v(m.text), f(m.file), A.current = { deckPath: n, slide: r, text: m.text }, _(D.orphans), h(D));
    }).catch((m) => S && k(m instanceof ee ? m.code : "request_failed")).finally(() => S && I(!1)), () => {
      S = !1;
    };
  }, [t, n, r, c]);
  const W = async (S) => {
    R("saving");
    try {
      await t.noteSave(n, r, S);
      const m = await t.notesIndex(n);
      _(m.orphans), h(m), R("saved");
    } catch (m) {
      R("error"), k(m instanceof ee ? m.code : "request_failed");
    }
  }, j = (S) => {
    v(S), A.current = { deckPath: n, slide: r, text: S }, R("dirty"), N.current && clearTimeout(N.current), N.current = setTimeout(() => {
      N.current = null, W(S);
    }, 800);
  }, b = () => {
    N.current && (clearTimeout(N.current), N.current = null, W(A.current.text));
  };
  V(() => () => b(), []);
  const P = d === "saving" ? e("notes.saving") : d === "saved" ? e("notes.saved") : d === "dirty" ? e("notes.unsaved") : d === "error" ? e("notes.save_failed") : "";
  return /* @__PURE__ */ i("div", { className: "hs-fill min-h-0 flex flex-col", "data-testid": "notes-panel", "data-save": d, children: [
    /* @__PURE__ */ i("div", { className: "flex items-center gap-2 flex-none", children: [
      /* @__PURE__ */ i(
        "button",
        {
          type: "button",
          onClick: l,
          "aria-expanded": a,
          "aria-controls": "notes-body",
          title: e("notes.tagline"),
          className: "flex-1 min-w-0 flex items-center gap-2 py-1 px-1 -mx-1 rounded-md text-[15px] font-semibold text-text-strong hover:bg-bg-hover cursor-pointer bg-transparent border-0 text-left",
          children: [
            /* @__PURE__ */ s("span", { "aria-hidden": !0, className: "inline-flex items-center justify-center w-5 h-5 text-[14px] text-muted transition-transform", style: { transform: a ? "rotate(90deg)" : "none" }, children: "▸" }),
            e("notes.title", { n: o }),
            /* @__PURE__ */ s("span", { className: "font-normal text-[12px] text-muted truncate ml-1", title: e("notes.tagline"), children: a ? p : u.trim() ? e("notes.has") : "" })
          ]
        }
      ),
      /* @__PURE__ */ i("span", { className: "flex-none text-[12px] text-muted inline-flex items-center gap-1", role: "status", children: [
        (g || d === "saving") && /* @__PURE__ */ s(ae, {}),
        P
      ] })
    ] }),
    a && /* @__PURE__ */ i("div", { id: "notes-body", className: "hs-fill min-h-0 flex flex-col mt-1 gap-1", children: [
      /* @__PURE__ */ s(
        "textarea",
        {
          value: u,
          onChange: (S) => j(S.target.value),
          onBlur: b,
          disabled: g,
          placeholder: e("notes.placeholder"),
          "aria-label": e("notes.title", { n: o }),
          spellCheck: !1,
          className: "hs-fill min-h-0 w-full resize-none rounded-md border border-border bg-bg px-2 py-1 text-[13px] text-text font-mono",
          style: { minHeight: 96, lineHeight: 1.5 }
        }
      ),
      /* @__PURE__ */ i("div", { className: "flex items-center gap-2 text-[11px] text-muted flex-none flex-wrap", children: [
        /* @__PURE__ */ s("span", { children: e("notes.hint") }),
        y && /* @__PURE__ */ s("span", { style: { color: "var(--danger)" }, children: e(`error.${y}`) === `error.${y}` ? e("error.generic", { code: y }) : e(`error.${y}`) }),
        w.length > 0 && /* @__PURE__ */ i("span", { className: "ml-auto", title: w.join(", "), "data-testid": "notes-orphans", children: [
          e("notes.orphans", { n: w.length }),
          /* @__PURE__ */ s(M, { className: "ml-1", onClick: () => void t.reveal(n, `notes/${w[0]}`).catch(() => {
          }), children: e("notes.show") })
        ] })
      ] })
    ] })
  ] });
}
const Zt = /^<\/?[A-Za-z][\w:-]*/, en = /^[^\s"'<>\/=]+/, tn = /^\s+/;
function nn(e) {
  const t = [];
  let n = 0;
  const r = (a, l) => {
    if (!l) return;
    const h = t[t.length - 1];
    h && h[0] === a ? h[1] += l : t.push([a, l]);
  };
  let o = !1;
  for (; n < e.length; ) {
    const a = e.slice(n);
    if (a.startsWith("<!--")) {
      const u = a.indexOf("-->"), v = u < 0 ? a.length : u + 3;
      r("comment", a.slice(0, v)), n += v;
      continue;
    }
    if (o && !/^<\/style/i.test(a)) {
      const u = a.search(/<\/style/i), v = u < 0 ? a : a.slice(0, u);
      sn(v, r), n += v.length;
      continue;
    }
    const l = Zt.exec(a);
    if (l) {
      r("tag", l[0]), n += l[0].length;
      const u = l[0].replace(/^<\/?/, "").toLowerCase(), v = l[0].startsWith("</");
      for (; n < e.length; ) {
        const p = e.slice(n), f = tn.exec(p);
        if (f) {
          r("text", f[0]), n += f[0].length;
          continue;
        }
        if (p.startsWith("/>") || p.startsWith(">")) {
          const I = p.startsWith("/>") ? 2 : 1;
          r("tag", p.slice(0, I)), n += I;
          break;
        }
        if (p[0] === "=") {
          r("punct", "="), n += 1;
          continue;
        }
        if (p[0] === '"' || p[0] === "'") {
          const I = p[0], d = p.indexOf(I, 1), R = d < 0 ? p.length : d + 1;
          r("value", p.slice(0, R)), n += R;
          continue;
        }
        const g = en.exec(p);
        if (g) {
          r("attr", g[0]), n += g[0].length;
          continue;
        }
        r("text", p[0]), n += 1;
      }
      u === "style" && (o = !v);
      continue;
    }
    if (a[0] === "&") {
      const u = /^&[#\w]+;/.exec(a);
      if (u) {
        r("entity", u[0]), n += u[0].length;
        continue;
      }
    }
    const h = a.slice(1).search(/[<&]/), c = h < 0 ? a.length : h + 1;
    r("text", a.slice(0, c)), n += c;
  }
  return t;
}
function sn(e, t) {
  let n = 0, r = 0;
  for (; n < e.length; ) {
    const o = e.slice(n);
    if (o.startsWith("/*")) {
      const h = o.indexOf("*/"), c = h < 0 ? o.length : h + 2;
      t("comment", o.slice(0, c)), n += c;
      continue;
    }
    if (o[0] === "{") {
      r++, t("punct", "{"), n++;
      continue;
    }
    if (o[0] === "}") {
      r = Math.max(0, r - 1), t("punct", "}"), n++;
      continue;
    }
    if (r) {
      const h = /^(\s*)([-\w]+)(\s*:\s*)([^;}]*)(;?)/.exec(o);
      if (h) {
        t("text", h[1]), t("css-prop", h[2]), t("punct", h[3]), t("css-value", h[4]), t("punct", h[5]), n += h[0].length;
        continue;
      }
    }
    const a = o.slice(1).search(/[{}]|\/\*/), l = a < 0 ? o.length : a + 1;
    t("text", o.slice(0, l)), n += l;
  }
}
function Xe(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const rn = {
  comment: "var(--muted)",
  tag: "var(--accent)",
  attr: "var(--warn)",
  value: "var(--ok)",
  entity: "var(--danger)",
  "css-prop": "var(--accent)",
  "css-value": "var(--ok)",
  punct: "var(--muted)"
}, Be = "12.5px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
function on({ t: e, client: t, deckPath: n, slide: r, slideNumber: o, drafts: a, refreshKey: l = 0, onSaved: h }) {
  const [c, u] = x(null), [v, p] = x(""), [f, g] = x("loading"), [I, d] = x(null), [R, y] = x(!1), k = Z(null), w = Z(null), _ = Z(v);
  _.current = v;
  const N = Z(f);
  N.current = f;
  const A = K(
    async (C, B = !1) => {
      B || g("loading"), d(null), y(!1);
      try {
        const T = await t.sourceGet(n, r);
        u(T);
        const L = C ? a.get(r) : void 0;
        L && L.text !== T.text ? (p(L.text), g("dirty")) : (a.delete(r), p(T.text), (!B || T.text !== _.current || N.current === "loading") && g("clean"));
      } catch (T) {
        d(T instanceof ee ? T.code : "request_failed"), g("error");
      }
    },
    [t, n, r, a]
  );
  V(() => {
    A(!0);
  }, [A]);
  const W = Z(!0);
  V(() => {
    if (W.current) {
      W.current = !1;
      return;
    }
    A(!0, !0);
  }, [l]);
  const j = f === "dirty" || f === "saving" && a.has(r), b = (C) => {
    p(C), c && (C === c.text ? (a.delete(r), g("clean")) : (a.set(r, { text: C, mtime: c.mtime }), g("dirty")));
  }, P = K(
    async (C = !1) => {
      if (!c) return;
      const B = _.current;
      g("saving"), d(null);
      try {
        const T = await t.sourceSave(n, r, B, C ? null : c.mtime);
        a.delete(r), u({ ...c, text: B, mtime: T.mtime }), y(!1), g("saved"), h(T);
      } catch (T) {
        const L = T instanceof ee ? T.code : "request_failed";
        if (L === "conflict") {
          y(!0), g("dirty");
          return;
        }
        d(L), g("error");
      }
    },
    [t, n, r, c, a, h]
  ), S = (C) => {
    if (C.key === "Tab" && !C.metaKey && !C.ctrlKey && !C.altKey) {
      C.preventDefault();
      const B = C.currentTarget, { selectionStart: T, selectionEnd: L, value: O } = B;
      if (C.shiftKey) {
        const z = O.lastIndexOf(`
`, T - 1) + 1, X = O.slice(z, z + 2) === "  " ? 2 : O[z] === " " ? 1 : 0;
        if (!X) return;
        const J = O.slice(0, z) + O.slice(z + X);
        b(J), requestAnimationFrame(() => B.setSelectionRange(Math.max(z, T - X), Math.max(z, L - X)));
      } else {
        const z = O.slice(0, T) + "  " + O.slice(L);
        b(z), requestAnimationFrame(() => B.setSelectionRange(T + 2, T + 2));
      }
    }
  }, m = be(() => {
    const C = nn(v).map(([B, T]) => B === "text" ? Xe(T) : `<span style="color:${rn[B]}${B === "comment" ? ";font-style:italic" : ""}">${Xe(T)}</span>`).join("");
    return v.endsWith(`
`) || v === "" ? C + " " : C;
  }, [v]), D = be(() => v.split(`
`).length, [v]);
  Ut(() => {
    const C = k.current, B = w.current;
    !C || !B || (C.style.width = `${B.offsetWidth}px`, C.style.height = `${B.offsetHeight}px`);
  }, [m]);
  const E = f === "loading" ? e("code.loading") : f === "saving" ? e("code.saving") : f === "saved" ? e("code.saved") : f === "dirty" ? e("code.unsaved") : f === "error" ? e("code.error", { code: I ?? "" }) : "";
  return /* @__PURE__ */ i("div", { className: "flex flex-col min-h-0 flex-1", "data-testid": "code-editor", children: [
    /* @__PURE__ */ i("div", { className: "flex items-center gap-2 mb-1 flex-none text-[12px]", children: [
      /* @__PURE__ */ i("span", { className: "font-medium truncate", children: [
        e("code.title", { n: o }),
        j && /* @__PURE__ */ s("span", { "aria-label": e("code.unsaved"), children: " ●" })
      ] }),
      /* @__PURE__ */ s("span", { className: "text-muted truncate", children: (c == null ? void 0 : c.file) ?? "" }),
      /* @__PURE__ */ s("span", { className: "flex-1" }),
      /* @__PURE__ */ i("span", { className: "text-muted", role: "status", "aria-live": "polite", children: [
        f === "saving" && /* @__PURE__ */ s(ae, {}),
        " ",
        E
      ] }),
      /* @__PURE__ */ s(M, { onClick: () => void A(!1), disabled: f === "loading" || f === "saving", title: e("code.reload_hint"), children: e("code.reload") }),
      /* @__PURE__ */ s(M, { onClick: () => void P(), active: f === "dirty", disabled: f !== "dirty", title: e("code.save_hint"), children: e("code.save") })
    ] }),
    R && /* @__PURE__ */ i("div", { className: "flex items-center gap-2 mb-1 flex-none text-[12px] rounded-md border px-2 py-1", role: "alert", style: { borderColor: "var(--warn)", color: "var(--warn)" }, children: [
      /* @__PURE__ */ s("span", { className: "flex-1", children: e("code.conflict") }),
      /* @__PURE__ */ s(M, { onClick: () => void A(!1), children: e("code.conflict_reload") }),
      /* @__PURE__ */ s(M, { danger: !0, onClick: () => void P(!0), children: e("code.conflict_overwrite") })
    ] }),
    /* @__PURE__ */ s("div", { className: "flex-1 min-h-0 rounded-md border border-border overflow-auto", style: { background: "var(--bg)" }, children: /* @__PURE__ */ i("div", { className: "flex items-start", style: { minHeight: "100%" }, children: [
      /* @__PURE__ */ s("div", { "aria-hidden": !0, className: "select-none text-right flex-none px-2 py-2", style: { font: Be, color: "var(--muted)", borderRight: "1px solid var(--border)", background: "var(--bg-hover)" }, children: Array.from({ length: D }, (C, B) => /* @__PURE__ */ s("div", { children: B + 1 }, B)) }),
      /* @__PURE__ */ i("div", { className: "relative flex-1", style: { minWidth: 0 }, children: [
        /* @__PURE__ */ s(
          "pre",
          {
            ref: w,
            "aria-hidden": !0,
            className: "m-0 px-3 py-2 inline-block",
            style: { font: Be, whiteSpace: "pre", minWidth: "100%", color: "var(--text)", tabSize: 2 },
            dangerouslySetInnerHTML: { __html: m }
          }
        ),
        /* @__PURE__ */ s(
          "textarea",
          {
            ref: k,
            value: v,
            onChange: (C) => b(C.target.value),
            onKeyDown: S,
            spellCheck: !1,
            autoCapitalize: "off",
            autoCorrect: "off",
            wrap: "off",
            disabled: f === "loading",
            "aria-label": e("code.title", { n: o }),
            className: "absolute left-0 top-0 m-0 px-3 py-2 border-0 outline-none resize-none overflow-hidden bg-transparent",
            style: { font: Be, whiteSpace: "pre", color: "transparent", caretColor: "var(--text)", tabSize: 2, minWidth: "100%" }
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ s("div", { className: "text-[11px] text-muted mt-1 flex-none", children: e("code.hint") })
  ] });
}
function Ze(e) {
  return e.replace(/^\/Users\/[^/]+|^\/home\/[^/]+/, "~");
}
function an(e, t) {
  try {
    return new Intl.DateTimeFormat(t, { dateStyle: "medium", timeStyle: "short" }).format(e * 1e3);
  } catch {
    return new Date(e * 1e3).toLocaleString();
  }
}
function ln(e) {
  const { t } = e, [n, r] = x(!1), [o, a] = x(!1), [l, h] = x(""), [c, u] = x(!1), v = async () => {
    if (l.trim()) {
      u(!0);
      try {
        await e.onAddRoot(l.trim()), h(""), a(!1);
      } finally {
        u(!1);
      }
    }
  }, p = async () => {
    u(!0);
    try {
      await e.onAddRoot();
    } finally {
      u(!1);
    }
  }, f = (d) => e.pickerSupported ? /* @__PURE__ */ i(M, { onClick: p, disabled: c || !e.connected, active: d, className: "inline-flex items-center gap-1.5", "data-testid": "folder-register", children: [
    c && /* @__PURE__ */ s(ae, {}),
    t(c ? "roots.picking" : "roots.add")
  ] }) : /* @__PURE__ */ s(M, { onClick: () => a((R) => !R), active: d || o, disabled: c || !e.connected, "data-testid": "folder-register", children: t("roots.add") }), g = o && /* @__PURE__ */ i(
    "form",
    {
      className: "flex gap-1",
      onSubmit: (d) => {
        d.preventDefault(), v();
      },
      children: [
        /* @__PURE__ */ s(
          "input",
          {
            autoFocus: !0,
            value: l,
            onChange: (d) => h(d.target.value),
            placeholder: t("roots.path_placeholder"),
            "aria-label": t("roots.add"),
            className: "flex-1 min-w-0 px-2 py-1 rounded-md border text-[12px]",
            style: { borderColor: "var(--border)", background: "var(--bg)", color: "var(--text)" }
          }
        ),
        /* @__PURE__ */ s(M, { active: !0, type: "submit", disabled: c || !l.trim(), children: t("roots.confirm") })
      ]
    }
  ), I = e.roots.length > 0;
  return /* @__PURE__ */ i("div", { className: "flex flex-col gap-2 text-[13px]", children: [
    I && /* @__PURE__ */ i("div", { className: "flex flex-col gap-1", "data-testid": "folders", children: [
      /* @__PURE__ */ i("div", { className: "flex items-center gap-2 text-[12px] text-muted", children: [
        /* @__PURE__ */ i("span", { className: "truncate flex-1", title: e.roots.join(`
`), children: [
          t("roots.summary", { first: Ze(e.roots[0]), more: e.roots.length - 1 }),
          e.roots.length > 1 ? ` (+${e.roots.length - 1})` : ""
        ] }),
        /* @__PURE__ */ s(M, { onClick: () => r((d) => !d), active: n, "aria-expanded": n, "aria-controls": "folders-body", style: { padding: "0 6px" }, children: t("roots.manage") })
      ] }),
      n && /* @__PURE__ */ i("div", { id: "folders-body", className: "flex flex-col gap-1 rounded-md border border-border p-2", children: [
        /* @__PURE__ */ s("ul", { className: "flex flex-col gap-1 m-0 p-0 list-none", children: e.roots.map((d) => /* @__PURE__ */ i("li", { className: "flex items-center gap-2 text-[12px] text-muted", title: d, children: [
          /* @__PURE__ */ s("span", { className: "truncate flex-1", children: Ze(d) }),
          /* @__PURE__ */ s(M, { danger: !0, onClick: () => e.onRemoveRoot(d), "aria-label": `${t("roots.remove")} ${d}`, style: { padding: "0 6px" }, children: t("roots.remove") })
        ] }, d)) }),
        /* @__PURE__ */ i("div", { className: "flex flex-wrap items-center gap-1", children: [
          f(!1),
          /* @__PURE__ */ i(M, { onClick: () => e.onRefresh(), disabled: c || e.loading || !e.connected, className: "inline-flex items-center gap-1.5", title: t("roots.rescan_hint"), children: [
            e.loading && !c && /* @__PURE__ */ s(ae, {}),
            t("roots.rescan")
          ] })
        ] }),
        g,
        /* @__PURE__ */ s("p", { className: "m-0 text-[11px] text-muted", children: t("roots.hint") })
      ] })
    ] }),
    I && e.onNew && /* @__PURE__ */ s(M, { onClick: e.onNew, disabled: c || !e.connected, active: !0, "data-testid": "deck-new", className: "self-start", children: t("newdeck.button") }),
    e.error && /* @__PURE__ */ i("p", { className: "m-0 text-[12px]", style: { color: "var(--danger)" }, role: "alert", children: [
      t(`error.${e.error}`) === `error.${e.error}` ? t("error.generic", { code: e.error }) : t(`error.${e.error}`),
      e.errorDetail && t(`error.${e.error}`) === `error.${e.error}` ? /* @__PURE__ */ s("span", { className: "block text-muted break-all", children: e.errorDetail }) : null
    ] }),
    e.connected ? I ? e.loading && e.decks.length === 0 ? /* @__PURE__ */ s("p", { className: "m-0 text-muted", children: t("decks.loading") }) : e.decks.length === 0 ? /* @__PURE__ */ s("p", { className: "m-0 text-muted", children: t("decks.none_found") }) : /* @__PURE__ */ s("ul", { className: "flex flex-col gap-1 m-0 p-0 list-none", role: "listbox", "aria-label": t("panel.decks"), children: e.decks.map((d) => {
      const R = d.id === e.selectedId;
      return /* @__PURE__ */ s("li", { children: /* @__PURE__ */ i(
        "button",
        {
          type: "button",
          role: "option",
          "aria-selected": R,
          onClick: () => e.onSelect(d),
          title: d.path,
          className: "w-full text-left px-2 py-1.5 rounded-md border cursor-pointer transition-all",
          style: {
            borderColor: R ? "var(--accent)" : "var(--border)",
            background: R ? "var(--bg-hover)" : "transparent",
            color: "var(--text)"
          },
          children: [
            /* @__PURE__ */ i("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ s("span", { className: "font-medium truncate flex-1", children: d.name }),
              /* @__PURE__ */ s("span", { className: "text-[11px] text-muted whitespace-nowrap", children: t("decks.slide_count", { n: d.slideCount }) })
            ] }),
            /* @__PURE__ */ i("div", { className: "text-[11px] text-muted truncate", children: [
              an(d.modifiedAt, e.locale),
              d.kind === "single" ? ` · ${t("decks.kind.single")}` : "",
              d.hasDesignMd ? " · DESIGN.md" : "",
              d.hasStudioJson ? " · studio.json" : ""
            ] })
          ]
        }
      ) }, d.id);
    }) }) : /* @__PURE__ */ i("div", { className: "flex flex-col gap-2 rounded-md border p-3", style: { borderStyle: "dashed" }, "data-testid": "folders-empty", children: [
      /* @__PURE__ */ s("p", { className: "m-0 text-muted", children: t("panel.decks.empty") }),
      /* @__PURE__ */ s("div", { children: f(!0) }),
      g
    ] }) : /* @__PURE__ */ i("p", { className: "m-0 text-muted inline-flex items-center gap-2", children: [
      /* @__PURE__ */ s(ae, {}),
      " ",
      t("status.connecting")
    ] })
  ] });
}
function cn(e) {
  const t = e.classes.length ? "." + e.classes.slice(0, 2).join(".") : "", n = e.elementId ? `#${e.elementId}` : "";
  return `${e.tag}${n}${t}`;
}
function ht(e, t, n) {
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
const ze = "hs.pins.";
function dn(e) {
  try {
    const t = localStorage.getItem(ze + e), n = t ? JSON.parse(t) : null;
    return Array.isArray(n) ? n : [];
  } catch {
    return [];
  }
}
function un(e, t) {
  try {
    t.length ? localStorage.setItem(ze + e, JSON.stringify(t)) : localStorage.removeItem(ze + e);
  } catch {
  }
}
const He = {
  new: "var(--accent)",
  sent: "var(--warn)",
  done: "var(--ok)",
  question: "var(--danger)"
};
function hn({ t: e, pins: t, current: n, activeId: r, sending: o, sendError: a, sendLeft: l, onComment: h, onRemove: c, onJump: u, onClearAll: v, onSend: p, onReply: f, onDismissDone: g }) {
  if (t.length === 0) return null;
  const I = t.filter((w) => w.status === "new"), d = I.some((w) => !w.comment.trim()), R = t.filter((w) => w.status === "done"), y = I.length > ve, k = Math.min(I.length, ve);
  return /* @__PURE__ */ i("div", { className: "mt-2 rounded-md border border-border p-2 text-[12px]", "data-testid": "pins-panel", style: { flex: "0 1 auto", minHeight: 96, maxHeight: "45%", overflowY: "auto" }, children: [
    /* @__PURE__ */ i("div", { className: "flex items-center gap-2 mb-1 flex-wrap", children: [
      /* @__PURE__ */ s("span", { className: "font-medium text-text", children: e("pins.title", { n: t.length }) }),
      /* @__PURE__ */ s("span", { className: "text-muted", children: a ? /* @__PURE__ */ i("span", { style: { color: "var(--danger)" }, children: [
        e("pins.send_failed"),
        ": ",
        a
      ] }) : d && I.length ? e("pins.need_comment") : e("pins.hint") }),
      /* @__PURE__ */ i("span", { className: "ml-auto inline-flex gap-1", children: [
        R.length > 0 && /* @__PURE__ */ s(M, { onClick: g, children: e("pins.dismiss_done") }),
        /* @__PURE__ */ s(M, { onClick: v, children: e("pins.clear") }),
        /* @__PURE__ */ i(
          M,
          {
            active: !0,
            onClick: p,
            disabled: o || I.length === 0 || d,
            title: y ? e("pins.batch_limit", { max: ve }) : e("pins.send_hint"),
            className: "inline-flex items-center gap-1",
            "data-testid": "pins-send",
            children: [
              o && /* @__PURE__ */ s(ae, {}),
              o ? e("pins.sending") : `${e("pins.send")} (${y ? `${k}/${I.length}` : I.length})`
            ]
          }
        )
      ] })
    ] }),
    (y || l > 0) && /* @__PURE__ */ s("div", { className: "mb-1 rounded-sm px-2 py-1", role: "status", "data-testid": "pins-batch-notice", style: { border: "1px solid var(--warn)", color: "var(--text)", background: "var(--bg)" }, children: y ? e("pins.batch_limit", { max: ve }) : e("pins.batch_left", { n: l }) }),
    /* @__PURE__ */ s("ul", { className: "flex flex-col gap-1", children: t.map((w) => /* @__PURE__ */ s(mn, { t: e, pin: w, current: n, active: w.id === r, onComment: h, onRemove: c, onJump: u, onReply: f }, w.id)) })
  ] });
}
function mn({ t: e, pin: t, current: n, active: r, onComment: o, onRemove: a, onJump: l, onReply: h }) {
  const [c, u] = x(""), v = t.status !== "new";
  return /* @__PURE__ */ i(
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
            onClick: () => l(t.slideIndex, t.id),
            className: "flex-none rounded-full text-white text-[11px] font-semibold",
            style: { width: 20, height: 20, lineHeight: "20px", background: He[t.status], textAlign: "center" },
            title: e("pins.jump", { n: t.slideIndex + 1 }),
            "aria-label": e("pins.jump", { n: t.slideIndex + 1 }),
            children: t.index
          }
        ),
        /* @__PURE__ */ i("div", { className: "flex-1 min-w-0", children: [
          /* @__PURE__ */ i("div", { className: "flex items-center gap-2 text-muted truncate", children: [
            /* @__PURE__ */ s("span", { className: "text-text", children: t.slideFile }),
            /* @__PURE__ */ s("span", { className: "truncate", title: t.selector, children: cn(t) }),
            t.text && /* @__PURE__ */ i("span", { className: "truncate", children: [
              '"',
              t.text,
              '"'
            ] }),
            /* @__PURE__ */ s("span", { className: "ml-auto flex-none rounded-sm px-1", style: { color: He[t.status], border: `1px solid ${He[t.status]}` }, "data-testid": "pin-status", children: e(`pins.status.${t.status}`) }),
            t.slideIndex === n && t.how && t.how !== "cid" && t.how !== "selector" && /* @__PURE__ */ s("span", { style: { color: "var(--warn)" }, children: t.how === "lost" ? e("pins.lost") : e("pins.moved") })
          ] }),
          v ? /* @__PURE__ */ s("div", { className: "mt-1 text-text", children: t.comment }) : /* @__PURE__ */ s(
            "input",
            {
              type: "text",
              value: t.comment,
              onChange: (p) => o(t.id, p.target.value),
              placeholder: e("pins.placeholder"),
              "aria-label": e("pins.comment_for", { n: t.index }),
              autoFocus: r && !t.comment,
              className: "mt-1 w-full rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-text"
            }
          ),
          t.thread && t.thread.length > 0 && /* @__PURE__ */ s("ul", { className: "mt-1 flex flex-col gap-0.5", "data-testid": "pin-thread", children: t.thread.map((p, f) => /* @__PURE__ */ i("li", { className: p.role === "agent" ? "text-muted" : "text-text", children: [
            p.role === "agent" ? "↳ " : "↪ ",
            p.text
          ] }, f)) }),
          t.status === "question" && /* @__PURE__ */ i(
            "form",
            {
              className: "mt-1 flex gap-1",
              onSubmit: (p) => {
                p.preventDefault(), c.trim() && (h(t.id, c.trim()), u(""));
              },
              children: [
                /* @__PURE__ */ s(
                  "input",
                  {
                    type: "text",
                    value: c,
                    onChange: (p) => u(p.target.value),
                    placeholder: e("pins.reply_placeholder"),
                    "aria-label": e("pins.reply_placeholder"),
                    className: "flex-1 rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-text"
                  }
                ),
                /* @__PURE__ */ s(M, { type: "submit", disabled: !c.trim(), children: e("pins.reply") })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ s(M, { onClick: () => a(t.id), "aria-label": e("pins.remove"), title: e("pins.remove"), children: "×" })
      ]
    }
  );
}
const et = 1280, tt = 720;
function mt({ t: e, url: t, baseUrl: n, startSlide: r, slideCount: o, onClose: a, openPresenter: l, onPosition: h, mode: c = "overlay" }) {
  const u = c === "window", v = Z(null), p = Z(null), [f, g] = x(r), I = Z(f);
  I.current = f;
  const d = `${n}/present/state`, R = Z(-1), [y, k] = x(!1), w = Z(y);
  w.current = y;
  const [_, N] = x(!1), A = Z({}), W = Z(null), j = Z(null), b = K(() => {
    const F = W.current, q = j.current;
    if (!F || !q) return;
    const G = q.getBoundingClientRect(), $ = window.devicePixelRatio || 1;
    (F.width !== Math.round(G.width * $) || F.height !== Math.round(G.height * $)) && (F.width = Math.round(G.width * $), F.height = Math.round(G.height * $));
    const H = F.getContext("2d");
    if (!H) return;
    H.setTransform(1, 0, 0, 1, 0, 0), H.clearRect(0, 0, F.width, F.height);
    const ne = Math.min(G.width / et, G.height / tt);
    H.setTransform(ne * $, 0, 0, ne * $, (G.width - et * ne) / 2 * $, (G.height - tt * ne) / 2 * $), H.strokeStyle = "#ef4444", H.lineWidth = 4, H.lineCap = "round", H.lineJoin = "round";
    for (const le of A.current[String(I.current - 1)] || [])
      if (le.pts.length) {
        H.beginPath(), H.moveTo(le.pts[0][0], le.pts[0][1]), le.pts.length === 1 && H.lineTo(le.pts[0][0] + 0.1, le.pts[0][1]);
        for (let ge = 1; ge < le.pts.length; ge++) H.lineTo(le.pts[ge][0], le.pts[ge][1]);
        H.stroke();
      }
    F.dataset.strokes = String((A.current[String(I.current - 1)] || []).length);
  }, []), P = K((F) => {
    const q = A.current;
    if (F.op === "reset") {
      A.current = {};
      return;
    }
    const G = String(F.slide);
    if (F.op === "clear") {
      delete q[G];
      return;
    }
    const $ = q[G] || (q[G] = []);
    if (F.op === "start") $.push({ id: F.id, pts: F.pts.slice() });
    else {
      const H = $.find((ne) => ne.id === F.id);
      H && H.pts.push(...F.pts);
    }
  }, []), S = Z(0), m = K(
    (F) => {
      S.current += 1, fetch(d, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: "audience", ...F }) }).then((q) => q.json()).then((q) => {
        R.current = q.seq;
      }).catch(() => {
      }).finally(() => {
        S.current -= 1;
      });
    },
    [d]
  ), [D, E] = x(!1), [C, B] = x(!0), [T, L] = x(null), O = Z(null);
  O.current = T;
  const z = Z(null), X = Z(!1), J = Z(!1), Q = `${t}?hs=present`, te = K(() => {
    X.current || (X.current = !0, a(), document.fullscreenElement && document.exitFullscreen().catch(() => {
    }));
  }, [a]), fe = K(() => {
    const F = v.current;
    if (!F) return;
    const q = () => F.requestFullscreen().catch(() => {
    }), G = document.fullscreenElement;
    G !== F && (G ? document.exitFullscreen().then(q, q) : q());
  }, []), ie = K((F) => {
    var q, G;
    (G = (q = p.current) == null ? void 0 : q.contentWindow) == null || G.postMessage(F, "*");
  }, []), re = K(
    (F) => {
      const q = Math.max(1, Math.min(o || F, F));
      g(q), m({ index: q - 1 }), ie({ type: "hs-go", index: q - 1 });
      const G = p.current;
      G && (G.src = `${Q}#${q}`);
    },
    [m, ie, o, Q]
  );
  V(() => {
    b();
  }, [f, b]);
  const pe = K((F) => {
    const q = p.current;
    if (!q) return;
    const G = q.getBoundingClientRect();
    ie({ type: "hs-hit", x: F.clientX - G.left, y: F.clientY - G.top });
  }, [ie]);
  V(() => {
    let F = !0, q = !1;
    fetch(d, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: "audience", index: r - 1, black: !1, ink: { op: "reset" } }) }).then((oe) => oe.json()).then((oe) => {
      R.current = oe.seq;
    }).catch(() => {
    }).finally(() => {
      q = !0;
    }), l == null || l(r);
    const G = (oe) => {
      var xe;
      if (F && (N(oe.presenter), oe.ink ? (A.current = oe.ink, b()) : (xe = oe.ink_ops) != null && xe.length && (oe.ink_ops.forEach(P), b()), oe.seq !== R.current)) {
        if (R.current = oe.seq, typeof oe.index == "number" && oe.index + 1 !== I.current) {
          const me = oe.index + 1;
          g(me), ie({ type: "hs-go", index: oe.index });
          const Ne = p.current;
          Ne && (Ne.src = `${Q}#${me}`);
        }
        typeof oe.black == "boolean" && oe.black !== w.current && k(oe.black);
      }
    };
    let $ = null;
    try {
      $ = new EventSource(`${n}/present/events`), $.onmessage = (oe) => {
        if (!(!q || S.current > 0))
          try {
            G(JSON.parse(oe.data));
          } catch {
          }
      };
    } catch {
      $ = null;
    }
    const H = async () => {
      if (!(!q || S.current > 0))
        try {
          G(await (await fetch(d)).json());
        } catch {
        }
    };
    H();
    const ne = setInterval(H, $ ? 1e3 : 100);
    window.addEventListener("resize", b);
    let le = !1;
    const ge = () => {
      le || (le = !0, fetch(d, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: "audience", ink: { op: "reset" } }), keepalive: !0 }).catch(() => {
      }));
    };
    return u && window.addEventListener("pagehide", ge), () => {
      F = !1, clearInterval(ne), $ == null || $.close(), window.removeEventListener("resize", b), window.removeEventListener("pagehide", ge), ge(), h == null || h(I.current);
    };
  }, []), V(() => {
    var $;
    if (($ = v.current) == null || $.focus(), u) {
      const H = () => E(!!document.fullscreenElement);
      return document.addEventListener("fullscreenchange", H), () => document.removeEventListener("fullscreenchange", H);
    }
    fe();
    const F = () => {
      const H = !!document.fullscreenElement;
      E(H), H ? J.current = !0 : J.current && te();
    };
    document.addEventListener("fullscreenchange", F);
    let q = !1;
    const G = setInterval(() => {
      if (X.current) return;
      window.innerHeight >= screen.height - 40 && window.innerWidth >= screen.width - 40 ? q = !0 : q && te();
    }, 250);
    return () => {
      document.removeEventListener("fullscreenchange", F), clearInterval(G), document.fullscreenElement && document.exitFullscreen().catch(() => {
      });
    };
  }, []), V(() => {
    const F = (q) => {
      var $;
      const G = q.data;
      q.source !== (($ = p.current) == null ? void 0 : $.contentWindow) || !G || (G.type === "hs-slide" && typeof G.index == "number" ? g(G.index + 1) : G.type === "hs-exit" ? te() : G.type === "hs-zoom" && G.kind === "img" && typeof G.src == "string" ? L({ kind: "img", src: G.src, alt: G.alt ?? "" }) : G.type === "hs-zoom" && G.kind === "svg" && typeof G.svg == "string" && L({ kind: "svg", svg: G.svg }));
    };
    return window.addEventListener("message", F), () => window.removeEventListener("message", F);
  }, [te]), V(() => {
    const F = (q) => {
      if (!(q.metaKey || q.ctrlKey || q.altKey)) {
        if (q.key === "Escape")
          if (O.current) L(null);
          else if (u) {
            document.fullscreenElement && document.exitFullscreen().catch(() => {
            });
            return;
          } else te();
        else if (q.key === "ArrowRight" || q.key === "PageDown" || q.key === " " || q.key === "Enter")
          L(null), re(f + 1);
        else if (q.key === "ArrowLeft" || q.key === "PageUp" || q.key === "Backspace")
          L(null), re(f - 1);
        else if (q.key === "Home") re(1);
        else if (q.key === "End") re(o);
        else return;
        q.preventDefault(), q.stopPropagation();
      }
    };
    return window.addEventListener("keydown", F, !0), () => window.removeEventListener("keydown", F, !0);
  }, [f, re, te, o, u]);
  const ue = () => {
    B(!0), z.current && clearTimeout(z.current), z.current = setTimeout(() => B(!1), 2500);
  };
  V(() => (ue(), () => {
    z.current && clearTimeout(z.current);
  }), []);
  const he = { color: "#ddd", borderColor: "#555" };
  return /* @__PURE__ */ i(
    "div",
    {
      ref: v,
      role: "dialog",
      "aria-label": e("present.title"),
      tabIndex: -1,
      onMouseMove: ue,
      className: "fixed inset-0 flex flex-col outline-none",
      style: { zIndex: 1e3, background: "#000", cursor: C ? "default" : "none" },
      children: [
        /* @__PURE__ */ i("div", { ref: j, className: "flex-1 w-full h-full relative min-h-0", children: [
          /* @__PURE__ */ s(
            "iframe",
            {
              ref: p,
              src: `${Q}#${r}`,
              title: e("present.title"),
              sandbox: "allow-scripts allow-same-origin",
              tabIndex: -1,
              className: "absolute inset-0 w-full h-full border-0"
            }
          ),
          /* @__PURE__ */ s("canvas", { ref: W, "data-testid": "present-ink", "aria-hidden": !0, className: "absolute inset-0 w-full h-full pointer-events-none", style: { zIndex: 5 } }),
          y && /* @__PURE__ */ s("div", { "data-testid": "present-black", className: "absolute inset-0", style: { background: "#000", zIndex: 6 } })
        ] }),
        /* @__PURE__ */ s("div", { "data-testid": "present-shield", className: "absolute inset-0", onClick: pe }),
        T && /* @__PURE__ */ s(
          "div",
          {
            "data-testid": "present-zoom",
            role: "img",
            "aria-label": T.kind === "img" && T.alt || e("present.zoom"),
            className: "absolute inset-0 flex items-center justify-center",
            style: { background: "rgba(0,0,0,.92)", cursor: "zoom-out" },
            onClick: () => L(null),
            children: T.kind === "img" ? /* @__PURE__ */ s("img", { src: T.src, alt: T.alt, style: { maxWidth: "96vw", maxHeight: "96vh", objectFit: "contain" } }) : /* @__PURE__ */ s("img", { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(T.svg)}`, alt: "", style: { maxWidth: "96vw", maxHeight: "96vh", objectFit: "contain" } })
          }
        ),
        u && !D && /* @__PURE__ */ s(
          "div",
          {
            "data-testid": "present-window-hint",
            className: "absolute left-0 right-0 top-0 px-3 py-2 text-[12px] text-center",
            style: { background: "rgba(0,0,0,.6)", color: "#ddd", zIndex: 10, pointerEvents: "none" },
            children: e("present.window_hint")
          }
        ),
        /* @__PURE__ */ i(
          "div",
          {
            className: "absolute left-0 right-0 bottom-0 flex items-center gap-2 px-3 py-2 text-[12px] transition-opacity",
            style: { background: "rgba(0,0,0,.6)", color: "#ddd", opacity: C || u && !D ? 1 : 0, zIndex: 10 },
            children: [
              /* @__PURE__ */ s(M, { onClick: () => re(f - 1), disabled: f <= 1, "aria-label": e("viewer.prev"), style: he, children: "◂" }),
              /* @__PURE__ */ i("span", { className: "tabular-nums", children: [
                f,
                " / ",
                o
              ] }),
              /* @__PURE__ */ s(M, { onClick: () => re(f + 1), disabled: f >= o, "aria-label": e("viewer.next"), style: he, children: "▸" }),
              /* @__PURE__ */ s("span", { className: "ml-3 text-[11px]", style: { color: "#999" }, children: e(u ? "present.keys_window" : "present.keys") }),
              /* @__PURE__ */ i("span", { className: "ml-3 inline-flex items-center gap-1 text-[11px]", "data-testid": "present-presenter", "data-on": _ ? "true" : "false", style: { color: _ ? "#4ade80" : "#999" }, children: [
                /* @__PURE__ */ s("span", { "aria-hidden": !0, className: "inline-block rounded-full", style: { width: 7, height: 7, background: _ ? "#22c55e" : "#666" } }),
                e(_ ? "present.presenter_on" : "present.presenter_off")
              ] }),
              /* @__PURE__ */ i("span", { className: "ml-auto flex gap-1", children: [
                l && /* @__PURE__ */ i(M, { onClick: () => void l(f), style: he, title: e("present.presenter_hint"), children: [
                  e("present.presenter_window"),
                  " ↗"
                ] }),
                /* @__PURE__ */ s(
                  M,
                  {
                    onClick: () => {
                      k((F) => (m({ black: !F }), !F));
                    },
                    active: y,
                    "aria-pressed": y,
                    style: he,
                    children: e("presenter.black")
                  }
                ),
                !D && /* @__PURE__ */ s(M, { onClick: fe, style: he, children: e("present.fullscreen") }),
                /* @__PURE__ */ s(M, { onClick: te, style: he, children: e("present.close") })
              ] })
            ]
          }
        )
      ]
    }
  );
}
const pn = {
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
  "toolbar.presenting": "Presenting",
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
  "present.hint": "Open the show in its own window from the current slide; the presenter window opens in your browser",
  "present.open_hint": "The show window is open; click to bring it to the front",
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
  "present.keys_window": "← → or click: navigate · click an image: enlarge · Esc: leave fullscreen · close the window to end",
  "present.window_hint": "Drag this window to the projector screen, then press Fullscreen. Esc leaves fullscreen; closing the window ends the show.",
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
  "pins.batch_limit": "A batch holds at most {max} pins. Send hands over the first {max}; the rest stay as drafts for the next batch.",
  "pins.batch_left": "{n} drafts were kept for the next batch. Send again once this one is done.",
  "check.hint": "Check every slide: overflow, clipping, overlap, broken images, contrast, punctuation",
  "check.running": "Checking {n} slides",
  "check.title": "Check: {n} issues",
  "check.clean": "Check: no issues in {n} slides",
  "check.fix": "Fix",
  "check.fix_all": "Pin all",
  "check.fix_all_limit": "The agent takes at most {max} pins per batch. Pin all pins the first {max}; the rest can be pinned after that batch is done.",
  "check.fix_all_left": "{n} issues were not pinned: a batch holds {max} pins. Send these, then press Pin all again.",
  "check.close": "Close",
  "check.disabled": "Disabled in studio.json: {rules}",
  "check.partial": "{n} of {total} slides could not be measured (the browser stalled); the others are reported below. Run the check again to cover them.",
  "check.retry": "Check again",
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
}, fn = {
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
  "toolbar.presenting": "발표 중",
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
  "present.hint": "현재 슬라이드부터 발표 창을 따로 엽니다. 발표자 창은 브라우저로 함께 열립니다",
  "present.open_hint": "발표 창이 열려 있습니다. 누르면 앞으로 가져옵니다",
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
  "present.keys_window": "← → 또는 클릭: 이동 · 이미지 클릭: 확대 · Esc: 전체화면 해제 · 창을 닫으면 종료",
  "present.window_hint": "이 창을 프로젝터 화면으로 옮긴 뒤 [전체화면]을 누르세요. Esc는 전체화면만 해제하고, 창을 닫으면 발표가 끝납니다.",
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
  "pins.batch_limit": "한 묶음은 최대 {max}개입니다. [에이전트에게 보내기]는 앞의 {max}개만 보내고, 나머지는 다음 묶음을 위해 초안으로 남습니다.",
  "pins.batch_left": "{n}개는 다음 묶음을 위해 초안으로 남겼습니다. 이 묶음이 끝나면 다시 보내세요.",
  "check.hint": "모든 슬라이드 점검: 넘침, 잘림, 겹침, 이미지 유실, 대비, 문장부호",
  "check.running": "{n}장 점검 중",
  "check.title": "점검: {n}건",
  "check.clean": "점검: {n}장 모두 이상 없음",
  "check.fix": "고치기",
  "check.fix_all": "모두 핀으로",
  "check.fix_all_limit": "에이전트에게는 한 번에 최대 {max}개까지만 넘길 수 있습니다. [모두 핀으로]은 앞의 {max}개만 핀으로 만들고, 나머지는 그 묶음이 끝난 뒤 다시 핀으로 만들 수 있습니다.",
  "check.fix_all_left": "{n}개는 핀으로 만들지 않았습니다. 한 묶음은 {max}개까지입니다. 지금 핀을 보낸 뒤 [모두 핀으로]을 다시 누르세요.",
  "check.close": "닫기",
  "check.disabled": "studio.json에서 끔: {rules}",
  "check.partial": "{total}장 중 {n}장을 측정하지 못했습니다(브라우저가 멈춤). 나머지 결과는 아래에 있습니다. 다시 점검하면 그 슬라이드도 점검합니다.",
  "check.retry": "다시 점검",
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
}, nt = { en: pn, ko: fn }, pt = "html-studio.lang", gn = ["en", "ko"];
function xn(e) {
  return e !== "auto" ? e : ((typeof navigator < "u" ? navigator.language : "en") || "en").toLowerCase().startsWith("ko") ? "ko" : "en";
}
function vn() {
  try {
    const e = localStorage.getItem(pt);
    if (e === "en" || e === "ko" || e === "auto") return e;
  } catch {
  }
  return "auto";
}
function bn(e, t, n) {
  let r = nt[e][t] ?? nt.en[t] ?? t;
  if (n)
    for (const [o, a] of Object.entries(n)) r = r.replaceAll(`{${o}}`, String(a));
  return r;
}
function ft() {
  const [e, t] = x(vn), [, n] = x(0);
  V(() => {
    const l = () => n((h) => h + 1);
    return window.addEventListener("languagechange", l), () => window.removeEventListener("languagechange", l);
  }, []);
  const r = K((l) => {
    t(l);
    try {
      localStorage.setItem(pt, l);
    } catch {
    }
  }, []), o = xn(e);
  return { t: be(
    () => (l, h) => bn(o, l, h),
    [o]
  ), locale: o, pref: e, setPref: r };
}
const gt = "hsShow";
function kn(e) {
  const t = new URLSearchParams(e);
  if (!t.has(gt)) return null;
  const n = t.get("deck") ?? "", r = t.get("url") ?? "", o = t.get("base") ?? "", a = Number(t.get("slide") ?? "1"), l = Number(t.get("count") ?? "0");
  return !n || !r || !o || !Number.isFinite(a) || !Number.isFinite(l) ? null : { deck: n, url: r, base: o, slide: Math.max(1, a), count: Math.max(0, l) };
}
function yn(e) {
  const t = new URLSearchParams({ [gt]: "1", deck: e.deck, url: e.url, base: e.base, slide: String(e.slide), count: String(e.count) });
  return `${location.origin}${location.pathname}?${t.toString()}`;
}
function wn({ params: e }) {
  const t = Ue(), n = be(() => ct(t), [t]), { t: r, locale: o } = ft();
  return /* @__PURE__ */ s(
    mt,
    {
      t: r,
      mode: "window",
      url: e.url,
      baseUrl: e.base,
      startSlide: e.slide,
      slideCount: e.count,
      onClose: () => window.close(),
      openPresenter: async (a) => {
        await n.present(e.deck, a, "presenter", o);
      }
    }
  );
}
const Nn = ["summarize", "draft-next", "notes", "check", "tighten"];
function _n(e, t) {
  const n = t.language.startsWith("ko") ? "Korean" : "English", r = `slide ${t.slideNumber} of ${t.slideCount} (${t.slideFile})`, o = t.hasDesignMd ? " Follow DESIGN.md / tokens.css." : "", a = " No em/en dashes or middle dots in slide text; keep the slide inside its 1280x720 stage.";
  switch (e) {
    case "summarize":
      return `Summarize ${r} in ${n}: three short bullets on what it says and one line on what a presenter should stress. Do not edit any file.`;
    case "draft-next":
      return `Draft the NEXT slide after ${r}. Read that slide and its neighbours for context and continuity, then create a new slide file right after it in the same folder, following the existing filename numbering (leave room between numbers) and the deck's existing markup patterns and classes.` + o + a + ` Reply in ${n} with the new file name and a one-line description.`;
    case "notes":
      return `Write speaker notes for ${r} into ${t.notesFile} (Markdown, in ${n}): 4 to 6 talking points plus one transition sentence to the next slide. Do not touch the slide HTML. Reply with one line when done.`;
    case "check":
      return `Review ${r} and reply in ${n}, without editing anything: (1) text that overflows or is likely clipped, (2) wording that is vague, redundant or too long for a slide, (3) inconsistencies with the neighbouring slides. Keep it to at most six bullets; if all is fine say so in one line.`;
    case "tighten":
      return `Tighten the text of ${r}: shorter sentences, fewer words, same meaning and structure. Edit the slide file directly; keep every heading, class and layout element.` + o + a + ` Reply in ${n} with one line on what changed.`;
  }
}
function Cn({ t: e, slideNumber: t, disabled: n = !1, onRun: r }) {
  const [o, a] = x(null), [l, h] = x(null), c = async (u) => {
    a(u), h(null);
    try {
      await r(u), h({ kind: "ok", text: e("quick.sent") });
    } catch (v) {
      h({ kind: "err", text: `${e("quick.failed")}: ${v instanceof Error ? v.message : String(v)}` });
    } finally {
      a(null), setTimeout(() => h(null), 4e3);
    }
  };
  return /* @__PURE__ */ i("div", { className: "flex items-center gap-1 flex-wrap flex-none mb-1 text-[12px]", role: "group", "aria-label": e("quick.label", { n: t }), "data-testid": "quick-chips", children: [
    /* @__PURE__ */ s("span", { className: "text-muted mr-1", children: e("quick.label", { n: t }) }),
    Nn.map((u) => /* @__PURE__ */ i(M, { onClick: () => void c(u), disabled: n || o !== null, title: e(`quick.hint.${u}`), "data-action": u, className: "inline-flex items-center gap-1", children: [
      o === u && /* @__PURE__ */ s(ae, {}),
      e(`quick.${u}`)
    ] }, u)),
    l && /* @__PURE__ */ s("span", { role: "status", className: "ml-1", style: { color: l.kind === "ok" ? "var(--ok)" : "var(--danger)" }, children: l.text })
  ] });
}
const xt = "html-studio.collapsed";
function st() {
  try {
    const e = JSON.parse(localStorage.getItem(xt) || "{}");
    return e && typeof e == "object" ? e : {};
  } catch {
    return {};
  }
}
function Ae(e, t = !0) {
  const [n, r] = x(() => {
    const a = st()[e];
    return typeof a == "boolean" ? !a : t;
  }), o = K(
    (a) => {
      r(a);
      try {
        localStorage.setItem(xt, JSON.stringify({ ...st(), [e]: !a }));
      } catch {
      }
    },
    [e]
  );
  return [n, o];
}
function rt({ id: e, title: t, badge: n, actions: r, defaultOpen: o = !0, forceOpen: a = null, grow: l = !1, children: h }) {
  const [c, u] = Ae(e, o);
  return V(() => {
    a !== null && a !== c && u(a);
  }, [a]), /* @__PURE__ */ i("section", { "data-grow": c && l ? "true" : "false", className: `flex flex-col min-h-0 ${c && l ? "flex-1" : "flex-none"}`, children: [
    /* @__PURE__ */ i("div", { className: "flex items-center gap-1", children: [
      /* @__PURE__ */ i(
        "button",
        {
          type: "button",
          onClick: () => u(!c),
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
    c && /* @__PURE__ */ s("div", { id: `${e}-body`, className: `min-h-0 overflow-y-auto pl-1 pr-1 ${l ? "flex-1" : ""}`, children: h })
  ] });
}
function Ee({ src: e, stageWidth: t, stageHeight: n, lazy: r = !1, title: o, className: a = "", reloadKey: l = 0, fit: h = "width", interactive: c = !1, frameRef: u }) {
  const v = Z(null), [p, f] = x({ w: 0, h: 0 }), [g, I] = x(!r);
  V(() => {
    const y = v.current;
    if (!y) return;
    const k = new ResizeObserver((w) => {
      for (const _ of w) f({ w: _.contentRect.width, h: _.contentRect.height });
    });
    return k.observe(y), () => k.disconnect();
  }, []), V(() => {
    if (!r || g) return;
    const y = v.current;
    if (!y) return;
    const k = new IntersectionObserver(
      (w) => {
        w.some((_) => _.isIntersecting) && I(!0);
      },
      { rootMargin: "200px" }
    );
    return k.observe(y), () => k.disconnect();
  }, [r, g]);
  const d = h === "contain" ? p.w > 0 && p.h > 0 ? Math.min(p.w / t, p.h / n) : 0 : p.w > 0 ? p.w / t : 0, R = g && d > 0 && /* @__PURE__ */ s(
    "iframe",
    {
      ref: u,
      src: e,
      title: o,
      sandbox: c ? "allow-scripts allow-same-origin" : "allow-same-origin",
      tabIndex: -1,
      className: `absolute top-0 left-0 border-0 ${c ? "" : "pointer-events-none"}`,
      style: { width: t, height: n, transform: `scale(${d})`, transformOrigin: "top left" }
    },
    `${l}:${c ? "i" : "s"}`
  );
  if (h === "contain") {
    const y = Math.floor(t * d), k = Math.floor(n * d);
    return (
      // Absolutely positioned so it can never be taller than the flex parent that
      // hands it its space (a percentage height would keep a stale value while
      // siblings grow and then overlap them).
      /* @__PURE__ */ s("div", { ref: v, className: "absolute inset-0 flex items-center justify-center", "data-testid": "slide-fit", children: d > 0 && /* @__PURE__ */ s("div", { className: `relative overflow-hidden ${a}`, style: { width: y, height: k, background: "#fff" }, "data-testid": "slide-stage", children: R }) })
    );
  }
  return /* @__PURE__ */ s("div", { ref: v, className: `relative overflow-hidden ${a}`, style: { aspectRatio: `${t} / ${n}`, background: "#fff" }, children: R });
}
function Sn({ t: e, preview: t, current: n, onSelect: r, reloadKey: o, withNotes: a, notesLabel: l = "Has notes", arrange: h }) {
  const c = Z(null), u = Z(null), [v, p] = x(null), f = (_) => {
    u.current = _, p(_);
  }, [g, I] = x(null), [d, R] = x(null);
  V(() => {
    var N;
    const _ = (N = c.current) == null ? void 0 : N.querySelector(`[data-index="${n}"]`);
    _ == null || _.scrollIntoView({ block: "nearest" });
  }, [n]), V(() => {
    R(null);
  }, [n, t.slides]);
  const y = (_, N) => {
    if (!h || _ === N || N < 0 || N >= t.slides.length) return;
    const A = t.slides.slice(), [W] = A.splice(_, 1);
    A.splice(N, 0, W), h.onReorder(A);
  }, k = (_) => {
    const N = u.current;
    N !== null && (y(N, _), f(null), I(null));
  }, w = !h || h.busy;
  return /* @__PURE__ */ i("div", { className: "flex flex-col gap-2", children: [
    h && /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        onClick: () => h.onAdd(t.slides[n] ?? null),
        disabled: w,
        className: "w-full rounded-md py-1 text-[12px] cursor-pointer bg-transparent text-muted hover:text-text",
        style: { border: "1px dashed var(--border)" },
        "data-testid": "strip-add",
        children: e("strip.add")
      }
    ),
    /* @__PURE__ */ s("ol", { ref: c, className: "m-0 p-0 list-none grid gap-2", style: { gridTemplateColumns: "1fr" }, children: t.slides.map((_, N) => {
      const A = N === n, W = g === N && v !== null && v !== N;
      return /* @__PURE__ */ i(
        "li",
        {
          "data-index": N,
          draggable: !!h && !h.busy,
          onDragStart: (j) => {
            f(N), j.dataTransfer.effectAllowed = "move", j.dataTransfer.setData("text/plain", _);
          },
          onDragOver: (j) => {
            u.current !== null && (j.preventDefault(), j.dataTransfer.dropEffect = "move", g !== N && I(N));
          },
          onDragLeave: () => {
            g === N && I(null);
          },
          onDrop: (j) => {
            j.preventDefault(), k(N);
          },
          onDragEnd: () => {
            f(null), I(null);
          },
          className: "relative",
          style: {
            opacity: v === N ? 0.5 : 1,
            boxShadow: W ? v !== null && v < N ? "0 3px 0 0 var(--accent)" : "0 -3px 0 0 var(--accent)" : void 0,
            borderRadius: 6
          },
          children: [
            /* @__PURE__ */ i(
              "button",
              {
                type: "button",
                onClick: () => r(N),
                "aria-current": A ? "true" : void 0,
                title: _,
                className: "w-full text-left rounded-md p-1 cursor-pointer bg-transparent",
                style: {
                  border: `2px solid ${A ? "var(--accent)" : "var(--border)"}`
                },
                children: [
                  /* @__PURE__ */ s(
                    Ee,
                    {
                      src: `${t.baseUrl}/slide/${N}`,
                      stageWidth: t.stage.width,
                      stageHeight: t.stage.height,
                      lazy: !0,
                      title: _,
                      reloadKey: o,
                      className: "rounded-sm"
                    }
                  ),
                  /* @__PURE__ */ i("div", { className: "flex items-center gap-2 mt-1 text-[11px] text-muted", children: [
                    /* @__PURE__ */ s("span", { className: "font-medium", style: { color: A ? "var(--accent)" : void 0 }, children: N + 1 }),
                    /* @__PURE__ */ s("span", { className: "truncate", children: _ }),
                    (a == null ? void 0 : a.has(_)) && /* @__PURE__ */ s("span", { className: "ml-auto flex-none", title: l, "aria-label": l, "data-testid": "strip-note", style: { color: "var(--accent)" }, children: "≡" })
                  ] })
                ]
              }
            ),
            h && A && /* @__PURE__ */ i("div", { className: "absolute", style: { right: 6, top: 6 }, children: [
              /* @__PURE__ */ s(
                M,
                {
                  onClick: () => R(d === N ? null : N),
                  "aria-haspopup": "menu",
                  "aria-expanded": d === N,
                  "aria-label": e("strip.menu"),
                  title: e("strip.menu"),
                  disabled: h.busy,
                  style: { background: "var(--bg)", padding: "0 6px" },
                  children: "⋯"
                }
              ),
              d === N && /* @__PURE__ */ s("div", { role: "menu", className: "absolute right-0 mt-1 rounded-md border border-border flex flex-col p-1 text-[12px]", style: { background: "var(--bg)", minWidth: 140, zIndex: 20, boxShadow: "0 4px 14px rgba(0,0,0,.18)" }, children: [
                ["strip.move_up", () => y(N, N - 1), N === 0],
                ["strip.move_down", () => y(N, N + 1), N >= t.slides.length - 1],
                ["strip.duplicate", () => h.onDuplicate(_), !1],
                ["strip.save_layout", () => h.onSaveLayout(_), !1],
                ["strip.archive", () => h.onArchive(_), t.slides.length <= 1]
              ].map(([j, b, P]) => /* @__PURE__ */ s(
                "button",
                {
                  type: "button",
                  role: "menuitem",
                  disabled: P || h.busy,
                  onClick: () => {
                    R(null), b();
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
        _
      );
    }) })
  ] });
}
function $n({ t: e, client: t, preview: n, mode: r, after: o, saveSlide: a, deckPath: l, busy: h, onPick: c, onClose: u }) {
  const [v, p] = x(null), [f, g] = x(null), [I, d] = x(""), [R, y] = x(!1), [k, w] = x(null), _ = Z(null), N = () => t.layouts().then((m) => p(m.items)).catch((m) => g(m instanceof ee ? m.code : "request_failed"));
  V(() => {
    N();
  }, []), V(() => {
    var m;
    r === "save" && ((m = _.current) == null || m.focus());
  }, [r]);
  const A = async () => {
    if (!(!a || !I.trim())) {
      y(!0), g(null);
      try {
        const m = await t.layoutSave(l, a, I.trim());
        w(m.name), d(""), await N();
      } catch (m) {
        g(m instanceof ee ? m.code : "request_failed");
      } finally {
        y(!1);
      }
    }
  }, W = async (m) => {
    g(null);
    try {
      await t.layoutDelete(m), await N();
    } catch (D) {
      g(D instanceof ee ? D.code : "request_failed");
    }
  }, j = (m) => m.builtin ? e(`layout.${m.id}`) : m.name ?? m.id, b = (v == null ? void 0 : v.filter((m) => m.builtin)) ?? [], P = (v == null ? void 0 : v.filter((m) => !m.builtin)) ?? [], S = (m) => /* @__PURE__ */ s("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }, children: m.map((D) => /* @__PURE__ */ i("div", { className: "flex flex-col gap-1", "data-testid": "layout-card", "data-layout": D.id, children: [
    /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        disabled: h || r === "save",
        onClick: () => c(D.id, o),
        "aria-label": e("layout.insert", { name: j(D) }),
        className: "rounded-md p-1 bg-transparent cursor-pointer text-left",
        style: { border: "2px solid var(--border)" },
        children: /* @__PURE__ */ s(Ee, { src: `${n.baseUrl}/layout/${D.id}`, stageWidth: n.stage.width, stageHeight: n.stage.height, title: j(D), className: "rounded-sm" })
      }
    ),
    /* @__PURE__ */ i("div", { className: "flex items-center gap-2 text-[12px]", children: [
      /* @__PURE__ */ s("span", { className: "truncate", children: j(D) }),
      !D.builtin && /* @__PURE__ */ s(M, { danger: !0, className: "ml-auto", onClick: () => void W(D.id), disabled: h, "aria-label": e("layout.delete", { name: j(D) }), children: e("layout.delete_short") })
    ] })
  ] }, D.id)) });
  return /* @__PURE__ */ s("div", { className: "fixed inset-0", style: { zIndex: 900, background: "rgba(0,0,0,.45)", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center" }, onClick: u, children: /* @__PURE__ */ i(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": e(r === "save" ? "layout.save_title" : "layout.title"),
      className: "rounded-lg border border-border",
      style: { display: "flex", flexDirection: "column", flex: "0 0 auto", background: "var(--bg)", width: "min(920px, 92vw)", height: "auto", maxHeight: "86vh", boxShadow: "0 12px 40px rgba(0,0,0,.3)" },
      onClick: (m) => m.stopPropagation(),
      children: [
        /* @__PURE__ */ i("div", { className: "flex-none px-4 py-3 border-b border-border", style: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12, flex: "0 0 auto" }, children: [
          /* @__PURE__ */ i("div", { className: "flex flex-col", children: [
            /* @__PURE__ */ s("span", { className: "font-semibold text-[14px]", children: e(r === "save" ? "layout.save_title" : "layout.title") }),
            /* @__PURE__ */ s("span", { className: "text-[12px] text-muted", children: e(r === "save" ? "layout.save_hint" : "layout.hint") })
          ] }),
          /* @__PURE__ */ s("span", { className: "flex-1" }),
          h && /* @__PURE__ */ s(ae, {}),
          /* @__PURE__ */ s(M, { onClick: u, children: e("layout.close") })
        ] }),
        /* @__PURE__ */ i("div", { className: "px-4 py-3 overflow-auto flex-1 min-h-0", style: { display: "flex", flexDirection: "column", gap: 16, flex: "0 1 auto" }, children: [
          f && /* @__PURE__ */ s("p", { className: "m-0 text-[12px]", role: "alert", style: { color: "var(--danger)" }, children: e("error.generic", { code: f }) }),
          r === "save" && a && /* @__PURE__ */ i("div", { className: "flex gap-4 items-start", children: [
            /* @__PURE__ */ s("div", { style: { width: 260, flex: "none" }, children: /* @__PURE__ */ s(Ee, { src: `${n.baseUrl}/slide/${n.slides.indexOf(a)}`, stageWidth: n.stage.width, stageHeight: n.stage.height, title: a, className: "rounded-sm border border-border" }) }),
            /* @__PURE__ */ i(
              "form",
              {
                className: "flex flex-col gap-2 flex-1",
                onSubmit: (m) => {
                  m.preventDefault(), A();
                },
                children: [
                  /* @__PURE__ */ s("label", { className: "text-[12px] text-muted", htmlFor: "layout-name", children: e("layout.name_label") }),
                  /* @__PURE__ */ s(
                    "input",
                    {
                      id: "layout-name",
                      ref: _,
                      value: I,
                      onChange: (m) => d(m.target.value),
                      maxLength: 60,
                      className: "rounded-md border border-border px-2 py-1 text-[13px]",
                      style: { background: "var(--bg)", color: "var(--text)" },
                      placeholder: e("layout.name_placeholder")
                    }
                  ),
                  /* @__PURE__ */ i("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ s(M, { type: "submit", active: !0, disabled: R || !I.trim(), children: e("layout.save") }),
                    R && /* @__PURE__ */ s(ae, {}),
                    k && /* @__PURE__ */ s("span", { className: "text-[12px]", role: "status", style: { color: "var(--ok)" }, children: e("layout.saved", { name: k }) })
                  ] }),
                  /* @__PURE__ */ s("p", { className: "m-0 text-[11px] text-muted", children: e("layout.save_note") })
                ]
              }
            )
          ] }),
          v === null && !f ? /* @__PURE__ */ i("p", { className: "m-0 text-[12px] text-muted inline-flex items-center gap-2", children: [
            /* @__PURE__ */ s(ae, {}),
            " ",
            e("viewer.loading")
          ] }) : /* @__PURE__ */ i(we, { children: [
            /* @__PURE__ */ i("div", { children: [
              /* @__PURE__ */ s("div", { className: "text-[12px] font-medium mb-2", children: e("layout.builtin") }),
              S(b)
            ] }),
            /* @__PURE__ */ i("div", { children: [
              /* @__PURE__ */ s("div", { className: "text-[12px] font-medium mb-2", children: e("layout.mine") }),
              P.length ? S(P) : /* @__PURE__ */ s("p", { className: "m-0 text-[12px] text-muted", children: e("layout.mine_empty") })
            ] })
          ] })
        ] })
      ]
    }
  ) });
}
const vt = "hs.newDeck";
function Rn() {
  try {
    return JSON.parse(localStorage.getItem(vt) || "{}");
  } catch {
    return {};
  }
}
function In(e) {
  return e.replace(/[^\p{L}\p{N}_\- ]/gu, "").trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "deck";
}
function Dn({ t: e, client: t, roots: n, decks: r, onCreated: o, onClose: a }) {
  var G;
  const l = be(Rn, []), [h, c] = x(""), [u, v] = x(l.presenter ?? ""), [p, f] = x(""), [g, I] = x(""), [d, R] = x(""), [y, k] = x(l.themeKind ?? "default"), [w, _] = x(l.accent ?? "#6d5efc"), [N, A] = x(l.bg ?? "#ffffff"), [W, j] = x(l.fg ?? "#1f2430"), [b, P] = x(l.font ?? ""), [S, m] = x(((G = r[0]) == null ? void 0 : G.path) ?? ""), [D, E] = x(n.includes(l.root ?? "") ? l.root : n[0] ?? ""), [C, B] = x(""), [T, L] = x(!1), [O, z] = x(l.askOutline ?? !0), [X, J] = x(!1), [Q, te] = x(null);
  V(() => {
    T || B(In(h));
  }, [h, T]);
  const fe = r.filter(($) => $.hasDesignMd || $.hasStudioJson), ie = h.trim() && C.trim() && D && !X && (y !== "copy" || S), re = async () => {
    if (!ie) return;
    J(!0), te(null);
    const $ = y === "design" ? { kind: "design", accent: w, bg: N, fg: W, font: b.trim() || void 0 } : y === "copy" ? { kind: "copy", from: S } : { kind: "default" }, H = { root: D, folder: C.trim(), title: h.trim(), presenter: u.trim(), purpose: p.trim(), audience: g.trim(), sources: d.trim(), theme: $ };
    try {
      const ne = await t.deckNew(H);
      try {
        localStorage.setItem(vt, JSON.stringify({ presenter: u.trim(), root: D, themeKind: y, accent: w, bg: N, fg: W, font: b.trim(), askOutline: O }));
      } catch {
      }
      o(ne.deck, O, H);
    } catch (ne) {
      te(ne instanceof ee ? ne.code : "request_failed"), J(!1);
    }
  }, pe = "rounded-md border border-border px-2 py-1 text-[13px] w-full", ue = { background: "var(--bg)", color: "var(--text)" }, he = ($, H, ne, le) => /* @__PURE__ */ i("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ s("label", { htmlFor: $, className: "text-[12px] text-muted", children: H }),
    ne,
    le && /* @__PURE__ */ s("span", { className: "text-[11px] text-muted", children: le })
  ] }), F = ($, H) => /* @__PURE__ */ i("fieldset", { className: "m-0 p-0 border-0 flex flex-col gap-2", children: [
    /* @__PURE__ */ s("legend", { className: "text-[12px] font-semibold mb-1 p-0", children: $ }),
    H
  ] }), q = ($, H, ne, le) => /* @__PURE__ */ i("label", { htmlFor: $, className: "flex items-center gap-2 text-[12px]", children: [
    /* @__PURE__ */ s("input", { id: $, type: "color", value: ne, onChange: (ge) => le(ge.target.value), "aria-label": H, style: { width: 28, height: 22, padding: 0, border: "1px solid var(--border)", background: "transparent" } }),
    H,
    " ",
    /* @__PURE__ */ s("span", { className: "text-muted", children: ne })
  ] });
  return /* @__PURE__ */ s("div", { className: "fixed inset-0", style: { zIndex: 900, background: "rgba(0,0,0,.45)", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center" }, onClick: a, children: /* @__PURE__ */ i(
    "form",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": e("newdeck.title"),
      className: "rounded-lg border border-border",
      style: { display: "flex", flexDirection: "column", flex: "0 0 auto", background: "var(--bg)", width: "min(720px, 92vw)", maxHeight: "88vh", boxShadow: "0 12px 40px rgba(0,0,0,.3)" },
      onClick: ($) => $.stopPropagation(),
      onSubmit: ($) => {
        $.preventDefault(), re();
      },
      children: [
        /* @__PURE__ */ i("div", { className: "flex-none px-4 py-3 border-b border-border", style: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }, children: [
          /* @__PURE__ */ i("div", { className: "flex flex-col", children: [
            /* @__PURE__ */ s("span", { className: "font-semibold text-[14px]", children: e("newdeck.title") }),
            /* @__PURE__ */ s("span", { className: "text-[12px] text-muted", children: e("newdeck.hint") })
          ] }),
          /* @__PURE__ */ s("span", { className: "flex-1" }),
          /* @__PURE__ */ s(M, { type: "button", onClick: a, disabled: X, children: e("layout.close") })
        ] }),
        /* @__PURE__ */ i("div", { className: "px-4 py-3 overflow-auto", style: { display: "flex", flexDirection: "column", gap: 18, flex: "0 1 auto" }, children: [
          F(
            e("newdeck.group_deck"),
            /* @__PURE__ */ i(we, { children: [
              he("nd-title", e("newdeck.f_title"), /* @__PURE__ */ s("input", { id: "nd-title", className: pe, style: ue, value: h, onChange: ($) => c($.target.value), required: !0, autoFocus: !0, maxLength: 200 })),
              he("nd-presenter", e("newdeck.f_presenter"), /* @__PURE__ */ s("input", { id: "nd-presenter", className: pe, style: ue, value: u, onChange: ($) => v($.target.value), maxLength: 120 })),
              he("nd-purpose", e("newdeck.f_purpose"), /* @__PURE__ */ s("textarea", { id: "nd-purpose", className: pe, style: { ...ue, minHeight: 48 }, value: p, onChange: ($) => f($.target.value), maxLength: 4e3 })),
              he("nd-audience", e("newdeck.f_audience"), /* @__PURE__ */ s("input", { id: "nd-audience", className: pe, style: ue, value: g, onChange: ($) => I($.target.value), maxLength: 400 })),
              he("nd-sources", e("newdeck.f_sources"), /* @__PURE__ */ s("textarea", { id: "nd-sources", className: pe, style: { ...ue, minHeight: 64 }, value: d, onChange: ($) => R($.target.value), maxLength: 4e3 }), e("newdeck.f_sources_hint"))
            ] })
          ),
          F(
            e("newdeck.group_theme"),
            /* @__PURE__ */ i(we, { children: [
              /* @__PURE__ */ s("div", { className: "flex flex-wrap gap-3 text-[12px]", role: "radiogroup", "aria-label": e("newdeck.group_theme"), children: ["default", "design", "copy"].map(($) => /* @__PURE__ */ i("label", { className: "inline-flex items-center gap-1", children: [
                /* @__PURE__ */ s("input", { type: "radio", name: "theme", value: $, checked: y === $, onChange: () => k($), disabled: $ === "copy" && !fe.length }),
                e(`newdeck.theme_${$}`)
              ] }, $)) }),
              y === "design" && /* @__PURE__ */ i("div", { className: "flex flex-wrap gap-4 items-center", children: [
                q("nd-accent", e("newdeck.c_accent"), w, _),
                q("nd-bg", e("newdeck.c_bg"), N, A),
                q("nd-fg", e("newdeck.c_fg"), W, j),
                /* @__PURE__ */ i("label", { htmlFor: "nd-font", className: "flex items-center gap-2 text-[12px]", children: [
                  e("newdeck.c_font"),
                  /* @__PURE__ */ s("input", { id: "nd-font", className: "rounded-md border border-border px-2 py-1 text-[12px]", style: { ...ue, width: 160 }, value: b, onChange: ($) => P($.target.value), placeholder: "Pretendard", maxLength: 80 })
                ] })
              ] }),
              y === "copy" && /* @__PURE__ */ s("select", { className: pe, style: ue, value: S, onChange: ($) => m($.target.value), "aria-label": e("newdeck.theme_copy_from"), children: fe.map(($) => /* @__PURE__ */ s("option", { value: $.path, children: $.name }, $.path)) })
            ] })
          ),
          F(
            e("newdeck.group_where"),
            /* @__PURE__ */ i("div", { className: "flex gap-3 flex-wrap", children: [
              /* @__PURE__ */ i("div", { className: "flex flex-col gap-1", style: { flex: "1 1 260px" }, children: [
                /* @__PURE__ */ s("label", { htmlFor: "nd-root", className: "text-[12px] text-muted", children: e("newdeck.f_root") }),
                /* @__PURE__ */ s("select", { id: "nd-root", className: pe, style: ue, value: D, onChange: ($) => E($.target.value), children: n.map(($) => /* @__PURE__ */ s("option", { value: $, children: $.replace(/^\/Users\/[^/]+|^\/home\/[^/]+/, "~") }, $)) })
              ] }),
              /* @__PURE__ */ i("div", { className: "flex flex-col gap-1", style: { flex: "1 1 200px" }, children: [
                /* @__PURE__ */ s("label", { htmlFor: "nd-folder", className: "text-[12px] text-muted", children: e("newdeck.f_folder") }),
                /* @__PURE__ */ s(
                  "input",
                  {
                    id: "nd-folder",
                    className: pe,
                    style: ue,
                    value: C,
                    onChange: ($) => {
                      L(!0), B($.target.value);
                    },
                    maxLength: 80
                  }
                )
              ] })
            ] })
          ),
          /* @__PURE__ */ i("label", { className: "inline-flex items-center gap-2 text-[12px]", children: [
            /* @__PURE__ */ s("input", { type: "checkbox", checked: O, onChange: ($) => z($.target.checked) }),
            e("newdeck.ask_outline")
          ] }),
          Q && /* @__PURE__ */ s("p", { className: "m-0 text-[12px]", role: "alert", style: { color: "var(--danger)" }, children: e(`newdeck.err_${Q}`) === `newdeck.err_${Q}` ? e("error.generic", { code: Q }) : e(`newdeck.err_${Q}`) })
        ] }),
        /* @__PURE__ */ i("div", { className: "flex-none px-4 py-3 border-t border-border", style: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ s("span", { className: "flex-1" }),
          X && /* @__PURE__ */ s(ae, {}),
          /* @__PURE__ */ s(M, { type: "submit", active: !0, disabled: !ie, children: e("newdeck.create") })
        ] })
      ]
    }
  ) });
}
const Tn = ["colors", "font", "typography", "spacing", "rounded"];
function ot(e) {
  const t = /^(-?\d+(?:\.\d+)?)(px|rem|em|%|vw|vh)?$/.exec(e.trim());
  return t ? { n: Number(t[1]), unit: t[2] ?? "" } : null;
}
function En({ t: e, client: t, deckPath: n, design: r, onWriteTokens: o, tokensBusy: a = !1, onPreview: l, onApplied: h, onClose: c }) {
  const [u, v] = x(null), [p, f] = x({}), [g, I] = x(null), [d, R] = x(!1), [y, k] = x(!1), w = Z(null), _ = () => t.tweakInfo(n).then((m) => {
    v(m), I(null);
  }).catch((m) => I(m instanceof ee ? m.code : "request_failed"));
  V(() => {
    _();
  }, [n]);
  const N = (m) => {
    w.current && clearTimeout(w.current), w.current = setTimeout(() => {
      t.tweakPreview(n, m).then(() => l()).catch((D) => I(D instanceof ee ? D.code : "request_failed"));
    }, 120);
  }, A = (m, D) => {
    k(!1);
    const E = { ...p };
    D.trim() === m.value.trim() ? delete E[m.var] : E[m.var] = D, f(E), N(E);
  }, W = () => {
    w.current && clearTimeout(w.current), f({}), k(!1), N({});
  }, j = async () => {
    w.current && (clearTimeout(w.current), w.current = null), R(!0), I(null);
    try {
      const m = await t.tweakApply(n, p);
      f({}), k(!0), h(m.rebuild), await _();
    } catch (m) {
      I(m instanceof ee ? m.code : "request_failed");
    } finally {
      R(!1);
    }
  };
  V(
    () => () => {
      w.current && clearTimeout(w.current), t.tweakPreview(n, {}).then(() => l()).catch(() => {
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n]
  );
  const b = be(() => {
    var D;
    const m = {};
    for (const E of (u == null ? void 0 : u.items) ?? []) (m[D = E.group] || (m[D] = [])).push(E);
    return Tn.filter((E) => {
      var C;
      return (C = m[E]) == null ? void 0 : C.length;
    }).map((E) => [E, m[E]]);
  }, [u]), P = Object.keys(p).length, S = (m) => {
    const D = p[m.var] ?? m.value, E = m.var in p;
    if (m.kind === "color") {
      const C = /^#[0-9a-f]{6}$/i.test(D) ? D : "#000000";
      return /* @__PURE__ */ s("input", { type: "color", value: C, onChange: (B) => A(m, B.target.value), "aria-label": m.name, style: { width: 34, height: 24, padding: 0, border: `1px solid ${E ? "var(--accent)" : "var(--border)"}`, background: "transparent" } });
    }
    if (m.kind === "length") {
      const C = ot(m.value), B = ot(D) ?? C;
      if (C && B) {
        const T = Math.max(Math.abs(C.n) * 2, C.n === 0 ? 100 : 1), L = C.unit === "rem" || C.unit === "em" ? 0.05 : 1;
        return /* @__PURE__ */ i("span", { className: "inline-flex items-center gap-2", children: [
          /* @__PURE__ */ s("input", { type: "range", min: 0, max: T, step: L, value: B.n, onChange: (O) => A(m, `${O.target.value}${C.unit}`), "aria-label": m.name, style: { width: 110 } }),
          /* @__PURE__ */ s(
            "input",
            {
              type: "number",
              step: L,
              value: B.n,
              onChange: (O) => A(m, `${O.target.value}${C.unit}`),
              "aria-label": `${m.name} value`,
              className: "rounded border border-border px-1 text-[12px]",
              style: { width: 64, background: "var(--bg)", color: "var(--text)" }
            }
          ),
          /* @__PURE__ */ s("span", { className: "text-muted text-[11px]", children: C.unit })
        ] });
      }
    }
    return /* @__PURE__ */ s("input", { value: D, onChange: (C) => A(m, C.target.value), "aria-label": m.name, className: "rounded border border-border px-1 text-[12px]", style: { width: 150, background: "var(--bg)", color: "var(--text)" } });
  };
  return /* @__PURE__ */ i("div", { className: "flex flex-col min-h-0 h-full text-[12px]", "data-testid": "tweak-panel", style: { borderLeft: "1px solid var(--border)", paddingLeft: 12 }, children: [
    /* @__PURE__ */ i("div", { className: "flex items-center gap-2 mb-2 flex-none", children: [
      /* @__PURE__ */ s("span", { className: "font-semibold text-[13px]", children: e("tweak.title") }),
      /* @__PURE__ */ s("span", { className: "flex-1" }),
      /* @__PURE__ */ s(M, { onClick: c, children: e("layout.close") })
    ] }),
    /* @__PURE__ */ s("p", { className: "m-0 mb-2 text-muted flex-none", children: u != null && u.hasDesign ? e("tweak.hint_design") : e("tweak.hint_default") }),
    (u == null ? void 0 : u.hasDesign) && u.layered && /* @__PURE__ */ s("p", { className: "m-0 mb-2 text-muted flex-none", children: e("tweak.hint_layered", { css: u.css ?? "" }) }),
    (u == null ? void 0 : u.hasDesign) && r && !r.empty && (!r.tokensExists || r.tokensStale || u.css !== "tokens.css" && !u.layered) && /* @__PURE__ */ i("div", { className: "mb-2 flex-none flex items-center gap-2 flex-wrap rounded-md border px-2 py-1", style: { borderColor: "var(--warn)" }, children: [
      /* @__PURE__ */ s("span", { style: { color: "var(--warn)" }, children: r.tokensExists ? r.tokensStale ? e("theme.tokens.stale") : e("tweak.hint_no_tokens") : e("theme.tokens.missing") }),
      o && /* @__PURE__ */ i(M, { onClick: o, disabled: a || d, className: "inline-flex items-center gap-1", title: e("theme.tokens.hint"), children: [
        a && /* @__PURE__ */ s(ae, {}),
        r.tokensExists ? e("theme.tokens.update") : e("theme.tokens.write")
      ] })
    ] }),
    g && /* @__PURE__ */ s("p", { className: "m-0 mb-2", role: "alert", style: { color: "var(--danger)" }, children: e("error.generic", { code: g }) }),
    /* @__PURE__ */ i("div", { className: "flex-1 min-h-0 overflow-auto flex flex-col gap-3 pr-1", children: [
      !u && !g && /* @__PURE__ */ i("span", { className: "inline-flex items-center gap-2 text-muted", children: [
        /* @__PURE__ */ s(ae, {}),
        " ",
        e("viewer.loading")
      ] }),
      b.map(([m, D]) => /* @__PURE__ */ i("div", { children: [
        /* @__PURE__ */ s("div", { className: "font-medium mb-1", children: e(`tweak.group_${m}`) }),
        /* @__PURE__ */ s("div", { className: "flex flex-col gap-1", children: D.map((E) => {
          const C = E.var in p;
          return /* @__PURE__ */ i("div", { className: "flex items-center gap-2", "data-testid": "tweak-item", "data-var": E.var, "data-changed": C ? "true" : void 0, children: [
            /* @__PURE__ */ i("span", { className: "truncate", style: { width: 120, color: C ? "var(--accent)" : void 0 }, title: E.var, children: [
              C ? "● " : "",
              E.name
            ] }),
            S(E),
            C && /* @__PURE__ */ s(M, { onClick: () => A(E, E.value), "aria-label": e("tweak.revert_one", { name: E.name }), style: { padding: "0 6px" }, children: "↺" })
          ] }, E.var);
        }) })
      ] }, m))
    ] }),
    /* @__PURE__ */ i("div", { className: "flex items-center gap-2 mt-2 flex-none flex-wrap", children: [
      /* @__PURE__ */ s(M, { onClick: () => void j(), active: !0, disabled: !P || d, children: e("tweak.apply") }),
      /* @__PURE__ */ s(M, { onClick: W, disabled: !P || d, children: e("tweak.revert_all") }),
      d && /* @__PURE__ */ s(ae, {}),
      /* @__PURE__ */ s("span", { className: "text-muted", role: "status", children: d ? e("tweak.applying") : y ? e("tweak.applied") : P ? e("tweak.dirty", { n: P }) : "" })
    ] }),
    /* @__PURE__ */ s("p", { className: "m-0 mt-1 text-[11px] text-muted flex-none", children: e("tweak.note") })
  ] });
}
function at({ t: e, preview: t, current: n, onChange: r, reloadKey: o, selectMode: a = !1, frameRef: l }) {
  const h = t.slides.length, c = () => r(Math.max(0, n - 1)), u = () => r(Math.min(h - 1, n + 1));
  return V(() => {
    const v = (p) => {
      const f = p.target;
      f && ["INPUT", "TEXTAREA", "SELECT"].includes(f.tagName) || (p.key === "ArrowLeft" || p.key === "PageUp" ? (p.preventDefault(), c()) : p.key === "ArrowRight" || p.key === "PageDown" ? (p.preventDefault(), u()) : p.key === "Home" ? r(0) : p.key === "End" && r(h - 1));
    };
    return window.addEventListener("keydown", v), () => window.removeEventListener("keydown", v);
  }, [n, h]), h === 0 ? /* @__PURE__ */ s("p", { className: "text-sm text-muted", children: e("deck.summary.no_slides") }) : /* @__PURE__ */ i("div", { className: "flex flex-col gap-2 flex-1", style: { minHeight: 170 }, children: [
    /* @__PURE__ */ i("div", { className: "flex items-center gap-2 text-[12px] text-muted flex-none", children: [
      /* @__PURE__ */ s(M, { onClick: c, disabled: n === 0, "aria-label": e("viewer.prev"), children: "◂" }),
      /* @__PURE__ */ i("span", { className: "tabular-nums", "aria-live": "polite", children: [
        n + 1,
        " / ",
        h
      ] }),
      /* @__PURE__ */ s(M, { onClick: u, disabled: n >= h - 1, "aria-label": e("viewer.next"), children: "▸" }),
      /* @__PURE__ */ s("span", { className: "truncate ml-2", title: t.slides[n], children: t.slides[n] }),
      /* @__PURE__ */ s("span", { className: "ml-auto", children: t.css ? t.css === "tokens.css" ? e("viewer.tokens_theme") : t.css : e("viewer.default_theme") })
    ] }),
    /* @__PURE__ */ s("div", { className: "flex-1 min-h-0 relative", children: /* @__PURE__ */ s(
      Ee,
      {
        src: `${t.baseUrl}/slide/${n}${a ? "?hs=select" : ""}`,
        stageWidth: t.stage.width,
        stageHeight: t.stage.height,
        title: t.slides[n],
        reloadKey: o,
        fit: "contain",
        interactive: a,
        frameRef: l,
        className: "rounded-md border border-border"
      }
    ) })
  ] });
}
const it = ["primary", "secondary", "accent", "canvas-soft", "canvas", "surface", "ink", "hairline"];
function An({ t: e, info: t, onOpenTheme: n }) {
  const r = t.design;
  if (!t.present || !r || t.empty) return null;
  const o = Object.keys(r.colors), a = [...it.filter((c) => c in r.colors), ...o.filter((c) => !it.includes(c))].slice(0, 8), l = o.length - a.length, h = t.tokensExists ? t.tokensStale ? "stale" : "fresh" : "missing";
  return /* @__PURE__ */ i(
    "button",
    {
      type: "button",
      onClick: n,
      className: "mb-2 flex-none flex items-center gap-2 flex-wrap text-[12px] text-muted bg-transparent border-0 p-0 cursor-pointer hover:text-text text-left",
      "data-testid": "theme-row",
      "data-tokens": h,
      title: e("theme.row_hint"),
      children: [
        /* @__PURE__ */ s("span", { className: "font-medium text-text", children: r.name || "DESIGN.md" }),
        /* @__PURE__ */ i("span", { className: "inline-flex items-center gap-1", "aria-label": e("theme.colors"), children: [
          a.map((c) => /* @__PURE__ */ s(
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
          l > 0 && /* @__PURE__ */ i("span", { children: [
            "+",
            l
          ] })
        ] }),
        r.font.family && /* @__PURE__ */ s("span", { className: "truncate", children: r.font.family }),
        h !== "fresh" && /* @__PURE__ */ i("span", { className: "inline-flex items-center gap-1", style: { color: "var(--warn)" }, children: [
          /* @__PURE__ */ s("span", { "aria-hidden": !0, className: "inline-block rounded-full", style: { width: 6, height: 6, background: "var(--warn)" } }),
          e(h === "missing" ? "theme.tokens.missing" : "theme.tokens.stale")
        ] })
      ]
    }
  );
}
function Pn(e) {
  const [t, n] = x("connecting"), [r, o] = x(null), [a, l] = x([]), [h, c] = x([]), [u, v] = x(!1), [p, f] = x(null), [g, I] = x(null), [d, R] = x(null), [y, k] = x(null), [w, _] = x(null), N = h.find((P) => P.id === d) ?? null, A = K(async () => {
    v(!0), f(null);
    try {
      const P = await e.decks();
      l(P.roots), c(P.decks);
    } catch (P) {
      f(P instanceof ee ? P.code : "request_failed");
    } finally {
      v(!1);
    }
  }, [e]);
  V(() => {
    let P = !0, S = null, m = 0;
    const D = async () => {
      if (P)
        try {
          const C = await e.status();
          if (!P) return;
          o(C), n("connected"), await A();
        } catch {
          if (!P) return;
          n(m === 0 ? "connecting" : "error"), m += 1, S = setTimeout(D, Math.min(1e3 * m, 5e3));
        }
    };
    D();
    const E = () => {
      S && (clearTimeout(S), S = null, D());
    };
    return window.addEventListener("focus", E), () => {
      P = !1, S && clearTimeout(S), window.removeEventListener("focus", E);
    };
  }, [e, A]), V(() => {
    if (t !== "connected") return;
    const P = setInterval(() => {
      document.visibilityState === "visible" && e.decks().then((S) => {
        l(S.roots), c((m) => JSON.stringify(m.map((D) => [D.id, D.slideCount, D.modifiedAt])) === JSON.stringify(S.decks.map((D) => [D.id, D.slideCount, D.modifiedAt])) ? m : S.decks);
      }).catch(() => {
      });
    }, 1e4);
    return () => clearInterval(P);
  }, [e, t]);
  const W = K(
    async (P) => {
      f(null), I(null), v(!0);
      try {
        if (P) {
          const S = await e.addRoot(P);
          l(S.roots);
        } else {
          const S = await e.pickStart();
          let m = S;
          for (; m.state === "pending"; )
            await new Promise((D) => setTimeout(D, 700)), m = await e.pickStatus(S.id);
          if (m.state === "cancelled") return;
          if (m.state === "error") throw new ee(m.error ?? "folder_chooser_failed", m.detail);
          l(m.roots ?? []);
        }
      } catch (S) {
        f(S instanceof ee ? S.code : "request_failed"), I(S instanceof ee ? S.message : String(S));
        return;
      } finally {
        v(!1);
      }
      await A();
    },
    [e, A]
  ), j = K(
    async (P) => {
      f(null), v(!0);
      try {
        const S = await e.removeRoot(P);
        l(S.roots), c((m) => m.filter((D) => D.root !== P)), N && N.root === P && R(null);
      } catch (S) {
        f(S instanceof ee ? S.code : "request_failed");
        return;
      } finally {
        v(!1);
      }
      await A();
    },
    [e, A, N]
  );
  return {
    conn: t,
    status: r,
    roots: a,
    decks: h,
    setDecks: c,
    loading: u,
    error: p,
    errorDetail: g,
    selectedId: d,
    selected: N,
    decksForce: y,
    slidesForce: w,
    refresh: A,
    addRoot: W,
    removeRoot: j,
    selectDeck: (P) => {
      R(P.id), k(!1), _(!0), setTimeout(() => {
        k(null), _(null);
      }, 0);
    }
  };
}
function On(e) {
  const [t, n] = Ae("notes", !1), [r, o] = x(null), [a, l] = x(0);
  V(() => {
    o(null);
  }, [e]);
  const h = be(() => new Set((r == null ? void 0 : r.withNotes) ?? []), [r]), c = K(() => {
    o(null), l((v) => v + 1);
  }, []), u = K(() => l((v) => v + 1), []);
  return { notesOpen: t, setNotesOpen: n, notesIndex: r, setNotesIndex: o, notesRefresh: a, withNotes: h, invalidate: c, bump: u };
}
function Mn({ client: e, selected: t, setDecks: n, onExternalChange: r }) {
  const [o, a] = x(null), [l, h] = x(null), [c, u] = x(0), [v, p] = x(0), f = K(() => p((_) => _ + 1), []), [g, I] = x("slides"), [d, R] = x(0), y = Z(/* @__PURE__ */ new Map()), k = Z(null);
  V(() => {
    if (!t) {
      a(null);
      return;
    }
    let _ = !0;
    const N = t.path;
    return a(null), h(null), u(0), e.previewStart(N).then((A) => _ && a(A)).catch((A) => _ && h(A instanceof ee ? A.code : "request_failed")), () => {
      _ = !1, e.previewStop(N).catch(() => {
      });
    };
  }, [e, t == null ? void 0 : t.path]), V(() => {
    const _ = (N) => {
      var W;
      const A = N.data;
      !A || A.type !== "hs-slide" || typeof A.index != "number" || N.source === ((W = k.current) == null ? void 0 : W.contentWindow) && u(A.index);
    };
    return window.addEventListener("message", _), () => window.removeEventListener("message", _);
  }, []), V(() => {
    I("slides");
  }, [t == null ? void 0 : t.path]);
  const w = K(async () => {
    if (!(!t || !o))
      try {
        const _ = await e.previewStart(t.path), N = _.slides.length !== o.slides.length || _.slides.some((W, j) => W !== o.slides[j]), A = _.modifiedAt !== void 0 && o.modifiedAt !== void 0 && _.modifiedAt > o.modifiedAt;
        (N || A || _.css !== o.css) && (a(_), p((W) => W + 1), R((W) => W + 1), r(), N && (n((W) => W.map((j) => j.id === t.id ? { ...j, slideCount: _.slides.length, slides: _.slides } : j)), u((W) => Math.min(W, Math.max(0, _.slides.length - 1)))));
      } catch {
      }
  }, [e, t, o, n, r]);
  return V(() => {
    if (!t || !o) return;
    const _ = setInterval(() => {
      document.visibilityState === "visible" && w();
    }, 2500);
    return () => clearInterval(_);
  }, [t, o, w]), {
    preview: o,
    setPreview: a,
    previewError: l,
    setPreviewError: h,
    current: c,
    setCurrent: u,
    reloadKey: v,
    bumpReload: f,
    viewMode: g,
    setViewMode: I,
    externalChanges: d,
    draftsRef: y,
    outputFrameRef: k,
    syncDeck: w
  };
}
function Ln({ client: e, selected: t, preview: n, externalChanges: r, t: o, setViewMode: a, setCurrent: l, bumpReload: h }) {
  const [c, u] = x(null), [v, p] = x(!1), [f, g] = x(null), [I, d] = x(null), [R, y] = x(() => {
    try {
      return JSON.parse(localStorage.getItem("hs.scriptIgnored") || "[]");
    } catch {
      return [];
    }
  });
  V(() => localStorage.setItem("hs.scriptIgnored", JSON.stringify(R)), [R]), V(() => {
    if (g(null), d(null), !t) {
      u(null);
      return;
    }
    let E = !0;
    return e.buildInfo(t.path).then((C) => E && u(C)).catch((C) => {
      console.warn("[html-studio] build/info failed", C), E && u(null);
    }), () => {
      E = !1;
    };
  }, [e, t == null ? void 0 : t.path]), V(() => {
    !t || !r || e.buildInfo(t.path).then(u).catch(() => {
    });
  }, [e, t == null ? void 0 : t.path, r]);
  const k = K(
    async (E) => {
      if (!E || !("ok" in E || "job" in E)) return null;
      if ("ok" in E) return E;
      for (; ; ) {
        await new Promise((B) => setTimeout(B, 1e3));
        const C = await e.buildStatus(E.job);
        if (C.state === "done" && C.result) return C.result;
        if (C.state === "error") return { ok: !1, mode: "external", stderr: C.detail || C.error || "build_failed" };
      }
    },
    [e]
  ), w = K(
    (E, C) => {
      !E || "skipped" in E || ("job" in E && p(!0), k(E).then((B) => {
        B && (g(B), B.ok && h(), e.buildInfo(C).then(u).catch(() => {
        }));
      }).finally(() => p(!1)));
    },
    [k, e, h]
  ), _ = K(
    async (E = !1) => {
      if (t) {
        p(!0), d(null);
        try {
          const C = await e.build(t.path, E);
          if ("ok" in C && C.needsTrust && C.command) {
            d(C.command);
            return;
          }
          const B = await k(C);
          g(B), B.ok && setTimeout(() => g((L) => L === B ? null : L), 8e3), h();
          const T = await e.buildInfo(t.path);
          u(T), B.ok && B.output && a("output");
        } catch (C) {
          g({ ok: !1, mode: "external", stderr: C instanceof ee ? C.code : "request_failed" });
        } finally {
          p(!1);
        }
      }
    },
    [e, t, k, h, a]
  ), N = K(() => {
    t && e.buildAdopt(t.path).then((E) => (u(E), _(!1))).catch(() => {
    });
  }, [e, t, _]), A = K(() => {
    t && y((E) => [...E, t.path]);
  }, [t]), W = t && (c != null && c.script) && c.suggestedCommand && !c.command && !R.includes(t.path) ? { script: c.script, command: c.suggestedCommand } : null, j = (E) => {
    if (!n) return;
    const C = n.slides.indexOf(E);
    C >= 0 && (a("slides"), l(C));
  }, b = n && (c != null && c.outputExists) ? `${n.baseUrl}/${c.output}` : null, P = !n || !c || n.slides.length === 0 ? null : c.command ? b : `${n.baseUrl}/show`, S = !!(c != null && c.command && c.outputExists && c.outputStale), m = !!t && !!n && n.slides.length > 0 && !v && ((c == null ? void 0 : c.buildable) ?? !1), D = t ? c ? c.buildable ? c.builtin ? o("build.mode.builtin") : c.command ?? "" : o("build.hint.single_file") : o("build.hint.loading") : "";
  return {
    buildInfo: c,
    building: v,
    buildResult: f,
    setBuildResult: g,
    pendingCommand: I,
    setPendingCommand: d,
    runBuild: _,
    showRebuild: w,
    adoptScript: N,
    ignoreScript: A,
    scriptOffer: W,
    openIssue: j,
    outputUrl: b,
    showUrl: P,
    outputStale: S,
    canBuild: m,
    buildHint: D
  };
}
function Fn({ api: e, selected: t, preview: n, buildInfo: r, current: o, locale: a, t: l, bumpReload: h, bumpNotes: c }) {
  const [u, v] = Ae("chat", !1), [p, f] = x(0), g = K(() => f((R) => R + 1), []), I = K(
    async (R, y, k) => {
      const { key: w } = await ut(e, { deck: R, preview: (k == null ? void 0 : k.preview) ?? n, build: (k == null ? void 0 : k.build) ?? r, language: a }, l("chat.title", { name: R.name }));
      return await e.post("/api/chat?ws=1", { message: y, slot: w, agent: "" }), w;
    },
    [e, n, r, a, l]
  ), d = K(
    async (R) => {
      if (!t || !n) return;
      const y = n.slides[o] ?? String(o + 1), k = t.kind === "single" ? t.entry ?? y : `${t.slidesDir}/${y}`, w = `notes/${y.replace(/\.html?$/i, "").replace(/#/g, "-")}.md`, _ = _n(R, {
        slideFile: k,
        slideNumber: o + 1,
        slideCount: n.slides.length,
        notesFile: w,
        language: a,
        hasDesignMd: t.hasDesignMd
      });
      await I(t, _), g(), v(!0), (R === "tighten" || R === "draft-next") && setTimeout(h, 8e3), R === "notes" && setTimeout(c, 8e3);
    },
    [t, n, o, a, I, g, v, h, c]
  );
  return { chatOpen: u, setChatOpen: v, chatRefresh: p, bumpChat: g, post: I, runQuickAction: d };
}
function bt(e, t, n) {
  const r = t.slides[n] ?? String(n + 1);
  return (e == null ? void 0 : e.kind) === "single" ? e.entry ?? r : `${(e == null ? void 0 : e.slidesDir) ?? "slides"}/${r}`;
}
function qn({ client: e, selected: t, preview: n, current: r, locale: o, setCurrent: a, setViewMode: l, bumpReload: h, postToChat: c, bumpChat: u }) {
  const [v, p] = x(!1), [f, g] = x([]), [I, d] = x(null), R = Z(null), y = K((T) => {
    R.current = T;
  }, []);
  V(() => {
    p(!1), d(null), g(t ? dn(t.path) : []);
  }, [t == null ? void 0 : t.path]), V(() => {
    t && un(t.path, f);
  }, [f, t == null ? void 0 : t.path]);
  const k = K(() => {
    var O;
    const T = (O = R.current) == null ? void 0 : O.contentWindow;
    if (!T) return;
    const L = f.filter((z) => z.slideIndex === r).map((z) => ({ id: z.id, index: z.index, status: z.status, cid: z.cid, selector: z.selector, rect: z.rect, comment: z.comment }));
    T.postMessage({ type: "hs-pins", pins: L }, "*");
  }, [f, r]);
  V(() => {
    v && k();
  }, [k, v]), V(() => {
    const T = (L) => {
      var z;
      if (L.source !== ((z = R.current) == null ? void 0 : z.contentWindow)) return;
      const O = L.data;
      if (!(!O || typeof O.type != "string")) {
        if (O.type === "hs-select-ready")
          k();
        else if (O.type === "hs-capture" && typeof O.selector == "string" && n) {
          const X = O, J = bt(t, n, X.slideIndex);
          g((Q) => {
            const te = Q.reduce((ie, re) => Math.max(ie, re.index), 0) + 1, fe = ht(X, J, te);
            return d(fe.id), [...Q, fe];
          });
        } else if (O.type === "hs-anchored" && Array.isArray(O.pins)) {
          const X = new Map(O.pins.map((J) => [J.id, J.how]));
          g((J) => J.some((Q) => X.has(Q.id) && Q.how !== X.get(Q.id)) ? J.map((Q) => X.has(Q.id) ? { ...Q, how: X.get(Q.id) } : Q) : J);
        }
      }
    };
    return window.addEventListener("message", T), () => window.removeEventListener("message", T);
  }, [n, k, t == null ? void 0 : t.kind, t == null ? void 0 : t.entry, t == null ? void 0 : t.slidesDir]);
  const w = K((T, L) => g((O) => O.map((z) => z.id === T ? { ...z, comment: L } : z)), []), _ = K((T) => g((L) => L.filter((O) => O.id !== T)), []), N = K(
    (T, L) => {
      a(T), d(L), l("slides");
    },
    [a, l]
  ), [A, W] = x(!1), [j, b] = x(null), [P, S] = x(0), m = K(async () => {
    if (!t || A) return;
    const T = f.filter((O) => O.status === "new" && O.comment.trim());
    if (!T.length) return;
    const L = T.slice(0, ve);
    W(!0), b(null);
    try {
      const O = await e.pinsSend(t.path, L, o);
      await c(t, O.prompt);
      const z = new Map(O.comments.map((X) => [X.pinId, X.cid]));
      g((X) => X.map((J) => z.has(J.id) ? { ...J, status: "sent", batchId: O.id, batchCid: z.get(J.id), thread: [] } : J)), S(T.length - L.length), u();
    } catch (O) {
      b(O instanceof ee ? O.code : O instanceof Error ? O.message : "request_failed");
    } finally {
      W(!1);
    }
  }, [e, t, f, A, o, c, u]);
  V(() => S(0), [t == null ? void 0 : t.path]);
  const D = f.some((T) => T.status === "sent");
  V(() => {
    if (!t || !D) return;
    let T = !0;
    const L = async () => {
      try {
        const { batches: z } = await e.pinsQueue(t.path);
        if (!T) return;
        const X = new Map(z.flatMap((Q) => Q.comments.map((te) => [te.cid, { c: te, state: Q.state }])));
        let J = !1;
        g((Q) => {
          let te = !1;
          const fe = Q.map((ie) => {
            const re = ie.batchCid ? X.get(ie.batchCid) : void 0;
            return !re || re.c.status === ie.status ? ie : (te = !0, (re.c.status === "done" || re.c.status === "question") && (J = J || re.state === "done"), { ...ie, status: re.c.status, thread: re.c.thread });
          });
          return te ? fe : Q;
        }), J && h();
      } catch (z) {
        console.warn("[html-studio] pins/queue failed", z);
      }
    };
    L();
    const O = setInterval(L, 3e3);
    return () => {
      T = !1, clearInterval(O);
    };
  }, [e, t == null ? void 0 : t.path, D]);
  const E = K(
    async (T, L) => {
      const O = f.find((z) => z.id === T);
      if (!(!t || !(O != null && O.batchCid) || !O.batchId))
        try {
          await e.pinsReply(t.path, O.batchId, O.batchCid, L);
          const z = `Re pin [${O.batchCid}] (${O.slideFile} > ${O.selector}): ${L}
Continue with that comment and report again with report.py (--cid ${O.batchCid}).`;
          await c(t, z), g((X) => X.map((J) => J.id === T ? { ...J, status: "sent", thread: [...J.thread ?? [], { role: "user", text: L, ts: Date.now() }] } : J));
        } catch (z) {
          b(z instanceof ee ? z.code : z instanceof Error ? z.message : "request_failed");
        }
    },
    [e, t, f, c]
  ), C = K(() => {
    const T = new Set(f.filter((L) => L.status === "done" && L.batchId).map((L) => L.batchId));
    if (g((L) => L.filter((O) => O.status !== "done")), t)
      for (const L of T)
        f.some((O) => O.batchId === L && O.status !== "done") || e.pinsDismiss(t.path, L).catch(() => {
        });
  }, [f, t, e]), B = be(() => new Set(f.map((T) => T.issueKey).filter((T) => !!T)), [f]);
  return {
    selectMode: v,
    setSelectMode: p,
    pins: f,
    setPins: g,
    activePin: I,
    setViewerFrame: y,
    updatePinComment: w,
    removePin: _,
    jumpToPin: N,
    sending: A,
    sendError: j,
    sendLeft: P,
    sendPins: m,
    replyToPin: E,
    dismissDone: C,
    pinnedIssues: B
  };
}
function jn({ client: e, selected: t, preview: n, t: r, setPins: o, pinnedIssues: a }) {
  const [l, h] = x(null), [c, u] = x(null), [v, p] = x(null);
  V(() => {
    h(null), u(null), p(null);
  }, [t == null ? void 0 : t.path]);
  const f = K(async () => {
    if (!(!t || (l == null ? void 0 : l.state) === "running")) {
      p(null), u(null);
      try {
        const y = await e.checkStart(t.path);
        h(y);
      } catch (y) {
        p(y instanceof ee ? y.code : "request_failed");
      }
    }
  }, [e, t, l == null ? void 0 : l.state]);
  V(() => {
    if (!l || l.state !== "running") return;
    let y = !0;
    const k = setInterval(async () => {
      try {
        const w = await e.checkStatus(l.id);
        if (!y || w.state === "running") return;
        h(w), w.state === "done" && w.result ? u(w.result) : p(w.error ?? "check_failed");
      } catch (w) {
        if (!y) return;
        h(null), p(w instanceof ee ? w.code : "request_failed");
      }
    }, 700);
    return () => {
      y = !1, clearInterval(k);
    };
  }, [e, l == null ? void 0 : l.id, l == null ? void 0 : l.state]);
  const g = K(
    (y) => {
      if (!n) return;
      const k = Te(y), w = bt(t, n, y.slideIndex), _ = {
        slideIndex: y.slideIndex,
        cid: null,
        selector: y.selector,
        tag: y.tag,
        elementId: null,
        classes: y.classes,
        text: y.text,
        rect: y.rect ?? { x: 0, y: 0, w: 0, h: 0 },
        src: y.src ?? null
      }, N = `check.fixcomment.${y.rule}`, A = r(N) === N ? r(`check.rule.${y.rule}`) : r(N);
      o((W) => {
        if (W.some((P) => P.issueKey === k)) return W;
        const j = W.reduce((P, S) => Math.max(P, S.index), 0) + 1, b = ht(_, w, j);
        return [...W, { ...b, comment: y.detail ? `${A} (${y.detail})` : A, issueKey: k }];
      });
    },
    [n, t == null ? void 0 : t.kind, t == null ? void 0 : t.entry, t == null ? void 0 : t.slidesDir, r, o]
    // eslint-disable-line react-hooks/exhaustive-deps
  ), [I, d] = x(0);
  V(() => d(0), [c]);
  const R = K(
    (y) => {
      if (!c) return;
      const k = c.issues.filter((_) => !a.has(Te(_))), w = Math.max(0, ve - y);
      for (const _ of k.slice(0, w)) g(_);
      d(Math.max(0, k.length - w));
    },
    [c, a, g]
  );
  return { checkJob: l, checkResult: c, setCheckResult: u, checkError: v, runCheck: f, fixIssue: g, fixAllIssues: R, pinAllLeft: I };
}
function Bn({ client: e, selected: t, preview: n, current: r, setPreview: o, setDecks: a, setCurrent: l, bumpReload: h, invalidateNotes: c, showRebuild: u }) {
  const [v, p] = x(!1), [f, g] = x(null), [I, d] = x([]), [R, y] = x(!1);
  V(() => {
    if (d([]), g(null), !t) return;
    let b = !0;
    return e.slidesArchiveList(t.path).then((P) => b && d(P.items)).catch(() => {
    }), () => {
      b = !1;
    };
  }, [e, t == null ? void 0 : t.path]);
  const k = K(
    (b, P) => {
      if (o((S) => S && { ...S, slides: b.slides }), t && a((S) => S.map((m) => m.id === t.id ? { ...m, slideCount: b.slides.length } : m)), h(), c(), P) {
        const S = b.slides.indexOf(P);
        S >= 0 && l(S);
      } else l((S) => Math.min(S, Math.max(0, b.slides.length - 1)));
      t && u(b.rebuild, t.path), t && e.slidesArchiveList(t.path).then((S) => d(S.items)).catch(() => {
      });
    },
    [e, t, u, o, a, l, h, c]
  ), w = K(
    async (b, P = !0) => {
      p(!0), g(null);
      try {
        const S = await b();
        k(S, P ? S.name : void 0);
      } catch (S) {
        g(S instanceof ee ? S.code : "request_failed");
      } finally {
        p(!1);
      }
    },
    [k]
  ), [_, N] = x(null);
  V(() => {
    N(null);
  }, [t == null ? void 0 : t.path]);
  const A = be(
    () => t ? {
      busy: v,
      onAdd: (b) => N({ mode: "insert", after: b }),
      onDuplicate: (b) => void w(() => e.slidesAdd(t.path, b, !0)),
      onSaveLayout: (b) => N({ mode: "save", after: b, slide: b }),
      onReorder: (b) => {
        const P = n == null ? void 0 : n.slides[r], S = P ? b.indexOf(P) : -1;
        w(async () => {
          const m = await e.slidesReorder(t.path, b);
          return { ...m, name: S >= 0 ? m.slides[S] : void 0 };
        });
      },
      onArchive: (b) => void w(() => e.slidesArchive(t.path, b), !1)
    } : void 0,
    [t, v, n, r, w, e]
  ), W = K(
    (b) => {
      t && w(() => e.slidesRestore(t.path, b, (n == null ? void 0 : n.slides[r]) ?? null));
    },
    [e, t, n, r, w]
  ), j = K(
    (b, P) => {
      t && (N(null), w(() => e.slidesAdd(t.path, P, !1, b)));
    },
    [e, t, w]
  );
  return { arrangeBusy: v, arrangeError: f, archived: I, archiveOpen: R, setArchiveOpen: y, arrangeActions: A, restore: W, picker: _, setPicker: N, insertLayout: j };
}
function Hn({ client: e, selected: t, setPreview: n, setPreviewError: r, bumpReload: o }) {
  const [a, l] = x(null), [h, c] = x(!1), [u, v] = x(!1);
  V(() => {
    if (!t || !t.hasDesignMd) {
      l(null);
      return;
    }
    let g = !0;
    return e.design(t.path).then((I) => g && l(I)).catch((I) => {
      console.warn("[html-studio] design failed", I), g && l(null);
    }), () => {
      g = !1;
    };
  }, [e, t == null ? void 0 : t.path, t == null ? void 0 : t.hasDesignMd]);
  const p = K(async () => {
    if (t) {
      c(!0);
      try {
        const g = await e.writeTokens(t.path);
        l(g);
        const I = await e.previewStart(t.path);
        n(I), o();
      } catch (g) {
        r(g instanceof ee ? g.code : "request_failed");
      } finally {
        c(!1);
      }
    }
  }, [e, t, n, r, o]), f = K(() => {
    t && (o(), e.previewStart(t.path).then(n).catch(() => {
    }), e.design(t.path).then(l).catch(() => {
    }));
  }, [e, t, n, o]);
  return { designInfo: a, tokensBusy: h, tweakOpen: u, setTweakOpen: v, writeTokens: p, onApplied: f };
}
function zn(e, t) {
  const [n, r] = x(null), [o, a] = x(null);
  V(() => {
    r(null), a(null);
  }, [t == null ? void 0 : t.path]);
  const l = K(async () => {
    if (t) {
      a(null);
      try {
        let c = await e.pdfStart(t.path);
        for (r(c); c.state === "running"; )
          await new Promise((u) => setTimeout(u, 1e3)), c = await e.pdfStatus(c.id), r(c);
        c.state === "error" && a(c.error ?? "pdf_failed");
      } catch (c) {
        r(null), a(c instanceof ee ? c.code : "request_failed");
      }
    }
  }, [e, t]), h = K(() => {
    r(null), a(null);
  }, []);
  return { pdf: n, pdfError: o, exportPdf: l, dismiss: h };
}
function lt({ key: e, initial: t, min: n, max: r, fromPointer: o }) {
  const [a, l] = x(() => {
    try {
      const u = Number(localStorage.getItem(e));
      return u >= n && u <= r ? u : t;
    } catch {
      return t;
    }
  }), h = Z(null), c = K(
    (u) => {
      const v = h.current;
      if (!v) return;
      u.preventDefault();
      const p = u.currentTarget;
      p.setPointerCapture(u.pointerId);
      const f = v.getBoundingClientRect(), g = (d) => l(Math.min(r, Math.max(n, o(d, f)))), I = () => {
        p.removeEventListener("pointermove", g), p.removeEventListener("pointerup", I), p.removeEventListener("pointercancel", I), l((d) => {
          try {
            localStorage.setItem(e, String(d));
          } catch {
          }
          return d;
        });
      };
      p.addEventListener("pointermove", g), p.addEventListener("pointerup", I), p.addEventListener("pointercancel", I);
    },
    [e, n, r, o]
  );
  return { ratio: a, boxRef: h, onPointerDown: c };
}
function Un() {
  const e = Z(null), [t, n] = x(0);
  return V(() => {
    const r = e.current;
    if (!r) return;
    const o = new ResizeObserver(() => n(r.getBoundingClientRect().bottom));
    return o.observe(r), n(r.getBoundingClientRect().bottom), () => o.disconnect();
  }, []), { headRef: e, headH: t };
}
function Jn() {
  const e = kn(location.search);
  return e ? /* @__PURE__ */ s(wn, { params: e }) : /* @__PURE__ */ s(Wn, {});
}
function Wn() {
  const e = Ue(), t = be(() => ct(e), [e]), { t: n, locale: r, pref: o, setPref: a } = ft(), { conn: l, status: h, roots: c, decks: u, setDecks: v, loading: p, error: f, errorDetail: g, selectedId: I, selected: d, decksForce: R, slidesForce: y, refresh: k, addRoot: w, removeRoot: _, selectDeck: N } = Pn(t), [A, W] = Ae("sidebar", !0), j = On(d == null ? void 0 : d.path), { preview: b, setPreview: P, previewError: S, setPreviewError: m, current: D, setCurrent: E, reloadKey: C, bumpReload: B, viewMode: T, setViewMode: L, externalChanges: O, draftsRef: z, outputFrameRef: X, syncDeck: J } = Mn({
    client: t,
    selected: d,
    setDecks: v,
    onExternalChange: j.invalidate
  }), Q = Ln({ client: t, selected: d, preview: b, externalChanges: O, t: n, setViewMode: L, setCurrent: E, bumpReload: B }), { buildInfo: te, building: fe, buildResult: ie, pendingCommand: re, runBuild: pe, showRebuild: ue, outputUrl: he, showUrl: F, canBuild: q, buildHint: G } = Q, $ = Fn({ api: e, selected: d, preview: b, buildInfo: te, current: D, locale: r, t: n, bumpReload: B, bumpNotes: j.bump }), H = qn({ client: t, selected: d, preview: b, current: D, locale: r, setCurrent: E, setViewMode: L, bumpReload: B, postToChat: $.post, bumpChat: $.bumpChat }), { selectMode: ne, setSelectMode: le, activePin: ge, setViewerFrame: oe } = H, xe = jn({ client: t, selected: d, preview: b, t: n, setPins: H.setPins, pinnedIssues: H.pinnedIssues }), { checkJob: me, checkResult: Ne, checkError: _e } = xe, Pe = Bn({ client: t, selected: d, preview: b, current: D, setPreview: P, setDecks: v, setCurrent: E, bumpReload: B, invalidateNotes: j.invalidate, showRebuild: ue }), { arrangeBusy: We, arrangeError: Ke, archived: Oe, archiveOpen: Me, setArchiveOpen: kt, arrangeActions: yt, picker: Se, setPicker: wt } = Pe, $e = Hn({ client: t, selected: d, setPreview: P, setPreviewError: m, bumpReload: B }), { designInfo: Le, tweakOpen: Re, setTweakOpen: Fe } = $e, { pdf: se, pdfError: ye, exportPdf: Nt, dismiss: _t } = zn(t, d), Ct = lt({ key: "hs.chatRatio", initial: 0.4, min: 0.15, max: 0.8, fromPointer: (U, de) => (de.bottom - U.clientY) / de.height }), St = lt({ key: "hs.codeRatio", initial: 0.45, min: 0.15, max: 0.75, fromPointer: (U, de) => (U.clientY - de.top) / de.height }), { ratio: Ge, boxRef: $t, onPointerDown: Rt } = Ct, { ratio: Ve, boxRef: It, onPointerDown: Dt } = St, { headRef: Tt, headH: Ye } = Un(), [Et, Qe] = x(!1), [ke, Je] = x(null), At = K(() => {
    if (!d || !F || !b) return;
    if (ke && !ke.closed) {
      ke.focus();
      return;
    }
    const U = yn({ deck: d.path, url: F, base: b.baseUrl, slide: D + 1, count: b.slides.length }), de = Math.min(1280, Math.round((screen.availWidth || 1280) * 0.8)), ce = Math.round(de * 9 / 16) + 40, Ce = window.open(U, "hs-show", `popup=yes,width=${de},height=${ce},resizable=yes`);
    if (!Ce) {
      Qe(!0);
      return;
    }
    try {
      Ce.focus();
    } catch {
    }
    Je(Ce);
  }, [d, F, b, D, ke]);
  V(() => {
    if (!ke || !b) return;
    const U = b.baseUrl, de = setInterval(() => {
      ke.closed && (clearInterval(de), Je(null), fetch(`${U}/present/state`).then((ce) => ce.json()).then((ce) => {
        typeof ce.index == "number" && E(ce.index);
      }).catch(() => {
      }));
    }, 1e3);
    return () => clearInterval(de);
  }, [ke, b, E]);
  const qe = !!ke && !ke.closed, [Pt, je] = x(!1), Ot = K(
    async (U, de, ce) => {
      if (je(!1), await k(), N(U), !!de)
        try {
          const Ce = r.startsWith("ko") ? "Korean" : "English", Ft = [
            "This deck was just created with the new deck wizard. brief.md in the deck folder holds the same answers.",
            `Title: ${ce.title}`,
            ce.presenter ? `Presenter: ${ce.presenter}` : "",
            ce.purpose ? `Purpose: ${ce.purpose}` : "",
            ce.audience ? `Audience: ${ce.audience}` : "",
            ce.sources ? `Source material:
${ce.sources}` : "",
            "",
            `Propose an outline for this deck as a numbered list of slide titles with one line each on what the slide shows (answer in ${Ce}). Do not create files yet; wait for my go-ahead.`
          ].filter((qt) => qt !== "").join(`
`);
          await $.post(U, Ft, { preview: null, build: null }), $.setChatOpen(!0);
        } catch {
        }
    },
    [k, r, $]
    // eslint-disable-line react-hooks/exhaustive-deps
  ), Mt = n(l === "connecting" ? "status.connecting" : l === "connected" ? "status.connected" : "status.error"), Lt = A ? "minmax(200px, 1fr) minmax(320px, 4fr)" : "36px minmax(320px, 4fr)";
  return /* @__PURE__ */ i("div", { className: "flex flex-col min-h-0", lang: r, children: [
    /* @__PURE__ */ i("div", { ref: Tt, children: [
      /* @__PURE__ */ s(Ht, { title: n("app.title"), subtitle: n("app.subtitle") }),
      /* @__PURE__ */ i("div", { className: "px-6 pb-3 flex items-center gap-3 text-[12px] flex-wrap", children: [
        /* @__PURE__ */ i("span", { className: "inline-flex items-center gap-2 text-muted", role: "status", "aria-live": "polite", children: [
          /* @__PURE__ */ s(Kn, { conn: l }),
          Mt,
          h ? ` · ${n("footer.version")} ${h.version}` : "",
          " · ui 0828"
        ] }),
        /* @__PURE__ */ i("div", { className: "ml-auto inline-flex items-center gap-1", role: "group", "aria-label": n("lang.label"), children: [
          /* @__PURE__ */ s("span", { className: "text-muted mr-1", children: n("lang.label") }),
          ["auto", ...gn].map((U) => /* @__PURE__ */ s(M, { active: o === U, "aria-pressed": o === U, onClick: () => a(U), children: U === "auto" ? n("lang.auto") : U.toUpperCase() }, U))
        ] })
      ] })
    ] }),
    /* @__PURE__ */ i(
      "div",
      {
        className: "hs-grid px-6 pb-6 grid gap-3",
        style: {
          gridTemplateColumns: Lt,
          gridAutoRows: "minmax(0, 1fr)",
          height: Ye ? `calc(100dvh - ${Math.round(Ye)}px)` : void 0,
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
          A ? /* @__PURE__ */ s("div", { className: "min-h-0 flex flex-col", children: /* @__PURE__ */ s(Ie, { children: /* @__PURE__ */ i("div", { className: "flex flex-col min-h-0 hs-fill", children: [
            /* @__PURE__ */ s("div", { className: "flex items-center justify-end -mt-1 -mr-1 flex-none", children: /* @__PURE__ */ s(M, { onClick: () => W(!1), "aria-label": n("sidebar.collapse"), title: n("sidebar.collapse"), children: "◂" }) }),
            /* @__PURE__ */ s(
              rt,
              {
                id: "decks",
                title: n("panel.decks"),
                badge: u.length ? `(${u.length})` : void 0,
                forceOpen: R,
                grow: !d,
                children: /* @__PURE__ */ s(
                  ln,
                  {
                    t: n,
                    locale: r,
                    roots: c,
                    decks: u,
                    selectedId: I,
                    loading: p,
                    error: f,
                    errorDetail: g,
                    pickerSupported: (h == null ? void 0 : h.pickerSupported) ?? /Mac/i.test(navigator.platform),
                    connected: l === "connected",
                    onSelect: N,
                    onAddRoot: w,
                    onRemoveRoot: _,
                    onRefresh: async () => {
                      await k(), await J();
                    },
                    onNew: () => je(!0)
                  }
                )
              }
            ),
            /* @__PURE__ */ s("div", { className: "my-2 border-t border-border flex-none" }),
            /* @__PURE__ */ s(
              rt,
              {
                id: "slides",
                title: n("panel.slides"),
                badge: d ? `(${d.slideCount})` : void 0,
                defaultOpen: !1,
                forceOpen: y,
                grow: !0,
                children: d ? b ? b.slides.length ? /* @__PURE__ */ i(we, { children: [
                  /* @__PURE__ */ s(Sn, { t: n, preview: b, current: D, onSelect: E, reloadKey: C, withNotes: j.withNotes, notesLabel: n("strip.has_notes"), arrange: yt }),
                  Ke && /* @__PURE__ */ s("p", { className: "m-0 mt-2 text-[12px]", role: "alert", style: { color: "var(--danger)" }, children: n("error.generic", { code: Ke }) }),
                  Oe.length > 0 && /* @__PURE__ */ i("div", { className: "mt-3 text-[12px]", "data-testid": "archive-list", children: [
                    /* @__PURE__ */ i(
                      "button",
                      {
                        type: "button",
                        onClick: () => kt((U) => !U),
                        "aria-expanded": Me,
                        className: "w-full text-left bg-transparent border-0 p-0 cursor-pointer text-muted hover:text-text",
                        children: [
                          Me ? "▾" : "▸",
                          " ",
                          n("strip.archive_box", { n: Oe.length })
                        ]
                      }
                    ),
                    Me && /* @__PURE__ */ s("ul", { className: "m-0 mt-1 p-0 list-none flex flex-col gap-1", children: Oe.map((U) => /* @__PURE__ */ i("li", { className: "flex items-center gap-2", children: [
                      /* @__PURE__ */ s("span", { className: "truncate flex-1 text-muted", title: U.file, children: U.name }),
                      /* @__PURE__ */ s(
                        M,
                        {
                          disabled: We,
                          onClick: () => Pe.restore(U.name),
                          title: n("strip.restore_hint"),
                          children: n("strip.restore")
                        }
                      )
                    ] }, U.name)) })
                  ] })
                ] }) : /* @__PURE__ */ s("p", { className: "m-0 text-[12px] text-muted", children: n("deck.summary.no_slides") }) : S ? /* @__PURE__ */ s("p", { className: "m-0 text-[12px]", style: { color: "var(--danger)" }, children: n("error.generic", { code: S }) }) : /* @__PURE__ */ i("p", { className: "m-0 text-[12px] text-muted inline-flex items-center gap-2", children: [
                  /* @__PURE__ */ s(ae, {}),
                  " ",
                  n("viewer.loading")
                ] }) : /* @__PURE__ */ s("p", { className: "m-0 text-[12px] text-muted", children: n("panel.slides.empty") })
              }
            )
          ] }) }) }) : /* @__PURE__ */ s("div", { className: "flex flex-col items-center pt-2", children: /* @__PURE__ */ s(M, { onClick: () => W(!0), "aria-label": n("sidebar.expand"), title: n("sidebar.expand"), children: "▸" }) }),
          /* @__PURE__ */ i("div", { ref: $t, className: "hs-right min-h-0 flex flex-col", children: [
            /* @__PURE__ */ s("div", { className: "hs-right-preview min-h-0 flex flex-col", style: { flex: "1 1 0" }, children: /* @__PURE__ */ s(Ie, { children: /* @__PURE__ */ i("div", { className: "hs-fill min-h-0 flex flex-col", children: [
              /* @__PURE__ */ i("div", { className: "flex items-center justify-between gap-2 mb-2 flex-wrap flex-none", children: [
                /* @__PURE__ */ s(zt, { children: d ? d.name : n("panel.preview") }),
                /* @__PURE__ */ i("div", { className: "flex gap-3 flex-wrap items-center", children: [
                  /* @__PURE__ */ i("div", { className: "flex gap-1 items-center", role: "group", "aria-label": n("toolbar.group_view"), children: [
                    b && /* @__PURE__ */ s("div", { className: "inline-flex rounded-md border border-border overflow-hidden mr-1", role: "group", "aria-label": n("view.label"), children: (he ? ["slides", "output", "code"] : ["slides", "code"]).map((U) => /* @__PURE__ */ s(
                      "button",
                      {
                        type: "button",
                        onClick: () => L(U),
                        "aria-pressed": T === U,
                        className: "px-2 py-0.5 text-[12px] cursor-pointer border-0",
                        style: {
                          background: T === U ? "var(--bg-hover)" : "transparent",
                          color: T === U ? "var(--accent)" : "var(--muted)",
                          fontWeight: T === U ? 600 : 400
                        },
                        children: n(`view.${U}`)
                      },
                      U
                    )) }),
                    /* @__PURE__ */ s(
                      M,
                      {
                        onClick: () => le((U) => !U),
                        active: ne,
                        "aria-pressed": ne,
                        disabled: !b || T !== "slides",
                        title: n("select.hint"),
                        children: n("toolbar.select")
                      }
                    ),
                    /* @__PURE__ */ s(M, { onClick: () => Fe((U) => !U), active: Re, "aria-pressed": Re, disabled: !d || !b, title: n("toolbar.tweak_hint"), "data-testid": "toolbar-tweak", children: n("toolbar.tweak") })
                  ] }),
                  /* @__PURE__ */ i("div", { className: "flex gap-1 items-center", role: "group", "aria-label": n("toolbar.group_actions"), children: [
                    /* @__PURE__ */ i(
                      M,
                      {
                        onClick: () => pe(!1),
                        disabled: !q,
                        className: "inline-flex items-center gap-1.5",
                        title: G,
                        children: [
                          fe && /* @__PURE__ */ s(ae, {}),
                          n("toolbar.build")
                        ]
                      }
                    ),
                    /* @__PURE__ */ i(
                      M,
                      {
                        onClick: () => void xe.runCheck(),
                        disabled: !b || (me == null ? void 0 : me.state) === "running",
                        title: n("check.hint"),
                        className: "inline-flex items-center gap-1.5",
                        children: [
                          (me == null ? void 0 : me.state) === "running" && /* @__PURE__ */ s(ae, {}),
                          (me == null ? void 0 : me.state) === "running" && b ? n("check.running", { n: b.slides.length }) : n("toolbar.check")
                        ]
                      }
                    ),
                    /* @__PURE__ */ i(
                      M,
                      {
                        onClick: () => void Nt(),
                        disabled: !b || (se == null ? void 0 : se.state) === "running",
                        title: n("pdf.hint"),
                        className: "inline-flex items-center gap-1.5",
                        children: [
                          (se == null ? void 0 : se.state) === "running" && /* @__PURE__ */ s(ae, {}),
                          n("toolbar.pdf")
                        ]
                      }
                    ),
                    /* @__PURE__ */ s(M, { active: !0, onClick: At, disabled: !F, title: n(qe ? "present.open_hint" : F ? "present.hint" : "present.need_output"), "aria-pressed": qe, children: n(qe ? "toolbar.presenting" : "toolbar.present") })
                  ] })
                ] })
              ] }),
              d && ((se == null ? void 0 : se.state) === "done" || ye) && /* @__PURE__ */ i(
                "div",
                {
                  className: "mb-2 flex-none rounded-md border p-2 text-[12px] flex items-center gap-2 flex-wrap",
                  style: { borderColor: ye ? "var(--danger)" : "var(--ok)" },
                  role: "status",
                  children: [
                    ye ? /* @__PURE__ */ i("span", { style: { color: "var(--danger)" }, children: [
                      n(`error.${ye}`) === `error.${ye}` ? n("error.generic", { code: ye }) : n(`error.${ye}`),
                      se != null && se.detail ? /* @__PURE__ */ s("span", { className: "block text-muted break-all", children: se.detail }) : null
                    ] }) : /* @__PURE__ */ i(we, { children: [
                      /* @__PURE__ */ s("span", { style: { color: "var(--ok)" }, children: n("pdf.done", { kb: Math.round(((se == null ? void 0 : se.bytes) ?? 0) / 1024) }) }),
                      /* @__PURE__ */ s("span", { className: "text-muted break-all", children: se == null ? void 0 : se.output }),
                      /* @__PURE__ */ s(M, { onClick: () => (se == null ? void 0 : se.output) && d && void t.reveal(d.path, se.output.slice(d.path.length + 1)), children: n("pdf.reveal") })
                    ] }),
                    /* @__PURE__ */ s(M, { className: "ml-auto", onClick: _t, "aria-label": n("build.dismiss"), children: "✕" })
                  ]
                }
              ),
              d && Le && /* @__PURE__ */ s(An, { t: n, info: Le, onOpenTheme: () => Fe(!0) }),
              d && _e && /* @__PURE__ */ i("div", { className: "mb-2 flex-none rounded-md border p-2 text-[12px] flex flex-wrap items-center gap-2", style: { borderColor: "var(--danger)", color: "var(--danger)" }, role: "alert", children: [
                /* @__PURE__ */ i("span", { className: "flex-1 min-w-0", children: [
                  n("check.failed"),
                  ": ",
                  n(`error.${_e}`) === `error.${_e}` ? n("error.generic", { code: _e }) : n(`error.${_e}`),
                  me != null && me.detail ? /* @__PURE__ */ s("span", { className: "block text-muted break-all", children: me.detail }) : null
                ] }),
                /* @__PURE__ */ s(M, { onClick: () => void xe.runCheck(), "data-testid": "check-retry", children: n("check.retry") })
              ] }),
              d && Ne && /* @__PURE__ */ s(
                Gt,
                {
                  t: n,
                  result: Ne,
                  pinned: H.pinnedIssues,
                  draftCount: H.pins.filter((U) => U.status === "new").length,
                  pinAllLeft: xe.pinAllLeft,
                  onJump: (U) => {
                    E(U), L("slides");
                  },
                  onFix: xe.fixIssue,
                  onFixAll: xe.fixAllIssues,
                  onRerun: () => void xe.runCheck(),
                  onClose: () => xe.setCheckResult(null)
                }
              ),
              d && Q.outputStale && /* @__PURE__ */ i("div", { className: "mb-2 flex-none rounded-md border p-2 text-[12px] flex flex-wrap items-center gap-2", style: { borderColor: "var(--warn)" }, role: "status", "data-testid": "build-stale-notice", children: [
                /* @__PURE__ */ s("span", { className: "flex-1 min-w-0", children: n("build.stale") }),
                /* @__PURE__ */ i(M, { active: !0, onClick: () => pe(!1), disabled: !q, className: "inline-flex items-center gap-1.5", children: [
                  fe && /* @__PURE__ */ s(ae, {}),
                  n("toolbar.build")
                ] })
              ] }),
              d && Q.scriptOffer && /* @__PURE__ */ i("div", { className: "mb-2 flex-none rounded-md border p-3 text-[13px] flex flex-wrap items-center gap-2", style: { borderColor: "var(--border)" }, role: "status", "data-testid": "build-script-notice", children: [
                /* @__PURE__ */ s("span", { className: "flex-1 min-w-0", children: n("build.script.found", { script: Q.scriptOffer.script, command: Q.scriptOffer.command }) }),
                /* @__PURE__ */ s(M, { active: !0, onClick: Q.adoptScript, children: n("build.script.use", { script: Q.scriptOffer.script }) }),
                /* @__PURE__ */ s(M, { onClick: Q.ignoreScript, children: n("build.script.ignore") })
              ] }),
              d && (ie || re) && /* @__PURE__ */ s("div", { className: "mb-2 flex-none overflow-y-auto", style: { maxHeight: "40%" }, children: /* @__PURE__ */ s(
                Kt,
                {
                  t: n,
                  result: ie,
                  pendingCommand: re,
                  onTrust: () => pe(!0),
                  onCancelTrust: () => Q.setPendingCommand(null),
                  onOpenIssue: Q.openIssue,
                  onDismiss: () => Q.setBuildResult(null)
                }
              ) }),
              /* @__PURE__ */ i("div", { className: "flex min-h-0 flex-1", style: { gap: Re ? 12 : 0 }, children: [
                /* @__PURE__ */ s("div", { className: "flex flex-col min-h-0 min-w-0 flex-1", children: d && b ? T === "code" && b.slides[D] ? /* @__PURE__ */ i("div", { ref: It, className: "flex flex-col min-h-0 flex-1", "data-testid": "code-view", children: [
                  /* @__PURE__ */ s("div", { className: "min-w-0 min-h-0 flex flex-col overflow-hidden", style: { flex: `0 0 calc(${Math.round(Ve * 1e3) / 10}% - 6px)` }, children: /* @__PURE__ */ s(at, { t: n, preview: b, current: D, onChange: E, reloadKey: C }) }),
                  /* @__PURE__ */ s(
                    "div",
                    {
                      role: "separator",
                      "aria-orientation": "horizontal",
                      "aria-label": n("split.code_label"),
                      "aria-valuenow": Math.round(Ve * 100),
                      "data-testid": "code-split-handle",
                      onPointerDown: Dt,
                      className: "flex-none flex items-center justify-center",
                      style: { flex: "0 0 12px", height: 12, cursor: "row-resize", touchAction: "none" },
                      children: /* @__PURE__ */ s("div", { className: "rounded-full", style: { flex: "0 0 3px", width: 40, height: 3, background: "var(--border-strong, var(--border))", opacity: 0.8 } })
                    }
                  ),
                  /* @__PURE__ */ s("div", { className: "min-w-0 min-h-0 flex flex-col flex-1 overflow-hidden", children: /* @__PURE__ */ s(
                    on,
                    {
                      t: n,
                      client: t,
                      deckPath: d.path,
                      slide: b.slides[D],
                      slideNumber: D + 1,
                      drafts: z.current,
                      refreshKey: C,
                      onSaved: (U) => {
                        B(), ue(U.rebuild, d.path);
                      }
                    }
                  ) })
                ] }) : T === "output" && he ? /* @__PURE__ */ i("div", { className: "flex flex-col gap-2 min-h-0", children: [
                  /* @__PURE__ */ s("div", { className: "text-[12px] text-muted", children: n("view.output_hint") }),
                  /* @__PURE__ */ s(
                    "div",
                    {
                      className: "w-full rounded-md border border-border overflow-hidden",
                      style: { aspectRatio: "16 / 9", background: "#111" },
                      children: /* @__PURE__ */ s(
                        "iframe",
                        {
                          ref: X,
                          src: `${he}#${D + 1}`,
                          title: (te == null ? void 0 : te.output) ?? "output",
                          sandbox: "allow-scripts allow-same-origin",
                          className: "w-full h-full border-0"
                        },
                        C
                      )
                    }
                  )
                ] }) : /* @__PURE__ */ i(we, { children: [
                  ne && /* @__PURE__ */ s("div", { className: "mb-1 flex-none text-[12px]", style: { color: "var(--accent)" }, role: "status", children: n("select.on_hint") }),
                  /* @__PURE__ */ s(at, { t: n, preview: b, current: D, onChange: E, reloadKey: C, selectMode: ne, frameRef: oe }),
                  /* @__PURE__ */ s(
                    hn,
                    {
                      t: n,
                      pins: H.pins,
                      current: D,
                      activeId: ge,
                      sending: H.sending,
                      sendError: H.sendError,
                      sendLeft: H.sendLeft,
                      onComment: H.updatePinComment,
                      onRemove: H.removePin,
                      onJump: H.jumpToPin,
                      onClearAll: () => H.setPins([]),
                      onSend: () => void H.sendPins(),
                      onReply: (U, de) => void H.replyToPin(U, de),
                      onDismissDone: H.dismissDone
                    }
                  )
                ] }) : /* @__PURE__ */ s(
                  "div",
                  {
                    className: "w-full rounded-md border border-border flex items-center justify-center",
                    style: { aspectRatio: "16 / 9", borderStyle: "dashed", minHeight: 160 },
                    children: d ? S ? /* @__PURE__ */ s("p", { className: "text-sm text-center px-4", style: { color: "var(--danger)" }, children: n("error.generic", { code: S }) }) : /* @__PURE__ */ i("p", { className: "text-sm text-muted inline-flex items-center gap-2", children: [
                      /* @__PURE__ */ s(ae, {}),
                      " ",
                      n("viewer.loading")
                    ] }) : /* @__PURE__ */ s("p", { className: "text-sm text-muted text-center px-4", children: n("panel.preview.empty") })
                  }
                ) }),
                Re && d && b && /* @__PURE__ */ s("div", { className: "min-h-0 flex-none", style: { width: 300 }, children: /* @__PURE__ */ s(
                  En,
                  {
                    t: n,
                    client: t,
                    deckPath: d.path,
                    design: Le,
                    tokensBusy: $e.tokensBusy,
                    onWriteTokens: () => void $e.writeTokens(),
                    onPreview: B,
                    onApplied: (U) => {
                      $e.onApplied(), ue(U, d.path), k();
                    },
                    onClose: () => Fe(!1)
                  }
                ) })
              ] })
            ] }) }) }),
            Pt && /* @__PURE__ */ s(Dn, { t: n, client: t, roots: c, decks: u, onCreated: (U, de, ce) => void Ot(U, de, ce), onClose: () => je(!1) }),
            Se && d && b && /* @__PURE__ */ s(
              $n,
              {
                t: n,
                client: t,
                preview: b,
                mode: Se.mode,
                after: Se.after,
                saveSlide: Se.slide,
                deckPath: d.path,
                busy: We,
                onClose: () => wt(null),
                onPick: Pe.insertLayout
              }
            ),
            d && b && b.slides[D] && /* @__PURE__ */ s("div", { className: "hs-right-notes min-h-0 flex flex-col", style: { flex: j.notesOpen ? "0 0 22%" : "0 0 auto", marginTop: 12 }, children: /* @__PURE__ */ s(Ie, { children: /* @__PURE__ */ s(
              Xt,
              {
                t: n,
                client: t,
                deckPath: d.path,
                slide: b.slides[D],
                slideNumber: D + 1,
                open: j.notesOpen,
                onToggle: () => j.setNotesOpen(!j.notesOpen),
                onChanged: j.setNotesIndex,
                refreshKey: j.notesRefresh + C
              }
            ) }) }),
            $.chatOpen ? /* @__PURE__ */ s(
              "div",
              {
                role: "separator",
                "aria-orientation": "horizontal",
                "aria-label": n("split.label"),
                "aria-valuenow": Math.round(Ge * 100),
                "data-testid": "split-handle",
                onPointerDown: Rt,
                className: "flex-none flex items-center justify-center",
                style: { flex: "0 0 12px", height: 12, cursor: "row-resize", touchAction: "none" },
                children: /* @__PURE__ */ s("div", { className: "rounded-full", style: { flex: "0 0 3px", width: 40, height: 3, background: "var(--border-strong, var(--border))", opacity: 0.8 } })
              }
            ) : /* @__PURE__ */ s("div", { style: { flex: "0 0 12px", height: 12 } }),
            /* @__PURE__ */ s("div", { className: "hs-right-chat min-h-0 flex flex-col", style: { flex: $.chatOpen ? `0 0 ${Math.round(Ge * 1e3) / 10}%` : "0 0 auto" }, children: /* @__PURE__ */ s(Ie, { children: /* @__PURE__ */ s(
              Jt,
              {
                t: n,
                locale: r,
                deck: d,
                preview: b,
                build: te,
                open: $.chatOpen,
                onToggle: () => $.setChatOpen(!$.chatOpen),
                refreshKey: $.chatRefresh,
                toolbar: b ? /* @__PURE__ */ s(Cn, { t: n, slideNumber: D + 1, onRun: $.runQuickAction }) : null
              }
            ) }) })
          ] })
        ]
      }
    ),
    Et && d && F && b && /* @__PURE__ */ s(
      mt,
      {
        t: n,
        url: F,
        baseUrl: b.baseUrl,
        startSlide: D + 1,
        slideCount: b.slides.length,
        onClose: () => Qe(!1),
        onPosition: (U) => E(U - 1),
        openPresenter: async (U) => {
          await t.present(d.path, U, "presenter", r);
        }
      }
    )
  ] });
}
function Kn({ conn: e }) {
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
  Jn as default
};
