import 'package:flutter/material.dart';
import '../theme/tokens.dart';

class AppShell extends StatelessWidget {
  final Widget body;
  final String title;
  final int currentIndex;
  final ValueChanged<int> onTabSelected;

  const AppShell({
    super.key,
    required this.body,
    this.title = 'ClassPulse',
    this.currentIndex = 0,
    required this.onTabSelected,
  });

  static final List<Map<String, dynamic>> navItems = [
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

  void _handleTabSelected(BuildContext context, int index) {
    if (navItems[index]['disabled'] == true) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${navItems[index]['label']} is disabled (Coming Soon in Iteration 2)',
          ),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
          ),
        ),
      );
    } else {
      onTabSelected(index);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (idx) => _handleTabSelected(context, idx),
        destinations: navItems.map((item) {
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
