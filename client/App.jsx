import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SessionProvider, useSession } from './context/SessionContext';
import HomePage from './pages/HomePage';
import FrameSelectPage from './pages/FrameSelectPage';
import CapturePage from './pages/CapturePage';
import AdjustPage from './pages/AdjustPage';
import ResultPage from './pages/ResultPage';

function AppRoutes() {
  const { setConfig } = useSession();

  // Load initial config from server
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          folder: data.activeFolder,
          captureDelay: data.captureDelay,
          captureMode: data.captureMode,
        });
      })
      .catch(() => {});
  }, [setConfig]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/frames" element={<FrameSelectPage />} />
      <Route path="/capture" element={<CapturePage />} />
      <Route path="/adjust" element={<AdjustPage />} />
      <Route path="/result" element={<ResultPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  );
}
