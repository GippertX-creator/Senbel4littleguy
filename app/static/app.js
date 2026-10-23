"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const h = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const paths = {
  home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  materials: "M4 5h6l2 2h8v13H4ZM4 5V3h6l2 2h8v2",
  outline: "M8 4h12M8 12h12M8 20h12M3 4h1M3 12h1M3 20h1",
  report: "M14 3H5v18h14V8ZM14 3v5h5M8 12h8M8 16h6",
  chat: "M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0ZM7 10h10M7 14h6",
  teach:
    "M12 3v12M8 7a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0ZM5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8",
  practice: "M8 3H5v18h14V3h-3M8 2h8v4H8ZM8 10h8M8 14h4M14 17l2 2 4-5",
  figures: "M3 3h18v18H3ZM3 17l6-6 4 4 3-3 5 5M15 7h.01",
  review: "M4 9a8 8 0 1 1-1 6M4 3v6h6M12 7v5l3 2",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z",
  arrow: "M4 12h16M14 6l6 6-6 6",
  upload: "M12 16V3M7 8l5-5 5 5M4 14v7h16v-7",
  cell: "M12 3c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  heart: "M3 13h4l2-6 4 12 2-6h6M12 4C7-1-2 7 12 21 26 7 17-1 12 4Z",
  molecule: "M12 12 4 5M12 12l8-7M12 12v8M4 3v4M2 5h4M20 3v4M18 5h4M10 20h4",
  calendar: "M4 5h16v16H4ZM4 10h16M8 3v4M16 3v4",
  check: "m5 12 4 4L19 6",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.outline}"/></svg>`;
const nav = [
  ["home", "工作台概览", ""],
  ["agent", "学习智能体", ""],
  ["materials", "课程材料", "学习空间"],
  ["outline", "知识清单", ""],
  ["chat", "课程助教", ""],
  ["teach", "讲给助教听", ""],
  ["report", "实验报告", "实验与练习"],
  ["practice", "小测与易混练习", ""],
  ["figures", "指图学习", ""],
  ["review", "今日复习", ""],
  ["settings", "API 设置", "工作台设置"],
];
const kindNames = {
  course: "课程材料",
  experiment: "实验材料",
  template: "报告模板",
};
const artifactNames = {
  outline: "知识清单",
  quiz: "小测",
  compare: "概念对照",
  report: "实验报告",
  feedback: "讲解反馈",
  chat: "助教答疑",
};
const resources = {
  physiology: [
    [
      "OpenStax · Anatomy and Physiology 2e",
      "https://openstax.org/details/books/anatomy-and-physiology-2e",
      "按章节查阅正常结构、稳态与调节。",
    ],
  ],
  pathology: [
    [
      "NCBI Bookshelf · 病理学主题检索",
      "https://www.ncbi.nlm.nih.gov/books/?term=pathology",
      "按当前知识点查找开放教材章节。",
    ],
  ],
  "cell-biology": [
    [
      "OpenStax · Biology 2e",
      "https://openstax.org/details/books/biology-2e",
      "查阅细胞结构、细胞周期与信号转导。",
    ],
  ],
  biochemistry: [
    [
      "NCBI Bookshelf · 生物化学主题检索",
      "https://www.ncbi.nlm.nih.gov/books/?term=biochemistry",
      "查阅分子机制与代谢相关教材章节。",
    ],
  ],
};
const state = {
  view: "home",
  course: localStorage.getItem("medstudy-course") || "physiology",
  courses: [],
  materials: [],
  artifacts: [],
  reviews: [],
  figures: [],
  settings: {},
  selected: new Set(),
  output: null,
  quizGrade: null,
  practiceTab: "quiz",
  chat: [],
  figure: null,
  figureMode: "edit",
  figureGrade: null,
  reviewAnswer: null,
  busy: false,
  catMood: "idle",
  catMessage: "今天也陪你一点点弄懂。",
  catExpanded: false,
  catMotion: localStorage.getItem("medstudy-cat-motion") !== "off",
  textSize:
    localStorage.getItem("medstudy-text-size") === "large"
      ? "large"
      : "standard",
  drafts: Object.create(null),
  uploadNotice: null,
  scopeState: { mode: "all", material_id: "", chapter_id: "", start_unit: "", end_unit: "" },
  catalogs: {},
  agentThread: null,
  agentThreads: [],
};

const draftForms = new Set([
  "upload-form",
  "outline-form",
  "teach-form",
  "report-form",
  "quiz-form",
  "compare-form",
  "chat-form",
  "agent-form",
]);
function captureDrafts() {
  const content = $("#content");
  if (!content.dataset.course) return;
  content.querySelectorAll("form").forEach((form) => {
    if (!draftForms.has(form.id)) return;
    const values = Object.create(null);
    form
      .querySelectorAll("input[type=text], textarea, select")
      .forEach((field) => {
        if (field.name) values[field.name] = field.value;
      });
    state.drafts[`${content.dataset.course}:${form.id}`] = values;
  });
}
function restoreDrafts() {
  $("#content")
    .querySelectorAll("form")
    .forEach((form) => {
      const values = state.drafts[`${state.course}:${form.id}`];
      if (!values) return;
      form
        .querySelectorAll("input[type=text], textarea, select")
        .forEach((field) => {
          if (!Object.hasOwn(values, field.name)) return;
          if (
            field.tagName !== "SELECT" ||
            [...field.options].some(
              (option) => option.value === values[field.name],
            )
          )
            field.value = values[field.name];
        });
    });
}
function updateTextSize() {
  document.body.dataset.textSize = state.textSize;
  const large = state.textSize === "large";
  const button = $("#text-size-toggle");
  button.textContent = large ? "标准字" : "大字";
  button.setAttribute("aria-pressed", String(large));
  button.setAttribute(
    "aria-label",
    large ? "切换到标准字号" : "切换到大字模式",
  );
}
function modelSettingsPresent() {
  if (state.settings.key_present) return true;
  try {
    return (
      ["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(state.settings.base_url).hostname,
      ) && Boolean(state.settings.model?.trim())
    );
  } catch {
    return false;
  }
}
const aiForms = {
  outline: "outline-form",
  teach: "teach-form",
  report: "report-form",
  practice: "quiz-form",
  chat: "chat-form",
  agent: "agent-form",
};
function updateReadiness() {
  const form =
    state.view === "practice"
      ? $("#quiz-form, #compare-form")
      : document.getElementById(aiForms[state.view] || "");
  if (!form) return;
  const noMaterials = state.materials.every((m) => m.kind === "template");
  const noSelection = !state.selected.size;
  const noModel = !modelSettingsPresent();
  let helper = $(".workspace-readiness", form);
  if (!helper) {
    helper = document.createElement("div");
    helper.className = "workspace-readiness";
    helper.id = "workspace-readiness";
    form.prepend(helper);
  }
  if (state.view === "agent") {
    helper.innerHTML = '<p class="small-copy">直接说出需求，不明确时我会先问清楚。可一次安排最多 3 个任务；规划与生成可能分别产生 API 费用。</p>';
    $("button[type=submit]", form).disabled = state.busy;
    return;
  }
  if (noMaterials)
    helper.innerHTML =
      '<div class="next-step"><div><strong>先上传一份课程或实验材料</strong><p>上传后会自动选中，再回来填写主题即可开始。</p></div><a class="button primary" href="#materials">去上传材料 →</a></div>';
  else if (noSelection)
    helper.innerHTML =
      '<div class="next-step"><div><strong>还没有选择学习材料</strong><p>可以一键选中当前课程的材料。</p></div><button type="button" class="button primary" data-action="select-sources" data-mode="all">使用全部材料</button></div>';
  else if (noModel)
    helper.innerHTML =
      '<div class="next-step"><div><strong>材料已就绪，再连接一次学习模型</strong><p>按服务商提供的信息填写地址、模型名和密钥。</p></div><a class="button primary" href="#settings">去设置 API →</a></div>';
  else
    helper.innerHTML =
      '<p class="ready-line">' +
      icon("check") +
      "已选择 " +
      state.selected.size +
      " 份材料，填写下面的内容即可开始。</p>";
  const submit = $("button[type=submit]", form);
  if (submit) {
    submit.disabled = noMaterials || noSelection || noModel || state.busy;
    submit.setAttribute("aria-describedby", helper.id);
  }
}
function updateSourceSelection() {
  if (state.scopeState.material_id && !state.selected.has(state.scopeState.material_id)) {
    state.scopeState = { mode: "all", material_id: "", chapter_id: "", start_unit: "", end_unit: "" };
    if ($(".range-selector")) $(".range-selector").outerHTML = rangeSelector();
  }
  document.querySelectorAll(".sources-selector").forEach((selector) => {
    $(".source-summary-text", selector).textContent =
      `学习依据 · 已选择 ${state.selected.size} / ${state.materials.filter((m) => m.kind !== "template").length} 份材料`;
    selector
      .querySelectorAll("[data-source-select]")
      .forEach(
        (input) =>
          (input.checked = state.selected.has(input.dataset.sourceSelect)),
      );
  });
  updateReadiness();
}
function simplifyHelp() {
  $("#content")
    .querySelectorAll(".two-column > aside, .chat-layout > aside")
    .forEach((aside) => {
      const layout = aside.parentElement;
      const help = document.createElement("details");
      help.className = "page-help";
      const summary = document.createElement("summary");
      summary.textContent = "需要帮助？查看使用提示";
      help.append(summary);
      layout.append(help);
      help.append(aside);
      layout.classList.add("single-focus");
    });
}
function uploadNextStep() {
  const upload = state.uploadNotice;
  if (!upload || upload.course !== state.course) return "";
  const onlyTemplate =
    upload.kind === "template" &&
    !state.materials.some((m) => m.kind === "experiment");
  return `<section class="next-step upload-success" tabindex="-1" aria-label="上传完成，选择下一步"><div><strong>已成功上传 ${upload.count} 份${kindNames[upload.kind]}</strong><p>${onlyTemplate ? "模板已保存，再上传实验内容就能准备报告。" : upload.kind === "template" ? "模板已保存，准备报告时可直接选择使用。" : "材料已自动选中，直接选择接下来要做的事。"}</p></div><div class="next-step-actions">${onlyTemplate ? '<button type="button" class="button primary" data-action="upload-experiment">上传实验材料</button>' : upload.kind === "experiment" || upload.kind === "template" ? '<a class="button primary" href="#report">准备实验报告 →</a><a class="button" href="#outline">整理知识点</a>' : '<a class="button primary" href="#outline">生成知识清单 →</a><a class="button" href="#chat">向小猫提问</a>'}</div></section>`;
}
function gettingStarted() {
  const course = state.courses.find((c) => c.id === state.course);
  return `<nav class="start-path" aria-label="开始学习的三个步骤"><strong>开始很简单</strong><button type="button" data-action="focus-course"><b>1</b><span>选课程：${h(course.name)}</span></button><a href="#materials"><b>2</b><span>${state.materials.length ? `已有 ${state.materials.length} 份材料 · 管理材料` : "上传课件或实验材料"}</span></a><a href="#outline"><b>3</b><span>整理知识，开始学习</span></a></nav>`;
}
function showFileSelection() {
  const input = $("#upload-form [name=files]");
  const display = $("#file-selection");
  if (!input || !display) return;
  const files = [...input.files];
  display.textContent = files.length
    ? `已选 ${files.length} 份：${files.map((file) => file.name).join("、")}。点击“上传并解析”完成上传。`
    : "还未选择文件";
}
document.addEventListener("dragover", (event) => {
  const zone = event.target.closest("#upload-form .dropzone");
  if (!zone || state.busy) return;
  event.preventDefault();
  zone.classList.add("drag-active");
});
document.addEventListener("dragleave", (event) => {
  const zone = event.target.closest("#upload-form .dropzone");
  if (zone && !zone.contains(event.relatedTarget))
    zone.classList.remove("drag-active");
});
document.addEventListener("drop", (event) => {
  const zone = event.target.closest("#upload-form .dropzone");
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove("drag-active");
  if (state.busy) return;
  if (event.dataTransfer.files.length) {
    $("[name=files]", zone).files = event.dataTransfer.files;
    showFileSelection();
  }
});

const catPrompts = {
  agent: "告诉我你想学什么，我会先确定任务和章节，再帮你完成喵。",
  home: "喵～今天也陪你一点点弄懂。先选一门课程吧！",
  materials: "把讲义和实验材料放进来，我会帮你找出处喵。",
  outline: "先看知识点，再把机制串起来。我们一步一步来～",
  chat: "哪里还没懂？带上课程材料，来问问小猫吧。",
  teach: "试着讲给我听，不用一次就讲得完美喵。",
  report: "固定内容我来整理，真实数据和观察由你记录～",
  practice: "先试着回答，再看解析。错题也是进步的线索喵。",
  figures: "记得对照教材确认标注，再来和我玩指图练习。",
  review: "先合上材料，回忆一下。记不住的地方明天再见～",
  settings: "在这里连接你的模型。摸摸小猫不需要调用 API 喵。",
};
let catTimer;
let petCount = 0;
function updateCatVisuals() {
  document.body.dataset.catMotion = state.catMotion ? "on" : "off";
  document
    .querySelectorAll("[data-cat]")
    .forEach((node) => (node.dataset.catState = state.catMood));
  const labels = {
    idle: "陪伴中",
    thinking: "认真思考",
    success: "完成啦",
    error: "需要检查",
    petting: "被摸摸啦",
  };
  document
    .querySelectorAll(".cat-state-label")
    .forEach((node) => (node.textContent = labels[state.catMood]));
  $("#cat-message").textContent = state.catMessage;
  $("#cat-companion").dataset.expanded = String(state.catExpanded);
  $(".cat-companion-button").setAttribute(
    "aria-expanded",
    String(state.catExpanded),
  );
  const toggle = $("#cat-motion-toggle");
  toggle.textContent = state.catMotion ? "暂停动画" : "开启动画";
  toggle.setAttribute("aria-pressed", String(state.catMotion));
  toggle.setAttribute(
    "aria-label",
    state.catMotion ? "暂停猫咪动画" : "开启猫咪动画",
  );
  if (state.catMood !== "thinking") $("#tutor-thinking")?.remove();
  window.KittenPet?.sync({ mood: state.catMood, busy: state.busy, expanded: state.catExpanded, motion: state.catMotion });
}
function setCatState(mood, message, expand = false) {
  clearTimeout(catTimer);
  state.catMood = mood;
  state.catMessage = message || catPrompts[state.view];
  if (expand) state.catExpanded = true;
  updateCatVisuals();
  if (["success", "error", "petting"].includes(mood)) {
    catTimer = setTimeout(
      () => {
        if (state.busy || state.catMood !== mood) return;
        state.catMood = "idle";
        state.catMessage = catPrompts[state.view];
        if (mood !== "petting") state.catExpanded = false;
        updateCatVisuals();
      },
      mood === "error" ? 8000 : 4200,
    );
  }
}
function heroCat() {
  return `<div class="hero-cat" data-cat data-cat-state="${state.catMood}"><span class="cat-hello">喵，今天也一起加油！</span><span class="cat-star one" aria-hidden="true">✦</span><span class="cat-star two" aria-hidden="true">✧</span><span class="cat-star three" aria-hidden="true">✦</span><span class="cat-halo" aria-hidden="true"></span><button type="button" class="hero-cat-button" data-action="pet-cat" aria-label="摸摸小猫"><span class="cat-love" aria-hidden="true">♥</span><span class="cat-thought" aria-hidden="true"><i></i><i></i><i></i></span><img class="cat-image" src="/assets/kitten.png" alt="抱着薄荷绿课本的奶油色小猫" /></button><span class="cat-badge"><span class="status-dot"></span>你的学习伙伴 · <span class="cat-state-label">陪伴中</span></span></div>`;
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 145000);
  try {
    const response = await fetch("/api" + path, {
      ...options,
      signal: controller.signal,
      headers:
        options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) {
      let message = data.detail || "操作失败，请重试。";
      if (Array.isArray(message))
        message = message.map((item) => item.msg).join("；");
      throw new Error(message);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("请求超时，请检查 API 连接或减少材料范围。");
    if (error instanceof TypeError)
      throw new Error("无法连接本地服务，请检查启动窗口是否仍在运行。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
const post = (path, data = {}) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
let toastTimer;
function toast(message, error = false) {
  const node = $("#toast");
  node.textContent = message;
  node.className = "visible" + (error ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.className = ""), error ? 8000 : 4200);
}
async function task(button, fn) {
  if (state.busy) return;
  const learningAction = button?.closest("#outline-form, #chat-form, #teach-form, #report-form, #quiz-form, #compare-form, #grade-form, #review-form, #figure-grade-form");
  state.busy = true;
  setCatState("thinking", "稍等喵，我正在认真帮你处理～");
  if (state.view === "chat" && button?.closest("#chat-form")) {
    $("#chat-thread").insertAdjacentHTML(
      "beforeend",
      '<div class="message assistant" id="tutor-thinking"><span class="message-icon"><img src="/assets/kitten.png" alt="" /></span><div class="tutor-thinking-bubble">小猫正在阅读课程材料<span class="typing-dots"><i></i><i></i><i></i></span></div></div>',
    );
    $("#chat-thread").scrollTop = $("#chat-thread").scrollHeight;
  }
  let succeeded = false;
  const old = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> 正在处理…';
  }
  $("#course-select").disabled = true;
  const errorBox = $("#task-error");
  if (errorBox) errorBox.innerHTML = "";
  try {
    await fn();
    succeeded = true;
  } catch (error) {
    setCatState(
      "error",
      "这一步需要再检查一下喵。看看页面提示，我们一起解决。",
      true,
    );
    toast(error.message, true);
    if ($("#task-error"))
      $("#task-error").innerHTML =
        `<div class="notice error">${h(error.message)}${/API|密钥/.test(error.message) ? ' <a href="#settings">打开 API 设置 →</a>' : ""}</div>`;
  } finally {
    state.busy = false;
    if (succeeded)
      setCatState("success", "这一步完成啦！接下来慢慢核对内容喵～");
    if (succeeded && learningAction) window.KittenPet?.rewardStudy();
    $("#course-select").disabled = false;
    if (button?.isConnected) {
      button.disabled = false;
      button.innerHTML = old;
    }
    updateReadiness();
  }
}
async function loadData() {
  const [materials, artifacts, reviews, figures, agentThreads] = await Promise.all([
    api(`/materials?course=${state.course}`),
    api(`/artifacts?course=${state.course}`),
    api(`/reviews?course=${state.course}`),
    api(`/figures?course=${state.course}`),
    api(`/agent/threads?course=${state.course}`),
  ]);
  state.materials = materials;
  state.artifacts = artifacts;
  state.reviews = reviews;
  state.figures = figures;
  state.agentThreads = agentThreads;
  const existing = new Set(materials.map((m) => m.id));
  state.selected = new Set(
    [...state.selected].filter((id) => existing.has(id)),
  );
}
function navigate(view) {
  if (state.busy) {
    toast("当前任务正在处理，请稍候。");
    return false;
  }
  if (!nav.some((n) => n[0] === view)) view = "home";
  state.view = view;
  state.output = null;
  state.quizGrade = null;
  state.reviewAnswer = null;
  $("#sidebar").classList.remove("open");
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
  return true;
}
async function switchCourse(id) {
  if (state.busy) return;
  state.course = id;
  localStorage.setItem("medstudy-course", id);
  state.output = null;
  state.chat = [];
  state.agentThread = null;
  state.scopeState = { mode: "all", material_id: "", chapter_id: "", start_unit: "", end_unit: "" };
  state.figure = null;
  state.selected.clear();
  state.quizGrade = null;
  state.reviewAnswer = null;
  await loadData();
  state.materials
    .filter((m) => m.kind !== "template")
    .forEach((m) => state.selected.add(m.id));
  $("#course-select").value = id;
  render();
}
function selectedIds() {
  const ids = [...state.selected];
  if (!ids.length) throw new Error("请先上传并选择至少一份课程或实验材料。");
  return ids;
}
function payload(extra = {}) {
  return { course: state.course, material_ids: selectedIds(), scopes: studyScopes(), ...extra };
}

function studyScopes() {
  const s = state.scopeState;
  if (s.mode === "all") return [];
  if (!state.selected.has(s.material_id)) throw new Error("请选择限定范围所属的材料。");
  if (s.mode === "chapter") {
    if (!s.chapter_id) throw new Error("请选择要整理的章节；没有可靠目录时可改用手动位置范围。");
    return [{ material_id: s.material_id, chapter_id: s.chapter_id }];
  }
  if (!s.start_unit || !s.end_unit) throw new Error("请同时选择范围的开始和结束位置。");
  return [{ material_id: s.material_id, start_unit: s.start_unit, end_unit: s.end_unit }];
}
function rangeSelector() {
  const s = state.scopeState;
  const items = state.materials.filter(m => state.selected.has(m.id) && m.kind !== "template");
  const catalog = state.catalogs[s.material_id];
  const chapter = catalog?.chapters.find(c => c.id === s.chapter_id);
  const options = (values, selected) => '<option value="">请选择位置</option>' + values.map(unit => `<option value="${h(unit)}" ${selected === unit ? "selected" : ""}>${h(unit)}</option>`).join("");
  return `<details class="range-selector" ${s.mode !== "all" ? "open" : ""}><summary>限定章节或位置 · ${s.mode === "all" ? "未限定章节" : chapter ? h(chapter.title) : "请核对所选范围"}</summary><div class="form-grid"><label class="field"><span>范围方式</span><select class="control" id="scope-mode"><option value="all" ${s.mode === "all" ? "selected" : ""}>所选材料的相关片段</option><option value="chapter" ${s.mode === "chapter" ? "selected" : ""}>只整理指定章节</option><option value="range" ${s.mode === "range" ? "selected" : ""}>手动选择页码 / 位置</option></select></label>${s.mode !== "all" ? `<label class="field"><span>目标文件</span><select class="control" id="scope-material"><option value="">请选择材料</option>${items.map(m => `<option value="${h(m.id)}" ${s.material_id === m.id ? "selected" : ""}>${h(m.title)}</option>`).join("")}</select></label>` : ""}</div>${s.mode !== "all" && catalog ? s.mode === "chapter" ? `<label class="field"><span>目录章节</span><select class="control" id="scope-chapter"><option value="">请选择章节</option>${catalog.chapters.map(c => `<option value="${c.id}" ${c.id === s.chapter_id ? "selected" : ""}>${h(c.title)}（${h(c.start_unit)} — ${h(c.end_unit)}）</option>`).join("")}</select></label>${catalog.chapters.length ? "" : '<p class="notice">没有可靠的章节标题，请改用手动位置范围；不会自动扩大到整份文件。</p>'}` : `<div class="form-grid"><label class="field"><span>开始位置</span><select class="control" id="scope-start">${options(catalog.units,s.start_unit)}</select></label><label class="field"><span>结束位置</span><select class="control" id="scope-end">${options(catalog.units,s.end_unit)}</select></label></div>` : ""}<p class="small-copy">${s.mode === "all" ? "关键词用于寻找相关片段。若只需要某章，请在这里明确限定。" : "仅发送这个文件在所选范围内的文字。PDF 使用文件物理页，扫描页仍需先 OCR；章节识别结果请对照原文核对。"}</p></details>`;
}
async function setScopeMaterial(id) {
  state.scopeState.material_id = id;
  state.scopeState.chapter_id = state.scopeState.start_unit = state.scopeState.end_unit = "";
  if (id && !state.catalogs[id]) state.catalogs[id] = await api(`/materials/${id}/chapters`);
}
async function applyAgentScope(thread) {
  const s = thread.last_scopes?.[0];
  if (s) {
    state.scopeState = { mode: s.chapter_id ? "chapter" : "range", material_id: s.material_id, chapter_id: s.chapter_id || "", start_unit: s.start_unit || "", end_unit: s.end_unit || "" };
    if (!state.catalogs[s.material_id]) state.catalogs[s.material_id] = await api(`/materials/${s.material_id}/chapters`);
  } else state.scopeState = { mode: "all", material_id: "", chapter_id: "", start_unit: "", end_unit: "" };
}
document.addEventListener("change", async event => {
  const id = event.target.id;
  if (id === "agent-thread-select" && !state.busy) {
    try {
      if (event.target.value) {
        state.agentThread = await api(`/agent/threads/${event.target.value}?course=${state.course}`);
        const existing = new Set(state.materials.map(m => m.id));
        state.selected = new Set(state.agentThread.selection.filter(id => existing.has(id)));
        await applyAgentScope(state.agentThread);
      } else state.agentThread = null;
      state.output = null;
      state.quizGrade = null;
      render();
    } catch (error) { toast(error.message,true); }
    return;
  }
  if (!id.startsWith("scope-") || state.busy) return;
  try {
    const s = state.scopeState;
    if (id === "scope-mode") {
      s.mode = event.target.value;
      if (s.mode !== "all" && !state.selected.has(s.material_id)) await setScopeMaterial([...state.selected][0] || "");
    } else if (id === "scope-material") await setScopeMaterial(event.target.value);
    else if (id === "scope-chapter") s.chapter_id = event.target.value;
    else if (id === "scope-start") s.start_unit = event.target.value;
    else if (id === "scope-end") s.end_unit = event.target.value;
    render();
  } catch (error) { toast(error.message,true); }
});
function pdfLink(a) {
  return `<a class="button small pdf-download" href="/api/artifacts/${h(a.id)}/pdf">${a.kind === "report" ? "下载 PDF 阅读版 ↓" : "下载 PDF ↓"}</a>`;
}
function renderAgentResult(a) {
  if (a.kind === "outline") return renderOutline(a);
  if (a.kind === "report") return renderReport(a);
  if (a.kind === "feedback") return renderFeedback(a);
  if (["quiz","compare"].includes(a.kind)) return renderPractice(a);
  return `<section class="result-container card">${coverage(a.data)}<div class="result-heading"><h2>${h(a.title)}</h2>${pdfLink(a)}</div><p class="prose">${h(a.data.answer)}</p>${sources(a.data.sources)}<div class="notice">继续思考：${h(a.data.follow_up)}</div></section>`;
}
function agentPage() {
  const messages = state.agentThread?.messages || [];
  return heading("把学习任务交给小家伙。", "直接说需求。先问清楚范围，再整理知识、答疑、出题或准备报告。") +
    `<section class="card agent-workspace"><div class="agent-toolbar"><label class="field"><span>当前课程的会话</span><select class="control" id="agent-thread-select"><option value="">新会话</option>${state.agentThreads.map(t => `<option value="${h(t.id)}" ${state.agentThread?.id === t.id ? "selected" : ""}>${h(t.title)}</option>`).join("")}</select></label><button class="button" type="button" data-action="new-agent">新建会话</button></div><div class="agent-thread" id="agent-thread" aria-live="polite">${messages.length ? messages.map(m => `<article class="agent-message ${m.role}"><strong>${m.role === "user" ? "你" : "小家伙"}</strong><p class="prose">${h(m.content)}</p>${(m.results || []).map(r => r.status === "completed" ? `<div class="agent-result-card"><button type="button" class="text-button" data-action="agent-result" data-id="${h(r.artifact_id)}">查看 ${h(r.title)} →</button><a class="button small" href="/api/artifacts/${h(r.artifact_id)}/pdf">下载 PDF ↓</a></div>` : `<div class="notice error">${h(r.error)}</div>`).join("")}</article>`).join("") : '<div class="agent-welcome"><img src="/assets/kitten.png" alt="小猫学习智能体"><div><h2>想学什么，直接告诉我。</h2><p>“只整理第二章的知识清单，再出 5 道小测。”<br>“我还没想好怎么复习，先帮我确定任务。”</p></div></div>'}</div><form id="agent-form">${sourceSelector()}${state.materials.some(m => m.kind === "template") ? `<label class="field"><span>生成实验报告时使用的模板（选填）</span><select class="control" name="report_template_id"><option value="">五栏标准报告结构</option>${state.materials.filter(m => m.kind === "template").map(m => `<option value="${h(m.id)}">${h(m.title)}</option>`).join("")}</select></label>` : ""}<label class="field"><span>告诉小家伙你的要求</span><textarea name="message" rows="3" maxlength="6000" required placeholder="例如：只用这份讲义第二章，整理机制知识清单，保留网页结果并提供 PDF。不要填写 API 密钥。"></textarea></label><div class="button-row"><button type="submit" class="button primary">交给小家伙 →</button><span class="small-copy">会话与结果保存在本机；下载 PDF 不调用模型。</span></div>${taskError()}</form></section>${state.output ? renderAgentResult(state.output) : ""}`;
}
function heading(title, subtitle, eyebrow = "LEARN WITH UNDERSTANDING") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="date-chip">${icon("calendar")}${new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date())}</div></div>`;
}
const empty = (title, text, view = "", label = "上传课程材料") =>
  `<div class="empty">${icon("materials")}<h3>${title}</h3><p>${text}</p>${view ? `<a class="button soft" href="#${view}">${label}${icon("arrow")}</a>` : ""}</div>`;
function sourceSelector() {
  const items = state.materials.filter((m) => m.kind !== "template");
  return `<details class="sources-selector"><summary><span class="source-summary-text">学习依据 · 已选择 ${state.selected.size} / ${items.length} 份材料</span><span class="source-change-hint">点击更换</span></summary>${items.length ? `<div class="source-actions"><button class="button small" type="button" data-action="select-sources" data-mode="all">全选</button><button class="button small" type="button" data-action="select-sources" data-mode="none">清空</button>${state.view === "report" ? '<button class="button small" type="button" data-action="select-sources" data-mode="experiment">仅实验材料</button>' : ""}</div>` : ""}<div class="selector-items">${items.length ? items.map((m) => `<label><input type="checkbox" data-source-select="${h(m.id)}" ${state.selected.has(m.id) ? "checked" : ""}>${h(m.title)} <span class="pill gray">${kindNames[m.kind]}</span></label>`).join("") : '<a href="#materials">先上传课程或实验材料 →</a>'}</div><div class="small-copy">仅所选材料的相关文字片段会发送给你配置的 API。</div></details>` + rangeSelector();
}
function sources(items = []) {
  return `<div class="source-list">${items.map((s) => (s.figure_id ? `<button type="button" class="source-link" data-action="figure-source" data-id="${h(s.figure_id)}" data-x="${s.x ?? ""}" data-y="${s.y ?? ""}">${h(s.title)} · 图片标注</button>` : `<button type="button" class="source-link" data-action="source" data-id="${h(s.material_id)}" data-unit="${h(s.unit)}" title="查看材料原文">${h(s.title || "课程材料")} · ${h(s.unit)}</button>`)).join("")}</div>`;
}
function coverage(data) {
  const e = data.evidence;
  const range = e?.scope_limited ? `<div class="notice scope-coverage"><strong>本次仅使用所选范围</strong>${e.ranges.map(r => `<p>${h(r.title)} · ${h(r.label)} · ${h(r.start_unit)} — ${h(r.end_unit)}</p>`).join("")}</div>` : "";
  return range + (e?.partial
    ? `<div class="notice warn">本次使用 ${e.selected_materials} 份材料中的 ${e.used_chunks} / ${e.total_chunks} 个文字片段。输出覆盖相关片段；如需完整章节，请缩小材料范围并分批生成。</div>`
    : "");
}
function savedHistory(kinds) {
  const items = state.artifacts.filter((a) => kinds.includes(a.kind));
  if (!items.length) return "";
  return `<details class="history"><summary>已保存的学习记录 · ${items.length} 条</summary><div class="history-list">${items
    .slice(0, 40)
    .map(
      (a) =>
        `<button class="button small" data-action="artifact" data-id="${h(a.id)}">${h(a.title)} <span class="muted">${h(artifactNames[a.kind])}</span></button>`,
    )
    .join("")}</div></details>`;
}
const taskError = () => '<div id="task-error" class="inline-error"></div>';

function homePage() {
  const course = state.courses.find((c) => c.id === state.course);
  const courses = state.courses
    .map(
      (c, i) =>
        `<button class="course-card ${c.id === state.course ? "current" : ""}" data-action="course" data-id="${c.id}"><span class="course-symbol">${icon(["heart", "figures", "cell", "molecule"][i])}</span><div><h3>${h(c.name)}</h3><p>${c.id === state.course ? state.materials.length : c.materials} 份材料 · ${h(c.description)}</p></div><span class="arrow">↗</span></button>`,
    )
    .join("");
  return (
    heading(
      "小家伙的小家伙",
      "一点点理解，有小猫陪你。这里是你的基础医学学习小天地。",
      "A LITTLE COMPANION, A LITTLE PROGRESS",
    ) +
    `${gettingStarted()}<a class="agent-home-entry" href="#agent"><span>✦ 学习智能体</span><strong>不想来回切换功能？直接告诉小家伙你的学习要求。</strong><span>开始对话 →</span></a><div class="dashboard-layout"><div><section class="hero"><div><div class="eyebrow">${h(course.name)} · 学习空间</div><h2>今天也和你一起，<br>把知识一点点弄懂。</h2><p>整理讲义、准备实验、练习回忆。<br>小猫陪你，把学习变成自己的节奏。</p><a class="button" href="#materials">${state.materials.length ? "管理我的课程材料" : "上传第一份课程材料"}${icon("arrow")}</a></div>${heroCat()}</section><div class="section-heading"><h2>我的课程 <small>基础医学 · 4 门课程</small></h2><a class="text-button" href="#materials">管理材料 →</a></div><div class="course-grid">${courses}</div><div class="section-heading"><h2>从这里开始 <small>把重复工作交给工具，把思考留给自己</small></h2></div><div class="task-grid"><a class="task-card" href="#outline">${icon("outline")}<h3>整理课件</h3><p>生成知识清单，串起机制。</p><span>开始整理 →</span></a><a class="task-card" href="#chat">${icon("chat")}<h3>问小猫</h3><p>带着问题，弄懂一个知识点。</p><span>开始提问 →</span></a><a class="task-card" href="#report">${icon("report")}<h3>准备实验报告</h3><p>整理固定内容，真实数据自己填。</p><span>准备报告 →</span></a><a class="task-card" href="#practice">${icon("practice")}<h3>做题与复习</h3><p>章节小测、易混辨别、错题复习。</p><span>开始练习 →</span></a></div><div class="workflow-line"><span>${icon("check")}材料有出处</span><span>${icon("check")}复习有节奏</span><span>${icon("check")}实验与学习相连</span></div></div><aside class="aside-stack"><section class="card"><div class="card-title"><h2>今日复习</h2><span class="pill">${h(course.name)}</span></div><div class="review-number">${state.reviews.length}<span style="font-size:calc(14px * var(--font-scale));color:var(--muted);margin-left:8px">项待回忆</span></div><p class="small-copy">短时主动回忆，让学过的内容留下来。</p><div class="review-preview">${
      state.reviews.length
        ? state.reviews
            .slice(0, 3)
            .map(
              (r, i) =>
                `<div class="mini-item"><span class="small-number">0${i + 1}</span><span>${h(r.question)}</span></div>`,
            )
            .join("")
        : '<p class="small-copy">生成知识清单并加入回忆，或完成小测后，复习任务会出现在这里。</p>'
    }</div><a href="#review" class="button soft full">开始今日复习 ${icon("arrow")}</a></section><section class="card note-card"><div class="eyebrow">A SMALL STUDY NOTE</div><h3>如果你能讲清楚“为什么”，<br>就离真正理解更近一步。</h3><p>复习时先合上材料，尝试串起“变化 → 机制 → 结果”，再对照课程内容补上缺失的环节。</p></section><section class="card"><div class="card-title"><h2>工作台状态</h2><span class="status-dot"></span></div><p class="small-copy">材料与记录保存在本机。<br>${state.settings.key_present ? "API 密钥已输入，本次运行可用。" : "配置 API 后即可使用 AI 学习功能。"}<br>指图练习无需 API。</p><a href="#settings" class="text-button">查看 API 设置 →</a></section></aside></div>`
  );
}
function materialsPage() {
  return (
    heading(
      "让课程材料，各就其位。",
      "按课程收集讲义、实验内容和报告模板。后续学习都会关联这些来源。",
      "COURSE LIBRARY",
    ) +
    `<div class="two-column"><div><form id="upload-form" class="card"><div class="card-title"><h2>上传材料</h2><span class="pill">${h(state.courses.find((c) => c.id === state.course).name)}</span></div><label class="field"><span>材料用途</span><select name="kind" class="control"><option value="course">课程材料 · PPT / 讲义</option><option value="experiment">实验材料 · 实验原理与操作内容</option><option value="template">报告模板 · 学校要求的报告格式</option></select></label><label class="dropzone">${icon("upload")}<strong>点击选择文件，或把文件拖到这里</strong><small>PDF / PPTX / DOCX / TXT / MD · 单文件不超过 25 MB<br>支持一次选择多份材料</small><input type="file" name="files" accept=".pdf,.pptx,.docx,.txt,.md" multiple required><span id="file-selection" class="file-selection" aria-live="polite">还未选择文件</span></label><button class="button primary" type="submit">上传并解析 ${icon("arrow")}</button>${taskError()}</form>${uploadNextStep()}<div class="section-heading"><h2>当前课程材料 <small>${state.materials.length} 份</small></h2></div><section class="card">${state.materials.length ? state.materials.map((m) => `<div class="list-row"><span class="file-icon">${h(m.title.split(".").pop().toUpperCase())}</span><div class="list-info"><h3>${h(m.title)}</h3><p>${kindNames[m.kind]} · ${m.units} 个来源位置</p>${m.warnings.map((w) => `<p style="color:var(--orange)">${h(w)}</p>`).join("")}</div><div class="list-actions"><button class="button small" data-action="source" data-id="${m.id}">查看原文</button><button class="text-button" style="color:var(--red)" data-action="delete-material" data-id="${m.id}">删除</button></div></div>`).join("") : empty("还没有课程材料", "先上传一份 PPT 或讲义，开启这门课程的学习空间。")}</section></div><aside class="aside-stack"><section class="card"><div class="card-title"><h2>材料怎么用？</h2></div><ul class="check-list"><li>课程材料<small>用于知识清单、答疑和小测。</small></li><li>实验材料<small>用于报告固定内容和实验学习卡。</small></li><li>报告模板<small>用于报告结构与版式，不作为医学事实来源。</small></li></ul></section><section class="card note-card"><h3>给材料一个清晰的范围</h3><p>按章节上传更利于定位出处。扫描 PDF 和 PPT 内的图片不会自动识别；请先 OCR，或把图片上传到指图学习。</p></section></aside></div>`
  );
}
function outlinePage() {
  return (
    heading(
      "先看清知识，再建立联系。",
      "从课程材料提取知识点、机制链和主动回忆问题。",
      "KNOWLEDGE MAP",
    ) +
    savedHistory(["outline"]) +
    `<form id="outline-form" class="card">${sourceSelector()}<div class="form-grid"><label class="field"><span>本次学习主题（选填）</span><input name="topic" type="text" maxlength="1000" placeholder="例如：心肌兴奋性、细胞损伤、糖酵解"></label><div class="small-copy" style="padding-top:28px">章节边界请在上方选择；主题留空时按当前范围整理。长章节可分批处理。</div></div><label class="field"><span>补充要求（选填）</span><textarea name="instructions" rows="2" maxlength="2000" placeholder="例如：只列 5 个重点，每点解释不超过 100 字，突出机制因果链。"></textarea></label><button class="button primary" type="submit">生成知识清单 ${icon("arrow")}</button>${taskError()}</form>${state.output?.kind === "outline" ? renderOutline(state.output) : ""}`
  );
}
function renderOutline(a) {
  const d = a.data;
  return `<section class="result-container">${coverage(d)}<div class="result-heading"><h2>${h(a.title)}</h2>${pdfLink(a)}<button class="button soft" data-action="recall" data-id="${a.id}">加入主动回忆 ${icon("review")}</button></div><p class="prose" style="margin-bottom:20px">${h(d.summary)}</p><div class="knowledge-grid">${d.items.map((item, i) => `<article class="card knowledge-card"><span class="pill ${item.importance === "拓展" ? "sand" : ""}">${h(item.importance)}</span><span class="muted" style="float:right;font-size:calc(14px * var(--font-scale))">${String(i + 1).padStart(2, "0")}</span><h3>${h(item.term)}</h3><p class="prose">${h(item.explanation)}</p><div class="recall-prompt">试着回忆：${h(item.recall_question)}</div>${sources(item.sources)}</article>`).join("")}</div>${d.connections.length ? `<div class="section-heading"><h2>把机制串起来</h2></div><section class="card">${d.connections.map((c) => `<div class="mechanism"><h3>${h(c.chain)}</h3><p class="prose">${h(c.explanation)}</p>${sources(c.sources)}</div>`).join("")}</section>` : ""}</section>`;
}
function chatPage() {
  const thread = state.chat.length
    ? state.chat
        .map((m) =>
          m.role === "user"
            ? `<div class="message user"><div class="bubble">${h(m.content)}</div></div>`
            : `<div class="message assistant"><span class="message-icon"><img src="/assets/kitten.png" alt="小猫助教" /></span><div class="bubble"><p class="prose">${h(m.content)}</p>${m.artifact_id ? pdfLink({id:m.artifact_id}) : ""}${sources(m.sources)}${m.follow_up ? `<div class="follow-up">再想一步：${h(m.follow_up)}</div>` : ""}${m.evidence?.partial ? '<p class="small-copy">本次依据材料的相关片段回答。</p>' : ""}</div></div>`,
        )
        .join("")
    : empty("你的课程助教已就位", "先选择课程材料，再提出一个你想弄懂的问题。");
  const reading = `<section class="card"><div class="card-title"><h2>课程补充阅读</h2><span class="pill gray">英文</span></div>${resources[state.course].map(([title, url, note]) => `<a class="suggestion" href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(title)} ↗<small class="small-copy" style="display:block;margin-top:6px">${h(note)}</small></a>`).join("")}<p class="small-copy" style="margin-top:12px">优先使用教师指定教材；外部教材的章节与术语可能不同。</p></section>`;
  return (
    heading(
      "一个问题，一起想明白。",
      "依据你上传的课程材料答疑，解释机制，并指向可核对的原文。",
      "YOUR COURSE TUTOR",
    ) +
    savedHistory(["chat"]) +
    `<div class="chat-layout"><section class="card">${sourceSelector()}<div class="chat-thread" id="chat-thread">${thread}</div><form id="chat-form" class="composer"><textarea name="message" placeholder="例如：为什么血压升高后，压力感受性反射会使心率减慢？" maxlength="6000" required></textarea><div class="button-row"><button class="button primary" type="submit">向助教提问 ${icon("arrow")}</button><span class="small-copy">答案可通过来源标签核对。</span></div>${taskError()}</form></section><aside class="aside-stack"><section class="card"><div class="card-title"><h2>可以这样问</h2></div>${["请用因果链解释这个章节的主要机制。", "这两个概念有什么区别？请结合材料举例。", "先不要告诉我答案，给我一个提示。"].map((q) => `<button class="suggestion" data-action="suggest" data-text="${h(q)}">${q}</button>`).join("")}</section>${reading}<section class="card note-card"><h3>把“是什么”再问深一步</h3><p>试着追问“为什么发生”“哪个环节改变”“改变后会怎样”，让记忆有机制支撑。</p></section></aside></div>`
  );
}
function teachPage() {
  return (
    heading(
      "讲出来，才能发现没懂的地方。",
      "用自己的话解释一个知识点，助教会帮你找出遗漏与因果错误。",
      "TEACH IT BACK",
    ) +
    savedHistory(["feedback"]) +
    `<form class="card" id="teach-form">${sourceSelector()}<label class="field"><span>你要讲解的主题</span><input name="topic" type="text" maxlength="1000" placeholder="例如：细胞凋亡的机制" required></label><label class="field"><span>像讲给同学听一样，写下你的解释</span><textarea name="explanation" minlength="5" maxlength="6000" rows="6" required placeholder="先写出你已经理解的部分，不需要先把讲义抄一遍。你可以从原因、过程和结果三个方面解释。"></textarea><small>第一版支持文字讲解。收到反馈后，可以修改这段解释并再次检查。</small></label><button class="button primary" type="submit">请助教检查理解 ${icon("arrow")}</button>${taskError()}</form>${state.output?.kind === "feedback" ? renderFeedback(state.output) : ""}`
  );
}
function renderFeedback(a) {
  const d = a.data;
  const blocks = (arr) =>
    arr.length
      ? arr
          .map(
            (c) =>
              `<div class="feedback-block"><blockquote>${h(c.student_claim)}</blockquote><p>${h(c.feedback)}</p>${sources(c.sources)}</div>`,
          )
          .join("")
      : '<p class="small-copy">本次未发现需要指出的内容。</p>';
  return `<section class="result-container">${coverage(d)}<div class="result-heading"><h2>讲解反馈</h2>${pdfLink(a)}</div><div class="feedback-grid"><section class="card"><div class="card-title"><h2>已经讲清楚</h2><span class="pill">继续保持</span></div><ul class="check-list">${d.understood.map((s) => `<li>${h(s)}</li>`).join("") || "<li>先从一个简单环节开始解释。</li>"}</ul></section><section class="card"><div class="card-title"><h2>需要修正</h2><span class="pill sand">理解校准</span></div>${blocks(d.corrections)}</section></div><section class="card" style="margin-top:15px"><div class="card-title"><h2>还可以补上的环节</h2></div>${blocks(d.missing)}<div class="notice" style="margin-top:18px;margin-bottom:0">下一步，试着回答：${h(d.next_question)}</div></section></section>`;
}
function reportPage() {
  const templates = state.materials.filter((m) => m.kind === "template");
  return (
    heading(
      "少一点重复，多一点实验思考。",
      "按学校模板写好固定内容与理论分析，逐项标明该粘贴的图片和该填写的数据。",
      "EXPERIMENT WORKSPACE",
    ) +
    savedHistory(["report"]) +
    `<div class="two-column"><form id="report-form" class="card">${sourceSelector()}<label class="field"><span>实验名称</span><input type="text" name="title" maxlength="100" required placeholder="例如：温度和 pH 对酶活性的影响"></label><label class="field"><span>报告模板</span><select class="control" name="template_id"><option value="">使用标准报告结构</option>${templates.map((t) => `<option value="${t.id}">${h(t.title)}</option>`).join("")}</select><small>保留 DOCX 模板章节、封面和页边距，清除旧正文与示例图片；不识别的格式会先提示。<a href="#materials">上传学校模板 →</a></small></label><details class="report-details"><summary>填写封面信息（选填，可在 Word 中补填）</summary><div class="form-grid">${[["course_name","课程名称"],["name","姓名"],["student_id","学号"],["college","学院"],["department","系"],["major","专业"],["instructor","指导老师"],["group","同组学生"],["location","实验地点"],["date","实验日期"],["experiment_type","实验类型"]].map(([key,label]) => `<label class="field"><span>${label}</span><input type="text" name="detail_${key}" maxlength="${key === "group" ? 200 : 100}" placeholder="未填时保留空白，不沿用模板示例信息"></label>`).join("")}</div></details><label class="field"><span>补充格式与内容要求（选填）</span><textarea name="instructions" maxlength="2000" rows="2" placeholder="例如：每个观察对象单独留图框，注明通道和倍率；使用学校五栏格式。"></textarea></label><div class="notice">目的、原理、器材、步骤及有依据的理论分析讨论会预先写好。<br>每张图片和每项原始记录都有具体填写位置；实际观察和依赖结果的结论保留标记，不编造实验结果。</div><button type="submit" class="button primary">生成报告与实验学习卡 ${icon("arrow")}</button>${taskError()}</form><aside class="aside-stack"><section class="card"><div class="card-title"><h2>一次上传，两种收获</h2></div><ul class="check-list"><li>按模板排版的 Word 报告</li><li>逐项照片框、图注与数据表</li><li>有出处的理论分析与讨论</li><li>原理与对照设计小测</li><li>错题进入后续复习</li></ul></section><section class="card note-card"><h3>让模板匹配更准确</h3><p>支持“实验目的和要求”“实验内容和原理”“主要仪器设备”“实验结果与分析”“讨论、心得”等学校标题。没有模板时使用五栏标准结构；也可下载空白模板。</p><a class="button small" style="margin-top:15px" href="/api/template">下载占位符模板 ↓</a></section></aside></div>${state.output?.kind === "report" ? renderReport(state.output) : ""}`
  );
}
function reportBlock(b) {
  if (b.kind === "table") return `<div class="report-record"><h4>${h(b.title)}</h4><div class="report-table-scroll"><table class="report-record-table"><thead><tr>${[b.subject_label,...b.fields].map(t => `<th>${h(t)}</th>`).join("")}</tr></thead><tbody>${b.subjects.map(subject => `<tr><th>${h(subject)}</th>${b.fields.map(field => `<td class="report-fill">【填写：${h(field)}】</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="small-copy">${h(b.note)}</p>${sources(b.sources)}</div>`;
  if (b.kind === "figure") return `<div class="report-figure"><div class="report-photo-slot"><strong>在此粘贴图 ${b.index}：${h(b.title)}</strong><p class="prose">${h(b.instruction)}</p><small>请在下载的 Word 中插入本人本次实验图片</small></div><p class="report-caption">图 ${b.index}　${h(b.caption)}</p>${b.fields.map(field => `<p class="report-fill">【填写：${h(field)}】</p>`).join("")}<p class="report-fill">实际观察：【填写本图真实观察到的结构、颜色、形态与分布；未观察到也如实记录】</p>${sources(b.sources)}</div>`;
  return `<div class="report-prose">${b.title ? `<h4>${h(b.title)}</h4>` : ""}<p class="prose">${h(b.content)}</p>${sources(b.sources)}</div>`;
}
function renderReport(a) {
  const d = a.data;
  const details = d.details || {};
  const content = d.document_sections ? d.document_sections.map(s => `<div class="report-section"><h3>${h(s.title)}</h3>${s.blocks.map(reportBlock).join("")}</div>`).join("") : d.sections.map(s => `<div class="report-section"><h3>${h(s.title)}</h3><p class="prose">${h(s.content)}</p>${sources(s.sources)}</div>`).join("");
  const cover = d.document_sections ? `<div class="report-cover-preview"><strong>实验项目：${h(d.title)}</strong><p>${[["course_name","课程"],["name","姓名"],["student_id","学号"],["date","日期"]].map(([k,label]) => `${label}：${h(details[k] || "待填写")}`).join("　")}</p></div>` : "";
  return `<section class="result-container">${coverage(d)}<div class="result-heading"><h2>${h(d.title)}</h2><div class="button-row" style="margin-top:0"><a class="button primary" href="/api/exports/${d.export_id}">下载 Word ↓</a>${pdfLink(a)}<button class="button soft" data-action="artifact" data-id="${d.quiz_id}">实验学习卡 ${icon("arrow")}</button></div></div>${d.warnings.map(w => `<div class="notice warn">${h(w)}</div>`).join("")}<section class="card">${cover}${content}<div class="pending-section">需要补充：${d.pending.map(p => h(p)).join(" / ")}。<br>理论说明已写好，请依据本次真实记录填写标记位置并核对教师要求。</div></section></section>`;
}
function practicePage() {
  const compare = state.practiceTab === "compare";
  return (
    heading(
      "让理解，经得起换个问法。",
      "先尝试，再看解析。章节练习与易混知识辨别会把错题带入复习。",
      "PRACTICE & CONNECT",
    ) +
    savedHistory(["quiz", "compare"]) +
    `<div class="tabs"><button class="tab ${!compare ? "active" : ""}" data-action="practice-tab" data-tab="quiz">章节小测</button><button class="tab ${compare ? "active" : ""}" data-action="practice-tab" data-tab="compare">易混知识对照</button></div><form class="card" id="${compare ? "compare" : "quiz"}-form">${sourceSelector()}${compare ? `<div class="form-grid"><label class="field"><span>概念 A</span><input name="left" type="text" maxlength="80" required placeholder="例如：坏死"></label><label class="field"><span>概念 B</span><input name="right" type="text" maxlength="80" required placeholder="例如：凋亡"></label></div><label class="field"><span>先辨别：你认为它们有什么区别？</span><textarea name="guess" minlength="5" required placeholder="先写下你的理解，再生成对照表核对。"></textarea><small>这段初步判断供你对照反思；想让助教检查具体说法，可使用“讲给助教听”。</small></label>` : `<div class="form-grid"><label class="field"><span>章节或主题（选填）</span><input name="topic" type="text" maxlength="1000" placeholder="例如：糖代谢的调节"></label><label class="field"><span>题目数量</span><select name="count" class="control"><option value="5">5 道 · 短时练习</option><option value="8">8 道 · 章节巩固</option><option value="10">10 道 · 综合检查</option></select></label></div>`}<button class="button primary" type="submit">${compare ? "生成对照与情境练习" : "生成课程小测"} ${icon("arrow")}</button>${taskError()}</form>${state.output && ["quiz", "compare"].includes(state.output.kind) ? renderPractice(state.output) : ""}`
  );
}
function renderPractice(a) {
  const d = a.data;
  const qs = a.kind === "quiz" ? d.questions : d.practice;
  const result = state.quizGrade;
  const comparison =
    a.kind === "compare"
      ? `<section class="card" style="margin-bottom:20px"><div class="result-heading"><h2>${h(d.left_name)} 与 ${h(d.right_name)}</h2></div><table class="compare-table"><thead><tr><th>比较维度</th><th>${h(d.left_name)}</th><th>${h(d.right_name)}</th></tr></thead><tbody>${d.rows.map((r) => `<tr><td>${h(r.dimension)}</td><td>${h(r.left)}</td><td>${h(r.right)}${sources(r.sources)}</td></tr>`).join("")}</tbody></table><div class="notice" style="margin-top:18px;margin-bottom:0">记忆提示：${h(d.memory_tip)}</div></section><div class="section-heading"><h2>换个情境，再辨别一次</h2></div>`
      : "";
  return `<section class="result-container">${coverage(d)}<div class="result-heading"><h2>${h(a.title)}</h2>${pdfLink(a)}</div>${comparison}${result ? `<div class="score-strip"><strong>${result.correct} / ${result.total}</strong><span>正确题数 · 错题已加入今日复习<br>解析依据课程材料，请核对来源。</span></div>` : ""}<form id="grade-form" data-id="${a.id}">${qs.map((q, i) => `<article class="card quiz-card"><span class="pill gray">第 ${i + 1} 题 · ${h(q.topic)}</span><h3>${h(q.stem)}</h3>${q.options.map((o, j) => `<label class="option ${result ? (j === result.results[i].answer ? "correct" : j === result.results[i].given ? "incorrect" : "") : ""}"><input type="radio" name="q${i}" value="${j}" ${result?.results[i].given === j ? "checked" : ""} ${result ? "disabled" : ""} required><span class="option-letter">${"ABCD"[j]}</span><span>${h(o)}</span></label>`).join("")}${result ? `<div class="answer-explanation">${result.results[i].correct ? "✓ 回答正确" : "请再检查这个知识点"} · 正确答案 ${"ABCD"[result.results[i].answer]}<br>${h(result.results[i].explanation)}</div>${sources(q.sources)}` : ""}</article>`).join("")}${result ? '<a class="button soft" href="#review">去复习错题 →</a>' : '<button class="button primary" type="submit">提交并查看解析</button>'}${taskError()}</form></section>`;
}
function figuresPage() {
  const f = state.figure;
  const edit = state.figureMode === "edit";
  const labels = f?.labels || f?.points || [];
  let panel = "";
  if (f)
    panel = `<div class="tabs"><button class="tab ${edit ? "active" : ""}" data-action="figure-mode" data-mode="edit">建立标注</button><button class="tab ${!edit ? "active" : ""}" data-action="figure-mode" data-mode="practice">隐藏标签练习</button></div><div class="figure-layout"><section class="card"><div class="card-title"><h2>${h(f.title)}</h2><span class="pill gray">${edit ? "点击图片放置标记" : "按编号辨认结构"}</span></div><div class="figure-stage" id="figure-stage"><img src="/api/figures/${f.id}/image" alt="${h(f.title)}">${labels.map((l, i) => `<span class="marker" style="left:${l.x * 100}%;top:${l.y * 100}%">${i + 1}</span>`).join("")}</div><p class="small-copy" style="margin-top:15px">${edit ? "标记位置按图片比例保存。名称可用 / 分隔同义词；练习评分接受这些同义词。" : "请上传没有可见答案标签的原图。系统仅隐藏你建立的标签，不会移除原图上的文字。"}</p></section><section class="card">${edit ? `<form id="labels-form"><div class="card-title"><h2>结构与辨认依据</h2><span class="pill">${labels.length} 个标记</span></div><div class="labels-scroll">${labels.map((l, i) => `<div class="label-editor"><header>标记 ${i + 1}<button type="button" class="text-button" data-action="remove-label" data-id="${h(l.id)}">移除</button></header><label class="field"><span>结构名称</span><input name="name-${h(l.id)}" type="text" value="${h(l.name)}" maxlength="100" required placeholder="例如：细胞核 / nucleus"></label><label class="field"><span>辨认依据与来源（选填）</span><textarea name="explanation-${h(l.id)}" rows="2" maxlength="1000" placeholder="例如：教材第 38 页，染色较深的圆形结构">${h(l.explanation)}</textarea></label></div>`).join("") || '<p class="small-copy">点击图片中的一个结构，添加第一个标记。</p>'}</div><label class="label-check"><input type="checkbox" name="confirmed" ${f.confirmed ? "checked" : ""}>我已对照教师材料或教材确认标注正确</label><div class="button-row"><button class="button primary full" type="submit">保存标注</button></div>${taskError()}</form>` : `<form id="figure-grade-form"><div class="card-title"><h2>这些是什么结构？</h2></div>${labels.map((l, i) => `<label class="field"><span>标记 ${i + 1}</span><input name="${h(l.id)}" type="text" maxlength="100" required ${state.figureGrade ? "disabled" : ""} value="${h(state.figureGrade?.results[i].given || "")}"></label>`).join("")}${state.figureGrade ? `<div class="notice">${state.figureGrade.correct} / ${state.figureGrade.total} 个结构辨认正确。评分按确认标注匹配，未匹配的正确别名可在标注中补充。</div>${state.figureGrade.results.map((r, i) => `<div class="feedback-block"><p>${r.correct ? "✓" : "○"} 标记 ${i + 1}：${h(r.name)}</p><p class="small-copy">${h(r.explanation)}</p></div>`).join("")}<button class="button soft full" type="button" data-action="figure-mode" data-mode="practice">再练一次</button>` : '<button class="button primary full" type="submit">检查辨认结果</button>'}${taskError()}</form>`}</section></div>`;
  return (
    heading(
      "看见结构，也说清辨认依据。",
      "适用于病理切片、细胞结构和生理示意图。依据已确认的标注练习，无需 API。",
      "VISUAL LEARNING",
    ) +
    `<form id="figure-upload-form" class="card"><div class="form-grid"><label class="field" style="margin:0"><span>上传学习图片</span><input type="file" name="file" accept="image/png,image/jpeg,image/webp" required><small>PNG / JPG / WebP · 最大 10 MB；使用无答案标签的图片更适合练习。</small></label><div class="button-row" style="margin:0;align-self:center"><button class="button soft" type="submit">上传图片 ${icon("upload")}</button></div></div><div id="upload-error"></div></form><div class="figure-picker">${state.figures.map((f) => `<button class="button small ${state.figure?.id === f.id ? "soft" : ""}" data-action="figure" data-id="${f.id}">${h(f.title)} <span class="pill ${f.confirmed ? "" : "sand"}">${f.confirmed ? "已确认" : "待标注"}</span></button>`).join("")}</div>${panel || empty("建立你的第一张指图练习", "上传图片，点击结构放置标记并填写标准名称。确认标注后，就可以隐藏标签练习。")}`
  );
}
function reviewPage() {
  const r = state.reviews[0];
  const answer = state.reviewAnswer;
  return (
    heading(
      "先回忆，再翻开答案。",
      "错题与知识清单形成复习卡片。根据自评结果，在后续日期再次安排。",
      "DAILY RECALL",
    ) +
    `<div class="metric-row"><div class="metric"><strong>${state.reviews.length}</strong><small>当前课程待复习</small></div><div class="metric"><strong>1 → 60</strong><small>间隔天数 · 随掌握情况调整</small></div></div>${r ? `<form id="review-form" data-id="${h(r.id)}" class="card review-card"><span class="pill" style="margin-bottom:18px">主动回忆 · 第 ${r.stage + 1} 阶段</span>${r.id.startsWith("figure:") ? `<div class="figure-stage" style="margin-bottom:18px"><img class="review-image" src="/api/figures/${h(r.id.split(":")[1])}/image" alt="指图复习图片">${r.figure ? `<span class="marker" style="left:${r.figure.x * 100}%;top:${r.figure.y * 100}%">?</span>` : ""}</div><p class="small-copy" style="margin-bottom:15px">可返回图片练习查看标记位置。</p>` : ""}<h3>${h(r.question)}</h3><label class="field"><span>不看材料，先写下你记得的内容</span><textarea name="answer" rows="4" required placeholder="试着解释机制、列出关键环节，或写出结构名称。">${h(answer?.student_answer || "")}</textarea></label>${answer ? `<div class="notice"><strong>参考内容</strong><p class="prose">${h(answer.answer)}</p><p class="small-copy">${h(answer.explanation)}</p>${sources(answer.sources)}</div><p class="small-copy">对照后自行判断掌握情况；这里不会用关键词替代理解评分。</p><div class="button-row"><button class="button primary" type="button" data-action="review-rate" data-remembered="true">已能回忆，安排下次</button><button class="button" type="button" data-action="review-rate" data-remembered="false">还需巩固，明天再练</button></div>` : '<button class="button primary" type="submit">查看参考内容</button>'}${taskError()}</form>` : `<section class="card">${empty("今天的复习已完成", "生成知识清单并加入主动回忆，或完成小测，让下一次学习有迹可循。", "outline", "整理知识清单")}</section>`}`
  );
}
function settingsPage() {
  const s = state.settings;
  const generationSettings = `<details class="generation-settings"><summary>生成设置（出现截断时查看）</summary><label class="field"><span>首次输出额度（token）</span><input type="number" name="max_output_tokens" min="512" max="65536" step="1" required value="${h(s.max_output_tokens ?? 8192)}"><small>默认 8192。额度包含部分模型的思考消耗；请按服务商说明填写。</small></label><label class="field"><span>DeepSeek 生成方式</span><select name="deepseek_mode">${[["fast", "快速生成（推荐）"], ["thinking", "深度思考"], ["default", "沿用模型默认模式"]].map(([value, label]) => `<option value="${value}" ${(s.deepseek_mode || "fast") === value ? "selected" : ""}>${label}</option>`).join("")}</select><small>仅对 api.deepseek.com 生效。快速生成会请求关闭深度思考；旧模型不接受该参数时可选择沿用默认模式。</small></label><p class="small-copy">输出被截断或引用不合法时，合计最多自动重试一次，可能增加费用。截断重试的额度最高翻倍（不超过 65536 token），请确保在模型支持范围内。不完整或引用不合法的结果不会保存。</p></details>`;
  return (
    heading(
      "连接你选择的模型。",
      "支持 OpenAI 兼容的 Chat Completions API，也可连接本机模型服务。",
      "API CONNECTION",
    ) +
    `<div class="two-column"><form id="settings-form" class="card"><div class="card-title"><h2>手动配置 API</h2><span class="pill ${s.key_present ? "" : "sand"}">${s.key_present ? "密钥已输入" : "等待配置"}</span></div><label class="field"><span>API 基础地址</span><input type="url" name="base_url" value="${h(s.base_url)}" maxlength="500" required placeholder="https://api.openai.com/v1"><small>填写兼容地址，保留服务要求的 /v1；不包含 /chat/completions。远程地址使用 HTTPS。</small></label><label class="field"><span>模型名称</span><input type="text" name="model" value="${h(s.model)}" maxlength="150" required placeholder="填写服务商提供的模型名称"><small>模型需要支持中文指令与结构化 JSON 输出。</small></label><label class="field"><span>API 密钥</span><span class="password-field"><input type="password" name="api_key" autocomplete="off" maxlength="4000" placeholder="${s.key_present ? "已有密钥，留空可继续使用" : "填写你的 API Key"}"><button type="button" class="button" data-action="toggle-key" aria-pressed="false" aria-label="显示或隐藏 API 密钥">显示</button></span><small>密钥仅保存在当前服务进程内，不写入数据库或浏览器存储；关闭服务后需重新输入。本机无鉴权模型可以留空。</small></label>${generationSettings}<div class="notice">知识清单、答疑、小测与报告生成会将所选材料的相关文字片段及你的输入发送至该 API。原始文件、图片标注和学习记录保存在本机；API 费用按服务商规则计费。</div><div class="button-row"><button type="button" class="button primary" data-action="test-api">保存并测试连接</button><button type="submit" class="button">仅保存设置</button>${s.key_present ? '<button type="button" class="text-button" data-action="clear-key">清除当前密钥</button>' : ""}</div><p class="small-copy" style="margin-top:12px">测试连接会先保存当前表单，再发起一次短请求；不会上传课程材料。</p>${taskError()}</form><aside class="aside-stack"><section class="card"><div class="card-title"><h2>常见配置</h2></div><ul class="check-list"><li>OpenAI 兼容服务<small>向服务商确认基础地址、模型名和密钥。</small></li><li>本机模型<small>例如 http://127.0.0.1:11434/v1，填写已安装模型名称。</small></li><li>连接失败<small>检查模型权限、API 额度、网络与证书，工作台会保留已上传材料。</small></li></ul></section><section class="card note-card"><h3>数据在哪里？</h3><p>项目目录的 data 文件夹保存数据库、原始材料、图片和导出报告。退出服务后可备份整个文件夹；它不会被 Git 提交。</p></section></aside></div>`
  );
}

document.addEventListener("input", (event) => {
  if (
    event.target.closest("#labels-form") &&
    event.target.name !== "confirmed"
  ) {
    const checkbox = $("[name=confirmed]");
    if (checkbox) checkbox.checked = false;
    if (state.figure) state.figure.confirmed = false;
  }
});
function render() {
  captureDrafts();
  $("#navigation").innerHTML = nav
    .map(
      ([id, name, group]) =>
        `${group ? `<div class="nav-group">${group}</div>` : ""}<a class="nav-item ${state.view === id ? "active" : ""}" href="#${id}" ${state.view === id ? 'aria-current="page"' : ""}>${icon(id)}${name}</a>`,
    )
    .join("");
  $("#breadcrumb").textContent =
    nav.find((n) => n[0] === state.view)?.[1] || "概览";
  $("#api-status").innerHTML =
    `<span class="status-dot ${state.settings.key_present ? "" : "off"}"></span> ${state.settings.key_present ? "API 已配置" : "API 设置"}`;
  const pages = {
    home: homePage,
    agent: agentPage,
    materials: materialsPage,
    outline: outlinePage,
    chat: chatPage,
    teach: teachPage,
    report: reportPage,
    practice: practicePage,
    figures: figuresPage,
    review: reviewPage,
    settings: settingsPage,
  };
  $("#content").innerHTML = pages[state.view]();
  $("#content").dataset.course = state.course;
  $("#content").dataset.view = state.view;
  restoreDrafts();
  simplifyHelp();
  updateReadiness();
  updateTextSize();
  if (state.catMood === "idle") state.catMessage = catPrompts[state.view];
  updateCatVisuals();
}

function syncLabels() {
  if (!state.figure || state.figureMode !== "edit") return;
  for (const label of state.figure.labels) {
    const name = document.getElementsByName(`name-${label.id}`)[0];
    const explanation = document.getElementsByName(
      `explanation-${label.id}`,
    )[0];
    if (name) label.name = name.value;
    if (explanation) label.explanation = explanation.value;
  }
  const box = $("[name=confirmed]");
  if (box) state.figure.confirmed = box.checked;
}

document.addEventListener("change", (event) => {
  if (event.target.matches("#upload-form [name=files]")) showFileSelection();
  if (event.target.matches("[data-source-select]")) {
    if (event.target.checked)
      state.selected.add(event.target.dataset.sourceSelect);
    else state.selected.delete(event.target.dataset.sourceSelect);
    updateSourceSelection();
  }
  if (event.target.matches(".option input")) {
    const name = event.target.name;
    event.target
      .closest("form")
      .querySelectorAll(`input[name="${name}"]`)
      .forEach((input) =>
        input.closest("label").classList.toggle("selected", input.checked),
      );
  }
});

document.addEventListener("submit", (event) => {
  if (!event.target.matches("form")) return;
  event.preventDefault();
  const form = event.target;
  const fields = new FormData(form);
  const button = $("button[type=submit]", form);
  task(button, async () => {
    if (form.id === "agent-form") {
      const result = await post("/agent", { course: state.course, material_ids: [...state.selected], scopes: studyScopes(), reset_scope: state.scopeState.mode === "all", report_template_id: fields.get("report_template_id") || null, thread_id: state.agentThread?.id || null, message: fields.get("message") });
      state.agentThread = result;
      await applyAgentScope(result);
      const latest = result.messages.at(-1)?.results?.find(r => r.status === "completed");
      if (latest) state.output = await api(`/artifacts/${latest.artifact_id}`);
      $("[name=message]", form).value = "";
      state.drafts[`${state.course}:agent-form`] = { message: "" };
      await loadData();
      render();
      $("#agent-thread").scrollTop = $("#agent-thread").scrollHeight;
      if (latest) window.KittenPet?.rewardStudy();
    } else if (form.id === "upload-form") {
      let count = 0;
      for (const file of fields.getAll("files")) {
        const data = new FormData();
        data.append("course", state.course);
        data.append("kind", fields.get("kind"));
        data.append("file", file);
        try {
          const result = await api("/materials", {
            method: "POST",
            body: data,
          });
          if (fields.get("kind") !== "template") state.selected.add(result.id);
          count++;
        } catch (error) {
          await loadData();
          render();
          throw new Error(`${count} 份已上传；${file.name}：${error.message}`);
        }
      }
      await loadData();
      state.uploadNotice = {
        course: state.course,
        kind: fields.get("kind"),
        count,
      };
      render();
      toast(`已解析 ${count} 份材料。`);
      $(".upload-success")?.focus({ preventScroll: true });
      $(".upload-success")?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    } else if (form.id === "settings-form") {
      state.settings = await api("/settings", {
        method: "PUT",
        body: JSON.stringify(Object.fromEntries(fields)),
      });
      render();
      toast("连接设置已保存，密钥仅在本次运行保留。");
    } else if (form.id === "chat-form") {
      const message = fields.get("message");
      const data = payload({
        message,
        history: state.chat
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content })),
      });
      const result = await post("/study/chat", data);
      state.chat.push(
        { role: "user", content: message },
        { role: "assistant", content: result.data.answer, artifact_id: result.id, ...result.data },
      );
      if ($("[name=message]", form).value === message)
        $("[name=message]", form).value = "";
      await loadData();
      render();
      $("#chat-thread").scrollTop = $("#chat-thread").scrollHeight;
      $("#chat-form [name=message]").focus({ preventScroll: true });
    } else if (
      [
        "outline-form",
        "teach-form",
        "report-form",
        "quiz-form",
        "compare-form",
      ].includes(form.id)
    ) {
      const values = Object.fromEntries(fields);
      const mode = form.id.replace("-form", "");
      let endpoint = `/study/${mode === "teach" ? "feedback" : mode}`;
      if (mode === "report") {
        endpoint = "/reports";
        values.template_id = values.template_id || null;
        values.details = {};
        for (const key of Object.keys(values)) {
          if (key.startsWith("detail_")) { values.details[key.slice(7)] = values[key]; delete values[key]; }
        }
      }
      if (mode === "quiz") values.count = Number(values.count);
      const savedTeach =
        mode === "teach"
          ? { topic: values.topic, explanation: values.explanation }
          : null;
      state.output = await post(endpoint, payload(values));
      state.quizGrade = null;
      await loadData();
      render();
      if (savedTeach) {
        $("[name=topic]").value = savedTeach.topic;
        $("[name=explanation]").value = savedTeach.explanation;
      }
      $(".result-container")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      toast("结果已保存到当前课程。");
    } else if (form.id === "grade-form") {
      const qs =
        state.output.kind === "quiz"
          ? state.output.data.questions
          : state.output.data.practice;
      const answers = qs.map((_, i) =>
        fields.has("q" + i) ? Number(fields.get("q" + i)) : null,
      );
      state.quizGrade = await post(`/artifacts/${form.dataset.id}/grade`, {
        answers,
      });
      await loadData();
      render();
      $(".result-container")?.scrollIntoView({ behavior: "smooth" });
    } else if (form.id === "figure-upload-form") {
      const data = new FormData();
      data.append("course", state.course);
      data.append("file", fields.get("file"));
      const result = await api("/figures", { method: "POST", body: data });
      await loadData();
      state.figure = structuredClone(
        state.figures.find((f) => f.id === result.id),
      );
      state.figureMode = "edit";
      state.figureGrade = null;
      render();
      toast("图片已上传，点击结构添加标注。");
    } else if (form.id === "labels-form") {
      syncLabels();
      await api(`/figures/${state.figure.id}/labels`, {
        method: "PUT",
        body: JSON.stringify({
          labels: state.figure.labels,
          confirmed: state.figure.confirmed,
        }),
      });
      await loadData();
      render();
      toast("标注已保存。");
    } else if (form.id === "figure-grade-form") {
      state.figureGrade = await post(`/figures/${state.figure.id}/grade`, {
        answers: Object.fromEntries(fields),
      });
      await loadData();
      render();
    } else if (form.id === "review-form") {
      state.reviewAnswer = {
        ...(await post(`/reviews/${form.dataset.id}/answer`, {
          answer: fields.get("answer"),
        })),
        student_answer: fields.get("answer"),
      };
      render();
    }
  });
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    const stage = event.target.closest("#figure-stage");
    if (stage && state.figureMode === "edit" && !state.busy) {
      if (state.figure.labels.length >= 50) {
        toast("一张图片最多 50 个标记。");
        return;
      }
      syncLabels();
      const rect = stage.getBoundingClientRect();
      state.figure.labels.push({
        id: crypto.randomUUID(),
        name: "",
        explanation: "",
        x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      });
      state.figure.confirmed = false;
      render();
      $(".labels-scroll")?.scrollTo({ top: 100000, behavior: "smooth" });
    }
    return;
  }
  const action = button.dataset.action;
  if (action === "focus-course") {
    if (state.busy) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    $("#course-select").focus();
    toast("在右上角选择要学习的课程。");
    return;
  }
  if (action === "toggle-key") {
    const input = $("#settings-form [name=api_key]");
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    button.textContent = reveal ? "隐藏" : "显示";
    button.setAttribute("aria-pressed", String(reveal));
    return;
  }
  if (action === "select-sources") {
    if (state.busy) return;
    state.selected = new Set(
      state.materials
        .filter(
          (m) =>
            m.kind !== "template" &&
            (button.dataset.mode === "all" ||
              (button.dataset.mode === "experiment" &&
                m.kind === "experiment")),
        )
        .map((m) => m.id),
    );
    updateSourceSelection();
    return;
  }
  if (action === "upload-experiment") {
    if (state.busy) return;
    $("#upload-form [name=kind]").value = "experiment";
    $("#upload-form [name=files]").click();
    return;
  }
  if (action === "close-cat") {
    state.catExpanded = false;
    updateCatVisuals();
    return;
  }
  if (action === "toggle-cat-motion") {
    state.catMotion = !state.catMotion;
    localStorage.setItem("medstudy-cat-motion", state.catMotion ? "on" : "off");
    updateCatVisuals();
    return;
  }
  if (action === "pet-cat") {
    window.KittenPet?.pet();
    const messages = [
      "收到摸摸啦！我们再学一个小知识点，好不好喵？",
      "不用着急，一次弄懂一点点就很好～",
      "先休息一下眼睛，回来我还在这里陪你喵。",
    ];
    if (state.busy) {
      state.catExpanded = true;
      state.catMessage = "收到摸摸啦～我还在认真处理，等我一下喵！";
      updateCatVisuals();
    } else setCatState("petting", messages[petCount++ % messages.length], true);
    return;
  }
  if (state.busy) {
    toast("当前任务正在处理，请稍候。");
    return;
  }
  if (action === "suggest") {
    const input = $("[name=message]");
    input.value = button.dataset.text;
    input.focus();
    return;
  }
  if (action === "new-agent") {
    state.agentThread = null;
    state.output = null;
    state.quizGrade = null;
    render();
    return;
  }
  if (action === "practice-tab") {
    state.practiceTab = button.dataset.tab;
    state.output = null;
    state.quizGrade = null;
    render();
    return;
  }
  if (action === "remove-label") {
    syncLabels();
    state.figure.labels = state.figure.labels.filter(
      (l) => l.id !== button.dataset.id,
    );
    state.figure.confirmed = false;
    render();
    return;
  }
  await task(button, async () => {
    if (action === "source") {
      const data = await api(`/materials/${button.dataset.id}`);
      $("#source-title").textContent = data.title;
      $("#source-content").innerHTML = data.chunks
        .map(
          (c) =>
            `<div class="source-chunk ${c.unit === button.dataset.unit ? "focus" : ""}"><small>${h(c.unit)}</small>${h(c.text)}</div>`,
        )
        .join("");
      $("#source-dialog").showModal();
      $(".source-chunk.focus")?.scrollIntoView({ block: "center" });
    } else if (action === "figure-source") {
      $("#source-title").textContent = "图片标注来源";
      $("#source-content").innerHTML =
        `<div class="figure-stage"><img src="/api/figures/${h(button.dataset.id)}/image" alt="标注图片">${button.dataset.x !== "" ? `<span class="marker" style="left:${Number(button.dataset.x) * 100}%;top:${Number(button.dataset.y) * 100}%">?</span>` : ""}</div>`;
      $("#source-dialog").showModal();
    } else if (action === "course") {
      // Course changes have their own loading path; no AI task is running here.
      state.busy = false;
      await switchCourse(button.dataset.id);
    } else if (action === "delete-material") {
      if (!confirm("删除这份材料？已有学习记录会保留，但对应原文将无法查看。"))
        return;
      await api(`/materials/${button.dataset.id}`, { method: "DELETE" });
      await loadData();
      render();
      toast("材料已删除。");
    } else if (action === "artifact") {
      const a = await api(`/artifacts/${button.dataset.id}`);
      const view = {
        outline: "outline",
        quiz: "practice",
        compare: "practice",
        feedback: "teach",
        report: "report",
        chat: "chat",
      }[a.kind];
      state.view = view;
      state.output = a;
      state.quizGrade = null;
      if (a.kind === "compare") state.practiceTab = "compare";
      if (a.kind === "quiz") state.practiceTab = "quiz";
      if (a.kind === "chat")
        state.chat = [
          { role: "user", content: a.data.question || a.title },
          { role: "assistant", content: a.data.answer, artifact_id: a.id, ...a.data },
        ];
      render();
      $(".result-container")?.scrollIntoView({ behavior: "smooth" });
    } else if (action === "agent-result") {
      state.output = await api(`/artifacts/${button.dataset.id}`);
      state.quizGrade = null;
      render();
      $(".result-container")?.scrollIntoView({ behavior: "smooth" });
    } else if (action === "recall") {
      const result = await post(`/artifacts/${button.dataset.id}/recall`);
      await loadData();
      toast(`新增 ${result.added} 张主动回忆卡片。`);
    } else if (action === "test-api") {
      const form = $("#settings-form");
      state.settings = await api("/settings", {
        method: "PUT",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      $("[name=api_key]").value = "";
      const result = await post("/settings/test");
      render();
      toast(result.message);
    } else if (action === "clear-key") {
      state.settings = await api("/settings", {
        method: "PUT",
        body: JSON.stringify({ ...state.settings, clear_key: true }),
      });
      render();
      toast("当前密钥已清除。");
    } else if (action === "figure") {
      state.figure = structuredClone(
        state.figures.find((f) => f.id === button.dataset.id),
      );
      state.figureMode = "edit";
      state.figureGrade = null;
      render();
    } else if (action === "figure-mode") {
      if (button.dataset.mode === "practice") {
        if (state.figureMode === "edit") {
          syncLabels();
          if (!state.figure.confirmed)
            throw new Error("请先确认标注来源可靠，保存后再练习。");
          await api(`/figures/${state.figure.id}/labels`, {
            method: "PUT",
            body: JSON.stringify({
              labels: state.figure.labels,
              confirmed: true,
            }),
          });
          await loadData();
        }
        state.figure = await api(`/figures/${state.figure.id}/practice`);
      } else
        state.figure = structuredClone(
          state.figures.find((f) => f.id === state.figure.id),
        );
      state.figureMode = button.dataset.mode;
      state.figureGrade = null;
      render();
    } else if (action === "review-rate") {
      const form = $("#review-form");
      const answer = $("[name=answer]", form).value;
      const result = await post(`/reviews/${form.dataset.id}/answer`, {
        answer,
        remembered: button.dataset.remembered === "true",
      });
      state.reviewAnswer = null;
      await loadData();
      render();
      toast(
        `下次复习：${new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(result.due))}`,
      );
    }
  });
});

document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (link) {
    event.preventDefault();
    if (navigate(link.getAttribute("href").slice(1)))
      window.history.replaceState(null, "", "#" + state.view);
  }
});
$("#course-select").addEventListener("change", (event) =>
  switchCourse(event.target.value).catch((e) => toast(e.message, true)),
);
$("#api-status").addEventListener("click", () => navigate("settings"));
$("#text-size-toggle").addEventListener("click", () => {
  state.textSize = state.textSize === "large" ? "standard" : "large";
  localStorage.setItem("medstudy-text-size", state.textSize);
  updateTextSize();
});
$("#menu-button").addEventListener("click", () =>
  $("#sidebar").classList.toggle("open"),
);
$("#close-dialog").addEventListener("click", () => $("#source-dialog").close());
$("#source-dialog").addEventListener("click", (event) => {
  if (event.target === $("#source-dialog")) $("#source-dialog").close();
});
window.addEventListener("hashchange", () => navigate(location.hash.slice(1)));

async function init() {
  try {
    [state.courses, state.settings] = await Promise.all([
      api("/courses"),
      api("/settings"),
    ]);
    if (!state.courses.some((c) => c.id === state.course))
      state.course = state.courses[0].id;
    $("#course-select").innerHTML = state.courses
      .map((c) => `<option value="${c.id}">${h(c.name)}</option>`)
      .join("");
    $("#course-select").value = state.course;
    await loadData();
    state.materials
      .filter((m) => m.kind !== "template")
      .forEach((m) => state.selected.add(m.id));
    navigate(location.hash.slice(1) || "home");
  } catch (error) {
    $("#content").innerHTML =
      `<div class="notice error">${h(error.message)} 请确认本地服务已启动，然后刷新页面。</div>`;
  }
}
init();
