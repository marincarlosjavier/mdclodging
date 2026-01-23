import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import tasksReducer from './slices/tasksSlice';
import usersReducer from './slices/usersSlice';
import propertyTypesReducer from './slices/propertyTypesSlice';
import catalogReducer from './slices/catalogSlice';
import propertiesReducer from './slices/propertiesSlice';
import reservationsReducer from './slices/reservationsSlice';
import cleaningTasksReducer from './slices/cleaningTasksSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    tasks: tasksReducer,
    users: usersReducer,
    propertyTypes: propertyTypesReducer,
    catalog: catalogReducer,
    properties: propertiesReducer,
    reservations: reservationsReducer,
    cleaningTasks: cleaningTasksReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
});

export default store;
