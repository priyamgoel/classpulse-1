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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Avatar,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import QrCodeIcon from '@mui/icons-material/QrCode';
import PeopleIcon from '@mui/icons-material/People';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PsychologyIcon from '@mui/icons-material/Psychology';
import QuizIcon from '@mui/icons-material/Quiz';
import ForumIcon from '@mui/icons-material/Forum';
import DeleteIcon from '@mui/icons-material/Delete';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
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
import { PulseMeterAuthoringView } from '@/components/PulseMeterAuthoringView';
import { QuizAuthoringView } from '@/components/QuizAuthoringView';
import { DoubtForumView } from '@/components/DoubtForumView';
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
  attendance_avg_rate?: number;
  quiz_count?: number;
  pulsemeter_count?: number;
  open_doubts_count?: number;
  resolved_doubts_count?: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function HomePage() {
  const [mainNavTab, setMainNavTab] = useState(0); // 0: Classrooms, 1: Attendance, 5: Profile
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState(0);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dialog & Modal States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinModalClassroom, setJoinModalClassroom] = useState<Classroom | null>(null);
  const [rosterDialogClassroom, setRosterDialogClassroom] = useState<Classroom | null>(null);
  const [deleteConfirmClassroom, setDeleteConfirmClassroom] = useState<Classroom | null>(null);
  const [activeLiveSession, setActiveLiveSession] = useState<LiveSession | null>(null);
  const [liveSessionModalOpen, setLiveSessionModalOpen] = useState(false);

  const { user, loading, logout } = useAuth();
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
        setLiveSessionModalOpen(true);
      } else {
        setSessionError(data.error || 'Failed to start session');
      }
    } catch {
      setSessionError('Network error starting attendance session');
    } finally {
      setStartingSession(false);
    }
  };

  const handleDeleteClassroom = async (classroom: Classroom) => {
    setDeletingId(classroom.id);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/classrooms/${classroom.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDeleteConfirmClassroom(null);
        if (selectedClassroomId === classroom.id) setSelectedClassroomId(null);
        fetchClassrooms();
      } else {
        const data = await res.json();
        setSessionError(data.error || 'Failed to delete classroom');
      }
    } catch {
      setSessionError('Network error deleting classroom');
    } finally {
      setDeletingId(null);
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
    { label: 'PulseMeter', disabled: false, tooltip: 'Author and manage reusable PulseMeters' },
    { label: 'Quizzes', disabled: false, tooltip: 'Author and manage reusable live quizzes' },
    { label: 'Forum', disabled: false, tooltip: 'Classroom, course-wide, and global doubt resolution forum' },
  ];

  return (
    <AppShell activeTab={mainNavTab} onTabChange={setMainNavTab}>
      {/* Session Active Notification Banner */}
      {activeLiveSession && !liveSessionModalOpen && (
        <Alert
          severity="warning"
          sx={{ mb: 3, alignItems: 'center', borderRadius: '12px' }}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => setLiveSessionModalOpen(true)}
              >
                Re-open Projector
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={async () => {
                  const token = localStorage.getItem('classpulse_token');
                  await fetch(`${API_BASE_URL}/sessions/${activeLiveSession.id}/end`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  setActiveLiveSession(null);
                  setLiveSessionModalOpen(false);
                  fetchClassrooms();
                }}
              >
                End Session
              </Button>
            </Stack>
          }
        >
          <strong>Live session is active</strong> — {activeLiveSession.course_code}: {activeLiveSession.course_name} ({activeLiveSession.section_name}). Students can still scan. Re-open the projector or end the session.
        </Alert>
      )}

      {sessionError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSessionError(null)}>
          {sessionError}
        </Alert>
      )}

      {/* ========================================================= */}
      {/* TAB 0: CLASSROOMS DASHBOARD                               */}
      {/* ========================================================= */}
      {mainNavTab === 0 && (
        <Box>
          <Box sx={{ mb: 4 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
              <Box>
                <Typography variant="h4" sx={{ color: m3Tokens.color.onSurface, mb: 0.5, fontWeight: 700 }}>
                  Classroom Management
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
                        attendanceAvgRate={classroom.attendance_avg_rate}
                        quizCount={classroom.quiz_count}
                        pulsemeterCount={classroom.pulsemeter_count}
                        openDoubtsCount={classroom.open_doubts_count}
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
                        <Tooltip title="Delete Classroom (End of Semester)">
                          <IconButton
                            size="small"
                            sx={{ bgcolor: '#FEE2E2' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmClassroom(classroom);
                            }}
                          >
                            <DeleteIcon fontSize="small" sx={{ color: '#DC2626' }} />
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
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 4,
                borderRadius: '16px',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                bgcolor: '#FFFFFF',
              }}
            >
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
                    startIcon={<PeopleIcon />}
                    onClick={() => setRosterDialogClassroom(selectedClassroom)}
                  >
                    Roster ({selectedClassroom.student_count})
                  </Button>
                </Stack>
              </Stack>

              {/* Reserved Feature Tab Strip */}
              <Box sx={{ borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`, mb: 3 }}>
                <Tabs
                  value={detailTab}
                  onChange={(_, val) => setDetailTab(val)}
                  textColor="primary"
                  indicatorColor="primary"
                >
                  {detailTabs.map((tab) => (
                    <Tab
                      key={tab.label}
                      label={
                        <Tooltip title={tab.tooltip} arrow>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <span>{tab.label}</span>
                            {tab.disabled && (
                              <Chip
                                label="Iter 2"
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: '0.6rem',
                                  backgroundColor: m3Tokens.color.surfaceVariant,
                                  color: m3Tokens.color.onSurfaceVariant,
                                }}
                              />
                            )}
                          </Stack>
                        </Tooltip>
                      }
                      disabled={tab.disabled}
                      sx={{ fontWeight: detailTab === 0 ? 700 : 500 }}
                    />
                  ))}
                </Tabs>
              </Box>

              {/* Tab 0: Embedded Attendance Analytics */}
              {detailTab === 0 && (
                <AttendanceAnalyticsView classroomId={selectedClassroom.id} />
              )}

              {/* Tab 1: Embedded PulseMeter Authoring View */}
              {detailTab === 1 && (
                <PulseMeterAuthoringView classroomId={selectedClassroom.id} />
              )}

              {/* Tab 2: Embedded Live Quizzes Authoring View */}
              {detailTab === 2 && (
                <QuizAuthoringView classroomId={selectedClassroom.id} />
              )}

              {/* Tab 3: Embedded Doubt & Discussion Forum */}
              {detailTab === 3 && (
                <DoubtForumView
                  courseId={selectedClassroom.course_id}
                  classroomId={selectedClassroom.id}
                  courseCode={selectedClassroom.course_code}
                  courseName={selectedClassroom.course_name}
                />
              )}
            </Paper>
          )}
        </Box>
      )}

      {/* ========================================================= */}
      {/* TAB 1: DEDICATED ATTENDANCE ANALYTICS PAGE                */}
      {/* ========================================================= */}
      {mainNavTab === 1 && (
        <Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
            <Box>
              <Typography variant="h4" sx={{ color: m3Tokens.color.onSurface, mb: 0.5, fontWeight: 700 }}>
                Attendance Analytics & Reports
              </Typography>
              <Typography variant="body1" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Real-time attendance rates, student performance matrices, and past session logs.
              </Typography>
            </Box>

            {classrooms.length > 0 && (
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 260 }}>
                  <InputLabel id="classroom-select-label">Select Classroom Section</InputLabel>
                  <Select
                    labelId="classroom-select-label"
                    value={selectedClassroomId || classrooms[0].id}
                    label="Select Classroom Section"
                    onChange={(e) => setSelectedClassroomId(e.target.value)}
                  >
                    {classrooms.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        <strong>{c.course_code}</strong>: {c.section_name} ({c.course_name})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedClassroom && (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => handleStartSession(selectedClassroom)}
                    disabled={startingSession}
                  >
                    Start Session
                  </Button>
                )}
              </Stack>
            )}
          </Stack>

          {loadingClassrooms ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : classrooms.length === 0 ? (
            <EmptyState
              title="No Classrooms Available"
              description="Create a classroom first to start recording and viewing attendance analytics."
              actionLabel="Create Classroom"
              onAction={() => {
                setMainNavTab(0);
                setCreateDialogOpen(true);
              }}
            />
          ) : selectedClassroom ? (
            <AttendanceAnalyticsView classroomId={selectedClassroom.id} />
          ) : null}
        </Box>
      )}

      {/* ========================================================= */}
      {/* TAB 2: DEDICATED PULSEMETER PAGE                          */}
      {/* ========================================================= */}
      {mainNavTab === 2 && (
        <Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
            <Box>
              <Typography variant="h4" sx={{ color: m3Tokens.color.onSurface, mb: 0.5, fontWeight: 700 }}>
                PulseMeter Real-Time Polls
              </Typography>
              <Typography variant="body1" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Create, organize, and manage reusable student feedback questions and sentiment checks.
              </Typography>
            </Box>

            {classrooms.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel id="pulsemeter-classroom-select-label">Select Classroom Section</InputLabel>
                <Select
                  labelId="pulsemeter-classroom-select-label"
                  value={selectedClassroomId || classrooms[0].id}
                  label="Select Classroom Section"
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                >
                  {classrooms.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      <strong>{c.course_code}</strong>: {c.section_name} ({c.course_name})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {loadingClassrooms ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : classrooms.length === 0 ? (
            <EmptyState
              title="No Classrooms Available"
              description="Create a classroom section first to author PulseMeters."
              actionLabel="Create Classroom"
              onAction={() => {
                setMainNavTab(0);
                setCreateDialogOpen(true);
              }}
            />
          ) : selectedClassroom ? (
            <PulseMeterAuthoringView classroomId={selectedClassroom.id} />
          ) : null}
        </Box>
      )}

      {/* ========================================================= */}
      {/* TAB 3: DEDICATED LIVE QUIZZES PAGE                        */}
      {/* ========================================================= */}
      {mainNavTab === 3 && (
        <Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
            <Box>
              <Typography variant="h4" sx={{ color: m3Tokens.color.onSurface, mb: 0.5, fontWeight: 700 }}>
                Live Quizzing & Leaderboards
              </Typography>
              <Typography variant="body1" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Author and launch interactive multi-question quizzes with WIDE and NARROW scoring spreads.
              </Typography>
            </Box>

            {classrooms.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel id="quiz-classroom-select-label">Select Classroom Section</InputLabel>
                <Select
                  labelId="quiz-classroom-select-label"
                  value={selectedClassroomId || classrooms[0].id}
                  label="Select Classroom Section"
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                >
                  {classrooms.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      <strong>{c.course_code}</strong>: {c.section_name} ({c.course_name})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {loadingClassrooms ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : classrooms.length === 0 ? (
            <EmptyState
              title="No Classrooms Available"
              description="Create a classroom section first to author and manage live quizzes."
              actionLabel="Create Classroom"
              onAction={() => {
                setMainNavTab(0);
                setCreateDialogOpen(true);
              }}
            />
          ) : selectedClassroom ? (
            <QuizAuthoringView classroomId={selectedClassroom.id} />
          ) : null}
        </Box>
      )}

      {/* ========================================================= */}
      {/* TAB 4: DEDICATED DOUBT FORUM PAGE                         */}
      {/* ========================================================= */}
      {mainNavTab === 4 && (
        <Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
            <Box>
              <Typography variant="h4" sx={{ color: m3Tokens.color.onSurface, mb: 0.5, fontWeight: 700 }}>
                Doubt Resolution & Discussion Forum
              </Typography>
              <Typography variant="body1" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Browse, ask, and answer academic doubts with audience scoping, persistent pseudonyms, and instructor endorsements.
              </Typography>
            </Box>

            {classrooms.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel id="forum-classroom-select-label">Select Course / Section</InputLabel>
                <Select
                  labelId="forum-classroom-select-label"
                  value={selectedClassroomId || classrooms[0].id}
                  label="Select Course / Section"
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                >
                  {classrooms.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      <strong>{c.course_code}</strong>: {c.section_name} ({c.course_name})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {loadingClassrooms ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : classrooms.length === 0 ? (
            <EmptyState
              title="No Courses Available"
              description="Create a classroom or course first to participate in the doubt forum."
              actionLabel="Create Classroom"
              onAction={() => {
                setMainNavTab(0);
                setCreateDialogOpen(true);
              }}
            />
          ) : selectedClassroom ? (
            <DoubtForumView
              courseId={selectedClassroom.course_id}
              classroomId={selectedClassroom.id}
              courseCode={selectedClassroom.course_code}
              courseName={selectedClassroom.course_name}
            />
          ) : null}
        </Box>
      )}

      {/* ========================================================= */}
      {/* TAB 5: PROFILE & ACCOUNT SETTINGS                         */}
      {/* ========================================================= */}
      {mainNavTab === 5 && (
        <Box sx={{ maxWidth: 700, mx: 'auto', py: 2 }}>
          <Paper elevation={0} sx={{ p: 4, borderRadius: '16px', border: `1px solid ${m3Tokens.color.outlineVariant}`, bgcolor: '#FFFFFF' }}>
            <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 3 }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: m3Tokens.color.primary, fontSize: '1.5rem', fontWeight: 700 }}>
                {user.full_name ? user.full_name[0].toUpperCase() : 'I'}
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                  {user.full_name}
                </Typography>
                <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                  {user.email}
                </Typography>
                <Chip label="INSTRUCTOR ACCOUNT" size="small" color="primary" sx={{ mt: 0.75, fontWeight: 700, fontSize: '0.7rem' }} />
              </Box>
            </Stack>
            <Divider sx={{ mb: 3 }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: m3Tokens.color.onSurface }}>
              Account Overview
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: m3Tokens.color.background, borderRadius: '12px' }}>
                  <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>Total Taught Sections</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: m3Tokens.color.primary }}>{classrooms.length}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: m3Tokens.color.background, borderRadius: '12px' }}>
                  <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>Platform Role</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>Faculty / Teacher</Typography>
                </Paper>
              </Grid>
            </Grid>

            <Button
              variant="outlined"
              color="error"
              onClick={logout}
              sx={{ fontWeight: 700 }}
            >
              Sign Out
            </Button>
          </Paper>
        </Box>
      )}

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
        open={liveSessionModalOpen}
        session={activeLiveSession}
        onClose={() => setLiveSessionModalOpen(false)}
        onSessionEnded={() => {
          setActiveLiveSession(null);
          setLiveSessionModalOpen(false);
          fetchClassrooms();
        }}
      />

      {/* Delete Classroom Confirmation Dialog */}
      <Dialog open={Boolean(deleteConfirmClassroom)} onClose={() => setDeleteConfirmClassroom(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#DC2626' }}>
          Delete Classroom?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 1 }}>
            You are about to permanently delete:
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 1 }}>
            {deleteConfirmClassroom?.course_code}: {deleteConfirmClassroom?.course_name}
          </Typography>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 2 }}>
            Section: <strong>{deleteConfirmClassroom?.section_name}</strong>
          </Typography>
          <Alert severity="error" sx={{ borderRadius: '8px' }}>
            This will permanently erase all sessions, attendance records, and student enrollments for this section. This cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmClassroom(null)} variant="outlined" disabled={!!deletingId}>
            Cancel
          </Button>
          <Button
            onClick={() => deleteConfirmClassroom && handleDeleteClassroom(deleteConfirmClassroom)}
            variant="contained"
            color="error"
            disabled={!!deletingId}
          >
            {deletingId ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
