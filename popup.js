function isDarkMode() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (_) {
    return false;
  }
}

function themeColors() {
  if (isDarkMode()) {
    return {
      bg: '#0F0F0F',
      cardBg: '#1A1A1A',
      overlay: 'rgba(0,0,0,0.5)',
      border: '#252525',
      borderSoft: '#333333',
      text: '#f1f1f1',
      textMuted: '#a1a1aa',
      textSecondary: '#c1c1c1',
      primary: '#333333',
      secondary: '#2A2A2A',
      hover: '#252525',
      listItem: '#252525',
      listItemHover: '#1A1A1A',
      separator: '#2F2F2F',
      chartStroke: '#e5e7eb',
      chartFillTop: 'rgba(229,231,235,0.2)'
    };
  }
  return {
    bg: '#ffffff',
    cardBg: '#fff',
    overlay: 'rgba(0,0,0,0.5)',
    border: '#e5e7eb',
    borderSoft: '#d1d5db',
    text: '#111827',
    textMuted: '#6b7280',
    textSecondary: '#374151',
    primary: '#111827',
    secondary: '#fff',
    hover: '#f3f4f6',
    listItem: '#fff',
    listItemHover: '#f8fafc',
    separator: '#e5e7eb',
    chartStroke: '#111827',
    chartFillTop: 'rgba(17,24,39,0.15)'
  };
}

function applyThemeToStaticElements() {
  const c = themeColors();
  const prefix = document.getElementById('host-prefix');
  const slugInput = document.getElementById('input-slug');
  if (prefix && prefix.parentElement) {
    const wrap = prefix.parentElement;
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.padding = '10px 12px';
    wrap.style.border = `1px solid ${c.border}`;
    wrap.style.borderRadius = '12px';
    wrap.style.background = isDarkMode() ? '#1A1A1A' : '#f9fafb';
    wrap.style.minWidth = '0';
  }
  if (prefix) {
    prefix.style.fontWeight = '600';
    prefix.style.color = c.text;
  }
  if (slugInput) {
    slugInput.style.border = 'none';
    slugInput.style.padding = '0px';
    slugInput.style.marginLeft = '0px';
    slugInput.style.flex = '2 1 0%';
    slugInput.style.minWidth = '0px';
    slugInput.style.background = 'transparent';
    slugInput.style.color = c.text;
  }
  const tabsEl = document.querySelector('.tabs');
  if (tabsEl) {
    const cWrap = themeColors();
    tabsEl.style.background = isDarkMode() ? '#1A1A1A' : '#f3f4f6';
    tabsEl.style.border = `1px solid ${cWrap.border}`;
    tabsEl.style.borderRadius = '12px';
    tabsEl.style.padding = '4px';
    const btns = tabsEl.querySelectorAll('button[data-tab]');
    btns.forEach((b) => {
      const active = b.classList.contains('active');
      b.style.background = active ? c.primary : 'transparent';
      b.style.color = active ? '#fff' : c.textMuted;
    });
  }
  const existing = document.getElementById('dynamic-scrollbar-style');
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = 'dynamic-scrollbar-style';
  style.textContent = `
    #links::-webkit-scrollbar{width:10px;height:10px}
    #links::-webkit-scrollbar-track{background:${isDarkMode() ? '#1A1A1A' : '#f1f5f9'};border-radius:8px}
    #links::-webkit-scrollbar-thumb{background:${isDarkMode() ? '#2A2A2A' : '#cbd5e1'};border-radius:8px;border:2px solid ${isDarkMode() ? '#1A1A1A' : '#f1f5f9'}}
    #links::-webkit-scrollbar-thumb:hover{background:${isDarkMode() ? '#3A3A3A' : '#94a3b8'}}
  `;
  document.head.appendChild(style);
}

async function jumpToSink() {
  const { host } = await readSettings();
  if (!host || !host.trim()) {
    await showInfoDialog('Settings', chrome.i18n.getMessage('configureHostFirst') || 'Please configure host in Settings.', [
      { id: 'open-settings', label: 'OK', primary: true }
    ]);
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = encodeURIComponent(tab?.url || '');
  const target = `${host}dashboard/links`;
  await chrome.tabs.create({ url: target });
}
async function showInfoDialog(title, message, actions = [{ id: 'ok', label: 'OK', primary: true }]) {
  return new Promise((resolve) => {
    const c = themeColors();
    const dialog = document.createElement('div');
    dialog.style = `position:fixed; top:0; left:0; right:0; bottom:0; background:${c.overlay}; display:flex; align-items:center; justify-content:center; z-index:1000;`;
    const dialogContent = document.createElement('div');
    dialogContent.style = `background:${c.cardBg}; border-radius:12px; padding:20px; max-width:320px; margin:20px; box-shadow:0 10px 25px rgba(0,0,0,0.2); border:1px solid ${c.border}; color:${c.text};`;
    dialogContent.innerHTML = `
      <div style="font-weight:600; font-size:16px; margin-bottom:8px; color:${c.text};">${title || ''}</div>
      <div style="color:${c.textMuted}; font-size:14px; margin-bottom:20px;">${message || ''}</div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        ${actions.map(a => `<button data-id="${a.id}" style="padding:8px 16px; border:1px solid ${a.primary ? c.primary : c.borderSoft}; border-radius:8px; background:${a.primary ? c.primary : c.secondary}; color:${a.primary ? '#fff' : c.textSecondary}; cursor:pointer; font-size:14px;">${a.label}</button>`).join('')}
      </div>
    `;
    dialog.appendChild(dialogContent);
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const id = target.getAttribute('data-id');
      if (!id) return;
      document.body.removeChild(dialog);
      if (id === 'open-settings') switchTab('settings');
      resolve(id);
    });
  });
}

document.getElementById('open')?.addEventListener('click', async (e) => {
  const createBtn = document.getElementById('create');
  if (createBtn && createBtn.dataset.editing === 'true') {
    e.preventDefault();
    e.stopPropagation();
    createBtn.dataset.editing = 'false';
    delete createBtn.dataset.originalSlug;
    await updateButtonText();
    
    const slugInput = document.getElementById('input-slug');
    const randomBtn = document.getElementById('generate-slug');
    if (slugInput) {
      slugInput.readOnly = false;
      slugInput.style.background = '';
      slugInput.style.color = '';
      slugInput.title = '';
    }
    if (randomBtn) {
      randomBtn.disabled = false;
      randomBtn.style.opacity = '';
      randomBtn.title = '';
    }
    
    document.getElementById('input-url').value = '';
    document.getElementById('input-slug').value = '';
    document.getElementById('input-comment').value = '';
    document.getElementById('input-expiration').value = '';
    const result = document.getElementById('result');
    result.textContent = '';
    skipAutofillOnce = true;
    switchTab('create');
    return;
  }
  jumpToSink();
});

async function getActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || '';
}

function normalizeHostUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  let normalized = url.trim();
  
  if (!normalized.match(/^https?:\/\//)) {
    normalized = 'https://' + normalized;
  }
  
  try {
    const urlObj = new URL(normalized);
    normalized = `${urlObj.protocol}//${urlObj.hostname}`;
    
    if (urlObj.port && urlObj.port !== '80' && urlObj.port !== '443') {
      normalized += `:${urlObj.port}`;
    }
    
    if (!normalized.endsWith('/')) {
      normalized += '/';
    }
    
    return normalized;
  } catch (e) {
    return '';
  }
}

function validateHostUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) return false;
    
    if (!urlObj.hostname || urlObj.hostname.length < 3) return false;
    
    if (!urlObj.hostname.includes('.')) return false;
    
    return true;
  } catch (e) {
    return false;
  }
}

async function readSettings() {
  const { host, token, autoDetectUrl, showContextMenu } = await chrome.storage.local.get({ host: '', token: '', autoDetectUrl: true, showContextMenu: true });
  return { host, token, autoDetectUrl, showContextMenu };
}

async function apiCall(endpoint, method = 'GET', body = null, customHost = null) {
  const { host, token } = await readSettings();
  
  if (!host || !host.trim()) {
    throw new Error('Host not configured');
  }
  
  if (!token || token.length < 8) {
    throw new Error('Token not configured');
  }

  const url = customHost ? `${customHost}${endpoint}` : `${host}${endpoint}`;
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      mode: 'cors',
      credentials: 'omit',
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    console.log('Making direct API request to:', url);
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const responseData = await response.text();
    
    try {
      return JSON.parse(responseData);
    } catch (e) {
      return responseData;
    }
  } catch (error) {
    if (error.message.includes('CORS') || error.message.includes('blocked') || error.message.includes('Access-Control-Allow-Origin')) {
      console.log('CORS error detected, trying background script fallback...');
      return await apiCallViaBackground(endpoint, method, body, customHost);
    }
    throw error;
  }
}

async function apiCallViaBackground(endpoint, method = 'GET', body = null, customHost = null) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout - background script may not be responding'));
    }, 30000);

    chrome.runtime.sendMessage({
      type: 'apiRequest',
      endpoint,
      method,
      body,
      customHost
    }, (response) => {
      clearTimeout(timeout);
      
      if (chrome.runtime.lastError) {
        reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
        return;
      }
      
      if (!response) {
        reject(new Error('No response received from background script'));
        return;
      }
      
      if (response.success) {
        resolve(response.data);
      } else {
        reject(new Error(response.error || 'Unknown API error'));
      }
    });
  });
}

async function writeSettings(next) {
  const current = await readSettings();
  const updated = { ...current, ...next };
  await chrome.storage.local.set(updated);
  return updated;
}

async function validateLogin() {
  try {
    const { host, token } = await readSettings();
    if (!host || !host.trim() || !token || token.length < 8) {
      return false;
    }
    
    const response = await fetch(`${host}api/link/list?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return response.ok;
  } catch (error) {
    console.error('Login validation failed:', error);
    return false;
  }
}

async function createViaAPI() {
  const result = document.getElementById('result');
  result.textContent = '';
  try {
    const { host, token } = await readSettings();
    if (!host || !host.trim()) {
      await showInfoDialog('Settings', chrome.i18n.getMessage('configureHostFirst') || 'Please configure host in Settings.', [
        { id: 'open-settings', label: 'OK', primary: true }
      ]);
      return;
    }
    if (!token || token.length < 8) {
      await showInfoDialog('Settings', chrome.i18n.getMessage('missingToken') || 'Missing token. Please set it in Settings.', [
        { id: 'open-settings', label: 'OK', primary: true }
      ]);
      return;
    }
     const inputUrl = document.getElementById('input-url');
     const inputSlug = document.getElementById('input-slug');
     const inputComment = document.getElementById('input-comment');
     const inputExpiration = document.getElementById('input-expiration');
     
     const url = inputUrl.value.trim();
     if (!url) {
      result.textContent = chrome.i18n.getMessage('destinationUrlRequired') || 'Destination URL is required';
       inputUrl.classList.add('error');
       inputUrl.focus();
       return;
     }
     
     inputUrl.classList.remove('error');
     
     let slug = inputSlug.value.trim();
     const comment = inputComment.value.trim();
     const expiration = inputExpiration.value;
     
     if (!slug) {
       slug = generateRandomSlug();
       inputSlug.value = slug;
     }
     
    const body = { url, slug };
     if (comment) body.comment = comment;
    if (expiration) {
      const expirationDate = new Date(expiration);
      body.expiration = Math.floor(expirationDate.getTime() / 1000);
    }

    const createBtn = document.getElementById('create');
    const isEditing = createBtn.dataset.editing === 'true';
    const originalSlug = createBtn.dataset.originalSlug;
    
     let apiEndpoint = 'api/link/create';
     let method = 'POST';
    if (isEditing) {
       apiEndpoint = 'api/link/edit';
       method = 'PUT';
      if (originalSlug && originalSlug !== slug) {
        body.originalSlug = originalSlug;
      }
     }
     
     const data = await apiCall(apiEndpoint, method, body);
    if (data?.shortLink) {
      try { await navigator.clipboard.writeText(data.shortLink); } catch (e) {}
      
      const successFeedback = document.getElementById('success-feedback');
      const successText = document.getElementById('success-text');
      if (successFeedback && successText) {
        successText.textContent = isEditing ? 
          (chrome.i18n.getMessage('updatedAndCopied') || 'Updated and copied!') : 
          (chrome.i18n.getMessage('createdAndCopied') || 'Created and copied!');
        successFeedback.style.display = 'block';
        successFeedback.style.opacity = '0';
        successFeedback.style.transform = 'translateY(-10px)';
        
        requestAnimationFrame(() => {
          successFeedback.style.transition = 'all 0.3s ease';
          successFeedback.style.opacity = '1';
          successFeedback.style.transform = 'translateY(0)';
        });
        
        setTimeout(() => {
          successFeedback.style.opacity = '0';
          successFeedback.style.transform = 'translateY(-10px)';
          setTimeout(() => {
            successFeedback.style.display = 'none';
          }, 300);
        }, 3000);
      }
      
      const resultArea = document.getElementById('result-area');
      if (resultArea) {
        resultArea.style.display = 'block';
        resultArea.dataset.shortUrl = data.shortLink;
      }
    } else {
      result.textContent = isEditing ? 'Updated successfully' : 'Created successfully (no shortLink returned)';
    }
    
     if (isEditing) {
       createBtn.dataset.editing = 'false';
       delete createBtn.dataset.originalSlug;
       await updateButtonText();
       
       const slugInput = document.getElementById('input-slug');
       const randomBtn = document.getElementById('generate-slug');
       if (slugInput) {
         slugInput.readOnly = false;
         slugInput.style.background = '';
         slugInput.style.color = '';
         slugInput.title = '';
       }
       if (randomBtn) {
         randomBtn.disabled = false;
         randomBtn.style.opacity = '';
         randomBtn.title = '';
       }
       
       document.getElementById('input-url').value = '';
       document.getElementById('input-slug').value = '';
       document.getElementById('input-comment').value = '';
       document.getElementById('input-expiration').value = '';
       const resultArea = document.getElementById('result-area');
       if (resultArea) resultArea.style.display = 'none';
     } else {
       document.getElementById('input-url').value = '';
       document.getElementById('input-slug').value = generateRandomSlug();
       document.getElementById('input-comment').value = '';
       document.getElementById('input-expiration').value = '';
       const resultArea = document.getElementById('result-area');
       if (resultArea) resultArea.style.display = 'none';
     }
  } catch (e) {
    result.textContent = `Error: ${e?.message || e}`;
  }
}

document.getElementById('create')?.addEventListener('click', createViaAPI);
document.getElementById('open-options')?.addEventListener('click', async (e) => {
  e.preventDefault();
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
});

function generateRandomSlug() {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz';
  let randomSlug = '';
  for (let i = 0; i < 6; i++) {
    randomSlug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return randomSlug;
}

document.getElementById('generate-slug')?.addEventListener('click', () => {
  const slugInput = document.getElementById('input-slug');
  if (slugInput) {
  slugInput.value = generateRandomSlug();
  }
});

(() => {
  const slugInput = document.getElementById('input-slug');
  if (!slugInput) return;
  slugInput.addEventListener('dblclick', () => { slugInput.value = generateRandomSlug(); });
})();

async function updateHostPrefix() {
  const { host } = await readSettings();
  const prefix = document.getElementById('host-prefix');
  if (prefix) prefix.textContent = host || 'https://example.com/';
}
updateHostPrefix();

try {
  applyThemeToStaticElements();
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', () => applyThemeToStaticElements());
    } else if (mq && mq.addListener) {
      mq.addListener(() => applyThemeToStaticElements());
    }
  }
} catch (_) {}



document.getElementById('toggle-advanced')?.addEventListener('click', async () => {
  const advanced = document.getElementById('advanced-options');
  const toggle = document.getElementById('toggle-advanced');
  let show = advanced.style.display === 'none';
  advanced.style.display = show ? 'grid' : 'none';
  toggle.textContent = show ? (chrome.i18n.getMessage('simple') || 'Simple') : (chrome.i18n.getMessage('advanced') || 'Advanced');
  await chrome.storage.local.set({ showAdvanced: show });
});

document.getElementById('btn-copy-result')?.addEventListener('click', async () => {
  const resultArea = document.getElementById('result-area');
  const shortUrl = resultArea?.dataset.shortUrl;
  if (shortUrl) {
    try {
      await navigator.clipboard.writeText(shortUrl);
      const result = document.getElementById('result');
      if (result) {
        result.textContent = `✅ ${(chrome.i18n.getMessage('copied') || 'Copied')}: ${shortUrl}`;
        setTimeout(() => { result.textContent = ''; }, 1200);
      }
    } catch (_) {}
  }
});

document.getElementById('btn-qr-result')?.addEventListener('click', () => {
  const resultArea = document.getElementById('result-area');
  const shortUrl = resultArea?.dataset.shortUrl;
  if (!shortUrl) return;
  
  const dialog = document.createElement('div');
  const c = themeColors();
  dialog.style = `position:fixed; inset:0; background:${c.overlay}; display:flex; align-items:center; justify-content:center;`;
  const box = document.createElement('div');
  box.style = `background:${c.cardBg}; color:${c.text}; padding:16px; border-radius:12px; display:grid; gap:10px; border:1px solid ${c.border};`;
  const img = document.createElement('img');
  img.src = `https://chart.googleapis.com/chart?cht=qr&chs=160x160&chl=${encodeURIComponent(shortUrl)}`;
  img.width = 160; img.height = 160; img.alt = 'QR';
  const close = document.createElement('button');
  close.textContent = chrome.i18n.getMessage('close') || 'Close';
  close.className = 'btn secondary';
  close.addEventListener('click', () => document.body.removeChild(dialog));
  const download = document.createElement('button');
  download.textContent = chrome.i18n.getMessage('download') || 'Download';
  download.className = 'btn primary';
  download.addEventListener('click', () => {
    const el = document.createElement('a');
    el.href = img.src;
    const slug = shortUrl.split('/').pop();
    el.download = `${slug}.png`;
    el.click();
  });
  box.appendChild(img); box.appendChild(download); box.appendChild(close); dialog.appendChild(box);
  document.body.appendChild(dialog);
});

let renderLinksSeq = 0;
async function renderLinks() {
  const mySeq = ++renderLinksSeq;
  const listEl = document.getElementById('links');
  const isDark = isDarkMode();
  const skeletonBg = isDark ? '#252525' : '#f0f0f0';
  const skeletonHighlight = isDark ? '#2A2A2A' : '#e0e0e0';
  listEl.innerHTML = `<div style="display:grid;gap:8px;"><div style="height:80px;background:linear-gradient(90deg,${skeletonBg} 25%,${skeletonHighlight} 50%,${skeletonBg} 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:12px;border:1px solid ${isDark ? '#333333' : '#e5e7eb'};"></div><div style="height:80px;background:linear-gradient(90deg,${skeletonBg} 25%,${skeletonHighlight} 50%,${skeletonBg} 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:12px;border:1px solid ${isDark ? '#333333' : '#e5e7eb'};"></div></div>`;
  try {
    const { host, token } = await readSettings();
    if (!host || !host.trim()) {
      if (mySeq !== renderLinksSeq) return;
      const c = themeColors();
      listEl.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;gap:16px;border:1px solid ${c.border};border-radius:14px;background:${c.cardBg};">
          <div style="width:64px;height:64px;border-radius:50%;background:${isDarkMode() ? '#2A2A2A' : '#f3f4f6'};display:flex;align-items:center;justify-content:center;margin:0 auto;">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${c.textMuted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div style="font-size:16px;font-weight:600;color:${c.text};">
            ${chrome.i18n.getMessage('configureHostFirst') || 'Please configure host in Settings'}
          </div>
          <button id="goto-settings-from-links" style="padding:10px 20px;border-radius:12px;border:1px solid ${c.border};background:${c.primary};color:#ffffff;cursor:pointer;font-size:14px;font-weight:500;transition:all 0.2s ease;margin-top:8px;">
            ${chrome.i18n.getMessage('goToSettings') || 'Go to Settings'}
          </button>
        </div>
      `;
      
      const gotoBtn = document.getElementById('goto-settings-from-links');
      if (gotoBtn) {
        gotoBtn.addEventListener('click', () => {
          switchTab('settings');
        });
        gotoBtn.addEventListener('mouseenter', () => {
          gotoBtn.style.filter = 'brightness(1.1)';
          gotoBtn.style.transform = 'translateY(-1px)';
        });
        gotoBtn.addEventListener('mouseleave', () => {
          gotoBtn.style.filter = 'brightness(1)';
          gotoBtn.style.transform = 'translateY(0)';
        });
      }
      return;
    }
    linksCursor = null;
    isLoadingMore = false;
    renderedSlugs.clear();

    const data = await apiCall('api/link/list?limit=20');
     const links = (data?.links || []).filter(Boolean);
     linksCursor = data?.cursor || null;
     if (mySeq !== renderLinksSeq) return;
     if (!links.length) {
       listEl.innerHTML = `<span style="font-size:12px; color:#6b7280;">${chrome.i18n.getMessage('noLinks') || 'No links.'}</span>`;
       return;
     }
     
     links.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
     
     const fragment = document.createDocumentFragment();
     for (const link of links) {
      if (renderedSlugs.has(link.slug)) continue;
      renderedSlugs.add(link.slug);
       const item = buildLinkItem(host, link);
       fragment.appendChild(item);
     }
     listEl.innerHTML = '';
     listEl.appendChild(fragment);
    attachInfiniteScroll(listEl);
  } catch (e) {
    if (mySeq !== renderLinksSeq) return;
    listEl.innerHTML = `<span style="font-size:12px; color:#b91c1c;">${chrome.i18n.getMessage('failedToLoad') || 'Failed to load'}: ${e?.message || e}</span>`;
  }
}

function throttle(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function attachInfiniteScroll(listEl) {
  if (listEl.dataset.scrollBound === 'true') return;
  listEl.dataset.scrollBound = 'true';
  
  const handleScroll = throttle(async () => {
    if (isLoadingMore || !linksCursor) return;
    const nearBottom = listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 40;
    if (!nearBottom) return;
    isLoadingMore = true;
    const loader = document.createElement('div');
    loader.className = 'muted';
    loader.style = 'text-align:center; padding:6px;';
    loader.textContent = chrome.i18n.getMessage('loading') || 'Loading...';
    listEl.appendChild(loader);
    try {
      const { host, token } = await readSettings();
      const data = await apiCall(`api/link/list?limit=20&cursor=${encodeURIComponent(linksCursor)}`);
      const next = (data?.links || []).filter(Boolean);
      linksCursor = data?.cursor || null;
      next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const fragment = document.createDocumentFragment();
      for (const link of next) {
        if (renderedSlugs.has(link.slug)) continue;
        renderedSlugs.add(link.slug);
        const { host } = await readSettings();
        const item = buildLinkItem(host, link);
        fragment.appendChild(item);
      }
      listEl.appendChild(fragment);
    } catch (e) {
      const err = document.createElement('div');
      err.className = 'muted';
      err.style = 'text-align:center; padding:6px; color:#b91c1c;';
      err.textContent = `Error: ${e?.message || e}`;
      listEl.appendChild(err);
    } finally {
      if (loader.parentElement) loader.parentElement.removeChild(loader);
      isLoadingMore = false;
    }
  }, 150);
  
  listEl.addEventListener('scroll', handleScroll, { passive: true });
}

function buildLinkItem(host, link, t) {
  const item = document.createElement('div');
  item.className = 'card';
  const c = themeColors();
  item.style.cssText = `display:flex; flex-direction:column; padding:12px; gap:8px; cursor:pointer; transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1); max-width:100%; background:${c.cardBg}; border:1px solid ${c.border}; color:${c.text}; will-change:transform,background-color,border-color; transform:translateZ(0);`;
  item.addEventListener('mouseenter', () => { 
    item.style.background = c.listItemHover; 
    item.style.borderColor = c.borderSoft; 
    item.style.transform = 'translateY(-2px) translateZ(0)';
    item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
  });
  item.addEventListener('mouseleave', () => { 
    item.style.background = c.cardBg; 
    item.style.borderColor = c.border; 
    item.style.transform = 'translateZ(0)';
    item.style.boxShadow = 'none';
  });

  // Top section with icon, content, and action buttons
  const topSection = document.createElement('div');
  topSection.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px;';
  
  const leftContent = document.createElement('div');
  leftContent.style.cssText = 'display:flex; align-items:center; gap:8px; flex:1; min-width:0;';
  
  // Favicon
  const faviconContainer = document.createElement('div');
  faviconContainer.style.cssText = `display:inline-flex; align-items:center; justify-content:center; font-normal; text-foreground; select-none; shrink-0; overflow:hidden; height:32px; width:32px; text-xs; border-radius:50%; background:${isDarkMode() ? '#2A2A2A' : '#f3f4f6'};`;

       const favicon = document.createElement('img');
  favicon.src = `https://unavatar.io/${new URL(link.url).hostname}`;
  favicon.style.cssText = 'height:100%; width:100%; object-fit:cover;';
  favicon.onerror = () => { 
    faviconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
  };
  
  faviconContainer.appendChild(favicon);
  
  // Main content
  const content = document.createElement('div');
  content.style.cssText = 'flex:1; overflow:hidden;';
  
  const shortUrlRow = document.createElement('div');
  shortUrlRow.style.cssText = 'display:flex; align-items:center;';
  
  const shortUrl = document.createElement('div');
  shortUrl.style.cssText = `font-weight:bold; line-height:1.25; truncate; text-md; color:${c.text}; font-size:14px;`;
  shortUrl.textContent = `${link.slug}`;
  
  const copyBtn = document.createElement('button');
  copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>';
  copyBtn.style.cssText = `border:none; background:transparent; color:${c.textMuted}; cursor:pointer; padding:4px; margin-left:4px; border-radius:4px; transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1); will-change:transform,background-color; transform:translateZ(0);`;
  copyBtn.title = chrome.i18n.getMessage('copy') || 'Copy';
  copyBtn.addEventListener('mouseenter', () => {
    copyBtn.style.background = c.hover;
    copyBtn.style.color = c.textSecondary;
    copyBtn.style.transform = 'scale(1.1) translateZ(0)';
  });
  copyBtn.addEventListener('mouseleave', () => {
    copyBtn.style.background = 'transparent';
    copyBtn.style.color = c.textMuted;
    copyBtn.style.transform = 'translateZ(0)';
  });
  copyBtn.onclick = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${host}${link.slug}`);
      copyBtn.style.background = '#10b981';
      copyBtn.style.color = '#ffffff';
      setTimeout(() => {
        copyBtn.style.background = 'transparent';
        copyBtn.style.color = c.textMuted;
      }, 1000);
    } catch (_) {}
  };
  
  shortUrlRow.appendChild(shortUrl);
  shortUrlRow.appendChild(copyBtn);
  
  const description = document.createElement('p');
  description.style.cssText = `text-sm; truncate; color:${c.textMuted}; margin:0; font-size:13px;`;
  description.textContent = link.comment || '';
  
  content.appendChild(shortUrlRow);
  content.appendChild(description);
  
  leftContent.appendChild(faviconContainer);
  leftContent.appendChild(content);
  
  // Action buttons
  const actionButtons = document.createElement('div');
  actionButtons.style.cssText = 'display:flex; align-items:center; gap:4px; position:relative;';
  
  const qrBtn = document.createElement('button');
  qrBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"></rect><rect width="5" height="5" x="16" y="3" rx="1"></rect><rect width="5" height="5" x="3" y="16" rx="1"></rect><path d="M21 16h-3a2 2 0 0 0-2 2v3"></path><path d="M21 21v.01"></path><path d="M12 7v3a2 2 0 0 1-2 2H7"></path><path d="M3 12h.01"></path><path d="M12 3h.01"></path><path d="M12 16v.01"></path><path d="M16 12h1"></path><path d="M21 12v.01"></path><path d="M12 21v-1"></path></svg>';
  qrBtn.style.cssText = `border:none; background:transparent; color:${c.textMuted}; cursor:pointer; padding:4px; border-radius:4px; transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1); will-change:transform,background-color; transform:translateZ(0);`;
  qrBtn.title = chrome.i18n.getMessage('qrCode') || 'QR Code';
  qrBtn.addEventListener('mouseenter', () => {
    qrBtn.style.background = c.hover;
    qrBtn.style.color = c.textSecondary;
    qrBtn.style.transform = 'scale(1.1) translateZ(0)';
  });
  qrBtn.addEventListener('mouseleave', () => {
    qrBtn.style.background = 'transparent';
    qrBtn.style.color = c.textMuted;
    qrBtn.style.transform = 'translateZ(0)';
  });
        qrBtn.onclick = async (e) => {
          e.stopPropagation();
          qrBtn.style.background = '#3b82f6';
          qrBtn.style.color = 'white';
          
          try {
            // Load QRious library from local file
            if (!window.QRious) {
              const script = document.createElement('script');
              script.src = './qrious.min.js';
              script.onload = () => showQRCode();
              script.onerror = () => {
                console.error('Failed to load QRious library');
                qrBtn.style.background = 'transparent';
                qrBtn.style.color = '#6b7280';
              };
              document.head.appendChild(script);
            } else {
              showQRCode();
            }
            
            function showQRCode() {
              try {
                // Create QR modal overlay
                const overlay = document.createElement('div');
                overlay.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:${c.overlay}; z-index:1000; display:flex; align-items:center; justify-content:center;`;
                
                const modal = document.createElement('div');
                modal.style.cssText = `background:${c.cardBg}; color:${c.text}; padding:30px; border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); text-align:center; width:300px; border:1px solid ${c.border};`;
                
                modal.innerHTML = `
                  <canvas id="qrCanvas" width="128" height="128" style="width:128px; height:128px; border:1px solid ${c.border}; border-radius:8px; margin:0 auto; display:block;"></canvas>
                  <div style="margin-top:15px; color:${c.textMuted}; font-size:12px; word-break:break-all; line-height:1.4;">${host}${link.slug}</div>
                  <div style="margin-top:15px; display:flex; gap:8px; justify-content:center;">
                    <button id="downloadQR" style="padding:8px 16px; border:none; border-radius:6px; background:#3b82f6; color:#ffffff; cursor:pointer; font-size:14px;">${chrome.i18n.getMessage('download') || 'Download'}</button>
                    <button id="closeQR" style="padding:8px 16px; border:none; border-radius:6px; background:${c.primary}; color:#ffffff; cursor:pointer; font-size:14px;">${chrome.i18n.getMessage('close') || 'Close'}</button>
                  </div>
                `;
                
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
                
                // Generate QR code
                const qr = new QRious({ 
                  element: document.getElementById('qrCanvas'), 
                  size: 128,
                  value: `${host}${link.slug}`
                });
                
                // Download button functionality
                document.getElementById('downloadQR').onclick = () => {
                  const canvas = document.getElementById('qrCanvas');
                  const a = document.createElement('a');
                  a.download = link.slug + '.png';
                  a.href = canvas.toDataURL();
                  a.click();
                };
                
                // Close button functionality
                document.getElementById('closeQR').onclick = () => {
                  document.body.removeChild(overlay);
                };
                
                // Close on overlay click
                overlay.onclick = (e) => {
                  if (e.target === overlay) {
                    document.body.removeChild(overlay);
                  }
                };
                
              } catch (error) {
                console.error('QR Code generation error:', error);
              }
            }
            
            setTimeout(() => {
              qrBtn.style.background = 'transparent';
              qrBtn.style.color = '#6b7280';
            }, 1000);
          } catch (error) {
            console.error('QR Code error:', error);
            qrBtn.style.background = 'transparent';
            qrBtn.style.color = '#6b7280';
          }
        };
  
  const menuBtn = document.createElement('button');
  menuBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="m16 10-4 4-4-4"></path></svg>';
  menuBtn.style.cssText = 'border:none; background:transparent; color:#6b7280; cursor:pointer; padding:4px; border-radius:4px; transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1); will-change:transform,background-color; transform:translateZ(0);';
  menuBtn.title = chrome.i18n.getMessage('more') || 'More';
  menuBtn.addEventListener('mouseenter', () => {
    menuBtn.style.background = '#f3f4f6';
    menuBtn.style.color = '#374151';
    menuBtn.style.transform = 'scale(1.1) translateZ(0)';
  });
  menuBtn.addEventListener('mouseleave', () => {
    menuBtn.style.background = 'transparent';
    menuBtn.style.color = '#6b7280';
    menuBtn.style.transform = 'translateZ(0)';
  });
  
  // Create menu that will be appended to body to avoid overflow clipping
  const menu = document.createElement('div');
  menu.className = 'link-context-menu';
  menu.style.cssText = `position:fixed; background:${c.cardBg}; color:${c.text}; border:1px solid ${c.border}; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:9999; display:none; min-width:120px; overflow:hidden;`;

       const editBtn = document.createElement('button');
  editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>${chrome.i18n.getMessage('edit') || 'Edit'}`;
  editBtn.style.cssText = `width:100%; padding:8px 12px; border:none; background:transparent; color:${c.text}; text-align:left; cursor:pointer; font-size:12px; display:flex; align-items:center; transition:background-color 0.15s ease;`;
  editBtn.addEventListener('mouseenter', () => {
    editBtn.style.background = c.hover;
  });
  editBtn.addEventListener('mouseleave', () => {
    editBtn.style.background = 'transparent';
  });
  editBtn.onclick = (e) => {
    e.stopPropagation();
    menu.style.display = 'none';
    editLink(link);
  };

       const deleteBtn = document.createElement('button');
  deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path><path d="M22 21H7"></path><path d="m5 11 9 9"></path></svg>${chrome.i18n.getMessage('delete') || 'Delete'}`;
  deleteBtn.style.cssText = `width:100%; padding:8px 12px; border:none; background:transparent; text-align:left; cursor:pointer; font-size:12px; color:#dc2626; display:flex; align-items:center; transition:background-color 0.15s ease;`;
  deleteBtn.addEventListener('mouseenter', () => {
    deleteBtn.style.background = c.hover;
  });
  deleteBtn.addEventListener('mouseleave', () => {
    deleteBtn.style.background = 'transparent';
  });
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    menu.style.display = 'none';
    deleteLink(link.slug);
  };
  
  menu.appendChild(editBtn);
  menu.appendChild(deleteBtn);
  document.body.appendChild(menu);
  
  // Close any other open menus first
  function closeAllMenus() {
    document.querySelectorAll('.link-context-menu').forEach(m => {
      m.style.display = 'none';
    });
  }
  
  menuBtn.dataset.menuId = menu.dataset.menuId;
  
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    const isOpen = menu.style.display === 'block';
    closeAllMenus();
    
    if (!isOpen) {
      // Calculate menu position relative to menu button
      const rect = menuBtn.getBoundingClientRect();
      const popupRect = document.body.getBoundingClientRect();
      
      // Position menu below the button, aligned to the right
      let top = rect.bottom + 4;
      let left = rect.right - 120; // Align right edge
      
      // Temporarily show menu to get its dimensions
      menu.style.display = 'block';
      const menuRect = menu.getBoundingClientRect();
      
      // Check if menu would go off bottom of popup
      if (top + menuRect.height > popupRect.bottom) {
        // Show above instead
        top = rect.top - menuRect.height - 4;
        // Ensure it doesn't go above popup
        if (top < popupRect.top) {
          top = popupRect.top + 4;
        }
      }
      
      // Check if menu would go off left edge
      if (left < popupRect.left) {
        left = popupRect.left + 4;
      }
      
      // Check if menu would go off right edge
      if (left + menuRect.width > popupRect.right) {
        left = popupRect.right - menuRect.width - 4;
      }
      
      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;
    } else {
      menu.style.display = 'none';
    }
  };
  
  // Store reference to menu button for closing logic
  menu._menuBtn = menuBtn;
  
  // Use a single global listener with event delegation (more efficient)
  if (!document._menuClickHandler) {
    document._menuClickHandler = (e) => {
      document.querySelectorAll('.link-context-menu').forEach(m => {
        const btn = m._menuBtn;
        if (m.style.display === 'block' && !m.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
          m.style.display = 'none';
        }
      });
    };
    document.addEventListener('click', document._menuClickHandler, true);
  }
  
  actionButtons.appendChild(qrBtn);
  actionButtons.appendChild(menuBtn);
  
  topSection.appendChild(leftContent);
  topSection.appendChild(actionButtons);
  
  // Bottom section with dates and long URL
  const bottomSection = document.createElement('div');
  bottomSection.style.cssText = 'display:flex; width:100%; height:16px; gap:6px; text-sm; align-items:center;';
  
  const createdDate = document.createElement('span');
  createdDate.style.cssText = 'display:inline-flex; align-items:center; line-height:1.25; whitespace:nowrap;';
  createdDate.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; color: rgb(107, 114, 128);"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="M10 16h4"></path><path d="M12 14v4"></path></svg>${formatDateTime(link.createdAt)}`;
  
  const separator1 = document.createElement('div');
  separator1.style.cssText = `shrink-0; background:${c.separator}; width:1px; height:100%;`;
  
  const expiresDate = document.createElement('span');
  expiresDate.style.cssText = 'display:inline-flex; align-items:center; line-height:1.25; whitespace:nowrap;';
  if (link.expiration) {
    expiresDate.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; color: rgb(107, 114, 128);"><path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path></svg>${formatDateTime(link.expiration)}`;
  } else {
    expiresDate.style.display = 'none';
  }
  
  const separator2 = document.createElement('div');
  separator2.style.cssText = `shrink-0; background:${c.separator}; width:1px; height:100%;`;
  if (!link.expiration) {
    separator2.style.display = 'none';
  }
  
  const longUrl = document.createElement('span');
  longUrl.style.cssText = `color:${c.textMuted}; word-break:break-all; line-height:1.2; max-height:2.4em; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; font-size:12px;`;
  longUrl.textContent = link.url;
  
  bottomSection.appendChild(createdDate);
  if (link.expiration) {
    bottomSection.appendChild(separator1);
    bottomSection.appendChild(expiresDate);
    bottomSection.appendChild(separator2);
  } else {
    bottomSection.appendChild(separator1);
  }
  bottomSection.appendChild(longUrl);
  
  item.appendChild(topSection);
  item.appendChild(bottomSection);
  
  item.addEventListener('click', (e) => {
    // Prevent click if clicking on action buttons or menu
    if (e.target.closest('button') || e.target.closest('.link-context-menu')) {
      return;
    }
    
    // Immediately switch tab for instant feedback
    lastSelectedSlug = link.slug; 
    switchTab('analytics'); 
    
    // Load analytics asynchronously without blocking
    showAnalytics(link.slug).catch(err => {
      console.error('Failed to load analytics:', err);
    });
  });
  
  return item;
}

async function showAnalytics(slug) {
  // Always show analytics panel immediately for responsiveness
  switchTab('analytics');
  
  const err = document.getElementById('analytics-error');
  err.style.display = 'none';
  err.textContent = '';

  if (slug) {
    lastSelectedSlug = slug;
  }
  // Get current language for translations
  const title = slug ? `${chrome.i18n.getMessage('titleAnalytics') || 'Analytics'}: ${slug}` : (chrome.i18n.getMessage('analyticsAllLinks') || 'Analytics: All links');
  document.getElementById('analytics-title').textContent = title;
  document.getElementById('metric-visits').textContent = '...';
  document.getElementById('metric-visitors').textContent = '...';
  document.getElementById('metric-referers').textContent = '...';
  const ctx = document.getElementById('chart');
  drawSparkline(ctx, [], []);

  // Load data asynchronously without blocking UI
  try {
    const { host, token } = await readSettings();
    if (!host || !host.trim()) {
      err.style.display = 'block';
      err.textContent = 'Please configure host in Settings.';
      return;
    }

  const params = new URLSearchParams();
  if (slug) params.set('slug', slug);
    
    // Load counters and views in parallel for better performance
    const [countersData, viewsData] = await Promise.all([
      apiCall(`api/stats/counters?${params.toString()}`).catch(e => {
        console.error('Counters error:', e);
        return null;
      }),
      apiCall(`api/stats/views?${new URLSearchParams({ unit: 'day', clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC', ...(slug ? { slug } : {}) }).toString()}`).catch(e => {
        console.error('Views error:', e);
        return null;
      })
    ]);

    // Update counters
    if (countersData) {
    let row = null;
      if (Array.isArray(countersData)) {
        row = countersData[0] || null;
      } else if (countersData && Array.isArray(countersData.data)) {
        row = countersData.data[0] || null;
      } else if (countersData && typeof countersData === 'object') {
        row = countersData;
    }
    document.getElementById('metric-visits').textContent = row?.visits ?? '0';
    document.getElementById('metric-visitors').textContent = row?.visitors ?? '0';
    document.getElementById('metric-referers').textContent = row?.referers ?? '0';
    } else {
    err.style.display = 'block';
      err.textContent = 'Failed to load counters';
    }

    // Update sparkline
    if (viewsData) {
    let values = [];
      if (Array.isArray(viewsData)) {
        values = viewsData.map(p => Number(p.visits || 0));
      } else if (viewsData && Array.isArray(viewsData.data)) {
        values = viewsData.data.map(p => Number(p.visits || 0));
    }
    // Build date labels for tooltip using local date
    const labels = [];
    try {
      const now = Date.now();
      const n = values.length;
      // Approximate labels as last n days
      for (let i = 0; i < n; i++) {
        const d = new Date(now - (n - 1 - i) * 24 * 3600 * 1000);
        labels.push(d.toLocaleDateString());
      }
    } catch (_) {}
    drawSparkline(ctx, values, labels);
    } else {
      if (err.textContent) {
        err.textContent += ' | Failed to load views';
      } else {
        err.style.display = 'block';
        err.textContent = 'Failed to load views';
      }
    }
  } catch (e) {
    err.style.display = 'block';
    err.textContent = `Error: ${e?.message || e}`;
  }
}

// Edit link function
async function editLink(link) {
  // Switch to create tab and populate fields
  switchTab('create');
  
   // Populate the form with existing link data
   document.getElementById('input-url').value = link.url;
   document.getElementById('input-slug').value = link.slug;
   document.getElementById('input-comment').value = link.comment || '';
  
  if (link.expiration && link.expiration > 0) {
    const expirationDate = new Date(link.expiration * 1000);
    const localDateTime = expirationDate.toISOString().slice(0, 16);
    document.getElementById('input-expiration').value = localDateTime;
  } else {
    document.getElementById('input-expiration').value = '';
  }
  
  const slugInput = document.getElementById('input-slug');
  const randomBtn = document.getElementById('generate-slug');
  if (slugInput) {
    slugInput.readOnly = true;
    slugInput.style.background = isDarkMode() ? '#1A1A1A' : '#f9fafb';
    slugInput.style.color = isDarkMode() ? '#cbd5e1' : '#6b7280';
    slugInput.title = chrome.i18n.getMessage('slugCannotChange') || 'This option cannot be changed';
  }
  if (randomBtn) {
    randomBtn.disabled = true;
    randomBtn.style.opacity = '0.5';
    randomBtn.title = chrome.i18n.getMessage('randomDisabled') || 'Random generation disabled in edit mode';
  }
  
  const createBtn = document.getElementById('create');
  createBtn.dataset.editing = 'true';
  createBtn.dataset.originalSlug = link.slug;
  await updateButtonText();
  
  const result = document.getElementById('result');
  if (result) result.textContent = `${chrome.i18n.getMessage('editing') || 'Editing'}: ${link.slug}`;
}

async function deleteLink(slug) {
  const dialog = document.createElement('div');
  const c = themeColors();
  dialog.style = `position:fixed; top:0; left:0; right:0; bottom:0; background:${c.overlay}; display:flex; align-items:center; justify-content:center; z-index:1000;`;
  
  const dialogContent = document.createElement('div');
  dialogContent.style = `background:${c.cardBg}; color:${c.text}; border-radius:12px; padding:20px; margin:20px; box-shadow:0 10px 25px rgba(0,0,0,0.2); border:1px solid ${c.border};`;
  
  const tDeleteLink = chrome.i18n.getMessage('deleteLink') || 'Delete Link';
  const tConfirmDelete = chrome.i18n.getMessage('confirmDelete') || 'Are you sure you want to delete';
  const tConfirmDeleteSuffix = chrome.i18n.getMessage('confirmDeleteSuffix') || '? This action cannot be undone.';
  const tCancel = chrome.i18n.getMessage('cancel') || 'Cancel';
  const tDelete = chrome.i18n.getMessage('delete') || 'Delete';

  dialogContent.innerHTML = `
    <div style="font-weight:600; font-size:16px; margin-bottom:8px; color:${c.text};">${tDeleteLink}</div>
    <div style="color:${c.textMuted}; font-size:14px; margin-bottom:20px; text-align:center;">${tConfirmDelete} "${slug}"${tConfirmDeleteSuffix}</div>
    <div style="display:flex; gap:8px; justify-content:flex-end;">
      <button id="cancel-delete" style="padding:8px 16px; border:1px solid ${c.borderSoft}; border-radius:8px; background:${c.secondary}; color:${c.textSecondary}; cursor:pointer; font-size:14px;">${tCancel}</button>
      <button id="confirm-delete" style="padding:8px 16px; border:1px solid #dc2626; border-radius:8px; background:#dc2626; color:#fff; cursor:pointer; font-size:14px;">${tDelete}</button>
    </div>
  `;
  
  dialog.appendChild(dialogContent);
  document.body.appendChild(dialog);
  
  return new Promise((resolve) => {
    document.getElementById('cancel-delete').addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve(false);
    });
    
    document.getElementById('confirm-delete').addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve(true);
    });
  }).then(async (confirmed) => {
    if (!confirmed) return;
  
    try {
      const { host, token } = await readSettings();
      await apiCall('api/link/delete', 'POST', { slug });
      
      await renderLinks();
      
      const result = document.getElementById('result');
      result.textContent = `✅ Deleted: ${slug}`;
    } catch (e) {
      const result = document.getElementById('result');
      result.textContent = `Error deleting link: ${e?.message || e}`;
    }
  });
}

document.getElementById('refresh')?.addEventListener('click', () => renderLinks());
renderLinks();

const tabs = ['create', 'links', 'analytics', 'settings'];
let lastSelectedSlug = null;
let linksCursor = null;
let isLoadingMore = false;
let renderedSlugs = new Set();

function formatDateTime(ts) {
  if (!ts) return '';
  let ms = Number(ts);
  if (ms < 1e12) ms = ms * 1000;
  try { 
    const date = new Date(ms);
    return date.toLocaleDateString();
  } catch (_) { 
    return String(ts); 
  }
}
let skipAutofillOnce = false;
function switchTab(name) {
  for (const t of tabs) {
    const btn = document.querySelector(`[data-tab="${t}"]`);
    const panel = document.getElementById(`panel-${t}`);
    if (!btn || !panel) continue;
    const active = t === name;
    
    if (active) {
      panel.style.display = t === 'links' ? 'grid' : 'block';
      requestAnimationFrame(() => {
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(4px)';
        requestAnimationFrame(() => {
          panel.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
          panel.style.opacity = '1';
          panel.style.transform = 'translateY(0)';
        });
      });
    } else {
      panel.style.display = 'none';
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    }
    
    const c = themeColors();
    if (active) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    btn.style.background = active ? c.primary : 'transparent';
    btn.style.color = active ? '#fff' : c.textMuted;
  }
  applyThemeToStaticElements();
}

document.getElementById('tab-create')?.addEventListener('click', async () => {
  const createBtn = document.getElementById('create');
  const isEditing = createBtn?.dataset.editing === 'true';

  if (!isEditing) {
    const inputUrl = document.getElementById('input-url');
    const slugInput = document.getElementById('input-slug');
    
    if (skipAutofillOnce || (!inputUrl.value.trim() && !slugInput.value.trim())) {
    document.getElementById('input-url').value = '';
    document.getElementById('input-slug').value = '';
    document.getElementById('input-comment').value = '';
    document.getElementById('input-expiration').value = '';
    document.getElementById('result').textContent = '';
    }

    const randomBtn = document.getElementById('generate-slug');
    if (slugInput) {
      slugInput.readOnly = false;
      slugInput.style.background = '';
      slugInput.style.color = '';
      slugInput.title = '';
    }
    if (randomBtn) {
      randomBtn.disabled = false;
      randomBtn.style.opacity = '';
      randomBtn.title = '';
    }

    if (!skipAutofillOnce && !slugInput.value.trim()) {
      slugInput.value = generateRandomSlug();
    }

    try {
      if (!skipAutofillOnce && inputUrl && autoDetectUrl && !inputUrl.value.trim()) {
        const activeUrl = await getActiveTabUrl();
        if (activeUrl && /^https?:\/\//i.test(activeUrl)) {
          inputUrl.value = activeUrl;
          inputUrl.classList.remove('error');
        }
      }
    } catch (_) {}
  }

  if (skipAutofillOnce) skipAutofillOnce = false;

  lastSelectedSlug = null;
  switchTab('create');
});
document.getElementById('tab-links')?.addEventListener('click', async () => {
  lastSelectedSlug = null;
  try {
    await renderLinks();
  } finally {
    switchTab('links');
  }
});
document.getElementById('tab-analytics')?.addEventListener('click', () => {
  showAnalytics(lastSelectedSlug);
});
document.getElementById('tab-settings')?.addEventListener('click', async () => {
  lastSelectedSlug = null;
  const { host, token, showContextMenu } = await readSettings();
  const hostEl = document.getElementById('setting-host');
  if (hostEl) hostEl.value = host || '';
  const tokenEl = document.getElementById('setting-token');
  if (tokenEl) tokenEl.value = token || '';
  const { autoDetectUrl } = await readSettings();
  const chk = document.getElementById('setting-auto-detect');
  if (chk) chk.checked = !!autoDetectUrl;
  const chkCtx = document.getElementById('setting-show-context');
  if (chkCtx) chkCtx.checked = !!showContextMenu;
  document.getElementById('setting-status').textContent = '';
  switchTab('settings');
});

document.getElementById('setting-host')?.addEventListener('blur', () => {
  const input = document.getElementById('setting-host');
  const rawHost = input.value.trim();
  
  if (rawHost) {
    const normalizedHost = normalizeHostUrl(rawHost);
    if (normalizedHost && validateHostUrl(normalizedHost)) {
      input.value = normalizedHost;
      const s = document.getElementById('setting-status');
      s.textContent = `Normalized: ${normalizedHost}`;
      setTimeout(() => { s.textContent = ''; }, 2000);
    }
  }
});
switchTab('create');

async function updateButtonText() {
  const createBtn = document.getElementById('create');
  const openBtn = document.getElementById('open');
  if (!createBtn) return;
  const isEditing = createBtn.dataset.editing === 'true';
  if (isEditing) {
    createBtn.textContent = chrome.i18n.getMessage('save') || 'Save';
    if (openBtn) openBtn.textContent = chrome.i18n.getMessage('cancel') || 'Cancel';
  } else {
    createBtn.textContent = chrome.i18n.getMessage('createCopy') || 'Create & Copy';
    if (openBtn) openBtn.textContent = chrome.i18n.getMessage('dashboard') || 'Dashboard';
  }
}

document.getElementById('create')?.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  await createViaAPI();
});


function localizePage() {
  const getMsg = (key) => chrome.i18n.getMessage(key) || '';
  const replaceIfMsg = (val) => {
    if (typeof val !== 'string') return val;
    const m = val.match(/^__MSG_([A-Za-z0-9_\-]+)__$/);
    return m ? (getMsg(m[1]) || val) : val;
  };
  document.querySelectorAll('body *').forEach((el) => {
    try {
      if (el.childNodes && el.childNodes.length > 0) {
        el.childNodes.forEach((n) => {
          if (n.nodeType === 3) {
            const original = n.nodeValue || '';
            let updated = original;
            updated = updated.replace(/__MSG_([A-Za-z0-9_\-]+)__/g, (_match, k) => getMsg(k) || _match);
            if (updated !== original) n.nodeValue = updated;
          }
        });
      } else if (el.childNodes && el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
        const text = el.textContent?.trim();
        const replaced = replaceIfMsg(text);
        if (replaced !== text && typeof replaced === 'string') el.textContent = replaced;
      }
      ['placeholder','aria-label','title'].forEach((attr) => {
        if (el.hasAttribute && el.hasAttribute(attr)) {
          const v = el.getAttribute(attr);
          const nv = replaceIfMsg(v);
          if (nv !== v) el.setAttribute(attr, nv);
        }
      });
    } catch (_) {}
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const slugInput = document.getElementById('input-slug');
  if (slugInput && !slugInput.value.trim()) {
    slugInput.value = generateRandomSlug();
  }
  
  const { autoDetectUrl, showContextMenu } = await readSettings();
  try { localizePage(); } catch (_) {}
  
  try {
    const shortKeyLabel = document.getElementById('label-short-key');
    const longUrlLabel = document.getElementById('label-long-url');
    const randomBtn = document.getElementById('generate-slug');
    const createBtn = document.getElementById('create');
    const advancedBtn = document.getElementById('toggle-advanced');
    const dashboardBtn = document.getElementById('open');
    
    if (shortKeyLabel) shortKeyLabel.textContent = chrome.i18n.getMessage('shortKey') || 'Short Key';
    if (longUrlLabel) longUrlLabel.textContent = chrome.i18n.getMessage('longUrl') || 'Long URL';
    if (randomBtn) randomBtn.textContent = chrome.i18n.getMessage('random') || 'Random';
    if (createBtn) createBtn.textContent = chrome.i18n.getMessage('createCopy') || 'Create & Copy';
    if (advancedBtn) advancedBtn.textContent = chrome.i18n.getMessage('advanced') || 'Advanced';
    if (dashboardBtn) dashboardBtn.textContent = chrome.i18n.getMessage('dashboard') || 'Dashboard';
  } catch (_) {}
  
  try { chrome.runtime.sendMessage({ type: 'updateContextMenu' }); } catch (_) {}
  const autoChk = document.getElementById('setting-auto-detect');
  const ctxChk = document.getElementById('setting-show-context');
  if (autoChk && typeof autoDetectUrl === 'undefined') autoChk.checked = true; else if (autoChk) autoChk.checked = !!autoDetectUrl;
  if (ctxChk && typeof showContextMenu === 'undefined') ctxChk.checked = true; else if (ctxChk) ctxChk.checked = !!showContextMenu;
  
  try {
    const inputUrl = document.getElementById('input-url');
    if (inputUrl && autoDetectUrl && !inputUrl.value.trim()) {
      const activeUrl = await getActiveTabUrl();
      if (activeUrl && /^https?:\/\//i.test(activeUrl)) {
        inputUrl.value = activeUrl;
        inputUrl.classList.remove('error');
      }
    }
  } catch (_) {}
  
  const urlInput = document.getElementById('input-url');
  if (urlInput) {
    urlInput.addEventListener('focus', () => {
      const createBtn = document.getElementById('create');
      const isEditing = createBtn?.dataset.editing === 'true';
      if (!isEditing && urlInput.value) {
        urlInput.value = '';
      }
      urlInput.classList.remove('error');
    });
    urlInput.addEventListener('input', () => {
      urlInput.classList.remove('error');
    });
  }
  const showAdvanced = (await chrome.storage.local.get('showAdvanced')).showAdvanced;
  const advanced = document.getElementById('advanced-options');
  const toggle = document.getElementById('toggle-advanced');
  if (typeof showAdvanced !== 'undefined') {
    advanced.style.display = showAdvanced ? 'grid' : 'none';
    toggle.textContent = showAdvanced ? (chrome.i18n.getMessage('simple') || 'Simple') : (chrome.i18n.getMessage('advanced') || 'Advanced');
  }
});

const chartState = new WeakMap();

function drawSparkline(canvas, values, labels = []) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!values || !values.length) {
    ctx.fillStyle = isDarkMode() ? '#9aa1ac' : '#94a3b8';
    ctx.fillText('No data', 8, h/2);
    return;
  }
  const max = Math.max(...values) || 1;
  const step = w / (values.length - 1 || 1);

  ctx.strokeStyle = themeColors().chartStroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, themeColors().chartFillTop);
  gradient.addColorStop(1, 'rgba(17,24,39,0)');
  ctx.fillStyle = gradient;
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  chartState.set(canvas, { values, max, step, labels });

  if (canvas.parentElement && getComputedStyle(canvas.parentElement).position === 'static') {
    canvas.parentElement.style.position = 'relative';
  }

  if (!canvas.dataset.interactive) {
    canvas.dataset.interactive = 'true';
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.background = '#0F0F0F';
    tooltip.style.color = '#fff';
    tooltip.style.fontSize = '11px';
    tooltip.style.padding = '4px 6px';
    tooltip.style.borderRadius = '6px';
    tooltip.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)';
    tooltip.style.transform = 'translate(-50%, -140%)';
    tooltip.style.display = 'none';
    canvas.parentElement?.appendChild(tooltip);

    const redrawWithHighlight = (idx) => {
      const state = chartState.get(canvas);
      if (!state) return;
      drawSparklineBase(canvas, state.values);
      const { values, max, step } = state;
      const x = idx * step;
      const y = h - (values[idx] / max) * (h - 4) - 2;
      ctx.strokeStyle = isDarkMode() ? 'rgba(229,231,235,0.25)' : 'rgba(17,24,39,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
      ctx.moveTo(0, y); ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillStyle = themeColors().chartStroke;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI*2);
      ctx.fill();
    };

    const onMove = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const state = chartState.get(canvas);
      if (!state) return;
      const { values, step, labels } = state;
      if (!values || !values.length) return;
      let idx = Math.round(x / step);
      idx = Math.max(0, Math.min(values.length - 1, idx));
      tooltip.style.left = `${idx * step}px`;
      tooltip.style.top = `0px`;
      const dateText = labels && labels[idx] ? `${labels[idx]}` : '';
      const valueText = `${values[idx]}`;
      tooltip.innerHTML = dateText ? `${dateText}<br>${valueText}` : valueText;
      tooltip.style.display = 'block';
      redrawWithHighlight(idx);
    };
    const onLeave = () => {
      tooltip.style.display = 'none';
      const state = chartState.get(canvas);
      if (state) drawSparklineBase(canvas, state.values);
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
  }
}

function drawSparklineBase(canvas, values) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!values || !values.length) {
    ctx.fillStyle = isDarkMode() ? '#9aa1ac' : '#94a3b8';
    ctx.fillText('No data', 8, h/2);
    return;
  }
  const max = Math.max(...values) || 1;
  const step = w / (values.length - 1 || 1);
  ctx.strokeStyle = themeColors().chartStroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, themeColors().chartFillTop);
  gradient.addColorStop(1, 'rgba(17,24,39,0)');
  ctx.fillStyle = gradient;
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
}

document.getElementById('setting-save')?.addEventListener('click', async () => {
  const rawHost = document.getElementById('setting-host').value.trim();
  const token = document.getElementById('setting-token').value.trim();
  const autoDetectUrl = !!document.getElementById('setting-auto-detect').checked;
  const showContextMenu = !!document.getElementById('setting-show-context').checked;
  const s = document.getElementById('setting-status');
  
  let normalizedHost = '';
  if (rawHost) {
    normalizedHost = normalizeHostUrl(rawHost);
    if (!normalizedHost || !validateHostUrl(normalizedHost)) {
      s.textContent = chrome.i18n.getMessage('invalidHost') || 'Invalid host format';
  return;
  }
    document.getElementById('setting-host').value = normalizedHost;
  }
  await writeSettings({ host: normalizedHost || rawHost, token, autoDetectUrl, showContextMenu });
  s.textContent = chrome.i18n.getMessage('saved') || 'Saved';
  try { chrome.runtime.sendMessage({ type: 'updateContextMenu' }); } catch (_) {}
  const hint = document.getElementById('hint-settings');
  if (hint) hint.style.display = (token && token.length >= 8 && normalizedHost) ? 'none' : 'block';
  setTimeout(() => { if (s.textContent === (chrome.i18n.getMessage('saved') || 'Saved')) s.textContent = ''; }, 1000);
});

document.getElementById('setting-test')?.addEventListener('click', async () => {
  const s = document.getElementById('setting-status');
  s.textContent = chrome.i18n.getMessage('testing') || 'Testing...';
  try {
    const rawHost = document.getElementById('setting-host').value.trim();
    const token = document.getElementById('setting-token').value.trim();
    
    if (!rawHost) {
      s.textContent = chrome.i18n.getMessage('enterHostFirst') || 'Please enter a host first';
      return;
    }
    
    if (!token || token.length < 8) {
      s.textContent = chrome.i18n.getMessage('enterTokenFirst') || 'Please enter a valid token first';
      return;
    }
    
    const normalizedHost = normalizeHostUrl(rawHost);
    if (!normalizedHost || !validateHostUrl(normalizedHost)) {
      s.textContent = chrome.i18n.getMessage('invalidHost') || 'Invalid host format';
      return;
    }
    
    await writeSettings({ host: normalizedHost, token });
    
    const response = await fetch(`${normalizedHost}api/link/list?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (response.ok) {
      s.textContent = `OK: ${normalizedHost}`;
      setTimeout(() => { if (s.textContent && s.textContent.startsWith('OK:')) s.textContent = ''; }, 2000);
    } else {
      const errorText = await response.text();
      s.textContent = `Failed: HTTP ${response.status} - ${errorText}`;
    }
  } catch (e) {
    s.textContent = `${(chrome.i18n.getMessage('failed') || 'Failed')}: ${e?.message || e}`;
  }
});
