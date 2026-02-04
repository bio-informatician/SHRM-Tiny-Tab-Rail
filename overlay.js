// ---------------------------
// SHRM - Tiny Tab Rail Overlay
// Overlay / Content Script
// ---------------------------

if (!document.getElementById("__tinyTabRail__rail")) {
  const rail = document.createElement("div");
  rail.id = "__tinyTabRail__rail";
  document.body.appendChild(rail);

  const pinned = document.createElement("div");
  pinned.id = "__tinyTabRail__pinned";
  pinned.className = "__tinyTabRail__group";
  rail.appendChild(pinned);

  const tabs = document.createElement("div");
  tabs.id = "__tinyTabRail__tabs";
  tabs.className = "__tinyTabRail__group";
  rail.appendChild(tabs);

  const tooltip = document.createElement("div");
  tooltip.id = "__tinyTabRail__tooltip";
  document.body.appendChild(tooltip);
}

const pinnedEl = document.getElementById("__tinyTabRail__pinned");
const tabsEl = document.getElementById("__tinyTabRail__tabs");
const tooltip = document.getElementById("__tinyTabRail__tooltip");

let tabsData = [];

// ---------------------------
// Safe message sender
// ---------------------------
function safeSendMessage(msg) {
  try {
    chrome.runtime.sendMessage(msg);
  } catch (e) {
    // ignore any errors
  }
}

// ---------------------------
// Render tabs
// ---------------------------
function renderTabs() {
  pinnedEl.innerHTML = "";
  tabsEl.innerHTML = "";

  tabsData.forEach(tab => {
    if (!tab.favIconUrl) return;

    const el = document.createElement("div");
    el.className = "__tinyTabRail__tab";
    if (tab.active) el.classList.add("active");
    if (tab.pinned) el.classList.add("pinned");

    const img = document.createElement("img");
    img.src = tab.favIconUrl;
    el.appendChild(img);

    // Activate tab
    el.onclick = () => safeSendMessage({ type: "activateTab", tabId: tab.id });

    // Pin/unpin
    el.oncontextmenu = ((t) => (e) => {
      e.preventDefault();
      safeSendMessage({ type: "togglePin", tabId: t.id, pinned: t.pinned });
    })(tab);

    // Tooltip
    el.onmouseenter = e => showTooltip(e, tab);
    el.onmousemove = moveTooltip;
    el.onmouseleave = hideTooltip;

    if (tab.pinned) pinnedEl.appendChild(el);
    else tabsEl.appendChild(el);
  });
}

// ---------------------------
// Tooltip
// ---------------------------
function showTooltip(e, tab) {
  tooltip.textContent = tab.title || tab.url;
  tooltip.style.opacity = "1";
  moveTooltip(e);
}

function moveTooltip(e) {
  tooltip.style.left = e.clientX + 12 + "px";
  tooltip.style.top = e.clientY + 12 + "px";
}

function hideTooltip() {
  tooltip.style.opacity = "0";
}

// ---------------------------
// Initialize overlay
// ---------------------------
function registerOverlay() {
  chrome.runtime.sendMessage({ type: "overlayLoaded" }, (response) => {
    if (response && response.tabs) {
      tabsData = response.tabs;
      renderTabs();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", registerOverlay);
} else {
  registerOverlay();
}

// ---------------------------
// Listen for updates
// ---------------------------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "updateTabs") {
    tabsData = msg.tabs;
    renderTabs();
  }
});

