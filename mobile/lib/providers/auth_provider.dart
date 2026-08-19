import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  User? _user;
  bool _isLoading = false;

  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;

  Future<void> checkAuthStatus() async {
    _isLoading = true;
    notifyListeners();

    _user = await ApiService.me();

    _isLoading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>> login(String username, String password) async {
    _isLoading = true;
    notifyListeners();

    final result = await ApiService.login(username, password);
    
    if (result['success'] == true && result['user'] != null) {
      _user = User.fromJson(result['user']);
    }

    _isLoading = false;
    notifyListeners();
    
    return result;
  }

  Future<Map<String, dynamic>> register(String email, String fullName, String password) async {
    _isLoading = true;
    notifyListeners();

    final result = await ApiService.register(email, fullName, password);
    
    if (result['success'] == true && result['user'] != null) {
      _user = User.fromJson(result['user']);
    }

    _isLoading = false;
    notifyListeners();
    
    return result;
  }

  Future<Map<String, dynamic>> verifyCode(String code) async {
    _isLoading = true;
    notifyListeners();

    final result = await ApiService.verifyCode(code);
    
    if (result['success'] == true && result['user'] != null) {
      _user = User.fromJson(result['user']);
    }

    _isLoading = false;
    notifyListeners();
    
    return result;
  }

  Future<void> logout() async {
    await ApiService.logout();
    _user = null;
    notifyListeners();
  }
}
