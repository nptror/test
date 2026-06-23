import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../services/api/client';

export interface UserInfo {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

interface AuthState {
  user: UserInfo | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
}

const getStoredUser = (): UserInfo | null => {
  try {
    const user = localStorage.getItem('user_info');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const initialState: AuthState = {
  user: getStoredUser(),
  accessToken: localStorage.getItem('access_token'),
  loading: false,
  error: null,
};

export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      // Mock login for Admin / Admin123 (Chấp nhận cả hoa thường: admin / Admin...)
      const emailLower = credentials.email.toLowerCase();
      if ((emailLower === 'admin' || emailLower === 'admin@smartdine.com') && credentials.password === 'Admin123') {
        const mockData: TokenResponse = {
          accessToken: 'mock_jwt_token_admin',
          refreshToken: 'mock_refresh_token_admin',
          user: {
            id: 99,
            fullName: 'Admin',
            email: 'admin@smartdine.com',
            role: 'MANAGER'
          }
        };
        localStorage.setItem('access_token', mockData.accessToken);
        localStorage.setItem('refresh_token', mockData.refreshToken);
        localStorage.setItem('user_info', JSON.stringify(mockData.user));
        return mockData;
      }

      // Typically the API endpoint returns TokenResponse wrapped in some structure, e.g. { data: TokenResponse } or direct.
      // We will handle potential API wrappers if needed, but let's stick to the current implementation.
      const response = await apiClient.post<any>('/auth/login', credentials);
      // Let's support both direct TokenResponse and wrapped { data: TokenResponse } structure
      const data = response.data.data || response.data;
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      localStorage.setItem('user_info', JSON.stringify(data.user));
      return data as TokenResponse;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_info');
    },
    updateUser: (state, action: PayloadAction<UserInfo>) => {
      state.user = action.payload;
      localStorage.setItem('user_info', JSON.stringify(action.payload));
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<TokenResponse>) => {
        state.loading = false;
        state.accessToken = action.payload.accessToken;
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { logout, updateUser } = authSlice.actions;
export default authSlice.reducer;
export const selectCurrentUser = (state: any) => state.auth.user;
export const selectIsAuthenticated = (state: any) => !!state.auth.accessToken;
export const selectAuthLoading = (state: any) => state.auth.loading;
export const selectAuthError = (state: any) => state.auth.error;
