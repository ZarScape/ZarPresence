/// <reference types="chrome"/>
// Multi-tab tracking
let activeTabId: number | null = null;
let currentRpcTabId: number | null = null;
let tabPayloads: Map<number, any> = new Map();
let ws: WebSocket | null = null;
let isConnecting = false;
let lastSentPayloadString = "";

const connectWebSocket = () => {
  if (isConnecting || (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING))) {
    return;
  }

  isConnecting = true;
  ws = new WebSocket("ws://127.0.0.1:3012");

  ws.onopen = () => {
    isConnecting = false;
    updateRpc();
  };

  ws.onclose = () => {
    isConnecting = false;
    ws = null;
  };

  ws.onerror = () => {
    isConnecting = false;
    ws = null;
  };
};

const updateRpc = () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWebSocket();
    return;
  }

  // Selection Logic:
  // 1. If active tab has a payload, use it.
  // 2. Otherwise, use the most recent tab that is "playing".
  // 3. Otherwise, use the most recent tab that has ANY payload.
  // 4. Otherwise, CLEAR.

  let targetTabId: number | null = null;

  if (activeTabId && tabPayloads.has(activeTabId)) {
    targetTabId = activeTabId;
  } else {
    // Find the most recent playing tab
    const entries = Array.from(tabPayloads.entries()).reverse();
    const playingTab = entries.find(([_, payload]) => !payload.is_paused && !payload.is_browsing);
    if (playingTab) {
      targetTabId = playingTab[0];
    } else if (entries.length > 0) {
      targetTabId = entries[0][0];
    }
  }

  if (targetTabId) {
    const payload = tabPayloads.get(targetTabId);
    const payloadString = JSON.stringify({ type: "ACTIVITY", payload });
    
    if (payloadString !== lastSentPayloadString || targetTabId !== currentRpcTabId) {
      lastSentPayloadString = payloadString;
      currentRpcTabId = targetTabId;
      ws.send(payloadString);
    }
  } else if (currentRpcTabId !== null) {
    // Nothing to show, clear it
    ws.send(JSON.stringify({ type: "CLEAR" }));
    currentRpcTabId = null;
    lastSentPayloadString = "";
  }
};

// Periodic polling to keep background tabs "live"
setInterval(() => {
  tabPayloads.forEach((_, tabId) => {
    chrome.tabs.sendMessage(tabId, { type: "REQUEST_UPDATE" }).catch(() => {
      // If message fails, tab might have navigated away or closed without us knowing
      tabPayloads.delete(tabId);
      updateRpc();
    });
  });
}, 3000); // Poll every 3 seconds

// Initial connection
connectWebSocket();

// Keep-alive for Service Worker in MV3
chrome.alarms.create('keep-alive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  if (alarm.name === 'keep-alive') connectWebSocket();
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
  if (tab.active) activeTabId = tabId;
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { type: "REQUEST_UPDATE" }).catch(() => {});
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo: chrome.tabs.TabActiveInfo) => {
  activeTabId = activeInfo.tabId;
  updateRpc();
  chrome.tabs.sendMessage(activeTabId, { type: "REQUEST_UPDATE" }).catch(() => {});
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener((windowId: number) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs.query({ active: true, windowId: windowId }, (tabs: chrome.tabs.Tab[]) => {
    if (tabs.length > 0) {
      activeTabId = tabs[0].id!;
      updateRpc();
      chrome.tabs.sendMessage(activeTabId, { type: "REQUEST_UPDATE" }).catch(() => {});
    }
  });
});

// Clear RPC when the tab providing data is closed
chrome.tabs.onRemoved.addListener((tabId: number) => {
  if (tabPayloads.has(tabId)) {
    tabPayloads.delete(tabId);
    if (tabId === activeTabId) activeTabId = null;
    updateRpc(); // This will handle clearing or switching to another tab
  }
});

// Receive data from content scripts
chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender) => {
  if (sender.tab && sender.tab.id) {
    const tabId = sender.tab.id;
    
    // Store the payload for this tab
    tabPayloads.set(tabId, message);
    
    // Trigger an update
    updateRpc();
  }
});
