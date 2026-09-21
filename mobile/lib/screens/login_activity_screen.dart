import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../providers/language_provider.dart';
import '../utils/translations.dart';

class LoginActivityScreen extends StatefulWidget {
  const LoginActivityScreen({super.key});

  @override
  State<LoginActivityScreen> createState() => _LoginActivityScreenState();
}

class _LoginActivityScreenState extends State<LoginActivityScreen> {
  late Future<List<Map<String, dynamic>>> _activityFuture;

  @override
  void initState() {
    super.initState();
    _activityFuture = ApiService.getLoginActivity();
  }

  IconData _deviceIcon(String value) {
    switch (value.toLowerCase()) {
      case 'mobile':
        return Icons.smartphone_rounded;
      case 'tablet':
        return Icons.tablet_rounded;
      default:
        return Icons.desktop_windows_rounded;
    }
  }

  String _dateLabel(dynamic value) {
    final parsed = DateTime.tryParse(value?.toString() ?? '');
    if (parsed == null) return value?.toString() ?? '-';
    final local = parsed.toLocal();
    String two(int number) => number.toString().padLeft(2, '0');
    return '${local.year}-${two(local.month)}-${two(local.day)} ${two(local.hour)}:${two(local.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final lang = Provider.of<LanguageProvider>(context).currentLanguage;
    final colors = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: Text(tr('login_activity', lang))),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _activityFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text(tr('login_activity_error', lang)));
          }
          final activities = snapshot.data ?? [];
          if (activities.isEmpty) {
            return Center(child: Text(tr('no_login_activity', lang)));
          }
          return RefreshIndicator(
            onRefresh: () async {
              setState(() {
                _activityFuture = ApiService.getLoginActivity();
              });
              await _activityFuture;
            },
            child: ListView.separated(
              padding: const EdgeInsets.all(20),
              itemCount: activities.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final activity = activities[index];
                final current = activity['current'] == true;
                final device = activity['device_type']?.toString() ?? 'Unknown';
                final browser = activity['browser']?.toString() ?? 'Unknown';
                final platform = activity['platform']?.toString() ?? 'Unknown';
                return Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    leading: CircleAvatar(
                      backgroundColor: colors.primary.withValues(alpha: 0.12),
                      foregroundColor: colors.primary,
                      child: Icon(_deviceIcon(device)),
                    ),
                    title: Text('$device · $browser · $platform', style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Text('${activity['ip_address'] ?? '-'}\n${_dateLabel(activity['created_at'])}'),
                    ),
                    trailing: current
                        ? Text(tr('this_device', lang), style: TextStyle(color: Colors.green.shade700, fontSize: 12, fontWeight: FontWeight.w700))
                        : null,
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
