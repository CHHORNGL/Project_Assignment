import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import 'session_cookie.dart';

class ApiService {
  // Use 10.0.2.2 for Android emulator, 127.0.0.1 for iOS Simulator, or your machine's IP for physical devices
  static const String baseUrl = 'http://192.168.100.167:5000/api';
  
  static Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final cookie = prefs.getString('session_cookie');
    
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': ?cookie,
    };
  }

  static Future<void> _updateCookie(http.Response response) async {
    final rawCookie = response.headers['set-cookie'];
    if (rawCookie == null) return;
    final cookie = sessionCookieHeader(rawCookie);
    if (cookie == null) return;
    final prefs = await SharedPreferences.getInstance();
    if (cookie == 'session=') {
      await prefs.remove('session_cookie');
    } else {
      await prefs.setString('session_cookie', cookie);
    }
  }

  static Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/login'),
        headers: {'Content-Type': 'application/json', 'X-Client-Platform': 'flutter'},
        body: jsonEncode({
          'username': username,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        await _updateCookie(response);
        return data;
      }
      return {'success': false, 'error': 'Server error ${response.statusCode}'};
    } catch (e) {
      // ignore: avoid_print
      print('Login error: $e');
      return {'success': false, 'error': 'Network error'};
    }
  }

  static Future<Map<String, dynamic>> register(String email, String fullName, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/register'),
        headers: {'Content-Type': 'application/json', 'X-Client-Platform': 'flutter'},
        body: jsonEncode({
          'email': email,
          'full_name': fullName,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        await _updateCookie(response);
        return data;
      }
      return {'success': false, 'error': 'Server error ${response.statusCode}'};
    } catch (e) {
      // ignore: avoid_print
      print('Register error: $e');
      return {'success': false, 'error': 'Network error'};
    }
  }

  static Future<Map<String, dynamic>> verifyCode(String code) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cookie = prefs.getString('session_cookie');
      final response = await http.post(
        Uri.parse('$baseUrl/verify-code'),
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Platform': 'flutter',
          'Cookie': ?cookie,
        },
        body: jsonEncode({'code': code}),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        await _updateCookie(response);
        return data;
      }
      return {'success': false, 'error': 'Invalid code or expired'};
    } catch (e) {
      return {'success': false, 'error': 'Network error'};
    }
  }

  static Future<bool> resendCode() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cookie = prefs.getString('session_cookie');
      final response = await http.post(
        Uri.parse('$baseUrl/resend-code'),
        headers: {
          'Cookie': ?cookie,
        }
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  static Future<User?> me() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/me'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return User.fromJson(data);
      }
      return null;
    } catch (e) {
      // ignore: avoid_print
      print('Me error: $e');
      return null;
    }
  }

  static Future<List<dynamic>> getCrops() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/crops'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['crops'] ?? [];
      }
      return [];
    } catch (e) {
      // ignore: avoid_print
      print('Fetch crops error: $e');
      return [];
    }
  }

  static Future<List<dynamic>> getHistory() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/history'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['history'] ?? [];
      }
      return [];
    } catch (e) {
      // ignore: avoid_print
      print('Fetch history error: $e');
      return [];
    }
  }

  static Future<Map<String, dynamic>> getNotifications({int page = 1}) async {
    try {
      final headers = await _getHeaders();
      final usersBaseUrl = baseUrl.replaceAll('/api', '/users');
      final response = await http.get(
        Uri.parse('$usersBaseUrl/notifications/data?page=$page&per_page=20'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {
          'items': data['items'] ?? [],
          'nextPage': data['next_page'],
        };
      }
      return {'items': [], 'nextPage': null};
    } catch (e) {
      // ignore: avoid_print
      print('Fetch notifications error: $e');
      return {'items': [], 'nextPage': null};
    }
  }

  static Future<bool> markNotificationsSeen(List<int> ids) async {
    if (ids.isEmpty) return true;
    try {
      final headers = await _getHeaders();
      final usersBaseUrl = baseUrl.replaceAll('/api', '/users');
      final response = await http.post(
        Uri.parse('$usersBaseUrl/notifications/seen'),
        headers: headers,
        body: jsonEncode({'ids': ids}),
      );
      return response.statusCode == 200;
    } catch (e) {
      // ignore: avoid_print
      print('Mark notifications seen error: $e');
      return false;
    }
  }

  static Future<int> getUnreadNotificationsCount() async {
    try {
      final headers = await _getHeaders();
      final usersBaseUrl = baseUrl.replaceAll('/api', '/users');
      final response = await http.get(
        Uri.parse('$usersBaseUrl/notifications/data?page=1&per_page=10'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final items = data['items'] as List<dynamic>? ?? [];
        return items.where((n) => n['unread'] == true).length;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  }

  static Future<List<Map<String, dynamic>>> getLoginActivity() async {
    try {
      final headers = await _getHeaders();
      http.Response response = await http.get(
        Uri.parse('$baseUrl/login-activity'),
        headers: headers,
      );
      if (response.statusCode != 200) {
        final usersBaseUrl = baseUrl.replaceAll('/api', '/users');
        response = await http.get(
          Uri.parse('$usersBaseUrl/login-activity/data'),
          headers: headers,
        );
      }
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return (data['activities'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();
      }
    } catch (e) {
      debugPrint('Login activity error: $e');
    }
    return [];
  }

  static Future<bool> revokeLoginActivity(String activityId) async {
    try {
      final headers = await _getHeaders();
      http.Response response = await http.post(
        Uri.parse('$baseUrl/login-activity/revoke'),
        headers: headers,
        body: jsonEncode({'activity_id': activityId}),
      );
      if (response.statusCode != 200) {
        final usersBaseUrl = baseUrl.replaceAll('/api', '/users');
        response = await http.post(
          Uri.parse('$usersBaseUrl/login-activity/revoke'),
          headers: headers,
          body: jsonEncode({'activity_id': activityId}),
        );
      }
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return data['ok'] == true;
      }
    } catch (e) {
      debugPrint('Revoke login activity error: $e');
    }
    return false;
  }

  static Future<bool> revokeOtherLoginActivities() async {
    try {
      final headers = await _getHeaders();
      http.Response response = await http.post(
        Uri.parse('$baseUrl/login-activity/revoke-others'),
        headers: headers,
      );
      if (response.statusCode != 200) {
        final usersBaseUrl = baseUrl.replaceAll('/api', '/users');
        response = await http.post(
          Uri.parse('$usersBaseUrl/login-activity/revoke-others'),
          headers: headers,
        );
      }
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return data['ok'] == true;
      }
    } catch (e) {
      debugPrint('Revoke other activities error: $e');
    }
    return false;
  }

  static Future<bool> setLanguage(String langCode) async {
    try {
      final headers = await _getHeaders();
      final usersBaseUrl = baseUrl.replaceAll('/api', '/users');
      final response = await http.post(
        Uri.parse('$usersBaseUrl/language'),
        headers: headers,
        body: jsonEncode({'language': langCode}),
      );
      return response.statusCode == 200;
    } catch (e) {
      // ignore: avoid_print
      print('Set language error: $e');
      return false;
    }
  }

  static Future<bool> updateProfileAvatar(File imageFile) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cookie = prefs.getString('session_cookie');
      
      final usersBaseUrl = baseUrl.replaceAll('/api', '/users');
      var request = http.MultipartRequest('POST', Uri.parse('$usersBaseUrl/profile'));
      
      if (cookie != null) {
        request.headers['Cookie'] = cookie;
      }
      
      request.files.add(await http.MultipartFile.fromPath(
        'avatar',
        imageFile.path,
      ));

      var streamedResponse = await request.send();
      return streamedResponse.statusCode == 200 || streamedResponse.statusCode == 302;
    } catch (e) {
      // ignore: avoid_print
      print('Update avatar error: $e');
      return false;
    }
  }

  static Future<bool> updateAISettings(String aiModel, String aiApiKey) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cookie = prefs.getString('session_cookie');
      
      final usersBaseUrl = baseUrl.replaceAll('/api', '/users');
      final response = await http.post(
        Uri.parse('$usersBaseUrl/settings'),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': ?cookie,
        },
        body: {
          'ai_model': aiModel,
          'ai_api_key': aiApiKey,
        },
      );
      return response.statusCode == 200 || response.statusCode == 302;
    } catch (e) {
      // ignore: avoid_print
      print('Update AI Settings error: $e');
      return false;
    }
  }

  static Future<bool> toggle2FA(bool enabled) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cookie = prefs.getString('session_cookie');
      
      final response = await http.post(
        Uri.parse('$baseUrl/2fa/toggle'),
        headers: {
          'Content-Type': 'application/json',
          'Cookie': ?cookie,
        },
        body: jsonEncode({'enabled': enabled}),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  static Future<String?> sendChatMessage(String message) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/chat/ask'),
        headers: headers,
        body: jsonEncode({'message': message}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['reply'];
      }
      return null;
    } catch (e) {
      // ignore: avoid_print
      print('Chat error: $e');
      return null;
    }
  }

  static Future<bool> submitSupportRequest(String message) async {
    try {
      final headers = await _getHeaders();
      final assistantBaseUrl = baseUrl.replaceAll('/api', '/assistant');
      final response = await http.post(
        Uri.parse('$assistantBaseUrl/support'),
        headers: headers,
        body: jsonEncode({'message': message, 'page': 'mobile-help-center'}),
      );
      return response.statusCode == 200;
    } catch (e) {
      // ignore: avoid_print
      print('Submit support request error: $e');
      return false;
    }
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    try {
      final cookie = prefs.getString('session_cookie');
      if (cookie != null) {
        await http.post(
          Uri.parse('$baseUrl/logout'),
          headers: {'Cookie': cookie, 'Accept': 'application/json'},
        ).timeout(const Duration(seconds: 10));
      }
    } catch (_) {
      // Local sign-out still works offline; the server session expires normally.
    } finally {
      await prefs.remove('session_cookie');
    }
  }

  static Future<Map<String, dynamic>?> diagnoseImage(File imageFile) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cookie = prefs.getString('session_cookie');

      var request = http.MultipartRequest('POST', Uri.parse('$baseUrl/diagnose/image'));
      if (cookie != null) {
        request.headers['Cookie'] = cookie;
      }
      
      request.files.add(await http.MultipartFile.fromPath(
        'image',
        imageFile.path,
      ));

      var streamedResponse = await request.send();
      var response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        debugPrint('Diagnose request failed: ${response.statusCode}');
        try {
          final errorData = jsonDecode(response.body);
          if (errorData.containsKey('error')) {
            return {'error': errorData['error']};
          }
        } catch (_) {}
        return {'error': 'Server error: ${response.statusCode}'};
      }
    } catch (e) {
      debugPrint('Exception in diagnoseImage: $e');
      return {'error': 'Failed to connect to server.'};
    }
  }

  static Future<Map<String, dynamic>> googleLogin(String idToken) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/google-login'),
        headers: {'Content-Type': 'application/json', 'X-Client-Platform': 'flutter'},
        body: json.encode({'id_token': idToken}),
      );
      
      await _updateCookie(response);
      final data = json.decode(response.body);
      
      if (response.statusCode == 200) {
        return {'success': true, 'user': data['user']};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Google login failed'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Connection error'};
    }
  }

  static Future<Map<String, dynamic>> updateProfileDetails(String username, String email, String password) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cookie = prefs.getString('session_cookie');
      
      final response = await http.post(
        Uri.parse('$baseUrl/update-profile'),
        headers: {
          'Content-Type': 'application/json',
          'Cookie': ?cookie,
        },
        body: json.encode({
          'username': username,
          'email': email,
          'password': password,
        }),
      );
      
      final data = json.decode(response.body);
      if (response.statusCode == 200) {
        return {'success': true};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Failed to update profile'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Connection error'};
    }
  }
}
