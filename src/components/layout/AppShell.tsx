import { useState } from 'react';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  AppBar,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  IconButton,
} from '@mui/material';
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import MapIcon from '@mui/icons-material/Map';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import LogoutIcon from '@mui/icons-material/Logout';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { TimelineView } from '../timeline/TimelineView';
import { MapView } from '../map/MapView';
import { AlternativesShelf } from '../alternatives/AlternativesShelf';
import { OfflineBanner } from './OfflineBanner';
import { useTripStore } from '../../store/tripStore';
import { useAuthStore } from '../../store/authStore';
import appIcon from '../../assets/app-icon.svg';

// Pill-shaped toggle tab stuck to the edge of the map container.
// `side` controls which edge it sits on and which border-radius corners are rounded.
function PanelToggle({
  side,
  open,
  label,
  onToggle,
}: {
  side: 'left' | 'right';
  open: boolean;
  label: string;
  onToggle: () => void;
}) {
  const isLeft = side === 'left';
  const icon = isLeft ? (
    open ? (
      <ChevronLeftIcon fontSize="small" />
    ) : (
      <ChevronRightIcon fontSize="small" />
    )
  ) : open ? (
    <ChevronRightIcon fontSize="small" />
  ) : (
    <ChevronLeftIcon fontSize="small" />
  );

  return (
    <Box
      sx={{
        position: 'absolute',
        [side]: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
      }}
    >
      <IconButton
        size="small"
        onClick={onToggle}
        aria-label={label}
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: isLeft ? '0 6px 6px 0' : '6px 0 0 6px',
          width: 20,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 1,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {icon}
      </IconButton>
    </Box>
  );
}

export function AppShell() {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const isWide = useMediaQuery(theme.breakpoints.up('lg'));
  const [tab, setTab] = useState(0);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showAlternatives, setShowAlternatives] = useState(true);
  const trip = useTripStore((s) => s.trip);
  const signOut = useAuthStore((s) => s.signOut);
  const service = useAuthStore((s) => s.service);

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="static"
        color="default"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar variant="dense">
          <Box
            component="img"
            src={appIcon}
            alt=""
            sx={{ width: 32, height: 32, borderRadius: 0, mr: 1.5, objectFit: 'cover' }}
          />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {trip?.name ?? "Maiyun's Trip Planner"}
          </Typography>
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
          <BottomNavigation
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          >
            <BottomNavigationAction label="Timeline" icon={<ViewTimelineIcon />} />
            <BottomNavigationAction label="Map" icon={<MapIcon />} />
            <BottomNavigationAction label="Alternatives" icon={<BookmarkBorderIcon />} />
          </BottomNavigation>
        </>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left panel — Timeline */}
          {showTimeline && (
            <Box
              sx={{
                width: isWide ? 380 : 320,
                flexShrink: 0,
                borderRight: '1px solid',
                borderColor: 'divider',
                overflowY: 'auto',
              }}
            >
              <TimelineView />
            </Box>
          )}

          {/* Map with toggle buttons anchored to its edges */}
          <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <MapView />

            <PanelToggle
              side="left"
              open={showTimeline}
              label={showTimeline ? 'Collapse timeline' : 'Expand timeline'}
              onToggle={() => setShowTimeline((v) => !v)}
            />

            {isWide && (
              <PanelToggle
                side="right"
                open={showAlternatives}
                label={showAlternatives ? 'Collapse alternatives' : 'Expand alternatives'}
                onToggle={() => setShowAlternatives((v) => !v)}
              />
            )}
          </Box>

          {/* Right panel — Alternatives (desktop only) */}
          {isWide && showAlternatives && (
            <Box
              sx={{
                width: 300,
                flexShrink: 0,
                borderLeft: '1px solid',
                borderColor: 'divider',
                overflowY: 'auto',
              }}
            >
              <AlternativesShelf />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
