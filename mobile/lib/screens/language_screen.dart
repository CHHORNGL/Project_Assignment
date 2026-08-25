import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/language_provider.dart';
import '../services/api_service.dart';

class LanguageScreen extends StatefulWidget {
  const LanguageScreen({super.key});

  @override
  State<LanguageScreen> createState() => _LanguageScreenState();
}

class _LanguageScreenState extends State<LanguageScreen> {

  Future<void> _changeLanguage(String code) async {
    // Sync with LanguageProvider
    final langProvider = Provider.of<LanguageProvider>(context, listen: false);
    await langProvider.setLanguage(code);
    
    // Sync with backend
    await ApiService.setLanguage(code);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(code == 'km' ? 'ភាសាត្រូវបានផ្លាស់ប្តូរ' : 'Language changed to English')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final langProvider = Provider.of<LanguageProvider>(context);
    final currentLang = langProvider.currentLanguage;
    
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Language', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildLanguageOption('English', 'en', 'English', currentLang),
          _buildLanguageOption('Khmer', 'km', 'ភាសាខ្មែរ', currentLang),
        ].animate(interval: 100.ms).fade().slideX(begin: 0.1),
      ),
    );
  }

  Widget _buildLanguageOption(String title, String code, String localName, String currentLang) {
    final isSelected = currentLang == code;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isSelected ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.05) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isSelected ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.3) : Colors.grey.shade200),
      ),
      child: ListTile(
        onTap: () => _changeLanguage(code),
        title: Text(localName, style: TextStyle(fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
        subtitle: Text(title, style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
        trailing: isSelected ? Icon(Icons.check_circle, color: Theme.of(context).colorScheme.primary) : null,
      ),
    );
  }
}
