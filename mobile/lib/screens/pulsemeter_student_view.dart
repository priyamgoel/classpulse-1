import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../services/auth_service.dart';
import '../services/classroom_service.dart';
import '../theme/tokens.dart';
import 'live_pulsemeter_screen.dart';
import 'live_quiz_student_screen.dart';

Map<String, dynamic> _safeMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, val) => MapEntry(key.toString(), val));
  }
  return <String, dynamic>{};
}

Map<String, dynamic>? _safeMapOrNull(dynamic value) {
  if (value is Map) return _safeMap(value);
  return null;
}

List<Map<String, dynamic>> _safeMapList(dynamic value) {
  if (value is List) {
    return value.whereType<Map>().map(_safeMap).toList();
  }
  return <Map<String, dynamic>>[];
}

String _asString(dynamic value) => value?.toString() ?? '';

class PulseMeterStudentView extends StatefulWidget {
  final String? initialClassroomId;
  final LiveActivityMode mode;

  const PulseMeterStudentView({
    super.key,
    this.initialClassroomId,
    this.mode = LiveActivityMode.all,
  });

  @override
  State<PulseMeterStudentView> createState() => _PulseMeterStudentViewState();
}

/// Restricts which live activity type this view shows.
///
/// The bottom navigation has separate PulseMeter and Quizzes destinations, so
/// each must only surface its own activity type instead of both rendering the
/// same live card. [all] keeps the previous combined behaviour.
enum LiveActivityMode { pulsemeter, quiz, all }

class _PulseMeterStudentViewState extends State<PulseMeterStudentView> {
  List<Classroom> _classrooms = [];
  String? _selectedClassroomId;
  bool _isLoading = true;
  bool _isChecking = false;
  String? _inFlightClassroomId;
  int _checkSeq = 0;
  Map<String, dynamic>? _activeActivity;
  String? _message;
  Timer? _pollTimer;

  bool _matchesMode(Map<String, dynamic> activity) {
    switch (widget.mode) {
      case LiveActivityMode.pulsemeter:
        return activity['activity_type'] == 'PULSEMETER';
      case LiveActivityMode.quiz:
        return activity['activity_type'] == 'QUIZ';
      case LiveActivityMode.all:
        return true;
    }
  }

  String get _idleMessage {
    switch (widget.mode) {
      case LiveActivityMode.pulsemeter:
        return 'No live PulseMeter activity is currently active for this section.';
      case LiveActivityMode.quiz:
        return 'No live quiz is currently active for this section.';
      case LiveActivityMode.all:
        return 'No live activity is currently active for this section.';
    }
  }

  @override
  void initState() {
    super.initState();
    _loadClassrooms();
    // Auto-poll every 4 seconds to discover live activities launched by the teacher
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (mounted &&
          _selectedClassroomId != null &&
          _inFlightClassroomId != _selectedClassroomId) {
        _checkActiveActivity(_selectedClassroomId!, silent: true);
      }
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadClassrooms() async {
    setState(() {
      _isLoading = true;
    });
    final list = await ClassroomService.fetchMyClassrooms();
    setState(() {
      _classrooms = list;
      if (list.isNotEmpty) {
        final initialId = widget.initialClassroomId;
        // Keep DropdownButton.value inside its items even when the requested
        // classroom is no longer in the student's enrollment list.
        final hasInitial =
            initialId != null && list.any((c) => c.id == initialId);
        _selectedClassroomId = hasInitial ? initialId : list.first.id;
      } else {
        _selectedClassroomId = null;
      }
      _isLoading = false;
    });

    if (_selectedClassroomId != null) {
      _checkActiveActivity(_selectedClassroomId!);
    }
  }

  Future<void> _checkActiveActivity(
    String classroomId, {
    bool silent = false,
  }) async {
    // Track in-flight checks per classroom so switching sections is not
    // blocked by the previous section's request.
    if (_inFlightClassroomId == classroomId) return;
    _inFlightClassroomId = classroomId;
    final requestedClassroomId = classroomId;
    final requestSeq = ++_checkSeq;

    if (!silent) {
      setState(() {
        _isChecking = true;
        _message = null;
      });
    }

    try {
      final token = AuthService.token;
      final response = await http
          .get(
            Uri.parse(
              '${AuthService.baseUrl}/live-activities/active?classroom_id=$classroomId',
            ),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 10));

      if (!mounted ||
          requestedClassroomId != _selectedClassroomId ||
          requestSeq != _checkSeq) {
        return;
      }

      if (response.statusCode == 200) {
        Map<String, dynamic> data;
        try {
          data = _safeMap(jsonDecode(response.body));
        } catch (_) {
          data = <String, dynamic>{};
        }

        if (data['active'] == true && data['activity'] != null) {
          final activity = _safeMap(data['activity']);
          if (_matchesMode(activity)) {
            setState(() {
              _activeActivity = activity;
              _message = null;
            });
          } else {
            setState(() {
              _activeActivity = null;
              _message = _idleMessage;
            });
          }
        } else {
          setState(() {
            _activeActivity = null;
            _message = _idleMessage;
          });
        }
      } else {
        if (!silent) {
          setState(() {
            _activeActivity = null;
            _message = 'Unable to check live activities.';
          });
        }
      }
    } on TimeoutException {
      if (!silent &&
          mounted &&
          requestedClassroomId == _selectedClassroomId &&
          requestSeq == _checkSeq) {
        setState(() {
          _activeActivity = null;
          _message = 'The server did not respond. Please try again.';
        });
      }
    } catch (_) {
      if (!silent &&
          mounted &&
          requestedClassroomId == _selectedClassroomId &&
          requestSeq == _checkSeq) {
        setState(() {
          _activeActivity = null;
          _message = 'Network error checking live activity.';
        });
      }
    } finally {
      if (_inFlightClassroomId == requestedClassroomId &&
          requestSeq == _checkSeq) {
        _inFlightClassroomId = null;
        if (mounted &&
            requestedClassroomId == _selectedClassroomId &&
            _isChecking) {
          setState(() => _isChecking = false);
        }
      }
    }
  }

  void _joinLiveActivity() {
    if (_activeActivity == null) return;
    final selectedClassroomId = _selectedClassroomId;
    if (selectedClassroomId == null) return;

    final activity = _activeActivity!;
    final activityClassroomId = _asString(activity['classroom_id']);
    if (activityClassroomId != selectedClassroomId) {
      // The card belongs to a different section (stale check response); do not
      // navigate with mismatched IDs.
      _checkActiveActivity(selectedClassroomId);
      return;
    }

    final isQuiz = activity['activity_type'] == 'QUIZ';
    final userResponse = _safeMapOrNull(activity['user_response']);
    final activityId = (activity['id'] ?? '').toString();
    final initialScore = userResponse?['cumulative_score'];

    if (isQuiz) {
      final quiz = _safeMap(activity['quiz']);
      Navigator.of(context)
          .push(
            MaterialPageRoute(
              builder:
                  (_) => LiveQuizStudentScreen(
                    activityId: activityId,
                    classroomId: selectedClassroomId,
                    title: (quiz['title'] ?? 'Live Quiz').toString(),
                    scoringMode: (quiz['scoring_mode'] ?? 'WIDE').toString(),
                    questions: _safeMapList(quiz['questions']),
                    initialCumulativeScore:
                        initialScore is num ? initialScore.toInt() : 0,
                    initialAnsweredQuestions: _safeMapList(
                      userResponse?['answered_questions'],
                    ),
                  ),
            ),
          )
          .then((_) {
            if (_selectedClassroomId != null) {
              _checkActiveActivity(_selectedClassroomId!);
            }
          });
      return;
    }

    final pulsemeter = _safeMap(activity['pulsemeter']);
    if (pulsemeter.isNotEmpty) {
      Navigator.of(context)
          .push(
            MaterialPageRoute(
              builder:
                  (_) => LivePulseMeterScreen(
                    activityId: activityId,
                    classroomId: selectedClassroomId,
                    title:
                        (pulsemeter['title'] ?? 'Live PulseMeter').toString(),
                    type: (pulsemeter['type'] ?? 'WORD_CLOUD').toString(),
                    config: _safeMap(pulsemeter['config']),
                    initialHasSubmitted: userResponse?['has_responded'] == true,
                    initialResponseValue: userResponse?['response_value'],
                  ),
            ),
          )
          .then((_) {
            if (_selectedClassroomId != null) {
              _checkActiveActivity(_selectedClassroomId!);
            }
          });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_classrooms.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: const [
              Icon(Icons.speed, size: 48, color: M3Tokens.outlineVariant),
              SizedBox(height: 12),
              Text(
                'No Classrooms Enrolled',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              SizedBox(height: 4),
              Text(
                'Join a classroom section first to participate in live PulseMeters.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: M3Tokens.onSurfaceVariant,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final activeActivity = _activeActivity;
    final isQuiz = activeActivity?['activity_type'] == 'QUIZ';
    final quiz = _safeMap(activeActivity?['quiz']);
    final pulsemeter = _safeMap(activeActivity?['pulsemeter']);
    final activityBadge =
        isQuiz
            ? 'QUIZ'
            : (pulsemeter['type'] ?? 'POLL').toString().replaceAll('_', ' ');
    final activityTitle =
        isQuiz
            ? (quiz['title'] ?? 'Live Quiz').toString()
            : (pulsemeter['title'] ?? 'Live Question').toString();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Section Selector
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
              border: Border.all(color: M3Tokens.outlineVariant),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                value: _selectedClassroomId,
                items:
                    _classrooms.map((c) {
                      return DropdownMenuItem<String>(
                        value: c.id,
                        child: Text(
                          '${c.courseCode}: ${c.sectionName}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      );
                    }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() {
                      _selectedClassroomId = val;
                      _activeActivity = null;
                      _message = null;
                      _isChecking = true;
                    });
                    _checkActiveActivity(val);
                  }
                },
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Active Activity Status
          if (_isChecking)
            const Padding(
              padding: EdgeInsets.all(32.0),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_activeActivity != null) ...[
            // Active Activity Card (Quiz or PulseMeter)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
                border: Border.all(color: M3Tokens.primary, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: M3Tokens.primary.withValues(alpha: 0.08),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.red.shade300),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: Colors.red,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Text(
                              'ACTIVITY LIVE NOW',
                              style: TextStyle(
                                color: Colors.red,
                                fontWeight: FontWeight.bold,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: M3Tokens.primaryContainer,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          activityBadge,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: M3Tokens.onPrimaryContainer,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    activityTitle,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: M3Tokens.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    isQuiz
                        ? 'Your instructor has launched a live quiz for this classroom.'
                        : 'Your instructor has launched a live PulseMeter activity for this classroom.',
                    style: const TextStyle(
                      fontSize: 13,
                      color: M3Tokens.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton.icon(
                      onPressed: _joinLiveActivity,
                      icon: Icon(
                        isQuiz ? Icons.quiz_outlined : Icons.play_arrow,
                      ),
                      label: Text(
                        isQuiz ? 'Join Live Quiz' : 'Join Live PulseMeter',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: M3Tokens.primary,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            M3Tokens.shapeMedium,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ] else ...[
            // Idle State
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
                border: Border.all(color: M3Tokens.outlineVariant),
              ),
              child: Column(
                children: [
                  const Icon(Icons.speed, size: 48, color: M3Tokens.outline),
                  const SizedBox(height: 12),
                  const Text(
                    'No Active Activity',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _message ??
                        'When your instructor launches a quiz, Word Cloud, Poll, or Rating Scale, it will appear here in real time.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: M3Tokens.onSurfaceVariant,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 20),
                  OutlinedButton.icon(
                    onPressed: () {
                      if (_selectedClassroomId != null) {
                        _checkActiveActivity(_selectedClassroomId!);
                      }
                    },
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Check for Live Activity'),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
