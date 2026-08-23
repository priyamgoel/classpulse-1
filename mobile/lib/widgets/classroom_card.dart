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
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
        side: const BorderSide(color: M3Tokens.outlineVariant),
      ),
      color: M3Tokens.surface,
      margin: const EdgeInsets.only(bottom: 12.0),
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
              const Divider(height: 24, color: M3Tokens.outlineVariant),
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
    );
  }
}
