"use strict";

// Offline companion. Only affection/preferences are stored, never course text or keys.
(() => {
  const KEY = "medstudy-kitten-companion-v1";
  const root = document.querySelector("#cat-companion");
  const bubble = document.querySelector("#cat-bubble");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scenes = [
    { id: "sunshine", title: "把阳光留给你", image: "cg-sunshine.png", condition: "初次见面，即刻收藏", threshold: 0,
      alt: "阳光洒在学习桌上，奶油色小猫抱着薄荷绿课本向你挥爪。",
      lines: ["你回来啦！我把最暖和的位置留给你了。", "今天想先摸摸我，还是一起翻开课本？不用急，我都陪你。", "你认真学习的时候，我会悄悄把尾巴圈在你旁边。"],
      choices: [["先蹭蹭小猫", "呼噜呼噜……这份温柔，我已经好好收进心里啦。"], ["一起开始学习", "好！一页也算进步。你看课本，我负责给你加油。"]] },
    { id: "rain", title: "雨声与小毛球", image: "cg-rain.png", condition: "陪伴好感达到 10", threshold: 10,
      alt: "雨天窗边，小猫趴在淡紫色地毯上，伸爪拨弄薄荷绿毛线球。",
      lines: ["下雨了……听，窗户在弹一首很慢的曲子。", "毛线球滚到你那里啦。可以轻轻推回来给我吗？", "偶尔停下来喘口气，也是在照顾努力的自己。"],
      choices: [["把毛球推回去", "接住啦！我的小爪子是不是超厉害？再陪你玩一小会儿。"], ["一起听雨休息", "那我靠近一点点。我们什么都不用说，听完这阵雨就好。"]] },
    { id: "stars", title: "今晚也有星星", image: "cg-stars.png", condition: "好感达到 24，或完成 3 次学习操作", threshold: 24,
      alt: "星夜书桌旁，小猫蜷在淡紫色靠垫上睡着，月亮灯温暖地照着翻开的课本。",
      lines: ["你看，窗外的星星像不像课本里藏着的小小答案？", "今天已经做了很多了。没有弄懂的地方，我们可以明天再看。", "我把晚安藏在书签里。合上书，就能收到啦。"],
      choices: [["给小猫盖好毯子", "呼……最安心的地方，就是有人温柔地记挂着我。晚安啦。"], ["收下今天的晚安", "晚安，今天努力的你。愿你醒来时，也被一点点好心情照亮。"]] },
  ];
  const bounded = (value, max) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { /* Use fresh preferences. */ }
  if (!saved || typeof saved !== "object") saved = {};
  const profile = {
    affection: bounded(saved.affection, 100), studies: bounded(saved.studies, 10000),
    roaming: saved.roaming === true, docked: saved.docked === true,
    seen: Array.isArray(saved.seen) ? saved.seen.filter((id) => scenes.some((s) => s.id === id)) : [],
  };
  let context = { mood: "idle", busy: false, expanded: false, motion: true };
  let walkTimer, arrivalTimer, activityTimer;
  let currentScene = scenes[0], storyStep = 0, choiceLine = "", lastOpener;
  const cooldowns = new Map();
  const unlocked = (scene) => profile.affection >= scene.threshold || (scene.id === "stars" && profile.studies >= 3);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* Keep this session usable. */ } };

  bubble.querySelector("#cat-message").insertAdjacentHTML("afterend", `
    <div class="pet-affection"><div><span>♥ 陪伴好感</span><strong id="pet-affection-value">0 / 100</strong></div><progress id="pet-affection-meter" max="100" value="0" aria-label="陪伴好感"></progress><small id="pet-relationship">初次见面</small></div>
    <div class="pet-interactions" aria-label="和小猫互动"><button type="button" data-pet-action="snack">♡ 喂点心</button><button type="button" data-pet-action="play">◌ 逗猫玩</button><button type="button" data-pet-action="talk">✦ 听它撒娇</button></div>
    <p id="pet-reaction" class="pet-reaction" role="status" aria-live="polite">摸摸小猫，收集属于你们的小回忆。</p>
    <div class="pet-menu"><button type="button" data-pet-action="roam" aria-pressed="false">让它散步</button><button type="button" data-pet-action="gallery">CG 收藏 <span class="pet-gallery-count">1 / 3</span></button><button type="button" data-pet-action="dock">收起小猫</button></div>`);
  root.querySelector(".cat-companion-button").insertAdjacentHTML("beforeend", '<span class="pet-walk-sprite" aria-hidden="true"></span><span class="pet-toy" aria-hidden="true"></span>');
  root.insertAdjacentHTML("beforeend", '<button type="button" class="pet-quick-gallery" data-pet-action="gallery" aria-label="打开小猫 CG 收藏与剧情">♥ CG · <span class="pet-gallery-count">1 / 3</span><span id="pet-new-badge" hidden>新</span></button>');
  root.insertAdjacentHTML("afterend", '<button type="button" id="pet-recall" class="pet-recall" data-pet-action="recall" hidden>🐾 叫回小猫</button>');
  document.body.insertAdjacentHTML("beforeend", `
    <dialog id="pet-gallery" class="pet-gallery" aria-labelledby="pet-gallery-title">
      <header class="pet-gallery-heading"><div><span class="pet-eyebrow">LITTLE MOMENTS, WITH YOU</span><h2 id="pet-gallery-title">小猫的秘密花园</h2><p>摸摸、玩耍、一起学习。把温柔的日常，收进回忆里。 <a href="/guide/小猫互动演示.html" target="_blank" rel="noopener noreferrer">看互动演示 ↗</a></p></div><button type="button" class="icon-button" data-pet-action="close-gallery" aria-label="关闭猫咪 CG 收藏">×</button></header>
      <div class="pet-gallery-layout"><section class="pet-scene" aria-label="猫咪 CG 剧情"><img id="pet-cg-image" src="/assets/cg-sunshine.png" alt=""><span class="pet-scene-label" id="pet-scene-title"></span><div class="pet-story-panel"><span class="pet-story-speaker">小家伙</span><p id="pet-story-line" aria-live="polite"></p><div id="pet-story-choices" class="pet-story-choices"></div><div class="pet-story-controls"><span id="pet-story-page"></span><button type="button" data-pet-action="next-line">下一句 →</button></div></div></section><aside class="pet-collection"><div class="pet-collection-heading"><h3>我的 CG 收藏</h3><span class="pet-gallery-count">1 / 3</span></div><div id="pet-scene-cards"></div><div class="pet-collection-note"><strong id="pet-gallery-affection"></strong><p>好感不会因为离开而减少。按自己的节奏来就好。</p><small>互动与剧情在本机运行，无需 API。进度保存在当前浏览器；清除网站数据会重置。</small></div></aside></div>
    </dialog>`);
  const dialog = document.querySelector("#pet-gallery");

  function updateProfile() {
    const count = scenes.filter(unlocked).length;
    document.querySelectorAll(".pet-gallery-count").forEach((el) => { el.textContent = `${count} / ${scenes.length}`; });
    document.querySelector("#pet-affection-value").textContent = `${profile.affection} / 100`;
    document.querySelector("#pet-affection-meter").value = profile.affection;
    const relationship = profile.affection >= 40 ? "形影不离" : profile.affection >= 24 ? "默契搭档" : profile.affection >= 10 ? "熟悉的朋友" : "初次见面";
    document.querySelector("#pet-relationship").textContent = `${relationship} · 一起完成 ${profile.studies} 次学习`;
    document.querySelector("#pet-new-badge").hidden = !scenes.some((s) => unlocked(s) && !profile.seen.includes(s.id));
    root.classList.toggle("pet-docked", profile.docked);
    document.querySelector("#pet-recall").hidden = !profile.docked;
    document.querySelectorAll('[data-pet-action="roam"]').forEach((button) => {
      button.textContent = profile.roaming ? "让它歇歇" : "让它散步";
      button.setAttribute("aria-pressed", String(profile.roaming));
    });
    if (dialog.open) renderGallery();
  }
  function gain(amount, key) {
    const now = Date.now();
    if (now - (cooldowns.get(key) || 0) < 4000) return false;
    cooldowns.set(key, now);
    const before = scenes.filter(unlocked).length;
    profile.affection = Math.min(100, profile.affection + amount);
    save(); updateProfile();
    if (scenes.filter(unlocked).length > before) react("新的小回忆解锁啦！打开 CG 收藏看看吧。", true);
    return true;
  }
  function react(text, unlockedNow = false) {
    const node = document.querySelector("#pet-reaction");
    node.textContent = text;
    node.classList.toggle("is-unlock", unlockedNow);
  }
  function activity(name) {
    clearTimeout(activityTimer);
    stopWalking();
    if (!context.busy) root.dataset.petActivity = name;
    activityTimer = setTimeout(() => { root.dataset.petActivity = "idle"; scheduleWalk(); }, 2800);
  }
  function freezePosition() {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(root).transform);
    root.style.setProperty("--pet-travel-time", "0s");
    root.style.setProperty("--pet-x", `${matrix.m41}px`);
    root.style.setProperty("--pet-y", `${matrix.m42}px`);
    root.dataset.petEdge = root.getBoundingClientRect().left < innerWidth / 2 ? "left" : "right";
  }
  function stopWalking(home = false) {
    clearTimeout(walkTimer); clearTimeout(arrivalTimer);
    freezePosition();
    if (root.dataset.petActivity === "walking") root.dataset.petActivity = "idle";
    if (home) {
      root.style.setProperty("--pet-x", "0px"); root.style.setProperty("--pet-y", "0px");
      root.dataset.petEdge = "right";
    }
  }
  function mayWalk() {
    return profile.roaming && !profile.docked && context.motion && !reducedMotion.matches &&
      !context.busy && !context.expanded && ["idle", "petting"].includes(context.mood) && !dialog.open && !document.hidden &&
      !document.activeElement?.matches("input, textarea, select");
  }
  function walk() {
    if (!mayWalk()) return;
    clearTimeout(activityTimer);
    const rect = root.getBoundingClientRect();
    const minLeft = innerWidth > 900 ? 278 : 12;
    const maxLeft = Math.max(minLeft, innerWidth - root.offsetWidth - 18);
    const targetLeft = rect.left > (minLeft + maxLeft) / 2 ? minLeft : maxLeft;
    const homeLeft = innerWidth - parseFloat(getComputedStyle(root).right) - root.offsetWidth;
    const duration = Math.max(1.3, Math.min(8, Math.abs(targetLeft - rect.left) / 80));
    root.dataset.petActivity = "walking";
    root.dataset.petDirection = targetLeft < rect.left ? "left" : "right";
    root.dataset.petEdge = targetLeft < innerWidth / 2 ? "left" : "right";
    root.style.setProperty("--pet-travel-time", `${duration}s`);
    root.style.setProperty("--pet-x", `${targetLeft - homeLeft}px`);
    root.style.setProperty("--pet-y", "0px");
    arrivalTimer = setTimeout(() => { root.dataset.petActivity = "idle"; scheduleWalk(3200); }, duration * 1000);
  }
  function scheduleWalk(delay = 4500) {
    clearTimeout(walkTimer);
    if (mayWalk()) walkTimer = setTimeout(walk, delay);
  }
  function renderGallery() {
    const image = document.querySelector("#pet-cg-image");
    const target = `/assets/${currentScene.image}`;
    if (image.getAttribute("src") !== target) image.src = target;
    image.alt = currentScene.alt;
    document.querySelector("#pet-scene-title").textContent = currentScene.title;
    document.querySelector("#pet-story-line").textContent = choiceLine || currentScene.lines[storyStep];
    document.querySelector("#pet-story-page").textContent = choiceLine ? "属于你们的这一刻" : `${storyStep + 1} / ${currentScene.lines.length} · 本地小剧情`;
    document.querySelector('[data-pet-action="next-line"]').textContent = choiceLine || storyStep === currentScene.lines.length - 1 ? "再看一遍 ↺" : "下一句 →";
    document.querySelector("#pet-story-choices").innerHTML = !choiceLine && storyStep === currentScene.lines.length - 1 ? currentScene.choices.map(([label], index) => `<button type="button" data-pet-action="choice" data-choice="${index}">${label}</button>`).join("") : "";
    document.querySelector("#pet-gallery-affection").textContent = `♥ 好感 ${profile.affection} · 学习 ${profile.studies} 次`;
    document.querySelector("#pet-scene-cards").innerHTML = scenes.map((scene) => {
      const available = unlocked(scene);
      return `<button type="button" class="pet-scene-card ${currentScene.id === scene.id ? "is-selected" : ""}" data-pet-action="scene" data-scene="${scene.id}" ${available ? "" : "disabled"} aria-pressed="${currentScene.id === scene.id}">${available ? `<img src="/assets/${scene.image}" alt="" loading="lazy">` : '<span class="pet-locked-art" aria-hidden="true">✧</span>'}<span><strong>${scene.title}</strong><small>${available ? "已收藏 · 点击回看" : scene.condition}</small></span><span aria-hidden="true">${available ? "♡" : "锁"}</span></button>`;
    }).join("");
  }
  function openGallery(button) {
    stopWalking();
    lastOpener = button;
    if (!dialog.open) dialog.showModal();
    if (!unlocked(currentScene)) currentScene = scenes[0];
    scenes.filter(unlocked).forEach((scene) => { if (!profile.seen.includes(scene.id)) profile.seen.push(scene.id); });
    save(); updateProfile();
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pet-action]");
    if (!button) return;
    const action = button.dataset.petAction;
    if (action === "gallery") openGallery(button);
    else if (action === "close-gallery") dialog.close();
    else if (action === "scene") {
      const scene = scenes.find((s) => s.id === button.dataset.scene);
      if (scene && unlocked(scene)) { currentScene = scene; storyStep = 0; choiceLine = ""; renderGallery(); }
    } else if (action === "next-line") {
      storyStep = choiceLine || storyStep === currentScene.lines.length - 1 ? 0 : storyStep + 1;
      choiceLine = ""; renderGallery();
    } else if (action === "choice") {
      choiceLine = currentScene.choices[Number(button.dataset.choice)]?.[1] || "";
      renderGallery();
      document.querySelector('[data-pet-action="next-line"]').focus();
    } else if (action === "dock") {
      stopWalking(true); profile.docked = true; save(); updateProfile();
      document.querySelector("#pet-recall").focus();
    } else if (action === "recall") {
      profile.docked = false; save(); updateProfile(); scheduleWalk();
      root.querySelector(".cat-companion-button").focus();
    } else if (action === "roam") {
      profile.roaming = !profile.roaming; stopWalking(true); save(); updateProfile();
      react(profile.roaming ? "把对话收起来，我就沿着页面底部散步啦。摸摸我就会停下。" : "好呀，乖乖坐在这里陪你。暂停动画时我也会停下。 ");
      scheduleWalk(300);
    } else if (["snack", "play", "talk"].includes(action)) {
      const responses = {
        snack: [3, "小点心收到啦！我把最后一块留给努力的你，啊呜～", "snack"],
        play: [3, "扑！毛线球抓到啦！要不要夸夸我的小爪子？", "play"],
        talk: [2, "可以再靠近一点点吗？我想把今天的呼噜声，全部送给你。", "cuddle"],
      };
      const [points, text, pose] = responses[action];
      react(context.busy ? "收到啦，我还在帮你处理学习任务，先轻轻蹭蹭你。" : text);
      activity(pose); gain(points, action);
    }
  });
  dialog.addEventListener("close", () => { lastOpener?.focus(); scheduleWalk(); });
  root.addEventListener("pointerenter", () => stopWalking());
  root.addEventListener("pointerleave", () => scheduleWalk());
  document.addEventListener("focusin", (event) => { if (event.target.matches("input,textarea,select")) stopWalking(); });
  document.addEventListener("focusout", () => scheduleWalk());
  document.addEventListener("visibilitychange", () => { stopWalking(); if (!document.hidden) scheduleWalk(); });
  window.addEventListener("resize", () => { stopWalking(true); scheduleWalk(); });
  reducedMotion.addEventListener("change", () => { stopWalking(); scheduleWalk(); });
  window.KittenPet = {
    sync(next) {
      const changed = Object.keys(next).some((key) => context[key] !== next[key]);
      context = { ...context, ...next };
      if (changed) { stopWalking(); scheduleWalk(context.expanded ? 4500 : 350); }
    },
    pet() {
      if (profile.docked) { profile.docked = false; save(); updateProfile(); }
      activity("cuddle"); react("呼噜呼噜……再摸一下下？你的小猫现在很开心。 "); gain(2, "pet");
    },
    rewardStudy() {
      const before = scenes.filter(unlocked).length;
      profile.studies = Math.min(10000, profile.studies + 1);
      profile.affection = Math.min(100, profile.affection + 2);
      save(); updateProfile();
      if (scenes.filter(unlocked).length > before) react("学习小回忆解锁啦！谢谢你带着我一起进步。", true);
    },
  };
  updateProfile(); scheduleWalk();
})();
