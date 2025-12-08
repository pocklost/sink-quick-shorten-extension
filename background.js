chrome.action.onClicked.addListener(async (tab) => {
  try {
    const { host } = await chrome.storage.local.get({ host: '' });
    if (!host || !host.trim()) {
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
    handleApiRequest(msg, sendResponse);
    return true;
  }
  if (sendResponse) {
    sendResponse({ success: false, error: 'Unknown message type' });
  }
  return true;
});

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
      try { chrome.action.openPopup(); } catch (_) {}
      return;
    }
    const pageUrl = info.linkUrl || info.pageUrl || (tab && tab.url) || '';
    if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) return;

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

    if (tab && tab.id) {
      const i18n = {
        title: chrome.i18n.getMessage('createdAndCopied') || 'Short link created',
        copy: chrome.i18n.getMessage('copy') || 'Copy',
        close: chrome.i18n.getMessage('close') || 'Close',
        copied: chrome.i18n.getMessage('copied') || 'Copied',
        copyFailed: chrome.i18n.getMessage('failed') || 'Failed'
      };
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [shortLink, i18n],
          func: (text, i18nText) => {
            try { navigator.clipboard.writeText(text); } catch (_) {}
            try {
              const existing = document.getElementById('sink-toast');
              if (existing) existing.remove();

              const toast = document.createElement('div');
              toast.id = 'sink-toast';
              toast.style.cssText = `
                position:fixed; right:16px; bottom:16px; z-index:2147483647;
                background:#1A1A1A; color:#f1f1f1; border:1px solid #333;
                border-radius:12px; padding:12px 14px; min-width:220px;
                box-shadow:0 10px 25px rgba(0,0,0,0.35); font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                display:flex; flex-direction:column; gap:8px; animation:fadeInToast 150ms ease;
              `;

              const title = document.createElement('div');
              title.textContent = i18nText?.title || 'Short link created';
              title.style.cssText = 'font-size:14px; font-weight:600;';

              const linkRow = document.createElement('div');
              linkRow.textContent = text;
              linkRow.style.cssText = 'font-size:12px; color:#cbd5e1; word-break:break-all;';

              const btnRow = document.createElement('div');
              btnRow.style.cssText = 'display:flex; gap:8px; justify-content:flex-end;';

              const copyBtn = document.createElement('button');
              copyBtn.textContent = i18nText?.copy || 'Copy';
              copyBtn.style.cssText = `
                padding:8px 12px; border-radius:10px; border:1px solid #333;
                background:#2A2A2A; color:#fff; cursor:pointer; font-size:13px;
                transition:all .15s ease;
              `;
              copyBtn.onmouseenter = () => { copyBtn.style.filter = 'brightness(1.1)'; };
              copyBtn.onmouseleave = () => { copyBtn.style.filter = 'brightness(1)'; };
              copyBtn.onclick = async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  copyBtn.textContent = i18nText?.copied || 'Copied';
                  setTimeout(() => { copyBtn.textContent = i18nText?.copy || 'Copy'; }, 1200);
                } catch (_) {
                  copyBtn.textContent = i18nText?.copyFailed || 'Failed';
                }
              };

              const closeBtn = document.createElement('button');
              closeBtn.textContent = i18nText?.close || 'Close';
              closeBtn.style.cssText = `
                padding:8px 10px; border-radius:10px; border:1px solid #333;
                background:#1f1f1f; color:#e5e7eb; cursor:pointer; font-size:13px;
                transition:all .15s ease;
              `;
              closeBtn.onclick = () => toast.remove();

              btnRow.appendChild(closeBtn);
              btnRow.appendChild(copyBtn);

              toast.appendChild(title);
              toast.appendChild(linkRow);
              toast.appendChild(btnRow);

              const style = document.createElement('style');
              style.textContent = `
                @keyframes fadeInToast { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
              `;
              toast.appendChild(style);

              document.body.appendChild(toast);

              setTimeout(() => { toast.remove(); }, 12000);
            } catch (e) {
              console.error('toast inject failed', e);
            }
          },
        });
      } catch (_) {}
    }
  } catch (_) {}
});
