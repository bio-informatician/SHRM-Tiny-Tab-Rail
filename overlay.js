// ---------------------------
// SHRM - Tiny Tab Rail Overlay
// ---------------------------

// Prevent multiple overlays
if (!document.getElementById("__tinyTabRail__rail")) {
  // Main rail container
  const rail = document.createElement("div");
  rail.id = "__tinyTabRail__rail";
  document.body.appendChild(rail);

  // Pinned tabs group
  const pinned = document.createElement("div");
  pinned.id = "__tinyTabRail__pinned";
  pinned.className = "__tinyTabRail__group";
  rail.appendChild(pinned);

  // Other tabs group
  const tabs = document.createElement("div");
  tabs.id = "__tinyTabRail__tabs";
  tabs.className = "__tinyTabRail__group";
  rail.appendChild(tabs);

  // Tooltip
  const tooltip = document.createElement("div");
  tooltip.id = "__tinyTabRail__tooltip";
  document.body.appendChild(tooltip);
}

// Elements references
const pinnedEl = document.getElementById("__tinyTabRail__pinned");
const tabsEl = document.getElementById("__tinyTabRail__tabs");
const tooltip = document.getElementById("__tinyTabRail__tooltip");

let tabsData = [];

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

    // Activate tab on click
    el.onclick = () => {
      chrome.runtime.sendMessage({ type: "activateTab", tabId: tab.id });
    };

    // Pin/unpin with right-click — safely capture tab
    el.oncontextmenu = ((t) => (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: "togglePin", tabId: t.id, pinned: t.pinned });
    })(tab);

    // Tooltip events
    el.onmouseenter = e => showTooltip(e, tab);
    el.onmousemove = moveTooltip;
    el.onmouseleave = hideTooltip;

    // Append to correct group
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
// Initialization
// ---------------------------

// Tell background this overlay is loaded
chrome.runtime.sendMessage({ type: "overlayLoaded" });

// Request current tabs immediately
chrome.runtime.sendMessage({ type: "getTabs" }, (response) => {
  if (!response) return;
  tabsData = response.tabs;
  renderTabs();
});

// Listen for updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "updateTabs") {
    tabsData = msg.tabs;
    renderTabs();
  }
});

