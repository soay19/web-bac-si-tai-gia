(function () {
  const API_BASE = window.THAT_CLINIC_API_BASE || 'http://localhost:3000/api';
  const TRACKED_KEYS = [
    'thatClinicSpecialties',
    'thatClinicDoctors',
    'thatClinicPendingRequests',
    'thatClinicConfirmedAppointments',
    'thatClinicRefundNotices',
    'thatClinicUserProfile',
    'thatClinicAppointmentDraft',
    'thatClinicSeededRequests',
    'thatClinicSeedVersion'
  ];

  const isTrackedKey = (key) => TRACKED_KEYS.includes(key);

  const parseRawLocalValue = (raw) => {
    if (typeof raw !== 'string') {
      return raw;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return raw;
    }
  };

  const stringifyForLocalStorage = (value) => {
    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value);
  };

  const fetchSync = (url) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send();

    if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
      return JSON.parse(xhr.responseText);
    }

    return null;
  };

  const hydrateFromDatabase = () => {
    try {
      const keyList = encodeURIComponent(TRACKED_KEYS.join(','));
      const payload = fetchSync(`${API_BASE}/state?keys=${keyList}`);
      if (!payload || !payload.data) {
        return;
      }

      TRACKED_KEYS.forEach((key) => {
        const stateValue = payload.data[key];

        if (stateValue === null || typeof stateValue === 'undefined') {
          return;
        }

        localStorage.setItem(key, stringifyForLocalStorage(stateValue));
      });
    } catch (error) {
      // Bridge is optional, app can continue with localStorage only.
    }
  };

  const pushState = (key, value) => {
    fetch(`${API_BASE}/state/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    }).catch(() => {
      // Silent fallback to local storage.
    });
  };

  const removeState = (key) => {
    fetch(`${API_BASE}/state/${encodeURIComponent(key)}`, {
      method: 'DELETE'
    }).catch(() => {
      // Silent fallback to local storage.
    });
  };

  hydrateFromDatabase();

  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);

  localStorage.setItem = function patchedSetItem(key, value) {
    originalSetItem(key, value);

    if (!isTrackedKey(String(key))) {
      return;
    }

    pushState(String(key), parseRawLocalValue(value));
  };

  localStorage.removeItem = function patchedRemoveItem(key) {
    originalRemoveItem(key);

    if (!isTrackedKey(String(key))) {
      return;
    }

    removeState(String(key));
  };
})();
