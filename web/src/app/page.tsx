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
  IconButton,
  Alert,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import QrCodeIcon from '@mui/icons-material/QrCode';
import PeopleIcon from '@mui/icons-material/People';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PsychologyIcon from '@mui/icons-material/Psychology';
import QuizIcon from '@mui/icons-material/Quiz';
import ForumIcon from '@mui/icons-material/Forum';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/AppShell';
import { ClassroomCard } from '@/components/ClassroomCard';
import { EmptyState } from '@/components/EmptyState';
import { CreateClassroomDialog } from '@/components/CreateClassroomDialog';
import { ClassroomJoinDetailsModal } from '@/components/ClassroomJoinDetailsModal';
import { ClassroomRosterDialog } from '@/components/ClassroomRosterDialog';
import { LiveSessionModal, LiveSession } from '@/components/LiveSessionModal';
import { AttendanceAnalyticsView } from '@/components/AttendanceAnalyticsView';
import { m3Tokens } from '@/theme/tokens';

export interface Classroom {
  id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  section_name: string;
  teacher_id: string;
  teacher_name: string;
  join_code: string;
  student_count: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function HomePage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState(0);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Dialog & Modal States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinModalClassroom, setJoinModalClassroom] = useState<Classroom | null>(null);
  const [rosterDialogClassroom, setRosterDialogClassroom] = useState<Classroom | null>(null);
  const [activeLiveSession, setActiveLiveSession] = useState<LiveSession | null>(null);

  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      fetchClassrooms();
    }
  }, [user, loading, router]);

  const fetchClassrooms = async () => {
    setLoadingClassrooms(true);
    try {
      const token = localStorage.getItem('classpulse_token');
      const response = await fetch(`${API_BASE_URL}/classrooms/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        const fetched = data.classrooms || [];
        setClassrooms(fetched);
        if (fetched.length > 0 && !selectedClassroomId) {
          setSelectedClassroomId(fetched[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching classrooms:', err);
    } finally {
      setLoadingClassrooms(false);
    }
  };

  const handleStartSession = async (classroom: Classroom) => {
    setStartingSession(true);
    setSessionError(null);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ classroom_id: classroom.id }),
      });
      const data = await res.json();
      if (res.ok && data.session) {
        setActiveLiveSession(data.session);
      } else {
        setSessionError(data.error || 'Failed to start session');
      }
    } catch {
      setSessionError('Network error starting attendance session');
    } finally {
      setStartingSession(false);
    }
  };

  if (loading || !user) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: m3Tokens.color.background }}>
        <CircularProgress />
      </Box>
    );
  }

  const selectedClassroom = classrooms.find((c) => c.id === selectedClassroomId) || classrooms[0];

  const detailTabs = [
    { label: 'Overview & Analytics', disabled: false, tooltip: 'Attendance sessions, stats, and student drill-downs' },
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
              Instructor Dashboard
            </Typography>
            <Typography variant="body1" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Welcome back, <strong>{user.full_name}</strong> ({user.email})
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Classroom
          </Button>
        </Stack>

        {sessionError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSessionError(null)}>
            {sessionError}
          </Alert>
        )}

        {loadingClassrooms ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        ) : classrooms.length === 0 ? (
          <EmptyState
            title="No Classrooms Created Yet"
            description="Create your first lecture or lab section to generate student join codes."
            actionLabel="Create Classroom"
            onAction={() => setCreateDialogOpen(true)}
          />
        ) : (
          <Grid container spacing={3}>
            {classrooms.map((classroom) => (
              <Grid item xs={12} md={6} key={classroom.id}>
                <Box sx={{ position: 'relative' }}>
                  <ClassroomCard
                    id={classroom.id}
                    courseCode={classroom.course_code}
                    courseName={classroom.course_name}
                    sectionName={classroom.section_name}
                    teacherName={classroom.teacher_name || user.full_name}
                    studentCount={classroom.student_count}
                    joinCode={classroom.join_code}
                    selected={selectedClassroomId === classroom.id}
                    onSelect={(id) => setSelectedClassroomId(id)}
                  />
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}
                  >
                    <Tooltip title="View Join Credentials & QR">
                      <IconButton
                        size="small"
                        sx={{ bgcolor: m3Tokens.color.surfaceVariant }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setJoinModalClassroom(classroom);
                        }}
                      >
                        <QrCodeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Student Roster">
                      <IconButton
                        size="small"
                        sx={{ bgcolor: m3Tokens.color.surfaceVariant }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRosterDialogClassroom(classroom);
                        }}
                      >
                        <PeopleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {selectedClassroom && (
        <Paper sx={{ p: 3, mb: 4, borderRadius: m3Tokens.shape.large, border: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 2.5 }}>
            <Box>
              <Typography variant="caption" sx={{ color: m3Tokens.color.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Active Section Drill-Down
              </Typography>
              <Typography variant="h5" sx={{ color: m3Tokens.color.onSurface, mt: 0.25, fontWeight: 700 }}>
                {selectedClassroom.course_code}: {selectedClassroom.course_name} ({selectedClassroom.section_name})
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PlayArrowIcon />}
                onClick={() => handleStartSession(selectedClassroom)}
                disabled={startingSession}
              >
                {startingSession ? 'Launching...' : 'Start Session'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<QrCodeIcon />}
                size="medium"
                onClick={() => setJoinModalClassroom(selectedClassroom)}
              >
                Join Code ({selectedClassroom.join_code})
              </Button>
            </Stack>
          </Stack>

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
            <AttendanceAnalyticsView classroomId={selectedClassroom.id} />
          )}
        </Paper>
      )}

      {/* 5. Future Feature Hooks Card Grid (Section 7 Spec Requirement) */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1.5 }}>
          Reserved Future Capabilities (Iteration 2 Hooks)
        </Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: m3Tokens.shape.medium,
                border: `1px dashed ${m3Tokens.color.outlineVariant}`,
                bgcolor: m3Tokens.color.surfaceVariant,
                opacity: 0.85,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                  PulseMeter
                </Typography>
                <Chip label="Coming soon" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              </Stack>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mb: 1.5 }}>
                Real-time lecture pace and comprehension feedback stream from enrolled students.
              </Typography>
              <Button size="small" variant="text" disabled startIcon={<PsychologyIcon fontSize="small" />}>
                Launch Stream
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: m3Tokens.shape.medium,
                border: `1px dashed ${m3Tokens.color.outlineVariant}`,
                bgcolor: m3Tokens.color.surfaceVariant,
                opacity: 0.85,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                  Live Quizzes
                </Typography>
                <Chip label="Coming soon" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              </Stack>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mb: 1.5 }}>
                Instant in-class multiple-choice polling with live leaderboard distribution.
              </Typography>
              <Button size="small" variant="text" disabled startIcon={<QuizIcon fontSize="small" />}>
                Create Quiz
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: m3Tokens.shape.medium,
                border: `1px dashed ${m3Tokens.color.outlineVariant}`,
                bgcolor: m3Tokens.color.surfaceVariant,
                opacity: 0.85,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                  Doubt Forum
                </Typography>
                <Chip label="Coming soon" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              </Stack>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mb: 1.5 }}>
                Section-specific asynchronous discussion board with instructor upvoting.
              </Typography>
              <Button size="small" variant="text" disabled startIcon={<ForumIcon fontSize="small" />}>
                Open Forum
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Dialogs & Modals */}
      <CreateClassroomDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={fetchClassrooms}
      />
      <ClassroomJoinDetailsModal
        open={Boolean(joinModalClassroom)}
        onClose={() => setJoinModalClassroom(null)}
        classroom={joinModalClassroom}
        onCodeRegenerated={(newCode) => {
          if (joinModalClassroom) {
            setJoinModalClassroom({ ...joinModalClassroom, join_code: newCode });
            fetchClassrooms();
          }
        }}
      />
      <ClassroomRosterDialog
        open={Boolean(rosterDialogClassroom)}
        onClose={() => setRosterDialogClassroom(null)}
        classroom={rosterDialogClassroom}
      />
      <LiveSessionModal
        open={Boolean(activeLiveSession)}
        session={activeLiveSession}
        onClose={() => setActiveLiveSession(null)}
        onSessionEnded={() => {
          setActiveLiveSession(null);
          fetchClassrooms();
        }}
      />
    </AppShell>
  );
}
