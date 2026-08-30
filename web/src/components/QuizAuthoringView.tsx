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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import QuizIcon from '@mui/icons-material/Quiz';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SchoolIcon from '@mui/icons-material/School';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TimerIcon from '@mui/icons-material/Timer';
import { CreateQuizDialog } from './CreateQuizDialog';
import { LiveQuizModal, QuizInfo } from './LiveQuizModal';
import { m3Tokens } from '@/theme/tokens';

interface QuizAuthoringViewProps {
  classroomId: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  options: { id: string; text: string }[];
  correct_option_id: string;
  order_index: number;
  time_limit_seconds: number;
}

export interface Quiz {
  id: string;
  classroom_id: string;
  created_by: string;
  created_by_name?: string;
  title: string;
  scoring_mode: 'WIDE' | 'NARROW';
  question_count: number;
  questions: QuizQuestion[];
  created_at: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const QuizAuthoringView: React.FC<QuizAuthoringViewProps> = ({ classroomId }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Quiz Modal State
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [activeActivityModalOpen, setActiveActivityModalOpen] = useState(false);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<QuizInfo | null>(null);

  useEffect(() => {
    if (classroomId) {
      fetchQuizzes();
    }
  }, [classroomId]);

  const handleLaunchQuiz = async (quiz: Quiz) => {
    setLaunchingId(quiz.id);
    setError(null);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/quizzes/${quiz.id}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.activity) {
        setActiveActivityId(data.activity.id);
        setActiveQuiz({
          id: quiz.id,
          title: quiz.title,
          scoring_mode: quiz.scoring_mode,
          question_count: quiz.questions?.length || quiz.question_count || 0,
          questions: quiz.questions || [],
        });
        setActiveActivityModalOpen(true);
      } else {
        setError(data.error || 'Failed to launch live quiz');
      }
    } catch {
      setError('Network error launching quiz');
    } finally {
      setLaunchingId(null);
    }
  };

  const fetchQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/quizzes?classroom_id=${classroomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setQuizzes(data.quizzes || []);
      } else {
        setError(data.error || 'Failed to fetch quizzes');
      }
    } catch {
      setError('Network error fetching quizzes');
    } finally {
      setLoading(false);
    }
  };

  const renderScoringModeChip = (mode: 'WIDE' | 'NARROW') => {
    if (mode === 'WIDE') {
      return (
        <Chip
          icon={<FlashOnIcon sx={{ fontSize: '1rem !important' }} />}
          label="WIDE (300–1000 pts)"
          size="small"
          sx={{
            bgcolor: m3Tokens.color.primaryContainer,
            color: m3Tokens.color.onPrimaryContainer,
            fontWeight: 800,
            fontSize: '0.72rem',
          }}
        />
      );
    }
    return (
      <Chip
        icon={<SchoolIcon sx={{ fontSize: '1rem !important' }} />}
        label="NARROW (700–1000 pts)"
        size="small"
        sx={{
          bgcolor: m3Tokens.color.secondaryContainer,
          color: m3Tokens.color.onSecondaryContainer,
          fontWeight: 800,
          fontSize: '0.72rem',
        }}
      />
    );
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
            <QuizIcon sx={{ color: m3Tokens.color.primary, fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              Live Quizzes
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Author reusable multi-question quizzes with WIDE (speed) or NARROW (accuracy) scoring formulas.
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
            Create Quiz
          </Button>
          <IconButton size="small" onClick={fetchQuizzes} title="Refresh Quizzes">
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
            Loading authored quizzes...
          </Typography>
        </Box>
      ) : quizzes.length === 0 ? (
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
          <QuizIcon sx={{ fontSize: 48, color: m3Tokens.color.primary, opacity: 0.6, mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 0.5 }}>
            No Quizzes Authored Yet
          </Typography>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, maxWidth: 450, mx: 'auto', mb: 2.5 }}>
            Live Quizzes feature synchronized countdown questions, time-weighted scoring formulas, and real-time leaderboards.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            Create Your First Quiz
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {quizzes.map((quiz) => {
            const totalSeconds = quiz.questions?.reduce((acc, q) => acc + (q.time_limit_seconds || 20), 0) || 0;
            return (
              <Grid item xs={12} md={6} key={quiz.id}>
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
                      {renderScoringModeChip(quiz.scoring_mode)}
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        {new Date(quiz.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                    </Stack>

                    <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 1, fontSize: '1.05rem' }}>
                      {quiz.title}
                    </Typography>

                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                      <Chip
                        icon={<QuizIcon sx={{ fontSize: '0.9rem !important' }} />}
                        label={`${quiz.question_count || quiz.questions?.length || 0} Questions`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                      />
                      <Chip
                        icon={<TimerIcon sx={{ fontSize: '0.9rem !important' }} />}
                        label={`~${totalSeconds}s Total Time`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                      />
                    </Stack>

                    {/* Questions Accordion Preview */}
                    {quiz.questions && quiz.questions.length > 0 && (
                      <Accordion
                        elevation={0}
                        sx={{
                          border: `1px solid ${m3Tokens.color.surfaceVariant}`,
                          borderRadius: '8px !important',
                          '&:before': { display: 'none' },
                          mb: 2,
                        }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.secondary }}>
                            VIEW QUESTIONS ({quiz.questions.length})
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5 }}>
                          <Stack spacing={1.5}>
                            {quiz.questions.map((q, qIdx) => (
                              <Box key={q.id || qIdx} sx={{ p: 1.25, borderRadius: '6px', bgcolor: m3Tokens.color.background }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.primary }}>
                                    Q{qIdx + 1} ({q.time_limit_seconds}s)
                                  </Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 0.75 }}>
                                  {q.question_text}
                                </Typography>
                                <Stack spacing={0.5}>
                                  {q.options?.map((opt) => {
                                    const isCorrect = q.correct_option_id === opt.id;
                                    return (
                                      <Stack direction="row" spacing={0.75} key={opt.id} alignItems="center">
                                        {isCorrect ? (
                                          <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                        ) : (
                                          <Box sx={{ width: 14, textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary' }}>
                                            &bull;
                                          </Box>
                                        )}
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontWeight: isCorrect ? 800 : 500,
                                            color: isCorrect ? 'success.dark' : m3Tokens.color.onSurfaceVariant,
                                          }}
                                        >
                                          {opt.id.toUpperCase()}. {opt.text}
                                        </Typography>
                                      </Stack>
                                    );
                                  })}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </Box>

                  <Box sx={{ pt: 1.5, borderTop: `1px solid ${m3Tokens.color.surfaceVariant}` }}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={launchingId === quiz.id ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                      onClick={() => handleLaunchQuiz(quiz)}
                      disabled={launchingId !== null}
                      fullWidth
                      sx={{ fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
                    >
                      {launchingId === quiz.id ? 'Launching...' : 'Launch Live Quiz Session'}
                    </Button>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create Dialog */}
      <CreateQuizDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        classroomId={classroomId}
        onSuccess={fetchQuizzes}
      />

      {/* Live Quiz Modal */}
      {activeActivityId && activeQuiz && (
        <LiveQuizModal
          open={activeActivityModalOpen}
          activityId={activeActivityId}
          classroomId={classroomId}
          quiz={activeQuiz}
          onClose={() => setActiveActivityModalOpen(false)}
          onActivityEnded={() => {
            setActiveActivityModalOpen(false);
            setActiveActivityId(null);
            setActiveQuiz(null);
            fetchQuizzes();
          }}
        />
      )}
    </Box>
  );
};
