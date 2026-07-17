import { useState } from 'react';
import {
  Box, BottomNavigation, BottomNavigationAction, AppBar, Toolbar,
  Typography, useMediaQuery, useTheme, IconButton,
} from '@mui/material';
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import MapIcon from '@mui/icons-material/Map';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import LogoutIcon from '@mui/icons-material/Logout';
import { TimelineView } from '../timeline/TimelineView';
import { MapView } from '../map/MapView';
import { AlternativesShelf } from '../alternatives/AlternativesShelf';
import { OfflineBanner } from './OfflineBanner';
import { useTripStore } from '../../store/tripStore';
import { useAuthStore } from '../../store/authStore';

export function AppShell() {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const isWide = useMediaQuery(theme.breakpoints.up('lg'));
  const [tab, setTab] = useState(0);
  const trip = useTripStore(s => s.trip);
  const signOut = useAuthStore(s => s.signOut);
  const service = useAuthStore(s => s.service);

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flexGrow: 1 }}>{trip?.name ?? 'Trip Planner'}</Typography>
          {service && (
            <IconButton size="small" onClick={signOut} title="Sign out">
              <LogoutIcon fontSize="small" />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <OfflineBanner />

      {isPhone ? (
        <>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            {tab === 0 && <TimelineView />}
            {tab === 1 && <MapView />}
            {tab === 2 && <AlternativesShelf />}
          </Box>
          <BottomNavigation value={tab} onChange={(_, v) => setTab(v)} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <BottomNavigationAction label="Timeline" icon={<ViewTimelineIcon />} />
            <BottomNavigationAction label="Map" icon={<MapIcon />} />
            <BottomNavigationAction label="Alternatives" icon={<BookmarkBorderIcon />} />
          </BottomNavigation>
        </>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Box sx={{ width: isWide ? 380 : 320, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider', overflowY: 'auto' }}>
            <TimelineView />
          </Box>
          <Box sx={{ flex: 1, position: 'relative' }}>
            <MapView />
          </Box>
          {isWide && (
            <Box sx={{ width: 300, flexShrink: 0, borderLeft: '1px solid', borderColor: 'divider', overflowY: 'auto' }}>
              <AlternativesShelf />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
