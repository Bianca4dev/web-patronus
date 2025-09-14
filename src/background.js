// Fixed background.js with proper message handling and security improvements

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'checkURL') {
    handleVirusTotalCheck(message.url, sendResponse);
    return true; // CRITICAL: Keep message channel open for async response
  }
  
  if (message.type === 'storeAPIKeys') {
    storeAPIKeysSecurely(message.googleKey, message.virusTotalKey, sendResponse);
    return true;
  }
  
  if (message.type === 'getAPIKeys') {
    loadAPIKeysFromStorage(sendResponse);
    return true;
  }
  
  return false; // Don't keep channel open for other messages
});

async function handleVirusTotalCheck(url, sendResponse) {
  try {
    // Load API key from secure storage
    const keys = await loadAPIKeysFromStorage();
    
    if (!keys.virusTotalKey) {
      sendResponse({ 
        success: false, 
        error: 'VirusTotal API key not configured' 
      });
      return;
    }
    
    const apiUrl = `https://www.virustotal.com/vtapi/v2/url/report?apikey=${keys.virusTotalKey}&resource=${encodeURIComponent(url)}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'WebPatronus/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    sendResponse({ success: true, data: data });
    
  } catch (error) {
    console.error('VirusTotal API error:', error);
    sendResponse({ 
      success: false, 
      error: error.message || 'API call failed' 
    });
  }
}

// Secure API key storage functions
function storeAPIKeysSecurely(googleKey, virusTotalKey, sendResponse) {
  chrome.storage.sync.set({
    'googleSafeBrowsingKey': googleKey,
    'virusTotalKey': virusTotalKey
  }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ 
        success: false, 
        error: chrome.runtime.lastError.message 
      });
    } else {
      sendResponse({ success: true });
    }
  });
}

function loadAPIKeysFromStorage(sendResponse = null) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['googleSafeBrowsingKey', 'virusTotalKey'], (result) => {
      const keys = {
        googleKey: result.googleSafeBrowsingKey || '',
        virusTotalKey: result.virusTotalKey || ''
      };
      
      if (sendResponse) {
        sendResponse({ success: true, data: keys });
      }
      resolve(keys);
    });
  });
}

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Web Patronus extension installed');
  
  // Set default settings if they don't exist
  chrome.storage.sync.get(['webPatronusEnabled'], (result) => {
    if (result.webPatronusEnabled === undefined) {
      chrome.storage.sync.set({ webPatronusEnabled: true });
    }
  });
});