'use client';

import { createTheme } from '@mui/material/styles';
import { m3Tokens } from './tokens';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: m3Tokens.color.primary,
      contrastText: m3Tokens.color.onPrimary,
    },
    secondary: {
      main: m3Tokens.color.secondary,
      contrastText: m3Tokens.color.onSecondary,
    },
    error: {
      main: m3Tokens.color.error,
      contrastText: m3Tokens.color.onError,
    },
    background: {
      default: m3Tokens.color.background,
      paper: m3Tokens.color.surface,
    },
    text: {
      primary: m3Tokens.color.onSurface,
      secondary: m3Tokens.color.onSurfaceVariant,
    },
    divider: m3Tokens.color.outlineVariant,
  },
  shape: {
    borderRadius: m3Tokens.shape.medium,
  },
  typography: {
    fontFamily: m3Tokens.typography.fontFamily,
    h4: {
      fontWeight: 600,
      letterSpacing: '0px',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '0px',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '0.15px',
    },
    subtitle1: {
      fontWeight: 500,
      letterSpacing: '0.15px',
    },
    body1: {
      letterSpacing: '0.25px',
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
      letterSpacing: '0.1px',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: m3Tokens.shape.full,
          padding: '10px 24px',
          boxShadow: 'none',
        },
        containedPrimary: {
          backgroundColor: m3Tokens.color.primary,
          color: m3Tokens.color.onPrimary,
          '&:hover': {
            boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.2)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: m3Tokens.shape.large,
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          boxShadow: 'none',
          backgroundColor: m3Tokens.color.surface,
          '&:hover': {
            boxShadow: '0px 2px 6px rgba(0,0,0,0.08)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: m3Tokens.shape.small,
          fontWeight: 500,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: m3Tokens.color.surface,
          color: m3Tokens.color.onSurface,
          boxShadow: 'none',
          borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: m3Tokens.shape.large,
        },
      },
    },
  },
});
