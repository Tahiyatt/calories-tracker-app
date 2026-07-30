import { create } from 'zustand';
import { api } from '../api.js';

/**
 * Zustand, not Context: the range changes often and only the dashboard reads it.
 */
export const useDashboardStore = create((set, get) => ({
  days: 30,
  data: null,
  status: 'idle', // idle | loading | ready | error
  error: null,

  setDays: (days) => {
    set({ days });
    return get().load();
  },

  load: async () => {
    // Keep the old data on screen while refetching, so switching range does not
    // blank the page and shift everything around.
    set({ status: 'loading', error: null });
    try {
      const data = await api.dashboard(get().days);
      set({ data, status: 'ready' });
    } catch (err) {
      set({ status: 'error', error: err.message });
    }
  },
}));
