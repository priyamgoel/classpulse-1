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
  Grid,
  Paper,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { QRCodeSVG } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';
import { m3Tokens } from '@/theme/tokens';

export interface LiveSession {
  id: string;
  classroom_id: string;
  course_code: string;
  course_name: string;
  section_name: string;
  started_at: string;
}

interface Attendee {
  id: string;
  student: {
    id: string;
    full_name: string;
    email: string;
  };
  validated_at: string;
  acl_ms?: number;
  status: string;
}

interface QrToken {
  session_id: string;
  batch_id: string;
  seq_idx: number;
  timestamp: number;
  token_id: string;
  hash: string;
  qr_payload?: string;
}

interface TokenBatch {
  batch_id: string;
  timestamp: number;
  tokens: QrToken[];
}

interface LiveSessionModalProps {
  open: boolean;
  session: LiveSession | null;
  onClose: () => void;
  onSessionEnded: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const LiveSessionModal: React.FC<LiveSessionModalProps> = ({
  open,
  session,
  onClose,
  onSessionEnded,
}) => {
  const [tokenBatch, setTokenBatch] = useState<TokenBatch | null>(null);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);

  // 1. Initialize Socket.io & Fetch Existing Roster
  useEffect(() => {
    if (!open || !session) return;

    const socket = io(API_BASE_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_session', session.id);
    });

    socket.on('attendance:marked', (data: any) => {
      setAttendees((prev) => {
        if (prev.some((a) => a.student.id === data.student.id)) return prev;
        return [
          {
            id: data.student.id,
            student: data.student,
            validated_at: data.validated_at,
            acl_ms: data.acl_ms,
            status: data.status,
          },
          ...prev,
        ];
      });
    });

    fetchRoster(session.id);
    fetchActiveTokens(session.id);

    fetchIntervalRef.current = setInterval(() => {
      fetchActiveTokens(session.id);
    }, 3000);

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_session', session.id);
        socketRef.current.disconnect();
      }
      if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
      if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);
    };
  }, [open, session]);

  // 2. High-speed 3-QR frame rotation (every 800ms)
  useEffect(() => {
    if (!open || !tokenBatch || tokenBatch.tokens.length === 0) return;

    if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);

    rotationIntervalRef.current = setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % 3);
    }, 800);

    return () => {
      if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);
    };
  }, [open, tokenBatch]);

  const fetchRoster = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/attendance/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.attendance) {
        const mapped: Attendee[] = data.attendance.map((ar: any) => ({
          id: ar.id,
          student: {
            id: ar.student_id,
            full_name: ar.full_name,
            email: ar.email,
          },
          validated_at: ar.validated_at,
          acl_ms: ar.acl_ms,
          status: ar.status,
        }));
        setAttendees(mapped);
      }
    } catch (err) {
      console.error('Error fetching session roster:', err);
    }
  };

  const fetchActiveTokens = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/active-tokens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.token_batch) {
        setTokenBatch(data.token_batch);
      }
    } catch (err) {
      console.error('Error fetching active tokens:', err);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    setEnding(true);
    setError(null);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/sessions/${session.id}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        if (isFullscreen) {
          setIsFullscreen(false);
        }
        onSessionEnded();
        onClose();
      } else {
        setError(data.error || 'Failed to end session');
      }
    } catch {
      setError('Network error ending session');
    } finally {
      setEnding(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  if (!session) return null;

  const currentToken = tokenBatch?.tokens?.[currentFrameIdx] || null;
  // Use compact qr_payload string for maximum dot thickness and scannability
  const qrStringPayload = currentToken
    ? currentToken.qr_payload || JSON.stringify(currentToken)
    : '';

  // -------------------------------------------------------------
  // Fullscreen Theater / Projector View
  // -------------------------------------------------------------
  if (isFullscreen) {
    return (
      <Box
        ref={fullscreenContainerRef}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          bgcolor: '#FFFFFF',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 3,
          boxSizing: 'border-box',
        }}
      >
        {/* Fullscreen Header */}
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip label="LIVE PROJECTOR MODE" color="error" sx={{ fontWeight: 900, fontSize: '0.85rem' }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              {session.course_code}: {session.course_name}
            </Typography>
            <Typography variant="subtitle1" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Section: <strong>{session.section_name}</strong>
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<FullscreenExitIcon />}
              onClick={toggleFullscreen}
            >
              Exit Fullscreen
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleEndSession}
              disabled={ending}
            >
              {ending ? 'Ending...' : 'End Session'}
            </Button>
          </Stack>
        </Box>

        {/* Center: Massive Chunky QR Code */}
        <Box sx={{ textAlign: 'center', my: 'auto' }}>
          <Box
            sx={{
              p: 3,
              bgcolor: '#FFFFFF',
              borderRadius: '24px',
              border: `4px solid ${m3Tokens.color.primary}`,
              boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.12)',
              display: 'inline-block',
            }}
          >
            {qrStringPayload ? (
              <QRCodeSVG
                value={qrStringPayload}
                size={540}
                level="L" // Low error correction = biggest, thickest scannable dots
                includeMargin={true}
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 540, height: 540 }}>
                <CircularProgress size={60} />
              </Box>
            )}
          </Box>

          {/* Rotating Frame Status Tracker */}
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2.5 }}>
            {[0, 1, 2].map((idx) => (
              <Chip
                key={idx}
                label={`Frame ${idx + 1} / 3`}
                color={currentFrameIdx === idx ? 'primary' : 'default'}
                variant={currentFrameIdx === idx ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 800,
                  fontSize: '1rem',
                  py: 2.5,
                  px: 2,
                  borderRadius: '12px',
                  transform: currentFrameIdx === idx ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.15s ease-in-out',
                }}
              />
            ))}
          </Stack>
        </Box>

        {/* Fullscreen Bottom Roster Ribbon */}
        <Box
          sx={{
            width: '100%',
            maxWidth: 1100,
            p: 1.5,
            bgcolor: m3Tokens.color.background,
            borderRadius: '16px',
            border: `1px solid ${m3Tokens.color.outlineVariant}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: '1.1rem !important' }} />}
              label={`${attendees.length} Students Present`}
              color="success"
              sx={{ fontWeight: 800, fontSize: '0.9rem', py: 1.5 }}
            />
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              {attendees.length > 0
                ? `Latest: ${attendees[0].student.full_name} (${attendees[0].acl_ms ? `${attendees[0].acl_ms}ms ACL` : 'recorded'})`
                : 'Point mobile camera at projector to get marked PRESENT'}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Anti-Proxy HMAC-SHA256 • Low-Density Optimized Matrix
          </Typography>
        </Box>
      </Box>
    );
  }

  // -------------------------------------------------------------
  // Standard Modal View (With 1-Click Fullscreen Button)
  // -------------------------------------------------------------
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ p: 2.5, bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}` }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label="LIVE ATTENDANCE STREAM" color="error" size="small" sx={{ fontWeight: 800, fontSize: '0.7rem' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                {session.course_code}: {session.course_name}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 0.5 }}>
              Section: <strong>{session.section_name}</strong> • Started at {new Date(session.started_at).toLocaleTimeString()}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              color="primary"
              startIcon={<FullscreenIcon />}
              onClick={toggleFullscreen}
              sx={{ fontWeight: 700 }}
            >
              Fullscreen Projector
            </Button>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Left Panel: Rotating 3-QR Stream Projector */}
          <Grid item xs={12} md={7}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                textAlign: 'center',
                borderRadius: '16px',
                border: `2px solid ${m3Tokens.color.primary}`,
                bgcolor: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 480,
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: m3Tokens.color.primary, mb: 0.5 }}>
                Anti-Proxy Rotating 3-QR Stream
              </Typography>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 2, maxWidth: 420 }}>
                Low-density matrix enabled for high-distance scanning.
              </Typography>

              {/* QR Code Container */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: '#FFFFFF',
                  borderRadius: '16px',
                  border: `1px solid ${m3Tokens.color.outlineVariant}`,
                  boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.06)',
                  display: 'inline-block',
                  mb: 2,
                }}
              >
                {qrStringPayload ? (
                  <QRCodeSVG
                    value={qrStringPayload}
                    size={320}
                    level="L" // Low error correction = Chunky scannable blocks
                    includeMargin={true}
                    fgColor="#000000"
                    bgColor="#FFFFFF"
                  />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 320, height: 320 }}>
                    <CircularProgress />
                  </Box>
                )}
              </Box>

              {/* Multi-frame sequence tracker chips */}
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                {[0, 1, 2].map((idx) => (
                  <Chip
                    key={idx}
                    label={`Frame ${idx + 1}/3`}
                    size="small"
                    variant={currentFrameIdx === idx ? 'filled' : 'outlined'}
                    color={currentFrameIdx === idx ? 'primary' : 'default'}
                    sx={{
                      fontWeight: currentFrameIdx === idx ? 700 : 500,
                      transform: currentFrameIdx === idx ? 'scale(1.08)' : 'scale(1)',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  />
                ))}
              </Stack>

              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Rotating every 800ms • Tip: Click <strong>"Fullscreen Projector"</strong> for large lecture halls
              </Typography>
            </Paper>
          </Grid>

          {/* Right Panel: Live Attendance Roster Feed */}
          <Grid item xs={12} md={5}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                bgcolor: '#FFFFFF',
                height: 480,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                  Live Roster
                </Typography>
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />}
                  label={`${attendees.length} Present`}
                  color="success"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              </Stack>
              <Divider sx={{ mb: 1.5 }} />

              {attendees.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 2 }}>
                  <QrCodeScannerIcon sx={{ fontSize: 44, color: m3Tokens.color.onSurfaceVariant, mb: 1, opacity: 0.6 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: m3Tokens.color.onSurface }}>
                    Awaiting Student Scans...
                  </Typography>
                  <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 0.5 }}>
                    Students scanning the QR stream will appear here in real-time.
                  </Typography>
                </Box>
              ) : (
                <List sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                  {attendees.map((attendee, idx) => (
                    <React.Fragment key={attendee.id || idx}>
                      <ListItem
                        alignItems="flex-start"
                        sx={{
                          px: 1,
                          py: 1,
                          borderRadius: '8px',
                          '&:hover': { bgcolor: m3Tokens.color.surfaceVariant },
                        }}
                      >
                        <ListItemAvatar sx={{ minWidth: 40 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: m3Tokens.color.primary, fontSize: '0.85rem' }}>
                            <PersonIcon fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                              {attendee.student.full_name}
                            </Typography>
                          }
                          secondary={
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                                {attendee.student.email}
                              </Typography>
                              {attendee.acl_ms !== undefined && (
                                <Chip
                                  icon={<FlashOnIcon sx={{ fontSize: '0.75rem !important' }} />}
                                  label={`${attendee.acl_ms}ms`}
                                  size="small"
                                  color="secondary"
                                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                                />
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                      {idx < attendees.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2.5, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}`, justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
          Total Attendance Marked: <strong>{attendees.length} students</strong>
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button onClick={onClose} variant="outlined">
            Hide Projector (Session Still Active)
          </Button>
          <Button
            onClick={handleEndSession}
            variant="contained"
            color="error"
            disabled={ending}
          >
            {ending ? 'Ending Session...' : 'End Attendance Session'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};
