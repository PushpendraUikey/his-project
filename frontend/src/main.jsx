import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout';
import Registration from './pages/Registration';
import Admission from './pages/Admission';
import Nurse from './pages/Nurse';
import Doctor from './pages/Doctor';
import Lab from './pages/Lab';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/registration" replace />} />
          <Route path="registration" element={<Registration />} />
          <Route path="admission"    element={<Admission />} />
          <Route path="nurse"        element={<Nurse />} />
          <Route path="doctor"       element={<Doctor />} />
          <Route path="lab"          element={<Lab />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
