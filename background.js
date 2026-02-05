// ---------------------------
// SHRM - Tiny Tab Rail Overlay
// Background (MV3 safe)
// ---------------------------

let globalTabsCache = [];
let broadcastTimer = null;

// ---------------------------
// Build tabs snapshot
// ---------------------------
function rebuildTabsCache(callback) {
  chrome.windows.getAll({ populate: true }, (windows) => {
    globalTabsCache = (windows || []).flatMap(w => (w.tabs || []));
    if (callback) callback();
  });
}

// ---------------------------
// Broadcast updated snapshot to all overlays
// ---------------------------
function broadcastTabsUpdated() {
  // Only send to normal web pages where your overlay can exist
  chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
    (tabs || []).forEach((tab) => {
      if (!tab || typeof tab.id !== "number") return;

      try {
        chrome.tabs.sendMessage(
          tab.id,
          { type: "tabsUpdated", tabs: globalTabsCache },
          () => {
            // Ignore errors like "Receiving end does not exist"
            if (chrome.runtime.lastError) {}
          }
        );
      } catch (e) {
        // ignore
      }
    });
  });
}

// ---------------------------
// Debounced rebuild + broadcast (prevents spamming)
// ---------------------------
function scheduleRebuildAndBroadcast() {
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(() => {
    rebuildTabsCache(() => {
      broadcastTabsUpdated();
    });
  }, 80);
}

// ---------------------------
// Inject overlay into a tab (idempotent)
// ---------------------------
async function injectOverlayIntoTab(tabId) {
  if (!chrome.scripting?.executeScript) return;

  try {
    // If rail exists already, don't inject again
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => !!document.getElementById("__tinyTabRail__rail"),
    });

    const alreadyInjected = !!(results && results[0] && results[0].result);
    if (alreadyInjected) return;

    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["overlay.css"],
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["overlay.js"],
    });
  } catch (e) {
    // ignore (restricted pages, tab not ready, etc.)
  }
}

// ---------------------------
// Inject overlay into all valid tabs
// ---------------------------
function injectOverlayIntoAllTabs() {
  chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
    (tabs || []).forEach((tab) => {
      if (!tab || typeof tab.id !== "number") return;
      injectOverlayIntoTab(tab.id);
    });
  });
}

// ---------------------------
// Message handling
// ---------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  // Overlay requests current snapshot
  if (msg.type === "getTabsSnapshot") {
    rebuildTabsCache(() => {
      sendResponse({ tabs: globalTabsCache });
    });
    return true; // async response
  }

  // Activate tab
  if (msg.type === "activateTab" && typeof msg.tabId === "number") {
    chrome.tabs.update(msg.tabId, { active: true }, () => {
      scheduleRebuildAndBroadcast();
    });
  }

  // Toggle pin
  if (msg.type === "togglePin" && typeof msg.tabId === "number") {
    chrome.tabs.update(msg.tabId, { pinned: !msg.pinned }, () => {
      scheduleRebuildAndBroadcast();
    });
  }
});

// ---------------------------
// Track tab changes (rebuild + broadcast)
// ---------------------------
chrome.tabs.onCreated.addListener(() => scheduleRebuildAndBroadcast());
chrome.tabs.onRemoved.addListener(() => scheduleRebuildAndBroadcast());
chrome.tabs.onActivated.addListener(() => scheduleRebuildAndBroadcast());
chrome.tabs.onMoved.addListener(() => scheduleRebuildAndBroadcast());
chrome.tabs.onAttached.addListener(() => scheduleRebuildAndBroadcast());
chrome.tabs.onDetached.addListener(() => scheduleRebuildAndBroadcast());

// When a tab finishes loading, try to inject overlay (only if http/https)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  scheduleRebuildAndBroadcast();

  if (changeInfo && changeInfo.status === "complete") {
    const url = tab && tab.url;
    if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
      injectOverlayIntoTab(tabId);
    }
  }
});

// ---------------------------
// Startup / install
// ---------------------------
chrome.runtime.onInstalled.addListener(() => {
  scheduleRebuildAndBroadcast();
  injectOverlayIntoAllTabs();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleRebuildAndBroadcast();
  injectOverlayIntoAllTabs();
});

chrome.action.onClicked.addListener(() => {
  injectOverlayIntoAllTabs();
});

