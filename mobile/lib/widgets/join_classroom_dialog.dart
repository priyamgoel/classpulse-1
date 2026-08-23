import 'package:flutter/material.dart';
import '../services/classroom_service.dart';
import '../theme/tokens.dart';

class JoinClassroomDialog extends StatefulWidget {
  final VoidCallback onSuccess;

  const JoinClassroomDialog({super.key, required this.onSuccess});

  @override
  State<JoinClassroomDialog> createState() => _JoinClassroomDialogState();
}

class _JoinClassroomDialogState extends State<JoinClassroomDialog> {
  final _codeController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  Future<void> _handleJoin() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) {
      setState(() {
        _errorMessage = 'Please enter a 6-character join code';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final result = await ClassroomService.joinClassroom(code);

    setState(() {
      _isSubmitting = false;
    });

    if (result['success'] == true) {
      widget.onSuccess();
      if (mounted) Navigator.of(context).pop();
    } else {
      setState(() {
        _errorMessage = result['error'] ?? 'Failed to join classroom';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Join Classroom Section', style: TextStyle(fontWeight: FontWeight.bold)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Ask your instructor for the 6-character classroom code and enter it below:',
            style: TextStyle(fontSize: 13, color: M3Tokens.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: M3Tokens.secondaryContainer,
                borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
              ),
              child: Text(
                _errorMessage!,
                style: const TextStyle(color: M3Tokens.onSecondaryContainer, fontSize: 12),
              ),
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _codeController,
            textCapitalization: TextCapitalization.characters,
            maxLength: 6,
            style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 4, fontSize: 18),
            textAlign: TextAlign.center,
            decoration: const InputDecoration(
              hintText: 'SE503A',
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _isSubmitting ? null : _handleJoin,
          child: _isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text('Join Section'),
        ),
      ],
    );
  }
}
