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
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Brand
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.green.shade800, Colors.green.shade500],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.2),
                      ),
                      child: ClipOval(
                        child: Image.asset('assets/images/logo.jpg', width: 64, height: 64, fit: BoxFit.cover),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Agri Expert System',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                    ).animate().fade(delay: 100.ms).slideY(),
                    const SizedBox(height: 6),
                    Text(
                      'Empowering farmers and experts with practical, data-informed decision support.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, height: 1.4, color: Colors.white.withValues(alpha: 0.9)),
                    ).animate().fade(delay: 200.ms),
                  ],
                ),
              ).animate().fade().scale(),
              const SizedBox(height: 24),

              _buildSection(
                context,
                title: 'Project',
                items: const [
                  ('Norton University', null),
                  ('Expert System', null),
                ],
              ).animate().fade(delay: 250.ms).slideY(begin: 0.1),
              const SizedBox(height: 16),

              _buildSection(
                context,
                title: 'Leadership',
                items: const [
                  ('Professor', 'Sek Socheat'),
                  ('Email', 'Socheat.sek@gmail.com'),
                  ('Manager', 'Mao Seavik'),
                  ('Email', 'Ahzarky@gmail.com'),
                ],
              ).animate().fade(delay: 300.ms).slideY(begin: 0.1),
              const SizedBox(height: 16),

              _buildSection(
                context,
                title: 'Members',
                items: const [
                  ('Chea Cheavchorng', 'Cheavchhoorng@gmail.com'),
                  ('Nov Panha', 'novpanha66@gmail.com'),
                  ('Pich Rachana', 'pichrachana2003@gmail.com'),
                ],
              ).animate().fade(delay: 350.ms).slideY(begin: 0.1),

              const SizedBox(height: 32),
              Text(
                '© 2026 Agri Expert System. All rights reserved.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
              ).animate().fade(delay: 400.ms),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSection(BuildContext context, {required String title, required List<(String, String?)> items}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Colors.green.shade700,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 10),
          ...items.map(_buildItem),
        ],
      ),
    );
  }

  Widget _buildItem((String, String?) item) {
    final (label, value) = item;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (value != null) ...[
            Text(
              '$label: ',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black87),
            ),
          ],
          Expanded(
            child: Text(
              value ?? label,
              style: TextStyle(fontSize: 14, height: 1.4, color: value != null ? Colors.grey.shade700 : Colors.black87),
            ),
          ),
        ],
      ),
    );
  }
}
