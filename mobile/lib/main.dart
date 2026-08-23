import 'package:flutter/material.dart';
import 'theme/tokens.dart';
import 'widgets/app_shell.dart';
import 'widgets/classroom_card.dart';
import 'widgets/empty_state.dart';

void main() {
  runApp(const ClassPulseApp());
}

class ClassPulseApp extends StatelessWidget {
  const ClassPulseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ClassPulse Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: M3Tokens.seedColor,
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: M3Tokens.surface,
        appBarTheme: const AppBarTheme(
          backgroundColor: M3Tokens.surface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
      ),
      home: const ClassPulseHomePage(),
    );
  }
}

class ClassPulseHomePage extends StatefulWidget {
  const ClassPulseHomePage({super.key});

  @override
  State<ClassPulseHomePage> createState() => _ClassPulseHomePageState();
}

class _ClassPulseHomePageState extends State<ClassPulseHomePage> with SingleTickerProviderStateMixin {
  late TabController _detailTabController;

  final List<Map<String, dynamic>> _sampleClassrooms = [
    {
      'id': 'c1',
      'courseCode': 'UCS503P',
      'courseName': 'Software Engineering Lab',
      'sectionName': 'Section 3CSE1',
      'teacherName': 'Dr. A. Sharma',
      'studentCount': 38,
      'joinCode': 'SE503A',
    },
    {
      'id': 'c2',
      'courseCode': 'UCS405',
      'courseName': 'Discrete Mathematical Structures',
      'sectionName': 'Section 3CSE2',
      'teacherName': 'Prof. R. Kumar',
      'studentCount': 45,
      'joinCode': 'DMS405',
    },
  ];

  @override
  void initState() {
    super.initState();
    // 4 Tabs reserved per Spec Section 7 (Overview active, 3 disabled hooks)
    _detailTabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _detailTabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppShell(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'My Classrooms',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: M3Tokens.onSurface,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              'Anti-Proxy Attendance Scanner Shell',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: M3Tokens.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 16),
            ..._sampleClassrooms.map((c) => ClassroomCardWidget(
                  id: c['id'],
                  courseCode: c['courseCode'],
                  courseName: c['courseName'],
                  sectionName: c['sectionName'],
                  teacherName: c['teacherName'],
                  studentCount: c['studentCount'],
                  joinCode: c['joinCode'],
                  onTap: () {},
                )),
            const SizedBox(height: 16),

            // Classroom Detail Hook (Spec Section 7)
            Container(
              decoration: BoxDecoration(
                color: M3Tokens.surface,
                borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
                border: Border.all(color: M3Tokens.outlineVariant),
              ),
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'RESERVED TAB STRIP HOOK (SPEC SECTION 7)',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: M3Tokens.secondary),
                  ),
                  const SizedBox(height: 8),
                  TabBar(
                    controller: _detailTabController,
                    isScrollable: true,
                    labelColor: M3Tokens.primary,
                    unselectedLabelColor: M3Tokens.onSurfaceVariant,
                    indicatorColor: M3Tokens.primary,
                    tabs: const [
                      Tab(text: 'Overview'),
                      Tab(text: 'PulseMeter*'),
                      Tab(text: 'Quizzes*'),
                      Tab(text: 'Forum*'),
                    ],
                    onTap: (index) {
                      if (index != 0) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Tab coming soon in Iteration 2'),
                            duration: Duration(seconds: 1),
                          ),
                        );
                      }
                    },
                  ),
                  const SizedBox(height: 16),
                  const EmptyStateWidget(
                    title: 'No Active Scanner Session',
                    description: 'ML Kit 3-QR scanner will be activated here in Part 5.',
                    actionLabel: 'Scan QR (Part 5)',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
