'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import QuizIcon from '@mui/icons-material/Quiz';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TimerIcon from '@mui/icons-material/Timer';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SchoolIcon from '@mui/icons-material/School';
import { m3Tokens } from '@/theme/tokens';

interface CreateQuizDialogProps {
  open: boolean;
  onClose: () => void;
  classroomId: string;
  onSuccess: () => void;
}

interface QuestionDraft {
  question_text: string;
  options: string[];
  correct_option_id: string; // 'a', 'b', etc.
  time_limit_seconds: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const CreateQuizDialog: React.FC<CreateQuizDialogProps> = ({
  open,
  onClose,
  classroomId,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [scoringMode, setScoringMode] = useState<'WIDE' | 'NARROW'>('WIDE');
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    {
      question_text: '',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_option_id: 'a',
      time_limit_seconds: 20,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: '',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correct_option_id: 'a',
        time_limit_seconds: 20,
      },
    ]);
  };

  const handleRemoveQuestion = (qIndex: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, idx) => idx !== qIndex));
    }
  };

  const handleQuestionTextChange = (qIndex: number, text: string) => {
    const updated = [...questions];
    updated[qIndex].question_text = text;
    setQuestions(updated);
  };

  const handleTimeLimitChange = (qIndex: number, seconds: number) => {
    const updated = [...questions];
    updated[qIndex].time_limit_seconds = seconds;
    setQuestions(updated);
  };

  const handleOptionChange = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = text;
    setQuestions(updated);
  };

  const handleCorrectOptionChange = (qIndex: number, optId: string) => {
    const updated = [...questions];
    updated[qIndex].correct_option_id = optId;
    setQuestions(updated);
  };

  const handleAddOption = (qIndex: number) => {
    const updated = [...questions];
    if (updated[qIndex].options.length < 6) {
      const nextId = String.fromCharCode(65 + updated[qIndex].options.length);
      updated[qIndex].options.push(`Option ${nextId}`);
      setQuestions(updated);
    }
  };

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    if (updated[qIndex].options.length > 2) {
      updated[qIndex].options.splice(optIndex, 1);
      // Reset correct option if deleted
      const optId = String.fromCharCode(97 + optIndex);
      if (updated[qIndex].correct_option_id === optId) {
        updated[qIndex].correct_option_id = 'a';
      }
      setQuestions(updated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter a quiz title.');
      return;
    }

    // Validate all questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setError(`Question #${i + 1} text cannot be empty.`);
        return;
      }
      const validOptions = q.options.map(o => o.trim()).filter(Boolean);
      if (validOptions.length < 2) {
        setError(`Question #${i + 1} must have at least 2 non-empty options.`);
        return;
      }
    }

    setLoading(true);

    try {
      const formattedQuestions = questions.map((q, qIdx) => ({
        question_text: q.question_text.trim(),
        options: q.options.map((opt, optIdx) => ({
          id: String.fromCharCode(97 + optIdx),
          text: opt.trim(),
        })),
        correct_option_id: q.correct_option_id,
        order_index: qIdx,
        time_limit_seconds: q.time_limit_seconds,
      }));

      const token = localStorage.getItem('classpulse_token');
      const response = await fetch(`${API_BASE_URL}/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          classroom_id: classroomId,
          title: title.trim(),
          scoring_mode: scoringMode,
          questions: formattedQuestions,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Reset form
        setTitle('');
        setScoringMode('WIDE');
        setQuestions([
          {
            question_text: '',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correct_option_id: 'a',
            time_limit_seconds: 20,
          },
        ]);
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Failed to create quiz');
      }
    } catch {
      setError('Network error creating quiz. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={!loading ? onClose : undefined} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`, p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <QuizIcon sx={{ color: m3Tokens.color.primary, fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                Author Reusable Live Quiz
              </Typography>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Create interactive multiple-choice questions with server-synchronized timing
              </Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background, maxHeight: '75vh', overflowY: 'auto' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
              {error}
            </Alert>
          )}

          <Stack spacing={3}>
            {/* Quiz Title */}
            <TextField
              label="Quiz Title"
              placeholder="e.g. Mid-Term Software Engineering Concepts Check"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              disabled={loading}
            />

            {/* Scoring Mode Selector Cards (Section 4a) */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: m3Tokens.color.onSurface }}>
                Scoring Formula & Spread (Section 4a)
              </Typography>
              <RadioGroup
                value={scoringMode}
                onChange={(e) => setScoringMode(e.target.value as 'WIDE' | 'NARROW')}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  {/* Option 1: WIDE (Default) */}
                  <Paper
                    elevation={0}
                    onClick={() => setScoringMode('WIDE')}
                    sx={{
                      flex: 1,
                      p: 2,
                      borderRadius: '12px',
                      border: `2px solid ${scoringMode === 'WIDE' ? m3Tokens.color.primary : m3Tokens.color.outlineVariant}`,
                      bgcolor: scoringMode === 'WIDE' ? m3Tokens.color.primaryContainer : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <FormControlLabel
                      value="WIDE"
                      control={<Radio size="small" color="primary" />}
                      label={
                        <Box sx={{ ml: 0.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <FlashOnIcon sx={{ fontSize: 18, color: m3Tokens.color.primary }} />
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              WIDE (Default)
                            </Typography>
                          </Stack>
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mt: 0.5 }}>
                            <strong>300–1000 pts</strong> per correct answer. Speed-focused spread rewarding fast reflexes.
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                    />
                  </Paper>

                  {/* Option 2: NARROW (Opt-in) */}
                  <Paper
                    elevation={0}
                    onClick={() => setScoringMode('NARROW')}
                    sx={{
                      flex: 1,
                      p: 2,
                      borderRadius: '12px',
                      border: `2px solid ${scoringMode === 'NARROW' ? m3Tokens.color.primary : m3Tokens.color.outlineVariant}`,
                      bgcolor: scoringMode === 'NARROW' ? m3Tokens.color.primaryContainer : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <FormControlLabel
                      value="NARROW"
                      control={<Radio size="small" color="primary" />}
                      label={
                        <Box sx={{ ml: 0.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <SchoolIcon sx={{ fontSize: 18, color: m3Tokens.color.primary }} />
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              NARROW (Opt-in)
                            </Typography>
                          </Stack>
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mt: 0.5 }}>
                            <strong>700–1000 pts</strong> per correct answer. Accuracy-focused spread for lab / concept checks.
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                    />
                  </Paper>
                </Stack>
              </RadioGroup>
            </Box>

            <Divider />

            {/* Questions Builder */}
            <Stack spacing={2.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                  Quiz Questions ({questions.length})
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddQuestion}
                  disabled={loading}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                >
                  Add Question
                </Button>
              </Stack>

              {questions.map((q, qIdx) => (
                <Paper
                  key={qIdx}
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '14px',
                    border: `1px solid ${m3Tokens.color.outlineVariant}`,
                    bgcolor: '#FFFFFF',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={`Q${qIdx + 1}`}
                        size="small"
                        color="primary"
                        sx={{ fontWeight: 800, height: 24 }}
                      />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Question Details
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center">
                      <FormControl size="small" sx={{ width: 140 }}>
                        <InputLabel id={`time-limit-${qIdx}`}>Time Limit</InputLabel>
                        <Select
                          labelId={`time-limit-${qIdx}`}
                          value={q.time_limit_seconds}
                          label="Time Limit"
                          onChange={(e) => handleTimeLimitChange(qIdx, Number(e.target.value))}
                          disabled={loading}
                        >
                          <MenuItem value={10}>10 Seconds</MenuItem>
                          <MenuItem value={15}>15 Seconds</MenuItem>
                          <MenuItem value={20}>20 Seconds (Default)</MenuItem>
                          <MenuItem value={30}>30 Seconds</MenuItem>
                          <MenuItem value={45}>45 Seconds</MenuItem>
                          <MenuItem value={60}>60 Seconds</MenuItem>
                        </Select>
                      </FormControl>

                      <IconButton
                        size="small"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        disabled={questions.length <= 1 || loading}
                        color="error"
                        title="Delete Question"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  <TextField
                    label={`Question #${qIdx + 1} Prompt`}
                    placeholder="e.g. Which design pattern provides a single point of access to a resource?"
                    value={q.question_text}
                    onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                    fullWidth
                    required
                    multiline
                    rows={2}
                    disabled={loading}
                    sx={{ mb: 2 }}
                  />

                  {/* Options List with Correct Answer Radio */}
                  <Box sx={{ p: 2, borderRadius: '10px', bgcolor: m3Tokens.color.background }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.onSurfaceVariant, textTransform: 'uppercase' }}>
                        Multiple Choice Options (Select the correct answer)
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleAddOption(qIdx)}
                        disabled={q.options.length >= 6 || loading}
                        sx={{ fontSize: '0.75rem', textTransform: 'none', fontWeight: 700 }}
                      >
                        Add Option
                      </Button>
                    </Stack>

                    <RadioGroup
                      value={q.correct_option_id}
                      onChange={(e) => handleCorrectOptionChange(qIdx, e.target.value)}
                    >
                      <Stack spacing={1.25}>
                        {q.options.map((opt, optIdx) => {
                          const optId = String.fromCharCode(97 + optIdx);
                          const isCorrect = q.correct_option_id === optId;
                          return (
                            <Stack direction="row" spacing={1} key={optIdx} alignItems="center">
                              <Tooltip title={isCorrect ? 'Marked as Correct Answer' : 'Click radio to mark as Correct'}>
                                <FormControlLabel
                                  value={optId}
                                  control={<Radio size="small" color="success" />}
                                  label=""
                                  sx={{ m: 0 }}
                                />
                              </Tooltip>
                              <Typography variant="body2" sx={{ fontWeight: 800, width: 24, textAlign: 'center', color: isCorrect ? 'success.main' : m3Tokens.color.primary }}>
                                {String.fromCharCode(65 + optIdx)}.
                              </Typography>
                              <TextField
                                size="small"
                                placeholder={`Option ${String.fromCharCode(65 + optIdx)} text`}
                                value={opt}
                                onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                                fullWidth
                                required
                                disabled={loading}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    bgcolor: isCorrect ? 'rgba(46, 125, 50, 0.06)' : '#FFFFFF',
                                  },
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveOption(qIdx, optIdx)}
                                disabled={q.options.length <= 2 || loading}
                                color="error"
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          );
                        })}
                      </Stack>
                    </RadioGroup>
                  </Box>
                </Paper>
              ))}

              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddQuestion}
                disabled={loading}
                sx={{ py: 1.25, borderRadius: '10px', textTransform: 'none', fontWeight: 700, borderStyle: 'dashed' }}
              >
                + Add Another Question
              </Button>
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}
          >
            {loading ? 'Creating Quiz...' : `Create Quiz (${questions.length} Questions)`}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
