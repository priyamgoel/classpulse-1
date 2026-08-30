'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Button,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Divider,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import SpeedIcon from '@mui/icons-material/Speed';
import { CreatePulseMeterDialog } from './CreatePulseMeterDialog';
import { LivePulseMeterModal, PulseMeterInfo } from './LivePulseMeterModal';
import { m3Tokens } from '@/theme/tokens';

interface PulseMeterAuthoringViewProps {
  classroomId: string;
}

export interface PulseMeter {
  id: string;
  classroom_id: string;
  created_by: string;
  created_by_name?: string;
  title: string;
  type: 'WORD_CLOUD' | 'MCQ' | 'RATING_SCALE';
  config: any;
  created_at: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const PulseMeterAuthoringView: React.FC<PulseMeterAuthoringViewProps> = ({ classroomId }) => {
  const [pulsemeters, setPulsemeters] = useState<PulseMeter[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Activity State
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [activeActivityModalOpen, setActiveActivityModalOpen] = useState(false);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [activePulsemeter, setActivePulsemeter] = useState<PulseMeterInfo | null>(null);

  useEffect(() => {
    if (classroomId) {
      fetchPulsemeters();
    }
  }, [classroomId]);

  const handleLaunchPulseMeter = async (pm: PulseMeter) => {
    setLaunchingId(pm.id);
    setError(null);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/pulsemeters/${pm.id}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.activity) {
        setActiveActivityId(data.activity.id);
        setActivePulsemeter({
          id: pm.id,
          title: pm.title,
          type: pm.type,
          config: pm.config,
        });
        setActiveActivityModalOpen(true);
      } else {
        setError(data.error || 'Failed to launch PulseMeter');
      }
    } catch {
      setError('Network error launching PulseMeter');
    } finally {
      setLaunchingId(null);
    }
  };

  const fetchPulsemeters = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/pulsemeters?classroom_id=${classroomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPulsemeters(data.pulsemeters || []);
      } else {
        setError(data.error || 'Failed to fetch PulseMeters');
      }
    } catch {
      setError('Network error fetching PulseMeters');
    } finally {
      setLoading(false);
    }
  };

  const renderTypeChip = (type: string, config: any) => {
    switch (type) {
      case 'WORD_CLOUD':
        return (
          <Chip
            icon={<CloudQueueIcon sx={{ fontSize: '1rem !important' }} />}
            label="Word Cloud"
            size="small"
            sx={{
              bgcolor: m3Tokens.color.primaryContainer,
              color: m3Tokens.color.onPrimaryContainer,
              fontWeight: 700,
              fontSize: '0.72rem',
            }}
          />
        );
      case 'MCQ':
        return (
          <Chip
            icon={<CheckCircleOutlineIcon sx={{ fontSize: '1rem !important' }} />}
            label={`MCQ (${config.options?.length || 0} options)`}
            size="small"
            sx={{
              bgcolor: m3Tokens.color.secondaryContainer,
              color: m3Tokens.color.onSecondaryContainer,
              fontWeight: 700,
              fontSize: '0.72rem',
            }}
          />
        );
      case 'RATING_SCALE':
        return (
          <Chip
            icon={<LinearScaleIcon sx={{ fontSize: '1rem !important' }} />}
            label={`Rating Scale (1–${config.max || 5})`}
            size="small"
            sx={{
              bgcolor: m3Tokens.color.tertiaryContainer,
              color: m3Tokens.color.onTertiaryContainer,
              fontWeight: 700,
              fontSize: '0.72rem',
            }}
          />
        );
      default:
        return <Chip label={type} size="small" />;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Top Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <SpeedIcon sx={{ color: m3Tokens.color.primary, fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              PulseMeter Activities
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Author reusable live feedback questions and polls. Launch them during any class session.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ fontWeight: 700, borderRadius: '8px', textTransform: 'none' }}
          >
            Create PulseMeter
          </Button>
          <IconButton size="small" onClick={fetchPulsemeters} title="Refresh PulseMeters">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 1 }}>
            Loading authored PulseMeters...
          </Typography>
        </Box>
      ) : pulsemeters.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 5,
            textAlign: 'center',
            borderRadius: '12px',
            border: `1px dashed ${m3Tokens.color.outlineVariant}`,
            bgcolor: '#FFFFFF',
          }}
        >
          <SpeedIcon sx={{ fontSize: 48, color: m3Tokens.color.primary, opacity: 0.6, mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 0.5 }}>
            No PulseMeters Authored Yet
          </Typography>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, maxWidth: 450, mx: 'auto', mb: 2.5 }}>
            PulseMeters let you collect real-time student sentiment via Word Clouds, Multiple Choice polls, or Rating Scales during lectures.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            Create Your First PulseMeter
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {pulsemeters.map((pm) => (
            <Grid item xs={12} md={6} key={pm.id}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '12px',
                  border: `1px solid ${m3Tokens.color.outlineVariant}`,
                  bgcolor: '#FFFFFF',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.15s ease',
                  '&:hover': {
                    borderColor: m3Tokens.color.primary,
                  },
                }}
              >
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                    {renderTypeChip(pm.type, pm.config)}
                    <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                      {new Date(pm.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </Stack>

                  <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 1, fontSize: '1.05rem' }}>
                    {pm.title}
                  </Typography>

                  {/* Config Details Preview */}
                  {pm.type === 'WORD_CLOUD' && (
                    <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: m3Tokens.color.background, mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.secondary, display: 'block', mb: 0.25 }}>
                        STUDENT PROMPT
                      </Typography>
                      <Typography variant="body2" sx={{ color: m3Tokens.color.onSurface }}>
                        "{pm.config?.prompt || pm.title}"
                      </Typography>
                    </Box>
                  )}

                  {pm.type === 'MCQ' && (
                    <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: m3Tokens.color.background, mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.secondary, display: 'block', mb: 0.5 }}>
                        POLL OPTIONS
                      </Typography>
                      <Stack spacing={0.75}>
                        {pm.config?.options?.map((opt: any, idx: number) => (
                          <Stack direction="row" spacing={1} key={idx} alignItems="center">
                            <Chip
                              label={opt.id ? opt.id.toUpperCase() : String.fromCharCode(65 + idx)}
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: m3Tokens.color.surfaceVariant }}
                            />
                            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurface, fontSize: '0.85rem' }}>
                              {opt.text}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {pm.type === 'RATING_SCALE' && (
                    <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: m3Tokens.color.background, mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.secondary, display: 'block', mb: 0.5 }}>
                        SCALE RANGE (1 to {pm.config?.max || 5})
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          1: {pm.config?.low_label || 'Lowest'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          {pm.config?.max || 5}: {pm.config?.high_label || 'Highest'}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                </Box>

                <Box sx={{ pt: 1.5, borderTop: `1px solid ${m3Tokens.color.surfaceVariant}` }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={launchingId === pm.id ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                    onClick={() => handleLaunchPulseMeter(pm)}
                    disabled={launchingId !== null}
                    fullWidth
                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
                  >
                    {launchingId === pm.id ? 'Launching...' : 'Launch Live Activity'}
                  </Button>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Dialog */}
      <CreatePulseMeterDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        classroomId={classroomId}
        onSuccess={fetchPulsemeters}
      />

      {/* Live PulseMeter Modal */}
      {activeActivityId && activePulsemeter && (
        <LivePulseMeterModal
          open={activeActivityModalOpen}
          activityId={activeActivityId}
          classroomId={classroomId}
          pulsemeter={activePulsemeter}
          onClose={() => setActiveActivityModalOpen(false)}
          onActivityEnded={() => {
            setActiveActivityModalOpen(false);
            setActiveActivityId(null);
            setActivePulsemeter(null);
            fetchPulsemeters();
          }}
        />
      )}
    </Box>
  );
};
