/* =========================================================
   Porsche 924 Garage — Cloud-Synchronisierung (optional)

   Ist window.FIREBASE_CONFIG in js/firebase-config.js gesetzt,
   verbindet dieses Modul den lokalen Store mit einer Firestore-
   Datenbank, damit alle Fahrer dieselben Daten sehen. Ohne
   Konfiguration läuft die App unverändert nur lokal weiter.

   Fotos (Fahrzeugfoto, Tankbelege) werden aus Größen- und
   Kostengründen NICHT über Firestore synchronisiert, sondern
   bleiben je Gerät lokal gespeichert.
   ========================================================= */

const Sync = {
  enabled: false,
  status: 'local', // local | connecting | online | error
  db: null,
  garageId: 'porsche924-default',
  onStatusChange: null,
  _unsubs: [],

  isConfigured() {
    const c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.projectId && !String(c.apiKey).includes('XXXX'));
  },

  init(store, onStatusChange) {
    this.onStatusChange = onStatusChange || function () {};
    if (!this.isConfigured()) {
      this._setStatus('local');
      return;
    }
    if (typeof firebase === 'undefined') {
      this._setStatus('error');
      return;
    }
    this.garageId = window.FIREBASE_GARAGE_ID || 'porsche924-default';
    this._setStatus('connecting');
    try {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      this.db = firebase.firestore();
      this.enabled = true;
      this._wrapStore(store);
      this._attachListeners(store);
    } catch (e) {
      console.error('Firebase-Initialisierung fehlgeschlagen', e);
      this._setStatus('error');
    }
  },

  _setStatus(status) {
    this.status = status;
    this.onStatusChange(status);
  },

  garageRef() {
    return this.db.collection('garages').doc(this.garageId);
  },
  colRef(name) {
    return this.garageRef().collection(name);
  },

  _attachListeners(store) {
    let firstMeta = false, firstTrips = false, firstFuel = false, firstMaint = false;
    const maybeOnline = () => {
      if (firstMeta && firstTrips && firstFuel && firstMaint) this._setStatus('online');
    };

    this._unsubs.push(
      this.garageRef().onSnapshot(
        (doc) => {
          firstMeta = true;
          if (doc.exists) {
            const data = doc.data();
            if (data.vehicle) {
              const photo = store.state.vehicle.photo;
              store.state.vehicle = Object.assign({}, store.state.vehicle, data.vehicle, { photo });
            }
            if (data.drivers) store.state.drivers = data.drivers;
            store.notify();
          } else {
            this._pushMeta(store);
          }
          maybeOnline();
        },
        (err) => { console.error('Meta-Sync-Fehler', err); this._setStatus('error'); }
      )
    );

    this._unsubs.push(
      this.colRef('trips').onSnapshot(
        (snap) => {
          firstTrips = true;
          store.state.trips = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          store.notify();
          maybeOnline();
        },
        (err) => { console.error('Fahrten-Sync-Fehler', err); this._setStatus('error'); }
      )
    );

    this._unsubs.push(
      this.colRef('fuelups').onSnapshot(
        (snap) => {
          firstFuel = true;
          const oldById = {};
          store.state.fuelups.forEach((f) => (oldById[f.id] = f));
          store.state.fuelups = snap.docs
            .map((d) => {
              const data = d.data();
              const oldPhoto = oldById[d.id] ? oldById[d.id].photo : null;
              return { id: d.id, ...data, photo: oldPhoto || data.photo || null };
            })
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          store.notify();
          maybeOnline();
        },
        (err) => { console.error('Tankbuch-Sync-Fehler', err); this._setStatus('error'); }
      )
    );

    this._unsubs.push(
      this.colRef('maintenance').onSnapshot(
        (snap) => {
          firstMaint = true;
          store.state.maintenance = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          store.notify();
          maybeOnline();
        },
        (err) => { console.error('Wartungs-Sync-Fehler', err); this._setStatus('error'); }
      )
    );
  },

  _pushMeta(store) {
    if (!this.enabled) return;
    const vehicle = Object.assign({}, store.state.vehicle);
    delete vehicle.photo;
    this.garageRef().set({ vehicle, drivers: store.state.drivers }, { merge: true }).catch((e) => console.error(e));
  },

  _pushDoc(collection, record, stripFields) {
    if (!this.enabled) return;
    const data = Object.assign({}, record);
    delete data.id;
    (stripFields || []).forEach((f) => delete data[f]);
    this.colRef(collection)
      .doc(record.id)
      .set(data, { merge: true })
      .catch((e) => console.error('Push-Fehler', collection, e));
  },

  _deleteDoc(collection, id) {
    if (!this.enabled) return;
    this.colRef(collection).doc(id).delete().catch((e) => console.error('Löschen-Fehler', collection, e));
  },

  _wrapStore(store) {
    const sync = this;

    const wrap = (methodName, after) => {
      const original = store[methodName].bind(store);
      store[methodName] = function (...args) {
        const result = original(...args);
        after(...args);
        return result;
      };
    };

    wrap('updateVehicle', () => sync._pushMeta(store));
    wrap('addDriver', () => sync._pushMeta(store));
    wrap('removeDriver', () => sync._pushMeta(store));

    wrap('upsertTrip', (trip) => {
      const saved = store.state.trips.find((t) => t.id === trip.id) || store.state.trips[0];
      if (saved) sync._pushDoc('trips', saved);
    });
    wrap('deleteTrip', (id) => sync._deleteDoc('trips', id));

    wrap('upsertFuelup', (fuelup) => {
      const saved = store.state.fuelups.find((f) => f.id === fuelup.id) || store.state.fuelups[0];
      if (saved) sync._pushDoc('fuelups', saved, ['photo']);
    });
    wrap('deleteFuelup', (id) => sync._deleteDoc('fuelups', id));

    wrap('upsertMaintenance', (entry) => {
      const saved = store.state.maintenance.find((m) => m.id === entry.id) || store.state.maintenance[0];
      if (saved) sync._pushDoc('maintenance', saved);
    });
    wrap('deleteMaintenance', (id) => sync._deleteDoc('maintenance', id));
  },
};
