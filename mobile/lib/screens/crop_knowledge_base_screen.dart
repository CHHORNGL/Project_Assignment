import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/api_service.dart';
import '../models/crop.dart';

class CropKnowledgeBaseScreen extends StatefulWidget {
  const CropKnowledgeBaseScreen({super.key});

  @override
  State<CropKnowledgeBaseScreen> createState() => _CropKnowledgeBaseScreenState();
}

class _CropKnowledgeBaseScreenState extends State<CropKnowledgeBaseScreen> {
  List<Crop> _crops = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchCrops();
  }

  Future<void> _fetchCrops() async {
    try {
      final data = await ApiService.getCrops();
      setState(() {
        _crops = data.map((e) => Crop.fromJson(e)).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load crops: $e';
        _isLoading = false;
      });
    }
  }

  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) {
      hex = 'FF$hex'; 
    }
    return Color(int.parse(hex, radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 16)),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.black87,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              onPressed: () {
                setState(() { _isLoading = true; _error = null; });
                _fetchCrops();
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            )
          ],
        ),
      );
    }

    if (_crops.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.eco_outlined, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text('No crops found in the knowledge base.', style: TextStyle(color: Colors.grey.shade600, fontSize: 16)),
          ],
        ),
      );
    }

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Knowledge Base',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.black87, letterSpacing: -0.5),
                ).animate().fade().slideY(begin: 0.1),
                const SizedBox(height: 8),
                Text(
                  'Explore our extensive database of crops and learn how to manage them.',
                  style: TextStyle(fontSize: 15, color: Colors.grey.shade500, height: 1.4),
                ).animate().fade(delay: 100.ms).slideY(begin: 0.1),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final crop = _crops[index];
                final color = _hexToColor(crop.color);
                
                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.grey.shade200, width: 1.5),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 15, offset: const Offset(0, 5)),
                    ],
                  ),
                  child: Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      tilePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      iconColor: color,
                      collapsedIconColor: Colors.grey.shade400,
                      leading: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: Text(crop.emoji, style: const TextStyle(fontSize: 24)),
                      ),
                      title: Text(
                        crop.name, 
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: Colors.black87, letterSpacing: -0.2),
                      ),
                      children: [
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                          child: Text(
                            crop.description.isEmpty ? 'No description available.' : crop.description,
                            style: TextStyle(color: Colors.grey.shade700, height: 1.6, fontSize: 15),
                          ),
                        ),
                      ],
                    ),
                  ),
                ).animate().fade(delay: (200 + (index * 50)).ms).slideX(begin: 0.1);
              },
              childCount: _crops.length,
            ),
          ),
        ),
        const SliverToBoxAdapter(
          child: SizedBox(height: 100), // spacing for bottom bar
        ),
      ],
    );
  }
}
