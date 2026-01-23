import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import tasksReducer from './slices/tasksSlice';
import usersReducer from './slices/usersSlice';
import propertyTypesReducer from './slices/propertyTypesSlice';
import catalogReducer from './slices/catalogSlice';
import propertiesReducer from './slices/propertiesSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    tasks: tasksReducer,
    users: usersReducer,
    propertyTypes: propertyTypesReducer,
    catalog: catalogReducer,
    properties: propertiesReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
});

export default store;
