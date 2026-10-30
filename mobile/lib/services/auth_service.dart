import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

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

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'full_name': fullName,
    'role': role,
    'created_at': createdAt,
  };
}

class AuthService {
  // Live Cloud Backend on Render (No local Wi-Fi or USB wires needed!)
  static String baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'https://classpulse-api-09dw.onrender.com');

  static String? _token;
  static User? _currentUser;

  static String? get token => _token;
  static User? get currentUser => _currentUser;

  static const String _keyToken = 'classpulse_token';
  static const String _keyUser = 'classpulse_user';

  /// Initialize and load saved session from local device storage
  static Future<bool> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedToken = prefs.getString(_keyToken);
      final savedUserJson = prefs.getString(_keyUser);

      if (savedToken != null && savedToken.isNotEmpty && savedUserJson != null && savedUserJson.isNotEmpty) {
        _token = savedToken;
        _currentUser = User.fromJson(jsonDecode(savedUserJson));
        return true;
      }
    } catch (e) {
      // Clear corrupt state
      await logout();
    }
    return false;
  }

  static Future<Map<String, dynamic>> signup({
    required String email,
    required String password,
    required String fullName,
    required String role,
    bool rememberMe = true,
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

        if (rememberMe) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_keyToken, _token!);
          await prefs.setString(_keyUser, jsonEncode(_currentUser!.toJson()));
        }

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
    bool rememberMe = true,
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

        if (rememberMe) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_keyToken, _token!);
          await prefs.setString(_keyUser, jsonEncode(_currentUser!.toJson()));
        }

        return {'success': true};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Login failed'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Network error: $e'};
    }
  }

  static Future<void> logout() async {
    _token = null;
    _currentUser = null;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_keyToken);
      await prefs.remove(_keyUser);
    } catch (_) {}
  }
}

