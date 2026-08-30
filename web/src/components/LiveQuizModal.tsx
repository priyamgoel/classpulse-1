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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Avatar,
  LinearProgress,
  Grid,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import QuizIcon from '@mui/icons-material/Quiz';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SchoolIcon from '@mui/icons-material/School';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import TimerIcon from '@mui/icons-material/Timer';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { io, Socket } from 'socket.io-client';
import { m3Tokens, chartTokens } from '@/theme/tokens';

export interface QuizQuestionItem {
  id: string;
  question_text: string;
  options: { id: string; text: string }[];
  correct_option_id: string;
  order_index: number;
  time_limit_seconds: number;
}

export interface QuizInfo {
  id: string;
  title: string;
  scoring_mode: 'WIDE' | 'NARROW';
  question_count: number;
  questions: QuizQuestionItem[];
}

export interface LeaderboardEntry {
  rank: number;
  student_id: string;
  student_name: string;
  student_email: string;
  total_score: number;
  correct_count: number;
  total_answered: number;
  avg_response_time_ms: number;
}

interface LiveQuizModalProps {
  open: boolean;
  activityId: string;
  classroomId: string;
  quiz: QuizInfo;
  onClose: () => void;
  onActivityEnded: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type QuizStage = 'LOBBY' | 'QUESTION_ACTIVE' | 'QUESTION_RESULTS' | 'FINAL_LEADERBOARD';

export const LiveQuizModal: React.FC<LiveQuizModalProps> = ({
  open,
  activityId,
  classroomId,
  quiz,
  onClose,
  onActivityEnded,
}) => {
  const [stage, setStage] = useState<QuizStage>('LOBBY');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [liveAnsweredCount, setLiveAnsweredCount] = useState<number>(0);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(20);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ending, setEnding] = useState(false);
  const [startingNext, setStartingNext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = quiz.questions[currentQuestionIndex] || quiz.questions[0];

  useEffect(() => {
    if (!open || !activityId) return;

    const socket = io(API_BASE_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_activity_teacher', activityId);
    });

    socket.on('quiz:live_answers', (data: any) => {
      if (data.activityId === activityId) {
        setLiveAnsweredCount(data.answeredCount || 0);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_activity', activityId);
        socketRef.current.disconnect();
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [open, activityId]);

  const startQuestion = async (index: number) => {
    setStartingNext(true);
    setError(null);
    setLiveAnsweredCount(0);
    try {
      const token = localStorage.getItem('classpulse_token');
      const q = quiz.questions[index];
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/quiz/start-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question_id: q.id, question_index: index }),
      });

      const data = await res.json();
      if (res.ok) {
        setCurrentQuestionIndex(index);
        setStage('QUESTION_ACTIVE');
        const limit = data.timeLimitSeconds || q.time_limit_seconds || 20;
        setTimeRemainingSeconds(limit);

        // Run countdown timer
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        const endTime = Date.now() + (limit * 1000);

        timerIntervalRef.current = setInterval(() => {
          const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
          setTimeRemainingSeconds(remaining);
          if (remaining <= 0) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          }
        }, 200);
      } else {
        setError(data.error || 'Failed to start question');
      }
    } catch {
      setError('Network error starting question');
    } finally {
      setStartingNext(false);
    }
  };

  const showQuestionResults = async () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setError(null);
    try {
      const token = localStorage.getItem('classpulse_token');
      const q = quiz.questions[currentQuestionIndex];
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/quiz/show-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question_id: q.id }),
      });

      const data = await res.json();
      if (res.ok) {
        setDistribution(data.distribution || []);
        setLeaderboard(data.leaderboard || []);
        setStage('QUESTION_RESULTS');
      } else {
        setError(data.error || 'Failed to show results');
      }
    } catch {
      setError('Network error revealing results');
    }
  };

  const handleNextOrFinish = () => {
    if (currentQuestionIndex + 1 < quiz.questions.length) {
      startQuestion(currentQuestionIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    setEnding(true);
    setError(null);
    try {
      const token = localStorage.getItem('classpulse_token');
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/quiz/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLeaderboard(data.finalLeaderboard || []);
        setStage('FINAL_LEADERBOARD');
      } else {
        setError(data.error || 'Failed to finish quiz');
      }
    } catch {
      setError('Network error concluding quiz');
    } finally {
      setEnding(false);
    }
  };

  const handleEmergencyEnd = async () => {
    setEnding(true);
    try {
      const token = localStorage.getItem('classpulse_token');
      await fetch(`${API_BASE_URL}/live-activities/${activityId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      onActivityEnded();
      onClose();
    } catch {
      setError('Network error ending activity');
    } finally {
      setEnding(false);
    }
  };

  const totalTimeLimit = currentQuestion?.time_limit_seconds || 20;
  const progressPercent = Math.max(0, Math.min(100, (timeRemainingSeconds / totalTimeLimit) * 100));

  return (
    <Dialog open={open} onClose={() => {}} maxWidth="lg" fullWidth disableEscapeKeyDown>
      {/* Modal Header */}
      <DialogTitle sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <QuizIcon sx={{ color: m3Tokens.color.primary, fontSize: 28 }} />
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                  {quiz.title}
                </Typography>
                <Chip
                  label="LIVE QUIZ"
                  color="error"
                  size="small"
                  sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem' }}
                />
                <Chip
                  icon={quiz.scoring_mode === 'WIDE' ? <FlashOnIcon sx={{ fontSize: '0.9rem !important' }} /> : <SchoolIcon sx={{ fontSize: '0.9rem !important' }} />}
                  label={quiz.scoring_mode === 'WIDE' ? 'WIDE (300-1000)' : 'NARROW (700-1000)'}
                  size="small"
                  sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem', bgcolor: m3Tokens.color.primaryContainer }}
                />
              </Stack>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Question <strong>{currentQuestionIndex + 1} of {quiz.questions.length}</strong> &bull; Activity ID: {activityId.slice(0, 8)}...
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            {stage === 'QUESTION_ACTIVE' && (
              <Chip
                icon={<TimerIcon sx={{ fontSize: '1rem !important' }} />}
                label={`${timeRemainingSeconds}s Remaining`}
                color={timeRemainingSeconds <= 5 ? 'error' : 'primary'}
                sx={{ fontWeight: 800, fontSize: '0.85rem' }}
              />
            )}
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={ending ? <CircularProgress size={14} color="inherit" /> : <StopCircleIcon />}
              onClick={handleEmergencyEnd}
              disabled={ending}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
            >
              {ending ? 'Ending...' : 'End Quiz'}
            </Button>
          </Stack>
        </Stack>
      </DialogTitle>

      {/* Main Content Area */}
      <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background, minHeight: 440 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>
            {error}
          </Alert>
        )}

        {/* STAGE 1: LOBBY */}
        {stage === 'LOBBY' && (
          <Paper
            elevation={0}
            sx={{
              p: 5,
              borderRadius: '16px',
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: '#FFFFFF',
              textAlign: 'center',
              maxWidth: 600,
              mx: 'auto',
              my: 3,
            }}
          >
            <QuizIcon sx={{ fontSize: 64, color: m3Tokens.color.primary, mb: 1.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 900, color: m3Tokens.color.onSurface, mb: 1 }}>
              Ready to Start Live Quiz?
            </Typography>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 3 }}>
              This quiz has <strong>{quiz.questions.length} questions</strong>. Students in the classroom will receive questions simultaneously with server-synchronized countdown timers.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={() => startQuestion(0)}
              disabled={startingNext}
              sx={{ fontWeight: 800, textTransform: 'none', px: 4, py: 1.25, borderRadius: '10px', fontSize: '1rem' }}
            >
              {startingNext ? 'Starting...' : 'Start Question 1'}
            </Button>
          </Paper>
        )}

        {/* STAGE 2: QUESTION ACTIVE */}
        {stage === 'QUESTION_ACTIVE' && (
          <Stack spacing={2.5}>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              color={timeRemainingSeconds <= 5 ? 'error' : 'primary'}
              sx={{ height: 8, borderRadius: 4 }}
            />

            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '16px',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                bgcolor: '#FFFFFF',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Chip
                  label={`Question ${currentQuestionIndex + 1} of ${quiz.questions.length}`}
                  color="primary"
                  sx={{ fontWeight: 800 }}
                />
                <Chip
                  label={`${liveAnsweredCount} Student Answers Received`}
                  color="success"
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              </Stack>

              <Typography variant="h5" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 3 }}>
                {currentQuestion.question_text}
              </Typography>

              <Grid container spacing={2}>
                {currentQuestion.options?.map((opt, idx) => (
                  <Grid item xs={12} sm={6} key={opt.id || idx}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: '12px',
                        border: `1px solid ${m3Tokens.color.outlineVariant}`,
                        bgcolor: m3Tokens.color.background,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: m3Tokens.color.primary,
                          color: '#FFFFFF',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                        }}
                      >
                        {opt.id.toUpperCase()}
                      </Avatar>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: m3Tokens.color.onSurface }}>
                        {opt.text}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ mt: 3, textAlign: 'right' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<VisibilityIcon />}
                  onClick={showQuestionResults}
                  sx={{ fontWeight: 800, textTransform: 'none', borderRadius: '8px', px: 3 }}
                >
                  Reveal Results & Leaderboard
                </Button>
              </Box>
            </Paper>
          </Stack>
        )}

        {/* STAGE 3: QUESTION RESULTS & DISTRIBUTION */}
        {stage === 'QUESTION_RESULTS' && (
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5}>
            {/* Left: Distribution BarChart */}
            <Box sx={{ flex: 1 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '16px',
                  border: `1px solid ${m3Tokens.color.outlineVariant}`,
                  bgcolor: '#FFFFFF',
                  height: '100%',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 1 }}>
                  Question {currentQuestionIndex + 1} Answer Distribution
                </Typography>
                <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mb: 2 }}>
                  Correct Answer: <strong>Option {currentQuestion.correct_option_id.toUpperCase()}</strong>
                </Typography>

                <Box sx={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution} margin={{ top: 15, right: 20, left: -15, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} vertical={false} />
                      <XAxis
                        dataKey="option_text"
                        stroke={chartTokens.axis}
                        tick={{ fill: chartTokens.axis, fontSize: 12 }}
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
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {distribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.is_correct ? chartTokens.success : chartTokens.primary}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>

                <Box sx={{ mt: 2, textAlign: 'right' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<NavigateNextIcon />}
                    onClick={handleNextOrFinish}
                    disabled={startingNext || ending}
                    sx={{ fontWeight: 800, textTransform: 'none', borderRadius: '8px', px: 3 }}
                  >
                    {currentQuestionIndex + 1 < quiz.questions.length
                      ? `Next: Question ${currentQuestionIndex + 2}`
                      : 'Finish Quiz & View Final Podium'}
                  </Button>
                </Box>
              </Paper>
            </Box>

            {/* Right: Live Cumulative Leaderboard */}
            <Box sx={{ width: { xs: '100%', lg: 380 } }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  border: `1px solid ${m3Tokens.color.outlineVariant}`,
                  bgcolor: '#FFFFFF',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <LeaderboardIcon sx={{ color: m3Tokens.color.primary }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Live Leaderboard
                  </Typography>
                </Stack>

                {leaderboard.length === 0 ? (
                  <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, textAlign: 'center', py: 4 }}>
                    No answers recorded for this question yet.
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem' }}>RANK</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem' }}>STUDENT</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem' }}>SCORE</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leaderboard.slice(0, 6).map((entry) => (
                        <TableRow key={entry.student_id}>
                          <TableCell sx={{ fontWeight: 800 }}>
                            {entry.rank === 1 ? '🥇 1' : entry.rank === 2 ? '🥈 2' : entry.rank === 3 ? '🥉 3' : `#${entry.rank}`}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                              {entry.student_name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, fontSize: '0.7rem' }}>
                              {entry.correct_count} correct &bull; {entry.avg_response_time_ms}ms avg
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${entry.total_score} pts`}
                              size="small"
                              color="primary"
                              sx={{ fontWeight: 800, height: 22, fontSize: '0.72rem' }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Box>
          </Stack>
        )}

        {/* STAGE 4: FINAL PODIUM & LEADERBOARD */}
        {stage === 'FINAL_LEADERBOARD' && (
          <Stack spacing={3}>
            {/* Podium Cards */}
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <EmojiEventsIcon sx={{ fontSize: 48, color: '#FFD700', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 900, color: m3Tokens.color.onSurface, mb: 0.5 }}>
                Quiz Finished — Final Podium!
              </Typography>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Cumulative results calculated with {quiz.scoring_mode} scoring formula.
              </Typography>
            </Box>

            <Grid container spacing={2} justifyContent="center">
              {leaderboard.slice(0, 3).map((podium, idx) => (
                <Grid item xs={12} sm={4} key={podium.student_id}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: '16px',
                      border: `2px solid ${idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : '#CD7F32'}`,
                      bgcolor: '#FFFFFF',
                      textAlign: 'center',
                      transform: idx === 0 ? 'scale(1.05)' : 'none',
                    }}
                  >
                    <Typography variant="h3" sx={{ mb: 1 }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                      {podium.student_name}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: m3Tokens.color.primary, my: 1 }}>
                      {podium.total_score} pts
                    </Typography>
                    <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block' }}>
                      {podium.correct_count} of {quiz.questions.length} Correct &bull; {podium.avg_response_time_ms}ms avg
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Complete Ranked Leaderboard Table */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                bgcolor: '#FFFFFF',
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
                Full Classroom Standings ({leaderboard.length} Participants)
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>RANK</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>STUDENT</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>ACCURACY</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>AVG RESPONSE TIME</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>TOTAL SCORE</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaderboard.map((row) => (
                    <TableRow key={row.student_id}>
                      <TableCell sx={{ fontWeight: 800 }}>#{row.rank}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {row.student_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          {row.student_email}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${row.correct_count} / ${quiz.questions.length}`}
                          size="small"
                          color={row.correct_count === quiz.questions.length ? 'success' : 'default'}
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{row.avg_response_time_ms} ms</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: m3Tokens.color.primary }}>
                          {row.total_score} pts
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
        <Button
          onClick={() => {
            onActivityEnded();
            onClose();
          }}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Close Window
        </Button>
      </DialogActions>
    </Dialog>
  );
};
