/* HKDSE Programme Matcher — client-only MVP */
const LEVELS = ["", "1", "2", "3", "4", "5", "5*", "5**"];
const CORE = [
  { id: "chi", label: "中文", required: true },
  { id: "eng", label: "英文", required: true },
  { id: "math", label: "數學（必修）", required: true },
  { id: "csd", label: "公民與社會發展", type: "csd" },
];

const SCORE7 = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "5*": 6, "5**": 7 };
const SCORE85 = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5.5, "5*": 7, "5**": 8.5 };

let DATA = null;
let electiveCount = 2;
let lastMatch = new Map(); // id -> {band, studentScore, note}

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null || c === false) return;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return n;
}

function buildGradeInputs() {
  const grid = document.getElementById("gradesGrid");
  grid.innerHTML = "";
  CORE.forEach((c) => {
    if (c.type === "csd") {
      grid.appendChild(
        el("div", { class: "grade-item" }, [
          el("label", { text: c.label, for: "g_" + c.id }),
          el("select", { id: "g_" + c.id }, [
            el("option", { value: "Attained", text: "達標 (Attained)" }),
            el("option", { value: "Unattained", text: "未達標" }),
          ]),
        ])
      );
    } else {
      grid.appendChild(gradeSelect(c.id, c.label));
    }
  });
  for (let i = 1; i <= electiveCount; i++) {
    grid.appendChild(gradeSelect("el" + i, "選修 " + i, true));
  }
}

function gradeSelect(id, label, withSubjectName = false) {
  const opts = LEVELS.map((lv) => el("option", { value: lv, text: lv || "—" }));
  const kids = [el("label", { text: label })];
  if (withSubjectName) {
    kids.push(el("input", { id: "n_" + id, placeholder: "科目名稱（可選）", maxlength: "40" }));
  }
  kids.push(el("select", { id: "g_" + id }, opts));
  return el("div", { class: "grade-item" }, kids);
}

function readGrades() {
  const subjects = [];
  ["chi", "eng", "math"].forEach((id) => {
    const v = document.getElementById("g_" + id).value;
    if (v) subjects.push({ id, level: v });
  });
  for (let i = 1; i <= electiveCount; i++) {
    const v = document.getElementById("g_el" + i)?.value;
    if (v) subjects.push({ id: "el" + i, level: v });
  }
  return {
    subjects,
    csd: document.getElementById("g_csd").value,
  };
}

function bestN(subjects, table, n = 5) {
  const scores = subjects.map((s) => table[s.level] ?? 0).filter((x) => x > 0);
  scores.sort((a, b) => b - a);
  const top = scores.slice(0, n);
  if (top.length < n) return null;
  return top.reduce((a, b) => a + b, 0);
}

function num(x) {
  if (x === "" || x == null) return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function matchProgramme(p, best7, best85) {
  // Returns {band, studentScore, note}
  const med = num(p.median);
  const lq = num(p.lq);
  const mean = num(p.mean);

  // PolyU weighted scores are typically 150–300 — not comparable to raw Best5
  if (p.scale === "polyu_weighted") {
    return {
      band: "nocomp",
      studentScore: null,
      note: "理大官方分數含科目加權（分數尺度較大），未能用未加權 Best 5 直接比較；請睇官方計分／自己用理大計分器。",
    };
  }

  // Prefer median/lq comparison on matching scale
  let student = null;
  if (p.scale === "8.5") student = best85;
  else if (p.scale === "7") student = best7;
  else student = best7;

  const ref = med ?? lq ?? mean;
  if (student == null || ref == null) {
    return { band: "nocomp", studentScore: student, note: "缺少可比較之官方分數或你的成績未夠 5 科。" };
  }

  // Sanity: if official median looks like PolyU-scale (>100) but we classified wrong
  if (ref > 100) {
    return {
      band: "nocomp",
      studentScore: student,
      note: "官方參考分尺度與未加權 Best 5 不同，未能直接比較。",
    };
  }

  let band = "reach";
  if (med != null && student >= med) band = "strong";
  else if (lq != null && student >= lq) band = "border";
  else if (med == null && lq == null && mean != null) {
    if (student >= mean) band = "strong";
    else if (student >= mean - 2) band = "border";
    else band = "reach";
  } else if (lq != null && student < lq) band = "reach";
  else if (med != null && student < med) band = "border";

  const bits = [];
  if (student != null) bits.push(`你的未加權參考分約 ${student}`);
  if (med != null) bits.push(`Median ${med}`);
  if (lq != null) bits.push(`LQ ${lq}`);
  if (mean != null && med == null) bits.push(`Mean ${mean}`);
  bits.push("只供參考，非取錄保證");

  return { band, studentScore: student, note: bits.join("・") };
}

function bandLabel(band) {
  return (
    {
      strong: "≥ Median（較有競爭力・參考）",
      border: "LQ–Median（接近門檻・參考）",
      reach: "低於 LQ（較進取・參考）",
      nocomp: "未能直接比較分數",
    }[band] || band
  );
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
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code || "").toLowerCase().includes(q) ||
        p.institution.toLowerCase().includes(q)
    );
  }
  if (inst) list = list.filter((p) => p.institution === inst);
  if (tag) list = list.filter((p) => (p.tags || []).includes(tag));
  if (sys) list = list.filter((p) => p.system === sys);

  if (mf === "matched") list = list.filter((p) => lastMatch.has(p.id) && lastMatch.get(p.id).band !== "nocomp");
  else if (["strong", "border", "reach", "nocomp"].includes(mf)) {
    list = list.filter((p) => lastMatch.has(p.id) && lastMatch.get(p.id).band === mf);
  }

  // Sort: matched bands first if any matches exist
  const order = { strong: 0, border: 1, reach: 2, nocomp: 3 };
  if (lastMatch.size) {
    list.sort((a, b) => {
      const ma = lastMatch.get(a.id)?.band || "nocomp";
      const mb = lastMatch.get(b.id)?.band || "nocomp";
      if (order[ma] !== order[mb]) return order[ma] - order[mb];
      return (a.code || a.name).localeCompare(b.code || b.name);
    });
  }

  const box = document.getElementById("results");
  document.getElementById("resultCount").textContent = `${list.length} 個課程`;
  box.innerHTML = "";
  if (!list.length) {
    box.appendChild(el("div", { class: "empty", text: "冇符合條件嘅課程，試下放寬篩選。" }));
    return;
  }

  list.forEach((p) => {
    const m = lastMatch.get(p.id);
    const pillClass = m ? m.band : "na";
    const pillText = m ? bandLabel(m.band).split("（")[0] : "未配對";

    const scoreBits = [];
    if (p.median) scoreBits.push(`Median: ${p.median}`);
    if (p.lq) scoreBits.push(`LQ: ${p.lq}`);
    if (p.uq) scoreBits.push(`UQ: ${p.uq}`);
    if (p.mean) scoreBits.push(`Mean: ${p.mean}`);

    let intro;
    if (p.intro_zh) {
      intro = el("div", { class: "intro" }, [el("strong", { text: "簡介：" }), p.intro_zh]);
    } else if (p.intro_en) {
      intro = el("div", { class: "intro" }, [
        el("strong", { text: "簡介（官方英文摘要）：" }),
        p.intro_en,
      ]);
    } else {
      intro = el("div", { class: "intro match-note", text: "簡介：待核實官方課程描述後補上（唔臆造）。" });
    }
    let career;
    if (p.career_zh) {
      career = el("div", { class: "career" }, [el("strong", { text: "出路：" }), p.career_zh]);
    } else if (p.career_en) {
      career = el("div", { class: "career" }, [
        el("strong", { text: "出路（官方英文摘要）：" }),
        p.career_en,
      ]);
    } else {
      career = el("div", { class: "career match-note", text: "出路：官方頁未摘到明確出路句，請睇來源連結。" });
    }

    box.appendChild(
      el("article", { class: "prog" }, [
        el("div", { class: "prog-head" }, [
          el("div", {}, [
            el("h3", { text: `${p.code ? p.code + "・" : ""}${p.name}` }),
            el("div", { class: "meta", text: `${p.institution}・${p.system}` }),
          ]),
          el("span", { class: `pill ${pillClass === "na" ? "na" : pillClass}`, text: pillText }),
        ]),
        el("div", { class: "tags" }, (p.tags || []).map((t) => el("span", { class: "tag", text: t }))),
        el("div", { class: "scores" }, [
          ...scoreBits.map((s) => el("span", { text: s })),
          el("span", { class: "meta", text: p.data_year || "" }),
        ]),
        intro,
        career,
        m ? el("div", { class: "match-note", text: m.note }) : null,
        el("div", { class: "source" }, [
          el("span", { class: "meta", text: "來源：" }),
          p.source_url
            ? el("a", { href: p.source_url, target: "_blank", rel: "noopener", text: p.source_url })
            : el("span", { text: "見 About" }),
          p.intro_source
            ? el("div", {}, [
                el("span", { class: "meta", text: "簡介來源：" }),
                el("a", { href: p.intro_source, target: "_blank", rel: "noopener", text: p.intro_source }),
              ])
            : null,
        ]),
        el("div", { class: "match-note", text: DATA.meta.disclaimer_zh }),
      ])
    );
  });
}

function doMatch() {
  const { subjects, csd } = readGrades();
  const best7 = bestN(subjects, SCORE7, 5);
  const best85 = bestN(subjects, SCORE85, 5);
  document.getElementById("scoreBox").hidden = false;
  document.getElementById("best5_7").textContent = best7 == null ? "（未夠 5 科有效成績）" : String(best7);
  document.getElementById("best5_85").textContent = best85 == null ? "（未夠 5 科有效成績）" : String(best85);

  lastMatch = new Map();
  DATA.programmes.forEach((p) => {
    lastMatch.set(p.id, matchProgramme(p, best7, best85));
  });
  document.getElementById("matchFilter").value = "matched";
  render();
  document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function init() {
  const res = await fetch("data/programmes.json");
  DATA = await res.json();
  document.getElementById("coverageText").textContent = DATA.meta.coverage_zh + " " + (DATA.meta.gaps_zh || "");
  const ul = document.getElementById("sourceList");
  (DATA.meta.sources || []).forEach((s) => {
    ul.appendChild(el("li", {}, [el("a", { href: s.url, target: "_blank", rel: "noopener", text: s.name + " — " + s.url })]));
  });
  buildGradeInputs();
  populateFilters();
  // sensible demo defaults
  document.getElementById("g_chi").value = "4";
  document.getElementById("g_eng").value = "4";
  document.getElementById("g_math").value = "4";
  document.getElementById("g_el1").value = "4";
  document.getElementById("g_el2").value = "4";

  document.getElementById("addElective").onclick = () => {
    if (electiveCount >= 5) return;
    electiveCount += 1;
    buildGradeInputs();
    // restore cores roughly
    document.getElementById("g_chi").value = "4";
    document.getElementById("g_eng").value = "4";
    document.getElementById("g_math").value = "4";
  };
  document.getElementById("matchBtn").onclick = doMatch;
  ["q", "instFilter", "tagFilter", "sysFilter", "matchFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", render);
    document.getElementById(id).addEventListener("change", render);
  });
  render();
}

init().catch((e) => {
  document.getElementById("coverageText").textContent = "載入 data/programmes.json 失敗：" + e.message;
});
