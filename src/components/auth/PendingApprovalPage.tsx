import { useState } from 'react';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuthStore } from '../../store/authStore';
import signinBg from '../../assets/signin-bg.svg';

// Shown to a signed-in account that doesn't have the appAccess claim yet.
// Signing in already recorded the access request (see stampAppAccess), so
// there's nothing to submit — just wait for the admin, then "Check again"
// force-refreshes the token to pick up a freshly granted claim without a
// second sign-in.
export function PendingApprovalPage() {
  const user = useAuthStore((s) => s.user);
  const refreshAccess = useAuthStore((s) => s.refreshAccess);
  const signOut = useAuthStore((s) => s.signOut);

  const [checking, setChecking] = useState(false);
  const [stillPending, setStillPending] = useState(false);

  async function handleCheckAgain() {
    setChecking(true);
    setStillPending(false);
    try {
      await refreshAccess();
      // If access was granted, the store's user updates and Root swaps this
      // screen out. If we're still mounted afterwards, nothing changed yet.
      setStillPending(true);
    } finally {
      setChecking(false);
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
          Almost there
        </Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            This app is invite-only. Your sign-in
            {user?.email ? ` as ${user.email}` : ''} has been sent to the admin for approval — check
            back once they've let you in.
          </Typography>
          {stillPending && <Alert severity="info">Not approved yet — hang tight.</Alert>}
          <Button
            variant="contained"
            size="large"
            startIcon={<RefreshIcon />}
            onClick={() => void handleCheckAgain()}
            disabled={checking}
          >
            Check again
          </Button>
          <Button size="small" startIcon={<LogoutIcon />} onClick={signOut}>
            Sign out
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
