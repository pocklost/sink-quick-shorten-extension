chrome.action.onClicked.addListener(async (tab) => {
  try {
    const { host } = await chrome.storage.local.get({ host: '' });
    if (!host || !host.trim()) {
      // Open popup instead if no host configured
      chrome.action.openPopup();
      return;
    }
    const currentUrl = encodeURIComponent(tab?.url || "");
    const target = `${host}/dashboard/links?open=create&url=${currentUrl}`;
    await chrome.tabs.create({ url: target });
  } catch (e) {
    console.error("Sink Quick Shorten failed:", e);
  }
});

// Context menu integration
const MENU_ID = 'sink_quick_shorten_menu';

async function readSettings() {
  const { host, token, autoDetectUrl, showContextMenu } = await chrome.storage.local.get({ host: '', token: '', autoDetectUrl: true, showContextMenu: true });
  return { host, token, autoDetectUrl, showContextMenu };
}

function ensureContextMenuCreated() {
  chrome.contextMenus.removeAll(() => {
    readSettings().then(({ showContextMenu }) => {
      if (!showContextMenu) return;
      const title = chrome.i18n.getMessage('contextMenuTitle') || 'Quick Shorten with Sink';
      chrome.contextMenus.create({ id: MENU_ID, title, contexts: ['page', 'selection', 'link'] });
    }).catch(() => {});
  });
}

chrome.runtime.onInstalled.addListener(() => {
  // Initialize default settings on first install/update
  chrome.storage.local.get({ autoDetectUrl: undefined, showContextMenu: undefined }, (cfg) => {
    const init = {};
    if (typeof cfg.autoDetectUrl === 'undefined') init.autoDetectUrl = true;
    if (typeof cfg.showContextMenu === 'undefined') init.showContextMenu = true;
    if (Object.keys(init).length) chrome.storage.local.set(init);
  });
  ensureContextMenuCreated();
});

chrome.runtime.onStartup?.addListener?.(() => {
  ensureContextMenuCreated();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'updateContextMenu') {
    ensureContextMenuCreated();
    sendResponse && sendResponse({ ok: true });
    return true;
  } else if (msg && msg.type === 'apiRequest') {
    // Handle API requests from popup to avoid CORS issues
    handleApiRequest(msg, sendResponse);
    return true; // Indicates we will send a response asynchronously
  }
  // If no handler found, send an error response
  if (sendResponse) {
    sendResponse({ success: false, error: 'Unknown message type' });
  }
  return true;
});

// Handle API requests from popup
async function handleApiRequest(msg, sendResponse) {
  let responseSent = false;
  
  const safeSendResponse = (data) => {
    if (!responseSent && sendResponse) {
      responseSent = true;
      try {
        sendResponse(data);
      } catch (e) {
        console.error('Failed to send response:', e);
      }
    }
  };

  try {
    const { host, token } = await readSettings();
    
    if (!host || !host.trim()) {
      safeSendResponse({ 
        success: false, 
        error: 'Host not configured' 
      });
      return;
    }
    
    if (!token || token.length < 8) {
      safeSendResponse({ 
        success: false, 
        error: 'Token not configured' 
      });
      return;
    }

    const { endpoint, method = 'GET', body, customHost } = msg;
    if (!endpoint) {
      safeSendResponse({
        success: false,
        error: 'No endpoint specified'
      });
      return;
    }

    const url = customHost ? `${customHost}${endpoint}` : `${host}${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    console.log('Making API request via background script to:', url);
    const response = await fetch(url, options);
    const responseData = await response.text();
    
    if (!response.ok) {
      safeSendResponse({
        success: false,
        error: `HTTP ${response.status}: ${responseData}`,
        status: response.status
      });
      return;
    }
    
    try {
      const jsonData = JSON.parse(responseData);
      safeSendResponse({
        success: true,
        data: jsonData
      });
    } catch (e) {
      safeSendResponse({
        success: true,
        data: responseData
      });
    }
    
  } catch (error) {
    console.error('API request error:', error);
    safeSendResponse({
      success: false,
      error: error.message || error.toString()
    });
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  try {
    const { host, token } = await readSettings();
    if (!host || !host.trim() || !token || token.length < 8) {
      // Open the popup directly without alert
      try { chrome.action.openPopup(); } catch (_) {}
      return;
    }
    const pageUrl = info.linkUrl || info.pageUrl || (tab && tab.url) || '';
    if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) return;

    // Generate a simple random slug
    const slug = (() => {
      const chars = '23456789abcdefghjkmnpqrstuvwxyz';
      let s = '';
      for (let i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
      return s;
    })();

    const body = { url: pageUrl, slug };
    const resp = await fetch(`${host}api/link/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('API error:', resp.status, errorText);
      return;
    }
    const data = await resp.json();
    const shortLink = data?.shortLink || `${host}${slug}`;

    // Copy to clipboard by executing script in the page context
    if (tab && tab.id) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [shortLink],
          func: (text) => {
            try { navigator.clipboard.writeText(text); } catch (_) {}
          },
        });
      } catch (_) {}
    }
  } catch (_) {}
});
