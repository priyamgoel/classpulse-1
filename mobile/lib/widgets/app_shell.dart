import 'package:flutter/material.dart';
import '../theme/tokens.dart';

class AppShell extends StatefulWidget {
  final Widget body;
  final String title;

  const AppShell({
    super.key,
    required this.body,
    this.title = 'ClassPulse',
  });

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _currentIndex = 0;
  bool _isTeacherRole = true;

  final List<Map<String, dynamic>> _navItems = [
    {
      'label': 'Classrooms',
      'icon': Icons.class_outlined,
      'selectedIcon': Icons.class_,
      'disabled': false,
    },
    {
      'label': 'Attendance',
      'icon': Icons.event_available_outlined,
      'selectedIcon': Icons.event_available,
      'disabled': false,
    },
    {
      'label': 'PulseMeter',
      'icon': Icons.speed_outlined,
      'selectedIcon': Icons.speed,
      'disabled': true,
    },
    {
      'label': 'Quizzes',
      'icon': Icons.quiz_outlined,
      'selectedIcon': Icons.quiz,
      'disabled': true,
    },
    {
      'label': 'Forum',
      'icon': Icons.forum_outlined,
      'selectedIcon': Icons.forum,
      'disabled': true,
    },
    {
      'label': 'Profile',
      'icon': Icons.person_outline,
      'selectedIcon': Icons.person,
      'disabled': false,
    },
  ];

  void _onTabSelected(int index) {
    if (_navItems[index]['disabled'] == true) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${_navItems[index]['label']} is disabled (Coming Soon in Iteration 2)',
          ),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
          ),
        ),
      );
    } else {
      setState(() {
        _currentIndex = index;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Text(
              widget.title,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: M3Tokens.secondaryContainer,
                borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
              ),
              child: const Text(
                'Iteration 1',
                style: TextStyle(fontSize: 10, color: M3Tokens.onSecondaryContainer),
              ),
            )
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12.0),
            child: ActionChip(
              avatar: const Icon(Icons.swap_horiz, size: 16),
              label: Text(_isTeacherRole ? 'Role: Teacher' : 'Role: Student'),
              onPressed: () {
                setState(() {
                  _isTeacherRole = !_isTeacherRole;
                });
              },
            ),
          )
        ],
      ),
      body: widget.body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _onTabSelected,
        destinations: _navItems.map((item) {
          final bool isDisabled = item['disabled'] == true;
          return NavigationDestination(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                Opacity(
                  opacity: isDisabled ? 0.4 : 1.0,
                  child: Icon(item['icon'] as IconData),
                ),
                if (isDisabled)
                  Positioned(
                    top: -4,
                    right: -10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                      decoration: BoxDecoration(
                        color: M3Tokens.surfaceVariant,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Soon',
                        style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: M3Tokens.onSurfaceVariant),
                      ),
                    ),
                  )
              ],
            ),
            selectedIcon: Icon(item['selectedIcon'] as IconData),
            label: item['label'] as String,
          );
        }).toList(),
      ),
    );
  }
}
