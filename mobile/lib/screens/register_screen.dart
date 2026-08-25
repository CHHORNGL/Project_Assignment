import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'farmer_dashboard_screen.dart';
import 'verify_code_screen.dart';
import 'package:google_sign_in/google_sign_in.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _passwordController = TextEditingController();
  
  bool _isLoading = false;
  String _errorMessage = '';

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final result = await authProvider.register(
      _emailController.text,
      _fullNameController.text,
      _passwordController.text,
    );

    if (result['requires_2fa'] == true && mounted) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => VerifyCodeScreen(
          email: result['email'] ?? '',
          purpose: result['purpose'] ?? 'register',
        )),
      );
      setState(() {
        _isLoading = false;
      });
    } else if (result['success'] == true && mounted) {
      await authProvider.checkAuthStatus();
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const FarmerDashboardScreen()),
        );
      }
    } else {
      if (mounted) {
        setState(() {
          _errorMessage = result['error'] ?? 'Registration failed. Email might already exist.';
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _fullNameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Create Account'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Image.asset(
                    'assets/images/logo.jpg',
                    height: 120,
                  ).animate().fade(duration: 500.ms).scale(curve: Curves.easeOutBack),
                  
                  const SizedBox(height: 32),
                  
                  Text(
                    'Create an account',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: Colors.grey.shade800,
                      letterSpacing: -0.5,
                    ),
                  ).animate().fade(delay: 100.ms).slideY(begin: 0.2),
                  
                  const SizedBox(height: 8),
                  
                  Text(
                    'Register as a farmer to get started',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15, 
                      color: Colors.grey.shade500,
                    ),
                  ).animate().fade(delay: 200.ms).slideY(begin: 0.2),
                  
                  const SizedBox(height: 48),
                  
                  if (_errorMessage.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _errorMessage,
                        style: TextStyle(color: Colors.red.shade700),
                        textAlign: TextAlign.center,
                      ),
                    ).animate().fade().slideY(begin: -0.1),
                    const SizedBox(height: 16),
                  ],

                  TextFormField(
                    controller: _fullNameController,
                    decoration: InputDecoration(
                      labelText: 'Full Name',
                      prefixIcon: const Icon(Icons.person),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Colors.grey.shade200)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Colors.green.shade400, width: 2)),
                    ),
                    validator: (val) => val == null || val.isEmpty ? 'Required' : null,
                  ).animate().fade(delay: 300.ms).slideY(begin: 0.2),
                  
                  const SizedBox(height: 16),
                  
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: 'Email Address',
                      prefixIcon: const Icon(Icons.email),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Colors.grey.shade200)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Colors.green.shade400, width: 2)),
                    ),
                    validator: (val) => val == null || !val.contains('@') ? 'Enter valid email' : null,
                  ).animate().fade(delay: 400.ms).slideY(begin: 0.2),
                  
                  const SizedBox(height: 16),
                  
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Colors.grey.shade200)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Colors.green.shade400, width: 2)),
                    ),
                    validator: (val) => val == null || val.length < 6 ? 'Min 6 characters' : null,
                  ).animate().fade(delay: 500.ms).slideY(begin: 0.2),
                  
                  const SizedBox(height: 32),
                  
                  SizedBox(
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleRegister,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green.shade700,
                        foregroundColor: Colors.white,
                        elevation: 4,
                        shadowColor: Colors.green.withValues(alpha: 0.4),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: _isLoading
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text(
                              'Sign Up',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                    ),
                  ).animate().fade(delay: 600.ms).slideY(begin: 0.2),
                  const SizedBox(height: 24),
                  
                  // Google Sign-In Button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: OutlinedButton.icon(
                      onPressed: _isLoading ? null : _handleGoogleLogin,
                      icon: Image.asset('assets/images/google_logo.png', height: 24),
                      label: Text('Sign up with Google', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 16)),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Colors.grey.shade300),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ).animate().fade(delay: 650.ms).slideY(begin: 0.2),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handleGoogleLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      GoogleSignIn.instance.initialize(
        clientId: '58641591919-0om8j6nv7j7g1t59v04l4onv4otfofn2.apps.googleusercontent.com',
      );
      
      final GoogleSignInAccount account = await GoogleSignIn.instance.authenticate();
      final GoogleSignInAuthentication auth = account.authentication;
      final String? idToken = auth.idToken;

      if (idToken == null) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = 'Failed to retrieve Google ID token.';
          });
        }
        return;
      }

      if (!mounted) return;
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final result = await authProvider.googleLogin(idToken);

      if (result['success'] == true && mounted) {
        if (authProvider.user != null && !authProvider.user!.isFarmer) {
          await authProvider.logout();
          setState(() {
            _errorMessage = 'Access Denied: This app is only for Farmers. Please use the web dashboard.';
            _isLoading = false;
          });
          return;
        }

        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const FarmerDashboardScreen()),
        );
      } else {
        if (mounted) {
          setState(() {
            _errorMessage = result['error'] ?? 'Google sign up failed.';
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Error: ${e.toString()}';
          _isLoading = false;
        });
      }
    }
  }
}
