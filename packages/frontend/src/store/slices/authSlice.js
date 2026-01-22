import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI, usersAPI } from '../../services/api';

// Load user from localStorage
const loadUser = () => {
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

const initialState = {
  ...loadUser(),
  loading: false,
  error: null
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password, subdomain }, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(email, password, subdomain);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      return { token, user };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al iniciar sesión');
    }
  }
);

export const registerTenant = createAsyncThunk(
  'auth/registerTenant',
  async (data, { rejectWithValue }) => {
    try {
      const response = await authAPI.registerTenant(data);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      return { token, user };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al registrar');
    }
  }
);

export const fetchUserProfile = createAsyncThunk(
  'auth/fetchUserProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await usersAPI.getMe();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al cargar perfil');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.token = null;
      state.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
      localStorage.setItem('user', JSON.stringify(state.user));
    }
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Register Tenant
    builder
      .addCase(registerTenant.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerTenant.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(registerTenant.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch User Profile
    builder
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        localStorage.setItem('user', JSON.stringify(action.payload));
      });
  }
});

export const { logout, updateUser } = authSlice.actions;
export default authSlice.reducer;
