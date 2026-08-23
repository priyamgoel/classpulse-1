import 'package:flutter/material.dart';
import 'services/auth_service.dart';
import 'services/classroom_service.dart';
import 'screens/login_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/qr_scanner_screen.dart';
import 'screens/attendance_dashboard_screen.dart';
import 'theme/tokens.dart';
import 'widgets/app_shell.dart';
import 'widgets/classroom_card.dart';
import 'widgets/empty_state.dart';
import 'widgets/join_classroom_dialog.dart';

void main() {
  runApp(const ClassPulseApp());
}

class ClassPulseApp extends StatefulWidget {
  const ClassPulseApp({super.key});

  @override
  State<ClassPulseApp> createState() => _ClassPulseAppState();
}

class _ClassPulseAppState extends State<ClassPulseApp> {
  bool _isAuthenticated = false;
  bool _showSignup = false;

  void _onAuthenticated() {
    setState(() {
      _isAuthenticated = true;
    });
  }

  void _onLogout() {
    AuthService.logout();
    setState(() {
      _isAuthenticated = false;
      _showSignup = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ClassPulse Mobile',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.light,
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
      home: !_isAuthenticated
          ? (_showSignup
              ? SignupScreen(
                  onSignupSuccess: _onAuthenticated,
                  onNavigateToLogin: () {
                    setState(() {
                      _showSignup = false;
                    });
                  },
                )
              : LoginScreen(
                  onLoginSuccess: _onAuthenticated,
                  onNavigateToSignup: () {
                    setState(() {
                      _showSignup = true;
                    });
                  },
                ))
          : ClassPulseMainHost(onLogout: _onLogout),
    );
  }
}

class ClassPulseMainHost extends StatefulWidget {
  final VoidCallback onLogout;

  const ClassPulseMainHost({super.key, required this.onLogout});

  @override
  State<ClassPulseMainHost> createState() => _ClassPulseMainHostState();
}

class _ClassPulseMainHostState extends State<ClassPulseMainHost> {
  int _currentNavIndex = 0;

  @override
  Widget build(BuildContext context) {
    Widget currentBody;

    switch (_currentNavIndex) {
      case 1:
        currentBody = const AttendanceDashboardScreen();
        break;
      case 5:
        currentBody = ProfileView(onLogout: widget.onLogout);
        break;
      case 0:
      default:
        currentBody = ClassroomsHomeView(onLogout: widget.onLogout);
        break;
    }

    return AppShell(
      currentIndex: _currentNavIndex,
      onTabSelected: (index) {
        setState(() {
          _currentNavIndex = index;
        });
      },
      body: currentBody,
    );
  }
}

class ClassroomsHomeView extends StatefulWidget {
  final VoidCallback onLogout;

  const ClassroomsHomeView({super.key, required this.onLogout});

  @override
  State<ClassroomsHomeView> createState() => _ClassroomsHomeViewState();
}

class _ClassroomsHomeViewState extends State<ClassroomsHomeView> with SingleTickerProviderStateMixin {
  late TabController _detailTabController;
  List<Classroom> _classrooms = [];
  bool _isLoading = true;
  String? _selectedClassroomId;

  @override
  void initState() {
    super.initState();
    _detailTabController = TabController(length: 4, vsync: this);
    _loadClassrooms();
  }

  Future<void> _loadClassrooms() async {
    setState(() {
      _isLoading = true;
    });
    final list = await ClassroomService.fetchMyClassrooms();
    setState(() {
      _classrooms = list;
      if (list.isNotEmpty && _selectedClassroomId == null) {
        _selectedClassroomId = list.first.id;
      }
      _isLoading = false;
    });
  }

  void _openJoinDialog() {
    showDialog(
      context: context,
      builder: (ctx) => JoinClassroomDialog(
        onSuccess: _loadClassrooms,
      ),
    );
  }

  void _openScannerScreen() async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const QrScannerScreen()),
    );

    if (result == true) {
      _loadClassrooms();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.green,
            content: Text('Attendance recorded successfully! Marked PRESENT.'),
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _detailTabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Text('ClassPulse', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: M3Tokens.secondaryContainer,
                borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
              ),
              child: const Text(
                'Iteration 1',
                style: TextStyle(fontSize: 10, color: M3Tokens.onSecondaryContainer, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: M3Tokens.error),
            onPressed: widget.onLogout,
            tooltip: 'Sign Out',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadClassrooms,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Welcome, ${user?.fullName ?? "User"}!',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: M3Tokens.onSurface,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Role: ${user?.role.toUpperCase() ?? "STUDENT"}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: M3Tokens.secondary,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Student Fast Action: Scan Attendance QR
              if (user?.role == 'student') ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: M3Tokens.primaryContainer,
                    borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Live Class Session Active?',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                color: M3Tokens.onPrimaryContainer,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Aim camera at the rotating 3-QR stream on the projector.',
                              style: TextStyle(
                                fontSize: 12,
                                color: M3Tokens.onPrimaryContainer.withValues(alpha: 0.8),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      FilledButton.icon(
                        onPressed: _openScannerScreen,
                        icon: const Icon(Icons.qr_code_scanner, size: 18),
                        label: const Text('Scan QR'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Enrolled Classrooms',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  if (user?.role == 'student')
                    FilledButton.tonalIcon(
                      onPressed: _openJoinDialog,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Join Section'),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.all(32.0),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_classrooms.isEmpty)
                EmptyStateWidget(
                  title: 'No Classrooms Enrolled',
                  description: 'Ask your instructor for a 6-character join code to join a classroom section.',
                  actionLabel: user?.role == 'student' ? 'Join Classroom' : null,
                  onAction: user?.role == 'student' ? _openJoinDialog : null,
                )
              else
                ..._classrooms.map((c) {
                  final isStudent = user?.role == 'student';
                  final card = ClassroomCardWidget(
                    id: c.id,
                    courseCode: c.courseCode,
                    courseName: c.courseName,
                    sectionName: c.sectionName,
                    teacherName: c.teacherName,
                    studentCount: c.studentCount,
                    joinCode: c.joinCode,
                    selected: _selectedClassroomId == c.id,
                    onTap: () {
                      setState(() {
                        _selectedClassroomId = c.id;
                      });
                    },
                  );
                  if (!isStudent) return card;
                  return GestureDetector(
                    onLongPress: () {
                      showModalBottomSheet(
                        context: context,
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                        ),
                        builder: (ctx) => SafeArea(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const SizedBox(height: 8),
                              Container(
                                width: 40,
                                height: 4,
                                decoration: BoxDecoration(
                                  color: M3Tokens.outlineVariant,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                              const SizedBox(height: 12),
                              ListTile(
                                leading: const Icon(Icons.exit_to_app, color: Colors.red),
                                title: const Text('Unenroll from Section', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                                subtitle: Text('${c.courseCode}: ${c.sectionName}'),
                                onTap: () async {
                                  final messenger = ScaffoldMessenger.of(context);
                                  Navigator.pop(ctx);
                                  final confirm = await showDialog<bool>(
                                    context: context,
                                    builder: (dctx) => AlertDialog(
                                      title: const Text('Unenroll?', style: TextStyle(fontWeight: FontWeight.bold)),
                                      content: Text(
                                        'Are you sure you want to unenroll from ${c.courseCode}: ${c.courseName} (${c.sectionName})?\n\nYour past attendance records will be retained.',
                                      ),
                                      actions: [
                                        TextButton(
                                          onPressed: () => Navigator.pop(dctx, false),
                                          child: const Text('Cancel'),
                                        ),
                                        FilledButton(
                                          style: FilledButton.styleFrom(backgroundColor: Colors.red),
                                          onPressed: () => Navigator.pop(dctx, true),
                                          child: const Text('Unenroll'),
                                        ),
                                      ],
                                    ),
                                  );
                                  if (confirm == true && mounted) {
                                    final result = await ClassroomService.unenrollFromClassroom(c.id);
                                    messenger.showSnackBar(
                                      SnackBar(
                                        backgroundColor: result['success'] ? Colors.green : Colors.red,
                                        content: Text(result['success'] ? result['message'] : result['error']),
                                      ),
                                    );
                                    if (result['success'] && mounted) _loadClassrooms();
                                  }
                                },
                              ),
                              const SizedBox(height: 8),
                            ],
                          ),
                        ),
                      );
                    },
                    child: card,
                  );
                }),
              const SizedBox(height: 8),
              if (user?.role == 'student')
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 13, color: Colors.grey),
                      const SizedBox(width: 4),
                      Text('Long-press a card to unenroll', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                    ],
                  ),
                ),

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
                    EmptyStateWidget(
                      title: 'Live Attendance Scanner',
                      description: 'Tap below to launch the multi-frame 3-QR camera scanner.',
                      actionLabel: user?.role == 'student' ? 'Scan Attendance QR' : null,
                      onAction: user?.role == 'student' ? _openScannerScreen : null,
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

class ProfileView extends StatelessWidget {
  final VoidCallback onLogout;

  const ProfileView({super.key, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    final user = AuthService.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('User Profile', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            Center(
              child: CircleAvatar(
                radius: 40,
                backgroundColor: M3Tokens.primary,
                child: Text(
                  user?.fullName.isNotEmpty == true ? user!.fullName[0].toUpperCase() : 'U',
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              user?.fullName ?? 'User Name',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: M3Tokens.onSurface),
            ),
            Text(
              user?.email ?? '',
              style: const TextStyle(fontSize: 14, color: M3Tokens.onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: M3Tokens.secondaryContainer,
                borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
              ),
              child: Text(
                'ROLE: ${user?.role.toUpperCase() ?? "STUDENT"}',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: M3Tokens.onSecondaryContainer),
              ),
            ),
            const SizedBox(height: 32),
            const Divider(),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.info_outline, color: M3Tokens.primary),
              title: const Text('ClassPulse Version', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Iteration 1 (Pilot Release 0.1.0)'),
            ),
            ListTile(
              leading: const Icon(Icons.shield_outlined, color: M3Tokens.primary),
              title: const Text('Appearance Mode', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Strict Light Mode Only'),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: FilledButton.tonalIcon(
                onPressed: onLogout,
                icon: const Icon(Icons.logout, color: M3Tokens.error),
                label: const Text('Sign Out', style: TextStyle(color: M3Tokens.error, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
