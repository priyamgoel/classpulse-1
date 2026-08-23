'use client';

import React, { useState } from 'react';
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
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { AppShell } from '@/components/AppShell';
import { ClassroomCard } from '@/components/ClassroomCard';
import { EmptyState } from '@/components/EmptyState';
import { m3Tokens } from '@/theme/tokens';

// Sample mock data for Part 1 UI shell verification
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

  const selectedClassroom = sampleClassrooms.find((c) => c.id === selectedClassroomId) || sampleClassrooms[0];

  // Reserved Classroom Detail Tab Strip (Future Feature Hooks per Spec Section 7)
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
              Classrooms Overview
            </Typography>
            <Typography variant="body1" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Iteration 1 Anti-Proxy QR Attendance Shell
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            disabled
            sx={{ opacity: 0.7 }}
          >
            Create Classroom (Part 3)
          </Button>
        </Stack>

        {/* Classroom List Grid */}
        <Grid container spacing={3}>
          {sampleClassrooms.map((classroom) => (
            <Grid item xs={12} md={6} key={classroom.id}>
              <Box
                onClick={() => setSelectedClassroomId(classroom.id)}
                sx={{
                  outline: selectedClassroomId === classroom.id ? `2px solid ${m3Tokens.color.primary}` : 'none',
                  borderRadius: m3Tokens.shape.large,
                }}
              >
                <ClassroomCard {...classroom} onSelect={(id) => setSelectedClassroomId(id)} />
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Classroom Detail Section with Reserved Tab Strip */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="caption" sx={{ color: m3Tokens.color.secondary, fontWeight: 700, textTransform: 'uppercase' }}>
          Active Classroom Selection
        </Typography>
        <Typography variant="h5" sx={{ color: m3Tokens.color.onSurface, mt: 0.5, mb: 2 }}>
          {selectedClassroom.courseCode}: {selectedClassroom.courseName} ({selectedClassroom.sectionName})
        </Typography>

        {/* Reserved Detail Tab Strip Hook (Spec Section 7) */}
        <Box sx={{ borderBottom: 1, borderColor: m3Tokens.color.outlineVariant, mb: 3 }}>
          <Tabs
            value={detailTab}
            onChange={(_, newValue) => {
              if (!detailTabs[newValue].disabled) {
                setDetailTab(newValue);
              }
            }}
          >
            {detailTabs.map((tab, idx) => (
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

        {/* Active Tab Content Demo */}
        {detailTab === 0 && (
          <Box>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <CheckCircleIcon color="success" />
              <Typography variant="body1" sx={{ color: m3Tokens.color.onSurface }}>
                Attendance session engine ready for activation in Part 3 & Part 4.
              </Typography>
            </Stack>
            <EmptyState
              title="No Active Attendance Session"
              description="Sessions created by teachers will display the rotating 3-QR token stream here."
              actionLabel="Start Session (Part 4)"
              onAction={() => {}}
            />
          </Box>
        )}
      </Paper>
    </AppShell>
  );
}
