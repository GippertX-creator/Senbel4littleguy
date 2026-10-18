"use strict";
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-time]");
  if (!button) return;
  const video = document.querySelector("#kitten-video");
  const seek = () => {
    video.currentTime = Number(button.dataset.time);
    video.play().catch(() => {});
  };
  if (video.readyState >= 1) seek();
  else { video.addEventListener("loadedmetadata", seek, { once: true }); video.load(); }
});
