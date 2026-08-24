/* =============================================================
   AtoZ Store — Admin Panel JS  (v3)
   Full feature set: RBAC, drag-drop links+branches, WYSIWYG,
   logo upload, users management, approval queue, integrations,
   import/export, password eye toggle, remember-me, CSRF.
   ============================================================= */
(function () {
  'use strict';

  /* ---- API endpoints ---- */
  const API = {
    auth:     '/api/auth.php',
    links:    '/api/links.php',
    settings: '/api/settings.php',
    upload:   '/api/upload.php',
    approval: '/api/approval.php',
  };

  /* ---- Shared state ---- */
  let csrfToken    = '';
  let currentRole  = '';
  let linksState   = [];
  let settingsState = {};

  /* ================================================================
     UTILITY HELPERS
     ================================================================ */

  function escapeAttr(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function setStatus(id, msg, isError = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? 'var(--color-danger)' : 'var(--color-teal)';
  }

  /** POST JSON with CSRF header */
  async function apiPost(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(body),
    });
  }

  /* ================================================================
     ① LOGIN SCREEN (only present when PHP $isLoggedIn = false)
     ================================================================ */
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    /* Password eye toggle */
    document.getElementById('togglePw')?.addEventListener('click', () => {
      const pw   = document.getElementById('password');
      const icon = document.getElementById('eyeIcon');
      if (pw.type === 'password') {
        pw.type = 'text';
        icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
      } else {
        pw.type = 'password';
        icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
      }
    });

    /* Get CSRF before login */
    fetch(`${API.auth}?action=csrf`)
      .then(r => r.json())
      .then(d => { csrfToken = d.csrf_token || ''; })
      .catch(() => {});

    loginBtn.addEventListener('click', async () => {
      const username   = document.getElementById('username').value.trim();
      const password   = document.getElementById('password').value;
      const rememberMe = document.getElementById('rememberMe')?.checked ?? false;
      const errorEl    = document.getElementById('loginError');
      errorEl.hidden   = true;

      if (!username || !password) {
        errorEl.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور';
        errorEl.hidden = false;
        return;
      }

      loginBtn.textContent = 'جاري الدخول...';
      loginBtn.disabled    = true;

      try {
        const res  = await fetch(API.auth, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ action: 'login', username, password, remember_me: rememberMe }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          csrfToken = data.csrf_token || csrfToken;
          window.location.reload();
        } else {
          errorEl.textContent = data.error || 'فشل تسجيل الدخول';
          errorEl.hidden = false;
          loginBtn.textContent = 'دخول';
          loginBtn.disabled    = false;
        }
      } catch {
        errorEl.textContent = 'تعذر الاتصال بالخادم';
        errorEl.hidden = false;
        loginBtn.textContent = 'دخول';
        loginBtn.disabled    = false;
      }
    });

    // Allow Enter key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loginBtn.click();
    });

    return; // Nothing else to do on login screen
  }

  /* ================================================================
     ② ADMIN DASHBOARD
     ================================================================ */

  /* ---- Logout ---- */
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await apiPost(API.auth, { action: 'logout' });
    window.location.reload();
  });

  /* ---- Tab switching ---- */
  document.querySelectorAll('.admin__tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin__tab').forEach(t => {
        t.classList.remove('admin__tab--active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.admin__panel').forEach(p => p.hidden = true);
      tab.classList.add('admin__tab--active');
      tab.setAttribute('aria-selected', 'true');
      const panel = document.querySelector(`.admin__panel[data-panel="${tab.dataset.tab}"]`);
      if (panel) panel.hidden = false;
    });
  });

  document.getElementById('goToApprovalBtn')?.addEventListener('click', () => {
    document.querySelector('.admin__tab[data-tab="approvals"]')?.click();
  });

  /* ================================================================
     LINKS EDITOR
     ================================================================ */
  // أيقونات SVG أصلية محسّنة للسوشيل ميديا
  const TYPE_ICONS = {
    whatsapp:  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="waGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2325D366"/><stop offset="100%" stop-color="%23128C7E"/></linearGradient></defs><circle cx="16" cy="16" r="16" fill="url(%23waGrad)"/><path fill="%23fff" d="M23.5 12.8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.4.2-.7.1-.3-.2-1.2-.5-2.3-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.2-.2.4-.4.5-.6.2-.2.3-.4.4-.6.1-.2.1-.4 0-.6-.1-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1.1-1.1 2.7s1.2 3.2 1.4 3.4c.2.2 2.3 3.6 5.7 5 2.7 1.1 3.3.9 3.9.8.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.3.2-1.4-.1-.2-.3-.3-.6-.5z"/></svg>',
    instagram: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="igGrad" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="%23FDFD97"/><stop offset="5%" stop-color="%23FDFD97"/><stop offset="45%" stop-color="%23FD5949"/><stop offset="60%" stop-color="%23D6249F"/><stop offset="90%" stop-color="%23285AEB"/></radialGradient></defs><rect width="32" height="32" rx="8" fill="url(%23igGrad)"/><rect x="8" y="8" width="16" height="16" rx="5" fill="none" stroke="%23fff" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="none" stroke="%23fff" stroke-width="2"/><circle cx="22" cy="10" r="1.5" fill="%23fff"/></svg>',
    facebook:  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="fbGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231877F2"/><stop offset="100%" stop-color="%230D5CBF"/></linearGradient></defs><circle cx="16" cy="16" r="16" fill="url(%23fbGrad)"/><path fill="%23fff" d="M17.5 10.5h2.5V7.5H17a4 4 0 0 0-4 4V13H11v3h2v8h3v-8h2.5l.5-3H16v-1.5a1 1 0 0 1 1-1z"/></svg>',
    tiktok:    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="ttGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2300F2EA"/><stop offset="100%" stop-color="%23FF0050"/></linearGradient></defs><circle cx="16" cy="16" r="16" fill="%23010101"/><path fill="url(%23ttGrad)" d="M22 12.5a5.5 5.5 0 0 1-3.3-1.1v7.1a5.1 5.1 0 1 1-3.5-4.8v2.9a2.2 2.2 0 1 0 1.5 2.1V8h2.3a5.4 5.4 0 0 0 3 4.5z"/></svg>',
    youtube:   'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="ytGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FF0000"/><stop offset="100%" stop-color="%23CC0000"/></linearGradient></defs><circle cx="16" cy="16" r="16" fill="url(%23ytGrad)"/><polygon fill="%23fff" points="13,11 22,16 13,21"/></svg>',
    website:   'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="webGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2300BED9"/><stop offset="100%" stop-color="%23008BA3"/></linearGradient></defs><circle cx="16" cy="16" r="16" fill="url(%23webGrad)"/><circle cx="16" cy="16" r="9" fill="none" stroke="%23fff" stroke-width="2"/><line x1="16" y1="7" x2="16" y2="25" stroke="%23fff" stroke-width="1.5"/><line x1="7" y1="16" x2="25" y2="16" stroke="%23fff" stroke-width="1.5"/></svg>',
    custom:    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%230c1727"/><circle cx="16" cy="16" r="7" fill="none" stroke="%2300BED9" stroke-width="2"/></svg>',
  };

  function iconPreviewSrc(link) {
    // أولوية العرض: أيقونة مرفوعة > أيقونة النوع التلقائية > فايفكون
    if (link.icon_source === 'upload' && link.icon) {
      return `assets/img/icons/${link.icon}`;
    }
    if (link.icon_source === 'type' && TYPE_ICONS[link.type]) {
      return TYPE_ICONS[link.type];
    }
    if (link.icon_source === 'auto' || !link.icon_source) {
      if (TYPE_ICONS[link.type]) {
        return TYPE_ICONS[link.type];
      }
      try {
        return `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=64`;
      } catch {
        return TYPE_ICONS.custom;
      }
    }
    return TYPE_ICONS.custom;
  }

  function renderLinksEditor() {
    const list = document.getElementById('linksEditor');
    if (!list) return;
    list.innerHTML = '';

    linksState.forEach((link, index) => {
      const li = document.createElement('li');
      li.className = 'link-editor-item';
      li.draggable = true;
      li.dataset.index = String(index);

      const iconSrc = iconPreviewSrc(link);

      li.innerHTML = `
        <span class="link-editor-item__handle" title="اسحب لإعادة الترتيب">⠿</span>
        <img class="link-editor-item__icon-preview" src="${escapeAttr(iconSrc)}" alt="">
        <div class="link-editor-item__fields">
          <input type="text"   value="${escapeAttr(link.title)}" data-field="title"  placeholder="اسم الرابط">
          <input type="url"    value="${escapeAttr(link.url)}"   data-field="url"    placeholder="https://..." dir="ltr">
          <div class="link-editor-item__meta">
            <select data-field="type">
              <option value="custom"    ${link.type==='custom'?'selected':''}>رابط مخصص</option>
              <option value="whatsapp"  ${link.type==='whatsapp'?'selected':''}>واتساب</option>
              <option value="instagram" ${link.type==='instagram'?'selected':''}>إنستغرام</option>
              <option value="facebook"  ${link.type==='facebook'?'selected':''}>فيسبوك</option>
              <option value="tiktok"    ${link.type==='tiktok'?'selected':''}>تيك توك</option>
              <option value="youtube"   ${link.type==='youtube'?'selected':''}>يوتيوب</option>
              <option value="website"   ${link.type==='website'?'selected':''}>موقع ويب</option>
            </select>
            <select data-field="icon_source" style="min-width:120px">
              <option value="auto" ${!link.icon_source||link.icon_source==='auto'?'selected':''}>تلقائي (حسب النوع)</option>
              <option value="type" ${link.icon_source==='type'?'selected':''}>أيقونة المنصة الأصلية</option>
              <option value="upload" ${link.icon_source==='upload'?'selected':''}>أيقونة مرفوعة</option>
            </select>
            <label>
              <input type="checkbox" data-field="active" ${link.active?'checked':''}>
              نشط
            </label>
            <label style="margin-left:12px;font-size:0.85rem">
              <input type="checkbox" data-field="show_copy" ${link.show_copy?'checked':''}>
              زر النسخ
            </label>
            <button type="button" class="link-icon-upload-btn" data-idx="${index}">📎 رفع أيقونة</button>
            <input type="file" class="link-icon-file" accept="image/*" hidden data-idx="${index}">
          </div>
        </div>
        <button type="button" class="link-editor-item__delete" title="حذف">✕</button>
      `;

      /* Field changes */
      li.querySelectorAll('[data-field]').forEach((el) => {
        el.addEventListener('change', () => {
          const f = el.dataset.field;
          linksState[index][f] = f === 'active' ? el.checked : el.value;
          if (f === 'type' || f === 'url' || f === 'icon_source') {
            li.querySelector('.link-editor-item__icon-preview').src = iconPreviewSrc(linksState[index]);
          }
        });
        el.addEventListener('input', () => {
          const f = el.dataset.field;
          if (f !== 'active') linksState[index][f] = el.value;
        });
      });

      /* Custom icon upload */
      const uploadBtn  = li.querySelector('.link-icon-upload-btn');
      const fileInput  = li.querySelector('.link-icon-file');
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        uploadBtn.textContent = 'جاري الرفع...';
        const fd = new FormData();
        fd.append('icon', file);
        try {
          const res  = await fetch(API.upload, { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: fd });
          const data = await res.json();
          if (res.ok) {
            linksState[index].icon        = data.filename;
            linksState[index].icon_source = 'upload';
            li.querySelector('.link-editor-item__icon-preview').src = data.url;
            uploadBtn.textContent = '✔ تم';
          } else {
            uploadBtn.textContent = data.error || 'فشل';
          }
        } catch { uploadBtn.textContent = 'خطأ'; }
      });

      /* Delete */
      li.querySelector('.link-editor-item__delete').addEventListener('click', () => {
        linksState.splice(index, 1);
        renderLinksEditor();
      });

      addDragHandlers(li, 'linksEditor', linksState);
      list.appendChild(li);
    });
  }

  /* ---- Generic drag-and-drop for any editor list ---- */
  let dragSrcIndex = null;
  let dragSrcState = null;

  function addDragHandlers(li, listId, stateArr) {
    li.addEventListener('dragstart', (e) => {
      dragSrcIndex = Number(li.dataset.index);
      dragSrcState = stateArr;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      document.querySelectorAll('.link-editor-item').forEach(el => el.classList.remove('drag-over'));
      dragSrcIndex = null;
      dragSrcState = null;
    });
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll(`#${listId} .link-editor-item`).forEach(el => el.classList.remove('drag-over'));
      li.classList.add('drag-over');
    });
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetIndex = Number(li.dataset.index);
      if (dragSrcState !== stateArr || dragSrcIndex === null || dragSrcIndex === targetIndex) return;
      const moved = stateArr.splice(dragSrcIndex, 1)[0];
      stateArr.splice(targetIndex, 0, moved);
      if (listId === 'linksEditor') renderLinksEditor();
      else renderBranchesEditor();
    });
  }

  document.getElementById('addLinkBtn')?.addEventListener('click', () => {
    linksState.push({ id: '', title: '', url: '', icon: '', icon_source: 'auto', type: 'custom', active: true, show_copy: false });
    renderLinksEditor();
  });

  document.getElementById('saveLinksBtn')?.addEventListener('click', async () => {
    setStatus('linksStatus', 'جاري الحفظ...');
    try {
      const res  = await apiPost(API.links, { links: linksState });
      const data = await res.json();
      if (res.ok) { linksState = data.links || linksState; renderLinksEditor(); setStatus('linksStatus', data.queued ? '📋 تم إرسال التعديلات للموافقة' : '✔ تم الحفظ'); }
      else setStatus('linksStatus', data.error || 'فشل الحفظ', true);
    } catch { setStatus('linksStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     CONTENT TAB
     ================================================================ */
  document.querySelectorAll('.wysiwyg__toolbar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd === 'createLink') {
        const url = prompt('أدخل الرابط:');
        if (url) document.execCommand('createLink', false, url);
      } else {
        document.execCommand(cmd, false);
      }
      document.getElementById('bioEditor')?.focus();
    });
  });

  document.getElementById('logoUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('contentStatus', 'جاري رفع الشعار...');
    const fd = new FormData();
    fd.append('icon', file);
    try {
      const res  = await fetch(API.upload, { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: fd });
      const data = await res.json();
      if (res.ok) {
        settingsState.logo_url = data.url;
        const prev = document.getElementById('logoPreview');
        if (prev) { prev.src = data.url; prev.hidden = false; }
        setStatus('contentStatus', 'تم رفع الشعار — لا تنسَ الحفظ ✔');
      } else { setStatus('contentStatus', data.error || 'فشل رفع الشعار', true); }
    } catch { setStatus('contentStatus', 'تعذر الاتصال بالخادم', true); }
  });

  document.getElementById('saveContentBtn')?.addEventListener('click', async () => {
    setStatus('contentStatus', 'جاري الحفظ...');
    const payload = {
      store_name: document.getElementById('storeNameInput')?.value,
      tagline:    document.getElementById('taglineInput')?.value,
      bio_html:   document.getElementById('bioEditor')?.innerHTML,
      website_url: document.getElementById('websiteUrlInput')?.value,
      phone:      document.getElementById('phoneInput')?.value,
      footer_text: document.getElementById('footerTextInput')?.value,
      logo_shape: document.getElementById('logoShapeSelect')?.value,
      logo_glow:  document.getElementById('logoGlowToggle')?.checked ?? true,
    };
    if (settingsState.logo_url) payload.logo_url = settingsState.logo_url;

    try {
      const res  = await apiPost(API.settings, payload);
      const data = await res.json();
      if (res.ok) { settingsState = { ...settingsState, ...data.settings }; setStatus('contentStatus', data.queued ? '📋 تم إرسال التعديلات للموافقة' : '✔ تم الحفظ'); }
      else setStatus('contentStatus', data.error || 'فشل الحفظ', true);
    } catch { setStatus('contentStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     BRANCHES EDITOR
     ================================================================ */
  function renderBranchesEditor() {
    const list = document.getElementById('branchesEditor');
    if (!list) return;
    list.innerHTML = '';

    const branches = settingsState.branches || [];

    branches.forEach((branch, index) => {
      const li = document.createElement('li');
      li.className = 'link-editor-item';
      li.draggable = true;
      li.dataset.index = String(index);

      li.innerHTML = `
        <span class="link-editor-item__handle" title="اسحب لإعادة الترتيب">⠿</span>
        <div class="link-editor-item__fields">
          <input type="text" value="${escapeAttr(branch.name)}"      data-field="name"      placeholder="اسم الفرع">
          <input type="url"  value="${escapeAttr(branch.maps_url||'')}" data-field="maps_url" placeholder="رابط خرائط جوجل / Waze" dir="ltr">
          <input type="text" value="${escapeAttr(branch.whatsapp||'')}" data-field="whatsapp" placeholder="رقم واتساب بدون + (مثال: 972591234567)" dir="ltr">
          <input type="text" value="${escapeAttr(branch.hours||'')}"   data-field="hours"   placeholder="أوقات الدوام (مثال: 9 ص - 10 م)">
          <input type="url"  value="${escapeAttr(branch.direct_link_url||'')}" data-field="direct_link_url" placeholder="رابط مباشر للفرع (اختياري)" dir="ltr">
          <input type="password" value="${escapeAttr(branch.password||'')}" data-field="password" placeholder="كلمة سر خاصة بالفرع" dir="ltr">
          
          <div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.1);padding-top:12px;">
            <label style="font-size:0.85rem;font-weight:600;margin-bottom:6px;display:block">تفاصيل الفرع (نص عادي)</label>
            <textarea data-field="details_text" rows="3" placeholder="اكتب تفاصيل الفرع هنا..." style="width:100%;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px;color:var(--color-text);font-family:var(--font);font-size:0.9rem">${escapeAttr(branch.details_text||'')}</textarea>
            
            <label style="font-size:0.85rem;font-weight:600;margin:12px 0 6px;display:block">تفاصيل متقدمة (HTML منسق)</label>
            <p style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:6px">يمكنك إضافة أزرار، قوائم منسدلة، أو أي محتوى HTML</p>
            <textarea data-field="details_html" rows="5" placeholder='<button>زر مثال</button><br><select><option>خيار 1</option></select>' style="width:100%;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px;color:var(--color-primary);font-family:monospace;font-size:0.85rem" dir="ltr">${escapeAttr(branch.details_html||'')}</textarea>
          </div>
        </div>
        <button type="button" class="link-editor-item__delete" title="حذف فرع">✕</button>
      `;

      li.querySelectorAll('[data-field]').forEach((input) => {
        input.addEventListener('input', () => {
          const field = input.dataset.field;
          settingsState.branches[index][field] = input.type === 'checkbox' ? input.checked : input.value;
        });
      });

      li.querySelector('.link-editor-item__delete').addEventListener('click', () => {
        settingsState.branches.splice(index, 1);
        renderBranchesEditor();
      });

      addDragHandlers(li, 'branchesEditor', settingsState.branches);
      list.appendChild(li);
    });
  }

  document.getElementById('addBranchBtn')?.addEventListener('click', () => {
    settingsState.branches = settingsState.branches || [];
    const maxOrder = settingsState.branches.reduce((m, b) => Math.max(m, b.order ?? 0), 0);
    settingsState.branches.push({ id: 'br_' + Date.now(), name: '', maps_url: '', whatsapp: '', hours: '', password: '', direct_link_url: '', details_text: '', details_html: '', order: maxOrder + 1 });
    renderBranchesEditor();
  });

  document.getElementById('saveBranchesBtn')?.addEventListener('click', async () => {
    setStatus('branchesStatus', 'جاري الحفظ...');
    // Re-assign order based on current array position
    const branches = (settingsState.branches || []).map((b, i) => ({ ...b, order: i + 1 }));
    try {
      const res  = await apiPost(API.settings, { branches });
      const data = await res.json();
      if (res.ok) { settingsState.branches = data.settings?.branches || branches; renderBranchesEditor(); setStatus('branchesStatus', data.queued ? '📋 تم إرسال التعديلات للموافقة' : '✔ تم الحفظ'); }
      else setStatus('branchesStatus', data.error || 'فشل الحفظ', true);
    } catch { setStatus('branchesStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     APPEARANCE TAB
     ================================================================ */
  function updateAppearancePreview() {
    const preview   = document.getElementById('appearancePreview');
    const card      = preview?.querySelector('.appearance-preview__card');
    const icon      = preview?.querySelector('.appearance-preview__icon');
    if (!preview || !card || !icon) return;

    const bg         = document.getElementById('bgColorInput')?.value        || '#0c1727';
    const primary    = document.getElementById('primaryColorInput')?.value   || '#00bed9';
    const secondary  = document.getElementById('secondaryColorInput')?.value || '#ffffff';
    const cardStyle  = document.getElementById('cardStyleSelect')?.value     || 'glass';

    preview.style.background = bg;
    card.style.color          = secondary;
    icon.style.background     = primary;

    // Get card-specific colors from inputs for accurate preview
    const cardBg       = document.getElementById('cardBgInput')?.value       || 'rgba(255,255,255,0.07)';
    const cardBorder   = document.getElementById('cardBorderInput')?.value   || 'rgba(255,255,255,0.10)';
    const cardText     = document.getElementById('cardTextInput')?.value     || '#ffffff';

    if (cardStyle === 'glass') {
      card.style.background   = cardBg;
      card.style.border       = `1px solid ${cardBorder}`;
      card.style.borderRadius = '14px';
      card.style.boxShadow    = '0 8px 32px -8px rgba(0,0,0,0.45)';
      card.style.backdropFilter = 'blur(16px) saturate(160%)';
      card.style.webkitBackdropFilter = 'blur(16px) saturate(160%)';
      card.style.color = cardText;
    } else if (cardStyle === 'spatial-glass') {
      card.style.background   = cardBg;
      card.style.border       = `1px solid ${cardBorder}`;
      card.style.borderRadius = '14px';
      card.style.boxShadow    = '0 8px 32px -8px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.15), inset 0 -1px 0 0 rgba(0,0,0,0.1)';
      card.style.backdropFilter = 'blur(24px) saturate(180%)';
      card.style.webkitBackdropFilter = 'blur(24px) saturate(180%)';
      card.style.position = 'relative';
      card.style.overflow = 'hidden';
      card.style.color = cardText;
    } else if (cardStyle === 'elevated') {
      card.style.background   = cardBg;
      card.style.border       = '1px solid transparent';
      card.style.borderRadius = '14px';
      card.style.boxShadow    = '0 4px 20px -4px rgba(0,0,0,0.4)';
      card.style.backdropFilter = 'none';
      card.style.webkitBackdropFilter = 'none';
      card.style.color = cardText;
    } else if (cardStyle === 'outline') {
      card.style.background   = 'transparent';
      card.style.border       = `1.5px solid ${cardBorder}`;
      card.style.borderRadius = '14px';
      card.style.boxShadow    = 'none';
      card.style.backdropFilter = 'none';
      card.style.webkitBackdropFilter = 'none';
      card.style.color = cardText;
    } else {
      card.style.background   = 'transparent';
      card.style.border       = 'none';
      card.style.borderBottom = `1px solid ${cardBorder}`;
      card.style.borderRadius = '0';
      card.style.boxShadow    = 'none';
      card.style.backdropFilter = 'none';
      card.style.webkitBackdropFilter = 'none';
      card.style.color = cardText;
    }
  }

  function populateAppearanceFields(a) {
    if (!a) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setColorPicker = (textId, pickerId, val) => {
      const textEl = document.getElementById(textId);
      const pickerEl = document.getElementById(pickerId);
      if (textEl) textEl.value = val;
      if (pickerEl) {
        // Try to extract hex from rgba/rgb or use default
        const hex = rgbaToHex(val);
        pickerEl.value = hex;
      }
    };
    set('bgColorInput',       a.background_color || '#0c1727');
    set('primaryColorInput',  a.primary_color    || '#00bed9');
    set('secondaryColorInput',a.secondary_color  || '#ffffff');
    set('layoutStyleSelect',  a.layout_style     || 'list');
    set('cardStyleSelect',    a.card_style       || 'glass');
    // Header colors - ensure proper RGBA to HEX conversion
    setColorPicker('headerBgInput', 'headerBgPicker', a.header_bg || '#0c1727');
    setColorPicker('headerTextInput', 'headerTextPicker', a.header_text || '#ffffff');
    setColorPicker('headerTaglineInput', 'headerTaglinePicker', a.header_tagline || '#ffffff');
    // Footer colors
    setColorPicker('footerBgInput', 'footerBgPicker', a.footer_bg || '#0c1727');
    setColorPicker('footerTextInput', 'footerTextPicker', a.footer_text || '#ffffff');
    setColorPicker('footerBorderInput', 'footerBorderPicker', a.footer_border || '#ffffff');
    // Card colors
    setColorPicker('cardBgInput', 'cardBgPicker', a.card_bg || '#ffffff');
    setColorPicker('cardBorderInput', 'cardBorderPicker', a.card_border || '#ffffff');
    setColorPicker('cardTextInput', 'cardTextPicker', a.card_text || '#ffffff');
    // Branch colors
    setColorPicker('branchBgInput', 'branchBgPicker', a.branch_bg || '#ffffff');
    setColorPicker('branchBorderInput', 'branchBorderPicker', a.branch_border || '#ffffff');
    setColorPicker('branchNameInput', 'branchNamePicker', a.branch_name || '#ffffff');
    setColorPicker('branchTextInput', 'branchTextPicker', a.branch_text || '#ffffff');
    setColorPicker('branchDetailsBgInput', 'branchDetailsBgPicker', a.branch_details_bg || '#000000');
    updateAppearancePreview();
  }
  
  // Helper: convert rgba/rgb to hex (returns #0c1727 as fallback)
  function rgbaToHex(color) {
    if (!color) return '#0c1727';
    color = String(color).trim();
    
    // If already hex, return it (expand short form if needed)
    if (color.startsWith('#')) {
      if (color.length === 4) {
        return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
      }
      return color.length === 7 ? color : '#0c1727';
    }
    
    // Parse rgb/rgba
    const match = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return '#0c1727';
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback for invalid values
    return '#0c1727';
  }
  
  // Helper: sync color picker with text input - IMPROVED VERSION
  function setupColorPickerSync(pickerId, textId) {
    const picker = document.getElementById(pickerId);
    const text = document.getElementById(textId);
    if (!picker || !text) return;
    
    // When picker changes, update text input with HEX value
    picker.addEventListener('input', () => {
      text.value = picker.value;
      updateAppearancePreview();
    });
    
    // When text input loses focus, validate and update picker if valid hex
    text.addEventListener('blur', () => {
      const hex = rgbaToHex(text.value);
      if (hex && hex !== '#000000') {
        picker.value = hex;
      }
      updateAppearancePreview();
    });
    
    // When text input changes, update preview in real-time
    text.addEventListener('input', () => {
      updateAppearancePreview();
    });
  }

  ['bgColorInput','primaryColorInput','secondaryColorInput','layoutStyleSelect','cardStyleSelect']
    .forEach(id => document.getElementById(id)?.addEventListener('input', updateAppearancePreview));

  // Setup color picker sync for all color fields
  setupColorPickerSync('headerBgPicker', 'headerBgInput');
  setupColorPickerSync('headerTextPicker', 'headerTextInput');
  setupColorPickerSync('headerTaglinePicker', 'headerTaglineInput');
  setupColorPickerSync('footerBgPicker', 'footerBgInput');
  setupColorPickerSync('footerTextPicker', 'footerTextInput');
  setupColorPickerSync('footerBorderPicker', 'footerBorderInput');
  setupColorPickerSync('cardBgPicker', 'cardBgInput');
  setupColorPickerSync('cardBorderPicker', 'cardBorderInput');
  setupColorPickerSync('cardTextPicker', 'cardTextInput');
  setupColorPickerSync('branchBgPicker', 'branchBgInput');
  setupColorPickerSync('branchBorderPicker', 'branchBorderInput');
  setupColorPickerSync('branchNamePicker', 'branchNameInput');
  setupColorPickerSync('branchTextPicker', 'branchTextInput');
  setupColorPickerSync('branchDetailsBgPicker', 'branchDetailsBgInput');

  document.getElementById('saveAppearanceBtn')?.addEventListener('click', async () => {
    setStatus('appearanceStatus', 'جاري الحفظ...');
    const payload = {
      appearance: {
        background_color: document.getElementById('bgColorInput')?.value,
        primary_color:    document.getElementById('primaryColorInput')?.value,
        secondary_color:  document.getElementById('secondaryColorInput')?.value,
        layout_style:     document.getElementById('layoutStyleSelect')?.value,
        card_style:       document.getElementById('cardStyleSelect')?.value,
        // Header colors - save the text input values (RGBA/Hex)
        header_bg:        document.getElementById('headerBgInput')?.value,
        header_text:      document.getElementById('headerTextInput')?.value,
        header_tagline:   document.getElementById('headerTaglineInput')?.value,
        // Footer colors
        footer_bg:        document.getElementById('footerBgInput')?.value,
        footer_text:      document.getElementById('footerTextInput')?.value,
        footer_border:    document.getElementById('footerBorderInput')?.value,
        // Card colors
        card_bg:          document.getElementById('cardBgInput')?.value,
        card_border:      document.getElementById('cardBorderInput')?.value,
        card_text:        document.getElementById('cardTextInput')?.value,
        // Branch colors
        branch_bg:        document.getElementById('branchBgInput')?.value,
        branch_border:    document.getElementById('branchBorderInput')?.value,
        branch_name:      document.getElementById('branchNameInput')?.value,
        branch_text:      document.getElementById('branchTextInput')?.value,
        branch_details_bg: document.getElementById('branchDetailsBgInput')?.value,
      },
      app_links: {
        android:            document.getElementById('androidInput')?.value || '',
        ios:                document.getElementById('iosInput')?.value     || '',
        app_block_position: document.getElementById('appPositionSelect')?.value || 'bottom',
      },
    };
    try {
      const res  = await apiPost(API.settings, payload);
      const data = await res.json();
      if (res.ok) { settingsState = { ...settingsState, ...data.settings }; setStatus('appearanceStatus', '✔ تم الحفظ — التغييرات مرئية الآن على الصفحة العامة'); }
      else setStatus('appearanceStatus', data.error || 'فشل الحفظ', true);
    } catch { setStatus('appearanceStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     INTEGRATIONS TAB
     ================================================================ */
  document.getElementById('saveIntegrationsBtn')?.addEventListener('click', async () => {
    setStatus('integrationsStatus', 'جاري الحفظ...');
    const payload = {
      tracking_scripts_head: document.getElementById('trackingHeadInput')?.value || '',
      tracking_scripts_body: document.getElementById('trackingBodyInput')?.value || '',
    };
    try {
      const res  = await apiPost(API.settings, payload);
      const data = await res.json();
      if (res.ok) setStatus('integrationsStatus', '✔ تم الحفظ — السكريبتات نشطة على الصفحة العامة');
      else setStatus('integrationsStatus', data.error || 'فشل الحفظ', true);
    } catch { setStatus('integrationsStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     PROFILE TAB (My Account)
     ================================================================ */
  
  // Populate profile fields on init
  function populateProfileFields(userData) {
    const usernameEl = document.getElementById('profileUsername');
    const displayNameEl = document.getElementById('profileDisplayName');
    if (usernameEl) usernameEl.value = userData.username || '';
    if (displayNameEl) displayNameEl.value = userData.display_name || '';
  }
  
  // Update profile (display name)
  document.getElementById('updateProfileBtn')?.addEventListener('click', async () => {
    const displayName = document.getElementById('profileDisplayName')?.value.trim();
    if (!displayName) { setStatus('profileStatus', 'يرجى إدخال الاسم الظاهر', true); return; }
    
    setStatus('profileStatus', 'جاري الحفظ...');
    try {
      const res = await apiPost(API.auth, { action: 'profile_update', display_name: displayName });
      const data = await res.json();
      if (res.ok) {
        setStatus('profileStatus', '✔ تم تحديث الاسم الظاهر');
        // Update header badge
        const headerUsername = document.getElementById('headerUsername');
        if (headerUsername) headerUsername.textContent = displayName;
      } else {
        setStatus('profileStatus', data.error || 'فشل التحديث', true);
      }
    } catch { setStatus('profileStatus', 'تعذر الاتصال بالخادم', true); }
  });
  
  // Change password
  document.getElementById('changePasswordBtn')?.addEventListener('click', async () => {
    const currentPassword = document.getElementById('currentPassword')?.value || '';
    const newPassword = document.getElementById('newPasswordProfile')?.value || '';
    const confirmPassword = document.getElementById('confirmPasswordProfile')?.value || '';
    
    if (!currentPassword) { setStatus('passwordStatus', 'يرجى إدخال كلمة المرور الحالية', true); return; }
    if (!newPassword) { setStatus('passwordStatus', 'يرجى إدخال كلمة المرور الجديدة', true); return; }
    if (newPassword.length < 8) { setStatus('passwordStatus', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل', true); return; }
    if (newPassword !== confirmPassword) { setStatus('passwordStatus', 'كلمتا المرور غير متطابقتين', true); return; }
    
    setStatus('passwordStatus', 'جاري التغيير...');
    try {
      const res = await apiPost(API.auth, { 
        action: 'change_password', 
        current_password: currentPassword, 
        new_password: newPassword 
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('passwordStatus', '✔ تم تغيير كلمة المرور بنجاح');
        ['currentPassword', 'newPasswordProfile', 'confirmPasswordProfile'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
      } else {
        setStatus('passwordStatus', data.error || 'فشل تغيير كلمة المرور', true);
      }
    } catch { setStatus('passwordStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     USERS MANAGEMENT (superadmin only)
     ================================================================ */
  const ROLE_LABELS = {
    superadmin: 'سوبر أدمن',
    admin:      'مدير',
    editor:     'محرر',
    viewer:     'مشاهد',
  };

  async function loadUsers() {
    const tbody = document.getElementById('usersTbody');
    if (!tbody) return;
    try {
      const res  = await apiPost(API.auth, { action: 'users_list' });
      const data = await res.json();
      if (!res.ok) { tbody.innerHTML = `<tr><td colspan="4" style="color:var(--color-danger)">${data.error}</td></tr>`; return; }

      tbody.innerHTML = '';
      (data.users || []).forEach((u) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeAttr(u.username)}</td>
          <td>${escapeAttr(u.display_name)}</td>
          <td><span class="role-badge role-badge--${u.role}">${ROLE_LABELS[u.role] || u.role}</span></td>
          <td>
            ${u.role !== 'superadmin' ? `
              <select class="admin__input" style="width:auto;padding:4px 8px;font-size:.8rem" data-uid="${escapeAttr(u.id)}" data-action="role">
                <option value="admin"  ${u.role==='admin'?'selected':''}>مدير</option>
                <option value="editor" ${u.role==='editor'?'selected':''}>محرر</option>
                <option value="viewer" ${u.role==='viewer'?'selected':''}>مشاهد</option>
              </select>
              <button class="btn btn--sm btn--ghost btn--danger" data-uid="${escapeAttr(u.id)}" data-action="delete" style="margin-right:4px">حذف</button>
            ` : '<span style="color:var(--color-text-muted);font-size:.8rem">محمي</span>'}
          </td>
        `;
        tbody.appendChild(tr);
      });

      /* Role change */
      tbody.querySelectorAll('[data-action="role"]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          const uid  = sel.dataset.uid;
          const role = sel.value;
          const res2 = await apiPost(API.auth, { action: 'users_update', id: uid, role });
          const d2   = await res2.json();
          setStatus('usersStatus', res2.ok ? '✔ تم تحديث الدور' : (d2.error || 'فشل'), !res2.ok);
          if (res2.ok) loadUsers();
        });
      });

      /* Delete user */
      tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('هل تريد حذف هذا المستخدم نهائياً؟')) return;
          const uid  = btn.dataset.uid;
          const res2 = await apiPost(API.auth, { action: 'users_delete', id: uid });
          const d2   = await res2.json();
          setStatus('usersStatus', res2.ok ? '✔ تم الحذف' : (d2.error || 'فشل'), !res2.ok);
          if (res2.ok) loadUsers();
        });
      });
    } catch { if (tbody) tbody.innerHTML = '<tr><td colspan="4">تعذر التحميل</td></tr>'; }
  }

  document.getElementById('createUserBtn')?.addEventListener('click', async () => {
    const username    = document.getElementById('newUsername')?.value.trim();
    const displayName = document.getElementById('newDisplayName')?.value.trim();
    const password    = document.getElementById('newPassword')?.value;
    const role        = document.getElementById('newRole')?.value;

    if (!username || !password) { setStatus('usersStatus', 'يرجى ملء جميع الحقول المطلوبة', true); return; }

    setStatus('usersStatus', 'جاري الإنشاء...');
    try {
      const res  = await apiPost(API.auth, { action: 'users_create', username, display_name: displayName, password, role });
      const data = await res.json();
      if (res.ok) {
        setStatus('usersStatus', `✔ تم إنشاء المستخدم "${username}"`);
        ['newUsername','newDisplayName','newPassword'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        loadUsers();
      } else { setStatus('usersStatus', data.error || 'فشل الإنشاء', true); }
    } catch { setStatus('usersStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     APPROVAL QUEUE
     ================================================================ */
  async function loadApprovals() {
    const container = document.getElementById('approvalsList');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--color-text-muted);font-size:.85rem">جاري التحميل...</p>';

    try {
      const res  = await apiPost(API.approval, { action: 'list' });
      const data = await res.json();
      const queue = (data.queue || []).filter(q => q.status === 'pending');

      if (!queue.length) { container.innerHTML = '<p style="color:var(--color-text-muted)">لا توجد تعديلات معلقة ✔</p>'; return; }

      container.innerHTML = '';
      queue.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'approval-item';
        div.innerHTML = `
          <div class="approval-item__meta">
            <span class="approval-item__resource">${item.resource === 'links' ? 'روابط' : 'إعدادات'}</span>
            أُرسل بواسطة <strong>${escapeAttr(item.submitted_by)}</strong>
            في ${new Date(item.created_at).toLocaleString('ar-SA')}
          </div>
          <details>
            <summary style="cursor:pointer;font-size:.82rem;color:var(--color-text-muted)">عرض البيانات</summary>
            <pre style="font-size:.72rem;overflow:auto;max-height:120px;direction:ltr;background:var(--color-surface-2);padding:8px;border-radius:6px;margin-top:6px">${escapeAttr(JSON.stringify(item.payload, null, 2))}</pre>
          </details>
          <div class="approval-item__actions">
            <button class="btn btn--sm btn--approve" data-id="${escapeAttr(item.id)}" data-action="approve">✔ موافقة ونشر</button>
            <button class="btn btn--sm btn--reject"  data-id="${escapeAttr(item.id)}" data-action="reject">✕ رفض</button>
          </div>
        `;

        div.querySelectorAll('button[data-action]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            const id     = btn.dataset.id;
            let note = '';
            if (action === 'reject') {
              note = prompt('سبب الرفض (اختياري):') || '';
            }
            setStatus('approvalsStatus', 'جاري المعالجة...');
            try {
              const res2  = await apiPost(API.approval, { action, id, note });
              const data2 = await res2.json();
              if (res2.ok) { setStatus('approvalsStatus', action === 'approve' ? '✔ تم النشر' : '✔ تم الرفض'); loadApprovals(); checkApprovalBar(); }
              else setStatus('approvalsStatus', data2.error || 'فشل', true);
            } catch { setStatus('approvalsStatus', 'تعذر الاتصال بالخادم', true); }
          });
        });

        container.appendChild(div);
      });
    } catch { container.innerHTML = '<p style="color:var(--color-danger)">تعذر تحميل قائمة الموافقات</p>'; }
  }

  async function checkApprovalBar() {
    const bar = document.getElementById('approvalBar');
    if (!bar) return;
    try {
      const res  = await apiPost(API.approval, { action: 'list' });
      const data = await res.json();
      const pending = (data.queue || []).filter(q => q.status === 'pending').length;
      bar.hidden = pending === 0;
      const txt = document.getElementById('approvalBarText');
      if (txt) txt.textContent = `لديك ${pending} تعديل${pending > 1 ? 'ات' : ''} بانتظار المراجعة`;
    } catch { /* silent */ }
  }

  /* Refresh approvals when tab clicked */
  document.querySelector('.admin__tab[data-tab="approvals"]')?.addEventListener('click', loadApprovals);
  document.querySelector('.admin__tab[data-tab="users"]')?.addEventListener('click', loadUsers);

  /* ================================================================
     IMPORT / EXPORT
     ================================================================ */
  document.getElementById('exportBtn')?.addEventListener('click', () => {
    const payload = {
      links:       linksState,
      settings:    settingsState,
      exported_at: new Date().toISOString(),
      version:     3,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `atoz-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('importFile')?.addEventListener('change', (e) => {
    const name = e.target.files[0]?.name || '';
    const el   = document.getElementById('importFileName');
    if (el) el.textContent = name || 'لم يتم اختيار ملف';
  });

  document.getElementById('importBtn')?.addEventListener('click', async () => {
    const file = document.getElementById('importFile')?.files[0];
    if (!file) { setStatus('importStatus', 'اختر ملفاً أولاً', true); return; }

    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch { setStatus('importStatus', 'ملف JSON غير صالح', true); return; }

    if (!Array.isArray(payload.links) || typeof payload.settings !== 'object') {
      setStatus('importStatus', 'بنية الملف غير متوافقة', true);
      return;
    }

    if (!confirm('سيتم استبدال البيانات الحالية بالكامل. هل تريد المتابعة؟')) return;

    setStatus('importStatus', 'جاري الاستيراد...');
    try {
      const [lr, sr] = await Promise.all([
        apiPost(API.links,    { links: payload.links }),
        apiPost(API.settings, payload.settings),
      ]);
      if (lr.ok && sr.ok) {
        setStatus('importStatus', '✔ تم الاستيراد — أعد تحميل الصفحة لرؤية التغييرات');
        linksState    = payload.links;
        settingsState = payload.settings;
        renderLinksEditor();
        renderBranchesEditor();
        populateAppearanceFields(settingsState.appearance);
      } else {
        setStatus('importStatus', 'حدث خطأ في أثناء الاستيراد', true);
      }
    } catch { setStatus('importStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     INIT — load all data, populate UI
     ================================================================ */
  async function init() {
    /* 1. Fetch CSRF token + current user role */
    try {
      const checkRes  = await fetch(`${API.auth}?action=check`);
      const checkData = await checkRes.json();
      csrfToken   = checkData.csrf_token || '';
      currentRole = checkData.role || 'viewer';

      /* Show role chip in header */
      const roleChip = document.getElementById('headerRole');
      if (roleChip) roleChip.textContent = ROLE_LABELS[currentRole] || currentRole;

      /* Show superadmin-only tabs */
      if (currentRole === 'superadmin') {
        document.getElementById('usersTab')?.removeAttribute('hidden');
        document.getElementById('approvalsTab')?.removeAttribute('hidden');
      }
      /* Show approvals tab for admin too */
      if (['superadmin','admin'].includes(currentRole)) {
        document.getElementById('approvalsTab')?.removeAttribute('hidden');
      }
    } catch { /* continue even if check fails */ }

    /* 2. Load links + settings in parallel */
    try {
      const [linksRes, settingsRes] = await Promise.all([
        fetch(API.links),
        fetch(API.settings),
      ]);
      const linksData = await linksRes.json();
      settingsState   = await settingsRes.json();
      linksState      = linksData.links || [];
    } catch (e) {
      console.error('[AtoZ Admin] init fetch failed:', e);
    }

    /* 3. Render all editors */
    renderLinksEditor();
    renderBranchesEditor();
    populateAppearanceFields(settingsState.appearance);

    /* 4. Populate content fields */
    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    set('storeNameInput',  settingsState.store_name);
    set('taglineInput',    settingsState.tagline);
    set('websiteUrlInput', settingsState.website_url);
    set('phoneInput',      settingsState.phone);
    set('footerTextInput', settingsState.footer_text);
    set('logoShapeSelect', settingsState.logo_shape || 'circle');

    const glowToggle = document.getElementById('logoGlowToggle');
    if (glowToggle) glowToggle.checked = settingsState.logo_glow !== false;

    const bioEditor = document.getElementById('bioEditor');
    if (bioEditor) bioEditor.innerHTML = settingsState.bio_html || '';

    if (settingsState.logo_url) {
      const prev = document.getElementById('logoPreview');
      if (prev) { prev.src = settingsState.logo_url; prev.hidden = false; }
    }

    /* 5. App links fields */
    const app = settingsState.app_links || {};
    set('androidInput',    app.android || '');
    set('iosInput',        app.ios     || '');
    set('appPositionSelect', app.app_block_position || 'bottom');

    /* 6. Tracking scripts */
    set('trackingHeadInput', settingsState.tracking_scripts_head || '');
    set('trackingBodyInput', settingsState.tracking_scripts_body || '');

    /* 7. Check approval bar (admin+) */
    if (['superadmin','admin'].includes(currentRole)) {
      checkApprovalBar();
    }
    
    /* 8. Populate profile fields */
    if (checkData.username) {
      populateProfileFields({ username: checkData.username, display_name: checkData.display_name || checkData.username });
    }
  }

  /* ================================================================
     PASSWORD TOGGLE (Show/Hide) - Universal handler
     ================================================================ */
  document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('.password-toggle');
    if (!toggleBtn) return;
    
    const wrap = toggleBtn.closest('.password-input-wrap, .login__pw-wrap');
    if (!wrap) return;
    
    const input = wrap.querySelector('input[type="password"], input[type="text"]');
    if (!input) return;
    
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    
    // Update icon
    const iconSvg = toggleBtn.querySelector('svg');
    if (iconSvg) {
      if (isPassword) {
        // Show "eye-off" icon
        iconSvg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
      } else {
        // Show "eye" icon
        iconSvg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    }
  });

  /* ================================================================
     CLEAR CACHE BUTTON - Force browser to reload all resources
     ================================================================ */
  document.getElementById('clearCacheBtn')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('clearCacheStatus');
    if (!statusEl) return;

    statusEl.textContent = 'جاري مسح الكاش...';
    statusEl.style.color = '';

    try {
      // Clear service worker cache if exists
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Clear localStorage for this domain (optional - comment out if you want to keep data)
      // localStorage.clear();

      // Force hard reload by adding timestamp to all resource URLs
      // This is done by setting a new query parameter on the page
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString());
      
      statusEl.textContent = '✔ تم مسح الكاش، جاري إعادة التحميل...';
      statusEl.style.color = 'green';
      
      // Reload after short delay to show message
      setTimeout(() => {
        window.location.reload(true);
      }, 1000);
    } catch (err) {
      console.error('[Clear Cache] Error:', err);
      statusEl.textContent = '✗ فشل مسح الكاش: ' + err.message;
      statusEl.style.color = 'red';
    }
  });

  init();
})();
