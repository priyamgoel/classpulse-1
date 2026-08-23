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
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
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
  const [rotationSpeedMs, setRotationSpeedMs] = useState<number>(800); // 800ms (Default), 300ms (Fast), 100ms (Ultra-Fast)

  const socketRef = useRef<Socket | null>(null);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rotationIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // 2. Configurable Dynamic 3-QR frame rotation (800ms / 300ms / 100ms)
  useEffect(() => {
    if (!open || !tokenBatch || tokenBatch.tokens.length === 0) return;

    if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);

    rotationIntervalRef.current = setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % 3);
    }, rotationSpeedMs);

    return () => {
      if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);
    };
  }, [open, tokenBatch, rotationSpeedMs]);

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
  // Fullscreen Theater / Projector View (Maximized Top-to-Bottom QR + Side Panels)
  // -------------------------------------------------------------
  if (isFullscreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          bgcolor: '#FFFFFF',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          p: 1.5,
          gap: 2,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Left Side Panel: Course Info, 3-Frame Tracker & Rotation Speed Selector */}
        <Paper
          elevation={0}
          sx={{
            width: '23%',
            minWidth: 250,
            maxWidth: 310,
            p: 2.5,
            borderRadius: '16px',
            border: `1px solid ${m3Tokens.color.outlineVariant}`,
            bgcolor: m3Tokens.color.background,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 'calc(100vh - 24px)',
            boxSizing: 'border-box',
          }}
        >
          <Box>
            <Chip
              label="PROJECTOR STREAM"
              color="error"
              sx={{ fontWeight: 900, fontSize: '0.75rem', mb: 1.5 }}
            />
            <Typography variant="h5" sx={{ fontWeight: 900, color: m3Tokens.color.onSurface, lineHeight: 1.2, mb: 0.75 }}>
              {session.course_code}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 0.5, fontSize: '1rem' }}>
              {session.course_name}
            </Typography>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 1.5 }}>
              Section: <strong>{session.section_name}</strong>
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.primary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
              Active Rotating Frames
            </Typography>

            <Stack spacing={1}>
              {[0, 1, 2].map((idx) => {
                const isActive = currentFrameIdx === idx;
                return (
                  <Paper
                    key={idx}
                    elevation={0}
                    sx={{
                      p: 1.25,
                      borderRadius: '10px',
                      border: `2px solid ${isActive ? m3Tokens.color.primary : m3Tokens.color.outlineVariant}`,
                      bgcolor: isActive ? m3Tokens.color.primaryContainer : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transform: isActive ? 'scale(1.02)' : 'scale(1)',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: isActive ? m3Tokens.color.primary : 'grey.400',
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: isActive ? 800 : 600, color: isActive ? m3Tokens.color.onPrimaryContainer : m3Tokens.color.onSurface, fontSize: '0.85rem' }}>
                        Frame {idx + 1} of 3
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.7rem', color: isActive ? m3Tokens.color.primary : m3Tokens.color.onSurfaceVariant }}>
                      {isActive ? 'TRANSMITTING' : 'QUEUED'}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>

            {/* Rotation Speed Selector */}
            <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.primary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mt: 2, mb: 1 }}>
              Stream Rotation Speed
            </Typography>
            <Stack direction="row" spacing={1}>
              {[
                { label: '800ms', value: 800, desc: 'Normal' },
                { label: '300ms', value: 300, desc: 'Fast' },
                { label: '100ms', value: 100, desc: 'Ultra' },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  size="small"
                  variant={rotationSpeedMs === opt.value ? 'contained' : 'outlined'}
                  onClick={() => setRotationSpeedMs(opt.value)}
                  sx={{
                    flex: 1,
                    py: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    borderRadius: '8px',
                    minWidth: 0,
                    px: 0.5,
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </Stack>
          </Box>

          <Box>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: '10px',
                bgcolor: '#FFFFFF',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                <SpeedIcon sx={{ fontSize: 16, color: m3Tokens.color.primary }} />
                <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.primary, fontSize: '0.75rem' }}>
                  ROTATING AT {rotationSpeedMs}MS
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', fontSize: '0.7rem', lineHeight: 1.3 }}>
                Tokens refresh every 10s. Stream flips frames at {rotationSpeedMs}ms for fast camera capture.
              </Typography>
            </Paper>
          </Box>
        </Paper>

        {/* Center: Absolute Maximum Top-to-Bottom QR Code */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'calc(100vh - 24px)',
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              p: 1.5,
              bgcolor: '#FFFFFF',
              borderRadius: '24px',
              border: `4px solid ${m3Tokens.color.primary}`,
              boxShadow: '0px 8px 36px rgba(0, 0, 0, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 'calc(100vh - 32px)',
              width: 'calc(100vh - 32px)',
              maxWidth: 'calc(100vw - 640px)',
              maxHeight: 'calc(100vh - 32px)',
              aspectRatio: '1/1',
              boxSizing: 'border-box',
            }}
          >
            {qrStringPayload ? (
              <QRCodeSVG
                value={qrStringPayload}
                size={850}
                style={{ width: '100%', height: '100%', display: 'block' }}
                level="L" // Low error correction = Biggest, chunkiest dots for long distance
                includeMargin={false} // Outer box padding serves as crisp quiet zone
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            ) : (
              <CircularProgress size={80} />
            )}
          </Box>
        </Box>

        {/* Right Side Panel: Live Real-Time Roster & Session Controls */}
        <Paper
          elevation={0}
          sx={{
            width: '25%',
            minWidth: 260,
            maxWidth: 330,
            p: 2.5,
            borderRadius: '16px',
            border: `1px solid ${m3Tokens.color.outlineVariant}`,
            bgcolor: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 'calc(100vh - 24px)',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Controls */}
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                startIcon={<FullscreenExitIcon />}
                onClick={toggleFullscreen}
                sx={{ borderRadius: '8px', fontSize: '0.8rem' }}
              >
                Exit Fullscreen
              </Button>
              <Button
                fullWidth
                size="small"
                variant="contained"
                color="error"
                onClick={handleEndSession}
                disabled={ending}
                sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem' }}
              >
                {ending ? 'Ending...' : 'End Session'}
              </Button>
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                mb: 1.5,
                borderRadius: '10px',
                bgcolor: 'success.light',
                color: 'success.dark',
                textAlign: 'center',
              }}
            >
              <Typography variant="h3" sx={{ fontWeight: 900, color: 'success.dark', lineHeight: 1 }}>
                {attendees.length}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 0.25, fontSize: '0.85rem' }}>
                Students Marked Present
              </Typography>
            </Paper>

            <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Live Real-Time Feed
            </Typography>
          </Box>

          {/* Real-time Student List */}
          <Box sx={{ flex: 1, overflowY: 'auto', my: 1, pr: 0.5 }}>
            {attendees.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <QrCodeScannerIcon sx={{ fontSize: 36, color: 'grey.400', mb: 0.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: m3Tokens.color.onSurfaceVariant, fontSize: '0.85rem' }}>
                  Awaiting Scans...
                </Typography>
                <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, fontSize: '0.75rem' }}>
                  Students scanning with 1x-20x zoom will appear here instantly.
                </Typography>
              </Box>
            ) : (
              <List dense sx={{ p: 0 }}>
                {attendees.map((attendee, idx) => (
                  <React.Fragment key={attendee.id || idx}>
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        px: 0.75,
                        py: 0.5,
                        borderRadius: '6px',
                        '&:hover': { bgcolor: m3Tokens.color.surfaceVariant },
                      }}
                    >
                      <ListItemAvatar sx={{ minWidth: 32 }}>
                        <Avatar sx={{ width: 24, height: 24, bgcolor: m3Tokens.color.primary, fontSize: '0.7rem' }}>
                          <PersonIcon sx={{ fontSize: 14 }} />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, fontSize: '0.8rem' }}>
                            {attendee.student.full_name}
                          </Typography>
                        }
                        secondary={
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, fontSize: '0.7rem' }}>
                              {attendee.student.email}
                            </Typography>
                            {attendee.acl_ms !== undefined && (
                              <Chip
                                icon={<FlashOnIcon sx={{ fontSize: '0.65rem !important' }} />}
                                label={`${attendee.acl_ms}ms`}
                                size="small"
                                color="secondary"
                                sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }}
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
          </Box>

          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, textAlign: 'center', display: 'block', fontSize: '0.7rem' }}>
            Socket.io Live Feed Active
          </Typography>
        </Paper>
      </Box>
    );
  }

  // -------------------------------------------------------------
  // Standard Modal View (With 1-Click Fullscreen Button & Speed Toggle)
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
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 1.5, maxWidth: 420 }}>
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
                  mb: 1.5,
                }}
              >
                {qrStringPayload ? (
                  <QRCodeSVG
                    value={qrStringPayload}
                    size={300}
                    level="L" // Low error correction = Chunky scannable blocks
                    includeMargin={true}
                    fgColor="#000000"
                    bgColor="#FFFFFF"
                  />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 300, height: 300 }}>
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

              {/* Rotation Speed Selector */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>
                  Speed:
                </Typography>
                {[
                  { label: '800ms', value: 800 },
                  { label: '300ms', value: 300 },
                  { label: '100ms', value: 100 },
                ].map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    size="small"
                    color={rotationSpeedMs === opt.value ? 'primary' : 'default'}
                    variant={rotationSpeedMs === opt.value ? 'filled' : 'outlined'}
                    onClick={() => setRotationSpeedMs(opt.value)}
                    sx={{ fontWeight: 700, cursor: 'pointer' }}
                  />
                ))}
              </Stack>

              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Tip: Click <strong>"Fullscreen Projector"</strong> for large lecture halls
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
