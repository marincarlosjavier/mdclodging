import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { usersAPI } from '../../services/api';

const initialState = {
  users: [],
  loading: false,
  error: null
};

// Async thunks
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (params, { rejectWithValue }) => {
    try {
      const response = await usersAPI.getAll(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al cargar usuarios');
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (data, { rejectWithValue }) => {
    try {
      const response = await usersAPI.create(data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al crear usuario');
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await usersAPI.update(id, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al actualizar usuario');
    }
  }
);

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async (id, { rejectWithValue }) => {
    try {
      await usersAPI.delete(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al eliminar usuario');
    }
  }
);

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // Fetch Users
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create User
    builder
      .addCase(createUser.fulfilled, (state, action) => {
        state.users.unshift(action.payload);
      });

    // Update User
    builder
      .addCase(updateUser.fulfilled, (state, action) => {
        const index = state.users.findIndex(u => u.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
      });

    // Delete User
    builder
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.users = state.users.filter(u => u.id !== action.payload);
      });
  }
});

export default usersSlice.reducer;
