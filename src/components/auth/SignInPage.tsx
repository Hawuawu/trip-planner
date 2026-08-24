import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuthStore } from '../../store/authStore';
import signinBg from '../../assets/signin-bg.svg';
import heroBanner from '../../assets/hero-banner.svg';

const EMAIL_FOR_SIGN_IN_KEY = 'trip-planner:emailForSignIn';

type EmailSignInState =
  'closed' | 'form' | 'sending' | 'sent' | 'confirm-cross-device' | 'completing';

export function SignInPage() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const sendSignInLinkToEmail = useAuthStore((s) => s.sendSignInLinkToEmail);
  const isSignInLink = useAuthStore((s) => s.isSignInLink);
  const completeEmailLinkSignIn = useAuthStore((s) => s.completeEmailLinkSignIn);
  const authError = useAuthStore((s) => s.authError);

  const [emailState, setEmailState] = useState<EmailSignInState>('closed');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const url = window.location.href;
    if (!isSignInLink(url)) return;

    const storedEmail = localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
    if (!storedEmail) {
      setEmailState('confirm-cross-device');
      return;
    }

    setEmailState('completing');
    void completeEmailLinkSignIn(storedEmail, url).then(() => {
      if (!useAuthStore.getState().authError) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setEmailState('closed');
    });
    // isSignInLink/completeEmailLinkSignIn are stable Zustand action
    // references (defined once in the store, never reassigned), so this
    // still only runs once on mount despite the non-empty dep array.
  }, [isSignInLink, completeEmailLinkSignIn]);

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setEmailState('sending');
    await sendSignInLinkToEmail(email);
    setEmailState(useAuthStore.getState().authError ? 'form' : 'sent');
  }

  async function handleConfirmCrossDevice(e: React.FormEvent) {
    e.preventDefault();
    setEmailState('completing');
    const url = window.location.href;
    await completeEmailLinkSignIn(email, url);
    if (!useAuthStore.getState().authError) {
      window.history.replaceState(null, '', window.location.pathname);
      setEmailState('closed');
    } else {
      setEmailState('confirm-cross-device');
    }
  }

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

        {emailState === 'closed' && (
          <Button variant="text" onClick={() => setEmailState('form')} fullWidth sx={{ mt: 1 }}>
            Sign in with email instead
          </Button>
        )}

        {(emailState === 'form' || emailState === 'sending') && (
          <Box component="form" onSubmit={handleSendLink} sx={{ mt: 2, textAlign: 'left' }}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              size="small"
            />
            <Button
              type="submit"
              variant="outlined"
              fullWidth
              disabled={emailState === 'sending'}
              sx={{ mt: 1 }}
            >
              {emailState === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </Button>
          </Box>
        )}

        {emailState === 'sent' && (
          <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
            Check your email for a sign-in link.
          </Alert>
        )}

        {emailState === 'confirm-cross-device' && (
          <Box
            component="form"
            onSubmit={handleConfirmCrossDevice}
            sx={{ mt: 2, textAlign: 'left' }}
          >
            <Typography variant="body2" mb={1}>
              Confirm your email to finish signing in.
            </Typography>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              size="small"
            />
            <Button type="submit" variant="outlined" fullWidth sx={{ mt: 1 }}>
              Confirm
            </Button>
          </Box>
        )}

        {emailState === 'completing' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {authError && (
          <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
            {authError}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
