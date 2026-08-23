import 'dart:convert';
import 'package:http/http.dart' as http;

class User {
  final String id;
  final String email;
  final String fullName;
  final String role;
  final String createdAt;

  User({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      fullName: json['full_name'] ?? '',
      role: json['role'] ?? 'student',
      createdAt: json['created_at'] ?? '',
    );
  }
}

class AuthService {
  // Laptop Wi-Fi IP address for physical phone and local emulator testing
  static String baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://192.168.1.4:4000');

  static String? _token;
  static User? _currentUser;

  static String? get token => _token;
  static User? get currentUser => _currentUser;

  static Future<Map<String, dynamic>> signup({
    required String email,
    required String password,
    required String fullName,
    required String role,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/signup'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
          'full_name': fullName,
          'role': role,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        _token = data['token'];
        _currentUser = User.fromJson(data['user']);
        return {'success': true};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Signup failed'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Network error: $e'};
    }
  }

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        _token = data['token'];
        _currentUser = User.fromJson(data['user']);
        return {'success': true};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Login failed'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Network error: $e'};
    }
  }

  static void logout() {
    _token = null;
    _currentUser = null;
  }
}
