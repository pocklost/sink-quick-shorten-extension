async function jumpToSink() {
  const { host } = await readSettings();
  if (!host || !host.trim()) {
    // Localized modal prompting to configure host
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
// Simple info dialog (styled like delete dialog)
async function showInfoDialog(title, message, actions = [{ id: 'ok', label: 'OK', primary: true }]) {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.style = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000;';
    const dialogContent = document.createElement('div');
    dialogContent.style = 'background:#fff; border-radius:12px; padding:20px; max-width:320px; margin:20px; box-shadow:0 10px 25px rgba(0,0,0,0.2);';
    dialogContent.innerHTML = `
      <div style="font-weight:600; font-size:16px; margin-bottom:8px; color:#111827;">${title || ''}</div>
      <div style="color:#6b7280; font-size:14px; margin-bottom:20px;">${message || ''}</div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        ${actions.map(a => `<button data-id="${a.id}" style="padding:8px 16px; border:1px solid ${a.primary ? '#111827' : '#d1d5db'}; border-radius:8px; background:${a.primary ? '#111827' : '#fff'}; color:${a.primary ? '#fff' : '#374151'}; cursor:pointer; font-size:14px;">${a.label}</button>`).join('')}
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
    
    // Restore slug input and random button to normal state
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
    // Skip one-time autofill and go to a clean Create tab
    skipAutofillOnce = true;
    switchTab('create');
    return;
  }
  // Not editing: open dashboard
  jumpToSink();
});

async function getActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || '';
}

function normalizeHostUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  // Remove any trailing paths like /dashboard/links
  let normalized = url.trim();
  
  // Add protocol if missing
  if (!normalized.match(/^https?:\/\//)) {
    normalized = 'https://' + normalized;
  }
  
  // Extract just the domain part (protocol + domain)
  try {
    const urlObj = new URL(normalized);
    normalized = `${urlObj.protocol}//${urlObj.hostname}`;
    
    // Add port if it's not standard
    if (urlObj.port && urlObj.port !== '80' && urlObj.port !== '443') {
      normalized += `:${urlObj.port}`;
    }
    
    // Ensure it ends with /
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
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) return false;
    
    // Must have a valid hostname
    if (!urlObj.hostname || urlObj.hostname.length < 3) return false;
    
    // Must have at least one dot (for domain)
    if (!urlObj.hostname.includes('.')) return false;
    
    return true;
  } catch (e) {
    return false;
  }
}

async function readSettings() {
  const { host, token, autoDetectUrl, showContextMenu } = await chrome.storage.local.get({ host: '', token: '', autoDetectUrl: true, showContextMenu: true });
  // Toggle hint if token looks valid
  // removed inline hint banner
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

//  background script API
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
     
     // Remove error class if URL is valid
     inputUrl.classList.remove('error');
     
     let slug = inputSlug.value.trim();
     const comment = inputComment.value.trim();
     const expiration = inputExpiration.value;
     
     // Auto-generate random slug if empty
     if (!slug) {
       slug = generateRandomSlug();
       // Show the generated slug in the input field
       inputSlug.value = slug;
     }
     
    const body = { url, slug };
     if (comment) body.comment = comment;
    if (expiration) {
      // Convert datetime-local input to Unix timestamp (milliseconds)
      const expirationDate = new Date(expiration);
      body.expiration = Math.floor(expirationDate.getTime() / 1000); // Convert to seconds
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
      
      // Show success feedback with animation
      const successFeedback = document.getElementById('success-feedback');
      const successText = document.getElementById('success-text');
      if (successFeedback && successText) {
        successText.textContent = isEditing ? 
          (chrome.i18n.getMessage('updatedAndCopied') || 'Updated and copied!') : 
          (chrome.i18n.getMessage('createdAndCopied') || 'Created and copied!');
        successFeedback.style.display = 'block';
        successFeedback.style.opacity = '0';
        successFeedback.style.transform = 'translateY(-10px)';
        
        // Animate in
        requestAnimationFrame(() => {
          successFeedback.style.transition = 'all 0.3s ease';
          successFeedback.style.opacity = '1';
          successFeedback.style.transform = 'translateY(0)';
        });
        
        // Auto hide after 3 seconds
        setTimeout(() => {
          successFeedback.style.opacity = '0';
          successFeedback.style.transform = 'translateY(-10px)';
          setTimeout(() => {
            successFeedback.style.display = 'none';
          }, 300);
        }, 3000);
      }
      
      // Show result area with QR button
      const resultArea = document.getElementById('result-area');
      if (resultArea) {
        resultArea.style.display = 'block';
        resultArea.dataset.shortUrl = data.shortLink;
      }
    } else {
      result.textContent = isEditing ? 'Updated successfully' : 'Created successfully (no shortLink returned)';
    }
    
     // Reset editing state and clear form
     if (isEditing) {
       createBtn.dataset.editing = 'false';
       delete createBtn.dataset.originalSlug;
       await updateButtonText();
       
       // Restore slug input to normal state
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
       
       // Clear all form fields
       document.getElementById('input-url').value = '';
       document.getElementById('input-slug').value = '';
       document.getElementById('input-comment').value = '';
       document.getElementById('input-expiration').value = '';
       // Hide result area
       const resultArea = document.getElementById('result-area');
       if (resultArea) resultArea.style.display = 'none';
     } else {
       // For new creation, clear form and generate new random slug
       document.getElementById('input-url').value = '';
       document.getElementById('input-slug').value = generateRandomSlug();
       document.getElementById('input-comment').value = '';
       document.getElementById('input-expiration').value = '';
       // Hide result area
       const resultArea = document.getElementById('result-area');
       if (resultArea) resultArea.style.display = 'none';
     }
  } catch (e) {
    result.textContent = `Error: ${e?.message || e}`;
  }
}

document.getElementById('create')?.addEventListener('click', createViaAPI);
// Remove inline settings button since we have tabs now
document.getElementById('open-options')?.addEventListener('click', async (e) => {
  e.preventDefault();
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
});

// Generate random slug function
function generateRandomSlug() {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz';
  let randomSlug = '';
  for (let i = 0; i < 6; i++) {
    randomSlug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return randomSlug;
}

// Random slug button
document.getElementById('generate-slug')?.addEventListener('click', () => {
  const slugInput = document.getElementById('input-slug');
  if (slugInput) {
  slugInput.value = generateRandomSlug();
  }
});

// Double-click shortcut on slug input
(() => {
  const slugInput = document.getElementById('input-slug');
  if (!slugInput) return;
  slugInput.addEventListener('dblclick', () => { slugInput.value = generateRandomSlug(); });
})();

// Update host prefix next to slug based on settings
async function updateHostPrefix() {
  const { host } = await readSettings();
  const prefix = document.getElementById('host-prefix');
  if (prefix) prefix.textContent = host || 'https://example.com/';
}
updateHostPrefix();



// Advanced options toggle
document.getElementById('toggle-advanced')?.addEventListener('click', () => {
  const advanced = document.getElementById('advanced-options');
  const toggle = document.getElementById('toggle-advanced');
  if (advanced.style.display === 'none') {
    advanced.style.display = 'grid';
    toggle.textContent = chrome.i18n.getMessage('simple') || 'Simple';
  } else {
    advanced.style.display = 'none';
    toggle.textContent = chrome.i18n.getMessage('advanced') || 'Advanced';
  }
});

// Result area buttons
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
  
  // Simple QR modal using Google Chart API
  const dialog = document.createElement('div');
  dialog.style = 'position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center;';
  const box = document.createElement('div');
  box.style = 'background:#fff; padding:16px; border-radius:12px; display:grid; gap:10px;';
  const img = document.createElement('img');
  img.src = `https://chart.googleapis.com/chart?cht=qr&chs=160x160&chl=${encodeURIComponent(shortUrl)}`;
  img.width = 160; img.height = 160; img.alt = 'QR';
  const close = document.createElement('button');
  close.textContent = chrome.i18n.getMessage('close') || 'Close';
  close.className = 'btn secondary';
  close.addEventListener('click', () => document.body.removeChild(dialog));
  box.appendChild(img); box.appendChild(close); dialog.appendChild(box);
  document.body.appendChild(dialog);
});

async function renderLinks() {
  const listEl = document.getElementById('links');
  // Get current language for translations
  const { autoDetectUrl } = await readSettings();
  listEl.innerHTML = `<span style="font-size:12px; color:#6b7280;">${chrome.i18n.getMessage('loading') || 'Loading...'}</span>`;
  try {
    const { host, token } = await readSettings();
    if (!host || !host.trim()) {
      listEl.innerHTML = '';
      await showInfoDialog('Settings', chrome.i18n.getMessage('configureHostFirst') || 'Please configure host in Settings.', [
        { id: 'open-settings', label: 'OK', primary: true }
      ]);
      return;
    }
    // reset pagination state
    linksCursor = null;
    isLoadingMore = false;
    renderedSlugs.clear();

    const data = await apiCall('api/link/list?limit=20');
     const links = (data?.links || []).filter(Boolean);
     linksCursor = data?.cursor || null;
     if (!links.length) {
       listEl.innerHTML = `<span style="font-size:12px; color:#6b7280;">${chrome.i18n.getMessage('noLinks') || 'No links.'}</span>`;
       return;
     }
     
     // Sort links by creation date (newest first)
     links.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
     
     listEl.innerHTML = '';
     for (const link of links) {
      if (renderedSlugs.has(link.slug)) continue;
      renderedSlugs.add(link.slug);
       const item = buildLinkItem(host, link);
       listEl.appendChild(item);
     }
    attachInfiniteScroll(listEl);
  } catch (e) {
    listEl.innerHTML = `<span style="font-size:12px; color:#b91c1c;">${chrome.i18n.getMessage('failedToLoad') || 'Failed to load'}: ${e?.message || e}</span>`;
  }
}

function attachInfiniteScroll(listEl) {
  if (listEl.dataset.scrollBound === 'true') return;
  listEl.dataset.scrollBound = 'true';
  listEl.addEventListener('scroll', async () => {
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
      for (const link of next) {
        if (renderedSlugs.has(link.slug)) continue;
        renderedSlugs.add(link.slug);
        const { host } = await readSettings();
        const item = buildLinkItem(host, link);
        listEl.appendChild(item);
      }
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
  });
}

function buildLinkItem(host, link, t) {
  const item = document.createElement('div');
  item.className = 'card';
  item.style.cssText = 'display:flex; flex-direction:column; padding:12px; gap:8px; cursor:pointer; transition:all 0.15s ease; max-width:100%;';
  item.addEventListener('mouseenter', () => { item.style.background = '#f8fafc'; item.style.borderColor = '#cbd5e1'; });
  item.addEventListener('mouseleave', () => { item.style.background = '#fff'; item.style.borderColor = '#e5e7eb'; });

  // Top section with icon, content, and action buttons
  const topSection = document.createElement('div');
  topSection.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px;';
  
  const leftContent = document.createElement('div');
  leftContent.style.cssText = 'display:flex; align-items:center; gap:8px; flex:1; min-width:0;';
  
  // Favicon
  const faviconContainer = document.createElement('div');
  faviconContainer.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; font-normal; text-foreground; select-none; shrink-0; bg-secondary; overflow:hidden; height:32px; width:32px; text-xs; border-radius:50%; background:#f3f4f6;';

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
  shortUrl.style.cssText = 'font-weight:bold; line-height:1.25; truncate; text-md; color:#111827; font-size:14px;';
  shortUrl.textContent = `${link.slug}`;
  
  const copyBtn = document.createElement('button');
  copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>';
  copyBtn.style.cssText = 'border:none; background:transparent; color:#6b7280; cursor:pointer; padding:4px; margin-left:4px; border-radius:4px; transition:all 0.2s ease;';
  copyBtn.title = chrome.i18n.getMessage('copy') || 'Copy';
  copyBtn.addEventListener('mouseenter', () => {
    copyBtn.style.background = '#f3f4f6';
    copyBtn.style.color = '#374151';
  });
  copyBtn.addEventListener('mouseleave', () => {
    copyBtn.style.background = 'transparent';
    copyBtn.style.color = '#6b7280';
  });
  copyBtn.onclick = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${host}${link.slug}`);
      copyBtn.style.background = '#10b981';
      copyBtn.style.color = 'white';
      setTimeout(() => {
        copyBtn.style.background = 'transparent';
        copyBtn.style.color = '#6b7280';
      }, 1000);
    } catch (_) {}
  };
  
  shortUrlRow.appendChild(shortUrl);
  shortUrlRow.appendChild(copyBtn);
  
  const description = document.createElement('p');
  description.style.cssText = 'text-sm; truncate; color:#6b7280; margin:0; font-size:13px;';
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
  qrBtn.style.cssText = 'border:none; background:transparent; color:#6b7280; cursor:pointer; padding:4px; border-radius:4px; transition:all 0.2s ease;';
  qrBtn.title = chrome.i18n.getMessage('qrCode') || 'QR Code';
  qrBtn.addEventListener('mouseenter', () => {
    qrBtn.style.background = '#f3f4f6';
    qrBtn.style.color = '#374151';
  });
  qrBtn.addEventListener('mouseleave', () => {
    qrBtn.style.background = 'transparent';
    qrBtn.style.color = '#6b7280';
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
                overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; display:flex; align-items:center; justify-content:center;';
                
                const modal = document.createElement('div');
                modal.style.cssText = 'background:white; padding:30px; border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); text-align:center; max-width:300px;';
                
                modal.innerHTML = `
                  <canvas id="qrCanvas" width="128" height="128" style="width:128px; height:128px; border:1px solid #e5e7eb; border-radius:8px; margin:0 auto; display:block;"></canvas>
                  <div style="margin-top:15px; color:#6b7280; font-size:12px; word-break:break-all; line-height:1.4;">${host}${link.slug}</div>
                  <div style="margin-top:15px; display:flex; gap:8px; justify-content:center;">
                    <button id="downloadQR" style="padding:8px 16px; border:none; border-radius:6px; background:#3b82f6; color:white; cursor:pointer; font-size:14px;">${chrome.i18n.getMessage('download') || 'Download'}</button>
                    <button id="closeQR" style="padding:8px 16px; border:none; border-radius:6px; background:#6b7280; color:white; cursor:pointer; font-size:14px;">${chrome.i18n.getMessage('close') || 'Close'}</button>
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
                  const link = document.createElement('a');
                  link.download = `qr-${link.slug}.png`;
                  link.href = canvas.toDataURL();
                  link.click();
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
  menuBtn.style.cssText = 'border:none; background:transparent; color:#6b7280; cursor:pointer; padding:4px; border-radius:4px; transition:all 0.2s ease;';
  menuBtn.title = chrome.i18n.getMessage('more') || 'More';
  menuBtn.addEventListener('mouseenter', () => {
    menuBtn.style.background = '#f3f4f6';
    menuBtn.style.color = '#374151';
  });
  menuBtn.addEventListener('mouseleave', () => {
    menuBtn.style.background = 'transparent';
    menuBtn.style.color = '#6b7280';
  });
  
  const menu = document.createElement('div');
  menu.style.cssText = 'position:absolute; top:100%; right:0; background:white; border:1px solid #e5e7eb; border-radius:6px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); z-index:10; display:none; min-width:120px;';

       const editBtn = document.createElement('button');
  editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>${chrome.i18n.getMessage('edit') || 'Edit'}`;
  editBtn.style.cssText = 'width:100%; padding:8px 12px; border:none; background:transparent; text-align:left; cursor:pointer; font-size:12px; display:flex; align-items:center;';
  editBtn.onclick = (e) => {
    e.stopPropagation();
    menu.style.display = 'none';
    editLink(link);
  };

       const deleteBtn = document.createElement('button');
  deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path><path d="M22 21H7"></path><path d="m5 11 9 9"></path></svg>${chrome.i18n.getMessage('delete') || 'Delete'}`;
  deleteBtn.style.cssText = 'width:100%; padding:8px 12px; border:none; background:transparent; text-align:left; cursor:pointer; font-size:12px; color:#dc2626; display:flex; align-items:center;';
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    menu.style.display = 'none';
    deleteLink(link.slug);
  };
  
  menu.appendChild(editBtn);
  menu.appendChild(deleteBtn);
  
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  };
  
  actionButtons.appendChild(qrBtn);
  actionButtons.appendChild(menuBtn);
  actionButtons.appendChild(menu);
  
  topSection.appendChild(leftContent);
  topSection.appendChild(actionButtons);
  
  // Bottom section with dates and long URL
  const bottomSection = document.createElement('div');
  bottomSection.style.cssText = 'display:flex; width:100%; height:16px; gap:6px; text-sm; align-items:center;';
  
  const createdDate = document.createElement('span');
  createdDate.style.cssText = 'display:inline-flex; align-items:center; line-height:1.25; whitespace:nowrap;';
  createdDate.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; color: rgb(107, 114, 128);"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="M10 16h4"></path><path d="M12 14v4"></path></svg>${formatDateTime(link.createdAt)}`;
  
  const separator1 = document.createElement('div');
  separator1.style.cssText = 'shrink-0; background:#e5e7eb; width:1px; height:100%;';
  
  const expiresDate = document.createElement('span');
  expiresDate.style.cssText = 'display:inline-flex; align-items:center; line-height:1.25; whitespace:nowrap;';
  if (link.expiration) {
    expiresDate.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; color: rgb(107, 114, 128);"><path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path></svg>${formatDateTime(link.expiration)}`;
  } else {
    expiresDate.style.display = 'none';
  }
  
  const separator2 = document.createElement('div');
  separator2.style.cssText = 'shrink-0; background:#e5e7eb; width:1px; height:100%;';
  if (!link.expiration) {
    separator2.style.display = 'none';
  }
  
  const longUrl = document.createElement('span');
  longUrl.style.cssText = 'color:#6b7280; word-break:break-all; line-height:1.2; max-height:2.4em; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; font-size:12px;';
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
  
  item.addEventListener('click', () => { 
    lastSelectedSlug = link.slug; 
    switchTab('analytics'); 
    showAnalytics(link.slug); 
  });
  
  return item;
}

async function showAnalytics(slug) {
  const { host, token } = await readSettings();
  if (!host || !host.trim()) {
    const err = document.getElementById('analytics-error');
    err.style.display = 'block';
    err.textContent = 'Please configure host in Settings.';
    return;
  }
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

  const params = new URLSearchParams();
  if (slug) params.set('slug', slug);
  try {
    const data = await apiCall(`api/stats/counters?${params.toString()}`);
    let row = null;
    if (Array.isArray(data)) {
      row = data[0] || null;
    } else if (data && Array.isArray(data.data)) {
      row = data.data[0] || null;
    } else if (data && typeof data === 'object') {
      row = data;
    }
    document.getElementById('metric-visits').textContent = row?.visits ?? '0';
    document.getElementById('metric-visitors').textContent = row?.visitors ?? '0';
    document.getElementById('metric-referers').textContent = row?.referers ?? '0';
  } catch (e) {
    err.style.display = 'block';
    err.textContent = `Counters error: ${e?.message || e}`;
  }

  // Trend sparkline (daily views for last ~14 days)
  try {
    const qs = new URLSearchParams({ unit: 'day', clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC' });
    if (slug) qs.set('slug', slug);
    const series = await apiCall(`api/stats/views?${qs.toString()}`);
    let values = [];
    if (Array.isArray(series)) {
      values = series.map(p => Number(p.visits || 0));
    } else if (series && Array.isArray(series.data)) {
      values = series.data.map(p => Number(p.visits || 0));
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
  } catch (e) {
    err.style.display = 'block';
    err.textContent = `${err.textContent ? err.textContent + ' | ' : ''}Views error: ${e?.message || e}`;
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
  
  // Set expiration if exists and is valid
  if (link.expiration && link.expiration > 0) {
    const expirationDate = new Date(link.expiration * 1000);
    const localDateTime = expirationDate.toISOString().slice(0, 16);
    document.getElementById('input-expiration').value = localDateTime;
  } else {
    // Clear expiration field if no expiration is set
    document.getElementById('input-expiration').value = '';
  }
  
  // Make slug input read-only in edit mode
  const slugInput = document.getElementById('input-slug');
  const randomBtn = document.getElementById('generate-slug');
  if (slugInput) {
    slugInput.readOnly = true;
    slugInput.style.background = '#f9fafb';
    slugInput.style.color = '#6b7280';
    slugInput.title = chrome.i18n.getMessage('slugCannotChange') || 'This option cannot be changed';
  }
  if (randomBtn) {
    randomBtn.disabled = true;
    randomBtn.style.opacity = '0.5';
    randomBtn.title = chrome.i18n.getMessage('randomDisabled') || 'Random generation disabled in edit mode';
  }
  
  // Update the create button text
  const createBtn = document.getElementById('create');
  createBtn.dataset.editing = 'true';
  createBtn.dataset.originalSlug = link.slug;
  await updateButtonText();
  
  // Show a localized message
  const result = document.getElementById('result');
  if (result) result.textContent = `${chrome.i18n.getMessage('editing') || 'Editing'}: ${link.slug}`;
}

// Delete link function
async function deleteLink(slug) {
  // Create a modern confirmation dialog
  const dialog = document.createElement('div');
  dialog.style = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000;';
  
  const dialogContent = document.createElement('div');
  dialogContent.style = 'background:#fff; border-radius:12px; padding:20px; max-width:300px; margin:20px; box-shadow:0 10px 25px rgba(0,0,0,0.2);';
  
  const tDeleteLink = chrome.i18n.getMessage('deleteLink') || 'Delete Link';
  const tConfirmDelete = chrome.i18n.getMessage('confirmDelete') || 'Are you sure you want to delete';
  const tConfirmDeleteSuffix = chrome.i18n.getMessage('confirmDeleteSuffix') || '? This action cannot be undone.';
  const tCancel = chrome.i18n.getMessage('cancel') || 'Cancel';
  const tDelete = chrome.i18n.getMessage('delete') || 'Delete';

  dialogContent.innerHTML = `
    <div style="font-weight:600; font-size:16px; margin-bottom:8px; color:#111827;">${tDeleteLink}</div>
    <div style="color:#6b7280; font-size:14px; margin-bottom:20px;">${tConfirmDelete} "${slug}"${tConfirmDeleteSuffix}</div>
    <div style="display:flex; gap:8px; justify-content:flex-end;">
      <button id="cancel-delete" style="padding:8px 16px; border:1px solid #d1d5db; border-radius:8px; background:#fff; color:#374151; cursor:pointer; font-size:14px;">${tCancel}</button>
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
      
      // Refresh the links list
      await renderLinks();
      
      // Show success message
      const result = document.getElementById('result');
      result.textContent = `✅ Deleted: ${slug}`;
    } catch (e) {
      // Show error in result area instead of alert
      const result = document.getElementById('result');
      result.textContent = `Error deleting link: ${e?.message || e}`;
    }
  });
}

document.getElementById('refresh')?.addEventListener('click', () => renderLinks());
renderLinks();

// Tabs handling
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
    panel.style.display = active ? (t === 'links' ? 'grid' : 'block') : 'none';
    btn.style.background = active ? '#111827' : 'transparent';
    btn.style.color = active ? '#fff' : '#111827';
  }
}

document.getElementById('tab-create')?.addEventListener('click', async () => {
  const createBtn = document.getElementById('create');
  const isEditing = createBtn?.dataset.editing === 'true';

  // When editing, do not clear or auto-fill
  if (!isEditing) {
    // Only clear form if it's not already filled or if we're skipping autofill
    const inputUrl = document.getElementById('input-url');
    const slugInput = document.getElementById('input-slug');
    
    if (skipAutofillOnce || (!inputUrl.value.trim() && !slugInput.value.trim())) {
    // Clear form for fresh create
    document.getElementById('input-url').value = '';
    document.getElementById('input-slug').value = '';
    document.getElementById('input-comment').value = '';
    document.getElementById('input-expiration').value = '';
    document.getElementById('result').textContent = '';
    }

    // Ensure slug input is in normal state (not read-only)
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

    // Auto-generate random slug when opening create tab (unless skipping once)
    if (!skipAutofillOnce && !slugInput.value.trim()) {
      slugInput.value = generateRandomSlug();
    }

    // Auto-fill Destination URL from current active tab when entering Create tab (unless skipping once)
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

  // Clear analytics selection when switching away
  lastSelectedSlug = null;
  switchTab('create');
});
document.getElementById('tab-links')?.addEventListener('click', () => {
  // Clear analytics selection when switching away
  lastSelectedSlug = null;
  renderLinks();
  switchTab('links');
});
document.getElementById('tab-analytics')?.addEventListener('click', () => {
  // If no link selected yet, show global analytics
  showAnalytics(lastSelectedSlug);
});
document.getElementById('tab-settings')?.addEventListener('click', async () => {
  // Clear analytics selection when switching away
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

// Add real-time URL normalization
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

// Removed old inline translations; Chrome i18n is used instead

// Removed old language detection; Chrome i18n handles it

// Update button text using chrome.i18n
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

// Wire up Create button click
document.getElementById('create')?.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  await createViaAPI();
});

// Removed applyTranslations; static HTML placeholders handle most labels

function localizePage() {
  const getMsg = (key) => chrome.i18n.getMessage(key) || '';
  const replaceIfMsg = (val) => {
    if (typeof val !== 'string') return val;
    const m = val.match(/^__MSG_([A-Za-z0-9_\-]+)__$/);
    return m ? (getMsg(m[1]) || val) : val;
  };
  // Replace text content when it is exactly a __MSG__ token
  document.querySelectorAll('body *').forEach((el) => {
    try {
      // 1) Replace any text-node occurrences of __MSG_*__ (even when mixed with other nodes like <span>)
      if (el.childNodes && el.childNodes.length > 0) {
        el.childNodes.forEach((n) => {
          if (n.nodeType === 3) { // Text node
            const original = n.nodeValue || '';
            let updated = original;
            updated = updated.replace(/__MSG_([A-Za-z0-9_\-]+)__/g, (_match, k) => getMsg(k) || _match);
            if (updated !== original) n.nodeValue = updated;
          }
        });
      } else if (el.childNodes && el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
        // Fallback: exact replacement when single text node
        const text = el.textContent?.trim();
        const replaced = replaceIfMsg(text);
        if (replaced !== text && typeof replaced === 'string') el.textContent = replaced;
      }
      // Replace common attributes
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

// Auto-generate random slug when popup first opens
document.addEventListener('DOMContentLoaded', async () => {
  const slugInput = document.getElementById('input-slug');
  if (slugInput && !slugInput.value.trim()) {
    slugInput.value = generateRandomSlug();
  }
  
  // Chrome i18n handles static labels via __MSG__; dynamic content uses getMessage()
  const { autoDetectUrl, showContextMenu } = await readSettings();
  // Apply localization for __MSG__ placeholders in HTML
  try { localizePage(); } catch (_) {}
  
  // Update labels with proper i18n
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
  
  // Ensure context menu is (re)created based on settings
  try { chrome.runtime.sendMessage({ type: 'updateContextMenu' }); } catch (_) {}
  // Ensure defaults applied for toggles in UI if unset
  const autoChk = document.getElementById('setting-auto-detect');
  const ctxChk = document.getElementById('setting-show-context');
  if (autoChk && typeof autoDetectUrl === 'undefined') autoChk.checked = true; else if (autoChk) autoChk.checked = !!autoDetectUrl;
  if (ctxChk && typeof showContextMenu === 'undefined') ctxChk.checked = true; else if (ctxChk) ctxChk.checked = !!showContextMenu;
  
  // Auto-fill Destination URL from current active tab (toolbar detection)
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
  
  // Remove error class when user starts typing in URL field
  const urlInput = document.getElementById('input-url');
  if (urlInput) {
    // Clear existing value on focus only when NOT editing
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
});

const chartState = new WeakMap();

function drawSparkline(canvas, values, labels = []) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!values || !values.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('No data', 8, h/2);
    return;
  }
  const max = Math.max(...values) || 1;
  const step = w / (values.length - 1 || 1);

  // base path
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // fill under
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(17,24,39,0.15)');
  gradient.addColorStop(1, 'rgba(17,24,39,0)');
  ctx.fillStyle = gradient;
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // store state
  chartState.set(canvas, { values, max, step, labels });

  // ensure parent can host tooltip
  if (canvas.parentElement && getComputedStyle(canvas.parentElement).position === 'static') {
    canvas.parentElement.style.position = 'relative';
  }

  // attach listeners once
  if (!canvas.dataset.interactive) {
    canvas.dataset.interactive = 'true';
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.background = '#111827';
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
      // redraw base
      drawSparklineBase(canvas, state.values);
      // draw crosshair and point
      const { values, max, step } = state;
      const x = idx * step;
      const y = h - (values[idx] / max) * (h - 4) - 2;
      // crosshair
      ctx.strokeStyle = 'rgba(17,24,39,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
      ctx.moveTo(0, y); ctx.lineTo(w, y);
      ctx.stroke();
      // point
      ctx.fillStyle = '#111827';
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
      // Render date and value on separate lines
      const dateText = labels && labels[idx] ? `${labels[idx]}` : '';
      const valueText = `${values[idx]}`;
      tooltip.innerHTML = dateText ? `${dateText}<br>${valueText}` : valueText;
      tooltip.style.display = 'block';
      redrawWithHighlight(idx);
    };
    const onLeave = () => {
      tooltip.style.display = 'none';
      // redraw base only
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
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('No data', 8, h/2);
    return;
  }
  const max = Math.max(...values) || 1;
  const step = w / (values.length - 1 || 1);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(17,24,39,0.15)');
  gradient.addColorStop(1, 'rgba(17,24,39,0)');
  ctx.fillStyle = gradient;
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
}

// Settings handlers in popup (no new tab)
document.getElementById('setting-save')?.addEventListener('click', async () => {
  const rawHost = document.getElementById('setting-host').value.trim();
  const token = document.getElementById('setting-token').value.trim();
  const autoDetectUrl = !!document.getElementById('setting-auto-detect').checked;
  const showContextMenu = !!document.getElementById('setting-show-context').checked;
  const s = document.getElementById('setting-status');
  
  // Allow saving language/token/toggles even if host is blank; only validate host if provided
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
  // Auto-clear Saved status after a short delay
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
    
    // 先保存設定，然後測試
    await writeSettings({ host: normalizedHost, token });
    
    // 測試 API 連接 - 使用 /api/link/list 而不是 /api/verify
    const response = await fetch(`${normalizedHost}api/link/list?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (response.ok) {
      s.textContent = `OK: ${normalizedHost}`;
      // Auto-clear OK status after a short delay
      setTimeout(() => { if (s.textContent && s.textContent.startsWith('OK:')) s.textContent = ''; }, 2000);
    } else {
      const errorText = await response.text();
      s.textContent = `Failed: HTTP ${response.status} - ${errorText}`;
    }
  } catch (e) {
    s.textContent = `${(chrome.i18n.getMessage('failed') || 'Failed')}: ${e?.message || e}`;
  }
});
