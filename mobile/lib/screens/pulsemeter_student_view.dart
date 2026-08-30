import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../services/auth_service.dart';
import '../services/classroom_service.dart';
import '../theme/tokens.dart';
import 'live_pulsemeter_screen.dart';
import 'live_quiz_student_screen.dart';

class PulseMeterStudentView extends StatefulWidget {
  final String? initialClassroomId;

  const PulseMeterStudentView({super.key, this.initialClassroomId});

  @override
  State<PulseMeterStudentView> createState() => _PulseMeterStudentViewState();
}

class _PulseMeterStudentViewState extends State<PulseMeterStudentView> {
  List<Classroom> _classrooms = [];
  String? _selectedClassroomId;
  bool _isLoading = true;
  bool _isChecking = false;
  Map<String, dynamic>? _activeActivity;
  String? _message;

  @override
  void initState() {
    super.initState();
    _loadClassrooms();
  }

  Future<void> _loadClassrooms() async {
    setState(() {
      _isLoading = true;
    });
    final list = await ClassroomService.fetchMyClassrooms();
    setState(() {
      _classrooms = list;
      if (list.isNotEmpty) {
        _selectedClassroomId = widget.initialClassroomId ?? list.first.id;
      }
      _isLoading = false;
    });

    if (_selectedClassroomId != null) {
      _checkActiveActivity(_selectedClassroomId!);
    }
  }

  Future<void> _checkActiveActivity(String classroomId) async {
    setState(() {
      _isChecking = true;
      _message = null;
    });

    try {
      final token = AuthService.token;
      final response = await http.get(
        Uri.parse('${AuthService.baseUrl}/live-activities/active?classroom_id=$classroomId'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['active'] == true && data['activity'] != null) {
          setState(() {
            _activeActivity = data['activity'];
            _isChecking = false;
          });
        } else {
          setState(() {
            _activeActivity = null;
            _message = 'No PulseMeter activity is currently active for this section.';
            _isChecking = false;
          });
        }
      } else {
        setState(() {
          _activeActivity = null;
          _message = 'Unable to check live activities.';
          _isChecking = false;
        });
      }
    } catch (e) {
      setState(() {
        _activeActivity = null;
        _message = 'Network error checking live activity.';
        _isChecking = false;
      });
    }
  }

  void _joinLiveActivity() {
    if (_activeActivity == null) return;

    final activity = _activeActivity!;
    final isQuiz = activity['activity_type'] == 'QUIZ';

    if (isQuiz && activity['quiz'] != null) {
      final quiz = activity['quiz'];
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => LiveQuizStudentScreen(
            activityId: activity['id'],
            classroomId: _selectedClassroomId!,
            title: quiz['title'] ?? 'Live Quiz',
            scoringMode: quiz['scoring_mode'] ?? 'WIDE',
            questions: (quiz['questions'] as List?) ?? [],
          ),
        ),
      ).then((_) {
        if (_selectedClassroomId != null) {
          _checkActiveActivity(_selectedClassroomId!);
        }
      });
      return;
    }

    final pulsemeter = activity['pulsemeter'];
    if (pulsemeter != null) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => LivePulseMeterScreen(
            activityId: activity['id'],
            classroomId: _selectedClassroomId!,
            title: pulsemeter['title'] ?? 'Live PulseMeter',
            type: pulsemeter['type'] ?? 'WORD_CLOUD',
            config: (pulsemeter['config'] as Map<String, dynamic>?) ?? {},
          ),
        ),
      ).then((_) {
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
                style: TextStyle(color: M3Tokens.onSurfaceVariant, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

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
                items: _classrooms.map((c) {
                  return DropdownMenuItem<String>(
                    value: c.id,
                    child: Text(
                      '${c.courseCode}: ${c.sectionName}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() {
                      _selectedClassroomId = val;
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
            // Active PulseMeter Card
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
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: M3Tokens.primaryContainer,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          (_activeActivity!['pulsemeter']?['type'] ?? 'POLL').toString().replaceAll('_', ' '),
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
                    _activeActivity!['pulsemeter']?['title'] ?? 'Live Question',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: M3Tokens.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Your instructor has launched a live PulseMeter activity for this classroom.',
                    style: TextStyle(fontSize: 13, color: M3Tokens.onSurfaceVariant),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton.icon(
                      onPressed: _joinLiveActivity,
                      icon: const Icon(Icons.play_arrow),
                      label: const Text(
                        'Join Live PulseMeter',
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
                    'No Active PulseMeter',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _message ?? 'When your instructor launches a Word Cloud, Poll, or Rating Scale, it will appear here in real time.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: M3Tokens.onSurfaceVariant, fontSize: 13),
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
