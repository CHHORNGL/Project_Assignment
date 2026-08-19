import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/api_service.dart';

class AISettingsScreen extends StatefulWidget {
  const AISettingsScreen({super.key});

  @override
  State<AISettingsScreen> createState() => _AISettingsScreenState();
}

class _AISettingsScreenState extends State<AISettingsScreen> {
  final List<TextEditingController> _apiKeyControllers = [];
  String _selectedModel = 'original-ai';
  bool _isLoading = false;

  final List<Map<String, String>> _aiModels = [
    {'id': 'original-ai', 'name': 'Original AI (No Key Required)'},
    {'id': 'gemini-1.5-flash', 'name': 'Gemini 1.5 Flash'},
    {'id': 'gemini-1.5-pro', 'name': 'Gemini 1.5 Pro'},
    {'id': 'gemini-1.0-pro', 'name': 'Gemini 1.0 Pro'},
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = Provider.of<AuthProvider>(context, listen: false).user;
      if (user != null) {
        setState(() {
          _selectedModel = user.aiModel ?? 'original-ai';
          final savedKeysStr = user.aiApiKey ?? '';
          if (savedKeysStr.isNotEmpty) {
            final keys = savedKeysStr.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
            for (var key in keys) {
              _apiKeyControllers.add(TextEditingController(text: key));
            }
          }
          if (_apiKeyControllers.isEmpty) {
            _apiKeyControllers.add(TextEditingController());
          }
        });
      }
    });
  }

  @override
  void dispose() {
    for (var controller in _apiKeyControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  void _addKeyField() {
    if (_apiKeyControllers.length < 5) {
      setState(() {
        _apiKeyControllers.add(TextEditingController());
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You can only add up to 5 API keys.')),
      );
    }
  }

  void _removeKeyField(int index) {
    setState(() {
      _apiKeyControllers[index].dispose();
      _apiKeyControllers.removeAt(index);
      if (_apiKeyControllers.isEmpty) {
        _apiKeyControllers.add(TextEditingController());
      }
    });
  }

  Future<void> _saveSettings() async {
    setState(() => _isLoading = true);
    final joinedKeys = _apiKeyControllers
        .map((c) => c.text.trim())
        .where((text) => text.isNotEmpty)
        .join(',');

    final success = await ApiService.updateAISettings(
      _selectedModel,
      joinedKeys,
    );

    if (mounted) {
      if (success) {
        await Provider.of<AuthProvider>(context, listen: false).checkAuthStatus();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('AI Settings saved successfully!')),
        );
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save AI Settings.'), backgroundColor: Colors.red),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('AI Model Settings', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Select AI Model',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.grey),
                    ).animate().fade().slideX(),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          isExpanded: true,
                          value: _aiModels.any((m) => m['id'] == _selectedModel) ? _selectedModel : 'original-ai',
                          items: _aiModels.map((model) {
                            return DropdownMenuItem<String>(
                              value: model['id'],
                              child: Text(model['name']!),
                            );
                          }).toList(),
                          onChanged: (value) {
                            if (value != null) {
                              setState(() {
                                _selectedModel = value;
                              });
                            }
                          },
                        ),
                      ),
                    ).animate().fade().slideX(delay: 100.ms),
                    const SizedBox(height: 32),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Gemini API Keys',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.grey),
                        ),
                        if (_apiKeyControllers.length < 5)
                          TextButton.icon(
                            onPressed: _addKeyField,
                            icon: const Icon(Icons.add, size: 18),
                            label: const Text('Add Key'),
                            style: TextButton.styleFrom(
                              foregroundColor: Theme.of(context).colorScheme.primary,
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(50, 30),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ),
                      ],
                    ).animate().fade().slideX(delay: 200.ms),
                    const SizedBox(height: 12),
                    ..._apiKeyControllers.asMap().entries.map((entry) {
                      final index = entry.key;
                      final controller = entry.value;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12.0),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: controller,
                                obscureText: false,
                                decoration: InputDecoration(
                                  hintText: 'Enter API key ${index + 1}',
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
                                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
                                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Theme.of(context).colorScheme.primary, width: 2)),
                                  filled: true,
                                  fillColor: Colors.grey.shade50,
                                ),
                              ),
                            ),
                            if (_apiKeyControllers.length > 1)
                              IconButton(
                                icon: Icon(Icons.remove_circle_outline, color: Colors.red.shade300),
                                onPressed: () => _removeKeyField(index),
                              ),
                          ],
                        ),
                      ).animate().fade().slideX(delay: Duration(milliseconds: 300 + (index * 50)));
                    }),
                    const SizedBox(height: 8),
                    Text(
                      'You can add up to 5 Gemini keys. We will automatically load-balance between them to avoid rate limits!',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ).animate().fade().slideX(delay: 400.ms),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _saveSettings,
                  child: _isLoading 
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Save Settings'),
                ),
              ).animate().fade().slideY(begin: 0.2, delay: 500.ms),
            ),
          ],
        ),
      ),
    );
  }
}
