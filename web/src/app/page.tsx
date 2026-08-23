'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  Stack,
  Button,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/AppShell';
import { ClassroomCard } from '@/components/ClassroomCard';
import { EmptyState } from '@/components/EmptyState';
import { m3Tokens } from '@/theme/tokens';

const sampleClassrooms = [
  {
    id: 'c1',
    courseCode: 'UCS503P',
    courseName: 'Software Engineering Lab',
    sectionName: 'Section 3CSE1',
    teacherName: 'Dr. A. Sharma',
    studentCount: 38,
    joinCode: 'SE503A',
  },
  {
    id: 'c2',
    courseCode: 'UCS405',
    courseName: 'Discrete Mathematical Structures',
    sectionName: 'Section 3CSE2',
    teacherName: 'Prof. R. Kumar',
    studentCount: 45,
    joinCode: 'DMS405',
  },
];

export default function HomePage() {
  const [detailTab, setDetailTab] = useState(0);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('c1');

  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: m3Tokens.color.background }}>
        <CircularProgress />
      </Box>
    );
  }

  const selectedClassroom = sampleClassrooms.find((c) => c.id === selectedClassroomId) || sampleClassrooms[0];

  const detailTabs = [
    { label: 'Overview', disabled: false, tooltip: 'Attendance sessions and section overview' },
    { label: 'PulseMeter', disabled: true, tooltip: 'Coming Soon in Iteration 2: Real-time feedback' },
    { label: 'Quizzes', disabled: true, tooltip: 'Coming Soon in Iteration 2: Live quizzes & leaderboards' },
    { label: 'Forum', disabled: true, tooltip: 'Coming Soon in Iteration 2: Classroom doubt forum' },
  ];

  return (
    <AppShell>
      <Box sx={{ mb: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ color: m3Tokens.color.onSurface, mb: 0.5 }}>
              Welcome, {user.full_name}!
            </Typography>
            <Typography variant="body1" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Role: <strong>{user.role.toUpperCase()}</strong> — ClassPulse Iteration 1 Dashboard
            </Typography>
          </Box>
          {user.role === 'teacher' ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              disabled
              sx={{ opacity: 0.7 }}
            >
              Create Classroom (Part 3)
            </Button>
          ) : (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AddIcon />}
              disabled
              sx={{ opacity: 0.7 }}
            >
              Join Classroom (Part 3)
            </Button>
          )}
        </Stack>

        <Grid container spacing={3}>
          {sampleClassrooms.map((classroom) => (
            <Grid item xs={12} md={6} key={classroom.id}>
              <ClassroomCard
                {...classroom}
                selected={selectedClassroomId === classroom.id}
                onSelect={(id) => setSelectedClassroomId(id)}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="caption" sx={{ color: m3Tokens.color.secondary, fontWeight: 700, textTransform: 'uppercase' }}>
          Active Section Detail
        </Typography>
        <Typography variant="h5" sx={{ color: m3Tokens.color.onSurface, mt: 0.5, mb: 2 }}>
          {selectedClassroom.courseCode}: {selectedClassroom.courseName} ({selectedClassroom.sectionName})
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: m3Tokens.color.outlineVariant, mb: 3 }}>
          <Tabs
            value={detailTab}
            onChange={(_, newValue) => {
              if (!detailTabs[newValue].disabled) {
                setDetailTab(newValue);
              }
            }}
          >
            {detailTabs.map((tab) => (
              <Tab
                key={tab.label}
                disabled={tab.disabled}
                label={
                  <Tooltip title={tab.tooltip} arrow>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{tab.label}</span>
                      {tab.disabled && (
                        <Chip
                          label="Coming soon"
                          size="small"
                          sx={{ height: 16, fontSize: '0.6rem', backgroundColor: m3Tokens.color.surfaceVariant }}
                        />
                      )}
                    </Stack>
                  </Tooltip>
                }
                sx={{ opacity: tab.disabled ? 0.45 : 1, cursor: tab.disabled ? 'not-allowed' : 'pointer' }}
              />
            ))}
          </Tabs>
        </Box>

        {detailTab === 0 && (
          <Box>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <CheckCircleIcon color="success" />
              <Typography variant="body1" sx={{ color: m3Tokens.color.onSurface }}>
                Authenticated as <strong>{user.email}</strong> ({user.role}). Classroom management ready for Part 3.
              </Typography>
            </Stack>
            <EmptyState
              title="No Active Attendance Session"
              description="Live anti-proxy QR attendance session engine will be activated in Part 4 & Part 5."
              actionLabel={user.role === 'teacher' ? 'Start Attendance Session (Part 4)' : 'Scan QR Code (Part 5)'}
              onAction={() => {}}
            />
          </Box>
        )}
      </Paper>
    </AppShell>
  );
}
