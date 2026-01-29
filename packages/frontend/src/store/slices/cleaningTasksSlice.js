import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { cleaningTasksAPI } from '../../services/api';

// Async thunks
export const fetchCleaningTasks = createAsyncThunk(
  'cleaningTasks/fetchAll',
  async (filters = {}) => {
    const response = await cleaningTasksAPI.getAll(filters);
    return response.data;
  }
);

export const fetchTodaysTasks = createAsyncThunk(
  'cleaningTasks/fetchToday',
  async () => {
    const response = await cleaningTasksAPI.getToday();
    return response.data;
  }
);

export const fetchCleaningTaskById = createAsyncThunk(
  'cleaningTasks/fetchById',
  async (id) => {
    const response = await cleaningTasksAPI.getById(id);
    return response.data;
  }
);

export const createCleaningTask = createAsyncThunk(
  'cleaningTasks/create',
  async (data) => {
    const response = await cleaningTasksAPI.create(data);
    return response.data;
  }
);

export const updateCleaningTask = createAsyncThunk(
  'cleaningTasks/update',
  async ({ id, data }) => {
    const response = await cleaningTasksAPI.update(id, data);
    return response.data;
  }
);

export const deleteCleaningTask = createAsyncThunk(
  'cleaningTasks/delete',
  async (id) => {
    await cleaningTasksAPI.delete(id);
    return id;
  }
);

export const startCleaningTask = createAsyncThunk(
  'cleaningTasks/start',
  async (id) => {
    const response = await cleaningTasksAPI.start(id);
    return response.data;
  }
);

export const completeCleaningTask = createAsyncThunk(
  'cleaningTasks/complete',
  async ({ id, notes }) => {
    const response = await cleaningTasksAPI.complete(id, notes);
    return response.data;
  }
);

const cleaningTasksSlice = createSlice({
  name: 'cleaningTasks',
  initialState: {
    tasks: [],
    todaysTasks: null,
    currentTask: null,
    loading: false,
    error: null
  },
  reducers: {
    clearCurrentTask: (state) => {
      state.currentTask = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchCleaningTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCleaningTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchCleaningTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch today's tasks
      .addCase(fetchTodaysTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTodaysTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.todaysTasks = action.payload;
      })
      .addCase(fetchTodaysTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch by ID
      .addCase(fetchCleaningTaskById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCleaningTaskById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentTask = action.payload;
      })
      .addCase(fetchCleaningTaskById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Create
      .addCase(createCleaningTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createCleaningTask.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks.push(action.payload);
      })
      .addCase(createCleaningTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Update
      .addCase(updateCleaningTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCleaningTask.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.tasks.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
      })
      .addCase(updateCleaningTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Delete
      .addCase(deleteCleaningTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteCleaningTask.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = state.tasks.filter(t => t.id !== action.payload);
      })
      .addCase(deleteCleaningTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Start task
      .addCase(startCleaningTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(startCleaningTask.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.tasks.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
        // Update in today's tasks if present
        if (state.todaysTasks) {
          const todayIndex = state.todaysTasks.tasks.findIndex(t => t.id === action.payload.id);
          if (todayIndex !== -1) {
            state.todaysTasks.tasks[todayIndex] = action.payload;
          }
        }
      })
      .addCase(startCleaningTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Complete task
      .addCase(completeCleaningTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(completeCleaningTask.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.tasks.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
        // Update in today's tasks if present
        if (state.todaysTasks) {
          const todayIndex = state.todaysTasks.tasks.findIndex(t => t.id === action.payload.id);
          if (todayIndex !== -1) {
            state.todaysTasks.tasks[todayIndex] = action.payload;
          }
        }
      })
      .addCase(completeCleaningTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const { clearCurrentTask, clearError } = cleaningTasksSlice.actions;
export default cleaningTasksSlice.reducer;
