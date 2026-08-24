/* =============================================================
   AtoZ Store — Public Frontend JS  (v4 — Optimized)
   ============================================================= */
(function () {
  'use strict';

  const API = {
    links:    'api/links.php',
    settings: 'api/settings.php',
  };
  
  // Cache for icon URLs to avoid recomputation
  const iconCache = new Map();
  
  /* ---- Built-in inline SVG icons for common types (OFFICIAL BRAND ICONS) ---- */
  const TYPE_ICONS = {
    whatsapp:  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%2325D366"/><path fill="%23fff" d="M23 9a9.9 9.9 0 0 0-16.9 7.1c0 1.6.4 3.1 1.2 4.4L6 27l6.7-1.8c1.3.7 2.7 1 4.2 1a9.9 9.9 0 0 0 9.9-9.9c0-2.6-1-5-2.8-6.9z"/></svg>',
    instagram: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="%23fdf497"/><stop offset="5%" stop-color="%23fdf497"/><stop offset="45%" stop-color="%23fd5949"/><stop offset="60%" stop-color="%23d6249f"/><stop offset="90%" stop-color="%23285AEB"/></radialGradient></defs><rect width="32" height="32" rx="8" fill="url(%23ig)"/><rect x="8" y="8" width="16" height="16" rx="5" fill="none" stroke="%23fff" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="none" stroke="%23fff" stroke-width="2"/><circle cx="22" cy="10" r="1.2" fill="%23fff"/></svg>',
    facebook:  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%231877F2"/><path fill="%23fff" d="M17.5 10.5h2.5V7.5H17a4 4 0 0 0-4 4V13H11v3h2v8h3v-8h2.5l.5-3H16v-1.5a1 1 0 0 1 1-1z"/></svg>',
    tiktok:    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23010101"/><path fill="%23fff" d="M22 12.5a5.5 5.5 0 0 1-3.3-1.1v7.1a5.1 5.1 0 1 1-3.5-4.8v2.9a2.2 2.2 0 1 0 1.5 2.1V8h2.3a5.4 5.4 0 0 0 3 4.5z"/></svg>',
    youtube:   'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23FF0000"/><polygon fill="%23fff" points="13,11 22,16 13,21"/></svg>',
    website:   'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%2300BED9"/><circle cx="16" cy="16" r="9" fill="none" stroke="%23fff" stroke-width="2"/><line x1="16" y1="7" x2="16" y2="25" stroke="%23fff" stroke-width="1.5"/><line x1="7" y1="16" x2="25" y2="16" stroke="%23fff" stroke-width="1.5"/><ellipse cx="16" cy="16" rx="5" ry="9" fill="none" stroke="%23fff" stroke-width="1.5"/></svg>',
    custom:    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%230c1727"/><circle cx="16" cy="16" r="7" fill="none" stroke="%2300BED9" stroke-width="2"/></svg>',
  };
  
  /* --- Icon resolution with caching --------------------------------- */
  function iconFor(link) {
    const cacheKey = `${link.id || ''}:${link.icon_source || ''}:${link.icon || ''}:${link.type || ''}:${link.url || ''}`;
    if (iconCache.has(cacheKey)) {
      return iconCache.get(cacheKey);
    }
    
    let icon;
    // أولوية العرض: أيقونة مرفوعة > أيقونة المنصة الأصلية (type) > تلقائي حسب النوع > فايفكون
    if (link.icon_source === 'upload' && link.icon) {
      // أيقونة مرفوعة من الأدمن
      icon = `assets/img/icons/${link.icon}`;
    } else if (link.icon_source === 'type' && TYPE_ICONS[link.type]) {
      // عرض أيقونة المنصة الأصلية عند اختيار "أيقونة المنصة الأصلية"
      icon = TYPE_ICONS[link.type];
    } else if (link.icon_source === 'auto' || !link.icon_source || link.icon_source === '') {
      // الوضع التلقائي: استخدام أيقونة النوع إذا وجدت، أو فايفكون من جوجل
      if (TYPE_ICONS[link.type]) {
        icon = TYPE_ICONS[link.type];
      } else {
        try {
          const domain = new URL(link.url).hostname;
          icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        } catch {
          icon = TYPE_ICONS.custom;
        }
      }
    } else {
      // احتياطي: أيقونة مخصصة
      icon = TYPE_ICONS.custom;
    }
    
    iconCache.set(cacheKey, icon);
    return icon;
  }

  /* --- Build SVG icon strings for branch action buttons --- */
  const SVG = {
    maps: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    wa:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
    link: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    android: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.523 15.341a1 1 0 0 1-1.73-1l1.154-2a1 1 0 1 1 1.73 1zm-11.047 0 1.154-2a1 1 0 1 0-1.73-1l-1.154 2a1 1 0 1 0 1.73 1zM20 9H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1v3a1 1 0 0 0 2 0v-3h10v3a1 1 0 0 0 2 0v-3h1a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zM8.5 6.5a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm9 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0zM6.76 8h10.48l-1.74-3.018A2 2 0 0 0 13.764 4h-3.528a2 2 0 0 0-1.732 1l-1.745 3z"/></svg>`,
    apple:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`,
  };
  
  /* --- Render link cards with DocumentFragment ---------------------- */
  function renderLinks(links) {
    const list = document.getElementById('linksList');
    list.innerHTML = '';

    if (!links.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:20px 0">لا توجد روابط متاحة حالياً</p>';
      return;
    }

    const fragment = document.createDocumentFragment();

    links.forEach((link) => {
      const a = document.createElement('a');
      a.className   = 'link-card';
      a.href        = link.url;
      a.target      = '_blank';
      a.rel         = 'noopener noreferrer';

      const icon = document.createElement('img');
      icon.className = 'link-card__icon';
      icon.src       = iconFor(link);
      icon.alt       = '';
      icon.loading   = 'eager';

      const title = document.createElement('span');
      title.className   = 'link-card__title';
      title.textContent = link.title;

      // Copy button — only if show_copy is true
      if (link.show_copy === true || link.show_copy === 'true' || link.show_copy === '1') {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'link-card__copy-btn';
        copyBtn.type = 'button';
        copyBtn.setAttribute('aria-label', 'نسخ الرابط');
        copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        copyBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(link.url);
            copyBtn.style.background = 'rgba(37,211,102,0.3)';
            copyBtn.style.borderColor = 'rgba(37,211,102,0.5)';
            setTimeout(() => {
              copyBtn.style.background = '';
              copyBtn.style.borderColor = '';
            }, 1200);
          } catch (err) {
            console.error('فشل نسخ الرابط:', err);
          }
        });
        a.appendChild(copyBtn);
      }

      a.append(icon, title);
      fragment.appendChild(a);
    });
    
    list.appendChild(fragment);
  }

  /* --- Render branch cards with DocumentFragment -------------------- */
  function renderBranches(branches) {
    const list = document.getElementById('branchesList');
    list.innerHTML = '';

    if (!branches || !branches.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:20px 0">لا توجد فروع مضافة</p>';
      return;
    }

    // Sort by order field
    const sorted = [...branches].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const fragment = document.createDocumentFragment();

    sorted.forEach((b) => {
      const card = document.createElement('div');
      // تطبيق شكل البطاقة من الإعدادات (بما في ذلك spatial-glass)
      const cardShape = window.settings?.appearance?.card_shape || '';
      card.className = `branch-card ${cardShape}`;

      // Header section with name and password indicator
      const header = document.createElement('div');
      header.className = 'branch-card__header';
      
      const name = document.createElement('div');
      name.className   = 'branch-card__name';
      name.textContent = b.name;

      // Password-protected branch indicator — only if password exists
      if (b.password && b.password.trim() !== '') {
        const pwdIndicator = document.createElement('span');
        pwdIndicator.className = 'branch-card__pwd-indicator';
        pwdIndicator.textContent = '🔒';
        pwdIndicator.title = 'هذا الفرع محمي بكلمة مرور';
        name.appendChild(pwdIndicator);
      }
      
      header.appendChild(name);
      card.appendChild(header);

      // Details section — rendered as formatted HTML/text ( BELOW the name )
      if (b.details_html || b.details_text) {
        const details = document.createElement('div');
        details.className = 'branch-card__details';
        if (b.details_html) {
          details.innerHTML = b.details_html;
        } else if (b.details_text) {
          details.textContent = b.details_text;
        }
        card.appendChild(details);
      }

      // Hours info — only if exists
      if (b.hours) {
        const hours = document.createElement('div');
        hours.className = 'branch-card__hours';
        hours.textContent = b.hours;
        card.appendChild(hours);
      }

      const actions = document.createElement('div');
      actions.className = 'branch-card__actions';

      // Direct link button — if direct_link_url exists
      if (b.direct_link_url) {
        const directBtn = document.createElement('a');
        directBtn.className = 'branch-action-btn branch-action-btn--direct';
        directBtn.href      = b.direct_link_url;
        directBtn.target    = '_blank';
        directBtn.rel       = 'noopener noreferrer';
        directBtn.innerHTML = `${SVG.link} زيارة`;
        actions.appendChild(directBtn);
      }

      // Maps button — only if URL exists
      if (b.maps_url) {
        const mapsBtn = document.createElement('a');
        mapsBtn.className = 'branch-action-btn branch-action-btn--maps';
        mapsBtn.href      = b.maps_url;
        mapsBtn.target    = '_blank';
        mapsBtn.rel       = 'noopener noreferrer';
        mapsBtn.innerHTML = `${SVG.maps} الخريطة`;
        actions.appendChild(mapsBtn);
      }

      // WhatsApp button — only if number exists
      const waNum = (b.whatsapp || '').replace(/\D/g, '');
      if (waNum) {
        const waBtn = document.createElement('a');
        waBtn.className = 'branch-action-btn branch-action-btn--wa';
        waBtn.href      = `https://wa.me/${waNum}`;
        waBtn.target    = '_blank';
        waBtn.rel       = 'noopener noreferrer';
        waBtn.innerHTML = `${SVG.wa} واتساب`;
        actions.appendChild(waBtn);
      }

      card.appendChild(actions);
      fragment.appendChild(card);
    });
    
    list.appendChild(fragment);
  }

  /* --- Render app store block (always 2-column) --------- */
  function buildAppBlock(appLinks) {
    if (!appLinks || (!appLinks.android && !appLinks.ios)) return null;

    const wrap = document.createElement('div');
    wrap.className = 'app-block';

    if (appLinks.android) {
      const a = document.createElement('a');
      a.className = 'app-btn';
      a.href      = appLinks.android;
      a.target    = '_blank';
      a.rel       = 'noopener noreferrer';
      a.innerHTML = `${SVG.android}<span>Google Play</span>`;
      wrap.appendChild(a);
    }
    if (appLinks.ios) {
      const a = document.createElement('a');
      a.className = 'app-btn';
      a.href      = appLinks.ios;
      a.target    = '_blank';
      a.rel       = 'noopener noreferrer';
      a.innerHTML = `${SVG.apple}<span>App Store</span>`;
      wrap.appendChild(a);
    }
    return wrap;
  }

  function renderAppLinks(appLinks) {
    const block = buildAppBlock(appLinks);
    if (!block) return;

    const pos = appLinks.app_block_position === 'top' ? 'appBlockTop' : 'appBlockBottom';
    const container = document.getElementById(pos);
    if (!container) return;
    container.appendChild(block);
    container.hidden = false;
  }

  /* --- Apply appearance from admin settings ------------- */
  function applyAppearance(appearance) {
    if (!appearance) return;
    const root = document.documentElement;
    
    // Core colors
    if (appearance.background_color) root.style.setProperty('--color-bg', appearance.background_color);
    if (appearance.primary_color)    root.style.setProperty('--color-primary', appearance.primary_color);
    if (appearance.secondary_color)  root.style.setProperty('--color-secondary', appearance.secondary_color);
    
    // Header specific colors
    if (appearance.header_bg)        root.style.setProperty('--header-bg', appearance.header_bg);
    if (appearance.header_text)      root.style.setProperty('--header-text', appearance.header_text);
    if (appearance.header_tagline)   root.style.setProperty('--header-tagline', appearance.header_tagline);
    
    // Footer specific colors
    if (appearance.footer_bg)        root.style.setProperty('--footer-bg', appearance.footer_bg);
    if (appearance.footer_text)      root.style.setProperty('--footer-text', appearance.footer_text);
    if (appearance.footer_border)    root.style.setProperty('--footer-border', appearance.footer_border);
    
    // Card specific colors
    if (appearance.card_bg)          root.style.setProperty('--card-bg', appearance.card_bg);
    if (appearance.card_border)      root.style.setProperty('--card-border', appearance.card_border);
    if (appearance.card_text)        root.style.setProperty('--card-text', appearance.card_text);
    
    // Branch specific colors
    if (appearance.branch_bg)        root.style.setProperty('--branch-bg', appearance.branch_bg);
    if (appearance.branch_border)    root.style.setProperty('--branch-border', appearance.branch_border);
    if (appearance.branch_name)      root.style.setProperty('--branch-name', appearance.branch_name);
    if (appearance.branch_text)      root.style.setProperty('--branch-text', appearance.branch_text);
    if (appearance.branch_details_bg) root.style.setProperty('--branch-details-bg', appearance.branch_details_bg);

    // Layout style
    document.body.classList.remove('layout-list', 'layout-grid');
    document.body.classList.add(appearance.layout_style === 'grid' ? 'layout-grid' : 'layout-list');

    // Card style variant - including spatial-glass
    document.body.classList.remove('card-style-glass', 'card-style-elevated', 'card-style-outline', 'card-style-flat', 'card-style-spatial', 'spatial-glass');
    const cardStyle = appearance.card_style || 'glass';
    if (cardStyle === 'spatial-glass') {
      document.body.classList.add('spatial-glass');
      document.body.classList.add('card-style-spatial');
    } else {
      document.body.classList.add(`card-style-${cardStyle}`);
    }
    
    // Apply card shape if exists
    if (appearance.card_shape) {
      document.body.setAttribute('data-card-shape', appearance.card_shape);
    }
  }

  /* --- Apply logo shape & glow -------------------------- */
  function applyLogoStyle(settings) {
    const shape = settings.logo_shape || 'circle';
    const glow  = settings.logo_glow !== false;
    document.body.classList.remove('logo-circle', 'logo-rounded', 'logo-original');
    document.body.classList.add(`logo-${shape}`);
    document.body.classList.toggle('logo-glow', glow);

    // Propagate shape to glow wrapper
    const wrap = document.getElementById('logoWrap');
    if (wrap) {
      wrap.style.borderRadius = shape === 'circle' ? '50%' : shape === 'rounded' ? '22px' : '0';
    }
  }

  /* --- Tab switching with event delegation -------------- */
  function switchToPanel(panelName) {
    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.panel');

    // Deactivate all tabs
    tabs.forEach((t) => {
      t.classList.remove('tab--active');
      t.setAttribute('aria-selected', 'false');
    });

    // Hide ALL panels first - critical to prevent showing multiple panels
    panels.forEach((p) => { 
      p.classList.add('panel--hidden');
    });

    // Activate target tab
    const targetTab = document.querySelector(`.tab[data-panel="${panelName}"]`);
    if (targetTab) {
      targetTab.classList.add('tab--active');
      targetTab.setAttribute('aria-selected', 'true');
    }

    // Show target panel
    const targetPanel = document.getElementById(`panel-${panelName}`);
    if (targetPanel) {
      targetPanel.classList.remove('panel--hidden');
    }
  }

  // Handle URL Search Parameters navigation (?view=branches)
  function handleQueryNavigation() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    
    if (view === 'branches') {
      switchToPanel('branches');
      return true;
    } else if (view === 'links') {
      switchToPanel('links');
      return true;
    }
    return false;
  }

  // Handle hash change events (for browser back/forward buttons)
  function handleHashNavigation() {
    const hash = window.location.hash.slice(1);
    
    // Support both #branches and #tab-branches for compatibility
    if (hash === 'branches' || hash === 'tab-branches') {
      switchToPanel('branches');
      return true;
    } else if (hash === 'links' || hash === 'tab-links') {
      switchToPanel('links');
      return true;
    }
    return false;
  }

  function initTabs() {
    const tabsContainer = document.querySelector('.tabs');
    const panels = document.querySelectorAll('.panel');

    if (!tabsContainer) return;

    // IMPORTANT: Initially hide ALL panels before any navigation logic
    // This prevents the page from showing all content at once
    panels.forEach((p) => {
      p.classList.add('panel--hidden');
    });

    // Handle initial navigation on page load
    // Priority: 1) Query params (?view=branches), 2) Hash (#branches), 3) Default (links)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // First try query parameter navigation
        let handled = handleQueryNavigation();
        
        // If no query param, try hash navigation
        if (!handled) {
          handled = handleHashNavigation();
        }
        
        // If nothing handled, default to links panel
        if (!handled) {
          switchToPanel('links');
        }
      });
    });

    tabsContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      
      const target = tab.dataset.panel;
      switchToPanel(target);
      // Update URL with query parameter for clean routing
      const url = new URL(window.location);
      url.searchParams.set('view', target);
      window.history.pushState({}, '', url);
    });

    // Handle browser back/forward buttons - check both query and hash
    window.addEventListener('popstate', () => {
      let handled = handleQueryNavigation();
      if (!handled) {
        handleHashNavigation();
      }
    });
  }

  /* --- Main init --------------------------------------- */
  async function init() {
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // Initialize tabs immediately (handles hash navigation on load)
    initTabs();

    try {
      const [linksRes, settingsRes] = await Promise.all([
        fetch(API.links, { cache: 'no-cache' }),
        fetch(API.settings, { cache: 'no-cache' }),
      ]);

      const linksData = await linksRes.json();
      const settings  = await settingsRes.json();

      // Inject tracking scripts using secure DOM methods
      injectTrackingScripts(settings.tracking_scripts_head, 'head');
      injectTrackingScripts(settings.tracking_scripts_body, 'body');

      // Header
      document.getElementById('storeName').textContent = settings.store_name || 'AtoZ Store';
      document.getElementById('taglineText').textContent = settings.tagline || 'Expect More...';
      if (settings.bio_html) {
        document.getElementById('bioText').innerHTML = settings.bio_html;
      }
      if (settings.logo_url) {
        document.getElementById('logoImg').src = settings.logo_url;
      }

      // Website micro-button
      const websiteBtn   = document.getElementById('websiteBtn');
      const websiteLabel = document.getElementById('websiteLabel');
      if (settings.website_url) {
        websiteBtn.href      = settings.website_url;
        try { websiteLabel.textContent = new URL(settings.website_url).hostname; } catch { /* keep default */ }
        websiteBtn.hidden = false;
      }

      // Phone micro-button
      const phoneBtn   = document.getElementById('phoneBtn');
      const phoneLabel = document.getElementById('phoneLabel');
      if (settings.phone) {
        phoneBtn.href        = `tel:${settings.phone.replace(/\s/g, '')}`;
        phoneLabel.textContent = settings.phone;
        phoneBtn.hidden = false;
      }

      // Footer
      const footerText = settings.footer_text
        ? settings.footer_text.replace('{year}', new Date().getFullYear())
        : `AtoZ Store © ${new Date().getFullYear()}`;
      document.getElementById('footerText').textContent = footerText;

      // Appearance
      applyAppearance(settings.appearance);
      applyLogoStyle(settings);

      // Links
      renderLinks(linksData.links || []);

      // Branches
      renderBranches(settings.branches);

      // App store badges
      renderAppLinks(settings.app_links);

    } catch (err) {
      console.error('[AtoZ] Failed to load page data:', err);
      document.getElementById('linksList').innerHTML =
        '<p style="text-align:center;color:var(--color-text-muted);padding:20px 0">تعذر تحميل الروابط، يرجى المحاولة لاحقاً</p>';
      document.getElementById('branchesList').innerHTML = '';
    }
  }

  /* ================================================================
     TRACKING SCRIPTS INJECTION (Fixed - proper script execution)
     ================================================================ */
  function injectTrackingScripts(scriptContent, position) {
    if (!scriptContent || scriptContent.trim() === '') return;

    console.log('[AtoZ] Injecting tracking scripts to', position);
    console.log('[AtoZ] Raw script content length:', scriptContent.length);

    // Create a temporary container to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = scriptContent.trim();

    // Determine target container
    const targetContainer = position === 'head' 
      ? document.getElementById('tracking-head-container')
      : document.getElementById('tracking-body-container');

    if (!targetContainer) {
      console.error('[AtoZ] Target container not found for', position);
      return;
    }

    // Process each node
    function processNode(node) {
      if (node.nodeType === Node.SCRIPT_NODE || node.nodeName === 'SCRIPT') {
        // Create new script element
        const scriptEl = document.createElement('script');
        
        // Copy attributes from original script - IMPORTANT: preserve data-cfasync="false"
        Array.from(node.attributes).forEach(attr => {
          scriptEl.setAttribute(attr.name, attr.value);
        });
        
        const scriptText = node.textContent;
        
        if (scriptText && scriptText.trim()) {
          let decoded = scriptText.trim();

          console.log('[AtoZ] Script preview:', decoded.substring(0, 300));
          
          // For all inline scripts, execute them in global context
          // This handles Tawk.to, IIFEs, and other patterns correctly
          try {
            // Use window.eval for global scope execution
            // This is necessary for scripts that define global variables/functions
            (0, eval)(decoded);
            console.log('[AtoZ] Script executed successfully');
            
            // Also append the script element to the container for reference
            scriptEl.textContent = decoded;
            targetContainer.appendChild(scriptEl);
            return;
          } catch (e) {
            console.error('[AtoZ] Error executing script:', e);
            // Fallback: append the script element with text content
            scriptEl.textContent = decoded;
          }
        }

        // Append to target container (for external scripts or fallback)
        targetContainer.appendChild(scriptEl);
        console.log('[AtoZ] Script appended to', position);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Non-script elements like comments - skip them
        // We only care about script elements for tracking
        return;
      }
    };

    // Process all child nodes
    Array.from(temp.childNodes).forEach(processNode);
    console.log('[AtoZ] Finished injecting tracking scripts');
  }

document.addEventListener('DOMContentLoaded', init);
})();
