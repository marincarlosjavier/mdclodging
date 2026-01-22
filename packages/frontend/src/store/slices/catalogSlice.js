import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { catalogAPI } from '../../services/api';

export const fetchCatalogItems = createAsyncThunk(
  'catalog/fetchAll',
  async (params) => {
    const response = await catalogAPI.getAll(params);
    return response.data;
  }
);

export const fetchCatalogItemById = createAsyncThunk(
  'catalog/fetchById',
  async (id) => {
    const response = await catalogAPI.getById(id);
    return response.data;
  }
);

export const createCatalogItem = createAsyncThunk(
  'catalog/create',
  async (data) => {
    const response = await catalogAPI.create(data);
    return response.data;
  }
);

export const updateCatalogItem = createAsyncThunk(
  'catalog/update',
  async ({ id, data }) => {
    const response = await catalogAPI.update(id, data);
    return response.data;
  }
);

export const deleteCatalogItem = createAsyncThunk(
  'catalog/delete',
  async (id) => {
    await catalogAPI.delete(id);
    return id;
  }
);

const catalogSlice = createSlice({
  name: 'catalog',
  initialState: {
    items: [],
    currentItem: null,
    loading: false,
    error: null
  },
  reducers: {
    clearCurrentItem: (state) => {
      state.currentItem = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCatalogItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCatalogItems.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchCatalogItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(createCatalogItem.fulfilled, (state, action) => {
        state.items.push(action.payload.item);
      })
      .addCase(updateCatalogItem.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.item.id);
        if (index !== -1) {
          state.items[index] = action.payload.item;
        }
      })
      .addCase(deleteCatalogItem.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload);
      });
  }
});

export const { clearCurrentItem } = catalogSlice.actions;
export default catalogSlice.reducer;
