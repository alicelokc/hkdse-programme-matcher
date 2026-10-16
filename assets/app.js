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

let DATA = null;
let lastMatch = new Map();
let state = {
  chi: "4",
  eng: "4",
  math: "4",
  csd: "Attained",
  electives: [
    { key: "el1", subject: "bio", level: "4" },
    { key: "el2", subject: "chem", level: "4" },
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

function applyDemo( whichtype) {
  if (whichtype === "clear") {
    state.chi = ""; state.eng = ""; state.math = ""; state.csd = "Attained";
    state.electives = [{ key: "el1", subject: "bio", level: "" }];
  } else if (whichtype === "science") {
    // ~22–24 on 7-pt Best5 e.g. 5,4,4,5,5 = 23
    state.chi = "4"; state.eng = "4"; state.math = "5"; state.csd = "Attained";
    state.electives = [
      { key: "el1", subject: "chem", level: "5" },
      { key: "el2", subject: "phy", level: "5" },
      { key: "el3", subject: "bio", level: "4" },
    ];
  } else if (whichtype === "arts") {
    // ~20–22 e.g. 4,4,3,5,4 = 20
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

function matchProgramme(p, best7, best85) {
  const med = num(p.median);
  const lq = num(p.lq);
  const mean = num(p.mean);
  if (p.scale === "polyu_weighted") {
    return { band: "nocomp", studentScore: null, note: "理大官方分多数含科目加權，尺度同未加權 Best 5 不同，未能直接比較。" };
  }
  let student = p.scale === "8.5" ? best85 : best7;
  const ref = med ?? lq ?? mean;
  if (student == null || ref == null) {
    return { band: "nocomp", studentScore: student, note: "缺少可比較分數，或你未揀夠 5 科。" };
  }
  if (ref > 100) {
    return { band: "nocomp", studentScore: student, note: "官方參考分尺度不同，未能直接比較。" };
  }
  let band = "reach";
  if (med != null && student >= med) band = "strong";
  else if (lq != null && student >= lq) band = "border";
  else if (med == null && mean != null) {
    if (student >= mean) band = "strong";
    else if (student >= mean - 2) band = "border";
  } else if (med != null && student < med && (lq == null || student >= lq)) band = "border";
  const bits = [];
  bits.push(`你約 ${student} 分`);
  if (med != null) bits.push(`中位 ${med}`);
  if (lq != null) bits.push(`下四分位 ${lq}`);
  bits.push("只供參考");
  return { band, studentScore: student, note: bits.join("・") };
}

function bandLabel(band) {
  return ({ strong: "≥中位數", border: "接近門檻", reach: "較進取", nocomp: "未能比較" })[band] || band;
}

function populateFilters() {
  const insts = [...new Set(DATA.programmes.map((p) => p.institution))].sort();
  const tags = [...new Set(DATA.programmes.flatMap((p) => p.tags || []))].sort();
  const instSel = document.getElementById("instFilter");
  const tagSel = document.getElementById("tagFilter");
  insts.forEach((i) => instSel.appendChild(el("option", { value: i, text: i })));
  tags.forEach((t) => tagSel.appendChild(el("option", { value: t, text: t })));
}

function render() {
  const q = document.getElementById("q").value.trim().toLowerCase();
  const inst = document.getElementById("instFilter").value;
  const tag = document.getElementById("tagFilter").value;
  const sys = document.getElementById("sysFilter").value;
  const mf = document.getElementById("matchFilter").value;
  let list = DATA.programmes.slice();
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q) || p.institution.toLowerCase().includes(q));
  if (inst) list = list.filter((p) => p.institution === inst);
  if (tag) list = list.filter((p) => (p.tags || []).includes(tag));
  if (sys) list = list.filter((p) => p.system === sys);
  if (mf === "matched") list = list.filter((p) => lastMatch.has(p.id) && lastMatch.get(p.id).band !== "nocomp");
  else if (["strong", "border", "reach", "nocomp"].includes(mf)) list = list.filter((p) => lastMatch.has(p.id) && lastMatch.get(p.id).band === mf);

  const order = { strong: 0, border: 1, reach: 2, nocomp: 3 };
  if (lastMatch.size) {
    list.sort((a, b) => {
      const ma = lastMatch.get(a.id)?.band || "nocomp";
      const mb = lastMatch.get(b.id)?.band || "nocomp";
      return (order[ma] - order[mb]) || (a.code || a.name).localeCompare(b.code || b.name);
    });
  }

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
    if (p.median) scoreBits.push(`中位 ${p.median}`);
    if (p.lq) scoreBits.push(`下四分位 ${p.lq}`);
    if (p.uq) scoreBits.push(`上四分位 ${p.uq}`);
    if (p.mean) scoreBits.push(`平均 ${p.mean}`);

    let intro;
    if (p.intro_zh) intro = el("div", { class: "intro" }, [el("strong", { text: "讀咩：" }), p.intro_zh]);
    else if (p.intro_en) intro = el("div", { class: "intro" }, [el("strong", { text: "讀咩（官方英文摘要）：" }), p.intro_en]);
    else intro = el("div", { class: "intro match-note", text: "讀咩：暫未有已核實簡介。" });

    let career;
    if (p.career_zh) career = el("div", { class: "career" }, [el("strong", { text: "出路：" }), p.career_zh]);
    else if (p.career_en) career = el("div", { class: "career" }, [el("strong", { text: "出路（官方英文摘要）：" }), p.career_en]);
    else career = el("div", { class: "career match-note", text: "出路：官方簡介未列明具體例子，請睇來源。" });

    box.appendChild(
      el("article", { class: "prog" }, [
        el("div", { class: "prog-head" }, [
          el("div", {}, [
            el("h3", { text: `${p.code ? p.code + "・" : ""}${p.name}` }),
            el("div", { class: "meta", text: `${p.institution}・${p.system === "JUPAS" ? "聯招" : "E-APP／自資"}` }),
          ]),
          el("span", { class: `pill ${pillClass}`, text: m ? bandLabel(m.band) : "未配對" }),
        ]),
        el("div", { class: "tags" }, (p.tags || []).map((t) => el("span", { class: "tag", text: t }))),
        el("div", { class: "scores" }, [...scoreBits.map((s) => el("span", { text: s })), el("span", { class: "meta", text: p.data_year || "" })]),
        intro,
        career,
        m ? el("div", { class: "match-note", text: m.note }) : null,
        el("div", { class: "source" }, [
          el("span", { class: "meta", text: "分數來源：" }),
          p.source_url ? el("a", { href: p.source_url, target: "_blank", rel: "noopener", text: p.source_url }) : el("span", { text: "見下方" }),
          p.intro_source
            ? el("div", {}, [el("span", { class: "meta", text: "簡介來源：" }), el("a", { href: p.intro_source, target: "_blank", rel: "noopener", text: p.intro_source })])
            : null,
        ]),
        el("div", { class: "match-note", text: DATA.meta.disclaimer_zh }),
      ])
    );
  });
}

function doMatch() {
  const subjects = readSubjects();
  const best7 = bestN(subjects, SCORE7, 5);
  const best85 = bestN(subjects, SCORE85, 5);
  updateLiveScore();
  lastMatch = new Map();
  DATA.programmes.forEach((p) => lastMatch.set(p.id, matchProgramme(p, best7, best85)));
  document.getElementById("matchFilter").value = "matched";
  render();
  document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function init() {
  const res = await fetch("data/programmes.json");
  DATA = await res.json();
  document.getElementById("coverageText").textContent = `${DATA.meta.coverage_zh || ""} ${DATA.meta.gaps_zh || ""}`;
  const ul = document.getElementById("sourceList");
  (DATA.meta.sources || []).forEach((s) => {
    ul.appendChild(el("li", {}, [el("a", { href: s.url, target: "_blank", rel: "noopener", text: `${s.name} — ${s.url}` })]));
  });
  populateFilters();
  renderAllGrades();
  document.getElementById("addElective").onclick = () => {
    if (state.electives.length >= 5) return;
    state.electives.push({ key: "el" + Date.now(), subject: "econ", level: "4" });
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
