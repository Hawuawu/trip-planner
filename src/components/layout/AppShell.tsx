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
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material';
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import MapIcon from '@mui/icons-material/Map';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuIcon from '@mui/icons-material/Menu';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import { TimelineView } from '../timeline/TimelineView';
import { MapView } from '../map/MapView';
import { AlternativesShelf } from '../alternatives/AlternativesShelf';
import { OfflineBanner } from './OfflineBanner';
import { useTripStore } from '../../store/tripStore';
import { useAuthStore } from '../../store/authStore';
import { canManage } from '../../utils/tripPermissions';
import { TripMembersDialog } from '../trips/TripMembersDialog';
import { ActivityLogView } from '../trips/ActivityLogView';
import appIcon from '../../assets/app-icon.svg';
import sakuraPattern from '../../assets/sakura-pattern.svg';
import sakuraBranch from '../../assets/sakura-branch.svg';
import {
  serializeTrip,
  parseCheckpointsYaml,
  type ParsedCheckpointsYaml,
} from '../../data/tripYaml';
import { downloadTextFile, slugifyFilename } from '../../utils/fileTransfer';
import { YamlImportDialog } from '../trips/YamlImportDialog';

interface Props {
  onBack: () => void;
}

// Dedicated, absolutely-positioned layer so opacity only fades the texture —
// applying opacity to the panel Box itself would also fade its real content.
function PanelBackground({
  image,
  repeat,
  size,
  position = 'center',
}: {
  image: string;
  repeat: 'repeat' | 'no-repeat';
  size: string;
  position?: string;
}) {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${image})`,
        backgroundRepeat: repeat,
        backgroundSize: size,
        backgroundPosition: position,
        opacity: 0.05,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

// Wraps a panel's real content with the textured background behind it and a
// stacking context above it, shared by both the phone tab view and the
// tablet/desktop split view so the two layouts stay visually consistent.
function TexturedPanel({
  image,
  repeat,
  size,
  position = 'center',
  children,
}: {
  image: string;
  repeat: 'repeat' | 'no-repeat';
  size: string;
  position?: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      <PanelBackground image={image} repeat={repeat} size={size} position={position} />
      <Box sx={{ position: 'relative', zIndex: 1, height: '100%' }}>{children}</Box>
    </Box>
  );
}

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

export function AppShell({ onBack }: Props) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const isWide = useMediaQuery(theme.breakpoints.up('lg'));
  const [tab, setTab] = useState(0);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showAlternatives, setShowAlternatives] = useState(true);
  const trip = useTripStore((s) => s.trip);
  const checkpoints = useTripStore((s) => s.checkpoints);
  const alternatives = useTripStore((s) => s.alternatives);
  const activityLog = useTripStore((s) => s.activityLog);
  const currentUid = useAuthStore((s) => s.user?.uid);
  const isOwner = trip ? canManage(trip, currentUid) : false;

  const [menuOpen, setMenuOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [addCheckpointSignal, setAddCheckpointSignal] = useState(0);
  const [addAlternativeSignal, setAddAlternativeSignal] = useState(0);
  const [alternativePrefill, setAlternativePrefill] = useState<{
    name: string;
    location: { lat: number; lng: number };
  } | null>(null);

  const panelWidth = isWide ? 380 : 320;

  function handleExportTrip() {
    setMenuOpen(false);
    if (!trip) return;
    const yamlText = serializeTrip(trip, checkpoints, alternatives);
    downloadTextFile(`${slugifyFilename(trip.name, 'trip')}.yaml`, yamlText);
    setSnackbar('Trip exported.');
  }

  function handleAddCheckpoint() {
    setMenuOpen(false);
    if (isPhone) setTab(0);
    setAddCheckpointSignal((n) => n + 1);
  }

  function handleAddAlternative() {
    setMenuOpen(false);
    if (isPhone) setTab(2);
    setAlternativePrefill(null);
    setAddAlternativeSignal((n) => n + 1);
  }

  function handlePoiSelected(poi: { name: string; location: { lat: number; lng: number } }) {
    if (isPhone) setTab(2);
    setAlternativePrefill(poi);
    setAddAlternativeSignal((n) => n + 1);
  }

  async function handleImportCheckpointsConfirm(parsed: ParsedCheckpointsYaml) {
    await useTripStore.getState().importCheckpoints({
      checkpoints: parsed.checkpoints,
      alternatives: parsed.alternatives,
    });
    setSnackbar(
      `Imported ${parsed.checkpoints.length} checkpoint${parsed.checkpoints.length === 1 ? '' : 's'} and ${
        parsed.alternatives.length
      } alternative${parsed.alternatives.length === 1 ? '' : 's'}.`
    );
  }

  async function handleInviteMember(email: string) {
    return useTripStore.getState().inviteMember(email);
  }

  async function handleRemoveMember(uid: string) {
    await useTripStore.getState().removeMember(uid);
  }

  async function handleLeaveTrip() {
    await useTripStore.getState().leaveTrip();
    setMembersOpen(false);
    onBack();
  }

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="static"
        color="default"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar variant="dense">
          <IconButton
            size="small"
            aria-label="Menu"
            title="Menu"
            onClick={() => setMenuOpen(true)}
            sx={{ mr: 1 }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
          <Box
            component="img"
            src={appIcon}
            alt=""
            sx={{ width: 32, height: 32, borderRadius: 0, mr: 1.5, objectFit: 'cover' }}
          />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {trip?.name ?? "Maiyun's Trip Planner"}
          </Typography>

          <Drawer anchor="left" open={menuOpen} onClose={() => setMenuOpen(false)}>
            <Box sx={{ width: 280 }} role="presentation" data-testid="app-menu">
              <List>
                <ListItemButton onClick={handleAddCheckpoint}>
                  <ListItemIcon>
                    <AddIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Add checkpoint</ListItemText>
                </ListItemButton>
                <ListItemButton onClick={handleAddAlternative}>
                  <ListItemIcon>
                    <AddCircleOutlineIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Add alternative</ListItemText>
                </ListItemButton>
              </List>
              <Divider />
              <List>
                <ListItemButton onClick={handleExportTrip}>
                  <ListItemIcon>
                    <FileDownloadIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Export trip (.yaml)</ListItemText>
                </ListItemButton>
                <ListItemButton
                  onClick={() => {
                    setMenuOpen(false);
                    setImportDialogOpen(true);
                  }}
                >
                  <ListItemIcon>
                    <UploadFileIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Import checkpoints…</ListItemText>
                </ListItemButton>
              </List>
              {trip && (
                <>
                  <Divider />
                  <List>
                    <ListItemButton
                      onClick={() => {
                        setMenuOpen(false);
                        setMembersOpen(true);
                      }}
                    >
                      <ListItemIcon>
                        <PeopleIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Members</ListItemText>
                    </ListItemButton>
                    {isOwner && (
                      <ListItemButton
                        onClick={() => {
                          setMenuOpen(false);
                          setActivityLogOpen(true);
                        }}
                      >
                        <ListItemIcon>
                          <HistoryIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Activity log</ListItemText>
                      </ListItemButton>
                    )}
                  </List>
                </>
              )}
              <Divider />
              <List>
                <ListItemButton
                  onClick={() => {
                    setMenuOpen(false);
                    onBack();
                  }}
                >
                  <ListItemIcon>
                    <ArrowBackIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Back to trips</ListItemText>
                </ListItemButton>
              </List>
            </Box>
          </Drawer>
        </Toolbar>
      </AppBar>

      <OfflineBanner />

      {isPhone ? (
        <>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            {tab === 0 && (
              <TexturedPanel
                image={sakuraBranch}
                repeat="no-repeat"
                size="contain"
                position="top center"
              >
                <TimelineView openAddSignal={addCheckpointSignal || undefined} />
              </TexturedPanel>
            )}
            {tab === 1 && <MapView onPoiSelected={handlePoiSelected} />}
            {tab === 2 && (
              <TexturedPanel image={sakuraPattern} repeat="repeat" size="360px 360px">
                <AlternativesShelf
                  openAddSignal={addAlternativeSignal || undefined}
                  prefill={alternativePrefill}
                />
              </TexturedPanel>
            )}
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
              data-testid="timeline-panel"
              sx={{
                width: panelWidth,
                flexShrink: 0,
                borderRight: '1px solid',
                borderColor: 'divider',
                overflowY: 'auto',
              }}
            >
              <TexturedPanel
                image={sakuraBranch}
                repeat="no-repeat"
                size="contain"
                position="top center"
              >
                <TimelineView openAddSignal={addCheckpointSignal || undefined} />
              </TexturedPanel>
            </Box>
          )}

          {/* Map with toggle buttons anchored to its edges */}
          <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <MapView onPoiSelected={handlePoiSelected} />

            <PanelToggle
              side="left"
              open={showTimeline}
              label={showTimeline ? 'Collapse timeline' : 'Expand timeline'}
              onToggle={() => setShowTimeline((v) => !v)}
            />

            <PanelToggle
              side="right"
              open={showAlternatives}
              label={showAlternatives ? 'Collapse alternatives' : 'Expand alternatives'}
              onToggle={() => setShowAlternatives((v) => !v)}
            />
          </Box>

          {/* Right panel — Alternatives (tablet/desktop split view) */}
          {showAlternatives && (
            <Box
              data-testid="alternatives-panel"
              sx={{
                width: panelWidth,
                flexShrink: 0,
                borderLeft: '1px solid',
                borderColor: 'divider',
                overflowY: 'auto',
              }}
            >
              <TexturedPanel image={sakuraPattern} repeat="repeat" size="360px 360px">
                <AlternativesShelf
                  openAddSignal={addAlternativeSignal || undefined}
                  prefill={alternativePrefill}
                />
              </TexturedPanel>
            </Box>
          )}
        </Box>
      )}

      <YamlImportDialog
        open={importDialogOpen}
        title="Import checkpoints"
        description="Import checkpoints and alternatives into the current trip. A full trip export file also works — only its checkpoints/alternatives are used."
        onClose={() => setImportDialogOpen(false)}
        parse={parseCheckpointsYaml}
        onConfirm={handleImportCheckpointsConfirm}
      />

      {trip && (
        <TripMembersDialog
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          trip={trip}
          currentUid={currentUid}
          onInvite={handleInviteMember}
          onRemove={handleRemoveMember}
          onLeave={handleLeaveTrip}
        />
      )}

      {trip && (
        <ActivityLogView
          open={activityLogOpen}
          onClose={() => setActivityLogOpen(false)}
          entries={activityLog}
          isOwner={isOwner}
        />
      )}

      <Snackbar open={Boolean(snackbar)} autoHideDuration={4000} onClose={() => setSnackbar(null)}>
        <Alert onClose={() => setSnackbar(null)} severity="success" sx={{ width: '100%' }}>
          {snackbar}
        </Alert>
      </Snackbar>
    </Box>
  );
}
