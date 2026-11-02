import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../services/auth_service.dart';
import '../theme/tokens.dart';

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, val) => MapEntry(key.toString(), val));
  }
  return <String, dynamic>{};
}

List<Map<String, dynamic>> _asMapList(dynamic value) {
  if (value is List) {
    return value.whereType<Map>().map(_asMap).toList();
  }
  return <Map<String, dynamic>>[];
}

int _asInt(dynamic value, [int fallback = 0]) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

String? _asString(dynamic value) {
  if (value == null) return null;
  final text = value.toString();
  return text.isEmpty ? null : text;
}

/// Server-driven phases for a live quiz on the student's device.
///
/// [loading]   - first snapshot has not arrived yet
/// [waiting]   - activity is live but no question is open
/// [open]      - a question is live and accepting answers
/// [answered]  - the student answered, teacher has not revealed yet
/// [revealed]  - the teacher revealed the correct answer
/// [finished]  - activity ended and final results were loaded
/// [error]     - unrecoverable state (expired session)
enum _QuizPhase { loading, waiting, open, answered, revealed, finished, error }

class LiveQuizStudentScreen extends StatefulWidget {
  final String activityId;
  final String classroomId;
  final String title;
  final String scoringMode;
  final List<dynamic> questions;
  final int initialCumulativeScore;
  final List<dynamic> initialAnsweredQuestions;

  const LiveQuizStudentScreen({
    super.key,
    required this.activityId,
    required this.classroomId,
    required this.title,
    required this.scoringMode,
    required this.questions,
    this.initialCumulativeScore = 0,
    this.initialAnsweredQuestions = const [],
  });

  @override
  State<LiveQuizStudentScreen> createState() => _LiveQuizStudentScreenState();
}

class _LiveQuizStudentScreenState extends State<LiveQuizStudentScreen> {
  static const Duration _pollInterval = Duration(seconds: 2);
  static const Duration _requestTimeout = Duration(seconds: 10);

  Timer? _pollTimer;
  Timer? _tickTimer;

  Map<String, dynamic>? _activity;
  List<Map<String, dynamic>> _questions = <Map<String, dynamic>>[];
  Map<String, dynamic>? _currentQuestion;

  /// Keyed by question id, seeded from the server's `user_answers` and updated
  /// optimistically after a successful submission.
  final Map<String, Map<String, dynamic>> _answersByQuestionId =
      <String, Map<String, dynamic>>{};

  /// Questions the server told us are closed (time-up / already answered)
  /// before the next poll confirms it.
  final Set<String> _locallyClosedQuestionIds = <String>{};

  Map<String, dynamic>? _results;
  String? _resultsError;

  int _scoreSoFar = 0;
  String? _selectedOptionId;
  String? _pendingOptionId;
  String? _lastQuestionKey;

  bool _isSubmitting = false;
  bool _isFetchingActive = false;
  bool _isFetchingResults = false;
  bool _initialLoaded = false;
  bool _finished = false;
  bool _unauthorized = false;

  String? _errorMessage;
  bool _isRetryable = false;

  @override
  void initState() {
    super.initState();
    _seedFromWidgetArgs();

    _fetchActive();

    // The server owns quiz progression; polling keeps the student in sync.
    _pollTimer = Timer.periodic(_pollInterval, (_) {
      if (!mounted || _finished || _unauthorized) return;
      _fetchActive();
    });

    // Local ticker only refreshes the countdown derived from `end_time_ms`.
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _finished) return;
      if (_currentQuestion != null) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    super.dispose();
  }

  void _seedFromWidgetArgs() {
    _scoreSoFar = widget.initialCumulativeScore;
    _questions = _asMapList(widget.questions);

    for (final raw in widget.initialAnsweredQuestions) {
      final answer = _asMap(raw);
      final questionId = _asString(answer['question_id']);
      if (questionId != null) {
        _answersByQuestionId[questionId] = answer;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  _QuizPhase get _phase {
    if (_finished) return _QuizPhase.finished;
    if (_unauthorized) return _QuizPhase.error;
    if (!_initialLoaded) return _QuizPhase.loading;
    if (_currentQuestion == null) return _QuizPhase.waiting;
    if (_currentQuestion!['revealed'] == true) return _QuizPhase.revealed;

    final questionId = _asString(_currentQuestion!['question_id']);
    if (questionId != null && _hasAnswered(questionId)) {
      return _QuizPhase.answered;
    }
    return _QuizPhase.open;
  }

  bool _hasAnswered(String questionId) =>
      _answersByQuestionId.containsKey(questionId);

  Map<String, dynamic>? get _currentQuestionData {
    final current = _currentQuestion;
    if (current == null) return null;

    final questionId = _asString(current['question_id']);
    if (questionId != null) {
      for (final question in _questions) {
        if (_asString(question['id']) == questionId) return question;
      }
    }

    final index = _asInt(current['question_index'], -1);
    if (index >= 0 && index < _questions.length) {
      return _questions[index];
    }
    return null;
  }

  String? get _revealedCorrectOptionId {
    final current = _currentQuestion;
    if (current == null || current['revealed'] != true) return null;
    return _asString(current['correct_option_id']);
  }

  int get _remainingMs {
    final current = _currentQuestion;
    if (current == null) return 0;
    final endTime = _asInt(current['end_time_ms']);
    if (endTime <= 0) return 0;
    final remaining = endTime - DateTime.now().millisecondsSinceEpoch;
    return remaining < 0 ? 0 : remaining;
  }

  int get _questionDurationMs {
    final current = _currentQuestion;
    if (current == null) return 0;
    final start = _asInt(current['start_time_ms']);
    final end = _asInt(current['end_time_ms']);
    if (start <= 0 || end <= start) return 0;
    return end - start;
  }

  bool get _isQuestionOpen {
    final current = _currentQuestion;
    if (current == null) return false;
    if (current['revealed'] == true) return false;

    final questionId = _asString(current['question_id']);
    if (questionId == null) return false;
    if (_hasAnswered(questionId)) return false;
    if (_locallyClosedQuestionIds.contains(questionId)) return false;

    return _remainingMs > 0;
  }

  int get _questionNumber {
    final current = _currentQuestion;
    if (current == null) return 1;

    final index = _asInt(current['question_index'], -1);
    if (index >= 0) return index + 1;

    final questionId = _asString(current['question_id']);
    if (questionId != null) {
      final found =
          _questions.indexWhere((q) => _asString(q['id']) == questionId);
      if (found >= 0) return found + 1;
    }
    return 1;
  }

  int get _totalQuestions {
    final quiz = _asMap(_activity?['quiz']);
    final count = _asInt(quiz['question_count'], _questions.length);
    return count > 0 ? count : _questions.length;
  }

  int get _displayScore =>
      _results != null ? _asInt(_results!['score'], _scoreSoFar) : _scoreSoFar;

  // ---------------------------------------------------------------------------
  // Networking
  // ---------------------------------------------------------------------------

  Future<void> _fetchActive() async {
    if (_isFetchingActive || _finished || _unauthorized) return;
    _isFetchingActive = true;

    try {
      final token = AuthService.token;
      final response = await http.get(
        Uri.parse(
          '${AuthService.baseUrl}/live-activities/active?classroom_id=${widget.classroomId}',
        ),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(_requestTimeout);

      if (!mounted || _finished || _unauthorized) return;

      if (response.statusCode == 200) {
        Map<String, dynamic> data = <String, dynamic>{};
        try {
          data = _asMap(jsonDecode(response.body));
        } catch (_) {
          data = <String, dynamic>{};
        }

        if (data['active'] == true && data['activity'] != null) {
          _applyActivity(_asMap(data['activity']));
        } else {
          // The teacher ended the activity (or the quiz closed).
          await _finishQuiz();
        }
      } else if (response.statusCode == 401) {
        _markUnauthorized();
      } else if (mounted) {
        setState(() {
          _isRetryable = response.statusCode >= 500;
          _errorMessage = response.statusCode >= 500
              ? 'The server is temporarily unavailable. Retrying…'
              : 'Unable to refresh the live quiz (HTTP ${response.statusCode}).';
        });
      }
    } on TimeoutException {
      if (mounted && !_finished) {
        setState(() {
          _isRetryable = true;
          _errorMessage = 'The server did not respond. Retrying…';
        });
      }
    } catch (_) {
      if (mounted && !_finished) {
        setState(() {
          _isRetryable = true;
          _errorMessage = 'Network error while refreshing the live quiz. Retrying…';
        });
      }
    } finally {
      _isFetchingActive = false;
      if (mounted && !_initialLoaded) {
        setState(() => _initialLoaded = true);
      }
    }
  }

  void _applyActivity(Map<String, dynamic> activity) {
    final quiz = _asMap(activity['quiz']);
    final serverQuestions = _asMapList(quiz['questions']);

    final serverAnswers = <String, Map<String, dynamic>>{};
    for (final answer in _asMapList(activity['user_answers'])) {
      final questionId = _asString(answer['question_id']);
      if (questionId != null) {
        serverAnswers[questionId] = answer;
      }
    }

    final current = activity['current_question'] == null
        ? null
        : _asMap(activity['current_question']);
    final questionKey = current == null
        ? null
        : '${_asString(current['question_id']) ?? ''}:'
            '${_asInt(current['question_index'], -1)}';
    final questionChanged = questionKey != _lastQuestionKey;

    if (!mounted) return;
    setState(() {
      _activity = activity;
      if (serverQuestions.isNotEmpty) {
        _questions = serverQuestions;
      }

      // Merge rather than replace: a poll that started before a successful
      // submission must not resurrect an already-answered question.
      _answersByQuestionId.addAll(serverAnswers);

      final serverScore = _asInt(activity['score_so_far'], _scoreSoFar);
      if (serverScore > _scoreSoFar) {
        _scoreSoFar = serverScore;
      }

      _currentQuestion = current;
      _lastQuestionKey = questionKey;

      if (questionChanged) {
        _selectedOptionId = null;
        _pendingOptionId = null;
        _errorMessage = null;
        _isRetryable = false;
      } else if (_pendingOptionId == null) {
        // A successful poll invalidates transient polling errors, but keep a
        // failed submission's retry affordance until the student retries.
        _errorMessage = null;
        _isRetryable = false;
      }

      _initialLoaded = true;
    });
  }

  Future<void> _finishQuiz() async {
    if (_finished || _isFetchingResults) return;

    _pollTimer?.cancel();
    _tickTimer?.cancel();
    _isFetchingResults = true;

    if (mounted) {
      setState(() {
        _initialLoaded = true;
        _resultsError = null;
        _errorMessage = null;
        _isRetryable = false;
      });
    }

    try {
      final token = AuthService.token;
      final response = await http.get(
        Uri.parse(
          '${AuthService.baseUrl}/live-activities/${widget.activityId}/quiz/my-results',
        ),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(_requestTimeout);

      if (!mounted) return;

      if (response.statusCode == 200) {
        Map<String, dynamic> data = <String, dynamic>{};
        try {
          data = _asMap(jsonDecode(response.body));
        } catch (_) {
          data = <String, dynamic>{};
        }

        setState(() {
          _results = data;
          _finished = true;
          _activity = null;
          _currentQuestion = null;
          _isSubmitting = false;
        });
      } else if (response.statusCode == 401) {
        _markUnauthorized();
      } else {
        setState(() {
          _resultsError = response.statusCode >= 500
              ? 'The server is temporarily unavailable. Please retry.'
              : 'Could not load your quiz results (HTTP ${response.statusCode}).';
        });
      }
    } on TimeoutException {
      if (mounted) {
        setState(() {
          _resultsError = 'Loading your results timed out. Please retry.';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _resultsError = 'Network error loading your quiz results.';
        });
      }
    } finally {
      _isFetchingResults = false;
      if (mounted) setState(() {});
    }
  }

  void _markUnauthorized() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    if (!mounted) return;
    setState(() {
      _unauthorized = true;
      _initialLoaded = true;
      _errorMessage =
          'Your session has expired. Please sign out and log in again.';
      _isRetryable = false;
    });
  }

  // ---------------------------------------------------------------------------
  // Submitting answers
  // ---------------------------------------------------------------------------

  Future<void> _submitAnswer(String optionId) async {
    if (_isSubmitting) return;

    final current = _currentQuestion;
    final questionId = _asString(current?['question_id']);
    if (questionId == null || !_isQuestionOpen) return;

    setState(() {
      _selectedOptionId = optionId;
      _pendingOptionId = optionId;
      _isSubmitting = true;
      _errorMessage = null;
      _isRetryable = false;
    });

    try {
      final token = AuthService.token;
      final response = await http.post(
        Uri.parse(
          '${AuthService.baseUrl}/live-activities/${widget.activityId}/quiz/answer',
        ),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'question_id': questionId,
          'selected_option_id': optionId,
        }),
      ).timeout(_requestTimeout);

      Map<String, dynamic> data = <String, dynamic>{};
      if (response.body.isNotEmpty) {
        try {
          data = _asMap(jsonDecode(response.body));
        } catch (_) {
          data = <String, dynamic>{};
        }
      }

      if (!mounted) return;

      if (response.statusCode == 201) {
        final awarded = _asInt(data['score_awarded']);
        setState(() {
          _answersByQuestionId[questionId] = <String, dynamic>{
            'question_id': questionId,
            'selected_option_id': optionId,
            'is_correct': data['is_correct'] == true,
            'score_awarded': awarded,
          };
          _scoreSoFar += awarded;
          _selectedOptionId = optionId;
          _pendingOptionId = null;
          _errorMessage = null;
          _isRetryable = false;
        });
        unawaited(_fetchActive());
      } else if (response.statusCode == 401) {
        _markUnauthorized();
      } else if (response.statusCode == 409) {
        // Question is closed / already answered / results already revealed.
        // Lock it immediately so the option can never be tapped again; the
        // follow-up poll reconciles the authoritative answer/reveal state.
        _locallyClosedQuestionIds.add(questionId);
        setState(() {
          _selectedOptionId = optionId;
          _pendingOptionId = null;
          _errorMessage =
              'This question is already closed or you have already answered it.';
          _isRetryable = false;
        });
        unawaited(_fetchActive());
      } else if (response.statusCode == 400) {
        // Time expired or the option is invalid.
        _locallyClosedQuestionIds.add(questionId);
        setState(() {
          _selectedOptionId = optionId;
          _pendingOptionId = null;
          _errorMessage = _serverErrorMessage(data) ??
              'Time expired — this question is no longer accepting answers.';
          _isRetryable = false;
        });
        unawaited(_fetchActive());
      } else if (response.statusCode >= 500) {
        setState(() {
          _errorMessage =
              'The server could not record your answer. Please try again.';
          _isRetryable = true;
        });
      } else {
        setState(() {
          _errorMessage = _serverErrorMessage(data) ??
              'Could not submit your answer (HTTP ${response.statusCode}).';
          _isRetryable = false;
        });
      }
    } on TimeoutException {
      if (mounted) {
        setState(() {
          _errorMessage = 'Submitting your answer timed out. Please try again.';
          _isRetryable = true;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _errorMessage =
              'Network error submitting your answer. Please try again.';
          _isRetryable = true;
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  String? _serverErrorMessage(Map<String, dynamic> data) =>
      _asString(data['error']) ?? _asString(data['message']);

  void _retryAfterError() {
    final pendingOption = _pendingOptionId;
    if (_isRetryable && pendingOption != null && _isQuestionOpen) {
      _submitAnswer(pendingOption);
      return;
    }
    _fetchActive();
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final appBarTitle = _asString(_results?['title']) ?? widget.title;

    return Scaffold(
      backgroundColor: M3Tokens.surface,
      appBar: AppBar(
        title: Text(
          appBarTitle,
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
                const Icon(Icons.stars,
                    size: 16, color: M3Tokens.onPrimaryContainer),
                const SizedBox(width: 4),
                Text(
                  '$_displayScore pts',
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
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_unauthorized) {
      return _buildFullMessage(
        icon: Icons.lock_outline,
        title: 'Session expired',
        message:
            _errorMessage ?? 'Please sign out and log in again to continue.',
      );
    }

    if (_resultsError != null) {
      return _buildFullMessage(
        icon: Icons.cloud_off_outlined,
        title: 'Could not load results',
        message: _resultsError!,
        action: FilledButton.icon(
          onPressed: _finishQuiz,
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Retry'),
        ),
      );
    }

    switch (_phase) {
      case _QuizPhase.loading:
        return const Center(child: CircularProgressIndicator());
      case _QuizPhase.finished:
        return _buildFinishedBody();
      case _QuizPhase.error:
        return _buildFullMessage(
          icon: Icons.lock_outline,
          title: 'Session expired',
          message:
              _errorMessage ?? 'Please sign out and log in again to continue.',
        );
      case _QuizPhase.waiting:
        if (_activity == null && _errorMessage != null) {
          return _buildFullMessage(
            icon: Icons.cloud_off_outlined,
            title: 'Unable to load the live quiz',
            message: _errorMessage!,
            action: FilledButton.icon(
              onPressed: _fetchActive,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Retry'),
            ),
          );
        }
        return _buildWaitingBody();
      case _QuizPhase.open:
      case _QuizPhase.answered:
      case _QuizPhase.revealed:
        return _buildQuestionBody();
    }
  }

  Widget _buildFullMessage({
    required IconData icon,
    required String title,
    required String message,
    Widget? action,
  }) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
            border: Border.all(color: M3Tokens.outlineVariant),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 48, color: M3Tokens.outline),
              const SizedBox(height: 12),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: M3Tokens.onSurface,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: M3Tokens.onSurfaceVariant,
                  fontSize: 13,
                ),
              ),
              if (action != null) ...[
                const SizedBox(height: 20),
                action,
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWaitingBody() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            const Text(
              'Waiting for the teacher to start the first question…',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 15,
                color: M3Tokens.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'This screen updates automatically.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: M3Tokens.onSurfaceVariant,
                fontSize: 12,
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 20),
              _buildErrorBanner(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildQuestionBody() {
    final current = _currentQuestion!;
    final question = _currentQuestionData;
    final questionId = _asString(current['question_id']);
    final options = _asMapList(question?['options']);
    final revealed = current['revealed'] == true;
    final correctOptionId = _revealedCorrectOptionId;
    final answer =
        questionId == null ? null : _answersByQuestionId[questionId];
    final selectedOptionId =
        _selectedOptionId ?? _asString(answer?['selected_option_id']);
    final remainingMs = _remainingMs;
    final remainingSeconds = (remainingMs / 1000).ceil();
    final durationMs = _questionDurationMs;
    final progress = durationMs > 0
        ? (remainingMs / durationMs).clamp(0.0, 1.0).toDouble()
        : 0.0;
    final questionText = _asString(question?['question_text']) ??
        _asString(current['question_text']) ??
        'Question';
    final answered = questionId != null && _hasAnswered(questionId);
    final timeUp = remainingMs <= 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: M3Tokens.primary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Q$_questionNumber of $_totalQuestions',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
              Row(
                children: [
                  Icon(
                    Icons.timer_outlined,
                    size: 18,
                    color: remainingSeconds <= 5
                        ? Colors.red
                        : M3Tokens.onSurfaceVariant,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${remainingSeconds}s',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: remainingSeconds <= 5
                          ? Colors.red
                          : M3Tokens.onSurface,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: M3Tokens.outlineVariant,
              valueColor: AlwaysStoppedAnimation<Color>(
                revealed
                    ? M3Tokens.secondary
                    : remainingSeconds <= 5
                        ? Colors.red
                        : M3Tokens.primary,
              ),
            ),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
              border: Border.all(color: M3Tokens.outlineVariant),
            ),
            child: Text(
              questionText,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: M3Tokens.onSurface,
              ),
            ),
          ),
          const SizedBox(height: 20),
          if (_errorMessage != null) _buildErrorBanner(),
          if (options.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                border: Border.all(color: M3Tokens.outlineVariant),
              ),
              child: const Text(
                'No options are available for this question yet.',
                style: TextStyle(
                  color: M3Tokens.onSurfaceVariant,
                  fontSize: 13,
                ),
              ),
            )
          else
            ...options.map((option) {
              final optionId = _asString(option['id']) ?? '';
              if (optionId.isEmpty) {
                return const SizedBox.shrink();
              }
              final optionText = _asString(option['text']) ?? '';
              final isSelected = selectedOptionId == optionId;
              final isCorrectOption =
                  revealed && correctOptionId == optionId;
              final isWrongSelection =
                  revealed && isSelected && !isCorrectOption;
              final canTap = _isQuestionOpen && !_isSubmitting;

              Color cardBg = Colors.white;
              Color borderColor = M3Tokens.outlineVariant;

              if (isCorrectOption) {
                cardBg = Colors.green.shade50;
                borderColor = Colors.green;
              } else if (isWrongSelection) {
                cardBg = Colors.red.shade50;
                borderColor = Colors.red;
              } else if (isSelected) {
                cardBg = M3Tokens.primaryContainer;
                borderColor = M3Tokens.primary;
              }

              return Padding(
                padding: const EdgeInsets.only(bottom: 12.0),
                child: InkWell(
                  onTap: canTap ? () => _submitAnswer(optionId) : null,
                  borderRadius:
                      BorderRadius.circular(M3Tokens.shapeMedium),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius:
                          BorderRadius.circular(M3Tokens.shapeMedium),
                      border: Border.all(
                        color: borderColor,
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: isSelected
                                ? M3Tokens.primary
                                : Colors.grey.shade100,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            optionId.toUpperCase(),
                            style: TextStyle(
                              color: isSelected
                                  ? Colors.white
                                  : M3Tokens.onSurface,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            optionText,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: isSelected
                                  ? FontWeight.bold
                                  : FontWeight.normal,
                              color: M3Tokens.onSurface,
                            ),
                          ),
                        ),
                        if (_isSubmitting && isSelected)
                          const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        else if (isCorrectOption)
                          const Icon(Icons.check_circle,
                              color: Colors.green, size: 24)
                        else if (isWrongSelection)
                          const Icon(Icons.cancel,
                              color: Colors.red, size: 24)
                        else if (isSelected && !revealed)
                          const Icon(
                            Icons.check_circle_outline,
                            color: M3Tokens.primary,
                            size: 24,
                          ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          const SizedBox(height: 8),
          if (revealed)
            _buildRevealedBanner(
              questionId: questionId,
              answer: answer,
              correctOptionId: correctOptionId,
            )
          else if (answered)
            _buildAnsweredBanner()
          else if (timeUp)
            _buildTimeUpBanner(),
        ],
      ),
    );
  }

  Widget _buildRevealedBanner({
    required String? questionId,
    required Map<String, dynamic>? answer,
    required String? correctOptionId,
  }) {
    final didAnswer = answer != null;
    final isCorrect = answer?['is_correct'] == true;
    final awarded = _asInt(answer?['score_awarded']);

    final Color background = !didAnswer
        ? M3Tokens.surfaceVariant
        : isCorrect
            ? Colors.green.shade50
            : Colors.red.shade50;
    final Color border = !didAnswer
        ? M3Tokens.outlineVariant
        : isCorrect
            ? Colors.green.shade200
            : Colors.red.shade200;
    final Color foreground = !didAnswer
        ? M3Tokens.onSurfaceVariant
        : isCorrect
            ? Colors.green.shade800
            : Colors.red.shade800;
    final IconData icon = !didAnswer
        ? Icons.remove_circle_outline
        : isCorrect
            ? Icons.check_circle
            : Icons.cancel;
    final Color iconColor = !didAnswer
        ? M3Tokens.onSurfaceVariant
        : isCorrect
            ? Colors.green
            : Colors.red;

    final String headline = !didAnswer
        ? 'You did not answer this question'
        : isCorrect
            ? 'Correct! +$awarded pts'
            : 'Incorrect (+0 pts)';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
        border: Border.all(color: border),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: iconColor, size: 22),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  headline,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: foreground,
                  ),
                ),
              ),
            ],
          ),
          if (correctOptionId != null) ...[
            const SizedBox(height: 10),
            Text(
              'Correct answer: ${_optionLabel(questionId, correctOptionId)}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: M3Tokens.onSurface,
              ),
            ),
          ],
          const SizedBox(height: 6),
          const Text(
            'Waiting for the teacher to open the next question…',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: M3Tokens.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnsweredBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: M3Tokens.primaryContainer,
        borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              Icon(Icons.lock_clock,
                  color: M3Tokens.onPrimaryContainer, size: 22),
              SizedBox(width: 8),
              Text(
                'Answer submitted',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: M3Tokens.onPrimaryContainer,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Waiting for the teacher to reveal the correct answer…',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: M3Tokens.onPrimaryContainer,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeUpBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.timer_off_outlined,
              color: Colors.orange.shade800, size: 22),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Time is up for this question. Waiting for the teacher…',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: M3Tokens.onSurface,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
          if (_isRetryable) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _isSubmitting ? null : _retryAfterError,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Retry'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Final results
  // ---------------------------------------------------------------------------

  Widget _buildFinishedBody() {
    final results = _results ?? <String, dynamic>{};
    final score = _asInt(results['score'], _scoreSoFar);
    final correct = _asInt(results['correct_count']);
    final answered = _asInt(results['answered_count']);
    final total = _asInt(results['total_questions'], _totalQuestions);
    final rank = _asInt(results['rank']);
    final participants = _asInt(results['participants']);
    final review = _asMapList(results['questions']);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
              border: Border.all(color: M3Tokens.primary, width: 2),
            ),
            child: Column(
              children: [
                const Icon(Icons.emoji_events,
                    size: 56, color: Colors.amber),
                const SizedBox(height: 12),
                const Text(
                  'Quiz Completed!',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: M3Tokens.onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$score pts',
                  style: const TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.bold,
                    color: M3Tokens.primary,
                  ),
                ),
                if (rank > 0 && participants > 0) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Ranked #$rank out of $participants participants',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: M3Tokens.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _StatTile(
                  icon: Icons.check_circle_outline,
                  label: 'Correct',
                  value: '$correct/$total',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatTile(
                  icon: Icons.edit_note,
                  label: 'Answered',
                  value: '$answered/$total',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatTile(
                  icon: Icons.leaderboard_outlined,
                  label: 'Rank',
                  value: rank > 0 ? '#$rank' : '—',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatTile(
                  icon: Icons.groups_outlined,
                  label: 'Participants',
                  value: participants > 0 ? '$participants' : '—',
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Text(
            'Question Review',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: M3Tokens.onSurface,
            ),
          ),
          const SizedBox(height: 12),
          if (review.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                border: Border.all(color: M3Tokens.outlineVariant),
              ),
              child: const Text(
                'No question breakdown is available for this quiz.',
                style: TextStyle(
                  color: M3Tokens.onSurfaceVariant,
                  fontSize: 13,
                ),
              ),
            )
          else
            ...review.map(_buildReviewCard),
          const SizedBox(height: 12),
          SizedBox(
            height: 50,
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back, size: 18),
              label: const Text(
                'Back to classroom',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: M3Tokens.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewCard(Map<String, dynamic> item) {
    final questionId = _asString(item['question_id']);
    final questionText = _asString(item['question_text']) ?? 'Question';
    final selectedOptionId = _asString(item['selected_option_id']);
    final correctOptionId = _asString(item['correct_option_id']);
    final isCorrect = item['is_correct'] == true;
    final answered = selectedOptionId != null;
    final awarded = _asInt(item['score_awarded']);

    final Color iconColor = !answered
        ? M3Tokens.onSurfaceVariant
        : isCorrect
            ? Colors.green
            : Colors.red;
    final IconData icon = !answered
        ? Icons.remove_circle_outline
        : isCorrect
            ? Icons.check_circle
            : Icons.cancel;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
        border: Border.all(color: M3Tokens.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: iconColor, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  questionText,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: M3Tokens.onSurface,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: M3Tokens.primaryContainer,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '+$awarded pts',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: M3Tokens.onPrimaryContainer,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Your answer: '
            '${answered ? _optionLabel(questionId, selectedOptionId) : 'Not answered'}',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isCorrect ? Colors.green.shade800 : M3Tokens.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Correct answer: ${_optionLabel(questionId, correctOptionId)}',
            style: const TextStyle(
              fontSize: 12,
              color: M3Tokens.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  String _optionLabel(String? questionId, String? optionId) {
    if (optionId == null) return '—';

    if (questionId != null) {
      for (final question in _questions) {
        if (_asString(question['id']) != questionId) continue;
        for (final option in _asMapList(question['options'])) {
          if (_asString(option['id']) == optionId) {
            final text = _asString(option['text']) ?? '';
            return text.isEmpty
                ? optionId.toUpperCase()
                : '${optionId.toUpperCase()} — $text';
          }
        }
      }
    }
    return optionId.toUpperCase();
  }
}

class _StatTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _StatTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
        border: Border.all(color: M3Tokens.outlineVariant),
      ),
      child: Column(
        children: [
          Icon(icon, color: M3Tokens.primary, size: 22),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.bold,
              color: M3Tokens.onSurface,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: M3Tokens.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
