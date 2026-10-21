/**
 * YouTube Abo-Box Listenansicht - Content Script
 */

(function () {
  'use strict';

  const DEFAULT_SETTINGS = {
    enabled: true,
    thumbWidth: 240,
    showDescription: true,
    hideShorts: false,
    showOnPageToggle: true
  };

  let currentSettings = { ...DEFAULT_SETTINGS };
  const descCache = new Map();
  const descQueue = [];
  let isQueueRunning = false;
  let scrollDebounceTimer = null;

  function loadSettings(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        currentSettings = { ...DEFAULT_SETTINGS, ...items };
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  }

  // Listen for storage changes from popup
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        for (let key in changes) {
          currentSettings[key] = changes[key].newValue;
        }
        applyState();
        updateToggleButton();
      }
    });
  }

  // Direct message listener from popup for real-time slider responsiveness
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === 'UPDATE_CONFIG' && message.settings) {
        Object.assign(currentSettings, message.settings);
        applyState();
        updateToggleButton();
      }
    });
  }

  function isSubscriptionsPage() {
    return window.location.pathname.startsWith('/feed/subscriptions');
  }

  function updateDynamicStyles(thumbWidth) {
    const width = thumbWidth || 240;
    let styleEl = document.getElementById('yt-list-view-dynamic-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'yt-list-view-dynamic-styles';
      (document.head || document.documentElement).appendChild(styleEl);
    }
    styleEl.textContent = `
      :root, html, body, ytd-app, ytd-browse, ytd-rich-grid-renderer {
        --yt-list-thumb-width: ${width}px !important;
      }
      html[data-yt-list-view="true"] :is(.yt-lockup-view-model, .ytLockupViewModelHost),
      body[data-yt-list-view="true"] :is(.yt-lockup-view-model, .ytLockupViewModelHost),
      html[data-yt-list-view="true"] ytd-rich-grid-media #dismissible,
      body[data-yt-list-view="true"] ytd-rich-grid-media #dismissible {
        grid-template-columns: ${width}px minmax(0, 1fr) auto !important;
      }
      html[data-yt-list-view="true"] :is(.yt-lockup-view-model__content-image, .ytLockupViewModelContentImage),
      html[data-yt-list-view="true"] :is(.yt-lockup-view-model__content-image, .ytLockupViewModelContentImage) > *,
      html[data-yt-list-view="true"] :is(.yt-lockup-view-model__content-image, .ytLockupViewModelContentImage) yt-thumbnail-view-model,
      html[data-yt-list-view="true"] :is(.yt-lockup-view-model__content-image, .ytLockupViewModelContentImage) .ytThumbnailViewModelHost,
      body[data-yt-list-view="true"] :is(.yt-lockup-view-model__content-image, .ytLockupViewModelContentImage),
      body[data-yt-list-view="true"] :is(.yt-lockup-view-model__content-image, .ytLockupViewModelContentImage) > *,
      body[data-yt-list-view="true"] :is(.yt-lockup-view-model__content-image, .ytLockupViewModelContentImage) yt-thumbnail-view-model,
      body[data-yt-list-view="true"] :is(.yt-lockup-view-model__content-image, .ytLockupViewModelContentImage) .ytThumbnailViewModelHost,
      html[data-yt-list-view="true"] ytd-rich-grid-media #thumbnail,
      html[data-yt-list-view="true"] ytd-rich-grid-media ytd-thumbnail,
      body[data-yt-list-view="true"] ytd-rich-grid-media #thumbnail,
      body[data-yt-list-view="true"] ytd-rich-grid-media ytd-thumbnail {
        width: ${width}px !important;
        min-width: ${width}px !important;
        max-width: ${width}px !important;
      }
    `;
  }

  function applyState() {
    const onSubsPage = isSubscriptionsPage();
    const shouldBeActive = onSubsPage && currentSettings.enabled;

    if (shouldBeActive) {
      document.documentElement.setAttribute('data-yt-list-view', 'true');
      if (document.body) {
        document.body.setAttribute('data-yt-list-view', 'true');
      }

      updateDynamicStyles(currentSettings.thumbWidth);

      const showDesc = currentSettings.showDescription !== false;
      document.documentElement.setAttribute('data-yt-show-desc', showDesc ? 'true' : 'false');
      if (document.body) {
        document.body.setAttribute('data-yt-show-desc', showDesc ? 'true' : 'false');
      }

      if (currentSettings.hideShorts) {
        document.documentElement.setAttribute('data-yt-hide-shorts', 'true');
        if (document.body) document.body.setAttribute('data-yt-hide-shorts', 'true');
      } else {
        document.documentElement.removeAttribute('data-yt-hide-shorts');
        if (document.body) document.body.removeAttribute('data-yt-hide-shorts');
      }

      if (currentSettings.showOnPageToggle) {
        injectToggleButton();
      }

      if (showDesc) {
        processVideoDescriptions();
      }
    } else {
      document.documentElement.removeAttribute('data-yt-list-view');
      document.documentElement.removeAttribute('data-yt-hide-shorts');
      document.documentElement.removeAttribute('data-yt-show-desc');
      if (document.body) {
        document.body.removeAttribute('data-yt-list-view');
        document.body.removeAttribute('data-yt-hide-shorts');
        document.body.removeAttribute('data-yt-show-desc');
      }
      removeToggleButton();
    }
  }

  function extractVideoId(card) {
    const anchors = card.querySelectorAll(
      'a.yt-lockup-view-model__content-image, a.ytLockupViewModelContentImage, a[href*="/watch?v="], a[href*="watch?v="], a[href*="/shorts/"]'
    );
    for (const anchor of anchors) {
      const href = anchor.getAttribute('href') || anchor.href || '';
      const vMatch = href.match(/[?&]v=([^&#]+)/);
      if (vMatch) return vMatch[1];
      const sMatch = href.match(/\/shorts\/([^?&#/]+)/);
      if (sMatch) return sMatch[1];
    }
    return null;
  }

  function decodeHtmlEntities(str) {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }

  function cleanDescription(text) {
    if (!text) return '';
    let s = decodeHtmlEntities(text).replace(/\r/g, '').trim();
    s = s.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');
    if (s.length > 240) {
      s = s.slice(0, 240).trimEnd() + '…';
    }
    return s;
  }

  async function fetchVideoDescription(videoId) {
    if (!videoId) return '';

    if (descCache.has(videoId)) {
      return descCache.get(videoId);
    }

    try {
      const cached = sessionStorage.getItem(`yt_desc_${videoId}`);
      if (cached) {
        descCache.set(videoId, cached);
        return cached;
      }
    } catch (_) {}

    try {
      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        credentials: 'same-origin'
      });
      if (res.ok) {
        const html = await res.text();
        const m =
          html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
          html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);

        let desc = '';
        if (m && m[1]) {
          desc = m[1];
        } else {
          const pMatch = html.match(/"shortDescription":\s*"((?:\\.|[^"\\])*)"/);
          if (pMatch && pMatch[1]) {
            try {
              desc = JSON.parse(`"${pMatch[1]}"`);
            } catch (_) {
              desc = pMatch[1];
            }
          }
        }

        const cleaned = cleanDescription(desc);
        if (cleaned) {
          descCache.set(videoId, cleaned);
          try {
            sessionStorage.setItem(`yt_desc_${videoId}`, cleaned);
          } catch (_) {}
          return cleaned;
        }
      }
    } catch (_) {}

    return '';
  }

  async function processDescQueue() {
    if (isQueueRunning) return;
    isQueueRunning = true;

    while (descQueue.length > 0) {
      if (!isSubscriptionsPage() || currentSettings.showDescription === false) {
        break;
      }

      const item = descQueue.shift();
      if (!item || !item.descEl) continue;

      const { vid, descEl } = item;

      if (descCache.has(vid)) {
        const text = descCache.get(vid);
        if (text && descEl.isConnected) {
          descEl.textContent = text;
          descEl.style.display = '-webkit-box';
        }
        continue;
      }

      const text = await fetchVideoDescription(vid);
      if (text && descEl.isConnected) {
        descEl.textContent = text;
        descEl.style.display = '-webkit-box';
      }

      await new Promise((r) => setTimeout(r, 60));
    }

    isQueueRunning = false;
  }

  function enqueueVideo(vid, descEl) {
    if (descCache.has(vid)) {
      const text = descCache.get(vid);
      if (text) {
        descEl.textContent = text;
        descEl.style.display = '-webkit-box';
      }
      return;
    }

    try {
      const cached = sessionStorage.getItem(`yt_desc_${vid}`);
      if (cached) {
        descCache.set(vid, cached);
        descEl.textContent = cached;
        descEl.style.display = '-webkit-box';
        return;
      }
    } catch (_) {}

    if (!descQueue.some((i) => i.vid === vid)) {
      descQueue.push({ vid, descEl });
      processDescQueue();
    }
  }

  function findTargetContainer(card) {
    return (
      card.querySelector(':is(.yt-lockup-metadata-view-model__text-container, .ytLockupViewModelTextContainer)') ||
      card.querySelector(':is(.yt-lockup-view-model__metadata, .ytLockupViewModelMetadata)') ||
      card.querySelector('#meta') ||
      card.querySelector(':is(.yt-lockup-metadata-view-model__title, .ytLockupViewModelTitle, #video-title)')?.parentElement
    );
  }

  function processVideoDescriptions() {
    if (!isSubscriptionsPage() || currentSettings.showDescription === false) return;

    const cards = document.querySelectorAll(
      'ytd-rich-item-renderer :is(.yt-lockup-view-model, .ytLockupViewModelHost), ytd-rich-item-renderer ytd-rich-grid-media'
    );

    cards.forEach((card) => {
      // Mark as processed so we never touch this card again
      if (card.dataset.ytDescAttached === 'true') return;

      const vid = extractVideoId(card);
      if (!vid) return;

      const targetContainer = findTargetContainer(card);
      if (!targetContainer) return;

      card.dataset.ytDescAttached = 'true';

      let descEl = targetContainer.querySelector('.yt-list-view-desc');
      if (!descEl) {
        descEl = document.createElement('div');
        descEl.className = 'yt-list-view-desc';
        descEl.dataset.videoId = vid;
        descEl.style.display = 'none';

        const metaLine =
          targetContainer.querySelector('yt-content-metadata-view-model') ||
          targetContainer.querySelector(':is(.yt-content-metadata-view-model, .ytContentMetadataViewModelHost)') ||
          targetContainer.querySelector('#metadata-line') ||
          targetContainer.querySelector('#metadata');

        if (metaLine && metaLine.nextSibling) {
          targetContainer.insertBefore(descEl, metaLine.nextSibling);
        } else {
          targetContainer.appendChild(descEl);
        }
      }

      enqueueVideo(vid, descEl);
    });
  }

  // Toggle button injection
  function injectToggleButton() {
    if (!isSubscriptionsPage() || !currentSettings.showOnPageToggle) {
      removeToggleButton();
      return;
    }

    if (document.getElementById('yt-list-view-toggle')) {
      updateToggleButton();
      return;
    }

    const targetParent =
      document.querySelector('ytd-feed-filter-chip-bar-renderer #chips') ||
      document.querySelector('iron-selector#chips') ||
      document.querySelector('ytd-browse[page-subtype="subscriptions"] #header') ||
      document.querySelector('ytd-rich-grid-renderer #header') ||
      document.querySelector('ytd-two-column-browse-results-renderer #header');

    if (!targetParent) {
      setTimeout(injectToggleButton, 300);
      return;
    }

    const container = document.createElement('div');
    container.id = 'yt-list-view-toggle';
    container.className = 'yt-list-view-toggle-container';

    const btn = document.createElement('button');
    btn.className = `yt-list-view-toggle-btn ${currentSettings.enabled ? 'active' : ''}`;
    btn.setAttribute('type', 'button');
    btn.setAttribute('title', 'Zwischen Listenansicht und Kachelansicht wechseln');

    btn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
      </svg>
      <span>${currentSettings.enabled ? 'Liste aktiv' : 'Kacheln'}</span>
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newEnabled = !currentSettings.enabled;
      currentSettings.enabled = newEnabled;

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ enabled: newEnabled });
      }

      applyState();
      updateToggleButton();
    });

    container.appendChild(btn);

    if (targetParent.firstChild) {
      targetParent.insertBefore(container, targetParent.firstChild);
    } else {
      targetParent.appendChild(container);
    }
  }

  function updateToggleButton() {
    const btn = document.querySelector('#yt-list-view-toggle .yt-list-view-toggle-btn');
    if (!btn) return;

    if (currentSettings.enabled) {
      btn.classList.add('active');
      btn.querySelector('span').textContent = 'Liste aktiv';
    } else {
      btn.classList.remove('active');
      btn.querySelector('span').textContent = 'Kacheln';
    }
  }

  function removeToggleButton() {
    const existing = document.getElementById('yt-list-view-toggle');
    if (existing) existing.remove();
  }

  // Safe navigation listeners (NO monkey-patching of history, NO DOM mutation loops)
  function initNavigationListeners() {
    window.addEventListener('yt-navigate-finish', () => {
      applyState();
      setTimeout(applyState, 150);
      setTimeout(processVideoDescriptions, 400);
    });

    window.addEventListener('yt-page-data-updated', () => {
      applyState();
      setTimeout(processVideoDescriptions, 300);
    });

    window.addEventListener('popstate', () => {
      applyState();
      setTimeout(processVideoDescriptions, 300);
    });

    // Throttled scroll listener for infinite scrolling (completely safe against mutation loops)
    window.addEventListener(
      'scroll',
      () => {
        if (!isSubscriptionsPage() || !currentSettings.enabled || !currentSettings.showDescription) {
          return;
        }
        if (scrollDebounceTimer) return;
        scrollDebounceTimer = setTimeout(() => {
          scrollDebounceTimer = null;
          processVideoDescriptions();
        }, 500);
      },
      { passive: true }
    );
  }

  loadSettings(() => {
    applyState();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        applyState();
        setTimeout(processVideoDescriptions, 500);
      });
    } else {
      setTimeout(processVideoDescriptions, 500);
    }
    initNavigationListeners();
  });
})();
