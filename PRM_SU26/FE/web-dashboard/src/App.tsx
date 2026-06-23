import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardLayout from '@/layouts/DashboardLayout';
import TableManagementPage from '@/pages/dashboard/TableManagementPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import MenuManagementPage from '@/pages/dashboard/MenuManagementPage';
import StaffManagementPage from '@/pages/dashboard/StaffManagementPage';
import SettingsPage from '@/pages/dashboard/SettingsPage';
import TransactionsPage from '@/pages/dashboard/TransactionsPage';
import RestaurantDrawPage from '@/pages/draw_map/RestaurantDrawPage';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm, // Light theme matching the screenshot
        token: {
          colorPrimary: '#1890ff', // Blue theme matching screenshot buttons/links
          borderRadius: 6,
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Nested Dashboard Routes inside DashboardLayout layout */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="tables" element={<TableManagementPage />} />
            <Route path="menu" element={<MenuManagementPage />} />
            <Route path="staff" element={<StaffManagementPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="draw-map" element={<RestaurantDrawPage />} />
            {/* Fallback route within dashboard layout */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
