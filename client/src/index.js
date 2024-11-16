import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import App from './App';

// Define initial state for health monitoring
const initialState = {
  health: {
    heartRate: null,
    spO2: null,
    lastUpdated: null
  },
  location: {
    latitude: null,
    longitude: null,
    lastUpdated: null
  },
  emergency: {
    status: 'normal',
    lastIncident: null
  },
  ui: {
    loading: false,
    error: null
  }
};

// Create Redux reducers
const rootReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'UPDATE_HEALTH_DATA':
      return {
        ...state,
        health: {
          ...state.health,
          ...action.payload,
          lastUpdated: new Date().toISOString()
        }
      };
    case 'UPDATE_LOCATION':
      return {
        ...state,
        location: {
          ...state.location,
          ...action.payload,
          lastUpdated: new Date().toISOString()
        }
      };
    case 'SET_EMERGENCY_STATUS':
      return {
        ...state,
        emergency: {
          status: action.payload,
          lastIncident: action.payload === 'emergency' ? new Date().toISOString() : state.emergency.lastIncident
        }
      };
    case 'SET_LOADING':
      return {
        ...state,
        ui: {
          ...state.ui,
          loading: action.payload
        }
      };
    case 'SET_ERROR':
      return {
        ...state,
        ui: {
          ...state.ui,
          error: action.payload
        }
      };
    default:
      return state;
  }
};

// Configure Redux store
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      thunk: true
    })
});

// Configure error boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application Error:', error, errorInfo);
    // You could add error reporting service here
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="max-w-md p-8 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={() => window.location.reload()}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Performance monitoring
const reportWebVitals = (metric) => {
  // You can send metrics to your analytics service here
  console.log(metric);
};

// Initialize the application
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <App />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('ServiceWorker registration successful');
      })
      .catch((err) => {
        console.log('ServiceWorker registration failed:', err);
      });
  });
}

// Export web vitals
export { reportWebVitals };
