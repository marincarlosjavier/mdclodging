import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { tasksAPI } from '../../services/api';

const initialState = {
  tasks: [],
  currentTask: null,
  loading: false,
  error: null,
  filters: {
    status: null,
    task_type: null,
    priority: null,
    assigned_to: null
  }
};

// Async thunks
export const fetchTasks = createAsyncThunk(
  'tasks/fetchTasks',
  async (filters, { rejectWithValue }) => {
    try {
      const response = await tasksAPI.getAll(filters);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al cargar tareas');
    }
  }
);

export const fetchTaskById = createAsyncThunk(
  'tasks/fetchTaskById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await tasksAPI.getById(id);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al cargar tarea');
    }
  }
);

export const createTask = createAsyncThunk(
  'tasks/createTask',
  async (data, { rejectWithValue }) => {
    try {
      const response = await tasksAPI.create(data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al crear tarea');
    }
  }
);

export const updateTask = createAsyncThunk(
  'tasks/updateTask',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await tasksAPI.update(id, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al actualizar tarea');
    }
  }
);

export const deleteTask = createAsyncThunk(
  'tasks/deleteTask',
  async (id, { rejectWithValue }) => {
    try {
      await tasksAPI.delete(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al eliminar tarea');
    }
  }
);

export const importTasksFromExcel = createAsyncThunk(
  'tasks/importExcel',
  async (file, { rejectWithValue }) => {
    try {
      const response = await tasksAPI.importExcel(file);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al importar archivo');
    }
  }
);

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearCurrentTask: (state) => {
      state.currentTask = null;
    }
  },
  extraReducers: (builder) => {
    // Fetch Tasks
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Task By ID
    builder
      .addCase(fetchTaskById.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTaskById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentTask = action.payload;
      })
      .addCase(fetchTaskById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create Task
    builder
      .addCase(createTask.fulfilled, (state, action) => {
        state.tasks.unshift(action.payload);
      });

    // Update Task
    builder
      .addCase(updateTask.fulfilled, (state, action) => {
        const index = state.tasks.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
        if (state.currentTask?.id === action.payload.id) {
          state.currentTask = action.payload;
        }
      });

    // Delete Task
    builder
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.tasks = state.tasks.filter(t => t.id !== action.payload);
      });
  }
});

export const { setFilters, clearCurrentTask } = tasksSlice.actions;
export default tasksSlice.reducer;
