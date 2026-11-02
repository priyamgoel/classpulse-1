import 'package:flutter/material.dart';
import '../theme/tokens.dart';

/// Shown when a teacher signs in to the mobile app.
///
/// Teacher workflows live on the ClassPulse web dashboard, so the mobile
/// student experience must not be opened for teacher accounts.
class TeacherWebNoticeScreen extends StatelessWidget {
  final VoidCallback onLogout;

  const TeacherWebNoticeScreen({super.key, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: M3Tokens.surface,
      appBar: AppBar(
        title: const Text(
          'ClassPulse',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
              border: Border.all(color: M3Tokens.outlineVariant),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(
                  Icons.desktop_windows_outlined,
                  size: 56,
                  color: M3Tokens.primary,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Teacher Accounts Use the Web Dashboard',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: M3Tokens.onSurface,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'The ClassPulse mobile app is for students. Please sign in to '
                  'the ClassPulse web dashboard to manage classrooms, quizzes, '
                  'PulseMeters and attendance.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.4,
                    color: M3Tokens.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: onLogout,
                  icon: const Icon(Icons.logout, size: 18),
                  label: const Text(
                    'Sign Out',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
