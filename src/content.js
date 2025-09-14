
//Scanner for the main page 
class WebPatronusScanner {
  constructor() {
    this.links = new Set();
    this.observer = null;
    this.scanResults = {
      safe: 0,
      warning: 0,
      danger: 0,
      total: 0,
      links: []
    };
    
    //api config
    //Todo:Store more securley
    this.apiConfig = {
      googleSafeBrowsing: {
        enabled: true,
        apiKey: '', 
        endpoint: 'https://safebrowsing.googleapis.com/v4/threatMatches:find'
      },
      virusTotal: {
        enabled: true,
        apiKey: '', 
        endpoint: 'https://www.virustotal.com/vtapi/v2/url/report'
      }
    };
    
    //cache for results
    this.apiCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000;
    
  
    //load keys
    this.loadAPIKeys();
  }

  //load keys from storage
  async loadAPIKeys() {
    try {
      const keys = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'getAPIKeys' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Failed to load API keys:', chrome.runtime.lastError);
            resolve({ googleKey: '', virusTotalKey: '' });
          } else if (response && response.success) {
            resolve(response.data);
          } else {
            resolve({ googleKey: '', virusTotalKey: '' });
          }
        });
      });
      
      this.apiConfig.googleSafeBrowsing.apiKey = keys.googleKey;
      this.apiConfig.virusTotal.apiKey = keys.virusTotalKey;
      
    } catch (error) {
      console.warn('Error loading API keys:', error);
    }
  }

  //set api keys
  async setAPIKeys(googleKey, virusTotalKey) {
    try {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'storeAPIKeys', googleKey, virusTotalKey },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
              resolve();
            } else {
              reject(new Error(response?.error || 'Failed to store API keys'));
            }
          }
        );
      });
      
      //update config
      this.apiConfig.googleSafeBrowsing.apiKey = googleKey;
      this.apiConfig.virusTotal.apiKey = virusTotalKey;
      
      console.log('API keys updated successfully');
      
    } catch (error) {
      console.error('Error storing API keys:', error);
      throw error;
    }
  }

  // scan links on the page
  async scanPageLinks() {
    console.log('Web Patronus: Scanning page for links...');
    
    try {
      //clear old
      this.links.clear();
      this.scanResults = { safe: 0, warning: 0, danger: 0, total: 0, links: [] };

      //get all anchor tags
      const anchorTags = document.querySelectorAll('a[href]');
      
      //get all onclick things
      const clickableElements = document.querySelectorAll('[onclick*="http"], [onclick*="www."]');
      
      //get all form redirects
      const forms = document.querySelectorAll('form[action]');
      
      //process each type
      anchorTags.forEach(anchor => this.processLink(anchor.href, anchor, 'anchor'));
      clickableElements.forEach(element => this.processClickableElement(element));
      forms.forEach(form => this.processLink(form.action, form, 'form'));
      
      //scan js
      this.scanJavaScriptContent();
      
      //analyze all links
      await this.analyzeLinks();
      
      console.log(`Web Patronus: Found ${this.scanResults.total} links`);
      this.ChangeLinks(this.scanResults.links);
      
      return this.scanResults;
      
    } catch (error) {
      console.error('Error during page scan:', error);
      throw error;
    }
  }

  //Add popup to all links
 ChangeLinks(links){
    for(let i =0 ;i<links.length; i++){
    switch(links[i].element.toLowerCase()) {
                    case 'a':
                        handleAnchorElements(links[i]);
                        break;
                    case 'script':
                        handleScriptElements(links[i]);
                        break;
                    case 'button':
                        handleButtonElements(links[i]);
                        break;
                    default:
                        console.warn(`Unsupported element type: ${links[i].element}`);
                }
    }

}


  //process a link
  processLink(url, element, type) {
    try {
      //skip links that have already been done ,save time
      if (this.links.has(url)) return;
      
      // clean and validate 
      const cleanUrl = this.cleanUrl(url);
      if (!cleanUrl || !this.isValidUrl(cleanUrl)) return;
      
      //skip internal and safe 
      if (this.isInternalLink(cleanUrl) || this.isSafeProtocol(cleanUrl)) return;
      
      this.links.add(cleanUrl);
      
      //create object
      const linkData = {
        url: cleanUrl,
        text: element.textContent?.trim() || '',
        title: element.title || '',
        type: type,
        element: element.tagName.toLowerCase(),
        visible: this.isElementVisible(element),
        position: this.getElementPosition(element),
        domain: this.extractDomain(cleanUrl),
        timestamp: Date.now()
      };
      
      //Add processed link to list
      this.scanResults.links.push(linkData);
      this.scanResults.total++;
      
    } catch (error) {
      console.warn('Web Patronus: Error processing link:', error);
    }
  }

  //proccess click ones
  processClickableElement(element) {
    const onclick = element.getAttribute('onclick') || '';
    const urlMatches = onclick.match(/https?:\/\/[^\s'"]+/g);
    
    if (urlMatches) {
      urlMatches.forEach(url => {
        this.processLink(url, element, 'javascript');
      });
    }
  }

  //scan js for links
  scanJavaScriptContent() {
    const scripts = document.querySelectorAll('script');
    const urlPattern = /https?:\/\/[^\s'"<>()]+/g;
    
    scripts.forEach(script => {
      try {
        if (script.src && !this.isInternalLink(script.src)) {
          this.processLink(script.src, script, 'script');
        }
        
        if (script.textContent) {
          const matches = script.textContent.match(urlPattern);
          if (matches) {
            matches.forEach(url => {
              if (!this.isInternalLink(url)) {
                this.processLink(url, script, 'script-content');
              }
            });
          }
        }
      } catch (error) {
        console.warn('Error scanning script:', error);
      }
    });
  }

  //analyze links with api
  async analyzeLinks() {
    const analysisPromises = this.scanResults.links.map(async (linkData) => {
      try {
        const riskLevel = await this.assessLinkRisk(linkData);
        linkData.riskLevel = riskLevel;
        
        switch (riskLevel) {
          case 'safe':
            this.scanResults.safe++;
            break;
          case 'warning':
            this.scanResults.warning++;
            break;
          case 'danger':
            this.scanResults.danger++;
            break;
        }
      } catch (error) {
        console.warn('Error analyzing link:', linkData.url, error);
        linkData.riskLevel = 'unknown';
        linkData.error = error.message;
      }
    });
    
    await Promise.allSettled(analysisPromises);
  }

  //asses using heuristics
  async assessLinkRisk(linkData) {
    const { url, text, domain } = linkData;
    let riskScore = 0;
    
    try {
      //Basic
      if (this.isSuspiciousDomain(domain)) riskScore += 3;
      if (this.isUrlShortener(domain)) riskScore += 2;
      if (this.hasSuspiciousUrlPattern(url)) riskScore += 2;
      if (this.isMisleadingText(text, url)) riskScore += 2;
      if (this.hasSuspiciousFileExtension(url)) riskScore += 3;
      if (this.isIpAddress(domain)) riskScore += 2;
      if (this.isNonHttpsSensitive(url)) riskScore += 1;
      
      //Better
      const domainAge = await this.checkDomainAge(domain);
      if (domainAge && domainAge < 30) riskScore += 2;
      if (domainAge && domainAge < 7) riskScore += 3;
      
      if (this.hasHomographicAttack(domain)) riskScore += 4;
      if (this.hasSuspiciousTLD(domain)) riskScore += 1;
      if (this.hasExcessiveSubdomains(domain)) riskScore += 2;
      if (this.hasSuspiciousPort(url)) riskScore += 2;
      
      const sslInfo = await this.checkSSLInfo(url);
      if (sslInfo && !sslInfo.valid) riskScore += 3;
      if (sslInfo && sslInfo.selfSigned) riskScore += 2;
      
      //do api checks
      const apiRisk = await this.performAPIChecks(url);
      riskScore += apiRisk;
      
      //save data
      linkData.analysis = {
        heuristicScore: riskScore - apiRisk,
        apiScore: apiRisk,
        domainAge: domainAge,
        sslInfo: sslInfo,
        timestamp: Date.now()
      };
      
      if (riskScore >= 6) return 'danger';
      if (riskScore >= 3) return 'warning';
      return 'safe';
      
    } catch (error) {
      console.warn('Error in risk assessment:', error);
      return 'unknown';
    }
  }

  // do api checks
  async performAPIChecks(url) {
    let apiRiskScore = 0;
    
    try {
    

      //check cache
      const cacheKey = `api_${url}`;
      const cached = this.apiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.score;
      }

    

      //Google
      if (this.apiConfig.googleSafeBrowsing.enabled && this.apiConfig.googleSafeBrowsing.apiKey) {
        const safeBrowsingResult = await this.retryApiCall(() => this.checkGoogleSafeBrowsing(url));
        if (safeBrowsingResult) {
          apiRiskScore += safeBrowsingResult.riskScore;
        }
      }
      
      //Virus TOtla
      if (this.apiConfig.virusTotal.enabled && this.apiConfig.virusTotal.apiKey) {
        const virusTotalResult = await this.retryApiCall(() => this.checkVirusTotal(url));
        if (virusTotalResult) {
          apiRiskScore += virusTotalResult.riskScore;
        }
      }
      
      //cache the result
      this.apiCache.set(cacheKey, {
        score: apiRiskScore,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.warn('Web Patronus: API check failed:', error);
    }
    
    return apiRiskScore;
  }

  //retires
  async retryApiCall(apiFunction, attempts = this.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await apiFunction();
        return result;
      } catch (error) {
        console.warn(`API call attempt ${i + 1} failed:`, error);
        if (i === attempts - 1) throw error;
        
        // Exponential backoff
        const delay = 1000 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  //Virus Tool
  async checkVirusTotal(url) {
    try {

        //Note: had to move fetch to background.js to prevent CORS issue
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'checkURL', url: url }, 
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response?.error || 'VirusTotal API call failed'));
            }
          }
        );
      });

      if (response.response_code === 1 && response.positives > 0) {
        const ratio = response.positives / response.total;
        let riskScore = 0;
        
        if (ratio > 0.1) riskScore += 5; // More than 10% detection
        else if (ratio > 0.05) riskScore += 3; // More than 5% detection
        else if (ratio > 0) riskScore += 1; // Any detection
        
        return { 
          riskScore, 
          positives: response.positives, 
          total: response.total,
          scanDate: response.scan_date,
          permalink: response.permalink
        };
      }
      
      return { 
        riskScore: 0, 
        positives: 0, 
        total: response.total || 0,
        scanDate: response.scan_date
      };
      
    } catch (error) {
      console.warn('VirusTotal check failed:', error);
      return null;
    }
  }

  //Google
  async checkGoogleSafeBrowsing(url) {
    try {
      const requestBody = {
        client: {
          clientId: "web-patronus",
          clientVersion: "1.0"
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING", 
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION"
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: url }]
        }
      };

      const response = await fetch(
        `${this.apiConfig.googleSafeBrowsing.endpoint}?key=${this.apiConfig.googleSafeBrowsing.apiKey}`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'User-Agent': 'WebPatronus/1.0'
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.matches && data.matches.length > 0) {
        const threatTypes = data.matches.map(match => match.threatType);
        let riskScore = 0;
        
        if (threatTypes.includes('MALWARE')) riskScore += 5;
        if (threatTypes.includes('SOCIAL_ENGINEERING')) riskScore += 4;
        if (threatTypes.includes('UNWANTED_SOFTWARE')) riskScore += 3;
        if (threatTypes.includes('POTENTIALLY_HARMFUL_APPLICATION')) riskScore += 2;
        
        return { riskScore, threatTypes };
      }
      
      return { riskScore: 0, threatTypes: [] };
      
    } catch (error) {
      console.warn('Google Safe Browsing check failed:', error);
      return null;
    }
  }

  //Analyze url (popup url check)
  async analyzeSingleUrl(url) {
    try {
      const domain = this.extractDomain(url);
      const linkData = {
        url: url,
        text: '',
        title: '',
        type: 'manual',
        element: 'input',
        visible: true,
        position: { top: 0, left: 0, width: 0, height: 0 },
        domain: domain,
        timestamp: Date.now()
      };

      const riskLevel = await this.assessLinkRisk(linkData);
      linkData.riskLevel = riskLevel;

      return linkData;
    } catch (error) {
      console.error('Error analyzing single URL:', error);
      throw error;
    }
  }

// #region Heuristics checks
  async checkDomainAge(domain) {
    try {
      // Enhanced domain age detection patterns
      if (/\d{8,}/.test(domain)) return 1; // Looks like timestamp
      if (/[a-z]{20,}/.test(domain)) return 3; // Very long random string
      if (/\d{4}-\d{2}-\d{2}/.test(domain)) return 1; // Date-like pattern
      if (/temp|tmp|test|demo/.test(domain)) return 5; // Temporary-sounding domains
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  async checkSSLInfo(url) {
    try {
      if (!url.startsWith('https://')) {
        return { valid: false, reason: 'No SSL' };
      }
      
      //Todo:Check certificate details
      return { valid: true, selfSigned: false };
    } catch (error) {
      return { valid: false, reason: 'SSL check failed' };
    }
  }

  hasHomographicAttack(domain) {
    // Enhanced homographic attack detection
    const suspiciousChars = [
      'а', 'о', 'р', 'е', 'х', 'с', 'у', 'к', // Cyrillic that look like Latin
      '0', '1', '5', '6', '8', '9', // Numbers that look like letters
      'ι', 'ο', 'υ', 'α', // Greek letters
    ];
    
    return suspiciousChars.some(char => domain.includes(char));
  }

  hasSuspiciousTLD(domain) {
    const suspiciousTLDs = [
      '.tk', '.ml', '.ga', '.cf', '.buzz', '.click', '.download',
      '.top', '.win', '.review', '.loan', '.racing', '.accountant',
      '.science', '.party', '.gq', '.faith', '.cricket'
    ];
    
    return suspiciousTLDs.some(tld => domain.toLowerCase().endsWith(tld));
  }

  hasExcessiveSubdomains(domain) {
    const subdomains = domain.split('.').length - 2;
    return subdomains > 3;
  }

  hasSuspiciousPort(url) {
    try {
      const urlObj = new URL(url);
      const suspiciousPorts = ['8080', '8443', '3128', '1080', '8000', '8888', '9999'];
      return suspiciousPorts.includes(urlObj.port);
    } catch {
      return false;
    }
  }
//#endregion
  
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'scanPage':
          const results = await this.scanPageLinks();
          sendResponse({ success: true, data: results });
          break;

        case 'analyzeUrl':
          const analysis = await this.analyzeSingleUrl(request.url);
          sendResponse({ success: true, data: analysis });
          break;
          
        case 'startMonitoring':
          this.startMonitoring();
          sendResponse({ success: true });
          break;
          
        case 'stopMonitoring':
          this.stopMonitoring();
          sendResponse({ success: true });
          break;
          
        case 'setAPIKeys':
          await this.setAPIKeys(request.googleKey, request.virusTotalKey);
          sendResponse({ success: true });
          break;
          
        case 'getPageInfo':
          sendResponse({
            success: true,
            data: {
              url: window.location.href,
              title: document.title,
              domain: window.location.hostname,
              scanResults: this.scanResults,
              rateLimitStatus: {
                remaining: this.rateLimiter.getRemainingRequests(),
                maxRequests: this.rateLimiter.maxRequests
              }
            }
          });
          break;
          
        case 'clearCache':
          this.apiCache.clear();
          sendResponse({ success: true, message: 'Cache cleared' });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

 //#region all small things
  cleanUrl(url) {
    try {
      if (url.startsWith('//')) url = window.location.protocol + url;
      if (url.startsWith('/')) url = window.location.origin + url;
      return url.trim();
    } catch {
      return null;
    }
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return /^https?:\/\/.+/i.test(url);
    } catch {
      return false;
    }
  }

  isInternalLink(url) {
    try {
      const linkDomain = new URL(url).hostname;
      return linkDomain === window.location.hostname;
    } catch {
      return false;
    }
  }

  isSafeProtocol(url) {
    const safeProtocols = ['mailto:', 'tel:', 'sms:', '#'];
    return safeProtocols.some(protocol => url.startsWith(protocol));
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.visibility !== 'hidden' && 
           style.display !== 'none' &&
           style.opacity !== '0';
  }

  getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    };
  }

  isSuspiciousDomain(domain) {
    const suspiciousPatterns = [
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
      /[0-9]{5,}/, // Long numbers
      /(.)\1{4,}/, // Character repetition
      /-{2,}/, // Multiple dashes
      /xn--/, // Punycode
      /\.(tk|ml|ga|cf)$/, // Suspicious TLDs
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(domain));
  }

  isUrlShortener(domain) {
    const shorteners = [
      'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 
      'is.gd', 'buff.ly', 'adf.ly', 'short.link', 'cutt.ly',
      'rebrand.ly', 'clickmeter.com', 'tiny.cc'
    ];
    
    return shorteners.includes(domain.toLowerCase());
  }

  hasSuspiciousUrlPattern(url) {
    const suspiciousPatterns = [
      /[a-z]{20,}/i, // Long strings
      /%[0-9a-f]{2}/i, // URL encoding
      /\.(exe|scr|bat|com|pif|vbs|js|jar)$/i, // Executable files
      /phishing|scam|fake|malware|virus/i, // Suspicious keywords
      /[0-9a-f]{32,}/i, // Long hex strings
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(url));
  }

  isMisleadingText(text, url) {
    if (!text || text.length < 3) return false;
    
    try {
      const urlDomain = new URL(url).hostname.toLowerCase();
      const textLower = text.toLowerCase();
      
      const popularSites = ['google', 'facebook', 'amazon', 'microsoft', 'apple', 'paypal', 'bank'];
      const mentionsSite = popularSites.some(site => textLower.includes(site));
      const actuallyThatSite = popularSites.some(site => urlDomain.includes(site));
      
      return mentionsSite && !actuallyThatSite;
    } catch {
      return false;
    }
  }

  hasSuspiciousFileExtension(url) {
    const suspiciousExtensions = ['.exe', '.scr', '.bat', '.com', '.pif', '.vbs', '.js', '.jar', '.apk'];
    return suspiciousExtensions.some(ext => url.toLowerCase().endsWith(ext));
  }

  isIpAddress(domain) {
    return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain);
  }

  isNonHttpsSensitive(url) {
    const sensitiveKeywords = ['login', 'bank', 'pay', 'secure', 'account', 'password'];
    return url.startsWith('http://') && 
           sensitiveKeywords.some(keyword => url.toLowerCase().includes(keyword));
  }
//#endregion
  //start change monitor
  startMonitoring() {
    if (this.observer) this.observer.disconnect();
    
    this.observer = new MutationObserver((mutations) => {
      let shouldRescan = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === 'A' || 
                  (node.querySelector && node.querySelector('a[href]')) ||
                  node.tagName === 'FORM') {
                shouldRescan = true;
              }
            }
          });
        }
      });
      
      if (shouldRescan) {
        console.log('Web Patronus: Page content changed, rescanning...');
       
        clearTimeout(this.rescanTimeout);
        this.rescanTimeout = setTimeout(() => {
          this.scanPageLinks().catch(error => {
            console.error('Rescan failed:', error);
          });
        }, 1000);
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false, 
      characterData: false 
    });
    
    console.log('Web Patronus: Monitoring started');
  }

  //stop change monitor
  stopMonitoring() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.rescanTimeout) {
      clearTimeout(this.rescanTimeout);
      this.rescanTimeout = null;
    }
    
    console.log('Web Patronus: Monitoring stopped');
  }

  //garbage truck
  cleanup() {
    this.stopMonitoring();
    this.apiCache.clear();
    this.links.clear();
  }
}

//start scanner
const webPatronusScanner = new WebPatronusScanner();

//listener fpr message
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  webPatronusScanner.handleMessage(request, sender, sendResponse);
  return true; 
});

//page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('Web Patronus: DOM content loaded');
  //Note: Added timeout otherwise it runs before the page is finished
  setTimeout(() => {
    webPatronusScanner.scanPageLinks().then(results => {
      console.log('Initial scan completed:', results);
    }).catch(error => {
      console.error('Initial scan failed:', error);
    });
    
    webPatronusScanner.startMonitoring();
  }, 500);
});

//double scan
window.addEventListener('load', () => {
  console.log('Web Patronus: Window loaded');
  
  setTimeout(() => {
    webPatronusScanner.scanPageLinks().then(results => {
      console.log('Post-load scan completed:', results);
    }).catch(error => {
      console.error('Post-load scan failed:', error);
    });
  }, 2000);
});

//clean on unload
window.addEventListener('beforeunload', () => {
  webPatronusScanner.cleanup();
});

//handle visibility change, such sas minimize or swithc
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('Web Patronus: Page hidden, reducing activity');
  } else {
    console.log('Web Patronus: Page visible, resuming full monitoring');
    setTimeout(() => {
      webPatronusScanner.scanPageLinks().catch(error => {
        console.error('Visibility rescan failed:', error);
      });
    }, 500);
  }
});



//reload
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onConnect.addListener(() => {
    console.log('Web Patronus: Extension context connected');
  });
}


window.addEventListener('error', (e) => {
  if (e.message.includes('Extension context invalidated')) {
    console.warn('Web Patronus: Extension context invalidated, stopping monitoring');
    webPatronusScanner.stopMonitoring();
  }
});

// set timeout to clean every once in awhile
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of webPatronusScanner.apiCache.entries()) {
    if (now - value.timestamp > webPatronusScanner.cacheExpiry) {
      webPatronusScanner.apiCache.delete(key);
    }
  }
}, 5 * 60 * 1000); //5 minn


   
   

        //add popup to anchor links
        function handleAnchorElements(riskItem) {
            const anchors = document.querySelectorAll('a');
            anchors.forEach(anchor => {
                if (anchor.href === riskItem.url || anchor.getAttribute('href') === riskItem.url) {
                    addRiskHandler(anchor, riskItem);
                }
            });
       }

       
        function handleScriptElements(riskItem) {
            const scripts = document.querySelectorAll('script');
            scripts.forEach(script => {
                if (script.src === riskItem.link || script.getAttribute('src') === riskItem.link) {
                  
                    console.warn(`Risky script detected: ${riskItem.link} (Risk: ${riskItem.riskLevel})`);
                    //prevent script exceion???
                }
            });
        }

      
        function handleButtonElements(riskItem) {
            const buttons = document.querySelectorAll('button');
            buttons.forEach(button => {
                const onclick = button.getAttribute('onclick');
                if (onclick && onclick.includes(riskItem.url)) {
                    addRiskHandler(button, riskItem);
                }
            });
        }

        // Add risk warning handler to an element
        function addRiskHandler(element, riskItem) {
            const originalHref = element.href;
            const originalOnclick = element.onclick;

            // Remove original navigation
            if (element.tagName.toLowerCase() === 'a') {
                element.removeAttribute('href');
                element.style.cursor = 'pointer';
            }

            element.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                showRiskPopup(riskItem,originalHref,originalOnclick);
            });
        }

        // Show risk popup
        function showRiskPopup(riskItem, originalLink,originalOnclick) {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'risk-popup-overlay';

            // Create popup
            const popup = document.createElement('div');
            popup.className = 'risk-popup';
            popup.id = "myPopUp";

            // Risk level styling
            const riskClass = `risk-${riskItem.riskLevel.toLowerCase()}`;
            const riskMessages = {
                safe: 'This link has a low security risk.',
                warning: 'This link has a medium security risk. Please proceed with caution.',
                danger: 'WARNING: This link has a high security risk! It may contain malware or phishing content.'
            };

           popup.innerHTML = `
<style>
.risk-popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
       background: linear-gradient(135deg, #387df312 0%, #0325830d 100%);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.risk-popup {
   background: #f3f3f3;
    padding: 40px 35px;
    border-radius: 20px;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
    max-width: 420px;
    width: 90%;
    text-align: center;
    animation: popupSlideIn 0.4s ease-out;
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.risk-popup::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
    pointer-events: none;
}

@keyframes popupSlideIn {
    from {
        opacity: 0;
        transform: translateY(-30px) scale(0.9);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.security-icon {
    width: 80px;
    height: 80px;
       background: blue;
    border-radius: 50%;
    margin: 0 auto 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    border: 6px solid rgb(180 196 241 / 62%);
}

.security-icon svg {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.security-title {
       color: #000000;
    font-size: 28px;
    font-weight: 500;
    margin: 0 0 15px 0;
    position: relative;
    z-index: 2;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    letter-spacing: -0.5px;
}

.security-message {
    color: rgb(43 43 43 / 90%);
    font-size: 16px;
    margin: 0 0 8px 0;
    position: relative;
    z-index: 2;
    line-height: 1.5;
}

.security-url {
  background: rgb(247 249 251);
    border-radius: 8px;
  padding: 20px 15px;
    margin: 0 0 20px 0;
    position: relative;
    z-index: 2;
    border: 1px solid rgb(0 0 0 / 15%);
    border-left: 4px solid #3476ef;
}

.security-url strong {
     color: #696969;
    font-size: 15px;
    font-weight: 500;
    word-break: break-all;
    font-family: 'Monaco', 'Menlo', monospace;
}
.risk-warning{
    background-color: #eeffa8;
    color: #abab08;
    border: 2px solid #d3d977;
}
.risk-safe{
background-color: #dffcea;
    color: green;
    border: 2px solid #b5f5cb;
}
.risk-danger{
    background-color: #f5caca;
    color: red;
    border: 2px solid #ed8c8c;
}
.risk-level {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 400;
    margin: 20px 0;
    padding: 15px;
    border-radius: 12px;
    position: relative;
    z-index: 2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.risk-level::before {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    animation: pulse 2s infinite;
}

.risk-safe {
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.risk-safe::before {
    background: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
}

.risk-warning {
    background: rgba(251, 191, 36, 0.2);
    border: 1px solid rgba(251, 191, 36, 0.3);
}

.risk-warning::before {
    background: #fbbf24;
    box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.3);
}

.risk-danger {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.risk-danger::before {
    background: #ef4444;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3);
}

.risk-description {
    color: rgb(87 87 87 / 80%);
    font-size: 14px;
    margin: 0 0 30px 0;
    position: relative;
    z-index: 2;
    line-height: 1.4;
}

.popup-buttons {
    display: flex;
    gap: 15px;
    position: relative;
    z-index: 2;
}

.popup-btn {
    flex: 1;
    padding: 15px 25px;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    transition: all 0.3s ease;
    text-align: center;
}

.continue-btn {
   background: linear-gradient(135deg, #387df3 0%, #032583 100%);
    color: white !Important;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.continue-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5);
    text-decoration: none;
    color: white;
}

.cancel-btn {
     background: rgba(255, 255, 255, 0.1);
    color: #7f7f7f;
    border: 1px solid rgb(109 109 109 / 30%);
    backdrop-filter: blur(10px);
    font-size: 15px;
    font-weight: 600;
}

.cancel-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
}

@keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
</style>

<div class="security-icon">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L3 7V12C3 16.55 6.84 20.74 12 22C17.16 20.74 21 16.55 21 12V7L12 2Z" 
              fill="white" opacity="0.9"/>
        <path d="M10 17L6 13L7.41 11.59L10 14.17L16.59 7.58L18 9L10 17Z" 
              fill="#3b82f6"/>
    </svg>
</div>

<h2 class="security-title">Link Security check</h2>

<p class="security-message">You are about to visit:</p>

<div class="security-url">
    <strong>${originalLink}</strong>
</div>

<div class="risk-level ${riskClass}">
    Risk Level: ${riskItem.riskLevel.toUpperCase()}
</div>

<p class="risk-description">${riskMessages[riskItem.riskLevel.toLowerCase()]}</p>

<div class="popup-buttons">
    <a class="popup-btn continue-btn" href="${originalLink}">Continue to Site</a>
    <button id="closeBtn" class="popup-btn cancel-btn">Go Back</button>
</div>
`;

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

        const closeBtn = popup.querySelector('#closeBtn');
  closeBtn.addEventListener('click', () => {
    popup.remove(); // remove the popup from DOM
  });
            // Close on overlay click
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) {
                    popup.remove(); // remove the popup from DOM
                }
            });

            // Close on escape key
            const escHandler = function(e) {
                if (e.key === 'Escape') {
                    popup.remove(); // remove the popup from DOM
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        }

    
console.log('Web Patronus content script loaded successfully');