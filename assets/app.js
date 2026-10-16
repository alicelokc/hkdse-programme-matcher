/* DSE 揀科配對 — student-friendly grade chips + programme matcher */
const SCORE7 = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "5*": 6, "5**": 7 };
const SCORE85 = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5.5, "5*": 7, "5**": 8.5 };
const LEVELS = ["1", "2", "3", "4", "5", "5*", "5**"];

const ELECTIVES = [
  { id: "bio", label: "生物 Biology" },
  { id: "chem", label: "化學 Chemistry" },
  { id: "phy", label: "物理 Physics" },
  { id: "bafs", label: "企業會計與財務概論 BAFS" },
  { id: "econ", label: "經濟 Economics" },
  { id: "geog", label: "地理 Geography" },
  { id: "hist", label: "歷史 History" },
  { id: "chist", label: "中國歷史 Chinese History" },
  { id: "ict", label: "資訊及通訊科技 ICT" },
  { id: "va", label: "視覺藝術 Visual Arts" },
  { id: "clit", label: "中國文學 Chinese Literature" },
  { id: "elit", label: "英語文學 Literature in English" },
  { id: "ths", label: "旅遊與款待 Tourism & Hospitality" },
  { id: "hms", label: "健康管理與社會關懷 Health Management" },
  { id: "dat", label: "設計與應用科技 Design & Applied Tech" },
  { id: "pe", label: "體育 Physical Education" },
  { id: "m1", label: "數學延伸部份 M1（微積分與統計）" },
  { id: "m2", label: "數學延伸部份 M2（代數與微積分）" },
  { id: "other", label: "其他選修 Other elective" },
];

/** English institution key → Chinese short name (display + search) */
const INST_ZH = {
  CUHK: "中大",
  HKUST: "科大",
  PolyU: "理大",
  CityUHK: "城大",
  EdUHK: "教大",
  "Lingnan University": "嶺南",
  "PolyU HKCC": "理大 HKCC",
  "The Hang Seng University of Hong Kong": "恒大",
  "Hong Kong Shue Yan University": "樹仁",
};

const INST_SEARCH_ALIASES = {
  CUHK: ["中大", "中文大學", "cuhk"],
  HKUST: ["科大", "科技大學", "hkust"],
  PolyU: ["理大", "理工", "polyu"],
  CityUHK: ["城大", "城市大學", "cityu"],
  EdUHK: ["教大", "教育大學", "eduhk"],
  "Lingnan University": ["嶺南", "lingnan"],
  "PolyU HKCC": ["hkcc", "專上學院", "理大hkcc", "理大 HKCC"],
  "The Hang Seng University of Hong Kong": ["恒大", "恒生", "hsu"],
  "Hong Kong Shue Yan University": ["樹仁", "shue yan", "syu"],
};

let DATA = null;
let lastMatch = new Map();
let lastBest = { best7: null, best85: null, subjectCount: 0 };
let lastHiddenNocomp = 0;

/** Default: empty grades (not all 4). Demos still fill values. */
let state = {
  chi: "",
  eng: "",
  math: "",
  csd: "Attained",
  electives: [
    { key: "el1", subject: "bio", level: "" },
    { key: "el2", subject: "chem", level: "" },
  ],
};

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== false && v != null) n.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null || c === false) return;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return n;
}

function chipGroup(levels, selected, onPick, csd = false) {
  const wrap = el("div", { class: "chips", role: "group" });
  levels.forEach((lv) => {
    const b = el("button", {
      type: "button",
      class: `chip${csd ? " csd" : ""}${selected === lv ? " on" : ""}`,
      text: lv === "Attained" ? "達標" : lv === "Unattained" ? "未達標" : lv,
      onclick: () => onPick(lv),
    });
    wrap.appendChild(b);
  });
  return wrap;
}

function renderCore() {
  const grid = document.getElementById("coreGrid");
  grid.innerHTML = "";
  const cores = [
    { key: "chi", title: "中文" },
    { key: "eng", title: "英文" },
    { key: "math", title: "數學（必修）" },
  ];
  cores.forEach((c) => {
    grid.appendChild(
      el("div", { class: "subject-card" }, [
        el("div", { class: "title", text: c.title }),
        chipGroup(LEVELS, state[c.key], (lv) => {
          state[c.key] = lv;
          renderAllGrades();
        }),
      ])
    );
  });
  grid.appendChild(
    el("div", { class: "subject-card" }, [
      el("div", { class: "title", text: "公民與社會發展" }),
      chipGroup(["Attained", "Unattained"], state.csd, (lv) => {
        state.csd = lv;
        renderAllGrades();
      }, true),
    ])
  );
}

function renderElectives() {
  const list = document.getElementById("electiveList");
  list.innerHTML = "";
  state.electives.forEach((e, idx) => {
    const sel = el("select", {
      class: "subject-select",
      onchange: (ev) => {
        e.subject = ev.target.value;
        updateLiveScore();
      },
    });
    ELECTIVES.forEach((opt) => {
      sel.appendChild(el("option", { value: opt.id, text: opt.label, selected: opt.id === e.subject }));
    });
    const card = el("div", { class: "subject-card" }, [
      el("div", { class: "title" }, [
        el("span", { text: `選修 ${idx + 1}` }),
        state.electives.length > 1
          ? el("button", {
              type: "button",
              class: "rm",
              text: "刪除",
              onclick: () => {
                state.electives = state.electives.filter((x) => x.key !== e.key);
                renderAllGrades();
              },
            })
          : null,
      ]),
      sel,
      chipGroup(LEVELS, e.level, (lv) => {
        e.level = lv;
        renderAllGrades();
      }),
    ]);
    list.appendChild(card);
  });
}

function renderAllGrades() {
  renderCore();
  renderElectives();
  updateLiveScore();
  updateGradeHint();
}

function updateGradeHint() {
  const hint = document.getElementById("gradeHint");
  if (!hint) return;
  const filled = ["chi", "eng", "math"].filter((k) => state[k]).length +
    state.electives.filter((e) => e.level).length;
  hint.hidden = filled > 0;
}

function readSubjects() {
  const subjects = [];
  ["chi", "eng", "math"].forEach((id) => {
    if (state[id]) subjects.push({ id, level: state[id] });
  });
  state.electives.forEach((e) => {
    if (e.level) subjects.push({ id: e.key, level: e.level, subject: e.subject });
  });
  return subjects;
}

function bestN(subjects, table, n = 5) {
  const scores = subjects.map((s) => table[s.level] ?? 0).filter((x) => x > 0);
  scores.sort((a, b) => b - a);
  const top = scores.slice(0, n);
  if (top.length < n) return null;
  return +(top.reduce((a, b) => a + b, 0)).toFixed(1);
}

function updateLiveScore() {
  const subjects = readSubjects();
  const b7 = bestN(subjects, SCORE7, 5);
  const b85 = bestN(subjects, SCORE85, 5);
  document.getElementById("best5_7").textContent = b7 == null ? "未夠5科" : String(b7);
  document.getElementById("best5_85").textContent = b85 == null ? "未夠5科" : String(b85);
}

function applyDemo(whichtype) {
  if (whichtype === "clear") {
    state.chi = ""; state.eng = ""; state.math = ""; state.csd = "Attained";
    state.electives = [
      { key: "el1", subject: "bio", level: "" },
      { key: "el2", subject: "chem", level: "" },
    ];
  } else if (whichtype === "science") {
    state.chi = "4"; state.eng = "4"; state.math = "5"; state.csd = "Attained";
    state.electives = [
      { key: "el1", subject: "chem", level: "5" },
      { key: "el2", subject: "phy", level: "5" },
      { key: "el3", subject: "bio", level: "4" },
    ];
  } else if (whichtype === "arts") {
    state.chi = "5"; state.eng = "4"; state.math = "3"; state.csd = "Attained";
    state.electives = [
      { key: "el1", subject: "econ", level: "4" },
      { key: "el2", subject: "hist", level: "4" },
      { key: "el3", subject: "bafs", level: "4" },
    ];
  }
  renderAllGrades();
}

function num(x) {
  if (x === "" || x == null) return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function scaleLabel(scale) {
  if (scale === "8.5") return "8.5分制";
  if (scale === "7") return "7分制";
  if (scale === "polyu_weighted") return "理大加權分";
  return scale || "";
}

function instDisplay(inst) {
  const zh = INST_ZH[inst];
  return zh ? `${zh}（${inst}）` : inst;
}

function yearNoteZh(p) {
  const y = p.data_year || "";
  const nature = p.data_nature || "";
  if (!y && !nature) return "";
  // Prefer Traditional Chinese, not English formula jargon
  if (nature === "reference_recalculated_prior_year" || /NOT 2026|recalculated|× 2026 formula/i.test(y)) {
    return "參考：按舊年成績用今年計分方式重算（非本年實際收生）";
  }
  if (nature === "new_programme_no_score" || /no prior-year|New programme/i.test(y)) {
    return "新課程：暫未有往年收生分數";
  }
  if (nature === "actual_admission_scores_prior_year" || /Concourse|2025\/26/i.test(y)) {
    return "往年實際收生分數（官方公布）";
  }
  if (/2026.*actual|actual.*2026|2026\/27 Cohort|Main Round \(actual\)/i.test(y)) {
    return "2026 實際收生成績";
  }
  if (/2026/.test(y)) return "2026 入學參考分數";
  return y;
}

/** Only surface requirement hints when already present in official score_metric text. */
function requirementHintFromData(p) {
  const m = (p.score_metric || "").toLowerCase();
  const bits = [];
  if (/interview/.test(m)) bits.push("官方計分說明提及可能含面試");
  if (/bonus/.test(m)) bits.push("官方計分說明提及可能有加分");
  if (/subject-weighted|subject weight|weighted/.test(m) && p.scale !== "polyu_weighted") {
    bits.push("官方分數含科目加權");
  }
  return bits.length ? bits.join("；") : "";
}

function matchProgramme(p, best7, best85, subjectCount) {
  const med = num(p.median);
  const lq = num(p.lq);
  const mean = num(p.mean);
  const hasEnoughSubjects = subjectCount >= 5;

  if (p.scale === "polyu_weighted") {
    return {
      band: "nocomp",
      studentScore: null,
      scale: p.scale,
      note: "理大官方分為加權分，唔好同你個 Best 5 直接比較。",
      polyuWarn: true,
      scores: { median: p.median, lq: p.lq, uq: p.uq },
    };
  }

  let student = p.scale === "8.5" ? best85 : best7;
  const ref = med ?? lq ?? mean;

  if (student == null) {
    return {
      band: "nocomp",
      studentScore: null,
      scale: p.scale,
      note: hasEnoughSubjects
        ? "未能計算可比較分數。"
        : "你未揀夠 5 科，未能計 Best 5。",
    };
  }
  if (ref == null) {
    return {
      band: "nocomp",
      studentScore: student,
      scale: p.scale,
      note: "此課程暫未有可比較嘅官方收生分數。",
    };
  }
  if (ref > 100) {
    return {
      band: "nocomp",
      studentScore: student,
      scale: p.scale,
      note: "官方參考分尺度不同，未能直接比較。",
    };
  }

  let band = "reach";
  // Has median: standard bands
  if (med != null) {
    if (student >= med) band = "strong";
    else if (lq != null && student >= lq) band = "border";
    else if (lq == null && student >= med - 2) band = "border";
    else band = "reach";
  } else if (lq != null) {
    // No median: LQ-only (e.g. HKCC). Student well above LQ → comfortable/strong, not「接近門檻」.
    if (student >= lq + 3 || student >= lq * 1.25) band = "strong";
    else if (student >= lq) band = "border";
    else band = "reach";
  } else if (mean != null) {
    if (student >= mean) band = "strong";
    else if (student >= mean - 2) band = "border";
    else band = "reach";
  }

  const bits = [];
  bits.push(`你約 ${student} 分（${scaleLabel(p.scale)}）`);
  if (med != null) bits.push(`中位 ${med}`);
  if (lq != null) bits.push(`下四分位 ${lq}`);
  bits.push("只供參考");
  return { band, studentScore: student, scale: p.scale, note: bits.join("・") };
}

function bandLabel(band) {
  return ({
    strong: "≥中位",
    border: "接近",
    reach: "較進取",
    nocomp: "未能比較",
  })[band] || band;
}

/** Student-facing Chinese synonyms → match English programme names too */
const SEARCH_SYNONYMS = [
  { q: "電腦", add: ["computer", "computing", "計算機", "軟件", "software"] },
  { q: "護理", add: ["nursing", "nurse"] },
  { q: "商科", add: ["business", "bba", "account", "finance", "marketing"] },
  { q: "工程", add: ["engineering", "engineer"] },
  { q: "法律", add: ["law", "llb", "legal"] },
  { q: "醫學", add: ["medicine", "mbchb", "medical"] },
  { q: "教育", add: ["education", "bed", "teaching"] },
  { q: "心理", add: ["psychology"] },
  { q: "設計", add: ["design"] },
  { q: "數據", add: ["data", "analytics", "statistic"] },
  { q: "人工智能", add: ["artificial intelligence", " ai ", "a.i."] },
  { q: "AI", add: ["artificial intelligence", "人工智能"] },
];

function searchHaystack(p) {
  const parts = [
    p.name || "",
    p.code || "",
    p.institution || "",
    INST_ZH[p.institution] || "",
    ...(INST_SEARCH_ALIASES[p.institution] || []),
    p.intro_zh || "",
    p.career_zh || "",
    p.intro_en || "",
    p.career_en || "",
    ...(p.tags || []),
  ];
  return parts.join(" ").toLowerCase();
}

function matchesQuery(p, q) {
  if (!q) return true;
  const hay = searchHaystack(p);
  if (hay.includes(q)) return true;
  // If student typed a known Chinese synonym, also match English name tokens
  for (const syn of SEARCH_SYNONYMS) {
    const sq = syn.q.toLowerCase();
    if (q === sq || q.includes(sq)) {
      if (syn.add.some((a) => hay.includes(a.toLowerCase()))) return true;
    }
  }
  return false;
}

function populateFilters() {
  const insts = [...new Set(DATA.programmes.map((p) => p.institution))].sort();
  const tags = [...new Set(DATA.programmes.flatMap((p) => p.tags || []))].sort();
  const instSel = document.getElementById("instFilter");
  const tagSel = document.getElementById("tagFilter");
  instSel.innerHTML = "";
  instSel.appendChild(el("option", { value: "", text: "全部" }));
  insts.forEach((i) => instSel.appendChild(el("option", { value: i, text: instDisplay(i) })));
  tagSel.innerHTML = "";
  tagSel.appendChild(el("option", { value: "", text: "全部" }));
  tags.forEach((t) => tagSel.appendChild(el("option", { value: t, text: t })));
}

function updateSummaryBar() {
  const bar = document.getElementById("matchSummary");
  if (!bar) return;
  if (!lastMatch.size || (lastBest.best7 == null && lastBest.best85 == null)) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const x = lastBest.best7 == null ? "—" : lastBest.best7;
  const y = lastBest.best85 == null ? "—" : lastBest.best85;
  let extra = "";
  const mf = document.getElementById("matchFilter").value;
  if (mf === "matched" && lastHiddenNocomp > 0) {
    extra = `・已隱藏 ${lastHiddenNocomp} 個「未能比較」`;
  }
  document.getElementById("summaryText").textContent =
    `你而家 7分制 ${x}、8.5分制 ${y}${extra}`;
}

function render() {
  const qRaw = document.getElementById("q").value.trim();
  const q = qRaw.toLowerCase();
  const inst = document.getElementById("instFilter").value;
  const tag = document.getElementById("tagFilter").value;
  const sys = document.getElementById("sysFilter").value;
  const mf = document.getElementById("matchFilter").value;
  let list = DATA.programmes.slice();

  if (q) {
    list = list.filter((p) => matchesQuery(p, q));
  }
  if (inst) list = list.filter((p) => p.institution === inst);
  if (tag) list = list.filter((p) => (p.tags || []).includes(tag));
  if (sys) list = list.filter((p) => p.system === sys);

  // Count nocomp before filtering them out
  lastHiddenNocomp = 0;
  if (lastMatch.size && mf === "matched") {
    lastHiddenNocomp = list.filter((p) => lastMatch.has(p.id) && lastMatch.get(p.id).band === "nocomp").length;
  }

  if (mf === "matched") list = list.filter((p) => lastMatch.has(p.id) && lastMatch.get(p.id).band !== "nocomp");
  else if (["strong", "border", "reach", "nocomp"].includes(mf)) {
    list = list.filter((p) => lastMatch.has(p.id) && lastMatch.get(p.id).band === mf);
  }

  const bandOrder = { strong: 0, border: 1, reach: 2, nocomp: 3 };
  if (lastMatch.size) {
    list.sort((a, b) => {
      const ma = lastMatch.get(a.id)?.band || "nocomp";
      const mb = lastMatch.get(b.id)?.band || "nocomp";
      if (bandOrder[ma] !== bandOrder[mb]) return bandOrder[ma] - bandOrder[mb];
      // Prefer programmes with intro; deprioritize blank-intro (esp. self-financed)
      const ia = a.intro_zh ? 0 : a.intro_en ? 1 : 2;
      const ib = b.intro_zh ? 0 : b.intro_en ? 1 : 2;
      if (ia !== ib) return ia - ib;
      // JUPAS before E-APP when same band
      const sa = a.system === "JUPAS" ? 0 : 1;
      const sb = b.system === "JUPAS" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return (a.code || a.name).localeCompare(b.code || b.name);
    });
  }

  updateSummaryBar();

  const box = document.getElementById("results");
  document.getElementById("resultCount").textContent = `${list.length} 個課程`;
  box.innerHTML = "";
  if (!list.length) {
    box.appendChild(el("div", { class: "empty", text: "暫時冇符合條件嘅課程，試下放寬篩選。" }));
    return;
  }

  list.forEach((p) => {
    const m = lastMatch.get(p.id);
    const pillClass = m ? m.band : "na";

    const scoreBits = [];
    if (m?.polyuWarn) {
      // PolyU: warning BEFORE big numbers
      scoreBits.push(el("div", { class: "polyu-warn", text: "⚠ 加權分，唔好同你個 Best 5 比" }));
    }
    if (p.median) scoreBits.push(el("span", { text: `中位 ${p.median}` }));
    if (p.lq) scoreBits.push(el("span", { text: `下四分位 ${p.lq}` }));
    if (p.uq) scoreBits.push(el("span", { text: `上四分位 ${p.uq}` }));
    if (p.mean) scoreBits.push(el("span", { text: `平均 ${p.mean}` }));

    const yearZh = yearNoteZh(p);
    if (yearZh) scoreBits.push(el("span", { class: "meta", text: yearZh }));

    let intro;
    if (p.intro_zh) intro = el("div", { class: "intro" }, [el("strong", { text: "讀咩：" }), p.intro_zh]);
    else if (p.intro_en) intro = el("div", { class: "intro" }, [el("strong", { text: "讀咩（官方英文摘要）：" }), p.intro_en]);
    else intro = el("div", { class: "intro match-note", text: "讀咩：暫未有已核實簡介。" });

    let career;
    if (p.career_zh) career = el("div", { class: "career" }, [el("strong", { text: "出路：" }), p.career_zh]);
    else if (p.career_en) career = el("div", { class: "career" }, [el("strong", { text: "出路（官方英文摘要）：" }), p.career_en]);
    else career = el("div", { class: "career match-note", text: "出路：官方簡介未列明具體例子，請睇來源。" });

    const reqHint = requirementHintFromData(p);
    const reqEl = reqHint ? el("div", { class: "req-hint", text: reqHint }) : null;

    // Your score line on card
    let yourScore = null;
    if (m && m.studentScore != null) {
      yourScore = el("div", {
        class: "your-score",
        text: `你約 ${m.studentScore} 分（${scaleLabel(m.scale || p.scale)}）`,
      });
    } else if (m?.polyuWarn) {
      yourScore = el("div", { class: "your-score muted", text: "未能同 Best 5 直接比較" });
    }

    // Collapsible sources (P2)
    const sourceDetails = el("details", { class: "source-fold" }, [
      el("summary", { text: "分數來源" }),
      el("div", { class: "source-body" }, [
        p.source_url
          ? el("div", {}, [el("a", { href: p.source_url, target: "_blank", rel: "noopener", text: p.source_url })])
          : el("div", { class: "meta", text: "見頁底來源列表" }),
        p.intro_source
          ? el("div", {}, [
              el("span", { class: "meta", text: "簡介來源：" }),
              el("a", { href: p.intro_source, target: "_blank", rel: "noopener", text: p.intro_source }),
            ])
          : null,
        el("div", { class: "match-note", text: DATA.meta.disclaimer_zh }),
      ]),
    ]);

    box.appendChild(
      el("article", { class: "prog" }, [
        el("div", { class: "prog-head" }, [
          el("div", {}, [
            el("h3", { text: `${p.code ? p.code + "・" : ""}${p.name}` }),
            el("div", { class: "meta", text: `${instDisplay(p.institution)}・${p.system === "JUPAS" ? "聯招" : "E-APP／自資"}` }),
          ]),
          el("span", { class: `pill ${pillClass === "nocomp" ? "na" : pillClass}`, text: m ? bandLabel(m.band) : "未配對" }),
        ]),
        el("div", { class: "tags" }, (p.tags || []).map((t) => el("span", { class: "tag", text: t }))),
        yourScore,
        el("div", { class: "scores" }, scoreBits),
        reqEl,
        intro,
        career,
        m && !m.polyuWarn ? el("div", { class: "match-note", text: m.note }) : null,
        m?.polyuWarn ? el("div", { class: "match-note", text: m.note }) : null,
        sourceDetails,
      ])
    );
  });
}

function doMatch() {
  const subjects = readSubjects();
  const best7 = bestN(subjects, SCORE7, 5);
  const best85 = bestN(subjects, SCORE85, 5);
  lastBest = { best7, best85, subjectCount: subjects.length };
  updateLiveScore();
  lastMatch = new Map();
  DATA.programmes.forEach((p) => lastMatch.set(p.id, matchProgramme(p, best7, best85, subjects.length)));
  document.getElementById("matchFilter").value = "matched";
  render();
  document.getElementById("matchSummary")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function coverageSentence() {
  // One plain sentence: which unis have 2026 data; note HKU/HKBU missing
  return "2026 實際收生分數已收錄：理大、中大、科大、嶺南、教大，以及理大 HKCC；城大為按公式重算參考。港大／浸大暫缺 2026 實際分。";
}

function initScoreExplain() {
  const box = document.getElementById("scoreExplain");
  if (!box) return;
  box.textContent =
    "中位＝一半取錄同學高於／低於此分；下四分位＝約四分一取錄同學低於此分。「7分制」5*=6、5**=7；「8.5分制」5*=7、5**=8.5。";
}

async function init() {
  const res = await fetch("data/programmes.json");
  DATA = await res.json();
  document.getElementById("coverageText").textContent = coverageSentence();
  initScoreExplain();

  const ul = document.getElementById("sourceList");
  const fold = document.getElementById("sourceFold");
  if (fold && ul) {
    (DATA.meta.sources || []).forEach((s) => {
      ul.appendChild(el("li", {}, [el("a", { href: s.url, target: "_blank", rel: "noopener", text: `${s.name}` })]));
    });
  }

  populateFilters();
  renderAllGrades();
  document.getElementById("addElective").onclick = () => {
    if (state.electives.length >= 5) return;
    state.electives.push({ key: "el" + Date.now(), subject: "econ", level: "" });
    renderAllGrades();
  };
  document.getElementById("matchBtn").onclick = doMatch;
  document.querySelectorAll(".demo-chip").forEach((b) => {
    b.addEventListener("click", () => applyDemo(b.dataset.demo));
  });
  ["q", "instFilter", "tagFilter", "sysFilter", "matchFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", render);
    document.getElementById(id).addEventListener("change", render);
  });
  render();
}

init().catch((e) => {
  document.getElementById("coverageText").textContent = "載入失敗：" + e.message;
});
