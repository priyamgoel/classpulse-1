import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:fl_chart/fl_chart.dart';
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

  // Safe parsing helper methods to prevent String vs num type cast errors
  double _parseDouble(dynamic val, [double defaultVal = 0.0]) {
    if (val == null) return defaultVal;
    if (val is num) return val.toDouble();
    if (val is String) return double.tryParse(val) ?? defaultVal;
    return defaultVal;
  }

  int _parseInt(dynamic val, [int defaultVal = 0]) {
    if (val == null) return defaultVal;
    if (val is num) return val.toInt();
    if (val is String) return int.tryParse(val) ?? defaultVal;
    return defaultVal;
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
    final courseCode = summary['course_code'] ?? '';
    final courseName = summary['course_name'] ?? '';

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
                      final aclMs = _parseInt(rec['acl_ms'], -1);

                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 0),
                        leading: CircleAvatar(
                          backgroundColor: Colors.green.shade50,
                          child: const Icon(Icons.check_circle, color: Colors.green, size: 22),
                        ),
                        title: Text(
                          date != null
                              ? '${date.day}/${date.month}/${date.year} at ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}'
                              : 'Session',
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
                            if (aclMs >= 0)
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.flash_on, size: 12, color: M3Tokens.secondary),
                                  Text('${aclMs}ms',
                                      style: const TextStyle(
                                          fontSize: 10, fontWeight: FontWeight.bold, color: M3Tokens.secondary)),
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

  Widget _buildAttendanceBarChart() {
    if (_summaries.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
        border: Border.all(color: M3Tokens.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.bar_chart_rounded, color: ChartTokens.primary, size: 22),
                  SizedBox(width: 8),
                  Text(
                    'Subject Attendance Rates (%)',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: M3Tokens.onSurface,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: ChartTokens.primaryContainer,
                  borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
                ),
                child: const Text(
                  '75% Min',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: ChartTokens.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Visual turnout across enrolled courses with eligibility threshold',
            style: TextStyle(fontSize: 11, color: M3Tokens.onSurfaceVariant),
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 210,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceAround,
                maxY: 100,
                minY: 0,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: 25,
                  getDrawingHorizontalLine: (value) => FlLine(
                    color: ChartTokens.grid,
                    strokeWidth: 1,
                    dashArray: [4, 4],
                  ),
                ),
                extraLinesData: ExtraLinesData(
                  horizontalLines: [
                    HorizontalLine(
                      y: 75,
                      color: ChartTokens.error,
                      strokeWidth: 1.5,
                      dashArray: [6, 4],
                      label: HorizontalLineLabel(
                        show: true,
                        alignment: Alignment.topRight,
                        padding: const EdgeInsets.only(right: 4, bottom: 2),
                        style: const TextStyle(
                          color: ChartTokens.error,
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                        ),
                        labelResolver: (line) => '75% Threshold',
                      ),
                    ),
                  ],
                ),
                titlesData: FlTitlesData(
                  show: true,
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 36,
                      interval: 25,
                      getTitlesWidget: (val, meta) {
                        return Text(
                          '${val.toInt()}%',
                          style: const TextStyle(
                            color: ChartTokens.axis,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        );
                      },
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 32,
                      getTitlesWidget: (val, meta) {
                        final idx = val.toInt();
                        if (idx < 0 || idx >= _summaries.length) return const SizedBox.shrink();
                        final summary = _summaries[idx];
                        final code = (summary['course_code'] ?? 'Course').toString();
                        return Padding(
                          padding: const EdgeInsets.only(top: 8.0),
                          child: Text(
                            code.length > 7 ? '${code.substring(0, 6)}…' : code,
                            style: const TextStyle(
                              color: ChartTokens.axis,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(
                  show: true,
                  border: Border(
                    bottom: BorderSide(color: M3Tokens.outlineVariant),
                    left: BorderSide(color: M3Tokens.outlineVariant),
                  ),
                ),
                barTouchData: BarTouchData(
                  enabled: true,
                  touchTooltipData: BarTouchTooltipData(
                    getTooltipColor: (_) => ChartTokens.tooltipBg,
                    tooltipRoundedRadius: 8,
                    tooltipBorder: BorderSide(color: ChartTokens.tooltipBorder),
                    getTooltipItem: (group, groupIndex, rod, rodIndex) {
                      final summary = _summaries[groupIndex];
                      final code = summary['course_code'] ?? '';
                      final attended = _parseInt(summary['attended_sessions'], 0);
                      final total = _parseInt(summary['total_sessions'], 0);
                      return BarTooltipItem(
                        '$code\n',
                        const TextStyle(
                          color: M3Tokens.onSurface,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                        children: [
                          TextSpan(
                            text: '${rod.toY.toStringAsFixed(1)}% ($attended/$total)\n',
                            style: TextStyle(
                              color: rod.toY >= 75 ? ChartTokens.success : ChartTokens.error,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                          TextSpan(
                            text: rod.toY >= 75 ? 'Eligible' : 'Shortage Warning',
                            style: TextStyle(
                              color: rod.toY >= 75 ? ChartTokens.success : ChartTokens.error,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
                barGroups: List.generate(_summaries.length, (idx) {
                  final s = _summaries[idx];
                  final pct = _parseDouble(s['attendance_percentage'], 100.0);
                  final isEligible = pct >= 75.0;

                  return BarChartGroupData(
                    x: idx,
                    barRods: [
                      BarChartRodData(
                        toY: pct.clamp(0.0, 100.0),
                        color: isEligible ? ChartTokens.primary : ChartTokens.error,
                        width: 22,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                        backDrawRodData: BackgroundBarChartRodData(
                          show: true,
                          toY: 100,
                          color: ChartTokens.barBackground,
                        ),
                      ),
                    ],
                  );
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final overallPct = _parseDouble(_overallStats?['attendance_percentage'], 100.0);
    final attendedTotal = _parseInt(_overallStats?['attended_sessions'], 0);
    final totalSessions = _parseInt(_overallStats?['total_sessions'], 0);

    final lowAttendanceCourses = _summaries.where((s) {
      final pct = _parseDouble(s['attendance_percentage'], 100.0);
      final total = _parseInt(s['total_sessions'], 0);
      return total > 0 && pct < 75.0;
    }).toList();

    final hasShortage = (totalSessions > 0 && overallPct < 75.0) || lowAttendanceCourses.isNotEmpty;

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
                    // Low Attendance Warning Banner
                    if (hasShortage) ...[
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF3E0),
                          borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                          border: Border.all(color: const Color(0xFFFFB74D)),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.warning_amber_rounded, color: Color(0xFFE65100), size: 24),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Attendance Shortage Warning',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: Color(0xFFE65100),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    lowAttendanceCourses.isNotEmpty
                                        ? 'You have attendance below 75% in ${lowAttendanceCourses.map((c) => c['course_code']).join(', ')}. Please attend upcoming lectures to avoid exam debarment.'
                                        : 'Your cumulative attendance is currently below the mandatory 75% threshold.',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF5D4037)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

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
                                style: TextStyle(
                                  fontSize: 36,
                                  fontWeight: FontWeight.w800,
                                  color: overallPct < 75 ? Colors.red.shade900 : M3Tokens.onPrimaryContainer,
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
                              value: (overallPct / 100.0).clamp(0.0, 1.0),
                              minHeight: 8,
                              backgroundColor: M3Tokens.surface.withValues(alpha: 0.5),
                              color: overallPct >= 75 ? Colors.green : Colors.red,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // 2. Visual Analytics: fl_chart Subject Attendance Bar Chart
                    _buildAttendanceBarChart(),

                    // 3. Per-Subject Breakdown
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
                        final pct = _parseDouble(s['attendance_percentage'], 100.0);
                        final attended = _parseInt(s['attended_sessions'], 0);
                        final total = _parseInt(s['total_sessions'], 0);
                        final isCourseShortage = total > 0 && pct < 75.0;

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
                            side: BorderSide(
                              color: isCourseShortage ? Colors.red.shade200 : M3Tokens.outlineVariant,
                              width: isCourseShortage ? 1.5 : 1.0,
                            ),
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
                                          color: pct >= 75 ? Colors.green.shade50 : Colors.red.shade50,
                                          borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
                                          border: Border.all(
                                            color: pct >= 75 ? Colors.green.shade200 : Colors.red.shade300,
                                          ),
                                        ),
                                        child: Text(
                                          '$pct%',
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
                                            color: pct >= 75 ? Colors.green.shade800 : Colors.red.shade900,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          'Section: ${s['section_name'] ?? ""} • Teacher: ${s['teacher_name'] ?? ""}',
                                          style: const TextStyle(fontSize: 11, color: M3Tokens.onSurfaceVariant),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        '$attended / $total sessions',
                                        style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: M3Tokens.onSurfaceVariant),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(3),
                                    child: LinearProgressIndicator(
                                      value: total > 0 ? (attended / total).clamp(0.0, 1.0) : 1.0,
                                      minHeight: 5,
                                      backgroundColor: M3Tokens.surfaceVariant,
                                      color: pct >= 75 ? Colors.green : Colors.red,
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
