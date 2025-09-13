
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
  }

  //scan for links
  scanPageLinks() {
    console.log('Web Patronus: Scanning page for links...');
    
    //clear old links
    this.links.clear();
    this.scanResults = { safe: 0, warning: 0, danger: 0, total: 0, links: [] };

    //get all anchor with href
    const anchorTags = document.querySelectorAll('a[href]');
    
    //get all onclicks with potential links
    const clickableElements = document.querySelectorAll('[onclick*="http"], [onclick*="www."]');
    
    //get all form redirects
    const forms = document.querySelectorAll('form[action]');
    
    //process anchors
    anchorTags.forEach(anchor => this.processLink(anchor.href, anchor, 'anchor'));
    
    //proces click ones
    clickableElements.forEach(element => this.processClickableElement(element));
    
    //process forms
    forms.forEach(form => this.processLink(form.action, form, 'form'));
    
    //scan js
    this.scanJavaScriptContent();
    
    //look at all links
    this.analyzeLinks();
    
    console.log(`Web Patronus: Found ${this.scanResults.total} links`);
    return this.scanResults;
  }

  //process links
  processLink(url, element, type) {
    try {
      //skip if already processed
      if (this.links.has(url)) return;
      
      //clean and validate
      const cleanUrl = this.cleanUrl(url);
      if (!cleanUrl || !this.isValidUrl(cleanUrl)) return;
      
      //skip internal and safe
      if (this.isInternalLink(cleanUrl) || this.isSafeProtocol(cleanUrl)) return;
      
      this.links.add(cleanUrl);
      
      //add context
      const linkData = {
        url: cleanUrl,
        text: element.textContent?.trim() || '',
        title: element.title || '',
        type: type,
        element: element.tagName.toLowerCase(),
        visible: this.isElementVisible(element),
        position: this.getElementPosition(element),
        domain: this.extractDomain(cleanUrl)
      };
      
      this.scanResults.links.push(linkData);
      this.scanResults.total++;
      
    } catch (error) {
      console.warn('Web Patronus: Error processing link:', error);
    }
  }

  //process onclicks for potential links
  processClickableElement(element) {
    const onclick = element.getAttribute('onclick') || '';
    const urlMatches = onclick.match(/https?:\/\/[^\s'"]+/g);
    
    if (urlMatches) {
      urlMatches.forEach(url => {
        this.processLink(url, element, 'javascript');
      });
    }
  }

  //scan js for any links
  scanJavaScriptContent() {
    const scripts = document.querySelectorAll('script');
    const urlPattern = /https?:\/\/[^\s'"<>()]+/g;
    
    scripts.forEach(script => {
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
    });
  }

  //analyze links and assign risk level
  analyzeLinks() {
    this.scanResults.links.forEach(linkData => {
      const riskLevel = this.assessLinkRisk(linkData);
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
    });
  }

  //asses Risk
  //TODO: ADD api and heuristics check to determine score
  assessLinkRisk(linkData) {
    const { url, text, domain } = linkData;
    let riskScore = 0;
    
    //check if suspicious domain
    if (this.isSuspiciousDomain(domain)) riskScore += 3;
    
    //check short
    if (this.isUrlShortener(domain)) riskScore += 2;
    
    //suspicious patterns
    if (this.hasSuspiciousUrlPattern(url)) riskScore += 2;
    
    //misleading text
    if (this.isMisleadingText(text, url)) riskScore += 2;
    
    //odd file extensions
    if (this.hasSuspiciousFileExtension(url)) riskScore += 3;
    
    //check IP
    if (this.isIpAddress(domain)) riskScore += 2;
    
    //check nonhtttps
    if (this.isNonHttpsSensitive(url)) riskScore += 1;
    
    //add risk score
    if (riskScore >= 5) return 'danger';
    if (riskScore >= 2) return 'warning';
    return 'safe';
  }

  
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

  //sus domain
  isSuspiciousDomain(domain) {
    const suspiciousPatterns = [
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, //ip
      /[0-9]{5,}/, //long numbers
      /(.)\1{4,}/, //repetition
      /-{2,}/, //multi -
      /xn--/, //punycode
      /\.(tk|ml|ga|cf)$/, //sus tlds
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
      /[a-z]{20,}/i, //long strings
      /%[0-9a-f]{2}/i, //url encoding
      /\.(exe|scr|bat|com|pif|vbs|js|jar)$/i, //ex files
      /phishing|scam|fake|malware|virus/i, //sus keywords
      /[0-9a-f]{32,}/i, //long hex strings
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(url));
  }

  isMisleadingText(text, url) {
    if (!text || text.length < 3) return false;
    
    try {
      const urlDomain = new URL(url).hostname.toLowerCase();
      const textLower = text.toLowerCase();
      
      //any popular sites mentioned
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

  //start montioring for dynamic changes so web patronus can scan again
  startMonitoring() {
    if (this.observer) this.observer.disconnect();
    
    this.observer = new MutationObserver((mutations) => {
      let shouldRescan = false;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'A' || node.querySelector('a[href]')) {
              shouldRescan = true;
            }
          }
        });
      });
      
      if (shouldRescan) {
        console.log('Web Patronus: Page content changed, rescanning...');
        setTimeout(() => this.scanPageLinks(), 500);
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  //stop change tracking
  stopMonitoring() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

//initialize
const webPatronusScanner = new WebPatronusScanner();

// add listener for popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'scanPage':
      const results = webPatronusScanner.scanPageLinks();
      sendResponse({ success: true, data: results });
      break;
      
    case 'startMonitoring':
      webPatronusScanner.startMonitoring();
      sendResponse({ success: true });
      break;
      
    case 'stopMonitoring':
      webPatronusScanner.stopMonitoring();
      sendResponse({ success: true });
      break;
      
    case 'getPageInfo':
      sendResponse({
        success: true,
        data: {
          url: window.location.href,
          title: document.title,
          domain: window.location.hostname
        }
      });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return true; 
});

//scan on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    webPatronusScanner.scanPageLinks();
    webPatronusScanner.startMonitoring();
  }, 1000);
});

// rescan after page has finished loading
window.addEventListener('load', () => {
  setTimeout(() => {
    webPatronusScanner.scanPageLinks();
  }, 2000);
});