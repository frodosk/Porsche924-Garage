/* =========================================================
   Porsche 924 Garage — App-Steuerung (Views, Formulare, Charts)
   ========================================================= */

(function () {
  'use strict';

  let activeChartKm = null;
  let activeChartCost = null;
  let currentTripFilter = 'all';
  let pendingDelete = null; // { type, id }

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $all = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------------------------------------------------------
     Init
     --------------------------------------------------------- */

  function init() {
    Store.load();
    Store.subscribe(renderAll);

    setupNav();
    setupModals();
    setupForms();
    setupMorePanels();
    setupTheme();

    Sync.init(Store, updateSyncIndicator);

    renderAll();
    registerServiceWorker();
  }

  function renderAll() {
    renderDashboard();
    renderTrips();
    renderFuel();
    renderStats();
    renderVehiclePanel();
    renderMaintenance();
    renderCostsView();
    renderDriverManage();
    renderSettingsPanel();
    populateDriverSelects();
  }

  /* ---------------------------------------------------------
     Navigation
     --------------------------------------------------------- */

  function setupNav() {
    $all('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    $('#btnQuickTrip').addEventListener('click', () => {
      switchView('trips');
      openTripModal();
    });
    $('#btnQuickFuel').addEventListener('click', () => {
      switchView('fuel');
      openFuelModal();
    });
  }

  function switchView(view) {
    $all('.view').forEach((v) => (v.hidden = v.dataset.view !== view));
    $all('.nav-item').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (view === 'more') closeAllPanels();
  }

  function setupMorePanels() {
    $all('.more-item').forEach((item) => {
      item.addEventListener('click', () => openPanel(item.dataset.panel));
    });
    $all('.panel-back').forEach((btn) => {
      btn.addEventListener('click', closeAllPanels);
    });
  }

  function openPanel(id) {
    $('.more-list').hidden = true;
    $all('.panel').forEach((p) => (p.hidden = p.id !== id));
  }
  function closeAllPanels() {
    $('.more-list').hidden = false;
    $all('.panel').forEach((p) => (p.hidden = true));
  }

  /* ---------------------------------------------------------
     Theme (dark default, manual toggle would go here if added)
     --------------------------------------------------------- */

  function setupTheme() {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'dark'); // cockpit look stays dark by default
  }

  /* ---------------------------------------------------------
     Sync indicator
     --------------------------------------------------------- */

  function updateSyncIndicator(status) {
    const dot = $('#syncDot');
    const label = $('#syncLabel');
    const statusText = $('#syncStatusText');
    dot.classList.remove('is-online', 'is-error');
    const map = {
      local: ['Lokal', 'Lokal gespeichert (kein Cloud-Sync konfiguriert). Siehe „Mehr → Synchronisierung“ für die Einrichtung.'],
      connecting: ['Verbinde…', 'Verbindung zur Cloud-Datenbank wird aufgebaut…'],
      online: ['Synced', 'Verbunden – Fahrten, Tankungen und Wartungen werden live zwischen allen Geräten abgeglichen.'],
      error: ['Fehler', 'Verbindung zur Cloud-Datenbank fehlgeschlagen. Prüft die Werte in js/firebase-config.js und die Firestore-Regeln.'],
    };
    const [lbl, txt] = map[status] || map.local;
    label.textContent = lbl;
    if (statusText) statusText.textContent = txt;
    if (status === 'online') dot.classList.add('is-online');
    if (status === 'error') dot.classList.add('is-error');
  }

  /* ---------------------------------------------------------
     Driver selects (used in Trip & Fuel modals + filters)
     --------------------------------------------------------- */

  function populateDriverSelects() {
    [$('#tripDriver'), $('#fuelDriver'), $('#otherCostDriver')].forEach((select) => {
      if (!select) return;
      const current = select.value;
      select.innerHTML = '';
      Store.state.drivers.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        select.appendChild(opt);
      });
      const otherOpt = document.createElement('option');
      otherOpt.value = OTHER_DRIVER;
      otherOpt.textContent = OTHER_DRIVER;
      select.appendChild(otherOpt);
      if (current) select.value = current;
    });
  }

  /* ---------------------------------------------------------
     DASHBOARD
     --------------------------------------------------------- */

  function renderDashboard() {
    const state = Store.state;
    const year = Calc.currentYear();
    const odo = Calc.currentOdometer(state);
    const kmYear = Calc.kmThisYear(state, year);
    const limit = state.vehicle.yearLimit || 4000;
    const remaining = limit - kmYear;
    const pct = Math.min(100, Math.max(0, (kmYear / limit) * 100));

    $('#dashVehicleName').textContent = state.vehicle.name || 'Porsche 924';
    $('#dashYear').textContent = year;
    $('#dashOdometer').textContent = Fmt.km(odo);
    $('#dashYearKm').textContent = Fmt.km(kmYear);
    $('#dashYearLimit').textContent = Fmt.km(limit);
    $('#dashRemaining').textContent = remaining >= 0 ? Fmt.km(remaining) : `${Fmt.km(Math.abs(remaining))} über Limit`;
    $('#dashDriverYear').textContent = year;

    const fill = $('#dashProgressFill');
    fill.style.width = pct + '%';
    fill.classList.remove('is-warning', 'is-over');
    if (kmYear > limit) fill.classList.add('is-over');
    else if (pct >= 80) fill.classList.add('is-warning');

    // Reminders
    const remindersEl = $('#dashReminders');
    const reminders = Calc.maintenanceReminders(state);
    remindersEl.innerHTML = reminders
      .map(
        (r) =>
          `<div class="reminder-banner ${r.level === 'danger' ? 'is-danger' : ''}"><span class="reminder-banner__icon">${r.icon}</span><span>${escapeHtml(r.text)}</span></div>`
      )
      .join('');

    // Driver ranking
    const kmMap = Calc.kmByDriver(state, year);
    const rows = Object.entries(kmMap)
      .filter(([name]) => name)
      .sort((a, b) => b[1] - a[1]);
    const listEl = $('#dashDriverList');
    if (!rows.length || rows.every(([, km]) => km === 0)) {
      listEl.innerHTML = `<div class="empty-state"><p>Noch keine Fahrten in ${year}.</p></div>`;
    } else {
      listEl.innerHTML = rows
        .map(([name, km], i) => {
          const pctBar = limit > 0 ? Math.min(100, (km / limit) * 100) : 0;
          return `
          <div class="driver-row" data-testid="row-driver-${escapeAttr(name)}">
            <div class="driver-row__rank ${i === 0 && km > 0 ? 'is-first' : ''}">${i + 1}</div>
            <div class="driver-row__body">
              <div class="driver-row__name">${escapeHtml(name)}</div>
              <div class="progress-track"><div class="progress-fill" style="width:${pctBar}%"></div></div>
            </div>
            <div class="driver-row__km">${Fmt.km(km)}</div>
          </div>`;
        })
        .join('');
    }
  }

  /* ---------------------------------------------------------
     TRIPS
     --------------------------------------------------------- */

  function renderTrips() {
    const state = Store.state;
    const filterEl = $('#tripDriverFilter');
    const names = ['all', ...state.drivers];
    filterEl.innerHTML = names
      .map(
        (n) =>
          `<button class="chip ${currentTripFilter === n ? 'is-active' : ''}" data-driver="${escapeAttr(n)}" type="button" data-testid="chip-driver-${escapeAttr(n)}">${n === 'all' ? 'Alle' : escapeHtml(n)}</button>`
      )
      .join('');
    $all('.chip', filterEl).forEach((chip) => {
      chip.addEventListener('click', () => {
        currentTripFilter = chip.dataset.driver;
        renderTrips();
      });
    });

    const trips = state.trips
      .filter((t) => currentTripFilter === 'all' || t.driver === currentTripFilter)
      .sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || 0) - (a.createdAt || 0));

    const listEl = $('#tripList');
    $('#tripEmpty').hidden = trips.length > 0;
    listEl.innerHTML = trips
      .map(
        (t) => `
      <div class="entry-row" data-testid="row-trip-${t.id}">
        <div class="entry-row__avatar">${escapeHtml(Fmt.initials(t.driver))}</div>
        <div class="entry-row__body">
          <div class="entry-row__title">${escapeHtml(t.driver || '–')}</div>
          <div class="entry-row__meta">${Fmt.date(t.date)} · ${t.startKm?.toLocaleString('de-DE')} → ${t.endKm?.toLocaleString('de-DE')} km</div>
        </div>
        <div class="entry-row__value">${Fmt.km(t.km)}</div>
        <div class="entry-row__actions">
          <button class="entry-row__icon-btn" data-edit-trip="${t.id}" type="button" aria-label="Bearbeiten" data-testid="button-edit-trip-${t.id}">✎</button>
          <button class="entry-row__icon-btn" data-delete-trip="${t.id}" type="button" aria-label="Löschen" data-testid="button-delete-trip-${t.id}">🗑</button>
        </div>
      </div>`
      )
      .join('');

    $all('[data-edit-trip]', listEl).forEach((btn) =>
      btn.addEventListener('click', () => openTripModal(btn.dataset.editTrip))
    );
    $all('[data-delete-trip]', listEl).forEach((btn) =>
      btn.addEventListener('click', () => confirmDelete('trip', btn.dataset.deleteTrip, 'Diese Fahrt wird endgültig gelöscht.'))
    );
  }

  /* ---------------------------------------------------------
     FUEL
     --------------------------------------------------------- */

  function renderFuel() {
    const state = Store.state;
    const year = Calc.currentYear();
    $('#fuelYear').textContent = year;

    const costMap = Calc.costByDriver(state, year);
    const costRows = Object.entries(costMap).filter(([, v]) => v > 0);
    $('#fuelCostTable').innerHTML = costRows.length
      ? costRows
          .map(([name, v]) => `<div class="cost-row"><span class="cost-row__name">${escapeHtml(name)}</span><span class="cost-row__value">${Fmt.eur(v)}</span></div>`)
          .join('')
      : `<p class="card__hint">Noch keine Tankungen in ${year}.</p>`;
    $('#fuelCostTotal').textContent = Fmt.eur(Calc.totalCostYear(state, year));

    const split = Calc.fairSplit(state, year);
    $('#fairSplitTable').innerHTML = split.length
      ? split
          .map((r) => {
            const balanceClass = r.balance > 0.5 ? 'is-positive' : r.balance < -0.5 ? 'is-negative' : '';
            const balanceLabel = r.balance >= 0 ? `+${Fmt.eur(r.balance)} Guthaben` : `${Fmt.eur(r.balance)} offen`;
            return `
          <div class="split-row" data-testid="row-split-${escapeAttr(r.name)}">
            <div class="split-row__top"><span>${escapeHtml(r.name)}</span><span class="split-row__balance ${balanceClass}">${balanceLabel}</span></div>
            <div class="split-row__detail">
              <span>${Math.round(r.percent * 100)}% der km · Soll: ${Fmt.eur(r.shouldPay)}</span>
              <span>Bezahlt: ${Fmt.eur(r.paid)}</span>
            </div>
          </div>`;
          })
          .join('')
      : `<p class="card__hint">Noch keine Daten für ${year}.</p>`;

    const fuelups = state.fuelups.slice().sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    const listEl = $('#fuelList');
    $('#fuelEmpty').hidden = fuelups.length > 0;
    listEl.innerHTML = fuelups
      .map((f) => {
        const perLiter = f.liters > 0 ? f.amount / f.liters : 0;
        return `
      <div class="entry-row" data-testid="row-fuel-${f.id}">
        <div class="entry-row__avatar">${escapeHtml(Fmt.initials(f.driver))}</div>
        <div class="entry-row__body">
          <div class="entry-row__title">${escapeHtml(f.driver || '–')}${f.station ? ' · ' + escapeHtml(f.station) : ''}</div>
          <div class="entry-row__meta">${Fmt.date(f.date)} · ${f.liters} l · ${Fmt.eur(perLiter)}/l</div>
        </div>
        <div class="entry-row__value">${Fmt.eur(f.amount)}</div>
        <div class="entry-row__actions">
          <button class="entry-row__icon-btn" data-edit-fuel="${f.id}" type="button" aria-label="Bearbeiten" data-testid="button-edit-fuel-${f.id}">✎</button>
          <button class="entry-row__icon-btn" data-delete-fuel="${f.id}" type="button" aria-label="Löschen" data-testid="button-delete-fuel-${f.id}">🗑</button>
        </div>
      </div>`;
      })
      .join('');

    $all('[data-edit-fuel]', listEl).forEach((btn) => btn.addEventListener('click', () => openFuelModal(btn.dataset.editFuel)));
    $all('[data-delete-fuel]', listEl).forEach((btn) =>
      btn.addEventListener('click', () => confirmDelete('fuel', btn.dataset.deleteFuel, 'Diese Tankung wird endgültig gelöscht.'))
    );
  }

  /* ---------------------------------------------------------
     STATS
     --------------------------------------------------------- */

  function renderStats() {
    const state = Store.state;
    const year = Calc.currentYear();
    const kmMap = Calc.kmByDriver(state, year);
    const costMap = Calc.costByDriver(state, year);
    const labels = Array.from(new Set([...Object.keys(kmMap), ...Object.keys(costMap)])).filter(Boolean);

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#e2001a';
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--color-divider').trim() || '#232326';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim() || '#9c9b9e';

    const chartOpts = {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor, font: { family: 'General Sans' } }, grid: { display: false } },
        y: { ticks: { color: textColor, font: { family: 'JetBrains Mono' } }, grid: { color: gridColor } },
      },
    };

    if (activeChartKm) activeChartKm.destroy();
    activeChartKm = new Chart($('#chartKm').getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ data: labels.map((l) => Math.round(kmMap[l] || 0)), backgroundColor: primaryColor, borderRadius: 6, maxBarThickness: 44 }] },
      options: chartOpts,
    });

    if (activeChartCost) activeChartCost.destroy();
    activeChartCost = new Chart($('#chartCost').getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ data: labels.map((l) => Math.round((costMap[l] || 0) * 100) / 100), backgroundColor: '#f0a63a', borderRadius: 6, maxBarThickness: 44 }] },
      options: chartOpts,
    });

    const totalKm = Calc.kmThisYear(state, year);
    const totalCost = Calc.totalCostYear(state, year);
    const maintCost = state.maintenance
      .filter((m) => m.date && new Date(m.date).getFullYear() === year)
      .reduce((s, m) => s + (m.cost || 0), 0);
    $('#statsYearTable').innerHTML = `
      <div class="cost-row"><span class="cost-row__name">Gefahrene Kilometer</span><span class="cost-row__value">${Fmt.km(totalKm)}</span></div>
      <div class="cost-row"><span class="cost-row__name">Tankkosten</span><span class="cost-row__value">${Fmt.eur(totalCost)}</span></div>
      <div class="cost-row"><span class="cost-row__name">Wartungskosten</span><span class="cost-row__value">${Fmt.eur(maintCost)}</span></div>
      <div class="cost-total-row"><span>Gesamtkosten ${year}</span><strong>${Fmt.eur(totalCost + maintCost)}</strong></div>
    `;

    $('#btnExportCsv').onclick = exportCsv;
    $('#btnExportPdf').onclick = () => window.print();
  }

  function exportCsv() {
    const state = Store.state;
    const lines = [];
    lines.push('Fahrtenbuch');
    lines.push('Datum;Fahrer;Start (km);Ende (km);Gefahren (km)');
    state.trips.forEach((t) => lines.push(`${Fmt.date(t.date)};${t.driver};${t.startKm};${t.endKm};${t.km}`));
    lines.push('');
    lines.push('Tankbuch');
    lines.push('Datum;Fahrer;Liter;Betrag (EUR);Tankstelle');
    state.fuelups.forEach((f) => lines.push(`${Fmt.date(f.date)};${f.driver};${f.liters};${f.amount};${f.station || ''}`));
    lines.push('');
    lines.push('Wartung');
    lines.push('Datum;Art;Kilometerstand;Kosten (EUR);Notizen');
    state.maintenance.forEach((m) => lines.push(`${Fmt.date(m.date)};${m.type};${m.km};${m.cost};${(m.notes || '').replace(/\n/g, ' ')}`));
    lines.push('');
    lines.push('Sonstige Kosten');
    lines.push('Datum;Bezahlt von;Bezeichnung;Betrag (EUR);Notizen');
    state.othercosts.forEach((o) => lines.push(`${Fmt.date(o.date)};${o.driver};${o.title};${o.amount};${(o.notes || '').replace(/\n/g, ' ')}`));

    const csv = '\uFEFF' + lines.join('\n');
    downloadBlob(csv, 'porsche924-garage-export.csv', 'text/csv;charset=utf-8');
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------------------------------------------------------
     VEHICLE PANEL
     --------------------------------------------------------- */

  function renderVehiclePanel() {
    const v = Store.state.vehicle;
    $('#vName').value = v.name || '';
    $('#vYear').value = v.year || '';
    $('#vEngine').value = v.engine || '';
    $('#vPs').value = v.ps || '';
    $('#vVin').value = v.vin || '';
    const img = $('#vehiclePhoto');
    const placeholder = $('#vehiclePhotoPlaceholder');
    if (v.photo) {
      img.src = v.photo;
      img.hidden = false;
      placeholder.hidden = true;
    } else {
      img.hidden = true;
      placeholder.hidden = false;
    }
  }

  /* ---------------------------------------------------------
     MAINTENANCE
     --------------------------------------------------------- */

  function renderMaintenance() {
    const state = Store.state;
    const remindersEl = $('#maintenanceReminders');
    remindersEl.innerHTML = Calc.maintenanceReminders(state)
      .map((r) => `<div class="reminder-banner ${r.level === 'danger' ? 'is-danger' : ''}"><span class="reminder-banner__icon">${r.icon}</span><span>${escapeHtml(r.text)}</span></div>`)
      .join('');

    const entries = state.maintenance.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const listEl = $('#maintenanceList');
    $('#maintenanceEmpty').hidden = entries.length > 0;
    listEl.innerHTML = entries
      .map(
        (m) => `
      <div class="entry-row" data-testid="row-maintenance-${m.id}">
        <div class="entry-row__avatar">🔧</div>
        <div class="entry-row__body">
          <div class="entry-row__title">${escapeHtml(m.type)}</div>
          <div class="entry-row__meta">${Fmt.date(m.date)}${m.km ? ' · ' + m.km.toLocaleString('de-DE') + ' km' : ''}${m.notes ? ' · ' + escapeHtml(m.notes) : ''}</div>
        </div>
        <div class="entry-row__value">${m.cost ? Fmt.eur(m.cost) : ''}</div>
        <div class="entry-row__actions">
          <button class="entry-row__icon-btn" data-edit-maintenance="${m.id}" type="button" aria-label="Bearbeiten" data-testid="button-edit-maintenance-${m.id}">✎</button>
          <button class="entry-row__icon-btn" data-delete-maintenance="${m.id}" type="button" aria-label="Löschen" data-testid="button-delete-maintenance-${m.id}">🗑</button>
        </div>
      </div>`
      )
      .join('');

    $all('[data-edit-maintenance]', listEl).forEach((btn) => btn.addEventListener('click', () => openMaintenanceModal(btn.dataset.editMaintenance)));
    $all('[data-delete-maintenance]', listEl).forEach((btn) =>
      btn.addEventListener('click', () => confirmDelete('maintenance', btn.dataset.deleteMaintenance, 'Dieser Wartungseintrag wird endgültig gelöscht.'))
    );
  }

  /* ---------------------------------------------------------
     SONSTIGE KOSTEN & GESAMTABRECHNUNG
     --------------------------------------------------------- */

  function renderCostsView() {
    const state = Store.state;
    const year = Calc.currentYear();
    $('#settlementYear').textContent = year;

    const split = Calc.fairSplitAll(state, year);
    $('#settlementTable').innerHTML = split.length
      ? split
          .map((r) => {
            const balanceClass = r.balance > 0.5 ? 'is-positive' : r.balance < -0.5 ? 'is-negative' : '';
            const balanceLabel = r.balance >= 0 ? `+${Fmt.eur(r.balance)} Guthaben` : `${Fmt.eur(r.balance)} offen`;
            return `
          <div class="split-row" data-testid="row-settlement-${escapeAttr(r.name)}">
            <div class="split-row__top"><span>${escapeHtml(r.name)}</span><span class="split-row__balance ${balanceClass}">${balanceLabel}</span></div>
            <div class="split-row__detail">
              <span>${Math.round(r.percent * 100)}% der km · Soll: ${Fmt.eur(r.shouldPay)}</span>
              <span>Bezahlt: ${Fmt.eur(r.paid)}</span>
            </div>
          </div>`;
          })
          .join('')
      : `<p class="card__hint">Noch keine Daten für ${year}.</p>`;
    $('#settlementTotal').textContent = Fmt.eur(Calc.combinedTotalCostYear(state, year));

    const transactions = Calc.settleUp(split);
    $('#settleUpList').innerHTML = transactions.length
      ? transactions
          .map(
            (t) => `
          <div class="settle-row" data-testid="row-settle-${escapeAttr(t.from)}-${escapeAttr(t.to)}">
            <div class="settle-row__names"><span>${escapeHtml(t.from)}</span><span class="settle-row__arrow">→</span><span>${escapeHtml(t.to)}</span></div>
            <div class="settle-row__amount">${Fmt.eur(t.amount)}</div>
          </div>`
          )
          .join('')
      : `<p class="settle-empty">Alle Salden sind ausgeglichen.</p>`;

    const entries = state.othercosts.slice().sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    const listEl = $('#otherCostList');
    $('#otherCostEmpty').hidden = entries.length > 0;
    listEl.innerHTML = entries
      .map(
        (o) => `
      <div class="entry-row" data-testid="row-othercost-${o.id}">
        <div class="entry-row__avatar">${escapeHtml(Fmt.initials(o.driver))}</div>
        <div class="entry-row__body">
          <div class="entry-row__title">${escapeHtml(o.title || '–')}</div>
          <div class="entry-row__meta">${Fmt.date(o.date)} · ${escapeHtml(o.driver || '–')}${o.notes ? ' · ' + escapeHtml(o.notes) : ''}</div>
        </div>
        <div class="entry-row__value">${Fmt.eur(o.amount)}</div>
        <div class="entry-row__actions">
          <button class="entry-row__icon-btn" data-edit-othercost="${o.id}" type="button" aria-label="Bearbeiten" data-testid="button-edit-othercost-${o.id}">✎</button>
          <button class="entry-row__icon-btn" data-delete-othercost="${o.id}" type="button" aria-label="Löschen" data-testid="button-delete-othercost-${o.id}">🗑</button>
        </div>
      </div>`
      )
      .join('');

    $all('[data-edit-othercost]', listEl).forEach((btn) => btn.addEventListener('click', () => openOtherCostModal(btn.dataset.editOthercost)));
    $all('[data-delete-othercost]', listEl).forEach((btn) =>
      btn.addEventListener('click', () => confirmDelete('othercost', btn.dataset.deleteOthercost, 'Dieser Kosteneintrag wird endgültig gelöscht.'))
    );

    $('#btnExportSettlementPdf').onclick = exportSettlementPdf;
  }

  function exportSettlementPdf() {
    const state = Store.state;
    const year = Calc.currentYear();
    const split = Calc.fairSplitAll(state, year);
    const transactions = Calc.settleUp(split);
    const v = state.vehicle || {};

    const rowsHtml = split.length
      ? split
          .map(
            (r) => `
        <tr>
          <td>${escapeHtml(r.name)}</td>
          <td class="num">${Fmt.km(r.km)}</td>
          <td class="num">${Math.round(r.percent * 100)}%</td>
          <td class="num">${Fmt.eur(r.shouldPay)}</td>
          <td class="num">${Fmt.eur(r.paid)}</td>
          <td class="num ${r.balance >= 0 ? 'pr-balance-pos' : 'pr-balance-neg'}">${r.balance >= 0 ? '+' : ''}${Fmt.eur(r.balance)}</td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="6">Keine Daten für dieses Jahr.</td></tr>';

    const totalKm = split.reduce((s, r) => s + r.km, 0);
    const totalCost = Calc.combinedTotalCostYear(state, year);

    const settleHtml = transactions.length
      ? transactions.map((t) => `<div class="pr-settle-item">${escapeHtml(t.from)} schuldet ${escapeHtml(t.to)}: <strong>${Fmt.eur(t.amount)}</strong></div>`).join('')
      : '<div class="pr-settle-item">Alle Salden sind ausgeglichen – niemand schuldet jemandem etwas.</div>';

    const otherEntries = Calc.otherCostsForYear(state, year).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const otherHtml = otherEntries.length
      ? otherEntries
          .map((o) => `<tr><td>${Fmt.date(o.date)}</td><td>${escapeHtml(o.driver || '–')}</td><td>${escapeHtml(o.title || '–')}</td><td class="num">${Fmt.eur(o.amount)}</td></tr>`)
          .join('')
      : '<tr><td colspan="4">Keine sonstigen Kosten in diesem Jahr.</td></tr>';

    const html = `
      <h1>${escapeHtml(v.name || 'Porsche 924')} – Kostenabrechnung ${year}</h1>
      <p class="pr-sub">Erstellt am ${Fmt.date(todayIso())} · Kosten anteilig an den gefahrenen Kilometern aufgeteilt (Tanken + sonstige Kosten)</p>

      <h2>Gesamtabrechnung</h2>
      <table>
        <thead><tr><th>Fahrer</th><th class="num">km</th><th class="num">Anteil</th><th class="num">Soll</th><th class="num">Bezahlt</th><th class="num">Saldo</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr class="pr-total-row"><td>Gesamt</td><td class="num">${Fmt.km(totalKm)}</td><td class="num">100%</td><td class="num">${Fmt.eur(totalCost)}</td><td class="num" colspan="2"></td></tr></tfoot>
      </table>

      <h2>Wer schuldet wem</h2>
      ${settleHtml}

      <h2>Sonstige Kosten im Detail</h2>
      <table>
        <thead><tr><th>Datum</th><th>Bezahlt von</th><th>Bezeichnung</th><th class="num">Betrag</th></tr></thead>
        <tbody>${otherHtml}</tbody>
      </table>

      <p class="pr-footer">Porsche 924 Garage – automatisch erstellte Abrechnung. Positiver Saldo = Guthaben, negativer Saldo = offene Zahlung.</p>
    `;

    const report = $('#printReport');
    report.innerHTML = html;
    report.classList.add('is-active');
    const cleanup = () => {
      report.classList.remove('is-active');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  /* ---------------------------------------------------------
     DRIVER MANAGEMENT
     --------------------------------------------------------- */

  function renderDriverManage() {
    const listEl = $('#driverManageList');
    listEl.innerHTML = Store.state.drivers
      .map(
        (d) => `
      <div class="entry-row" data-testid="row-manage-driver-${escapeAttr(d)}">
        <div class="entry-row__avatar">${escapeHtml(Fmt.initials(d))}</div>
        <div class="entry-row__body"><div class="entry-row__title">${escapeHtml(d)}</div></div>
        <div class="entry-row__actions">
          <button class="entry-row__icon-btn" data-remove-driver="${escapeAttr(d)}" type="button" aria-label="Entfernen" data-testid="button-remove-driver-${escapeAttr(d)}">🗑</button>
        </div>
      </div>`
      )
      .join('');
    $all('[data-remove-driver]', listEl).forEach((btn) =>
      btn.addEventListener('click', () => {
        Store.removeDriver(btn.dataset.removeDriver);
        showToast(`${btn.dataset.removeDriver} entfernt`);
      })
    );
  }

  /* ---------------------------------------------------------
     SETTINGS
     --------------------------------------------------------- */

  function renderSettingsPanel() {
    const v = Store.state.vehicle;
    $('#sYearLimit').value = v.yearLimit || 4000;
    $('#sInitialOdo').value = v.initialOdo || 0;
    $('#sNextOil').value = v.nextOilKm || '';
    $('#sNextTuv').value = v.nextTuvDate || '';
  }

  /* ---------------------------------------------------------
     FORMS
     --------------------------------------------------------- */

  function setupForms() {
    // Trip form
    const tripDriver = $('#tripDriver');
    tripDriver.addEventListener('change', () => {
      $('#tripOtherWrap').hidden = tripDriver.value !== OTHER_DRIVER;
    });
    $('#tripStart').addEventListener('input', updateTripCalc);
    $('#tripEnd').addEventListener('input', updateTripCalc);

    $('#tripForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = $('#tripId').value || undefined;
      const driver = tripDriver.value === OTHER_DRIVER ? $('#tripOtherName').value.trim() : tripDriver.value;
      const startKm = Number($('#tripStart').value);
      const endKm = Number($('#tripEnd').value);
      const date = $('#tripDate').value;
      const errorEl = $('#tripError');

      if (!driver) return showFieldError(errorEl, 'Bitte einen Fahrer angeben.');
      if (!date) return showFieldError(errorEl, 'Bitte ein Datum wählen.');
      if (isNaN(startKm) || isNaN(endKm)) return showFieldError(errorEl, 'Bitte Start- und End-Kilometerstand angeben.');
      if (endKm < startKm) return showFieldError(errorEl, 'Der End-Kilometerstand muss größer als der Start-Kilometerstand sein.');
      errorEl.hidden = true;

      Store.upsertTrip({ id, driver, date, startKm, endKm });
      if (driver && !Store.state.drivers.includes(driver) && driver !== OTHER_DRIVER) {
        // custom one-off driver name isn't auto-added to the permanent list; that's intentional.
      }
      closeModal();
      showToast('Fahrt gespeichert');
    });

    // Fuel form
    const fuelDriver = $('#fuelDriver');
    fuelDriver.addEventListener('change', () => {
      $('#fuelOtherWrap').hidden = fuelDriver.value !== OTHER_DRIVER;
    });
    $('#fuelLiters').addEventListener('input', updateFuelCalc);
    $('#fuelAmount').addEventListener('input', updateFuelCalc);
    $('#fuelPhoto').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await fileToCompressedDataUrl(file);
      $('#fuelPhotoPreview').src = dataUrl;
      $('#fuelPhotoPreview').hidden = false;
      $('#fuelForm').dataset.photo = dataUrl;
    });

    $('#fuelForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = $('#fuelId').value || undefined;
      const driver = fuelDriver.value === OTHER_DRIVER ? $('#fuelOtherName').value.trim() : fuelDriver.value;
      const date = $('#fuelDate').value;
      const liters = Number($('#fuelLiters').value);
      const amount = Number($('#fuelAmount').value);
      const station = $('#fuelStation').value.trim();
      const photo = $('#fuelForm').dataset.photo || null;

      if (!driver || !date || isNaN(liters) || isNaN(amount)) {
        showToast('Bitte alle Pflichtfelder ausfüllen.');
        return;
      }
      Store.upsertFuelup({ id, driver, date, liters, amount, station, photo });
      closeModal();
      showToast('Tankung gespeichert');
    });

    // Maintenance form
    $('#maintenanceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = $('#maintenanceId').value || undefined;
      const type = $('#maintenanceType').value;
      const date = $('#maintenanceDate').value;
      const km = Number($('#maintenanceKm').value) || null;
      const cost = Number($('#maintenanceCost').value) || 0;
      const notes = $('#maintenanceNotes').value.trim();
      if (!date) {
        showToast('Bitte ein Datum wählen.');
        return;
      }
      Store.upsertMaintenance({ id, type, date, km, cost, notes });
      closeModal();
      showToast('Wartungseintrag gespeichert');
    });

    // Other cost form
    const otherCostDriver = $('#otherCostDriver');
    otherCostDriver.addEventListener('change', () => {
      $('#otherCostOtherWrap').hidden = otherCostDriver.value !== OTHER_DRIVER;
    });

    $('#otherCostForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = $('#otherCostId').value || undefined;
      const driver = otherCostDriver.value === OTHER_DRIVER ? $('#otherCostOtherName').value.trim() : otherCostDriver.value;
      const date = $('#otherCostDate').value;
      const title = $('#otherCostTitle').value.trim();
      const amount = Number($('#otherCostAmount').value);
      const notes = $('#otherCostNotes').value.trim();
      const errorEl = $('#otherCostError');

      if (!driver) return showFieldError(errorEl, 'Bitte einen Fahrer angeben.');
      if (!date) return showFieldError(errorEl, 'Bitte ein Datum wählen.');
      if (!title) return showFieldError(errorEl, 'Bitte eine Bezeichnung angeben.');
      if (isNaN(amount) || amount <= 0) return showFieldError(errorEl, 'Bitte einen gültigen Betrag angeben.');
      errorEl.hidden = true;

      Store.upsertOtherCost({ id, driver, date, title, amount, notes });
      closeModal();
      showToast('Kosten gespeichert');
    });

    // Add driver form
    $('#addDriverForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#newDriverName');
      const ok = Store.addDriver(input.value);
      if (ok) {
        showToast(`${input.value.trim()} hinzugefügt`);
        input.value = '';
      } else {
        showToast('Name leer oder existiert bereits.');
      }
    });

    // Vehicle form
    $('#vehiclePhotoInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await fileToCompressedDataUrl(file);
      Store.updateVehicle({ photo: dataUrl });
      showToast('Foto gespeichert');
    });
    $('#vehicleForm').addEventListener('submit', (e) => {
      e.preventDefault();
      Store.updateVehicle({
        name: $('#vName').value.trim() || 'Porsche 924',
        year: Number($('#vYear').value) || null,
        engine: $('#vEngine').value.trim(),
        ps: Number($('#vPs').value) || null,
        vin: $('#vVin').value.trim(),
      });
      showToast('Fahrzeugdaten gespeichert');
    });

    // Settings form
    $('#settingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      Store.updateVehicle({
        yearLimit: Number($('#sYearLimit').value) || 4000,
        initialOdo: Number($('#sInitialOdo').value) || 0,
        nextOilKm: Number($('#sNextOil').value) || null,
        nextTuvDate: $('#sNextTuv').value || null,
      });
      showToast('Einstellungen gespeichert');
    });

    // Backup export / import
    $('#btnBackupExport').addEventListener('click', () => {
      const json = JSON.stringify(Store.state, null, 2);
      downloadBlob(json, `porsche924-garage-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    });
    $('#btnBackupImport').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          Store.replaceAll(Object.assign(defaultState(), data));
          showToast('Backup importiert');
        } catch (err) {
          showToast('Backup konnte nicht gelesen werden.');
        }
      };
      reader.readAsText(file);
    });
  }

  function updateTripCalc() {
    const start = Number($('#tripStart').value) || 0;
    const end = Number($('#tripEnd').value) || 0;
    const km = Math.max(0, end - start);
    $('#tripCalc').textContent = Fmt.km(km);
  }
  function updateFuelCalc() {
    const liters = Number($('#fuelLiters').value) || 0;
    const amount = Number($('#fuelAmount').value) || 0;
    $('#fuelCalc').textContent = liters > 0 ? Fmt.eur(amount / liters) : '– €';
  }
  function showFieldError(el, msg) {
    el.textContent = msg;
    el.hidden = false;
  }

  function fileToCompressedDataUrl(file, maxDim) {
    maxDim = maxDim || 1000;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------------------------------------------------
     MODALS
     --------------------------------------------------------- */

  function setupModals() {
    const overlay = $('#modalOverlay');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    $all('[data-close]').forEach((btn) => btn.addEventListener('click', closeModal));
    $('#btnAddTrip').addEventListener('click', () => openTripModal());
    $('#btnAddFuel').addEventListener('click', () => openFuelModal());
    $('#btnAddMaintenance').addEventListener('click', () => openMaintenanceModal());
    $('#btnAddOtherCost').addEventListener('click', () => openOtherCostModal());
    $('#btnConfirmDelete').addEventListener('click', executeDelete);
  }

  function openModal(id) {
    $('#modalOverlay').hidden = false;
    $('#modalOverlay').classList.add('is-open');
    $all('.modal', $('#modalOverlay')).forEach((m) => (m.hidden = m.id !== id));
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    $('#modalOverlay').classList.remove('is-open');
    $('#modalOverlay').hidden = true;
    document.body.style.overflow = '';
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function openTripModal(id) {
    const t = id ? Store.state.trips.find((x) => x.id === id) : null;
    $('#tripModalTitle').textContent = t ? 'Fahrt bearbeiten' : 'Neue Fahrt';
    $('#tripId').value = t ? t.id : '';
    $('#tripError').hidden = true;
    const knownDriver = t && Store.state.drivers.includes(t.driver);
    $('#tripDriver').value = t ? (knownDriver ? t.driver : OTHER_DRIVER) : Store.state.drivers[0] || OTHER_DRIVER;
    $('#tripOtherWrap').hidden = $('#tripDriver').value !== OTHER_DRIVER;
    $('#tripOtherName').value = t && !knownDriver ? t.driver : '';
    $('#tripDate').value = t ? t.date : todayIso();
    $('#tripStart').value = t ? t.startKm : Calc.currentOdometer(Store.state) || '';
    $('#tripEnd').value = t ? t.endKm : '';
    updateTripCalc();
    openModal('modal-trip');
  }

  function openFuelModal(id) {
    const f = id ? Store.state.fuelups.find((x) => x.id === id) : null;
    $('#fuelModalTitle').textContent = f ? 'Tankung bearbeiten' : 'Neue Tankung';
    $('#fuelId').value = f ? f.id : '';
    const knownDriver = f && Store.state.drivers.includes(f.driver);
    $('#fuelDriver').value = f ? (knownDriver ? f.driver : OTHER_DRIVER) : Store.state.drivers[0] || OTHER_DRIVER;
    $('#fuelOtherWrap').hidden = $('#fuelDriver').value !== OTHER_DRIVER;
    $('#fuelOtherName').value = f && !knownDriver ? f.driver : '';
    $('#fuelDate').value = f ? f.date : todayIso();
    $('#fuelLiters').value = f ? f.liters : '';
    $('#fuelAmount').value = f ? f.amount : '';
    $('#fuelStation').value = f ? f.station || '' : '';
    $('#fuelForm').dataset.photo = f && f.photo ? f.photo : '';
    $('#fuelPhotoPreview').src = f && f.photo ? f.photo : '';
    $('#fuelPhotoPreview').hidden = !(f && f.photo);
    $('#fuelPhoto').value = '';
    updateFuelCalc();
    openModal('modal-fuel');
  }

  function openMaintenanceModal(id) {
    const m = id ? Store.state.maintenance.find((x) => x.id === id) : null;
    $('#maintenanceModalTitle').textContent = m ? 'Wartungseintrag bearbeiten' : 'Neuer Wartungseintrag';
    $('#maintenanceId').value = m ? m.id : '';
    $('#maintenanceType').value = m ? m.type : 'Ölwechsel';
    $('#maintenanceDate').value = m ? m.date : todayIso();
    $('#maintenanceKm').value = m ? m.km || '' : Calc.currentOdometer(Store.state) || '';
    $('#maintenanceCost').value = m ? m.cost || '' : '';
    $('#maintenanceNotes').value = m ? m.notes || '' : '';
    openModal('modal-maintenance');
  }

  function openOtherCostModal(id) {
    const o = id ? Store.state.othercosts.find((x) => x.id === id) : null;
    $('#otherCostModalTitle').textContent = o ? 'Kosten bearbeiten' : 'Neue sonstige Kosten';
    $('#otherCostId').value = o ? o.id : '';
    $('#otherCostError').hidden = true;
    const knownDriver = o && Store.state.drivers.includes(o.driver);
    $('#otherCostDriver').value = o ? (knownDriver ? o.driver : OTHER_DRIVER) : Store.state.drivers[0] || OTHER_DRIVER;
    $('#otherCostOtherWrap').hidden = $('#otherCostDriver').value !== OTHER_DRIVER;
    $('#otherCostOtherName').value = o && !knownDriver ? o.driver : '';
    $('#otherCostDate').value = o ? o.date : todayIso();
    $('#otherCostTitle').value = o ? o.title || '' : '';
    $('#otherCostAmount').value = o ? o.amount : '';
    $('#otherCostNotes').value = o ? o.notes || '' : '';
    openModal('modal-othercost');
  }

  function confirmDelete(type, id, text) {
    pendingDelete = { type, id };
    $('#confirmText').textContent = text;
    openModal('modal-confirm');
  }
  function executeDelete() {
    if (!pendingDelete) return closeModal();
    const { type, id } = pendingDelete;
    if (type === 'trip') Store.deleteTrip(id);
    if (type === 'fuel') Store.deleteFuelup(id);
    if (type === 'maintenance') Store.deleteMaintenance(id);
    if (type === 'othercost') Store.deleteOtherCost(id);
    pendingDelete = null;
    closeModal();
    showToast('Eintrag gelöscht');
  }

  /* ---------------------------------------------------------
     Toast
     --------------------------------------------------------- */

  let toastTimer = null;
  function showToast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => (el.hidden = true), 220);
    }, 2200);
  }

  /* ---------------------------------------------------------
     Utils
     --------------------------------------------------------- */

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
