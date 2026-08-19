import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import 'farmer_dashboard_screen.dart';

class VerifyCodeScreen extends StatefulWidget {
  final String email;
  final String purpose;

  const VerifyCodeScreen({
    super.key,
    required this.email,
    required this.purpose,
  });

  @override
  State<VerifyCodeScreen> createState() => _VerifyCodeScreenState();
}

class _VerifyCodeScreenState extends State<VerifyCodeScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  
  bool _isLoading = false;
  String _errorMessage = '';
  String _successMessage = '';

  Future<void> _handleVerify() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _successMessage = '';
    });

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final result = await authProvider.verifyCode(_codeController.text.trim());

    if (result['success'] == true && mounted) {
      // Check role
      if (authProvider.user != null && !authProvider.user!.isFarmer) {
        await authProvider.logout();
        setState(() {
          _errorMessage = 'Access Denied: This app is only for Farmers.';
          _isLoading = false;
        });
        return;
      }

      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const FarmerDashboardScreen()),
        (route) => false,
      );
    } else {
      if (mounted) {
        setState(() {
          _errorMessage = result['error'] ?? 'Invalid code.';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleResend() async {
    setState(() {
      _errorMessage = '';
      _successMessage = '';
    });
    
    final success = await ApiService.resendCode();
    if (mounted) {
      setState(() {
        if (success) {
          _successMessage = 'A new code has been sent to your email.';
        } else {
          _errorMessage = 'Failed to resend code.';
        }
      });
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Two-Step Verification'),
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
                  Icon(Icons.security, size: 80, color: Colors.green.shade600)
                      .animate().scale(duration: 400.ms, curve: Curves.easeOutBack),
                  
                  const SizedBox(height: 32),
                  
                  Text(
                    'Verification Required',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ).animate().fade(delay: 200.ms).slideY(begin: 0.2),
                  
                  const SizedBox(height: 12),
                  
                  Text(
                    'We sent a 6-digit verification code to:\n${widget.email}',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ).animate().fade(delay: 300.ms).slideY(begin: 0.2),
                  
                  const SizedBox(height: 32),
                  
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
                    ).animate().fade(),
                    const SizedBox(height: 16),
                  ],

                  if (_successMessage.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.green.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.green.shade100),
                      ),
                      child: Text(
                        _successMessage,
                        style: TextStyle(color: Colors.green.shade700, fontWeight: FontWeight.w500),
                        textAlign: TextAlign.center,
                      ),
                    ).animate().fade(),
                    const SizedBox(height: 16),
                  ],

                  TextFormField(
                    controller: _codeController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 24, letterSpacing: 8, fontWeight: FontWeight.bold),
                    decoration: const InputDecoration(
                      hintText: '000000',
                      counterText: '',
                    ),
                    validator: (val) => val == null || val.length != 6 ? 'Enter 6-digit code' : null,
                  ).animate().fade(delay: 400.ms).slideY(begin: 0.2),
                  
                  const SizedBox(height: 32),
                  
                  SizedBox(
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleVerify,
                      child: _isLoading
                          ? const SizedBox(
                              height: 24,
                              width: 24,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                            )
                          : const Text('Verify'),
                    ),
                  ).animate().fade(delay: 500.ms).slideY(begin: 0.2),
                  
                  const SizedBox(height: 24),
                  
                  TextButton(
                    onPressed: _isLoading ? null : _handleResend,
                    child: const Text('Didn\'t receive the code? Resend'),
                  ).animate().fade(delay: 600.ms),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
