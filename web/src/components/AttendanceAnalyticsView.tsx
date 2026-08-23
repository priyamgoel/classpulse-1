'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import PeopleIcon from '@mui/icons-material/People';
import EventNoteIcon from '@mui/icons-material/EventNote';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { m3Tokens } from '@/theme/tokens';

interface AttendanceAnalyticsViewProps {
  classroomId: string;
}

interface StudentStat {
  student_id: string;
  full_name: string;
  email: string;
  joined_at: string;
  attended_sessions: number;
  attendance_percentage: string;
  avg_acl_ms: string | null;
  last_attendance_at: string | null;
}

interface SessionRecord {
  id: string;
  started_at: string;
  ended_at: string | null;
  present_count: number;
  avg_acl_ms: string | null;
}

interface ClassroomStats {
  total_sessions: number;
  total_enrolled: number;
  average_attendance_percentage: number;
  average_acl_ms: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const AttendanceAnalyticsView: React.FC<AttendanceAnalyticsViewProps> = ({ classroomId }) => {
  const [stats, setStats] = useState<ClassroomStats | null>(null);
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Student Drilldown Modal state
  const [drilldownStudent, setDrilldownStudent] = useState<StudentStat | null>(null);
  const [drilldownSessions, setDrilldownSessions] = useState<any[]>([]);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);

  useEffect(() => {
    if (classroomId) {
      fetchAnalytics();
    }
  }, [classroomId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/attendance/classroom/${classroomId}/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setStudents(data.students || []);
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStudentDrilldown = async (student: StudentStat) => {
    setDrilldownStudent(student);
    setLoadingDrilldown(true);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/attendance/classroom/${classroomId}/student/${student.student_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setDrilldownSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Error fetching student drilldown:', err);
    } finally {
      setLoadingDrilldown(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress size={32} />
        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 1 }}>
          Loading section attendance metrics...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* 1. Metric Cards Grid */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Class Attendance Rate */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: m3Tokens.shape.medium,
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: m3Tokens.color.surface,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, textTransform: 'uppercase' }}>
                Class Attendance Rate
              </Typography>
              <TrendingUpIcon sx={{ color: m3Tokens.color.primary, fontSize: 20 }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 800, color: (stats?.average_attendance_percentage ?? 0) >= 75 ? 'success.main' : 'warning.main' }}>
              {stats?.average_attendance_percentage ?? 0}%
            </Typography>
            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Across {stats?.total_sessions ?? 0} total sessions
            </Typography>
          </Paper>
        </Grid>

        {/* Total Sessions Conducted */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: m3Tokens.shape.medium,
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: m3Tokens.color.surface,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, textTransform: 'uppercase' }}>
                Sessions Conducted
              </Typography>
              <EventNoteIcon sx={{ color: m3Tokens.color.secondary, fontSize: 20 }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              {stats?.total_sessions ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Anti-Proxy QR verified
            </Typography>
          </Paper>
        </Grid>

        {/* Total Enrolled */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: m3Tokens.shape.medium,
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: m3Tokens.color.surface,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, textTransform: 'uppercase' }}>
                Enrolled Students
              </Typography>
              <PeopleIcon sx={{ color: m3Tokens.color.primary, fontSize: 20 }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              {stats?.total_enrolled ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Registered in section
            </Typography>
          </Paper>
        </Grid>

        {/* Avg Capture Latency (ACL) */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: m3Tokens.shape.medium,
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: m3Tokens.color.surface,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, textTransform: 'uppercase' }}>
                Avg Capture Latency (ACL)
              </Typography>
              <FlashOnIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              {stats?.average_acl_ms ? `${stats.average_acl_ms}ms` : '—'}
            </Typography>
            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Scan-to-validation speed
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* 2. Per-Student Attendance Breakdown Table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: m3Tokens.shape.large,
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          bgcolor: m3Tokens.color.surface,
          overflow: 'hidden',
          mb: 3.5,
        }}
      >
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
              Student Attendance Performance
            </Typography>
            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Individual attendance rate and scan latencies for enrolled students
            </Typography>
          </Box>
          <IconButton size="small" onClick={fetchAnalytics}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider />

        {students.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              No students enrolled in this section yet.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="medium">
              <TableHead sx={{ bgcolor: m3Tokens.color.surfaceVariant }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>Student</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>Attended</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, width: 220 }}>Rate %</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>Avg ACL</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, textAlign: 'right' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => {
                  const pct = parseFloat(student.attendance_percentage || '0');
                  return (
                    <TableRow key={student.student_id} hover>
                      <TableCell sx={{ fontWeight: 600, color: m3Tokens.color.onSurface }}>
                        {student.full_name}
                      </TableCell>
                      <TableCell sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        {student.email}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${student.attended_sessions} / ${stats?.total_sessions ?? 0}`}
                          size="small"
                          sx={{ fontWeight: 700, bgcolor: m3Tokens.color.surfaceVariant }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" sx={{ fontWeight: 700, color: pct >= 75 ? 'success.main' : 'warning.main' }}>
                              {pct}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, pct)}
                            color={pct >= 75 ? 'success' : 'warning'}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {student.avg_acl_ms ? (
                          <Chip
                            icon={<FlashOnIcon sx={{ fontSize: '0.75rem !important' }} />}
                            label={`${student.avg_acl_ms}ms`}
                            size="small"
                            color="secondary"
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        ) : (
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon />}
                          onClick={() => handleOpenStudentDrilldown(student)}
                        >
                          View Log
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 3. Past Sessions Timeline */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: m3Tokens.shape.large,
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          bgcolor: m3Tokens.color.surface,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
            Session History & Latency Log
          </Typography>
          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Chronological log of conducted sessions with headcount and capture latencies
          </Typography>
        </Box>
        <Divider />

        {sessions.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              No attendance sessions conducted yet for this section.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: m3Tokens.color.surfaceVariant }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Date & Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Students Present</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Avg ACL Latency</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((s, idx) => (
                  <TableRow key={s.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>
                      Session #{sessions.length - idx} • {new Date(s.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {s.ended_at ? (
                        <Chip label="COMPLETED" color="default" size="small" sx={{ fontSize: '0.65rem', fontWeight: 700 }} />
                      ) : (
                        <Chip label="ACTIVE" color="error" size="small" sx={{ fontSize: '0.65rem', fontWeight: 700 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${s.present_count} / ${stats?.total_enrolled ?? 0} present`}
                        color={s.present_count > 0 ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>
                      {s.avg_acl_ms ? (
                        <Chip
                          icon={<FlashOnIcon sx={{ fontSize: '0.75rem !important' }} />}
                          label={`${s.avg_acl_ms}ms`}
                          size="small"
                          color="secondary"
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 4. Student Attendance Drilldown Modal */}
      <Dialog
        open={Boolean(drilldownStudent)}
        onClose={() => setDrilldownStudent(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, bgcolor: m3Tokens.color.surface, borderBottom: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {drilldownStudent?.full_name}
              </Typography>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                {drilldownStudent?.email} • Attendance Drill-Down
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setDrilldownStudent(null)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, bgcolor: m3Tokens.color.background }}>
          {loadingDrilldown ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : drilldownSessions.length === 0 ? (
            <Typography variant="body2" sx={{ py: 3, textAlign: 'center', color: m3Tokens.color.onSurfaceVariant }}>
              No session records found.
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {drilldownSessions.map((s, idx) => {
                const isPresent = s.status === 'PRESENT';
                return (
                  <Paper
                    key={s.session_id || idx}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: m3Tokens.shape.medium,
                      border: `1px solid ${m3Tokens.color.outlineVariant}`,
                      bgcolor: m3Tokens.color.surface,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                          Session on {new Date(s.started_at).toLocaleDateString()} at {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                        {isPresent && s.validated_at && (
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mt: 0.25 }}>
                            Validated at {new Date(s.validated_at).toLocaleTimeString()}
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {isPresent && s.acl_ms !== undefined && (
                          <Chip
                            icon={<FlashOnIcon sx={{ fontSize: '0.75rem !important' }} />}
                            label={`ACL: ${s.acl_ms}ms`}
                            size="small"
                            color="secondary"
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        )}
                        <Chip
                          icon={isPresent ? <CheckCircleIcon sx={{ fontSize: '0.85rem !important' }} /> : <CancelIcon sx={{ fontSize: '0.85rem !important' }} />}
                          label={s.status}
                          color={isPresent ? 'success' : 'default'}
                          size="small"
                          sx={{ fontWeight: 700 }}
                        />
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: m3Tokens.color.surface, borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Button onClick={() => setDrilldownStudent(null)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
