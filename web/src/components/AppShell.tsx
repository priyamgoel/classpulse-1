'use client';

import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  IconButton,
  Button,
  Stack,
} from '@mui/material';
import ClassIcon from '@mui/icons-material/Class';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import SpeedIcon from '@mui/icons-material/Speed';
import QuizIcon from '@mui/icons-material/Quiz';
import ForumIcon from '@mui/icons-material/Forum';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { m3Tokens } from '@/theme/tokens';

interface AppShellProps {
  children: React.ReactNode;
}

export type Role = 'teacher' | 'student';

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [role, setRole] = useState<Role>('teacher');

  const toggleRole = () => {
    setRole((prev) => (prev === 'teacher' ? 'student' : 'teacher'));
  };

  const navItems = [
    { label: 'Classrooms', icon: <ClassIcon />, disabled: false, tooltip: 'Manage and view your classrooms' },
    { label: 'Attendance', icon: <EventAvailableIcon />, disabled: false, tooltip: 'Attendance sessions and reports' },
    { label: 'PulseMeter', icon: <SpeedIcon />, disabled: true, tooltip: 'Coming Soon in Iteration 2: Real-time feedback meter' },
    { label: 'Quizzes', icon: <QuizIcon />, disabled: true, tooltip: 'Coming Soon in Iteration 2: Live classroom quizzing' },
    { label: 'Forum', icon: <ForumIcon />, disabled: true, tooltip: 'Coming Soon in Iteration 2: Doubt resolution forum' },
    { label: 'Profile', icon: <AccountCircleIcon />, disabled: false, tooltip: 'Account settings & roles' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: m3Tokens.color.background }}>
      {/* Top Application Bar */}
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h5" sx={{ fontWeight: 800, color: m3Tokens.color.primary, letterSpacing: '-0.5px' }}>
              ClassPulse
            </Typography>
            <Chip
              label="Iteration 1"
              size="small"
              sx={{ backgroundColor: m3Tokens.color.secondaryContainer, color: m3Tokens.color.onSecondaryContainer, fontSize: '0.7rem' }}
            />
          </Stack>

          {/* Role Preview Switcher */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="outlined"
              size="small"
              startIcon={<SwapHorizIcon />}
              onClick={toggleRole}
              sx={{
                borderRadius: m3Tokens.shape.full,
                borderColor: m3Tokens.color.outline,
                color: m3Tokens.color.onSurface,
              }}
            >
              Role: <strong>{role === 'teacher' ? 'Teacher' : 'Student'}</strong>
            </Button>

            <Tooltip title="User Profile">
              <IconButton color="primary">
                <AccountCircleIcon fontSize="large" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>

        {/* Mirrored Primary Navigation Bar */}
        <Box sx={{ borderTop: `1px solid ${m3Tokens.color.outlineVariant}`, px: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => {
              if (!navItems[newValue].disabled) {
                setActiveTab(newValue);
              }
            }}
            variant="scrollable"
            scrollButtons="auto"
            textColor="primary"
            indicatorColor="primary"
          >
            {navItems.map((item, index) => (
              <Tab
                key={item.label}
                disabled={item.disabled}
                label={
                  <Tooltip title={item.tooltip} arrow placement="bottom">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{item.label}</span>
                      {item.disabled && (
                        <Chip
                          label="Coming soon"
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            backgroundColor: m3Tokens.color.surfaceVariant,
                            color: m3Tokens.color.onSurfaceVariant,
                            fontWeight: 600,
                          }}
                        />
                      )}
                    </Stack>
                  </Tooltip>
                }
                icon={item.icon}
                iconPosition="start"
                sx={{
                  opacity: item.disabled ? 0.45 : 1,
                  minHeight: 48,
                  fontWeight: activeTab === index ? 700 : 500,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                }}
              />
            ))}
          </Tabs>
        </Box>
      </AppBar>

      {/* Main Content Area */}
      <Container maxWidth="lg" sx={{ flexGrow: 1, py: 4 }}>
        {children}
      </Container>
    </Box>
  );
};
