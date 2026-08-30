import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../services/auth_service.dart';
import '../theme/tokens.dart';

class LiveQuizStudentScreen extends StatefulWidget {
  final String activityId;
  final String classroomId;
  final String title;
  final String scoringMode;
  final List<dynamic> questions;

  const LiveQuizStudentScreen({
    super.key,
    required this.activityId,
    required this.classroomId,
    required this.title,
    required this.scoringMode,
    required this.questions,
  });

  @override
  State<LiveQuizStudentScreen> createState() => _LiveQuizStudentScreenState();
}

class _LiveQuizStudentScreenState extends State<LiveQuizStudentScreen> {
  int _currentQuestionIndex = 0;
  String? _selectedOptionId;
  bool _isSubmitting = false;
  bool _hasSubmitted = false;
  bool _isCorrect = false;
  int _scoreAwarded = 0;
  int _cumulativeScore = 0;
  int _correctAnswersCount = 0;
  String? _correctOptionId;
  String? _errorMessage;

  Timer? _timer;
  int _remainingSeconds = 20;
  int _totalQuestionSeconds = 20;

  @override
  void initState() {
    super.initState();
    _startQuestionTimer();
  }

  void _startQuestionTimer() {
    final q = _getCurrentQuestion();
    _totalQuestionSeconds = (q['time_limit_seconds'] as int?) ?? 20;
    _remainingSeconds = _totalQuestionSeconds;
    _selectedOptionId = null;
    _hasSubmitted = false;
    _errorMessage = null;

    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        if (_remainingSeconds > 0) {
          _remainingSeconds--;
        } else {
          _timer?.cancel();
        }
      });
    });
  }

  Map<String, dynamic> _getCurrentQuestion() {
    if (widget.questions.isEmpty) return {};
    if (_currentQuestionIndex < widget.questions.length) {
      return widget.questions[_currentQuestionIndex] as Map<String, dynamic>;
    }
    return widget.questions.first as Map<String, dynamic>;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _submitAnswer(String optionId) async {
    if (_hasSubmitted || _isSubmitting) return;

    final q = _getCurrentQuestion();
    final questionId = q['id'];
    if (questionId == null) return;

    setState(() {
      _selectedOptionId = optionId;
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final token = AuthService.token;
      final response = await http.post(
        Uri.parse('${AuthService.baseUrl}/live-activities/${widget.activityId}/quiz/answer'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'question_id': questionId,
          'selected_option_id': optionId,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        final isCorrect = data['is_correct'] == true;
        final score = (data['score_awarded'] as int?) ?? 0;
        final correctOpt = data['correct_option_id'] as String?;

        setState(() {
          _hasSubmitted = true;
          _isSubmitting = false;
          _isCorrect = isCorrect;
          _scoreAwarded = score;
          _cumulativeScore += score;
          if (isCorrect) _correctAnswersCount++;
          _correctOptionId = correctOpt;
        });
      } else {
        setState(() {
          _errorMessage = data['error'] ?? 'Failed to submit answer.';
          _isSubmitting = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network error submitting quiz answer.';
        _isSubmitting = false;
      });
    }
  }

  void _nextQuestion() {
    if (_currentQuestionIndex + 1 < widget.questions.length) {
      setState(() {
        _currentQuestionIndex++;
      });
      _startQuestionTimer();
    } else {
      // Quiz finished
      _showFinalScoreDialog();
    }
  }

  void _showFinalScoreDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Quiz Completed! 🎉', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.emoji_events, size: 56, color: Colors.amber),
            const SizedBox(height: 12),
            Text(
              '$_cumulativeScore pts',
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: M3Tokens.primary),
            ),
            const SizedBox(height: 6),
            Text(
              'You answered $_correctAnswersCount of ${widget.questions.length} questions correctly.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: M3Tokens.onSurfaceVariant, fontSize: 13),
            ),
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pop();
            },
            child: const Text('Return to Classroom'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final q = _getCurrentQuestion();
    final questionText = q['question_text'] ?? 'Question Prompt';
    final options = (q['options'] as List?) ?? [];
    final progress = _totalQuestionSeconds > 0 ? (_remainingSeconds / _totalQuestionSeconds) : 0.0;

    return Scaffold(
      backgroundColor: M3Tokens.surface,
      appBar: AppBar(
        title: Text(
          widget.title,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: M3Tokens.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.stars, size: 16, color: M3Tokens.onPrimaryContainer),
                const SizedBox(width: 4),
                Text(
                  '$_cumulativeScore pts',
                  style: const TextStyle(
                    color: M3Tokens.onPrimaryContainer,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Question Header & Timer
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: M3Tokens.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Q${_currentQuestionIndex + 1} of ${widget.questions.length}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                  Row(
                    children: [
                      Icon(
                        Icons.timer_outlined,
                        size: 18,
                        color: _remainingSeconds <= 5 ? Colors.red : M3Tokens.onSurfaceVariant,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${_remainingSeconds}s',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: _remainingSeconds <= 5 ? Colors.red : M3Tokens.onSurface,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Progress countdown bar
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 6,
                  backgroundColor: M3Tokens.outlineVariant,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    _remainingSeconds <= 5 ? Colors.red : M3Tokens.primary,
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Question Text Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
                  border: Border.all(color: M3Tokens.outlineVariant),
                ),
                child: Text(
                  questionText,
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: M3Tokens.onSurface),
                ),
              ),
              const SizedBox(height: 20),

              if (_errorMessage != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: Colors.red, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),

              // Options list
              ...options.map((opt) {
                final optId = (opt['id'] ?? '').toString();
                final optText = opt['text'] ?? '';
                final isSelected = _selectedOptionId == optId;
                final isCorrectOption = _correctOptionId == optId;

                Color cardBg = Colors.white;
                Color borderColor = M3Tokens.outlineVariant;

                if (_hasSubmitted) {
                  if (isSelected && _isCorrect) {
                    cardBg = Colors.green.shade50;
                    borderColor = Colors.green;
                  } else if (isSelected && !_isCorrect) {
                    cardBg = Colors.red.shade50;
                    borderColor = Colors.red;
                  } else if (isCorrectOption) {
                    cardBg = Colors.green.shade50;
                    borderColor = Colors.green;
                  }
                } else if (isSelected) {
                  cardBg = M3Tokens.primaryContainer;
                  borderColor = M3Tokens.primary;
                }

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: InkWell(
                    onTap: (_hasSubmitted || _remainingSeconds <= 0) ? null : () => _submitAnswer(optId),
                    borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                        border: Border.all(color: borderColor, width: isSelected ? 2 : 1),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: isSelected ? M3Tokens.primary : Colors.grey.shade100,
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              optId.toUpperCase(),
                              style: TextStyle(
                                color: isSelected ? Colors.white : M3Tokens.onSurface,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              optText,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                color: M3Tokens.onSurface,
                              ),
                            ),
                          ),
                          if (_hasSubmitted && isSelected && _isCorrect)
                            const Icon(Icons.check_circle, color: Colors.green, size: 24)
                          else if (_hasSubmitted && isSelected && !_isCorrect)
                            const Icon(Icons.cancel, color: Colors.red, size: 24),
                        ],
                      ),
                    ),
                  ),
                );
              }),

              const SizedBox(height: 16),

              // Feedback Banner after submission
              if (_hasSubmitted)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _isCorrect ? Colors.green.shade50 : Colors.red.shade50,
                    borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                    border: Border.all(color: _isCorrect ? Colors.green.shade200 : Colors.red.shade200),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _isCorrect ? Icons.check_circle : Icons.cancel,
                            color: _isCorrect ? Colors.green : Colors.red,
                            size: 22,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _isCorrect ? 'Correct! +$_scoreAwarded pts' : 'Incorrect (+0 pts)',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: _isCorrect ? Colors.green.shade800 : Colors.red.shade800,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _nextQuestion,
                          style: FilledButton.styleFrom(
                            backgroundColor: M3Tokens.primary,
                          ),
                          child: Text(
                            _currentQuestionIndex + 1 < widget.questions.length ? 'Next Question' : 'View Final Results',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
