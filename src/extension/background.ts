/// <reference types="chrome"/>
// Active tab tracking
let activeTabId: number | null = null;
let ws: WebSocket | null = null;
let messageQueue: any[] = [];
let isConnecting = false;
let lastSentPayload = "";

const connectWebSocket = () => {
  // If we are already connected or in the middle of connecting, do nothing.
  if (isConnecting || (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING))) {
    return;
  }

  isConnecting = true;
  ws = new WebSocket("ws://127.0.0.1:3012");

  ws.onopen = () => {
    isConnecting = false;
    // Send only the most recent message from the queue
    if (messageQueue.length > 0 && ws) {
      const msg = messageQueue[messageQueue.length - 1];
      ws.send(JSON.stringify({ type: "ACTIVITY", payload: msg }));
      messageQueue = [];
    }
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

// Initial connection
connectWebSocket();

// Keep-alive for Service Worker in MV3
chrome.alarms.create('keep-alive', { periodInMinutes: 0.4 }); // Every 24 seconds
chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  if (alarm.name === 'keep-alive') {
    connectWebSocket();
  }
});

// Listen for tab updates (like navigation within a site)
chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
  if (tab.active) {
    activeTabId = tabId;
    if (changeInfo.status === 'complete') {
        chrome.tabs.sendMessage(tabId, { type: "REQUEST_UPDATE" }).catch(() => {});
    }
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo: chrome.tabs.TabActiveInfo) => {
  activeTabId = activeInfo.tabId;
  chrome.tabs.sendMessage(activeTabId, { type: "REQUEST_UPDATE" }).catch(() => {});
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener((windowId: number) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs.query({ active: true, windowId: windowId }, (tabs: chrome.tabs.Tab[]) => {
    if (tabs.length > 0) {
      activeTabId = tabs[0].id!;
      chrome.tabs.sendMessage(activeTabId, { type: "REQUEST_UPDATE" }).catch(() => {});
    }
  });
});

// Clear RPC when the active tab is closed
chrome.tabs.onRemoved.addListener((tabId: number) => {
  if (tabId === activeTabId) {
    activeTabId = null;
    lastSentPayload = "";
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "CLEAR" }));
    }
  }
});

// Receive data from content scripts
chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender) => {
  // Only process messages from the currently active tab
  if (sender.tab && sender.tab.id === activeTabId) {
    const payloadString = JSON.stringify(message);
    if (payloadString === lastSentPayload) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
      lastSentPayload = payloadString;
      ws.send(JSON.stringify({ type: "ACTIVITY", payload: message }));
    } else {
      // Queue the message and try to connect
      messageQueue = [message]; // Only keep the latest activity
      connectWebSocket();
    }
  }
});
