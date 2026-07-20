import { Alert, Box, Button, Typography, Paper } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuthStore } from '../../store/authStore';
import signinBg from '../../assets/signin-bg.svg';
import heroBanner from '../../assets/hero-banner.svg';

export function SignInPage() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const authError = useAuthStore((s) => s.authError);

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${signinBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.18,
        }}
      />
      <Paper
        sx={{ position: 'relative', p: 4, maxWidth: 360, width: '100%', textAlign: 'center' }}
        variant="outlined"
      >
        <Typography variant="h5" fontWeight={700} mb={0.5}>
          Maiyun's Trip Planner
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Your travel itinerary companion
        </Typography>
        <Box
          component="img"
          src={heroBanner}
          alt=""
          sx={{ width: '100%', mb: 3, borderRadius: 2 }}
        />
        <Button
          variant="contained"
          startIcon={<GoogleIcon />}
          onClick={signInWithGoogle}
          fullWidth
          size="large"
        >
          Sign in with Google
        </Button>
        {authError && (
          <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
            {authError}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
