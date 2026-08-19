import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('About Agri System', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 40),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.eco, size: 80, color: Colors.green.shade700),
              ).animate().fade().scale(),
              const SizedBox(height: 24),
              const Text(
                'Agri System',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: -0.5),
              ).animate().fade(delay: 100.ms).slideY(),
              const SizedBox(height: 8),
              Text(
                'Version 1.0.0',
                style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600),
              ).animate().fade(delay: 200.ms),
              const SizedBox(height: 32),
              Text(
                'Agri System is an advanced AI-powered platform designed to help farmers instantly diagnose crop diseases and find actionable treatments.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, height: 1.5, color: Colors.grey.shade700),
              ).animate().fade(delay: 300.ms),
              const Spacer(),
              Text(
                '© 2026 Agri System. All rights reserved.',
                style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
              ).animate().fade(delay: 400.ms),
            ],
          ),
        ),
      ),
    );
  }
}
