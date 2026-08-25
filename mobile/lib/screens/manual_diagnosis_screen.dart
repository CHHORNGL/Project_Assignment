import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class ManualDiagnosisScreen extends StatefulWidget {
  const ManualDiagnosisScreen({super.key});

  @override
  State<ManualDiagnosisScreen> createState() => _ManualDiagnosisScreenState();
}

class _ManualDiagnosisScreenState extends State<ManualDiagnosisScreen> {
  // ... existing vars ...
  bool _isLoading = true;
  bool _isLoadingSymptoms = false;
  List<dynamic> _crops = [];
  List<dynamic> _symptoms = [];
  
  int? _selectedCropId;
  final Set<String> _selectedSymptoms = {};
  final TextEditingController _searchController = TextEditingController();

  bool _isDiagnosing = false;
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _resetForm() {
    setState(() {
      _selectedCropId = null;
      _symptoms = [];
      _selectedSymptoms.clear();
      _searchQuery = '';
      _isDiagnosing = false;
    });
    _searchController.clear();
  }

  // ... (keep initState, _fetchData, _submitDiagnosis, _showDiagnosisResult, _buildResultCard the same)

  @override
  void initState() {
    super.initState();
    _fetchCrops();
  }

  Future<void> _fetchCrops() async {
    try {
      final crops = await ApiService.getCrops();
      if (mounted) {
        setState(() {
          _crops = crops;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading crops: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _fetchSymptomsForCrop(int cropId) async {
    setState(() {
      _isLoadingSymptoms = true;
      _symptoms = [];
      _selectedSymptoms.clear();
      _searchQuery = '';
    });
    try {
      final prefs = await SharedPreferences.getInstance();
      final cookie = prefs.getString('session_cookie');
      final headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (cookie != null) 'Cookie': cookie,
      };

      final response = await http.get(
        Uri.parse('${ApiService.baseUrl}/symptoms?crop_id=$cropId'),
        headers: headers,
      );
      
      if (response.statusCode == 200 && mounted) {
        final data = jsonDecode(response.body);
        setState(() {
          _symptoms = data['symptoms'] ?? [];
          _isLoadingSymptoms = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingSymptoms = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading symptoms: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _submitDiagnosis() async {
    if (_selectedCropId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a crop first.'), backgroundColor: Colors.orange),
      );
      return;
    }
    
    if (_selectedSymptoms.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least one symptom.'), backgroundColor: Colors.orange),
      );
      return;
    }

    setState(() => _isDiagnosing = true);
    
    try {
      final prefs = await SharedPreferences.getInstance();
      final cookie = prefs.getString('session_cookie');
      final headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (cookie != null) 'Cookie': cookie,
      };

      final response = await http.post(
        Uri.parse('${ApiService.baseUrl}/diagnose'),
        headers: headers,
        body: jsonEncode({
          'crop_id': _selectedCropId,
          'symptoms': _selectedSymptoms.toList(),
        }),
      );
      
      if (mounted) {
        setState(() => _isDiagnosing = false);
        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          _showDiagnosisResult(data);
        } else {
          final data = jsonDecode(response.body);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(data['error'] ?? 'Diagnosis failed'), backgroundColor: Colors.red),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isDiagnosing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showDiagnosisResult(Map<String, dynamic> result) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(        height: MediaQuery.of(context).size.height * 0.85,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(width: 40, height: 5, decoration: BoxDecoration(color: Theme.of(context).dividerColor, borderRadius: BorderRadius.circular(10))),
            ),
            SizedBox(height: 24),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(16)),
                  child: Icon(Icons.check_circle, color: Colors.green.shade600, size: 32),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Diagnosis Complete', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 14)),
                      Text(
                        result['disease'] ?? 'Unknown',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87),
                      ),
                    ],
                  ),
                ),
              ],
            ).animate().fade().slideX(),
            SizedBox(height: 32),
            Expanded(
              child: ListView(
                children: [
                  _buildResultCard('Confidence', '${((result['confidence'] ?? 0) * 100).toStringAsFixed(1)}%', Icons.analytics),
                  if (result['reason'] != null)
                    _buildResultCard('Reasoning', result['reason'], Icons.psychology),
                  if (result['recommendations'] != null && result['recommendations']['solution'] != null)
                    _buildResultCard('Treatment', result['recommendations']['solution'], Icons.medical_services),
                ],
              ),
            ),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: Text('New Diagnosis'),
              ),
            ),
          ],
        ),
      ),
    ).whenComplete(_resetForm);
  }

  Widget _buildResultCard(String title, String content, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
              SizedBox(width: 8),
              Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          SizedBox(height: 8),
          Text(content, style: TextStyle(color: Theme.of(context).colorScheme.onSurface, height: 1.5)),
        ],
      ),
    ).animate().fade().slideY(begin: 0.1);
  }

  @override
  Widget build(BuildContext context) {
    final filteredSymptoms = _symptoms.where((s) {
      final name = s['name'].toString().toLowerCase();
      return name.contains(_searchQuery.toLowerCase());
    }).toList();

    return Scaffold(
      
      appBar: AppBar(
        title: Text('Manual Diagnosis', style: TextStyle(fontWeight: FontWeight.bold)),
        
        elevation: 0,
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(24),
                    children: [
                      Text(
                        '1. Select Crop',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87),
                      ),
                      SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Theme.of(context).dividerColor),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            isExpanded: true,
                            hint: Text('Choose a crop'),
                            value: _selectedCropId,
                            items: _crops.map((c) => DropdownMenuItem<int>(
                              value: c['id'],
                              child: Row(
                                children: [
                                  Text(c['emoji'] ?? '🌱'),
                                  SizedBox(width: 12),
                                  Text(c['name']),
                                ],
                              ),
                            )).toList(),
                            onChanged: (val) {
                              if (val != null && val != _selectedCropId) {
                                setState(() => _selectedCropId = val);
                                _fetchSymptomsForCrop(val);
                              }
                            },
                          ),
                        ),
                      ).animate().fade().slideX(),
                      SizedBox(height: 32),
                      Text(
                        '2. Select Symptoms',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87),
                      ),
                      SizedBox(height: 8),
                      Text('Check all symptoms that apply to your plant.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                      SizedBox(height: 16),
                      if (_selectedCropId == null)
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.blue.shade50,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.blue.shade100, style: BorderStyle.solid),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.info_outline, color: Colors.blue.shade400),
                              SizedBox(width: 12),
                              Expanded(
                                child: Text('Please select a crop above to see relevant symptoms.', style: TextStyle(color: Colors.blue)),
                              ),
                            ],
                          ),
                        ).animate().fade()
                      else if (_isLoadingSymptoms)
                        Padding(
                          padding: EdgeInsets.all(32),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else ...[
                        TextField(
                          controller: _searchController,
                          decoration: InputDecoration(
                            hintText: 'Search symptoms...',
                            prefixIcon: const Icon(Icons.search),
                            filled: true,
                            fillColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: Theme.of(context).dividerColor),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: Theme.of(context).dividerColor),
                            ),
                          ),
                          onChanged: (val) => setState(() => _searchQuery = val),
                        ),
                        SizedBox(height: 16),
                        if (filteredSymptoms.isEmpty)
                          Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Theme.of(context).dividerColor, style: BorderStyle.solid),
                            ),
                            child: Center(
                              child: Text('No symptoms match your search.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                            ),
                          )
                        else
                          ListView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: filteredSymptoms.length,
                            itemBuilder: (context, index) {
                            final s = filteredSymptoms[index];
                            final name = s['name'] as String;
                            final isSelected = _selectedSymptoms.contains(name);
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: InkWell(
                                onTap: () {
                                  setState(() {
                                    if (isSelected) {
                                      _selectedSymptoms.remove(name);
                                    } else {
                                      _selectedSymptoms.add(name);
                                    }
                                  });
                                },
                                borderRadius: BorderRadius.circular(16),
                                child: Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Theme.of(context).colorScheme.surface,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: isSelected ? Colors.green.shade600 : Theme.of(context).dividerColor,
                                      width: isSelected ? 2 : 1,
                                    ),
                                    boxShadow: [
                                      if (isSelected)
                                        BoxShadow(color: Colors.green.withOpacity(0.1), blurRadius: 8, offset: const Offset(0, 4))
                                    ],
                                  ),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 36,
                                        height: 36,
                                        decoration: BoxDecoration(
                                          color: isSelected ? Colors.green.shade600 : Theme.of(context).colorScheme.surfaceContainerHighest,
                                          borderRadius: BorderRadius.circular(10),
                                          border: Border.all(color: isSelected ? Colors.green.shade600 : Theme.of(context).dividerColor),
                                        ),
                                        child: Icon(
                                          isSelected ? Icons.check : Icons.add,
                                          color: isSelected ? Colors.white : Theme.of(context).colorScheme.onSurfaceVariant,
                                          size: 20,
                                        ),
                                      ),
                                      SizedBox(width: 16),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              name,
                                              style: TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.w600,
                                                color: Theme.of(context).colorScheme.onSurface,
                                              ),
                                            ),
                                            SizedBox(height: 4),
                                            Text(
                                              isSelected ? 'Included in diagnosis' : 'Click to add this symptom',
                                              style: TextStyle(
                                                fontSize: 13,
                                                color: Theme.of(context).colorScheme.onSurfaceVariant,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ).animate().fade().slideY(begin: 0.1, delay: Duration(milliseconds: 50 * (index % 10)));
                          },
                        ),
                      ],
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -5))],
                  ),
                  child: SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _isDiagnosing ? null : _submitDiagnosis,
                      child: _isDiagnosing
                          ? SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text('Diagnose Now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
