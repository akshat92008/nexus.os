const NEXUS_API_URL = 'http://localhost:3006';

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  
  // Check Nexus OS connection
  try {
    const response = await fetch(`${NEXUS_API_URL}/api/system/status`, { method: 'GET' });
    if (response.ok) {
      statusEl.textContent = 'Connected to Nexus OS';
      statusEl.className = 'status connected';
    } else {
      throw new Error('Not ready');
    }
  } catch {
    statusEl.textContent = 'Nexus OS offline - start with pnpm dev';
    statusEl.className = 'status disconnected';
  }

  document.getElementById('sendPage').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.runtime.sendMessage({ type: 'SEND_PAGE' });
    statusEl.textContent = result.success ? 'Page sent!' : 'Failed to send';
    statusEl.className = result.success ? 'status connected' : 'status disconnected';
  });

  document.getElementById('askNexus').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const question = prompt('What would you like to ask about this page?');
    if (!question) return;
    
    const result = await chrome.runtime.sendMessage({ 
      type: 'ASK_NEXUS', 
      question 
    });
    
    statusEl.textContent = result.success ? 'Sent question to Nexus OS' : 'Failed';
    statusEl.className = result.success ? 'status connected' : 'status disconnected';
  });

  document.getElementById('openDashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3006' });
  });
});
