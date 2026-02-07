import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { reservationsAPI } from '../../services/api';

// Async thunks
export const fetchReservations = createAsyncThunk(
  'reservations/fetchAll',
  async (filters = {}) => {
    const response = await reservationsAPI.getAll(filters);
    return response.data;
  }
);

export const fetchReservationById = createAsyncThunk(
  'reservations/fetchById',
  async (id) => {
    const response = await reservationsAPI.getById(id);
    return response.data;
  }
);

export const createReservation = createAsyncThunk(
  'reservations/create',
  async (data) => {
    const response = await reservationsAPI.create(data);
    return response.data;
  }
);

export const updateReservation = createAsyncThunk(
  'reservations/update',
  async ({ id, data }) => {
    const response = await reservationsAPI.update(id, data);
    return response.data;
  }
);

export const deleteReservation = createAsyncThunk(
  'reservations/delete',
  async (id) => {
    await reservationsAPI.delete(id);
    return id;
  }
);

export const fetchBreakfastList = createAsyncThunk(
  'reservations/breakfastList',
  async (date) => {
    const response = await reservationsAPI.getBreakfastList(date);
    return response.data;
  }
);

const reservationsSlice = createSlice({
  name: 'reservations',
  initialState: {
    reservations: [],
    currentReservation: null,
    breakfastList: null,
    loading: false,
    error: null
  },
  reducers: {
    clearCurrentReservation: (state) => {
      state.currentReservation = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchReservations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReservations.fulfilled, (state, action) => {
        state.loading = false;
        state.reservations = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchReservations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch by ID
      .addCase(fetchReservationById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReservationById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentReservation = action.payload;
      })
      .addCase(fetchReservationById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Create
      .addCase(createReservation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createReservation.fulfilled, (state, action) => {
        state.loading = false;
        state.reservations.push(action.payload.reservation);
      })
      .addCase(createReservation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Update
      .addCase(updateReservation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateReservation.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.reservations.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.reservations[index] = action.payload;
        }
      })
      .addCase(updateReservation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Delete
      .addCase(deleteReservation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteReservation.fulfilled, (state, action) => {
        state.loading = false;
        state.reservations = state.reservations.filter(r => r.id !== action.payload);
      })
      .addCase(deleteReservation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Breakfast list
      .addCase(fetchBreakfastList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBreakfastList.fulfilled, (state, action) => {
        state.loading = false;
        state.breakfastList = action.payload;
      })
      .addCase(fetchBreakfastList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const { clearCurrentReservation, clearError } = reservationsSlice.actions;
export default reservationsSlice.reducer;
