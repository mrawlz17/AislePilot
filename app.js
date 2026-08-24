(() => {
  'use strict';

  const APP_VERSION = '0.2.6';
  const STORAGE_KEY = 'grocery-companion-state-v1';
  const DEFAULT_CATEGORIES = ['Produce','Bakery','Deli','Meat','Pantry','Drinks','Dairy','Frozen','Household','Personal Care','Other'];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const todayISO = () => new Date().toISOString().slice(0,10);
  const money = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n || 0));
  const num = (value, fallback = 0) => {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function defaultState() {
    return {
      schemaVersion: 1,
      appVersion: APP_VERSION,
      activeView: 'home',
      storeProfiles: {
        Walmart: { route: [...DEFAULT_CATEGORIES] },
        "Sam's Club": { route: [...DEFAULT_CATEGORIES] }
      },
      currentTrip: null,
      history: [],
      itemLibrary: {},
      settings: { defaultStore: 'Walmart', defaultBudget: 0 }
    };
  }

  function sanitizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    const state = { ...base, ...raw };
    state.storeProfiles = { ...base.storeProfiles, ...(raw.storeProfiles || {}) };
    for (const store of ['Walmart', "Sam's Club"]) {
      const route = state.storeProfiles?.[store]?.route;
      state.storeProfiles[store] = { route: Array.isArray(route) && route.length ? [...new Set(route.map(String))] : [...DEFAULT_CATEGORIES] };
      if (!state.storeProfiles[store].route.includes('Other')) state.storeProfiles[store].route.push('Other');
    }
    state.history = Array.isArray(raw.history) ? raw.history.filter(v => v && typeof v === 'object').map(t => sanitizeTrip(t, true)) : [];
    state.itemLibrary = raw.itemLibrary && typeof raw.itemLibrary === 'object' ? raw.itemLibrary : {};
    state.settings = { ...base.settings, ...(raw.settings || {}) };
    state.currentTrip = raw.currentTrip && typeof raw.currentTrip === 'object' ? sanitizeTrip(raw.currentTrip, false) : null;
    state.appVersion = APP_VERSION;
    state.schemaVersion = 1;
    return state;
  }

  function sanitizeTrip(t, completed = false) {
    const trip = {
      id: String(t?.id || uid()),
      store: ['Walmart', "Sam's Club"].includes(t?.store) ? t.store : 'Walmart',
      date: String(t?.date || todayISO()),
      budget: Math.max(0, num(t?.budget)),
      status: completed ? 'completed' : (['planning','shopping'].includes(t?.status) ? t.status : 'planning'),
      items: Array.isArray(t?.items) ? t.items.map(sanitizeItem) : [],
      actualTotal: t?.actualTotal == null ? null : Math.max(0, num(t.actualTotal))
    };
    if (completed && t?.completedAt) trip.completedAt = String(t.completedAt);
    return trip;
  }

  function sanitizeItem(item) {
    return {
      id: String(item?.id || uid()),
      name: String(item?.name || '').trim() || 'Unnamed item',
      qty: Math.max(1, Math.round(num(item?.qty, 1))),
      unitPrice: Math.max(0, num(item?.unitPrice, 0)),
      category: String(item?.category || 'Other'),
      picked: Boolean(item?.picked)
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return sanitizeState(raw ? JSON.parse(raw) : null);
    } catch (err) {
      console.warn('State load failed; starting clean.', err);
      return defaultState();
    }
  }

  let state = loadState();
  let deferredInstallPrompt = null;

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error('State save failed.', err);
      toast('Could not save changes');
      return false;
    }
  }

  function commit(mutator, message) {
    const snapshot = JSON.stringify(state);
    try {
      mutator(state);
      if (!saveState()) throw new Error('Save failed');
      render();
      if (message) toast(message);
    } catch (err) {
      state = sanitizeState(JSON.parse(snapshot));
      console.error(err);
      toast('Change was not saved');
    }
  }

  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 1800);
  }

  function tripTotal(trip = state.currentTrip) {
    return trip ? trip.items.reduce((sum, i) => sum + (i.qty * i.unitPrice), 0) : 0;
  }
  function pickedTotal(trip = state.currentTrip) {
    return trip ? trip.items.filter(i=>i.picked).reduce((sum,i)=>sum+(i.qty*i.unitPrice),0) : 0;
  }
  function pickedCount(trip = state.currentTrip) { return trip ? trip.items.filter(i=>i.picked).length : 0; }

  function categoryOptions(store, selected) {
    const route = state.storeProfiles[store]?.route || DEFAULT_CATEGORIES;
    return route.map(c => `<option value="${escapeHtml(c)}" ${c===selected?'selected':''}>${escapeHtml(c)}</option>`).join('');
  }

  function routeIndex(store, category) {
    const route = state.storeProfiles[store]?.route || DEFAULT_CATEGORIES;
    const ix = route.indexOf(category);
    return ix < 0 ? route.length : ix;
  }

  function sortItemsForStore(items, store) {
    return [...items].sort((a,b) => {
      const c = routeIndex(store,a.category)-routeIndex(store,b.category);
      return c || a.name.localeCompare(b.name);
    });
  }

  function libraryKey(store, name) { return `${store}::${name.trim().toLowerCase()}`; }
  function suggestCategory(store, name) {
    const saved = state.itemLibrary[libraryKey(store,name)];
    if (saved?.category) return saved.category;
    const n = name.toLowerCase();
    const rules = [
      [['banana','apple','lettuce','tomato','onion','potato','avocado','berry','berries','grape','orange','fruit','vegetable'], 'Produce'],
      [['bread','bun','roll','tortilla','bagel','muffin'], 'Bakery'],
      [['chicken','beef','steak','pork','bacon','sausage','turkey','ham','meat'], 'Meat'],
      [['milk','egg','cheese','yogurt','butter','cream'], 'Dairy'],
      [['frozen','pizza','ice cream','fries','waffle'], 'Frozen'],
      [['soda','water','juice','gatorade','drink','coffee'], 'Drinks'],
      [['detergent','paper towel','toilet paper','trash bag','dish soap','cleaner','cat litter','litter'], 'Household'],
      [['shampoo','soap','toothpaste','deodorant','antiperspirant','razor','cotton swab','cold and flu','cold & flu'], 'Personal Care']
    ];
    for (const [terms, category] of rules) if (terms.some(t=>n.includes(t))) return category;
    return 'Pantry';
  }

  function setView(view) {
    state.activeView = view;
    saveState();
    render();
  }

  function render() {
    const view = state.activeView || 'home';
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view===view));
    const main = $('#main');
    const renderer = { home: renderHome, plan: renderPlan, shop: renderShop, history: renderHistory, settings: renderSettings }[view] || renderHome;
    main.innerHTML = renderer();
    bindViewEvents(view);
  }

  function renderHome() {
    const t = state.currentTrip;
    const last = state.history[0];
    return `
      <section class="card">
        <h2>${t ? 'Current trip' : 'Start your next trip'}</h2>
        ${t ? `
          <div class="grid-2">
            <div><span class="badge">${escapeHtml(t.store)}</span><div class="small muted" style="margin-top:8px">${escapeHtml(t.date)}</div></div>
            <div class="metric"><div class="label">Projected total</div><div class="value">${money(tripTotal(t))}</div></div>
          </div>
          <div class="metric-grid" style="margin-top:10px">
            <div class="metric ${tripTotal(t) <= t.budget || !t.budget ? 'good':'danger'}"><div class="label">Budget</div><div class="value">${money(t.budget)}</div></div>
            <div class="metric"><div class="label">Items</div><div class="value">${t.items.length}</div></div>
          </div>
          <div class="btn-row" style="margin-top:14px">
            <button class="btn btn-primary" data-home-action="continue">${t.status==='shopping'?'Continue shopping':'Open plan'}</button>
            <button class="btn btn-secondary" data-home-action="new">Start over</button>
          </div>
        ` : `
          <p class="muted">Build a budgeted Walmart or Sam's Club trip, then shop it in your actual store-route order.</p>
          <button class="btn btn-primary btn-block" data-home-action="new">New grocery trip</button>
        `}
      </section>

      <section class="card">
        <h2>How V1 works</h2>
        <div class="list small">
          <div>1. Set store and budget.</div>
          <div>2. Upload Walmart/Sam's cart screenshots.</div>
          <div>3. Review OCR results, categories, and prices.</div>
          <div>4. Shop in your saved store route.</div>
          <div>5. Save the completed trip to history.</div>
        </div>
      </section>

      ${last ? `<section class="card"><h2>Last completed trip</h2><div class="history-row"><div><strong>${escapeHtml(last.store)}</strong><div class="small muted">${escapeHtml(last.date)} · ${last.items.length} items</div></div><strong>${money(last.actualTotal ?? tripTotal(last))}</strong></div></section>` : ''}
    `;
  }

  function renderPlan() {
    const t = state.currentTrip;
    if (!t) return `<section class="card empty"><strong>No active trip</strong>Create a trip from Home to begin.<br><br><button class="btn btn-primary" data-plan-action="new">Start a trip</button></section>`;
    const total = tripTotal(t);
    const cushion = t.budget - total;
    const items = sortItemsForStore(t.items,t.store);
    return `
      <section class="card">
        <h2>Trip setup</h2>
        <div class="grid-2">
          <div class="field"><label>Store</label><select id="tripStore"><option ${t.store==='Walmart'?'selected':''}>Walmart</option><option ${t.store==="Sam's Club"?'selected':''}>Sam's Club</option></select></div>
          <div class="field"><label>Trip date</label><input id="tripDate" type="date" value="${escapeHtml(t.date)}"></div>
        </div>
        <div class="field"><label>Budget</label><input id="tripBudget" type="number" min="0" step="0.01" inputmode="decimal" value="${t.budget || ''}" placeholder="0.00"></div>
        <div class="metric-grid">
          <div class="metric"><div class="label">Projected</div><div class="value">${money(total)}</div></div>
          <div class="metric ${!t.budget || cushion>=0?'good':'danger'}"><div class="label">${!t.budget?'Budget status':(cushion>=0?'Budget cushion':'Over budget')}</div><div class="value">${!t.budget?'Not set':money(Math.abs(cushion))}</div></div>
        </div>
      </section>

      <section class="card">
        <h2>Add items</h2>
        <div class="btn-row">
          <label class="btn btn-primary" style="display:inline-flex;align-items:center;justify-content:center">Upload cart screenshots<input id="cartScreenshots" type="file" accept="image/*" multiple hidden></label>
          <button class="btn btn-secondary" data-plan-action="add">Add item</button>
          <button class="btn btn-secondary" data-plan-action="paste">Paste cart text</button>
        </div>
        <p class="import-note" style="margin-bottom:0">Upload one or more screenshots from the Walmart or Sam's Club cart. The app reads them, removes likely overlap duplicates, and requires a review before adding anything to your list.</p>
      </section>

      <section class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="margin:0">Items</h2><span class="badge">${t.items.length}</span></div>
        ${items.length ? `<div class="list" style="margin-top:12px">${items.map(renderPlanItem).join('')}</div>` : `<div class="empty"><strong>No items yet</strong>Upload cart screenshots, add a product, or paste cart text.</div>`}
      </section>

      <section class="card">
        <button class="btn btn-primary btn-block" data-plan-action="shop" ${t.items.length?'':'disabled'}>Start shopping</button>
      </section>
    `;
  }

  function renderPlanItem(i) {
    return `<div class="item-row" data-item-id="${i.id}"><div><div class="item-name">${escapeHtml(i.name)}</div><div class="item-meta">${i.qty} × ${money(i.unitPrice)} · ${escapeHtml(i.category)} · ${money(i.qty*i.unitPrice)}</div></div><div class="item-actions"><button class="icon-btn" type="button" data-edit-item="${i.id}" aria-label="Edit">✎</button><button class="icon-btn" type="button" data-delete-item="${i.id}" aria-label="Delete">×</button></div></div>`;
  }

  function renderShop() {
    const t = state.currentTrip;
    if (!t) return `<section class="card empty"><strong>No active trip</strong>Create a trip first.</section>`;
    if (!t.items.length) return `<section class="card empty"><strong>Your list is empty</strong>Add items in Plan before shopping.<br><br><button class="btn btn-primary" data-shop-action="plan">Go to Plan</button></section>`;
    const items = sortItemsForStore(t.items,t.store);
    const grouped = new Map();
    for (const item of items) {
      if (!grouped.has(item.category)) grouped.set(item.category, []);
      grouped.get(item.category).push(item);
    }
    const count = pickedCount(t);
    const pct = t.items.length ? Math.round((count/t.items.length)*100) : 0;
    const total = tripTotal(t);
    const remaining = total - pickedTotal(t);
    return `
      <div class="shop-progress">
        <section class="card" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><span class="badge">${escapeHtml(t.store)}</span><div class="small muted" style="margin-top:6px">${count} of ${t.items.length} items</div></div><strong>${pct}%</strong></div>
          <div class="progress-bar" style="margin-top:10px"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="metric-grid" style="margin-top:10px"><div class="metric"><div class="label">Picked up</div><div class="value">${money(pickedTotal(t))}</div></div><div class="metric"><div class="label">Remaining</div><div class="value">${money(remaining)}</div></div></div>
        </section>
      </div>
      ${[...grouped.entries()].map(([cat, catItems]) => `<div class="category-header"><span>${escapeHtml(cat)}</span><span>${catItems.filter(i=>i.picked).length}/${catItems.length}</span></div>${catItems.map(renderShopItem).join('')}`).join('')}
      <section class="card" style="margin-top:18px">
        <div class="metric-grid"><div class="metric"><div class="label">Projected checkout</div><div class="value">${money(total)}</div></div><div class="metric ${!t.budget || total<=t.budget?'good':'danger'}"><div class="label">Budget</div><div class="value">${money(t.budget)}</div></div></div>
        <button class="btn btn-primary btn-block" style="margin-top:12px" data-shop-action="finish">Finish trip</button>
        <button class="btn btn-secondary btn-block" style="margin-top:8px" data-shop-action="plan">Back to Plan</button>
      </section>
    `;
  }

  function renderShopItem(i) {
    return `<div class="shop-item ${i.picked?'picked':''}"><button class="shop-check" data-toggle-picked="${i.id}" type="button" aria-label="${i.picked?'Mark not picked':'Mark picked'}">${i.picked?'✓':''}</button><div><div class="item-name">${escapeHtml(i.name)}</div><div class="item-meta">${i.qty} × ${money(i.unitPrice)} · ${money(i.qty*i.unitPrice)}</div></div><strong>${money(i.qty*i.unitPrice)}</strong></div>`;
  }

  function renderHistory() {
    if (!state.history.length) return `<section class="card empty"><strong>No completed trips yet</strong>Your finished Walmart and Sam's Club trips will appear here.</section>`;
    return `<section class="card"><h2>Completed trips</h2>${state.history.map(t => `<div class="history-row"><div><strong>${escapeHtml(t.store)}</strong><div class="small muted">${escapeHtml(t.date)} · ${t.items.length} items · Budget ${money(t.budget)}</div></div><div style="text-align:right"><strong>${money(t.actualTotal ?? tripTotal(t))}</strong><div><button class="btn btn-secondary small" data-view-history="${t.id}" type="button">View</button></div></div></div>`).join('')}</section>`;
  }

  function renderSettings() {
    return `
      <section class="card">
        <h2>Defaults</h2>
        <div class="field"><label>Default store</label><select id="defaultStore"><option ${state.settings.defaultStore==='Walmart'?'selected':''}>Walmart</option><option ${state.settings.defaultStore==="Sam's Club"?'selected':''}>Sam's Club</option></select></div>
        <div class="field"><label>Default two-week budget</label><input id="defaultBudget" type="number" min="0" step="0.01" inputmode="decimal" value="${state.settings.defaultBudget || ''}" placeholder="0.00"></div>
      </section>
      ${['Walmart',"Sam's Club"].map(store => `<section class="card"><h2>${escapeHtml(store)} store route</h2><p class="muted small">Move categories into the order you normally walk this store.</p><div>${state.storeProfiles[store].route.map((cat,ix,arr)=>`<div class="route-row"><strong>${ix+1}. ${escapeHtml(cat)}</strong><div class="route-actions"><button data-route-store="${escapeHtml(store)}" data-route-index="${ix}" data-route-dir="up" ${ix===0?'disabled':''}>↑</button><button data-route-store="${escapeHtml(store)}" data-route-index="${ix}" data-route-dir="down" ${ix===arr.length-1?'disabled':''}>↓</button></div></div>`).join('')}</div></section>`).join('')}
      <section class="card">
        <h2>Data</h2>
        <p class="muted small">Everything is stored locally in this browser. Export a backup before clearing browser data or changing devices.</p>
        <div class="btn-row"><button class="btn btn-secondary" data-settings-action="export">Export backup</button><label class="btn btn-secondary" style="display:inline-flex;align-items:center">Import backup<input id="backupImport" type="file" accept="application/json" hidden></label><button class="btn btn-danger" data-settings-action="reset">Reset app</button></div>
        <p class="small muted" style="margin-bottom:0">Version ${APP_VERSION}</p>
      </section>
    `;
  }

  function bindViewEvents(view) {
    if (view === 'home') {
      $$('[data-home-action]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.homeAction==='new') return newTripFlow();
        if (b.dataset.homeAction==='continue') return setView(state.currentTrip?.status==='shopping'?'shop':'plan');
      }));
    }
    if (view === 'plan') {
      $('[data-plan-action="new"]')?.addEventListener('click', newTripFlow);
      $('#tripStore')?.addEventListener('change', e => commit(s => { s.currentTrip.store = e.target.value; s.currentTrip.items.forEach(i => { if (!s.storeProfiles[e.target.value].route.includes(i.category)) i.category='Other'; }); }, 'Store updated'));
      $('#tripDate')?.addEventListener('change', e => commit(s => s.currentTrip.date = e.target.value || todayISO()));
      $('#tripBudget')?.addEventListener('change', e => commit(s => s.currentTrip.budget = Math.max(0,num(e.target.value))));
      $('[data-plan-action="add"]')?.addEventListener('click', () => openItemModal());
      $('[data-plan-action="paste"]')?.addEventListener('click', openPasteImportModal);
      $('#cartScreenshots')?.addEventListener('change', handleScreenshotImport);
      $('[data-plan-action="shop"]')?.addEventListener('click', () => commit(s => { s.currentTrip.status='shopping'; s.activeView='shop'; }));
      $$('[data-edit-item]').forEach(b => b.addEventListener('click', () => openItemModal(b.dataset.editItem)));
      $$('[data-delete-item]').forEach(b => b.addEventListener('click', () => deleteItem(b.dataset.deleteItem)));
    }
    if (view === 'shop') {
      $$('[data-toggle-picked]').forEach(b => b.addEventListener('click', () => commit(s => {
        const item=s.currentTrip.items.find(i=>i.id===b.dataset.togglePicked); if(item) item.picked=!item.picked;
      })));
      $('[data-shop-action="plan"]')?.addEventListener('click', () => commit(s => { s.currentTrip.status='planning'; s.activeView='plan'; }));
      $('[data-shop-action="finish"]')?.addEventListener('click', openFinishModal);
    }
    if (view === 'history') {
      $$('[data-view-history]').forEach(b => b.addEventListener('click', () => openHistoryModal(b.dataset.viewHistory)));
    }
    if (view === 'settings') {
      $('#defaultStore')?.addEventListener('change', e => commit(s => s.settings.defaultStore=e.target.value));
      $('#defaultBudget')?.addEventListener('change', e => commit(s => s.settings.defaultBudget=Math.max(0,num(e.target.value))));
      $$('[data-route-dir]').forEach(b => b.addEventListener('click', () => moveRoute(b.dataset.routeStore, Number(b.dataset.routeIndex), b.dataset.routeDir)));
      $('[data-settings-action="export"]')?.addEventListener('click', exportBackup);
      $('[data-settings-action="reset"]')?.addEventListener('click', resetApp);
      $('#backupImport')?.addEventListener('change', importBackup);
    }
  }

  function newTripFlow() {
    if (state.currentTrip && !confirm('Replace the current trip? The existing active trip will be discarded.')) return;
    commit(s => {
      s.currentTrip = { id: uid(), store: s.settings.defaultStore || 'Walmart', date: todayISO(), budget: num(s.settings.defaultBudget), status:'planning', items:[], actualTotal:null };
      s.activeView='plan';
    }, 'New trip started');
  }

  function openModal(title, bodyHtml, onReady) {
    const tpl = $('#modalTemplate').content.cloneNode(true);
    const backdrop = tpl.querySelector('.modal-backdrop');
    tpl.querySelector('#modalTitle').textContent = title;
    tpl.querySelector('#modalBody').innerHTML = bodyHtml;
    document.body.appendChild(tpl);
    const live = document.body.lastElementChild;
    live.addEventListener('click', e => {
      if (e.target.matches('[data-close-modal]')) live.remove();
    });
    onReady?.(live);
    return live;
  }

  function openItemModal(itemId) {
    const t = state.currentTrip;
    if (!t) return;
    const existing = itemId ? t.items.find(i=>i.id===itemId) : null;
    const modal = openModal(existing?'Edit item':'Add item', `
      <div class="field"><label>Item name</label><input id="itemName" value="${escapeHtml(existing?.name || '')}" autocomplete="off"></div>
      <div class="grid-2"><div class="field"><label>Quantity</label><input id="itemQty" type="number" min="1" step="1" inputmode="numeric" value="${existing?.qty || 1}"></div><div class="field"><label>Unit price</label><input id="itemPrice" type="number" min="0" step="0.01" inputmode="decimal" value="${existing?.unitPrice ?? ''}" placeholder="0.00"></div></div>
      <div class="field"><label>Category</label><select id="itemCategory">${categoryOptions(t.store, existing?.category || 'Other')}</select></div>
      <button class="btn btn-primary btn-block" id="saveItem">Save item</button>
    `, root => {
      const nameEl = $('#itemName',root); const catEl=$('#itemCategory',root);
      if (!existing) nameEl.addEventListener('blur', () => { if(nameEl.value.trim()) catEl.value=suggestCategory(t.store,nameEl.value.trim()); });
      $('#saveItem',root).addEventListener('click', () => {
        const name=nameEl.value.trim(); if(!name) return toast('Enter an item name');
        const qty=Math.max(1,Math.round(num($('#itemQty',root).value,1)));
        const unitPrice=Math.max(0,num($('#itemPrice',root).value));
        const category=catEl.value;
        commit(s => {
          if (existing) {
            const i=s.currentTrip.items.find(x=>x.id===existing.id); Object.assign(i,{name,qty,unitPrice,category});
          } else s.currentTrip.items.push({id:uid(),name,qty,unitPrice,category,picked:false});
          s.itemLibrary[libraryKey(s.currentTrip.store,name)]={category,lastPrice:unitPrice};
        }, existing?'Item updated':'Item added');
        root.remove();
      });
      setTimeout(()=>nameEl.focus(),50);
    });
    return modal;
  }

  function deleteItem(id) {
    const item=state.currentTrip?.items.find(i=>i.id===id); if(!item) return;
    if (!confirm(`Delete “${item.name}”?`)) return;
    commit(s => s.currentTrip.items = s.currentTrip.items.filter(i=>i.id!==id), 'Item deleted');
  }

  function normalizeOcrLine(line) {
    return String(line || '')
      .replace(/[|]/g, 'I')
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isOcrNoise(line) {
    const l=String(line||'').toLowerCase().trim();
    if (!/[a-z]/i.test(l)) return true;
    const phrases=[
      'subtotal','estimated total','order total','checkout','tax','savings','you saved','cart summary',
      'pickup','delivery','shipping','remove','save for later','move to','options','substitution','substitutions',
      'current price','original price','price when purchased online','price per unit','each','in stock','out of stock',
      'sold and shipped','fulfilled by','sponsored','add to list','add to cart','continue shopping','search walmart',
      'search sam','membership','free shipping','protection plan','walmart cash','reorder','buy now','items shopped',
      'add/edit pickup person','request cancellation','add to calendar','need more help'
    ];
    if (phrases.some(p=>l===p || l.startsWith(p+' ') || l.includes(' '+p+' '))) return true;
    if (/^(?:multipack quantity|qty\b|quantity\b|flavor:|total count:|product line:|18\+\b)/i.test(l)) return true;
    if (/\bfrom savings\b/i.test(l)) return true;
    if (/\d+(?:\.\d+)?\s*¢\s*\//i.test(l)) return true;
    if (/^\$?\s*\d+(?:[.,]\d+)?\s*\/\s*(?:fl\s*)?(?:oz|lb|ea)\b/i.test(l)) return true;
    if (/^\$?\s*\d+(?:[.,]\d+)?\s*(?:ea|each)\b/i.test(l)) return true;
    return false;
  }

  function extractPrice(line) {
    const raw=String(line).trim();
    const dollarLike=raw.match(/\$\s*([0-9]{1,3})\s*[.,]\s*([0-9]{2})\b/);
    if (dollarLike) return num(`${dollarLike[1]}.${dollarLike[2]}`,0);
    const sLike=raw.match(/^S\s*([0-9]{1,3})\s*[.,]\s*([0-9]{2})\b/i);
    if (sLike) return num(`${sLike[1]}.${sLike[2]}`,0);
    const exact=raw.match(/^\s*([0-9]{1,3})\s*[.,]\s*([0-9]{2})\s*$/);
    return exact ? num(`${exact[1]}.${exact[2]}`,0) : null;
  }

  function extractScreenPrice(line) {
    const raw=String(line||'');
    const matches=[...raw.matchAll(/\$\s*([0-9]{1,3})\s*(?:[.,]|\s)\s*([0-9]{2})(?!\d)/g)];
    if (!matches.length) return null;
    const m=matches[matches.length-1];
    const value=num(`${m[1]}.${m[2]}`,NaN);
    return Number.isFinite(value) ? {value,match:m[0]} : null;
  }

  function normalizeItemIdentity(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }

  function flattenOcrBlocks(blocks) {
    const lines=[];
    for (const block of (blocks||[])) {
      for (const paragraph of (block?.paragraphs||[])) {
        for (const line of (paragraph?.lines||[])) {
          const text=normalizeOcrLine(line?.text||'');
          if (!text) continue;
          const b=line?.bbox||{};
          const words=line?.words||[];
          const wordData=words.map(w=>{
            const wb=w?.bbox||{};
            return {text:normalizeOcrLine(w?.text||''),confidence:num(w?.confidence,0),x0:num(wb.x0,0),y0:num(wb.y0,0),x1:num(wb.x1,0),y1:num(wb.y1,0)};
          });
          const confidences=wordData.map(w=>w.confidence).filter(v=>v>=0);
          lines.push({
            text,
            x0:num(b.x0,0), y0:num(b.y0,0), x1:num(b.x1,0), y1:num(b.y1,0),
            confidence:confidences.length ? confidences.reduce((a,b)=>a+b,0)/confidences.length : 0,
            words:wordData
          });
        }
      }
    }
    return lines.sort((a,b)=>(a.y0-b.y0)||(a.x0-b.x0));
  }

  function lineCenterY(line) {
    return (num(line?.y0,0)+num(line?.y1,0))/2;
  }

  function stripScreenPrice(text) {
    return normalizeOcrLine(String(text||'')
      .replace(/\$\s*[0-9]{1,3}\s*(?:[.,]|\s)\s*[0-9]{2}(?:\s*(?:ea|each))?/ig,' ')
      .replace(/\s*\$.*$/,' ')
      .replace(/^[•·\-–—=°*\s]+|[•·\-–—=°*\s]+$/g,' '));
  }

  function tokenSimilarity(a,b) {
    const aa=normalizeItemIdentity(a).split(' ').filter(Boolean);
    const bb=normalizeItemIdentity(b).split(' ').filter(Boolean);
    if (!aa.length || !bb.length) return 0;
    const A=new Set(aa), B=new Set(bb);
    let intersection=0;
    for (const token of A) if (B.has(token)) intersection++;
    const union=new Set([...A,...B]).size;
    return union ? intersection/union : 0;
  }

  function dedupeScreenshotItems(items) {
    const out=[];
    for (const item of items) {
      const total=Math.round(item.unitPrice*item.qty*100)/100;
      let matchIndex=-1;
      for (let i=0;i<out.length;i++) {
        const existing=out[i];
        const existingTotal=Math.round(existing.unitPrice*existing.qty*100)/100;
        if (Math.abs(existingTotal-total)>0.03) continue;
        const a=normalizeItemIdentity(existing.name), b=normalizeItemIdentity(item.name);
        const similar=(a.length>12 && b.length>12 && (a.includes(b)||b.includes(a))) || tokenSimilarity(a,b)>=0.72;
        if (similar) { matchIndex=i; break; }
      }
      if (matchIndex<0) {
        out.push({...item});
        continue;
      }
      const current=out[matchIndex];
      const currentScore=(current._qtyDetected?3:0)+Math.min(current.name.length,120)/120;
      const incomingScore=(item._qtyDetected?3:0)+Math.min(item.name.length,120)/120;
      if (incomingScore>currentScore) out[matchIndex]={...item};
      else if (item.name.length>current.name.length) {
        current.name=item.name;
        current.category=suggestCategory(state.currentTrip?.store||'Walmart',item.name);
      }
    }
    return out.map(({_qtyDetected,...item})=>item);
  }

  function screenshotPriceCandidates(lines,width,source) {
    const out=[];
    for (const line of (lines||[])) {
      const cy=lineCenterY(line);
      if (cy<320) continue;
      const parsed=extractScreenPrice(line.text);
      if (!parsed || parsed.value<=0 || parsed.value>200) continue;
      if (num(line.x1,0)<width*0.80) continue;
      const priceWords=(line.words||[]).filter(w=>num(w.x1,0)>=width*0.80 && /[0-9$]/.test(w.text||''));
      const priceConfidence=priceWords.length ? priceWords.reduce((sum,w)=>sum+num(w.confidence,0),0)/priceWords.length : num(line.confidence,0);
      out.push({...line,price:parsed.value,priceConfidence,source});
    }
    return out;
  }

  function parseScreenshotLayout(fullLines, priceLines, width, height, store) {
    if (!width || !height) return [];
    const candidates=[
      ...screenshotPriceCandidates(fullLines,width,'full'),
      ...screenshotPriceCandidates(priceLines,width,'price')
    ].sort((a,b)=>lineCenterY(a)-lineCenterY(b));

    const groups=[];
    for (const candidate of candidates) {
      const cy=lineCenterY(candidate);
      const last=groups[groups.length-1];
      if (!last || cy-lineCenterY(last[last.length-1])>125) groups.push([candidate]);
      else last.push(candidate);
    }

    const mainPrices=groups.map(group=>{
      const minY=Math.min(...group.map(lineCenterY));
      const topBand=group.filter(c=>lineCenterY(c)<=minY+24);
      topBand.sort((a,b)=>{
        const confidenceDelta=num(b.priceConfidence,0)-num(a.priceConfidence,0);
        if (Math.abs(confidenceDelta)>4) return confidenceDelta;
        const sourceDelta=(b.source==='price'?1:0)-(a.source==='price'?1:0);
        if (sourceDelta) return sourceDelta;
        return confidenceDelta;
      });
      return topBand[0];
    }).sort((a,b)=>lineCenterY(a)-lineCenterY(b));

    const found=[];
    for (let ix=0;ix<mainPrices.length;ix++) {
      const priceLine=mainPrices[ix];
      const py=lineCenterY(priceLine);
      const nextY=ix+1<mainPrices.length ? lineCenterY(mainPrices[ix+1]) : height+400;

      const collectName=(windowSize)=>{
        const parts=[];
        for (const line of fullLines) {
          const cy=lineCenterY(line);
          if (cy<py-windowSize || cy>py+windowSize) continue;
          if (num(line.x1,0)<width*0.22 || num(line.x0,0)>width*0.88) continue;
          let text=stripScreenPrice(line.text);
          if (!text || isOcrNoise(text)) continue;
          if (num(line.confidence,0)<65) continue;
          if (/\b(?:order|items shopped)\b/i.test(text)) continue;
          if ((text.match(/[a-z]/gi)||[]).length<3) continue;
          if (text.length>180) continue;
          parts.push({cy,text});
        }
        const unique=[];
        const seen=new Set();
        for (const part of parts.sort((a,b)=>a.cy-b.cy)) {
          const key=part.text.toLowerCase();
          if (!seen.has(key)) { seen.add(key); unique.push(part.text); }
        }
        return normalizeOcrLine(unique.join(' '));
      };

      let name=collectName(82);
      if (!name || name.length<5) name=collectName(120);
      name=name.replace(/^[•·\-–—=°*\s]+|[•·\-–—=°*\s]+$/g,'').trim();
      if (!name || isOcrNoise(name)) continue;

      const regionEnd=Math.min(py+460,(py+nextY)/2+110);
      let qty=1, qtyDetected=false;
      for (const line of fullLines) {
        const cy=lineCenterY(line);
        if (cy<py-35 || cy>regionEnd) continue;
        if (/multipack\s+quantity/i.test(line.text)) continue;
        const qtyMatch=line.text.match(/(?:^|[^a-z])qty\s*[:x-]?\s*(\d{1,2})\b/i);
        if (qtyMatch) {
          qty=Math.max(1,Math.min(99,Math.round(num(qtyMatch[1],1))));
          qtyDetected=true;
          break;
        }
      }

      let unitPrice=null;
      if (qty>1) {
        for (const line of [...priceLines,...fullLines]) {
          const cy=lineCenterY(line);
          if (cy<py || cy>Math.min(py+185,regionEnd) || num(line.x1,0)<width*0.80) continue;
          const each=line.text.match(/\$\s*([0-9]{1,3})\s*[.,]\s*([0-9]{2})\s*(?:ea|each)\b/i);
          if (!each) continue;
          const value=num(`${each[1]}.${each[2]}`,0);
          if (value>0 && Math.abs(value*qty-priceLine.price)<=0.06) { unitPrice=value; break; }
        }
      }
      if (unitPrice==null) unitPrice=Math.round((priceLine.price/qty)*100)/100;

      if (!Number.isFinite(unitPrice) || unitPrice<=0 || unitPrice>200) continue;
      found.push({
        id:uid(),name,qty,unitPrice,
        category:suggestCategory(store,name),picked:false,_qtyDetected:qtyDetected
      });
    }
    return found;
  }

  function parseScreenshotText(text, store) {
    // Conservative fallback for browsers where structured OCR blocks are unavailable.
    // Requires an explicit dollar-and-cents price and never accepts whole numbers as prices.
    const lines=String(text||'').split(/\r?\n/).map(normalizeOcrLine).filter(Boolean);
    const found=[];
    for (let i=0;i<lines.length;i++) {
      const price=extractPrice(lines[i]);
      if (price==null || price<=0 || price>200 || isOcrNoise(lines[i])) continue;
      let name='';
      for (let j=i-1;j>=0 && j>=i-3;j--) {
        const line=stripScreenPrice(lines[j]);
        if (!line || isOcrNoise(line) || /(?:^|[^a-z])qty\s*\d+/i.test(line)) continue;
        if ((line.match(/[a-z]/gi)||[]).length<4) continue;
        name=line;
        break;
      }
      if (!name) continue;
      found.push({id:uid(),name,qty:1,unitPrice:price,category:suggestCategory(store,name),picked:false});
    }
    return dedupeScreenshotItems(found);
  }

  function loadImageFile(file) {
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file);
      const img=new Image();
      img.onload=()=>{ URL.revokeObjectURL(url); resolve(img); };
      img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error('Could not open screenshot')); };
      img.src=url;
    });
  }

  function createPriceColumnCanvas(img) {
    const width=img.naturalWidth||img.width;
    const height=img.naturalHeight||img.height;
    const left=Math.floor(width*0.78);
    const top=Math.min(300,Math.floor(height*0.12));
    const cropWidth=Math.max(1,width-left);
    const cropHeight=Math.max(1,height-top);
    const scale=2.5;
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(cropWidth*scale));
    canvas.height=Math.max(1,Math.round(cropHeight*scale));
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,left,top,cropWidth,cropHeight,0,0,canvas.width,canvas.height);
    return {canvas,left,top,scale};
  }

  function mapCropLinesToImage(lines,crop) {
    return (lines||[]).map(line=>({
      ...line,
      x0:crop.left+line.x0/crop.scale,
      x1:crop.left+line.x1/crop.scale,
      y0:crop.top+line.y0/crop.scale,
      y1:crop.top+line.y1/crop.scale,
      words:(line.words||[]).map(w=>({
        ...w,
        x0:crop.left+w.x0/crop.scale, x1:crop.left+w.x1/crop.scale,
        y0:crop.top+w.y0/crop.scale, y1:crop.top+w.y1/crop.scale
      }))
    }));
  }

  const OCR_CACHE = 'grocery-ocr-v0.2.6';
  const OCR_FILES = [
    {
      key:'api', label:'Tesseract API', local:'./ocr/tesseract.min.js', minBytes:50000,
      type:'application/javascript; charset=utf-8',
      remotes:[
        {label:'GitHub raw',url:'https://raw.githubusercontent.com/ShinobuMiya/x-auto-translator/92d5b33975e3759c84b3b593948ca273ab9709f0/tesseract.min.js'},
        {label:'jsDelivr',url:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js'},
        {label:'unpkg',url:'https://unpkg.com/tesseract.js@7.0.0/dist/tesseract.min.js'}
      ]
    },
    {
      key:'worker', label:'OCR worker', local:'./ocr/worker.min.js', minBytes:70000,
      type:'application/javascript; charset=utf-8',
      remotes:[
        {label:'GitHub raw',url:'https://raw.githubusercontent.com/ShinobuMiya/x-auto-translator/92d5b33975e3759c84b3b593948ca273ab9709f0/worker.min.js'},
        {label:'jsDelivr',url:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js'},
        {label:'unpkg',url:'https://unpkg.com/tesseract.js@7.0.0/dist/worker.min.js'}
      ]
    },
    {
      key:'core-basic', label:'OCR core (compatibility LSTM)', local:'./ocr/tesseract-core-lstm.wasm.js', minBytes:2500000,
      type:'application/javascript; charset=utf-8',
      remotes:[
        {label:'GitHub raw',url:'https://raw.githubusercontent.com/naptha/tesseract.js-core/v7.0.0/tesseract-core-lstm.wasm.js'},
        {label:'jsDelivr',url:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-lstm.wasm.js'}
      ]
    }
  ];

  function appAssetUrl(relativePath) {
    return new URL(relativePath, document.baseURI).href;
  }

  async function fetchWithTimeout(url, timeoutMs=90000) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await fetch(url,{mode:'cors',cache:'no-store',signal:controller.signal});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch(err) {
      if(err?.name==='AbortError') throw new Error('download timed out');
      throw err;
    } finally { clearTimeout(timer); }
  }

  function getServiceWorkerVersion(controller,timeoutMs=1800) {
    return new Promise(resolve=>{
      if(!controller) return resolve('');
      const channel=new MessageChannel();
      let done=false;
      const finish=value=>{ if(done) return; done=true; clearTimeout(timer); resolve(value||''); };
      const timer=setTimeout(()=>finish(''),timeoutMs);
      channel.port1.onmessage=e=>finish(e.data?.version||'');
      try { controller.postMessage({type:'GET_VERSION'},[channel.port2]); }
      catch { finish(''); }
    });
  }

  async function ensureOcrServiceWorker(onAttempt) {
    if(!('serviceWorker' in navigator)) throw new Error('Safari does not expose service-worker support on this page');
    onAttempt?.('Activating Grocery Companion OCR storage…');
    const registration=await navigator.serviceWorker.register('./sw.js');
    try { await registration.update(); } catch {}
    await navigator.serviceWorker.ready;

    let controller=navigator.serviceWorker.controller;
    let version=await getServiceWorkerVersion(controller);
    if(version==='0.2.6') return registration;

    try { registration.waiting?.postMessage({type:'SKIP_WAITING'}); } catch {}
    await new Promise(resolve=>{
      let finished=false;
      const finish=()=>{ if(finished) return; finished=true; clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange',finish); resolve(); };
      const timer=setTimeout(finish,7000);
      navigator.serviceWorker.addEventListener('controllerchange',finish,{once:true});
    });
    controller=navigator.serviceWorker.controller;
    version=await getServiceWorkerVersion(controller);
    if(version!=='0.2.6') throw new Error(`OCR service worker ${version||'unknown'} is controlling the page; v0.2.6 is required. Reload once and retry.`);
    return registration;
  }

  async function cacheOcrFile(file,onAttempt) {
    const localUrl=appAssetUrl(file.local);
    const request=new Request(localUrl,{method:'GET'});
    const cache=await caches.open(OCR_CACHE);
    const existing=await cache.match(request);
    if(existing) {
      const size=Number(existing.headers.get('X-Grocery-OCR-Bytes')||0);
      if(size>=file.minBytes) return {file,bytes:size,cached:true};
      await cache.delete(request);
    }

    const failures=[];
    for(const remote of file.remotes) {
      try {
        onAttempt?.(`Downloading ${file.label} from ${remote.label}…`);
        const response=await fetchWithTimeout(remote.url,90000);
        const body=await response.arrayBuffer();
        if(body.byteLength<file.minBytes) throw new Error(`only ${body.byteLength.toLocaleString()} bytes received`);
        await cache.put(request,new Response(body,{
          status:200,
          headers:{
            'Content-Type':file.type,
            'Cache-Control':'public, max-age=31536000, immutable',
            'X-Grocery-OCR-Bytes':String(body.byteLength),
            'X-Grocery-OCR-Source':remote.label
          }
        }));
        return {file,bytes:body.byteLength,cached:false,source:remote.label};
      } catch(err) {
        failures.push(`${remote.label}: ${String(err?.message||err||'failed')}`);
      }
    }
    throw new Error(`${file.label} could not be downloaded (${failures.join(' | ')})`);
  }

  async function verifyLocalOcrFile(relativePath,minBytes) {
    const response=await fetch(appAssetUrl(relativePath),{cache:'no-store'});
    if(!response.ok) throw new Error(`${relativePath} returned HTTP ${response.status}`);
    const body=await response.arrayBuffer();
    if(body.byteLength<minBytes) throw new Error(`${relativePath} returned only ${body.byteLength.toLocaleString()} bytes`);
    return body.byteLength;
  }

  function loadSameOriginScript(relativePath,timeoutMs=15000) {
    return new Promise((resolve,reject)=>{
      if(window.Tesseract?.createWorker) return resolve();
      document.querySelectorAll('script[data-local-ocr-api]').forEach(el=>el.remove());
      const script=document.createElement('script');
      let settled=false;
      const finish=(ok,err)=>{
        if(settled) return; settled=true; clearTimeout(timer);
        script.onload=null; script.onerror=null;
        ok ? resolve() : reject(err||new Error('local OCR script did not load'));
      };
      const timer=setTimeout(()=>finish(false,new Error('local OCR API timed out')),timeoutMs);
      script.async=true;
      script.dataset.localOcrApi='true';
      script.onload=()=>finish(!!window.Tesseract?.createWorker,new Error('local OCR API loaded but Tesseract.createWorker was missing'));
      script.onerror=()=>finish(false,new Error('Safari could not execute the same-origin OCR API script'));
      script.src=appAssetUrl(relativePath);
      document.head.appendChild(script);
    });
  }

  async function ensureTesseract(onAttempt) {
    if(window.Tesseract?.createWorker) return window.Tesseract;
    await ensureOcrServiceWorker(onAttempt);
    if(!('caches' in window)) throw new Error('Safari Cache Storage is unavailable');

    const api=OCR_FILES.find(f=>f.key==='api');
    await cacheOcrFile(api,onAttempt);
    onAttempt?.('Verifying local OCR API…');
    await verifyLocalOcrFile(api.local,api.minBytes);
    onAttempt?.('Starting same-origin OCR API…');
    await loadSameOriginScript(api.local);
    if(!window.Tesseract?.createWorker) throw new Error('Tesseract API did not initialize');
    return window.Tesseract;
  }

  async function prepareLocalOcrRuntime(onAttempt) {
    await ensureOcrServiceWorker(onAttempt);
    const runtimeFiles=OCR_FILES.filter(f=>f.key!=='api');
    for(const file of runtimeFiles) await cacheOcrFile(file,onAttempt);
    onAttempt?.('Verifying cached OCR runtime…');
    for(const file of runtimeFiles) {
      const cache=await caches.open(OCR_CACHE);
      const response=await cache.match(new Request(appAssetUrl(file.local),{method:'GET'}));
      if(!response) throw new Error(`${file.label} is missing from local OCR storage`);
      const body=await response.clone().arrayBuffer();
      if(body.byteLength<file.minBytes) throw new Error(`${file.label} is incomplete (${body.byteLength.toLocaleString()} bytes)`);
    }
  }

  async function cachedOcrText(key) {
    const file=OCR_FILES.find(f=>f.key===key);
    if(!file) throw new Error(`Unknown OCR asset: ${key}`);
    const cache=await caches.open(OCR_CACHE);
    const response=await cache.match(new Request(appAssetUrl(file.local),{method:'GET'}));
    if(!response) throw new Error(`${file.label} is missing from local OCR storage`);
    const text=await response.text();
    if(text.length<file.minBytes*0.8) throw new Error(`${file.label} did not contain the expected script data`);
    return text;
  }

  async function createOcrWorker(Tesseract,onAttempt,onLog) {
    await prepareLocalOcrRuntime(onAttempt);
    let worker=null;
    let workerBlobUrl='';
    let coreBlobUrl='';
    try {
      // Safari was failing while constructing/importing a Worker from our
      // service-worker-backed pseudo-files. Load the already-downloaded code
      // into memory and create real blob-backed scripts instead. No worker or
      // core request needs to cross a CDN or service-worker boundary.
      onAttempt?.('Preparing iPhone-compatible OCR worker…');
      const [workerCode,coreCode]=await Promise.all([
        cachedOcrText('worker'),
        cachedOcrText('core-basic')
      ]);
      workerBlobUrl=URL.createObjectURL(new Blob([workerCode],{type:'application/javascript'}));
      coreBlobUrl=URL.createObjectURL(new Blob([coreCode],{type:'application/javascript'}));

      onAttempt?.('Starting in-memory OCR worker…');
      worker=await Tesseract.createWorker('eng',1,{
        workerPath:workerBlobUrl,
        // Tesseract checks whether corePath ends in "js". A fragment keeps the
        // Blob URL intact while making it a specific script path, preventing
        // Tesseract from appending a core filename to the Blob URL.
        corePath:`${coreBlobUrl}#core.js`,
        langPath:'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main',
        gzip:false,
        workerBlobURL:false,
        logger:m=>onLog?.(m),
        errorHandler:err=>console.error('OCR worker error',err)
      });
      return {
        worker,
        source:{label:'in-memory Safari compatibility OCR'},
        cleanup:()=>{
          if(workerBlobUrl) URL.revokeObjectURL(workerBlobUrl);
          if(coreBlobUrl) URL.revokeObjectURL(coreBlobUrl);
        }
      };
    } catch(err) {
      try { await worker?.terminate?.(); } catch {}
      if(workerBlobUrl) URL.revokeObjectURL(workerBlobUrl);
      if(coreBlobUrl) URL.revokeObjectURL(coreBlobUrl);
      throw new Error(`In-memory OCR worker could not start: ${String(err?.message||err||'unknown error')}`);
    }
  }

  function compactOcrError(err) {
    const raw=String(err?.message || err || 'Unknown OCR error').replace(/\s+/g,' ').trim();
    return raw.length>180 ? `${raw.slice(0,177)}…` : raw;
  }

  async function handleScreenshotImport(e) {
    const input=e.target;
    const files=[...(input.files||[])].filter(f=>f.type.startsWith('image/'));
    input.value='';
    if (!files.length) return;
    if (files.length>12) return toast('Choose 12 screenshots or fewer');
    const t=state.currentTrip; if(!t) return;

    const modal=openModal('Reading cart screenshots', `
      <p class="small muted">Processing ${files.length} screenshot${files.length===1?'':'s'} on this device. The first OCR run needs an internet connection to load the recognition engine.</p>
      <div class="ocr-status"><strong id="ocrStage">Preparing OCR…</strong><div class="progress-bar" style="margin-top:10px"><div class="progress-fill" id="ocrProgress" style="width:2%"></div></div><div class="small muted" id="ocrDetail" style="margin-top:8px">Using the product layout and the price column separately for a more reliable import.</div></div>
    `);
    const stage=$('#ocrStage',modal), bar=$('#ocrProgress',modal), detail=$('#ocrDetail',modal);
    const safeText=(el,text)=>{ if(el?.isConnected) el.textContent=text; };
    const safeWidth=(el,pct)=>{ if(el?.isConnected) el.style.width=`${clamp(pct,2,100)}%`; };

    let worker=null;
    let workerCleanup=null;
    let diagnosticStage='Preparing OCR';
    const reportStage=msg=>{ diagnosticStage=String(msg||diagnosticStage); safeText(detail,diagnosticStage); };
    try {
      safeText(stage,'Loading OCR engine…');
      const Tesseract=await ensureTesseract(reportStage);
      const workerResult=await createOcrWorker(
        Tesseract,
        reportStage,
        m=>{ if (m.status && m.status!=='recognizing text') safeText(detail,m.status); }
      );
      worker=workerResult.worker;
      workerCleanup=workerResult.cleanup||null;
      safeText(detail,`OCR engine ready (${workerResult.source.label}).`);

      const allItems=[];
      const fallbackText=[];
      for (let ix=0;ix<files.length;ix++) {
        safeText(stage,`Reading screenshot ${ix+1} of ${files.length}`);
        safeText(detail,`${files[ix].name || `Screenshot ${ix+1}`} · product layout`);
        safeWidth(bar,(ix/files.length)*88+5);

        const img=await loadImageFile(files[ix]);
        const width=img.naturalWidth||img.width;
        const height=img.naturalHeight||img.height;

        try {
          await worker.setParameters({tessedit_pageseg_mode:Tesseract.PSM?.AUTO || '3'});
        } catch {}
        const fullResult=await worker.recognize(img, {}, {text:true,blocks:true});
        const fullLines=flattenOcrBlocks(fullResult?.data?.blocks);
        fallbackText.push(fullResult?.data?.text||'');

        safeText(detail,`${files[ix].name || `Screenshot ${ix+1}`} · verifying prices`);
        safeWidth(bar,(ix/files.length)*88+13);
        const crop=createPriceColumnCanvas(img);
        try {
          await worker.setParameters({
            tessedit_pageseg_mode:Tesseract.PSM?.SINGLE_BLOCK || '6',
            preserve_interword_spaces:'1'
          });
        } catch {}
        const priceResult=await worker.recognize(crop.canvas, {}, {text:true,blocks:true});
        const priceLines=mapCropLinesToImage(flattenOcrBlocks(priceResult?.data?.blocks),crop);

        let parsed=[];
        if (fullLines.length) parsed=parseScreenshotLayout(fullLines,priceLines,width,height,t.store);
        if (!parsed.length) parsed=parseScreenshotText(fullResult?.data?.text||'',t.store);
        allItems.push(...parsed);
      }

      safeText(stage,'Building grocery list…'); safeWidth(bar,96);
      let items=dedupeScreenshotItems(allItems);
      if (!items.length && fallbackText.length) items=parseScreenshotText(fallbackText.join('\n'),t.store);

      if (modal?.isConnected) modal.remove();
      if (!items.length) {
        openModal('No products recognized', `
          <p>I could read the screenshot text, but I could not confidently pair product names with current prices.</p>
          <p class="small muted">Try screenshots that show the product name and current price together. You can also use Paste cart text as a fallback.</p>
          <button class="btn btn-primary btn-block" id="ocrFallbackPaste">Open paste importer</button>
        `, root => $('#ocrFallbackPaste',root).addEventListener('click',()=>{root.remove();openPasteImportModal();}));
        return;
      }
      openImportReview(items, {source:'screenshots'});
    } catch (err) {
      console.error('Screenshot OCR failed',err);
      if (modal?.isConnected) modal.remove();
      const detailMessage=compactOcrError(err);
      openModal('Screenshot import unavailable', `
        <p>The OCR engine could not complete this import.</p>
        <p class="small muted">The app could not stage or start its local OCR files. Your current trip and grocery list were not changed.</p>
        <div class="info-box"><strong>Diagnostic</strong><div class="small" style="margin-top:6px;word-break:break-word"><strong>Stage:</strong> ${escapeHtml(diagnosticStage)}<br><strong>Error:</strong> ${escapeHtml(detailMessage)}</div></div>
        <p class="small muted" style="margin-bottom:0">If this appears again, send a screenshot of this diagnostic. It identifies whether iPhone Safari blocked the OCR library, worker, language data, or WebAssembly core.</p>
      `);
    } finally {
      try { if(worker) await worker.terminate(); } catch {}
      try { workerCleanup?.(); } catch {}
    }
  }

  function parseCartText(text, store) {
    // Reliability-first parser: accepts one item per line. Examples:
    // Milk | 2 | 3.48
    // Milk, 2, 3.48
    // Milk - $3.48
    const out=[];
    for (const rawLine of text.split(/\r?\n/)) {
      const line=rawLine.trim(); if(!line) continue;
      let name=line, qty=1, price=0;
      const pipe=line.split('|').map(s=>s.trim());
      const comma=line.split(',').map(s=>s.trim());
      if (pipe.length>=2) {
        name=pipe[0]; qty=Math.max(1,Math.round(num(pipe[1],1))); price=Math.max(0,num(String(pipe[2]??'').replace(/[$]/g,''),0));
      } else if (comma.length>=2 && /^\s*\d+(?:\.\d+)?\s*$/.test(comma[1].replace('$',''))) {
        name=comma[0];
        if (comma.length>=3) { qty=Math.max(1,Math.round(num(comma[1],1))); price=Math.max(0,num(comma[2].replace('$',''),0)); }
        else price=Math.max(0,num(comma[1].replace('$',''),0));
      } else {
        const m=line.match(/^(.*?)\s+(?:-|—)?\s*\$([0-9]+(?:\.[0-9]{1,2})?)\s*$/);
        if(m){ name=m[1].trim(); price=num(m[2]); }
      }
      if(!name) continue;
      out.push({id:uid(),name,qty,unitPrice:price,category:suggestCategory(store,name),picked:false});
    }
    return out;
  }

  function openPasteImportModal() {
    const t=state.currentTrip; if(!t) return;
    openModal('Paste cart text', `
      <p class="small muted">Use one product per line. Most reliable formats:</p>
      <div class="import-note">Milk | 2 | 3.48<br>Bananas | 1 | 2.16<br>Paper Towels - $18.98</div>
      <div class="field" style="margin-top:12px"><label>Cart text</label><textarea id="pasteText" placeholder="Paste or type items here"></textarea></div>
      <button class="btn btn-primary btn-block" id="reviewImport">Review import</button>
    `, root => $('#reviewImport',root).addEventListener('click', () => {
      const items=parseCartText($('#pasteText',root).value,t.store);
      if(!items.length) return toast('No items found');
      root.remove();
      openImportReview(items);
    }));
  }

  function openImportReview(items, options={}) {
    const t=state.currentTrip;
    const fromScreenshots=options.source==='screenshots';
    openModal(fromScreenshots?'Review screenshot import':'Review import', `
      <p class="small muted">Nothing is added until you confirm. ${fromScreenshots?'OCR can misread product names, quantities, or prices, so check each row.':'Correct any item that was parsed incorrectly.'}</p>
      <div id="importRows" class="list">${items.map((i,ix)=>`<div class="card" style="margin:0"><label class="include-row"><input data-import-include="${ix}" type="checkbox" checked><strong>Include item</strong></label><div class="field"><label>Item</label><input data-import-name="${ix}" value="${escapeHtml(i.name)}"></div><div class="grid-2"><div class="field"><label>Qty</label><input data-import-qty="${ix}" type="number" min="1" step="1" value="${i.qty}"></div><div class="field"><label>Unit price</label><input data-import-price="${ix}" type="number" min="0" step="0.01" value="${i.unitPrice || ''}"></div></div><div class="field"><label>Category</label><select data-import-cat="${ix}">${categoryOptions(t.store,i.category)}</select></div></div>`).join('')}</div>
      <button class="btn btn-primary btn-block" id="confirmImport" style="margin-top:12px">Add reviewed items</button>
    `, root => $('#confirmImport',root).addEventListener('click', () => {
      const cleaned=items.map((i,ix)=>({
        include:$(`[data-import-include="${ix}"]`,root).checked,
        id:i.id,
        name:$(`[data-import-name="${ix}"]`,root).value.trim(),
        qty:Math.max(1,Math.round(num($(`[data-import-qty="${ix}"]`,root).value,1))),
        unitPrice:Math.max(0,num($(`[data-import-price="${ix}"]`,root).value)),
        category:$(`[data-import-cat="${ix}"]`,root).value,
        picked:false
      })).filter(i=>i.include && i.name).map(({include,...i})=>i);
      if(!cleaned.length) return toast('Select at least one item');
      commit(s => {
        for(const item of cleaned){ s.currentTrip.items.push(item); s.itemLibrary[libraryKey(s.currentTrip.store,item.name)]={category:item.category,lastPrice:item.unitPrice}; }
      }, `${cleaned.length} items added`);
      root.remove();
    }));
  }

  function openFinishModal() {
    const t=state.currentTrip; if(!t) return;
    const projected=tripTotal(t);
    openModal('Finish trip', `
      <div class="metric-grid"><div class="metric"><div class="label">Projected</div><div class="value">${money(projected)}</div></div><div class="metric"><div class="label">Budget</div><div class="value">${money(t.budget)}</div></div></div>
      <div class="field" style="margin-top:14px"><label>Actual checkout total (optional)</label><input id="actualTotal" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${projected.toFixed(2)}"></div>
      <p class="small muted">This saves a completed copy to History and clears the active trip.</p>
      <button class="btn btn-primary btn-block" id="finishTrip">Save completed trip</button>
    `, root => $('#finishTrip',root).addEventListener('click', () => {
      const entered=$('#actualTotal',root).value.trim();
      const actual=entered===''?null:Math.max(0,num(entered));
      commit(s => {
        const done=JSON.parse(JSON.stringify(s.currentTrip));
        done.status='completed'; done.actualTotal=actual; done.completedAt=new Date().toISOString();
        s.history.unshift(done);
        s.currentTrip=null; s.activeView='history';
      }, 'Trip saved');
      root.remove();
    }));
  }

  function openHistoryModal(id) {
    const t=state.history.find(x=>x.id===id); if(!t) return;
    openModal(`${t.store} · ${t.date}`, `
      <div class="metric-grid"><div class="metric"><div class="label">Budget</div><div class="value">${money(t.budget)}</div></div><div class="metric"><div class="label">Actual</div><div class="value">${money(t.actualTotal ?? tripTotal(t))}</div></div></div>
      <div style="margin-top:14px">${sortItemsForStore(t.items,t.store).map(i=>`<div class="history-row"><div><strong>${escapeHtml(i.name)}</strong><div class="small muted">${i.qty} × ${money(i.unitPrice)} · ${escapeHtml(i.category)}</div></div><strong>${money(i.qty*i.unitPrice)}</strong></div>`).join('')}</div>
    `);
  }

  function moveRoute(store,index,dir) {
    commit(s => {
      const arr=s.storeProfiles[store].route;
      const target=dir==='up'?index-1:index+1;
      if(target<0||target>=arr.length) return;
      [arr[index],arr[target]]=[arr[target],arr[index]];
    });
  }

  function exportBackup() {
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=`grocery-companion-backup-${todayISO()}.json`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),500); toast('Backup exported');
  }

  async function importBackup(e) {
    const file=e.target.files?.[0]; if(!file) return;
    try {
      const raw=JSON.parse(await file.text());
      const next=sanitizeState(raw);
      if(!confirm('Replace current app data with this backup?')) return;
      state=next; saveState(); render(); toast('Backup imported');
    } catch { toast('Backup file is invalid'); }
    e.target.value='';
  }

  function resetApp() {
    if(!confirm('Reset all Grocery Companion data on this device? This cannot be undone unless you exported a backup.')) return;
    state=defaultState(); saveState(); render(); toast('App reset');
  }

  // Global nav
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  // Install prompt when supported.
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredInstallPrompt=e; $('#installBtn').classList.remove('hidden');
  });
  $('#installBtn').addEventListener('click', async () => {
    if(!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt=null; $('#installBtn').classList.add('hidden');
  });

  // Service worker registration is best-effort; app remains usable without it.
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW unavailable',err)));

  render();
})();
