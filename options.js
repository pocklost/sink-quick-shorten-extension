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

async function load() {
  const { host, token, autoDetectUrl, showContextMenu } = await chrome.storage.local.get({ host: '', token: '', autoDetectUrl: true, showContextMenu: true });
  const hostEl = document.getElementById('host');
  const tokenEl = document.getElementById('token');
  if (hostEl) hostEl.value = host || '';
  if (tokenEl) tokenEl.value = token || '';
  const autoEl = document.getElementById('auto-detect');
  if (autoEl) autoEl.checked = !!autoDetectUrl;
  const ctxEl = document.getElementById('show-context');
  if (ctxEl) ctxEl.checked = !!showContextMenu;
}

async function save() {
  const rawHost = (document.getElementById('host')?.value || '').trim();
  const token = (document.getElementById('token')?.value || '').trim();
  const autoDetectUrl = !!document.getElementById('auto-detect')?.checked;
  const showContextMenu = !!document.getElementById('show-context')?.checked;
  
  if (!rawHost) {
    alert('Host is required');
    return;
  }
  
  // Normalize the host URL
  const normalizedHost = normalizeHostUrl(rawHost);
  
  if (!normalizedHost) {
    alert('Invalid host format');
    return;
  }
  
  if (!validateHostUrl(normalizedHost)) {
    alert('Host must be a valid URL (e.g., https://example.com)');
    return;
  }
  
  // Update the input field with normalized URL
  document.getElementById('host').value = normalizedHost;
  
  await chrome.storage.local.set({ host: normalizedHost, token, autoDetectUrl, showContextMenu });
  const saved = document.getElementById('saved');
  saved.textContent = `Saved: ${normalizedHost}`;
  saved.style.display = 'block';
  setTimeout(() => { saved.style.display = 'none'; }, 3000);
}

document.getElementById('save')?.addEventListener('click', save);

// Test button to verify host/token
document.getElementById('test')?.addEventListener('click', async () => {
  const status = document.getElementById('status');
  if (status) status.textContent = 'Testing...';
  try {
    const rawHost = (document.getElementById('host')?.value || '').trim();
    const token = (document.getElementById('token')?.value || '').trim();
    if (!rawHost) {
      if (status) status.textContent = 'Please enter a host first';
      return;
    }
    const normalizedHost = normalizeHostUrl(rawHost);
    if (!normalizedHost || !validateHostUrl(normalizedHost)) {
      if (status) status.textContent = 'Invalid host format';
      return;
    }
    const resp = await fetch(`${normalizedHost}api/verify`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!resp.ok) throw new Error(await resp.text());
    if (status) status.textContent = `OK: ${normalizedHost}`;
    setTimeout(() => { if (status && status.textContent && status.textContent.startsWith('OK:')) status.textContent = ''; }, 2000);
  } catch (e) {
    if (status) status.textContent = `Failed: ${e?.message || e}`;
  }
});

// Add real-time URL normalization
document.getElementById('host')?.addEventListener('blur', () => {
  const input = document.getElementById('host');
  const rawHost = input.value.trim();
  
  if (rawHost) {
    const normalizedHost = normalizeHostUrl(rawHost);
    if (normalizedHost && validateHostUrl(normalizedHost)) {
      input.value = normalizedHost;
      const saved = document.getElementById('saved');
      saved.textContent = `Normalized: ${normalizedHost}`;
      saved.style.display = 'block';
      saved.style.color = '#059669';
      setTimeout(() => { saved.style.display = 'none'; }, 2000);
    }
  }
});

load();


