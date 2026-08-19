/* =========================================================
   Porsche 924 Garage — Datenmodell & Berechnungslogik
   Keine Frameworks, keine localStorage-Pflicht: läuft auch
   rein im Arbeitsspeicher (Demo-Modus), nutzt aber
   localStorage als Fallback-Persistenz, wenn verfügbar,
   und Firestore, wenn in js/firebase-config.js konfiguriert.
   ========================================================= */

const STORAGE_KEY = 'p924garage_v1';
const DEFAULT_DRIVERS = ['Silas', 'Jason', 'Elias', 'Samuel'];
const OTHER_DRIVER = 'Sonstige/r Fahrer:in';

function uid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function defaultState() {
  return {
    vehicle: {
      name: 'Porsche 924',
      year: 1979,
      engine: '2.0 Reihenvierzylinder',
      ps: 125,
      vin: '',
      photo: null,
      yearLimit: 4000,
      initialOdo: 0,
      nextOilKm: null,
      nextTuvDate: null,
    },
    drivers: DEFAULT_DRIVERS.slice(),
    trips: [],
    fuelups: [],
    maintenance: [],
  };
}

/* Safe localStorage wrapper — never throws, degrades to no-op. */
const safeStorage = {
  get(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },
};

const Store = {
  state: defaultState(),
  listeners: [],

  load() {
    const saved = safeStorage.get(STORAGE_KEY);
    if (saved) {
      this.state = Object.assign(defaultState(), saved);
      this.state.vehicle = Object.assign(defaultState().vehicle, saved.vehicle || {});
      this.state.trips = saved.trips || [];
      this.state.fuelups = saved.fuelups || [];
      this.state.maintenance = saved.maintenance || [];
      this.state.drivers = saved.drivers && saved.drivers.length ? saved.drivers : DEFAULT_DRIVERS.slice();
    }
  },

  persist() {
    safeStorage.set(STORAGE_KEY, this.state);
  },

  subscribe(fn) {
    this.listeners.push(fn);
  },

  notify() {
    this.persist();
    this.listeners.forEach((fn) => fn(this.state));
  },

  replaceAll(newState) {
    this.state = newState;
    this.notify();
  },

  // ---- Vehicle ----
  updateVehicle(patch) {
    Object.assign(this.state.vehicle, patch);
    this.notify();
  },

  // ---- Drivers ----
  addDriver(name) {
    name = (name || '').trim();
    if (!name || this.state.drivers.includes(name)) return false;
    this.state.drivers.push(name);
    this.notify();
    return true;
  },
  removeDriver(name) {
    this.state.drivers = this.state.drivers.filter((d) => d !== name);
    this.notify();
  },

  // ---- Trips ----
  upsertTrip(trip) {
    const km = Math.max(0, (trip.endKm || 0) - (trip.startKm || 0));
    const record = { ...trip, km };
    const idx = this.state.trips.findIndex((t) => t.id === trip.id);
    if (idx >= 0) this.state.trips[idx] = record;
    else this.state.trips.unshift({ ...record, id: trip.id || uid(), createdAt: Date.now() });
    this.notify();
  },
  deleteTrip(id) {
    this.state.trips = this.state.trips.filter((t) => t.id !== id);
    this.notify();
  },

  // ---- Fuelups ----
  upsertFuelup(fuelup) {
    const idx = this.state.fuelups.findIndex((f) => f.id === fuelup.id);
    if (idx >= 0) this.state.fuelups[idx] = fuelup;
    else this.state.fuelups.unshift({ ...fuelup, id: fuelup.id || uid(), createdAt: Date.now() });
    this.notify();
  },
  deleteFuelup(id) {
    this.state.fuelups = this.state.fuelups.filter((f) => f.id !== id);
    this.notify();
  },

  // ---- Maintenance ----
  upsertMaintenance(entry) {
    const idx = this.state.maintenance.findIndex((m) => m.id === entry.id);
    if (idx >= 0) this.state.maintenance[idx] = entry;
    else this.state.maintenance.unshift({ ...entry, id: entry.id || uid(), createdAt: Date.now() });
    this.notify();
  },
  deleteMaintenance(id) {
    this.state.maintenance = this.state.maintenance.filter((m) => m.id !== id);
    this.notify();
  },
};

/* =========================================================
   Berechnungen
   ========================================================= */

const Calc = {
  currentYear() {
    return new Date().getFullYear();
  },

  currentOdometer(state) {
    const maxEnd = state.trips.reduce((max, t) => Math.max(max, t.endKm || 0), 0);
    return Math.max(maxEnd, state.vehicle.initialOdo || 0);
  },

  tripsForYear(state, year) {
    return state.trips.filter((t) => t.date && new Date(t.date).getFullYear() === year);
  },

  fuelupsForYear(state, year) {
    return state.fuelups.filter((f) => f.date && new Date(f.date).getFullYear() === year);
  },

  kmThisYear(state, year) {
    return this.tripsForYear(state, year).reduce((sum, t) => sum + (t.km || 0), 0);
  },

  kmByDriver(state, year) {
    const map = {};
    state.drivers.concat([]).forEach((d) => (map[d] = 0));
    this.tripsForYear(state, year).forEach((t) => {
      const name = t.driver || OTHER_DRIVER;
      map[name] = (map[name] || 0) + (t.km || 0);
    });
    return map;
  },

  costByDriver(state, year) {
    const map = {};
    state.drivers.concat([]).forEach((d) => (map[d] = 0));
    this.fuelupsForYear(state, year).forEach((f) => {
      const name = f.driver || OTHER_DRIVER;
      map[name] = (map[name] || 0) + (f.amount || 0);
    });
    return map;
  },

  totalCostYear(state, year) {
    return this.fuelupsForYear(state, year).reduce((sum, f) => sum + (f.amount || 0), 0);
  },

  fairSplit(state, year) {
    const kmMap = this.kmByDriver(state, year);
    const costMap = this.costByDriver(state, year);
    const totalKm = Object.values(kmMap).reduce((a, b) => a + b, 0);
    const totalCost = this.totalCostYear(state, year);
    const names = new Set([...Object.keys(kmMap), ...Object.keys(costMap)]);
    const rows = [];
    names.forEach((name) => {
      const km = kmMap[name] || 0;
      const paid = costMap[name] || 0;
      const percent = totalKm > 0 ? km / totalKm : 0;
      const shouldPay = totalCost * percent;
      rows.push({ name, km, percent, paid, shouldPay, balance: paid - shouldPay });
    });
    return rows
      .filter((r) => r.km > 0 || r.paid > 0)
      .sort((a, b) => b.km - a.km);
  },

  maintenanceReminders(state) {
    const reminders = [];
    const odo = this.currentOdometer(state);
    const { nextOilKm, nextTuvDate } = state.vehicle;
    if (nextOilKm) {
      const remaining = nextOilKm - odo;
      if (remaining <= 0) {
        reminders.push({ level: 'danger', text: `Ölwechsel überfällig (seit ${Math.abs(remaining).toLocaleString('de-DE')} km)`, icon: '🛢️' });
      } else if (remaining <= 500) {
        reminders.push({ level: 'warning', text: `Ölwechsel in ${remaining.toLocaleString('de-DE')} km fällig`, icon: '🛢️' });
      }
    }
    if (nextTuvDate) {
      const days = Math.ceil((new Date(nextTuvDate) - new Date()) / 86400000);
      if (days < 0) {
        reminders.push({ level: 'danger', text: `TÜV/HU überfällig (seit ${Math.abs(days)} Tagen)`, icon: '📋' });
      } else if (days <= 30) {
        reminders.push({ level: 'warning', text: `TÜV/HU in ${days} Tagen fällig`, icon: '📋' });
      }
    }
    return reminders;
  },
};

const Fmt = {
  km(n) {
    return `${Math.round(n || 0).toLocaleString('de-DE')} km`;
  },
  eur(n) {
    return (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  },
  date(d) {
    if (!d) return '–';
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },
  initials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  },
};
