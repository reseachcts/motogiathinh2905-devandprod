// Boot — wraps the app in ThemeProvider and routes the unauthenticated
// state through LoginGate.

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import LoginGate from './LoginGate';
import { ThemeProvider } from './components';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <LoginGate>
        <App/>
      </LoginGate>
    </ThemeProvider>
  </React.StrictMode>
);
