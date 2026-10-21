/**
 * YouTube Abo-Box Listenansicht - Popup Settings Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_SETTINGS = {
    enabled: true,
    thumbWidth: 240,
    showDescription: true,
    hideShorts: false,
    showOnPageToggle: true
  };

  const toggleEnabled = document.getElementById('toggle-enabled');
  const thumbWidthRange = document.getElementById('thumb-width-range');
  const thumbWidthVal = document.getElementById('thumb-width-val');
  const toggleShowDesc = document.getElementById('toggle-show-desc');
  const toggleHideShorts = document.getElementById('toggle-hide-shorts');
  const toggleOnPageBtn = document.getElementById('toggle-on-page-btn');

  // Helper to notify active YouTube tab immediately for real-time responsiveness
  function notifyActiveTab(newSettings) {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'UPDATE_CONFIG',
              settings: newSettings
            }).catch(() => {});
          }
        });
      });
    }
  }

  // Load current values
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    toggleEnabled.checked = settings.enabled;
    thumbWidthRange.value = settings.thumbWidth;
    thumbWidthVal.textContent = `${settings.thumbWidth}px`;
    toggleShowDesc.checked = settings.showDescription !== false;
    toggleHideShorts.checked = settings.hideShorts;
    toggleOnPageBtn.checked = settings.showOnPageToggle;
  });

  // Main Toggle
  toggleEnabled.addEventListener('change', () => {
    const val = toggleEnabled.checked;
    chrome.storage.sync.set({ enabled: val });
    notifyActiveTab({ enabled: val });
  });

  // Slider (fires continuously on input for instant live preview)
  thumbWidthRange.addEventListener('input', () => {
    const val = parseInt(thumbWidthRange.value, 10);
    thumbWidthVal.textContent = `${val}px`;
    chrome.storage.sync.set({ thumbWidth: val });
    notifyActiveTab({ thumbWidth: val });
  });

  // Show Description Toggle
  toggleShowDesc.addEventListener('change', () => {
    const val = toggleShowDesc.checked;
    chrome.storage.sync.set({ showDescription: val });
    notifyActiveTab({ showDescription: val });
  });

  // Hide Shorts Toggle
  toggleHideShorts.addEventListener('change', () => {
    const val = toggleHideShorts.checked;
    chrome.storage.sync.set({ hideShorts: val });
    notifyActiveTab({ hideShorts: val });
  });

  // On-Page Toggle Button
  toggleOnPageBtn.addEventListener('change', () => {
    const val = toggleOnPageBtn.checked;
    chrome.storage.sync.set({ showOnPageToggle: val });
    notifyActiveTab({ showOnPageToggle: val });
  });
});
