/**
 * Nexus OS Browser Extension — Content Script
 * Injected into all web pages to enable direct page interaction
 */

(function() {
  'use strict';

  // Prevent duplicate injection
  if (window.__nexusBridgeInjected) return;
  window.__nexusBridgeInjected = true;

  // Listen for commands from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_CONTENT') {
      sendResponse({
        success: true,
        data: {
          title: document.title,
          url: window.location.href,
          text: document.body.innerText.slice(0, 5000),
          html: document.documentElement.outerHTML.slice(0, 10000)
        }
      });
    }
    if (request.type === 'HIGHLIGHT_ELEMENT') {
      const el = document.querySelector(request.selector);
      if (el) {
        el.style.outline = '3px solid #3B82F6';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      sendResponse({ success: !!el });
    }
    if (request.type === 'CLICK_ELEMENT') {
      const el = document.querySelector(request.selector);
      if (el) el.click();
      sendResponse({ success: !!el });
    }
    if (request.type === 'FILL_INPUT') {
      const el = document.querySelector(request.selector);
      if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        el.value = request.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      sendResponse({ success: !!el });
    }
    return true;
  });

  // Notify Nexus OS when page loads
  chrome.runtime.sendMessage({
    type: 'PAGE_LOADED',
    url: window.location.href,
    title: document.title
  });
})();
