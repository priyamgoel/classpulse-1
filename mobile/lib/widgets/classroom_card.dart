import 'package:flutter/material.dart';
import '../theme/tokens.dart';

class ClassroomCardWidget extends StatelessWidget {
  final String id;
  final String courseCode;
  final String courseName;
  final String sectionName;
  final String teacherName;
  final int studentCount;
  final String? joinCode;
  final bool selected;
  final double attendanceAvgRate;
  final int quizCount;
  final int pulsemeterCount;
  final int openDoubtsCount;
  final VoidCallback? onTap;

  const ClassroomCardWidget({
    super.key,
    required this.id,
    required this.courseCode,
    required this.courseName,
    required this.sectionName,
    required this.teacherName,
    this.studentCount = 0,
    this.joinCode,
    this.selected = false,
    this.attendanceAvgRate = 100.0,
    this.quizCount = 0,
    this.pulsemeterCount = 0,
    this.openDoubtsCount = 0,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isHealthyAttendance = attendanceAvgRate >= 75.0;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      margin: const EdgeInsets.only(bottom: 12.0),
      decoration: BoxDecoration(
        color: M3Tokens.surface,
        borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
        border: Border.all(
          color: selected ? M3Tokens.primary : M3Tokens.outlineVariant,
          width: selected ? 2.0 : 1.0,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
        child: InkWell(
          borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: M3Tokens.primaryContainer,
                        borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
                      ),
                      child: Text(
                        courseCode,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: M3Tokens.onPrimaryContainer,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const Icon(Icons.school, color: M3Tokens.primary),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  courseName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: M3Tokens.onSurface,
                      ),
                ),
                Text(
                  sectionName,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: M3Tokens.secondary,
                      ),
                ),

                // Micro-Metrics Strip (Iteration 2 — Part 8)
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isHealthyAttendance ? Colors.green.shade50 : Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: isHealthyAttendance ? Colors.green.shade200 : Colors.orange.shade200,
                        ),
                      ),
                      child: Text(
                        '${attendanceAvgRate.toStringAsFixed(1)}% Turnout',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isHealthyAttendance ? Colors.green.shade800 : Colors.orange.shade900,
                        ),
                      ),
                    ),
                    if (quizCount > 0 || pulsemeterCount > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: M3Tokens.surfaceVariant,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '$quizCount Quizzes • $pulsemeterCount PM',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: M3Tokens.onSurfaceVariant,
                          ),
                        ),
                      ),
                    if (openDoubtsCount > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.purple.shade50,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '$openDoubtsCount Open Doubts',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.purple.shade700,
                          ),
                        ),
                      ),
                  ],
                ),

                const Divider(height: 20, color: M3Tokens.outlineVariant),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Instructor: $teacherName',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: M3Tokens.onSurfaceVariant,
                          ),
                    ),
                    Row(
                      children: [
                        if (joinCode != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              border: Border.all(color: M3Tokens.outline),
                              borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
                            ),
                            child: Text(
                              'Code: $joinCode',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        const Icon(Icons.people_outline, size: 16, color: M3Tokens.secondary),
                        const SizedBox(width: 4),
                        Text(
                          '$studentCount',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ],
                    )
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
