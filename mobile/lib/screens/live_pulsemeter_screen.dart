import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../services/auth_service.dart';
import '../theme/tokens.dart';

class LivePulseMeterScreen extends StatefulWidget {
  final String activityId;
  final String classroomId;
  final String title;
  final String type; // 'WORD_CLOUD', 'MCQ', 'RATING_SCALE'
  final Map<String, dynamic> config;

  const LivePulseMeterScreen({
    super.key,
    required this.activityId,
    required this.classroomId,
    required this.title,
    required this.type,
    required this.config,
  });

  @override
  State<LivePulseMeterScreen> createState() => _LivePulseMeterScreenState();
}

class _LivePulseMeterScreenState extends State<LivePulseMeterScreen> {
  final TextEditingController _wordController = TextEditingController();
  String? _selectedOptionId;
  int? _selectedRating;
  bool _isSubmitting = false;
  bool _hasSubmitted = false;
  String? _errorMessage;

  @override
  void dispose() {
    _wordController.dispose();
    super.dispose();
  }

  Future<void> _submitResponse() async {
    dynamic responseValue;

    if (widget.type == 'WORD_CLOUD') {
      final text = _wordController.text.trim();
      if (text.isEmpty) {
        setState(() {
          _errorMessage = 'Please enter a word or short phrase.';
        });
        return;
      }
      responseValue = text;
    } else if (widget.type == 'MCQ') {
      if (_selectedOptionId == null) {
        setState(() {
          _errorMessage = 'Please select an option.';
        });
        return;
      }
      responseValue = _selectedOptionId;
    } else if (widget.type == 'RATING_SCALE') {
      if (_selectedRating == null) {
        setState(() {
          _errorMessage = 'Please select a rating.';
        });
        return;
      }
      responseValue = _selectedRating;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final token = AuthService.token;
      final response = await http.post(
        Uri.parse('${AuthService.baseUrl}/live-activities/${widget.activityId}/respond'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'response_value': responseValue,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        setState(() {
          _hasSubmitted = true;
          _isSubmitting = false;
        });
      } else {
        setState(() {
          _errorMessage = data['error'] ?? 'Failed to submit response.';
          _isSubmitting = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network error submitting response. Please try again.';
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: M3Tokens.surface,
      appBar: AppBar(
        title: const Text(
          'Live PulseMeter',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
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
                  'LIVE',
                  style: TextStyle(
                    color: Colors.red,
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
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
              // Activity Title Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
                  border: Border.all(color: M3Tokens.outlineVariant),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: M3Tokens.primaryContainer,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        widget.type.replaceAll('_', ' '),
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: M3Tokens.onPrimaryContainer,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      widget.title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: M3Tokens.onSurface,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

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

              if (_hasSubmitted) ...[
                // Success / Confirmation State
                Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
                    border: Border.all(color: Colors.green.shade200),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.check_circle, color: Colors.green, size: 56),
                      const SizedBox(height: 16),
                      const Text(
                        'Response Recorded!',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.green,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Your feedback has been submitted to the instructor.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: M3Tokens.onSurfaceVariant),
                      ),
                      const SizedBox(height: 24),
                      OutlinedButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('Return to Classroom'),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                // Dynamic Input based on Activity Type
                if (widget.type == 'WORD_CLOUD') _buildWordCloudInput(),
                if (widget.type == 'MCQ') _buildMcqInput(),
                if (widget.type == 'RATING_SCALE') _buildRatingScaleInput(),

                const SizedBox(height: 28),

                // Submit Button
                SizedBox(
                  height: 50,
                  child: FilledButton(
                    onPressed: _isSubmitting ? null : _submitResponse,
                    style: FilledButton.styleFrom(
                      backgroundColor: M3Tokens.primary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                      ),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Submit Response',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWordCloudInput() {
    final prompt = widget.config['prompt'] ?? widget.title;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          prompt,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: M3Tokens.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _wordController,
          maxLength: 35,
          decoration: InputDecoration(
            hintText: 'Enter a single word or short phrase',
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
              borderSide: const BorderSide(color: M3Tokens.outlineVariant),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
              borderSide: const BorderSide(color: M3Tokens.primary, width: 2),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMcqInput() {
    final options = (widget.config['options'] as List?) ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select one option:',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: M3Tokens.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 12),
        ...options.map((opt) {
          final optId = opt['id'] ?? '';
          final optText = opt['text'] ?? '';
          final isSelected = _selectedOptionId == optId;

          return Padding(
            padding: const EdgeInsets.only(bottom: 10.0),
            child: InkWell(
              onTap: () {
                setState(() {
                  _selectedOptionId = optId;
                });
              },
              borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isSelected ? M3Tokens.primaryContainer : Colors.white,
                  borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                  border: Border.all(
                    color: isSelected ? M3Tokens.primary : M3Tokens.outlineVariant,
                    width: isSelected ? 2 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: isSelected ? M3Tokens.primary : Colors.grey.shade100,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        optId.toString().toUpperCase(),
                        style: TextStyle(
                          color: isSelected ? Colors.white : M3Tokens.onSurface,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        optText,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          color: M3Tokens.onSurface,
                        ),
                      ),
                    ),
                    if (isSelected)
                      const Icon(Icons.check_circle, color: M3Tokens.primary, size: 20),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildRatingScaleInput() {
    final min = (widget.config['min'] as int?) ?? 1;
    final max = (widget.config['max'] as int?) ?? 5;
    final lowLabel = widget.config['low_label'] ?? 'Lowest';
    final highLabel = widget.config['high_label'] ?? 'Highest';

    final items = List.generate(max - min + 1, (i) => min + i);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select your rating score:',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: M3Tokens.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: items.map((val) {
            final isSelected = _selectedRating == val;
            return InkWell(
              onTap: () {
                setState(() {
                  _selectedRating = val;
                });
              },
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: isSelected ? M3Tokens.primary : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSelected ? M3Tokens.primary : M3Tokens.outlineVariant,
                    width: isSelected ? 2 : 1,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  '$val',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? Colors.white : M3Tokens.onSurface,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '$min: $lowLabel',
              style: const TextStyle(fontSize: 12, color: M3Tokens.onSurfaceVariant),
            ),
            Text(
              '$max: $highLabel',
              style: const TextStyle(fontSize: 12, color: M3Tokens.onSurfaceVariant),
            ),
          ],
        ),
      ],
    );
  }
}
