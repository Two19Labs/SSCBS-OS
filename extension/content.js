/**
 * SSCBS OS - EduERP Realtime Sync Content Script
 * Runs directly inside pgtechnos.com/EduERP/ to extract attendance data securely.
 */

(function () {
  console.log("⚡ SSCBS OS Auto-Sync Extension Active on EduERP!");

  function createSyncWidget() {
    if (document.getElementById('sscbs-os-sync-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'sscbs-os-sync-widget';
    widget.innerHTML = `
      <div class="sscbs-widget-card">
        <div className="widget-header">
          <span class="widget-icon">⚡</span>
          <strong>SSCBS OS Auto-Sync</strong>
        </div>
        <button id="sscbs-sync-now-btn" class="widget-btn">
          Sync Attendance to Waiver Tool
        </button>
        <span id="sscbs-sync-status" class="widget-status">Ready</span>
      </div>
    `;
    document.body.appendChild(widget);

    document.getElementById('sscbs-sync-now-btn').addEventListener('click', captureAndSync);
  }

  function captureAndSync() {
    const statusEl = document.getElementById('sscbs-sync-status');
    if (statusEl) statusEl.innerText = "Extracting attendance...";

    const pageHtml = document.documentElement.outerHTML;
    const tableEl = document.querySelector('table');

    if (!tableEl && !pageHtml.includes('SUBJECT')) {
      if (statusEl) statusEl.innerText = "⚠️ No attendance table found on this page.";
      return;
    }

    const payload = {
      htmlText: pageHtml,
      timestamp: new Date().toISOString(),
      source: 'EduERP Realtime Extension'
    };

    // Save to extension storage
    chrome.storage.local.set({ sscbs_eduerp_payload: payload }, () => {
      console.log("Saved live attendance payload to chrome storage.");
    });

    // Save to localStorage for cross-tab communication
    try {
      localStorage.setItem('sscbs_eduerp_live_sync', JSON.stringify(payload));
    } catch (e) {}

    if (statusEl) statusEl.innerText = "✅ Synced to SSCBS OS!";

    setTimeout(() => {
      if (statusEl) statusEl.innerText = "Ready";
    }, 3000);
  }

  // Auto-inject widget on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createSyncWidget);
  } else {
    createSyncWidget();
  }
})();
