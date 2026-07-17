import { Box, CircularProgress } from '@mui/material';
import { useAuthStore } from './store/authStore';
import { SignInPage } from './components/auth/SignInPage';
import { AppShell } from './components/layout/AppShell';

export default function App() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <Box
        sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <CircularProgress size={32} />
      </Box>
    );
  }

  return user ? <AppShell /> : <SignInPage />;
}
