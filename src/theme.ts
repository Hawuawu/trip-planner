import { createTheme } from '@mui/material';

// Soft shoujo / slice-of-life palette, sampled from the generated hero
// banner (see DESIGN.md's "Anime-styled MUI theme"). Body text and the
// current/next-checkpoint accent stay at full contrast regardless of the
// softer palette around them — bright-sunlight legibility (DESIGN.md
// priority #1) takes precedence over the pastel look.
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6B5470' },
    secondary: { main: '#D97D89' },
    background: { default: '#FBF6F2', paper: '#FFFDFB' },
    text: { primary: '#3D2E3F', secondary: '#7A6B7D' },
    divider: '#E5DCE2',
  },
  typography: {
    fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    body2: { fontSize: '0.8125rem' },
  },
  // 5px is the "main" radius used by boxes/cards/dialogs (directly, or as the
  // 1x/2x unit behind sx={{ borderRadius: 1 }} etc. throughout the app).
  // Buttons keep the previous, larger radius via the explicit override below
  // so this shrink doesn't also flatten button corners.
  shape: { borderRadius: 5 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 16 } },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
  },
});
