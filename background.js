let allTabs = [];

// Track which tabs are ready to receive messages
const injectedTabs = new Set();

// Update all tabs' sidebar
function updateAllTabs() {
  chrome.windows.getAll({ populate: true }, (windows) => {
    allTabs = windows.flatMap(w => w.tabs);

    // Send updates only to tabs that have overlay
    injectedTabs.forEach(tabId => {
      chrome.tabs.sendMessage(tabId, { type: "updateTabs", tabs: allTabs }, () => {
        if (chrome.runtime.lastError) {
          // Tab doesn't have overlay yet → ignore
        }
      });
    });
  });
}

// Tab events
chrome.tabs.onCreated.addListener(updateAllTabs);
chrome.tabs.onRemoved.addListener(updateAllTabs);
chrome.tabs.onUpdated.addListener(updateAllTabs);
chrome.tabs.onActivated.addListener(updateAllTabs);

// Listen for messages from overlay
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender.tab) return;

  const tabId = sender.tab.id;

  // Mark tab as injected
  if (msg.type === "overlayLoaded") {
    injectedTabs.add(tabId);
    updateAllTabs(); // send initial tab list
  }

  // Activate a tab
  if (msg.type === "activateTab") {
    chrome.tabs.update(msg.tabId, { active: true });
  }

  // Pin or unpin a tab
  if (msg.type === "togglePin") {
    chrome.tabs.update(msg.tabId, { pinned: !msg.pinned });
  }

  // Return current tabs to overlay
  if (msg.type === "getTabs") {
    chrome.windows.getCurrent({ populate: true }, (win) => {
      sendResponse({ tabs: win.tabs, windowId: win.id });
    });
    return true; // keep sendResponse alive
  }
});

