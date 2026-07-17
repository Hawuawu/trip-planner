import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (!offline) return null;

  return (
    <Box sx={{ bgcolor: 'grey.100', borderBottom: '1px solid', borderColor: 'divider', px: 2, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
      <WifiOffIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
      <Typography variant="caption" color="text.secondary">
        Saved locally — will sync when online
      </Typography>
    </Box>
  );
}
