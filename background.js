// ---------------------------
// SHRM - Tiny Tab Rail Overlay
// Background
// ---------------------------

let injectedTabs = new Set();

// ---------------------------
// Inject overlay into a tab
// ---------------------------
function injectOverlayIntoTab(tabId) {
  if (chrome.scripting && chrome.scripting.executeScript) {
    // MV3 method
    chrome.scripting.insertCSS({ target: { tabId }, files: ["overlay.css"] }).catch(() => {});
    chrome.scripting.executeScript({ target: { tabId }, files: ["overlay.js"] }).catch(() => {});
  } else if (chrome.tabs && chrome.tabs.executeScript) {
    // MV2 fallback
    chrome.tabs.insertCSS(tabId, { file: "overlay.css" });
    chrome.tabs.executeScript(tabId, { file: "overlay.js" });
  }
}

// Inject overlay into all tabs
function injectOverlayIntoAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (!tab.url.startsWith("http")) return;
      injectOverlayIntoTab(tab.id);
    });
  });
}

// ---------------------------
// Update all injected tabs
// ---------------------------
function updateAllTabs() {
  chrome.windows.getAll({ populate: true }, (windows) => {
    const allTabs = windows.flatMap(w => w.tabs);
    injectedTabs.forEach(tabId => {
      chrome.tabs.sendMessage(tabId, { type: "updateTabs", tabs: allTabs });
    });
  });
}

// ---------------------------
// Listen for messages
// ---------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender.tab) return;

  const tabId = sender.tab.id;

  if (msg.type === "overlayLoaded") {
    injectedTabs.add(tabId);

    chrome.windows.getAll({ populate: true }, (windows) => {
      const allTabs = windows.flatMap(w => w.tabs);

      // Send initial tabs to the overlay
      sendResponse({ tabs: allTabs });

      // Update all other overlays
      injectedTabs.forEach(id => {
        if (id === tabId) return;
        chrome.tabs.sendMessage(id, { type: "updateTabs", tabs: allTabs });
      });
    });

    return true; // important: keep sendResponse alive
  }

  if (msg.type === "activateTab") {
    chrome.tabs.update(msg.tabId, { active: true });
  }

  if (msg.type === "togglePin") {
    chrome.tabs.update(msg.tabId, { pinned: !msg.pinned });
  }

  if (msg.type === "getTabs") {
    chrome.windows.getCurrent({ populate: true }, (win) => {
      sendResponse({ tabs: win.tabs, windowId: win.id });
    });
    return true; // important for async response
  }
});

// ---------------------------
// Tab event listeners
// ---------------------------
chrome.tabs.onCreated.addListener(updateAllTabs);
chrome.tabs.onRemoved.addListener(updateAllTabs);
chrome.tabs.onUpdated.addListener(updateAllTabs);
chrome.tabs.onActivated.addListener(updateAllTabs);

// ---------------------------
// Inject overlay on install/startup
// ---------------------------
chrome.runtime.onInstalled.addListener(() => injectOverlayIntoAllTabs());
chrome.runtime.onStartup.addListener(() => injectOverlayIntoAllTabs());
chrome.action.onClicked.addListener(() => injectOverlayIntoAllTabs());

function updateAllTabs() {
  chrome.windows.getAll({ populate: true }, (windows) => {
    const allTabs = windows.flatMap(w => w.tabs);

    injectedTabs.forEach(tabId => {
      const tab = allTabs.find(t => t.id === tabId);
      if (!tab) return;
      // Only send to http/https pages
      if (!tab.url.startsWith("http")) return;

      chrome.tabs.sendMessage(tabId, { type: "updateTabs", tabs: allTabs }, () => {
        // ignore runtime.lastError (tab might not have overlay yet)
        if (chrome.runtime.lastError) return;
      });
    });
  });
}

