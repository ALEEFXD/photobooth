import React from 'react';
import ReactDOM from 'react-dom/client';

// Fonts (vendored via @fontsource — bundled by Vite, fully offline)
import '@fontsource/archivo-black/400.css';
import '@fontsource/work-sans/400.css';
import '@fontsource/work-sans/600.css';
import '@fontsource/space-mono/400.css';

// Styles
import './styles/tokens.css';
import './styles/reset.css';
import './styles/icons.css';
import './styles/components.css';
import './styles/print.css';

import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
