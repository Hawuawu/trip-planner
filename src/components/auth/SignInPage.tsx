import { Box, Button, Typography, Paper } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuthStore } from '../../store/authStore';

export function SignInPage() {
  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle);

  return (
    <Box sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Paper sx={{ p: 4, maxWidth: 360, width: '100%', textAlign: 'center' }} variant="outlined">
        <Typography variant="h5" fontWeight={700} mb={0.5}>Trip Planner</Typography>
        <Typography variant="body2" color="text.secondary" mb={4}>
          Your travel itinerary companion
        </Typography>
        <Button
          variant="contained"
          startIcon={<GoogleIcon />}
          onClick={signInWithGoogle}
          fullWidth
          size="large"
        >
          Sign in with Google
        </Button>
      </Paper>
    </Box>
  );
}
