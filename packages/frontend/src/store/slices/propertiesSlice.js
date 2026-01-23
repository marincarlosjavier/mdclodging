import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { propertiesAPI } from '../../services/api';

export const fetchProperties = createAsyncThunk(
  'properties/fetchAll',
  async (params = {}) => {
    const response = await propertiesAPI.getAll(params);
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
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProperties.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProperties.fulfilled, (state, action) => {
        state.loading = false;
        state.properties = action.payload;
      })
      .addCase(fetchProperties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(fetchPropertyById.fulfilled, (state, action) => {
        state.currentProperty = action.payload;
      })
      .addCase(createProperty.fulfilled, (state, action) => {
        state.properties.push(action.payload.property);
      })
      .addCase(updateProperty.fulfilled, (state, action) => {
        const index = state.properties.findIndex(p => p.id === action.payload.property.id);
        if (index !== -1) {
          state.properties[index] = action.payload.property;
        }
      })
      .addCase(deleteProperty.fulfilled, (state, action) => {
        state.properties = state.properties.filter(p => p.id !== action.payload);
      });
  }
});

export const { clearCurrentProperty } = propertiesSlice.actions;
export default propertiesSlice.reducer;
