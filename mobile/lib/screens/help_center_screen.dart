import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class HelpCenterScreen extends StatelessWidget {
  const HelpCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Help Center', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildFaqItem('How do I diagnose a plant?', 'Go to the Scan tab, take a clear photo of the affected leaf, and tap Diagnose Now.'),
          _buildFaqItem('What is the Knowledge Base?', 'It is a library of known crop diseases and treatments to help you learn more.'),
          _buildFaqItem('How accurate is the AI?', 'The AI is highly trained on agricultural data but should be used as a supplementary tool alongside professional advice.'),
          _buildFaqItem('How to contact support?', 'You can email us directly at support@agrisystem.com.'),
        ].animate(interval: 100.ms).fade().slideX(begin: 0.1),
      ),
    );
  }

  Widget _buildFaqItem(String question, String answer) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: ExpansionTile(
        title: Text(question, style: const TextStyle(fontWeight: FontWeight.w600)),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Text(answer, style: TextStyle(color: Colors.grey.shade700, height: 1.5)),
          ),
        ],
      ),
    );
  }
}
