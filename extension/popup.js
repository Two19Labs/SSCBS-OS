document.getElementById('popup-sync-btn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url.includes('pgtechnos.com')) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const btn = document.getElementById('sscbs-sync-now-btn');
          if (btn) btn.click();
        }
      });
      document.getElementById('popup-status').innerText = "✅ Attendance Synced!";
    } else {
      document.getElementById('popup-status').innerText = "⚠️ Please open EduERP tab first";
    }
  });
});
