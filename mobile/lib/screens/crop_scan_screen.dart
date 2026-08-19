import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/api_service.dart';

class CropScanScreen extends StatefulWidget {
  const CropScanScreen({super.key});

  @override
  State<CropScanScreen> createState() => _CropScanScreenState();
}

class _CropScanScreenState extends State<CropScanScreen> {
  File? _image;
  final ImagePicker _picker = ImagePicker();
  bool _isDiagnosing = false;

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? pickedFile = await _picker.pickImage(source: source);
      if (pickedFile != null) {
        setState(() {
          _image = File(pickedFile.path);
        });
      }
    } catch (e) {
      print("Failed to pick image: $e");
    }
  }

  void _clearImage() {
    setState(() {
      _image = null;
    });
  }

  Future<void> _diagnoseImage() async {
    if (_image == null) return;
    
    setState(() {
      _isDiagnosing = true;
    });

    final result = await ApiService.diagnoseImage(_image!);

    setState(() {
      _isDiagnosing = false;
    });

    if (!mounted) return;

    if (result == null) {
      _showErrorDialog("Diagnosis failed. Please check your connection.");
      return;
    }

    if (result.containsKey('error')) {
      _showErrorDialog(result['error']);
      return;
    }

    _showResultDialog(result);
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Diagnosis Failed', style: TextStyle(color: Colors.red)),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('OK')),
        ],
      ),
    );
  }

  void _showResultDialog(Map<String, dynamic> result) {
    showDialog(
      context: context,
      builder: (ctx) {
        List<dynamic> symptoms = result['symptoms'] ?? [];
        List<dynamic> recommendations = result['recommendations'] ?? [];
        String disease = result['disease'] ?? "Unknown Disease";
        String confidenceTier = (result['confidence_tier'] ?? "Low").toString().toUpperCase();
        
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            disease,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22, color: Colors.green),
          ),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    "CONFIDENCE: $confidenceTier",
                    style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green.shade800, fontSize: 12),
                  ),
                ),
                SizedBox(height: 16),
                if (result['reason'] != null && result['reason'].toString().isNotEmpty) ...[
                  Text('Reason:', style: TextStyle(fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  Text(result['reason'].toString()),
                  SizedBox(height: 16),
                ],
                if (symptoms.isNotEmpty) ...[
                  Text('Detected Symptoms:', style: TextStyle(fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  ...symptoms.map((s) => Text('• $s')),
                  SizedBox(height: 16),
                ],
                if (recommendations.isNotEmpty) ...[
                  Text('Recommendations:', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.blue)),
                  SizedBox(height: 4),
                  ...recommendations.map((r) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text('• $r', style: TextStyle(color: Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87)),
                      )),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                _clearImage();
              },
              child: Text('DONE', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: 16),
              Text(
                'AI Diagnosis',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87, letterSpacing: -0.5),
              ).animate().fade().slideY(begin: 0.1),
              SizedBox(height: 8),
              Text(
                'Take a clear photo of the affected leaf to instantly detect diseases.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15, color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.4),
              ).animate().fade(delay: 100.ms).slideY(begin: 0.1),
              SizedBox(height: 40),
              
              if (_image == null) ...[
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(32),
                      border: Border.all(color: Theme.of(context).dividerColor, width: 2),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.document_scanner_outlined, size: 64, color: Theme.of(context).colorScheme.primary)
                              .animate(onPlay: (controller) => controller.repeat(reverse: true))
                              .scaleXY(end: 1.05, duration: 2000.ms, curve: Curves.easeInOut),
                        ),
                        SizedBox(height: 24),
                        Text('Ready to Scan', style: TextStyle(color: Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87, fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                        SizedBox(height: 8),
                        Text('Center the leaf in the frame', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 14)),
                      ],
                    ),
                  ).animate().fade(delay: 200.ms).scale(curve: Curves.easeOutBack),
                ),
              ] else ...[
                Expanded(
                  child: Stack(
                    alignment: Alignment.topRight,
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(32),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 20, offset: const Offset(0, 10)),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(32),
                          child: Image.file(
                            _image!,
                            width: double.infinity,
                            height: double.infinity,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ).animate().fade().scale(),
                      
                      Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: IconButton(
                          onPressed: _isDiagnosing ? null : _clearImage,
                          icon: Icon(Icons.close, color: Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87, size: 24),
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.white.withValues(alpha: 0.9),
                            padding: const EdgeInsets.all(12),
                          ),
                        ),
                      ),
                      
                      if (_isDiagnosing)
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(32),
                          ),
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                                SizedBox(height: 24),
                                Text(
                                  'Analyzing Image...',
                                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16, letterSpacing: 0.5),
                                ).animate(onPlay: (controller) => controller.repeat()).fade(duration: 1.seconds),
                              ],
                            ),
                          ),
                        ).animate().fade(),
                    ],
                  ),
                ),
              ],
              SizedBox(height: 40),
              
              if (_image == null) ...[
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => _pickImage(ImageSource.camera),
                        icon: const Icon(Icons.camera_alt_outlined),
                        label: Text('Camera', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          backgroundColor: Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                      ).animate().fade(delay: 300.ms).slideY(begin: 0.2),
                    ),
                    SizedBox(width: 16),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pickImage(ImageSource.gallery),
                        icon: const Icon(Icons.photo_library_outlined),
                        label: Text('Gallery', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          foregroundColor: Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87,
                          side: BorderSide(color: Theme.of(context).dividerColor, width: 2),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                      ).animate().fade(delay: 400.ms).slideY(begin: 0.2),
                    ),
                  ],
                ),
              ] else ...[
                SizedBox(
                  height: 60,
                  child: ElevatedButton(
                    onPressed: _isDiagnosing ? null : _diagnoseImage,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: Text('Diagnose Now', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  ),
                ).animate().fade().slideY(begin: 0.2),
              ],
              SizedBox(height: 100), // padding for bottom nav
            ],
          ),
        ),
      ),
    );
  }
}
