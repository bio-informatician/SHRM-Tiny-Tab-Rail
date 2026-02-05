// ---------------------------
// SHRM - Tiny Tab Rail Overlay
// Overlay / Content Script (MV3-safe)
// ---------------------------

(function () {
  // Only set this when we are confident the extension world is actually gone.
  let runtimeDead = false;

  function markRuntimeDead() {
    runtimeDead = true;
  }

  function isInvalidationError(e) {
    const msg = String((e && e.message) || e || "");
    return msg.includes("Extension context invalidated");
  }

  function canUseRuntime() {
    if (runtimeDead) return false;
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage);
    } catch (e) {
      if (isInvalidationError(e)) markRuntimeDead();
      return false;
    }
  }

  function safeSendMessage(msg, cb) {
    if (!canUseRuntime()) return;

    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (runtimeDead) return;

        // lastError often happens when the receiving end isn't ready / tab is restricted /
        // service worker is waking, etc. Do NOT treat it as "context invalidated".
        try {
          if (chrome.runtime && chrome.runtime.lastError) {
            return;
          }
        } catch (e) {
          if (isInvalidationError(e)) markRuntimeDead();
          return;
        }

        if (cb) cb(response);
      });
    } catch (e) {
      if (isInvalidationError(e)) markRuntimeDead();
      // otherwise ignore
    }
  }

  try {
    // Only run on standard HTTP/HTTPS pages
    if (!location.href.startsWith("http") || !canUseRuntime()) {
      console.warn("__tinyTabRail__ skipped:", location.href);
      return;
    }

    // Prevent duplicate injection within the same JS world
    if (window.__tinyTabRailInjected__) return;
    window.__tinyTabRailInjected__ = true;

    // Ensure body exists
    if (!document.body) {
      console.warn("__tinyTabRail__ no body found, skipping");
      return;
    }

    // ---------------------------
    // Create rail UI
    // ---------------------------
    const createElementSafe = (tag, id, className) => {
      const el = document.createElement(tag);
      if (id) el.id = id;
      if (className) el.className = className;
      return el;
    };

    if (!document.getElementById("__tinyTabRail__rail")) {
      const rail = createElementSafe("div", "__tinyTabRail__rail");
      document.body.appendChild(rail);

      const pinned = createElementSafe("div", "__tinyTabRail__pinned", "__tinyTabRail__group");
      const tabs = createElementSafe("div", "__tinyTabRail__tabs", "__tinyTabRail__group");
      rail.appendChild(pinned);
      rail.appendChild(tabs);

      const tooltip = createElementSafe("div", "__tinyTabRail__tooltip");
      document.body.appendChild(tooltip);
    }

    const pinnedEl = document.getElementById("__tinyTabRail__pinned");
    const tabsEl = document.getElementById("__tinyTabRail__tabs");
    const tooltip = document.getElementById("__tinyTabRail__tooltip");

    let tabsData = [];

    // ---------------------------
    // Render tabs
    // ---------------------------
    function renderTabs() {
      if (runtimeDead) return;
      if (!pinnedEl || !tabsEl) return;

      pinnedEl.innerHTML = "";
      tabsEl.innerHTML = "";

      tabsData.forEach((tab) => {
        if (!tab || !tab.favIconUrl) return;

        const el = createElementSafe("div", null, "__tinyTabRail__tab");
        if (tab.active) el.classList.add("active");
        if (tab.pinned) el.classList.add("pinned");

        const img = createElementSafe("img");
        img.src = tab.favIconUrl;
        el.appendChild(img);

        el.onclick = () => safeSendMessage({ type: "activateTab", tabId: tab.id });

        el.oncontextmenu = (e) => {
          e.preventDefault();
          safeSendMessage({ type: "togglePin", tabId: tab.id, pinned: tab.pinned });
        };

        el.onmouseenter = (e) => showTooltip(e, tab);
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
      if (runtimeDead) return;
      if (!tooltip) return;
      tooltip.textContent = tab.title || tab.url || "";
      tooltip.style.opacity = "1";
      moveTooltip(e);
    }

    function moveTooltip(e) {
      if (runtimeDead) return;
      if (!tooltip) return;
      tooltip.style.left = (e.clientX + 12) + "px";
      tooltip.style.top = (e.clientY + 12) + "px";
    }

    function hideTooltip() {
      if (!tooltip) return;
      tooltip.style.opacity = "0";
    }

    // ---------------------------
    // Request snapshot
    // ---------------------------
    function requestTabsSnapshot() {
      if (runtimeDead) return;
      safeSendMessage({ type: "getTabsSnapshot" }, (response) => {
        if (runtimeDead) return;
        if (!response) return;
        tabsData = response.tabs || [];
        renderTabs();
      });
    }

    // Initial request
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", requestTabsSnapshot, { once: true });
    } else {
      requestTabsSnapshot();
    }

    // ✅ Critical: refresh when tab becomes visible again (fixes stale background tabs)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) requestTabsSnapshot();
    });

    // Also refresh on focus (helps with some SPA/freeze cases)
    window.addEventListener("focus", () => requestTabsSnapshot());

    // bfcache restore
    window.addEventListener("pageshow", () => requestTabsSnapshot());

    // ---------------------------
    // Listen for background updates
    // ---------------------------
    if (canUseRuntime()) {
      try {
        chrome.runtime.onMessage.addListener((msg) => {
          if (runtimeDead) return;
          if (!msg) return;

          if (msg.type === "tabsUpdated") {
            tabsData = msg.tabs || [];
            renderTabs();
          }
        });
      } catch (e) {
        if (isInvalidationError(e)) markRuntimeDead();
      }
    }
  } catch (err) {
    console.warn("__tinyTabRail__ overlay aborted:", err && err.message ? err.message : err);
  }
})();

