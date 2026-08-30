import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'auth_service.dart';

class Classroom {
  final String id;
  final String courseId;
  final String courseCode;
  final String courseName;
  final String sectionName;
  final String teacherName;
  final String joinCode;
  final int studentCount;
  final double attendanceAvgRate;
  final int quizCount;
  final int pulsemeterCount;
  final int openDoubtsCount;

  Classroom({
    required this.id,
    required this.courseId,
    required this.courseCode,
    required this.courseName,
    required this.sectionName,
    required this.teacherName,
    required this.joinCode,
    required this.studentCount,
    this.attendanceAvgRate = 100.0,
    this.quizCount = 0,
    this.pulsemeterCount = 0,
    this.openDoubtsCount = 0,
  });

  factory Classroom.fromJson(Map<String, dynamic> json) {
    return Classroom(
      id: json['id'] ?? '',
      courseId: json['course_id'] ?? '',
      courseCode: json['course_code'] ?? '',
      courseName: json['course_name'] ?? '',
      sectionName: json['section_name'] ?? '',
      teacherName: json['teacher_name'] ?? '',
      joinCode: json['join_code'] ?? '',
      studentCount: json['student_count'] ?? 0,
      attendanceAvgRate: (json['attendance_avg_rate'] != null)
          ? (json['attendance_avg_rate'] as num).toDouble()
          : 100.0,
      quizCount: json['quiz_count'] ?? 0,
      pulsemeterCount: json['pulsemeter_count'] ?? 0,
      openDoubtsCount: json['open_doubts_count'] ?? 0,
    );
  }
}

class ClassroomService {
  static String get baseUrl => AuthService.baseUrl;

  static Future<List<Classroom>> fetchMyClassrooms() async {
    try {
      final token = AuthService.token;
      if (token == null) return [];

      final response = await http.get(
        Uri.parse('$baseUrl/classrooms/mine'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List list = data['classrooms'] ?? [];
        return list.map((item) => Classroom.fromJson(item)).toList();
      }
      return [];
    } catch (e) {
      debugPrint('Error fetching classrooms: $e');
      return [];
    }
  }

  static Future<Map<String, dynamic>> joinClassroom(String joinCode) async {
    try {
      final token = AuthService.token;
      if (token == null) return {'success': false, 'error': 'Not authenticated'};

      final response = await http.post(
        Uri.parse('$baseUrl/classrooms/join'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'join_code': joinCode}),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message']};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Failed to join classroom'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Network error: $e'};
    }
  }

  static Future<Map<String, dynamic>> unenrollFromClassroom(String classroomId) async {
    try {
      final token = AuthService.token;
      if (token == null) return {'success': false, 'error': 'Not authenticated'};

      final response = await http.delete(
        Uri.parse('$baseUrl/classrooms/$classroomId/leave'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message']};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Failed to unenroll'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Network error: $e'};
    }
  }
}
