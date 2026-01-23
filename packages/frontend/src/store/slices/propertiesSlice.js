import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { propertiesAPI } from '../../services/api';

// Async thunks
export const fetchProperties = createAsyncThunk(
  'properties/fetchAll',
  async (filters = {}) => {
    const response = await propertiesAPI.getAll(filters);
    return response.data;
  }
);

export const fetchPropertyById = createAsyncThunk(
  'properties/fetchById',
  async (id) => {
    const response = await propertiesAPI.getById(id);
    return response.data;
  }
);

export const createProperty = createAsyncThunk(
  'properties/create',
  async (data) => {
    const response = await propertiesAPI.create(data);
    return response.data;
  }
);

export const updateProperty = createAsyncThunk(
  'properties/update',
  async ({ id, data }) => {
    const response = await propertiesAPI.update(id, data);
    return response.data;
  }
);

export const deleteProperty = createAsyncThunk(
  'properties/delete',
  async (id) => {
    await propertiesAPI.delete(id);
    return id;
  }
);

const propertiesSlice = createSlice({
  name: 'properties',
  initialState: {
    properties: [],
    currentProperty: null,
    loading: false,
    error: null
  },
  reducers: {
    clearCurrentProperty: (state) => {
      state.currentProperty = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchProperties.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProperties.fulfilled, (state, action) => {
        state.loading = false;
        state.properties = action.payload;
      })
      .addCase(fetchProperties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch by ID
      .addCase(fetchPropertyById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPropertyById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentProperty = action.payload;
      })
      .addCase(fetchPropertyById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Create
      .addCase(createProperty.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProperty.fulfilled, (state, action) => {
        state.loading = false;
        state.properties.push(action.payload);
      })
      .addCase(createProperty.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Update
      .addCase(updateProperty.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProperty.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.properties.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.properties[index] = action.payload;
        }
      })
      .addCase(updateProperty.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Delete
      .addCase(deleteProperty.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteProperty.fulfilled, (state, action) => {
        state.loading = false;
        state.properties = state.properties.filter(p => p.id !== action.payload);
      })
      .addCase(deleteProperty.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const { clearCurrentProperty, clearError } = propertiesSlice.actions;
export default propertiesSlice.reducer;
