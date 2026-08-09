import { Drawer, useMediaQuery, useTheme } from '@mui/material';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose(): void;
  children?: ReactNode;
}

export function ResponsiveEditDrawer({ open, onClose, children }: Props) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Drawer
      anchor={isPhone ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isPhone ? '100%' : 380,
          borderTopLeftRadius: isPhone ? 12 : 0,
          borderTopRightRadius: isPhone ? 12 : 0,
          maxHeight: isPhone ? '85vh' : '100vh',
        },
      }}
    >
      {children}
    </Drawer>
  );
}
