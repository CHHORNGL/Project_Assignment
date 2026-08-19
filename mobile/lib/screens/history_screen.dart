import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/api_service.dart';
import 'package:intl/intl.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<dynamic> _history = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    try {
      final data = await ApiService.getHistory();
      setState(() {
        _history = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load history: $e';
        _isLoading = false;
      });
    }
  }

  void _showDiagnosisResult(Map<String, dynamic> result) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.85,
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
                  child: Icon(Icons.history, color: Colors.green.shade600, size: 32),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${result['crop']} - ${result['diagnosis_type']}',
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 14, fontWeight: FontWeight.w600),
                      ),
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
                  if (result['symptoms'] != null && (result['symptoms'] as List).isNotEmpty)
                    _buildResultCard(
                      'Detected Symptoms',
                      (result['symptoms'] as List).join(', '),
                      Icons.healing,
                    ),
                  _buildResultCard('Confidence', result['severity'] ?? 'N/A', Icons.analytics),
                  if (result['reason'] != null)
                    _buildResultCard('Reasoning', result['reason'], Icons.psychology),
                  if (result['solution'] != null)
                    _buildResultCard('Treatment', result['solution'], Icons.medical_services),
                ],
              ),
            ),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: Text('Close'),
              ),
            ),
          ],
        ),
      ),
    );
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
    return Scaffold(
      
      appBar: AppBar(
        title: Text('Diagnosis History', style: TextStyle(fontWeight: FontWeight.bold)),
        
        elevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_error!, style: TextStyle(color: Colors.red)),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                setState(() { _isLoading = true; _error = null; });
                _fetchHistory();
              },
              child: Text('Retry'),
            )
          ],
        ),
      );
    }

    if (_history.isEmpty) {
      return Center(child: Text('No past diagnoses found.'));
    }

    return RefreshIndicator(
      onRefresh: _fetchHistory,
      child: ListView.builder(
        padding: const EdgeInsets.all(24),
        itemCount: _history.length,
        itemBuilder: (context, index) {
          final item = _history[index];
          final isAI = item['diagnosis_type'].toString().toLowerCase().contains('auto');
          final date = item['created_at'] != null 
            ? DateFormat('MMM d, yyyy - h:mm a').format(DateTime.parse(item['created_at']))
            : 'Unknown Date';

          return Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: InkWell(
              onTap: () => _showDiagnosisResult(item),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Theme.of(context).dividerColor, width: 1.5),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 4))],
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: isAI ? Colors.blue.shade50 : Colors.green.shade50,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        isAI ? Icons.auto_awesome : Icons.fact_check,
                        color: isAI ? Colors.blue.shade600 : Colors.green.shade600,
                      ),
                    ),
                    SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                item['crop'] ?? 'Unknown',
                                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13, fontWeight: FontWeight.w600),
                              ),
                              Text(
                                date.split(' - ')[0],
                                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12),
                              ),
                            ],
                          ),
                          SizedBox(height: 4),
                          Text(
                            item['disease'] ?? 'Unknown',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87),
                          ),
                          SizedBox(height: 8),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  isAI ? 'AI Scan' : 'Manual Entry',
                                  style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant, fontWeight: FontWeight.w500),
                                ),
                              ),
                              SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.green.shade50,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  item['severity'] ?? 'N/A',
                                  style: TextStyle(fontSize: 12, color: Colors.green.shade700, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          )
                        ],
                      ),
                    ),
                    SizedBox(width: 8),
                    Icon(Icons.chevron_right, color: Theme.of(context).dividerColor),
                  ],
                ),
              ),
            ),
          ).animate().fade().slideY(begin: 0.1, delay: Duration(milliseconds: 50 * (index % 10)));
        },
      ),
    );
  }
}
