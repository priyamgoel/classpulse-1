import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../services/auth_service.dart';
import '../theme/tokens.dart';

class AttendanceDashboardScreen extends StatefulWidget {
  const AttendanceDashboardScreen({super.key});

  @override
  State<AttendanceDashboardScreen> createState() => _AttendanceDashboardScreenState();
}

class _AttendanceDashboardScreenState extends State<AttendanceDashboardScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _overallStats;
  List<dynamic> _summaries = [];
  List<dynamic> _records = [];

  @override
  void initState() {
    super.initState();
    _fetchAttendanceData();
  }

  Future<void> _fetchAttendanceData() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final token = AuthService.token;
      final response = await http.get(
        Uri.parse('${AuthService.baseUrl}/attendance/me'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _overallStats = data['overall'];
          _summaries = data['summary'] ?? [];
          _records = data['records'] ?? [];
          _isLoading = false;
        });
      } else {
        setState(() {
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _openCourseDrilldown(Map<String, dynamic> summary) {
    final classroomId = summary['classroom_id'];
    final courseCode = summary['course_code'];
    final courseName = summary['course_name'];

    final courseRecords = _records.where((r) => r['classroom_id'] == classroomId).toList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: M3Tokens.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        expand: false,
        builder: (_, scrollController) => Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: M3Tokens.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '$courseCode — Session History',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: M3Tokens.onSurface),
              ),
              Text(
                courseName,
                style: const TextStyle(fontSize: 13, color: M3Tokens.onSurfaceVariant),
              ),
              const SizedBox(height: 16),
              const Divider(),
              if (courseRecords.isEmpty)
                const Expanded(
                  child: Center(
                    child: Text(
                      'No session logs found for this course.',
                      style: TextStyle(color: M3Tokens.onSurfaceVariant),
                    ),
                  ),
                )
              else
                Expanded(
                  child: ListView.separated(
                    controller: scrollController,
                    itemCount: courseRecords.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (_, idx) {
                      final rec = courseRecords[idx];
                      final dateStr = rec['session_started_at'] ?? rec['validated_at'];
                      final date = DateTime.tryParse(dateStr ?? '')?.toLocal();
                      final aclMs = rec['acl_ms'];

                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 0),
                        leading: CircleAvatar(
                          backgroundColor: Colors.green.shade50,
                          child: const Icon(Icons.check_circle, color: Colors.green, size: 22),
                        ),
                        title: Text(
                          date != null ? '${date.day}/${date.month}/${date.year} at ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}' : 'Session',
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                        ),
                        subtitle: Text(
                          'Teacher: ${rec['teacher_name'] ?? "Instructor"}',
                          style: const TextStyle(fontSize: 12, color: M3Tokens.onSurfaceVariant),
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text(
                              'PRESENT',
                              style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                            if (aclMs != null)
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.flash_on, size: 12, color: M3Tokens.secondary),
                                  Text('${aclMs}ms', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: M3Tokens.secondary)),
                                ],
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final overallPct = (_overallStats?['attendance_percentage'] as num?)?.toDouble() ?? 100.0;
    final attendedTotal = _overallStats?['attended_sessions'] ?? 0;
    final totalSessions = _overallStats?['total_sessions'] ?? 0;

    return Scaffold(
      backgroundColor: M3Tokens.surface,
      appBar: AppBar(
        title: const Text(
          'Attendance Analytics',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchAttendanceData,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchAttendanceData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 1. Overall Summary Metric Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: M3Tokens.primaryContainer,
                        borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'OVERALL ATTENDANCE RATE',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1,
                              color: M3Tokens.onPrimaryContainer,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '$overallPct%',
                                style: const TextStyle(
                                  fontSize: 36,
                                  fontWeight: FontWeight.w800,
                                  color: M3Tokens.onPrimaryContainer,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: M3Tokens.surface,
                                  borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
                                ),
                                child: Text(
                                  '$attendedTotal / $totalSessions Sessions',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                    color: M3Tokens.primary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: overallPct / 100.0,
                              minHeight: 8,
                              backgroundColor: M3Tokens.surface.withValues(alpha: 0.5),
                              color: overallPct >= 75 ? Colors.green : Colors.orange,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // 2. Per-Subject Breakdown
                    const Text(
                      'Enrolled Subjects Breakdown',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: M3Tokens.onSurface),
                    ),
                    const SizedBox(height: 12),

                    if (_summaries.isEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(32),
                        decoration: BoxDecoration(
                          color: M3Tokens.surfaceVariant,
                          borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                        ),
                        child: const Center(
                          child: Text(
                            'No enrolled courses found.\nJoin a section to see attendance analytics.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: M3Tokens.onSurfaceVariant),
                          ),
                        ),
                      )
                    else
                      ..._summaries.map((s) {
                        final pct = (s['attendance_percentage'] as num?)?.toDouble() ?? 100.0;
                        final attended = s['attended_sessions'] ?? 0;
                        final total = s['total_sessions'] ?? 0;

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                            side: const BorderSide(color: M3Tokens.outlineVariant),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                            onTap: () => _openCourseDrilldown(s),
                            child: Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              s['course_code'] ?? '',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 16,
                                                color: M3Tokens.primary,
                                              ),
                                            ),
                                            Text(
                                              s['course_name'] ?? '',
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w500,
                                                color: M3Tokens.onSurface,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: pct >= 75 ? Colors.green.shade50 : Colors.orange.shade50,
                                          borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
                                          border: Border.all(
                                            color: pct >= 75 ? Colors.green.shade200 : Colors.orange.shade200,
                                          ),
                                        ),
                                        child: Text(
                                          '$pct%',
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
                                            color: pct >= 75 ? Colors.green.shade800 : Colors.orange.shade800,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Section: ${s['section_name'] ?? ""} • Teacher: ${s['teacher_name'] ?? ""}',
                                        style: const TextStyle(fontSize: 11, color: M3Tokens.onSurfaceVariant),
                                      ),
                                      Text(
                                        '$attended / $total sessions',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: M3Tokens.onSurfaceVariant),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(3),
                                    child: LinearProgressIndicator(
                                      value: total > 0 ? (attended / total) : 1.0,
                                      minHeight: 5,
                                      backgroundColor: M3Tokens.surfaceVariant,
                                      color: pct >= 75 ? Colors.green : Colors.orange,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ),
    );
  }
}
