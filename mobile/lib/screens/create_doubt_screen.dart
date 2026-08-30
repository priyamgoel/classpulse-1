import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../services/auth_service.dart';
import '../theme/tokens.dart';

class CreateDoubtScreen extends StatefulWidget {
  final String courseId;
  final String? classroomId;

  const CreateDoubtScreen({
    super.key,
    required this.courseId,
    this.classroomId,
  });

  @override
  State<CreateDoubtScreen> createState() => _CreateDoubtScreenState();
}

class _CreateDoubtScreenState extends State<CreateDoubtScreen> {
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  final _newTopicController = TextEditingController();

  String _audienceScope = 'CLASSROOM';
  String? _selectedTopicId;
  bool _isAnonymous = false;
  List<dynamic> _topics = [];
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchTopics();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    _newTopicController.dispose();
    super.dispose();
  }

  Future<void> _fetchTopics() async {
    try {
      final token = AuthService.token;
      final res = await http.get(
        Uri.parse('${AuthService.baseUrl}/courses/${widget.courseId}/topics'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _topics = data['topics'] ?? [];
        });
      }
    } catch (_) {}
  }

  Future<void> _submitDoubt() async {
    final title = _titleController.text.trim();
    final body = _bodyController.text.trim();

    if (title.isEmpty || body.isEmpty) {
      setState(() => _errorMessage = 'Please enter a title and description.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final token = AuthService.token;

      // Create new topic if specified
      String? resolvedTopicId = _selectedTopicId;
      if (resolvedTopicId == null && _newTopicController.text.trim().isNotEmpty) {
        final topicRes = await http.post(
          Uri.parse('${AuthService.baseUrl}/courses/${widget.courseId}/topics'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({'name': _newTopicController.text.trim()}),
        );
        if (topicRes.statusCode == 201) {
          final tData = jsonDecode(topicRes.body);
          resolvedTopicId = tData['topic']?['id'];
        }
      }

      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/doubts'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'course_id': widget.courseId,
          'classroom_id': _audienceScope == 'CLASSROOM' ? widget.classroomId : null,
          'topic_id': resolvedTopicId,
          'audience_scope': _audienceScope,
          'title': title,
          'body': body,
          'is_anonymous': _isAnonymous,
        }),
      );

      final data = jsonDecode(res.body);

      if (res.statusCode == 201) {
        if (mounted) {
          Navigator.of(context).pop(true);
        }
      } else {
        setState(() {
          _errorMessage = data['error'] ?? 'Failed to post doubt.';
          _isSubmitting = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network error posting doubt.';
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: M3Tokens.surface,
      appBar: AppBar(
        title: const Text('Ask a Doubt', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12.0),
            child: FilledButton(
              onPressed: _isSubmitting ? null : _submitDoubt,
              child: _isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Post'),
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
              if (_errorMessage != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                ),

              // Title input
              TextField(
                controller: _titleController,
                decoration: InputDecoration(
                  labelText: 'Question Title',
                  hintText: 'e.g. Why do we need virtual destructors in C++?',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(M3Tokens.shapeMedium)),
                ),
              ),
              const SizedBox(height: 16),

              // Audience Scope Segmented Selector
              Text('Audience Scope', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: M3Tokens.onSurfaceVariant)),
              const SizedBox(height: 6),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'CLASSROOM', label: Text('Section'), icon: Icon(Icons.meeting_room_outlined, size: 16)),
                  ButtonSegment(value: 'COURSE', label: Text('Course'), icon: Icon(Icons.school_outlined, size: 16)),
                  ButtonSegment(value: 'APP', label: Text('Global'), icon: Icon(Icons.public_outlined, size: 16)),
                ],
                selected: {_audienceScope},
                onSelectionChanged: (val) {
                  setState(() => _audienceScope = val.first);
                },
              ),
              const SizedBox(height: 16),

              // Topic Dropdown
              DropdownButtonFormField<String>(
                value: _selectedTopicId,
                decoration: InputDecoration(
                  labelText: 'Course Topic (Optional)',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(M3Tokens.shapeMedium)),
                ),
                items: [
                  const DropdownMenuItem(value: null, child: Text('No specific topic')),
                  ..._topics.map((t) => DropdownMenuItem(value: t['id'].toString(), child: Text(t['name'].toString()))),
                ],
                onChanged: (val) => setState(() => _selectedTopicId = val),
              ),
              const SizedBox(height: 16),

              // Body multiline input
              TextField(
                controller: _bodyController,
                maxLines: 6,
                decoration: InputDecoration(
                  labelText: 'Description & Code Snippet',
                  hintText: 'Provide details on what you have tried or concept confusion...',
                  alignLabelWithHint: true,
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(M3Tokens.shapeMedium)),
                ),
              ),
              const SizedBox(height: 16),

              // Anonymous Pseudonym Switch Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                  border: Border.all(color: M3Tokens.outlineVariant),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.masks_outlined, color: M3Tokens.primary, size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text('Post with Pseudonym', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                          SizedBox(height: 2),
                          Text(
                            'Masks your real name with a consistent per-course pseudonym (e.g. QuantumFalcon24).',
                            style: TextStyle(fontSize: 11, color: M3Tokens.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: _isAnonymous,
                      onChanged: (val) => setState(() => _isAnonymous = val),
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
