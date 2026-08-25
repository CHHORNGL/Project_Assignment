import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'farmer_dashboard_screen.dart';
import 'register_screen.dart';
import 'verify_code_screen.dart';
import 'package:google_sign_in/google_sign_in.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  
  bool _isLoading = false;
  String _errorMessage = '';

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final result = await authProvider.login(
      _usernameController.text.trim(), 
      _passwordController.text
    );

    if (result['requires_2fa'] == true && mounted) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => VerifyCodeScreen(
          email: result['email'] ?? '',
          purpose: result['purpose'] ?? 'login',
        )),
      );
      setState(() {
        _isLoading = false;
      });
    } else if (result['success'] == true && mounted) {
      // Restrict access to Farmers only
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
          _errorMessage = result['error'] ?? 'Invalid username or password.';
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      
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
                  
                  SizedBox(height: 32),
                  
                  Text(
                    'Welcome back',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: Theme.of(context).colorScheme.onSurface,
                      letterSpacing: -0.5,
                    ),
                  ).animate().fade(delay: 200.ms).slideY(begin: 0.2, curve: Curves.easeOutQuad),
                  
                  SizedBox(height: 8),
                  
                  Text(
                    'Enter your credentials to continue',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ).animate().fade(delay: 300.ms).slideY(begin: 0.2, curve: Curves.easeOutQuad),
                  
                  SizedBox(height: 48),
                  
                  if (_errorMessage.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.red.shade100),
                      ),
                      child: Text(
                        _errorMessage,
                        style: TextStyle(color: Colors.red.shade700, fontWeight: FontWeight.w500),
                        textAlign: TextAlign.center,
                      ),
                    ).animate().fade().slideY(begin: -0.1),
                    SizedBox(height: 16),
                  ],

                  TextFormField(
                    controller: _usernameController,
                    decoration: const InputDecoration(
                      labelText: 'Username or Email',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    validator: (val) => val == null || val.isEmpty ? 'Required' : null,
                  ).animate().fade(delay: 400.ms).slideY(begin: 0.2),
                  
                  SizedBox(height: 20),
                  
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      prefixIcon: Icon(Icons.lock_outline),
                    ),
                    validator: (val) => val == null || val.isEmpty ? 'Required' : null,
                  ).animate().fade(delay: 500.ms).slideY(begin: 0.2),
                  
                  SizedBox(height: 32),
                  
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleLogin,
                      child: _isLoading
                          ? SizedBox(
                              height: 24,
                              width: 24,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                            )
                          : Text('Login'),
                    ),
                  ).animate().fade(delay: 600.ms).slideY(begin: 0.2),
                  
                  SizedBox(height: 24),
                  
                  // Google Sign-In Button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: OutlinedButton.icon(
                      onPressed: _isLoading ? null : _handleGoogleLogin,
                      icon: Image.asset('assets/images/google_logo.png', height: 24),
                      label: Text('Sign in with Google', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 16)),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Colors.grey.shade300),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ).animate().fade(delay: 650.ms).slideY(begin: 0.2),
                  
                  SizedBox(height: 24),
                  
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text("Don't have an account? ", style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                      TextButton(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const RegisterScreen()),
                          );
                        },
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFF2E7D32),
                        ),
                        child: Text(
                          'Sign Up',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ).animate().fade(delay: 700.ms),
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
        // Restrict access to Farmers only
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
            _errorMessage = result['error'] ?? 'Google login failed.';
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
