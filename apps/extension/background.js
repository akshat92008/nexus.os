/**
 * Nexus OS Browser Extension — Background Service Worker
 * Bridges browser tabs to Nexus OS API
 */
const NEXUS_API_URL = 'http://localhost:3006';

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  if (command === 'send-to-nexus') {
    await sendPageToNexus(tab);
  } else if (command === 'ask-nexus') {
    await askNexusAboutPage(tab);
  }
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SEND_PAGE') {
    sendPageToNexus(sender.tab).then(sendResponse);
    return true;
  }
  if (request.type === 'ASK_NEXUS') {
    askNexusAboutPage(sender.tab, request.question).then(sendResponse);
    return true;
  }
  if (request.type === 'EXECUTE_SKILL') {
    executeSkill(request.skillId, request.toolName, request.params).then(sendResponse);
    return true;
  }
});

async function sendPageToNexus(tab) {
  try {
    // Inject script to extract page content
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent
    });

    // Send to Nexus OS
    const response = await fetch(`${NEXUS_API_URL}/api/skills/v2/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'webfetch_page',
        params: { url: tab.url, format: 'text' }
      })
    });

    return { success: true, url: tab.url, title: tab.title };
  } catch (err) {
    console.error('[Nexus Extension] Failed to send page:', err);
    return { success: false, error: err.message };
  }
}

async function askNexusAboutPage(tab, question) {
  try {
    const response = await fetch(`${NEXUS_API_URL}/api/missions/quick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: `Analyze webpage: ${tab.url}\nUser asks: ${question || 'Summarize this page'}`,
        context: { url: tab.url, title: tab.title }
      })
    });

    const data = await response.json();
    return { success: true, response: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function executeSkill(skillId, toolName, params) {
  try {
    const response = await fetch(`${NEXUS_API_URL}/api/skills/v2/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: toolName, params })
    });

    return await response.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function extractPageContent() {
  return {
    title: document.title,
    url: window.location.href,
    text: document.body.innerText.slice(0, 10000),
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
      level: h.tagName,
      text: h.textContent.trim()
    })),
    links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
      text: a.textContent.trim(),
      href: a.href
    })).slice(0, 50)
  };
}
