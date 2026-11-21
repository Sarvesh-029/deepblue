const API_BASE = '/api/v1';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('careguard_token');
  
  const headers = {
    ...(options.headers || {})
  };

  // Only set application/json if not sending FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || `HTTP Error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  async login(email, password) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async signup({ email, password, full_name, role }) {
    return request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, role })
    });
  },

  async getMe() {
    return request('/auth/me');
  },

  // Health & Status
  async getHealth() {
    return request('/health');
  },

  async getStatus() {
    return request('/status');
  },

  // Monitor Sentinel
  async recordMonitoringConsent({ room_device, consent_type = 'ROOM_MONITORING', terms_version = '1.0' }) {
    return request('/monitor/consent', {
      method: 'POST',
      body: JSON.stringify({ room_device, consent_type, terms_version })
    });
  },

  async uploadMonitorFrame(formData) {
    return request('/monitor/frame', {
      method: 'POST',
      body: formData
    });
  },

  async getMonitoredRooms() {
    return request('/monitor/rooms');
  },

  // Enrolled Persons & Faces
  async listPersons() {
    return request('/persons');
  },

  async enrollPerson(formData) {
    return request('/persons/enroll', {
      method: 'POST',
      body: formData
    });
  },

  async deletePerson(personId) {
    return request(`/persons/${personId}`, {
      method: 'DELETE'
    });
  },

  async updateCaregiverShift(personId, { shift_start, shift_end, notes }) {
    return request(`/persons/${personId}/shift`, {
      method: 'PUT',
      body: JSON.stringify({ shift_start, shift_end, notes })
    });
  },

  // Events & Presence Tracking
  async getEventStats() {
    return request('/events/stats');
  },

  async listEvents({ limit = 50, offset = 0, event_type = null, room_device = null } = {}) {
    let query = `?limit=${limit}&offset=${offset}`;
    if (event_type) query += `&event_type=${encodeURIComponent(event_type)}`;
    if (room_device) query += `&room_device=${encodeURIComponent(room_device)}`;
    return request(`/events${query}`);
  },

  async getCaregiverPresence({ minutes = 1440, room_device = null } = {}) {
    let query = `?minutes=${minutes}`;
    if (room_device) query += `&room_device=${encodeURIComponent(room_device)}`;
    return request(`/events/presence${query}`);
  },

  async getRulesConfig() {
    return request('/events/config');
  },

  async updateRulesConfig({ unattended_minutes }) {
    return request('/events/config', {
      method: 'POST',
      body: JSON.stringify({ unattended_minutes })
    });
  },

  // Audio Distress (Edge Browser AI - Zero Audio Uploaded)
  async reportAudioDistress({ room_device, sound_class, confidence }) {
    return request('/monitor/audio-distress', {
      method: 'POST',
      body: JSON.stringify({ room_device, sound_class, confidence })
    });
  },

  // In-App Dispatched Alerts
  async listAlerts({ limit = 50 } = {}) {
    return request(`/alerts?limit=${limit}`);
  },

  async sendTestAlert({ message = 'Test Alert', room_device = 'Living Room', severity = 'high' } = {}) {
    return request('/alerts/test', {
      method: 'POST',
      body: JSON.stringify({ message, room_device, severity })
    });
  }
};
