import { useState } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuthStore } from '../../store/authStore';
import { extractInviteErrorMessage } from '../../utils/inviteErrors';
import signinBg from '../../assets/signin-bg.svg';

interface Props {
  token: string;
}

// Pre-auth invite-redemption screen, reached via /?invite=<token>. The invitee
// types the email they'll sign in with (Google today; the allowlist is
// email-keyed, so other providers can join later), redeeming binds the token
// to it server-side, and only then can the sign-in itself succeed.
export function InvitePage({ token }: Props) {
  const redeemInvite = useAuthStore((s) => s.redeemInvite);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const authError = useAuthStore((s) => s.authError);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  async function handleRedeem() {
    setError(null);
    setRedeeming(true);
    try {
      await redeemInvite(token, email.trim());
      // The token is single-use and now bound — drop it from the URL so a
      // reload or bookmark lands on the normal sign-in flow.
      history.replaceState(null, '', location.pathname);
      setRedeemed(true);
    } catch (err) {
      setError(extractInviteErrorMessage(err));
    } finally {
      setRedeeming(false);
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
          You're invited
        </Typography>
        {!redeemed ? (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Enter the email address you'll sign in with to accept this invite.
            </Typography>
            <TextField
              label="Your email"
              type="email"
              size="small"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={Boolean(error)}
              helperText={error ?? undefined}
              disabled={redeeming}
            />
            <Button
              variant="contained"
              size="large"
              onClick={() => void handleRedeem()}
              disabled={redeeming || !email.trim()}
            >
              Accept invite
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Alert severity="success">You're in — sign in to continue.</Alert>
            <Button
              variant="contained"
              size="large"
              startIcon={<GoogleIcon />}
              onClick={signInWithGoogle}
            >
              Sign in with Google
            </Button>
            {authError && <Alert severity="error">{authError}</Alert>}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
