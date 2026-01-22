import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { propertyTypesAPI } from '../../services/api';

// Async thunks
export const fetchPropertyTypes = createAsyncThunk(
  'propertyTypes/fetchAll',
  async (params) => {
    const response = await propertyTypesAPI.getAll(params);
    return response.data;
  }
);

export const fetchPropertyTypeById = createAsyncThunk(
  'propertyTypes/fetchById',
  async (id) => {
    const response = await propertyTypesAPI.getById(id);
    return response.data;
  }
);

export const createPropertyType = createAsyncThunk(
  'propertyTypes/create',
  async (data) => {
    const response = await propertyTypesAPI.create(data);
    return response.data;
  }
);

export const updatePropertyType = createAsyncThunk(
  'propertyTypes/update',
  async ({ id, data }) => {
    const response = await propertyTypesAPI.update(id, data);
    return { id, ...response.data };
  }
);

export const deletePropertyType = createAsyncThunk(
  'propertyTypes/delete',
  async (id) => {
    await propertyTypesAPI.delete(id);
    return id;
  }
);

// Slice
const propertyTypesSlice = createSlice({
  name: 'propertyTypes',
  initialState: {
    types: [],
    currentType: null,
    loading: false,
    error: null
  },
  reducers: {
    clearCurrentType: (state) => {
      state.currentType = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all property types
      .addCase(fetchPropertyTypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPropertyTypes.fulfilled, (state, action) => {
        state.loading = false;
        state.types = action.payload;
      })
      .addCase(fetchPropertyTypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch property type by id
      .addCase(fetchPropertyTypeById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPropertyTypeById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentType = action.payload;
      })
      .addCase(fetchPropertyTypeById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Create property type
      .addCase(createPropertyType.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPropertyType.fulfilled, (state) => {
        state.loading = false;
        // Refresh list after creation
      })
      .addCase(createPropertyType.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Update property type
      .addCase(updatePropertyType.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updatePropertyType.fulfilled, (state) => {
        state.loading = false;
        // Refresh list after update
      })
      .addCase(updatePropertyType.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Delete property type
      .addCase(deletePropertyType.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deletePropertyType.fulfilled, (state, action) => {
        state.loading = false;
        state.types = state.types.filter(type => type.id !== action.payload);
      })
      .addCase(deletePropertyType.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const { clearCurrentType, clearError } = propertyTypesSlice.actions;
export default propertyTypesSlice.reducer;
