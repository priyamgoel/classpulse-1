'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import SpeedIcon from '@mui/icons-material/Speed';
import PeopleIcon from '@mui/icons-material/People';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import BlockIcon from '@mui/icons-material/Block';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { io, Socket } from 'socket.io-client';
import { m3Tokens, chartTokens } from '@/theme/tokens';
import { WordCloudMuteDialog } from './WordCloudMuteDialog';

export interface LiveActivity {
  id: string;
  classroom_id: string;
  activity_type: 'PULSEMETER' | 'QUIZ';
  activity_ref_id: string;
  status: 'ACTIVE' | 'ENDED';
  started_at: string;
  attendance_session_id?: string | null;
  attendance_pending: boolean;
}

export interface PulseMeterInfo {
  id: string;
  title: string;
  type: 'WORD_CLOUD' | 'MCQ' | 'RATING_SCALE';
  config: any;
}

interface LivePulseMeterModalProps {
  open: boolean;
  activityId: string;
  classroomId: string;
  pulsemeter: PulseMeterInfo;
  onClose: () => void;
  onActivityEnded: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const LivePulseMeterModal: React.FC<LivePulseMeterModalProps> = ({
  open,
  activityId,
  classroomId,
  pulsemeter,
  onClose,
  onActivityEnded,
}) => {
  const [responseCount, setResponseCount] = useState<number>(0);
  const [presentCount, setPresentCount] = useState<number | null>(null);
  const [attendancePending, setAttendancePending] = useState<boolean>(true);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mute Dialog State
  const [muteDialogOpen, setMuteDialogOpen] = useState(false);
  const [muteTargetStudentId, setMuteTargetStudentId] = useState<string | undefined>(undefined);

  const socketRef = useRef<Socket | null>(null);

  // Fetch initial analytics & connect Socket.io
  useEffect(() => {
    if (!open || !activityId) return;

    fetchAnalytics();

    const socket = io(API_BASE_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_activity_teacher', activityId);
    });

    socket.on('pulsemeter:results', (data: any) => {
      if (data.activityId === activityId) {
        setResponseCount(data.responseCount || 0);
        if (data.presentCount !== undefined) setPresentCount(data.presentCount);
        if (data.attendancePending !== undefined) setAttendancePending(data.attendancePending);
        if (data.distribution) setDistribution(data.distribution);
      }
    });

    socket.on('activity:response_count', (data: any) => {
      if (data.activityId === activityId) {
        setResponseCount(data.responseCount || 0);
        if (data.presentCount !== undefined) setPresentCount(data.presentCount);
        if (data.attendancePending !== undefined) setAttendancePending(data.attendancePending);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_activity', activityId);
        socketRef.current.disconnect();
      }
    };
  }, [open, activityId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setResponseCount(data.responseCount || 0);
        setPresentCount(data.presentCount);
        setAttendancePending(data.attendancePending);
        setDistribution(data.distribution || []);
      } else {
        setError(data.error || 'Failed to load live activity analytics');
      }
    } catch {
      setError('Network error loading activity analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleEndActivity = async () => {
    setEnding(true);
    setError(null);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        onActivityEnded();
        onClose();
      } else {
        setError(data.error || 'Failed to end live activity');
      }
    } catch {
      setError('Network error ending live activity');
    } finally {
      setEnding(false);
    }
  };

  // Compute Word Cloud font sizes
  const maxWordCount = distribution.length > 0
    ? Math.max(...distribution.map((d: any) => Number(d.count) || 1))
    : 1;

  const getWordFontSize = (count: number) => {
    if (maxWordCount <= 1) return 18;
    const minSize = 14;
    const maxSize = 38;
    return Math.round(minSize + ((count - 1) / (maxWordCount - 1)) * (maxSize - minSize));
  };

  // Donut chart data for Present-vs-Responded
  const responded = responseCount;
  const nonResponded = presentCount !== null && presentCount > responded ? presentCount - responded : 0;
  const donutData = [
    { name: 'Responded', value: responded, color: chartTokens.primary },
    { name: 'Pending / Not Responded', value: nonResponded, color: '#E7E0EC' },
  ];

  const responseRate = presentCount && presentCount > 0
    ? Math.min(100, Math.round((responded / presentCount) * 100))
    : null;

  return (
    <Dialog open={open} onClose={() => {}} maxWidth="lg" fullWidth disableEscapeKeyDown>
      {/* Modal Header */}
      <DialogTitle sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <SpeedIcon sx={{ color: m3Tokens.color.primary, fontSize: 28 }} />
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                  {pulsemeter.title}
                </Typography>
                <Chip
                  label="LIVE"
                  color="error"
                  size="small"
                  sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem', animation: 'pulse 1.5s infinite' }}
                />
              </Stack>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Type: <strong>{pulsemeter.type.replace('_', ' ')}</strong> &bull; Activity ID: {activityId.slice(0, 8)}...
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip
              icon={<PeopleIcon sx={{ fontSize: '1rem !important' }} />}
              label={`${responseCount} Responded`}
              color="primary"
              variant="filled"
              sx={{ fontWeight: 700, fontSize: '0.85rem' }}
            />
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={ending ? <CircularProgress size={14} color="inherit" /> : <StopCircleIcon />}
              onClick={handleEndActivity}
              disabled={ending}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
            >
              {ending ? 'Ending...' : 'End Activity'}
            </Button>
          </Stack>
        </Stack>
      </DialogTitle>

      {/* Main Content Area */}
      <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress size={36} />
            <Typography variant="body2" sx={{ mt: 1.5, color: m3Tokens.color.onSurfaceVariant }}>
              Connecting to live activity session...
            </Typography>
          </Box>
        ) : (
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5}>
            {/* Left/Center Panel: Primary Live Chart */}
            <Box sx={{ flex: 1 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  border: `1px solid ${m3Tokens.color.outlineVariant}`,
                  bgcolor: '#FFFFFF',
                  minHeight: 380,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 1.5 }}>
                  Live Response Distribution
                </Typography>

                {/* 1. MCQ Bar Chart */}
                {pulsemeter.type === 'MCQ' && (
                  <Box sx={{ width: '100%', height: 320 }}>
                    {distribution.length === 0 ? (
                      <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          Waiting for first student response...
                        </Typography>
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distribution} margin={{ top: 15, right: 20, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} vertical={false} />
                          <XAxis
                            dataKey="option_text"
                            stroke={chartTokens.axis}
                            tick={{ fill: chartTokens.axis, fontSize: 12 }}
                            interval={0}
                          />
                          <YAxis
                            allowDecimals={false}
                            stroke={chartTokens.axis}
                            tick={{ fill: chartTokens.axis, fontSize: 12 }}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: chartTokens.tooltipBg,
                              borderColor: chartTokens.tooltipBorder,
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          />
                          <Bar dataKey="count" fill={chartTokens.primary} radius={[6, 6, 0, 0]}>
                            {distribution.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={chartTokens.palette[index % chartTokens.palette.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                )}

                {/* 2. Rating Scale Histogram */}
                {pulsemeter.type === 'RATING_SCALE' && (
                  <Box sx={{ width: '100%', height: 320 }}>
                    {distribution.length === 0 ? (
                      <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          Waiting for first student response...
                        </Typography>
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distribution} margin={{ top: 15, right: 20, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} vertical={false} />
                          <XAxis
                            dataKey="rating"
                            stroke={chartTokens.axis}
                            tick={{ fill: chartTokens.axis, fontSize: 13, fontWeight: 700 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            stroke={chartTokens.axis}
                            tick={{ fill: chartTokens.axis, fontSize: 12 }}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: chartTokens.tooltipBg,
                              borderColor: chartTokens.tooltipBorder,
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          />
                          <Bar dataKey="count" fill={chartTokens.primary} radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                )}

                {/* 3. Word Cloud Interactive View */}
                {pulsemeter.type === 'WORD_CLOUD' && (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {distribution.length === 0 ? (
                      <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          Waiting for students to submit word cloud thoughts...
                        </Typography>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          p: 3,
                          borderRadius: '12px',
                          bgcolor: m3Tokens.color.background,
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          minHeight: 240,
                        }}
                      >
                        {distribution.map((item: any, idx: number) => {
                          const size = getWordFontSize(Number(item.count));
                          const color = chartTokens.palette[idx % chartTokens.palette.length];
                          return (
                            <Tooltip key={idx} title={`Mentioned ${item.count} times`}>
                              <Typography
                                component="span"
                                sx={{
                                  fontSize: `${size}px`,
                                  fontWeight: 800,
                                  color,
                                  cursor: 'pointer',
                                  transition: 'transform 0.15s ease',
                                  userSelect: 'none',
                                  '&:hover': {
                                    transform: 'scale(1.15)',
                                  },
                                }}
                              >
                                {item.word}
                              </Typography>
                            </Tooltip>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                )}
              </Paper>
            </Box>

            {/* Right Panel: Present-vs-Responded Resolution & Moderation */}
            <Box sx={{ width: { xs: '100%', lg: 320 } }}>
              <Stack spacing={2}>
                {/* Present vs Responded Resolution Card */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '16px',
                    border: `1px solid ${m3Tokens.color.outlineVariant}`,
                    bgcolor: '#FFFFFF',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 1.5 }}>
                    Participation & Turnout
                  </Typography>

                  {attendancePending ? (
                    <Box sx={{ p: 2, borderRadius: '10px', bgcolor: m3Tokens.color.primaryContainer, mb: 1.5 }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <HourglassEmptyIcon sx={{ color: m3Tokens.color.onPrimaryContainer, fontSize: 18, mt: 0.2 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onPrimaryContainer, fontSize: '0.82rem' }}>
                            Present Count: Pending
                          </Typography>
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onPrimaryContainer, display: 'block', mt: 0.5, lineHeight: 1.3 }}>
                            Attendance has not been finalized yet. Present-vs-responded metrics will resolve automatically once today's attendance session ends.
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                      <Box sx={{ width: '100%', height: 140, position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={donutData}
                              dataKey="value"
                              cx="50%"
                              cy="50%"
                              innerRadius={42}
                              outerRadius={58}
                              startAngle={90}
                              endAngle={-270}
                            >
                              {donutData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <Box
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="h6" sx={{ fontWeight: 900, color: m3Tokens.color.primary, lineHeight: 1 }}>
                            {responseRate !== null ? `${responseRate}%` : '--'}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: m3Tokens.color.onSurfaceVariant }}>
                            RATE
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        <strong>{responded}</strong> of <strong>{presentCount}</strong> present students responded
                      </Typography>
                    </Box>
                  )}

                  <Divider sx={{ my: 1.5 }} />

                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        Total Responses:
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        {responseCount}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        Attendance Linked:
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        {attendancePending ? 'Pending Resolution' : `${presentCount} Present`}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>

                {/* Word Cloud Moderation Quick Action */}
                {pulsemeter.type === 'WORD_CLOUD' && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: '16px',
                      border: `1px solid ${m3Tokens.color.outlineVariant}`,
                      bgcolor: '#FFFFFF',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <BlockIcon sx={{ color: m3Tokens.color.error, fontSize: 18 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                        Word Cloud Moderation
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mb: 1.5 }}>
                      Mute abusive submissions for 7, 14, 30, 90, or 180 days.
                    </Typography>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<BlockIcon />}
                      onClick={() => setMuteDialogOpen(true)}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                    >
                      Mute Student
                    </Button>
                  </Paper>
                )}
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Minimize Window
        </Button>
      </DialogActions>

      {/* Mute Dialog */}
      <WordCloudMuteDialog
        open={muteDialogOpen}
        onClose={() => setMuteDialogOpen(false)}
        classroomId={classroomId}
        studentId={muteTargetStudentId}
      />
    </Dialog>
  );
};
