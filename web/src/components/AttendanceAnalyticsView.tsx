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
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Snackbar,
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
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TableChartIcon from '@mui/icons-material/TableChart';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import EmailIcon from '@mui/icons-material/Email';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EditIcon from '@mui/icons-material/Edit';
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
  const [classroomInfo, setClassroomInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Export Menu state
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Warning Email Dialog state
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  // Student Drilldown Modal state
  const [drilldownStudent, setDrilldownStudent] = useState<StudentStat | null>(null);
  const [drilldownSessions, setDrilldownSessions] = useState<any[]>([]);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);
  const [overridingSessionId, setOverridingSessionId] = useState<string | null>(null);

  // Toast / Snackbar feedback
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('success');

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
        setClassroomInfo(data.classroom || null);
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

  // 1. Export Handlers (CSV & Excel)
  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExportAnchorEl(null);
    setIsExporting(true);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/attendance/classroom/${classroomId}/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const courseCode = classroomInfo?.course_code || 'Course';
      const sectionName = classroomInfo?.section_name || 'Section';
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `ClassPulse_${courseCode}_${sectionName}_${dateStr}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSnackbarSeverity('success');
      setSnackbarMessage(`Successfully downloaded attendance matrix as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Export error:', err);
      setSnackbarSeverity('error');
      setSnackbarMessage('Failed to download attendance export.');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Manual Attendance Override Handler
  const handleToggleOverride = async (sessionId: string, currentStatus: string) => {
    if (!drilldownStudent) return;
    const newStatus = currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    setOverridingSessionId(sessionId);

    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/attendance/override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          classroom_id: classroomId,
          session_id: sessionId,
          student_id: drilldownStudent.student_id,
          status: newStatus,
        }),
      });

      if (res.ok) {
        // Optimistically update the drilldown session list
        setDrilldownSessions((prev) =>
          prev.map((s) =>
            s.session_id === sessionId
              ? {
                  ...s,
                  status: newStatus,
                  validated_at: newStatus === 'PRESENT' ? new Date().toISOString() : null,
                }
              : s
          )
        );

        setSnackbarSeverity('success');
        setSnackbarMessage(`Manually marked ${drilldownStudent.full_name} as ${newStatus} for this session.`);
        // Refresh overall classroom stats in background
        fetchAnalytics();
      } else {
        const errorData = await res.json();
        setSnackbarSeverity('error');
        setSnackbarMessage(errorData.error || 'Failed to update attendance status.');
      }
    } catch (err) {
      console.error('Error updating override:', err);
      setSnackbarSeverity('error');
      setSnackbarMessage('Error connecting to server.');
    } finally {
      setOverridingSessionId(null);
    }
  };

  // 3. Send Email Warnings Handler
  const handleSendEmailWarnings = async () => {
    setIsSendingEmails(true);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/attendance/classroom/${classroomId}/send-warnings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ threshold: 75.0 }),
      });

      const data = await res.json();
      if (res.ok) {
        setWarningDialogOpen(false);
        setSnackbarSeverity('success');
        setSnackbarMessage(data.message || `Dispatched email warnings to students with <75% attendance.`);
      } else {
        setSnackbarSeverity('error');
        setSnackbarMessage(data.error || 'Failed to dispatch email warnings.');
      }
    } catch (err) {
      console.error('Error sending warning emails:', err);
      setSnackbarSeverity('error');
      setSnackbarMessage('Error sending warning emails.');
    } finally {
      setIsSendingEmails(false);
    }
  };

  const lowAttendanceStudents = students.filter(
    (s) => parseFloat(s.attendance_percentage || '0') < 75.0
  );

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
    <Box sx={{ width: '100%' }}>
      {/* Top Header Controls (Export & Email Warnings) */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
            {classroomInfo ? `${classroomInfo.course_code} — ${classroomInfo.section_name}` : 'Section Analytics'}
          </Typography>
          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Real-time anti-proxy attendance tracking, export reports, and student management
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          {/* Email Warning Action Button */}
          <Button
            variant="outlined"
            color="warning"
            startIcon={<EmailIcon />}
            onClick={() => setWarningDialogOpen(true)}
            disabled={students.length === 0 || (stats?.total_sessions ?? 0) === 0}
            sx={{ fontWeight: 700, borderRadius: '8px', textTransform: 'none' }}
          >
            Email Warnings ({lowAttendanceStudents.length})
          </Button>

          {/* Export Dropdown Button */}
          <Button
            variant="contained"
            startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
            onClick={(e) => setExportAnchorEl(e.currentTarget)}
            disabled={isExporting || students.length === 0}
            sx={{
              fontWeight: 700,
              bgcolor: m3Tokens.color.primary,
              borderRadius: '8px',
              textTransform: 'none',
              '&:hover': { bgcolor: '#4F378B' },
            }}
          >
            Export Attendance
          </Button>
          <Menu
            anchorEl={exportAnchorEl}
            open={Boolean(exportAnchorEl)}
            onClose={() => setExportAnchorEl(null)}
            PaperProps={{
              sx: { borderRadius: '10px', boxShadow: '0px 4px 20px rgba(0,0,0,0.08)', minWidth: 200 },
            }}
          >
            <MenuItem onClick={() => handleExport('xlsx')}>
              <ListItemIcon>
                <TableChartIcon fontSize="small" sx={{ color: '#1B5E20' }} />
              </ListItemIcon>
              <ListItemText primary="Export as Excel (.xlsx)" secondary="Formatted attendance sheet" />
            </MenuItem>
            <MenuItem onClick={() => handleExport('csv')}>
              <ListItemIcon>
                <InsertDriveFileIcon fontSize="small" sx={{ color: m3Tokens.color.primary }} />
              </ListItemIcon>
              <ListItemText primary="Export as CSV" secondary="Universal matrix format" />
            </MenuItem>
          </Menu>

          <IconButton size="small" onClick={fetchAnalytics} title="Refresh Data">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* Low Attendance Warning Alert Banner */}
      {lowAttendanceStudents.length > 0 && (stats?.total_sessions ?? 0) > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{
            mb: 3,
            borderRadius: '10px',
            border: '1px solid #FFE082',
            bgcolor: '#FFF8E1',
            '& .MuiAlert-message': { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
          }}
        >
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#E65100' }}>
              Attendance Shortage Warning ({lowAttendanceStudents.length} student{lowAttendanceStudents.length > 1 ? 's' : ''} below 75%)
            </Typography>
            <Typography variant="caption" sx={{ color: '#6D4C41' }}>
              These students are at risk of exam debarment. You can notify them immediately via email advisory.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="contained"
            color="warning"
            startIcon={<EmailIcon />}
            onClick={() => setWarningDialogOpen(true)}
            sx={{ fontWeight: 700, textTransform: 'none', ml: 2 }}
          >
            Send Emails
          </Button>
        </Alert>
      )}

      {/* 1. Metric Cards Grid */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Class Attendance Rate */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '12px',
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: '#FFFFFF',
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
              borderRadius: '12px',
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: '#FFFFFF',
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
              borderRadius: '12px',
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: '#FFFFFF',
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
              borderRadius: '12px',
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: '#FFFFFF',
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
          borderRadius: '12px',
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          bgcolor: '#FFFFFF',
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
              Individual attendance rate, scan latencies, and manual override controls
            </Typography>
          </Box>
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
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>Avg ACL</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => {
                  const pct = parseFloat(student.attendance_percentage || '0');
                  const isShortage = pct < 75.0 && (stats?.total_sessions ?? 0) > 0;
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
                            <Typography variant="caption" sx={{ fontWeight: 700, color: pct >= 75 ? 'success.main' : 'error.main' }}>
                              {pct}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, pct)}
                            color={pct >= 75 ? 'success' : 'error'}
                            sx={{ height: 6, borderRadius: '3px' }}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {isShortage ? (
                          <Chip
                            label="Shortage (<75%)"
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        ) : (
                          <Chip
                            label="Eligible"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        )}
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
                          sx={{ fontWeight: 600, textTransform: 'none' }}
                        >
                          View & Override
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
          borderRadius: '12px',
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          bgcolor: '#FFFFFF',
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

      {/* 4. Student Attendance Drilldown & Manual Override Modal */}
      <Dialog
        open={Boolean(drilldownStudent)}
        onClose={() => setDrilldownStudent(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {drilldownStudent?.full_name}
              </Typography>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                {drilldownStudent?.email} • Attendance History & Manual Status Override
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
              No session records found for this section.
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {drilldownSessions.map((s, idx) => {
                const isPresent = s.status === 'PRESENT';
                const isOverriding = overridingSessionId === s.session_id;

                return (
                  <Paper
                    key={s.session_id || idx}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: '8px',
                      border: `1px solid ${m3Tokens.color.outlineVariant}`,
                      bgcolor: '#FFFFFF',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                          Session #{drilldownSessions.length - idx} • {new Date(s.started_at).toLocaleDateString()} at {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                        {isPresent && s.validated_at && (
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mt: 0.25 }}>
                            Validated at {new Date(s.validated_at).toLocaleTimeString()}
                          </Typography>
                        )}
                        {!isPresent && (
                          <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.25, fontWeight: 600 }}>
                            Not recorded / Absent
                          </Typography>
                        )}
                      </Box>

                      <Stack direction="row" spacing={1.5} alignItems="center">
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

                        {/* Manual Override Action Button */}
                        <Button
                          size="small"
                          variant={isPresent ? 'outlined' : 'contained'}
                          color={isPresent ? 'error' : 'success'}
                          startIcon={isOverriding ? <CircularProgress size={14} color="inherit" /> : <EditIcon fontSize="small" />}
                          disabled={isOverriding}
                          onClick={() => handleToggleOverride(s.session_id, s.status)}
                          sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'none', py: 0.5 }}
                        >
                          {isPresent ? 'Mark Absent' : 'Mark Present'}
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Button onClick={() => setDrilldownStudent(null)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* 5. Send Email Warnings Preview Modal */}
      <Dialog
        open={warningDialogOpen}
        onClose={() => !isSendingEmails && setWarningDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Dispatch Attendance Shortage Warning Emails
            </Typography>
            <IconButton size="small" onClick={() => setWarningDialogOpen(false)} disabled={isSendingEmails}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, bgcolor: m3Tokens.color.background }}>
          <Typography variant="body2" sx={{ mb: 2, color: m3Tokens.color.onSurface }}>
            The following <strong>{lowAttendanceStudents.length}</strong> student{lowAttendanceStudents.length === 1 ? '' : 's'} have cumulative attendance below the mandatory <strong>75%</strong> requirement and will receive an official advisory email:
          </Typography>

          {lowAttendanceStudents.length === 0 ? (
            <Alert severity="success" sx={{ borderRadius: '8px' }}>
              All enrolled students currently meet or exceed the 75% attendance threshold!
            </Alert>
          ) : (
            <Paper elevation={0} sx={{ border: `1px solid ${m3Tokens.color.outlineVariant}`, borderRadius: '8px', maxHeight: 260, overflowY: 'auto' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: m3Tokens.color.surfaceVariant }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Student Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Attendance %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lowAttendanceStudents.map((s) => (
                    <TableRow key={s.student_id}>
                      <TableCell sx={{ fontWeight: 600 }}>{s.full_name}</TableCell>
                      <TableCell sx={{ color: m3Tokens.color.onSurfaceVariant, fontSize: '0.8rem' }}>{s.email}</TableCell>
                      <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: 'error.main' }}>
                        {s.attendance_percentage}% ({s.attended_sessions}/{stats?.total_sessions})
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: m3Tokens.color.onSurfaceVariant }}>
            • Emails contain official course details, current attendance statistics, and advisory notices to contact the instructor.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Button onClick={() => setWarningDialogOpen(false)} disabled={isSendingEmails} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSendEmailWarnings}
            variant="contained"
            color="warning"
            startIcon={isSendingEmails ? <CircularProgress size={16} color="inherit" /> : <EmailIcon />}
            disabled={isSendingEmails || lowAttendanceStudents.length === 0}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            {isSendingEmails ? 'Dispatching Emails...' : `Send Warning Emails (${lowAttendanceStudents.length})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Notifications */}
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={5000}
        onClose={() => setSnackbarMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbarMessage(null)}
          severity={snackbarSeverity}
          sx={{ width: '100%', borderRadius: '8px', fontWeight: 600 }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};
