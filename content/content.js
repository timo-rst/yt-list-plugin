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

  function removeDynamicStyles() {
    const styleEl = document.getElementById('yt-list-view-dynamic-styles');
    if (styleEl) {
      styleEl.remove();
    }
  }

  function applyState() {
    const onSubsPage = isSubscriptionsPage();

    if (!onSubsPage) {
      document.documentElement.removeAttribute('data-yt-list-view');
      document.documentElement.removeAttribute('data-yt-hide-shorts');
      document.documentElement.removeAttribute('data-yt-show-desc');
      if (document.body) {
        document.body.removeAttribute('data-yt-list-view');
        document.body.removeAttribute('data-yt-hide-shorts');
        document.body.removeAttribute('data-yt-show-desc');
      }
      removeDynamicStyles();
      removeToggleButton();
      return;
    }

    // Always maintain toggle button on subscriptions page when setting is enabled
    if (currentSettings.showOnPageToggle) {
      injectToggleButton();
      updateToggleButton();
    } else {
      removeToggleButton();
    }

    if (currentSettings.enabled) {
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

      // Restore display on any existing descriptions
      document.querySelectorAll('.yt-list-view-desc').forEach((el) => {
        el.style.removeProperty('display');
      });

      if (showDesc) {
        processVideoDescriptions();
      }
    } else {
      // KACHELN (GRID) VIEW ACTIVE
      document.documentElement.removeAttribute('data-yt-list-view');
      document.documentElement.removeAttribute('data-yt-hide-shorts');
      document.documentElement.setAttribute('data-yt-show-desc', 'false');
      if (document.body) {
        document.body.removeAttribute('data-yt-list-view');
        document.body.removeAttribute('data-yt-hide-shorts');
        document.body.setAttribute('data-yt-show-desc', 'false');
      }

      // Remove custom dynamic styles so native YouTube grid is restored
      removeDynamicStyles();

      // Clear pending queue so descriptions aren't loaded in grid view
      descQueue.length = 0;

      // Force-hide all existing descriptions
      document.querySelectorAll('.yt-list-view-desc').forEach((el) => {
        el.style.setProperty('display', 'none', 'important');
      });
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
    if (s.length > 360) {
      s = s.slice(0, 360).trimEnd() + '…';
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
        credentials: 'same-origin',
        signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
      });

      if (res.status === 429) {
        // Rate limited: back off to protect YouTube session
        await new Promise((r) => setTimeout(r, 8000));
        return '';
      }

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
          if (descCache.size > 500) {
            const firstKey = descCache.keys().next().value;
            if (firstKey) descCache.delete(firstKey);
          }
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
      if (!isSubscriptionsPage() || !currentSettings.enabled || currentSettings.showDescription === false) {
        break;
      }

      const item = descQueue.shift();
      if (!item || !item.descEl) continue;

      const { vid, descEl } = item;

      if (descCache.has(vid)) {
        const text = descCache.get(vid);
        if (text && descEl.isConnected) {
          descEl.textContent = text;
        }
        continue;
      }

      const text = await fetchVideoDescription(vid);
      if (text && descEl.isConnected) {
        descEl.textContent = text;
      }

      await new Promise((r) => setTimeout(r, 60));
    }

    isQueueRunning = false;
  }

  function enqueueVideo(vid, descEl) {
    if (!currentSettings.enabled || currentSettings.showDescription === false) return;

    if (descCache.has(vid)) {
      const text = descCache.get(vid);
      if (text) {
        descEl.textContent = text;
      }
      return;
    }

    try {
      const cached = sessionStorage.getItem(`yt_desc_${vid}`);
      if (cached) {
        descCache.set(vid, cached);
        descEl.textContent = cached;
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
    if (!isSubscriptionsPage() || !currentSettings.enabled || currentSettings.showDescription === false) return;

    const cards = document.querySelectorAll(
      'ytd-rich-item-renderer :is(.yt-lockup-view-model, .ytLockupViewModelHost), ytd-rich-item-renderer ytd-rich-grid-media'
    );

    cards.forEach((card) => {
      // Explicitly ignore Shorts shelves/items
      if (card.closest('ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, ytd-rich-section-renderer')) return;

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

  // Toggle button injection next to 'Alle Abos'
  const LIST_ICON_SVG = `
    <svg viewBox="0 0 24 24">
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
    </svg>
  `;

  const GRID_ICON_SVG = `
    <svg viewBox="0 0 24 24">
      <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
    </svg>
  `;

  function findAlleAbosElement() {
    const link =
      document.querySelector('ytd-browse[page-subtype="subscriptions"] a[href*="/feed/channels"]') ||
      document.querySelector('a[href*="/feed/channels"]') ||
      document.querySelector('ytd-browse[page-subtype="subscriptions"] a[href*="channels"]') ||
      document.querySelector('a[href*="channels"]');

    if (link) {
      const outerButton =
        link.closest('ytd-button-renderer') ||
        link.closest('yt-button-view-model') ||
        link.closest('ytd-menu-renderer') ||
        link.closest('.yt-spec-button-shape-next') ||
        link.closest('yt-button-shape') ||
        link;
      return outerButton;
    }

    // Fallback: search by text content
    const candidates = document.querySelectorAll(
      'ytd-browse[page-subtype="subscriptions"] #header a, ytd-browse[page-subtype="subscriptions"] #header button, ytd-feed-filter-chip-bar-renderer a, ytd-feed-filter-chip-bar-renderer button'
    );
    for (const el of candidates) {
      const text = (el.textContent || '').trim().toLowerCase();
      if (text === 'alle abos' || text === 'manage' || text === 'abos verwalten' || text === 'abos') {
        const outerButton =
          el.closest('ytd-button-renderer') ||
          el.closest('yt-button-view-model') ||
          el.closest('.yt-spec-button-shape-next') ||
          el.closest('yt-button-shape') ||
          el;
        return outerButton;
      }
    }

    return null;
  }

  function createToggleButtonElement() {
    let container = document.getElementById('yt-list-view-toggle');
    if (container) return container;

    container = document.createElement('div');
    container.id = 'yt-list-view-toggle';
    container.className = 'yt-list-view-toggle-container';

    const btn = document.createElement('button');
    btn.className = 'yt-list-view-toggle-btn';
    btn.setAttribute('type', 'button');

    const targetModeText = currentSettings.enabled ? 'Kacheln' : 'Liste';
    const targetModeTitle = currentSettings.enabled
      ? 'Zur Kachelansicht wechseln'
      : 'Zur Listenansicht wechseln';
    const targetModeIcon = currentSettings.enabled ? GRID_ICON_SVG : LIST_ICON_SVG;

    btn.setAttribute('title', targetModeTitle);
    btn.innerHTML = `
      <span class="yt-list-view-toggle-icon">${targetModeIcon}</span>
      <span class="yt-list-view-toggle-text">${targetModeText}</span>
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
    return container;
  }

  let injectRetryTimer = null;

  function injectToggleButton() {
    if (!isSubscriptionsPage() || !currentSettings.showOnPageToggle) {
      removeToggleButton();
      return;
    }

    const alleAbosEl = findAlleAbosElement();
    let container = document.getElementById('yt-list-view-toggle');

    if (alleAbosEl && alleAbosEl.parentElement) {
      if (!container || !container.isConnected) {
        if (container) container.remove();
        container = createToggleButtonElement();
      }

      if (container.nextSibling !== alleAbosEl) {
        alleAbosEl.parentElement.insertBefore(container, alleAbosEl);
      }
      alleAbosEl.style.marginLeft = '0px';
      updateToggleButton();
      return;
    }

    // If Alle Abos not found yet, wait and retry
    if (!container || !container.isConnected) {
      if (injectRetryTimer) clearTimeout(injectRetryTimer);
      injectRetryTimer = setTimeout(() => {
        injectRetryTimer = null;
        injectToggleButton();
      }, 250);
    }
  }

  function updateToggleButton() {
    const btn = document.querySelector('#yt-list-view-toggle .yt-list-view-toggle-btn');
    if (!btn) return;

    const iconSpan = btn.querySelector('.yt-list-view-toggle-icon');
    const textSpan = btn.querySelector('.yt-list-view-toggle-text');

    if (currentSettings.enabled) {
      // List is active -> Show action to switch to Kacheln
      btn.setAttribute('title', 'Zur Kachelansicht wechseln');
      if (textSpan) textSpan.textContent = 'Kacheln';
      if (iconSpan) iconSpan.innerHTML = GRID_ICON_SVG;
    } else {
      // Kacheln are active -> Show action to switch to Liste
      btn.setAttribute('title', 'Zur Listenansicht wechseln');
      if (textSpan) textSpan.textContent = 'Liste';
      if (iconSpan) iconSpan.innerHTML = LIST_ICON_SVG;
    }
  }

  function removeToggleButton() {
    const existing = document.getElementById('yt-list-view-toggle');
    if (existing) existing.remove();
    const alleAbosEl = findAlleAbosElement();
    if (alleAbosEl) {
      alleAbosEl.style.marginLeft = '';
    }
  }

  // Safe navigation listeners (NO monkey-patching of history, NO DOM mutation loops)
  function initNavigationListeners() {
    window.addEventListener('yt-navigate-finish', () => {
      applyState();
      setTimeout(applyState, 150);
      setTimeout(() => {
        if (currentSettings.enabled && currentSettings.showDescription) {
          processVideoDescriptions();
        }
      }, 400);
    });

    window.addEventListener('yt-page-data-updated', () => {
      applyState();
      setTimeout(() => {
        if (currentSettings.enabled && currentSettings.showDescription) {
          processVideoDescriptions();
        }
      }, 300);
    });

    window.addEventListener('popstate', () => {
      applyState();
      setTimeout(() => {
        if (currentSettings.enabled && currentSettings.showDescription) {
          processVideoDescriptions();
        }
      }, 300);
    });

    // Listen for clicks on chip filters (e.g., Today, Unwatched) to keep toggle button in place
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest('ytd-feed-filter-chip-bar-renderer, yt-chip-cloud-chip-renderer')) {
        setTimeout(injectToggleButton, 150);
      }
    });

    // Throttled scroll listener for infinite scrolling
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

    // Keep-alive check to guarantee button stays next to "Alle Abos" across dynamic page rewrites
    setInterval(() => {
      if (!isSubscriptionsPage() || !currentSettings.showOnPageToggle) return;
      const btn = document.getElementById('yt-list-view-toggle');
      const alleAbosEl = findAlleAbosElement();
      if (!btn || !btn.isConnected || (alleAbosEl && btn.nextSibling !== alleAbosEl)) {
        injectToggleButton();
      }
    }, 1200);
  }

  loadSettings(() => {
    applyState();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        applyState();
        setTimeout(() => {
          if (currentSettings.enabled && currentSettings.showDescription) {
            processVideoDescriptions();
          }
        }, 500);
      });
    } else {
      setTimeout(() => {
        if (currentSettings.enabled && currentSettings.showDescription) {
          processVideoDescriptions();
        }
      }, 500);
    }
    initNavigationListeners();
  });
})();

