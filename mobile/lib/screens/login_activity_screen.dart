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
  bool _isRevoking = false;

  @override
  void initState() {
    super.initState();
    _activityFuture = ApiService.getLoginActivity();
  }

  void _refresh() {
    setState(() {
      _activityFuture = ApiService.getLoginActivity();
    });
  }

  IconData _deviceIcon(String value) {
    final lower = value.toLowerCase();
    if (lower.contains('phone') || lower.contains('mobile')) {
      return Icons.smartphone_rounded;
    } else if (lower.contains('tablet') || lower.contains('pad')) {
      return Icons.tablet_rounded;
    } else {
      return Icons.laptop_mac_rounded;
    }
  }

  String _deviceLabel(String device, String lang) {
    final lower = device.toLowerCase();
    if (lower.contains('phone') || lower.contains('mobile')) {
      return tr('mobile_phone', lang);
    } else if (lower.contains('tablet') || lower.contains('pad')) {
      return tr('tablet_device', lang);
    } else {
      return tr('laptop_computer', lang);
    }
  }

  String _dateLabel(dynamic value) {
    final parsed = DateTime.tryParse(value?.toString() ?? '');
    if (parsed == null) return value?.toString() ?? '-';
    final local = parsed.toLocal();
    String two(int number) => number.toString().padLeft(2, '0');
    return '${local.year}-${two(local.month)}-${two(local.day)} ${two(local.hour)}:${two(local.minute)}';
  }

  Future<void> _confirmRevoke(String activityId, String lang) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('log_out_device', lang)),
        content: Text(tr('log_out_device_confirm', lang)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(tr('cancel', lang)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(tr('log_out', lang)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      setState(() => _isRevoking = true);
      final ok = await ApiService.revokeLoginActivity(activityId);
      if (mounted) {
        setState(() => _isRevoking = false);
        if (ok) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(tr('device_logged_out', lang)), backgroundColor: Colors.green),
          );
          _refresh();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to log out device.'), backgroundColor: Colors.redAccent),
          );
        }
      }
    }
  }

  Future<void> _confirmRevokeAllOthers(String lang) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('log_out_all_other_devices', lang)),
        content: Text(tr('log_out_all_other_confirm', lang)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(tr('cancel', lang)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(tr('log_out', lang)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      setState(() => _isRevoking = true);
      final ok = await ApiService.revokeOtherLoginActivities();
      if (mounted) {
        setState(() => _isRevoking = false);
        if (ok) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(tr('all_other_devices_logged_out', lang)), backgroundColor: Colors.green),
          );
          _refresh();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to log out other devices.'), backgroundColor: Colors.redAccent),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = Provider.of<LanguageProvider>(context).currentLanguage;
    final colors = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(tr('login_activity', lang)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _isRevoking ? null : _refresh,
          ),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _activityFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting || _isRevoking) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text(tr('login_activity_error', lang)));
          }
          final activities = snapshot.data ?? [];
          if (activities.isEmpty) {
            return Center(child: Text(tr('no_login_activity', lang)));
          }

          final hasOtherActive = activities.any(
            (a) => a['current'] != true && a['revoked'] != true,
          );

          return RefreshIndicator(
            onRefresh: () async {
              _refresh();
              await _activityFuture;
            },
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (hasOtherActive)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.redAccent,
                        side: const BorderSide(color: Colors.redAccent),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                      ),
                      icon: const Icon(Icons.power_settings_new_rounded, size: 20),
                      label: Text(tr('log_out_all_other_devices', lang), style: const TextStyle(fontWeight: FontWeight.w700)),
                      onPressed: () => _confirmRevokeAllOthers(lang),
                    ),
                  ),
                ...activities.map((activity) {
                  final current = activity['current'] == true;
                  final revoked = activity['revoked'] == true;
                  final activityId = activity['activity_id']?.toString() ?? '';
                  final device = activity['device_type']?.toString() ?? 'Unknown';
                  final browser = activity['browser']?.toString() ?? 'Unknown';
                  final platform = activity['platform']?.toString() ?? 'Unknown';

                  Widget trailingWidget;
                  if (current) {
                    trailingWidget = Text(
                      tr('this_device', lang),
                      style: TextStyle(color: Colors.green.shade700, fontSize: 12, fontWeight: FontWeight.w700),
                    );
                  } else if (revoked) {
                    trailingWidget = Text(
                      tr('signed_out', lang),
                      style: const TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w600),
                    );
                  } else {
                    trailingWidget = TextButton.icon(
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.redAccent,
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      ),
                      icon: const Icon(Icons.logout_rounded, size: 16),
                      label: Text(tr('log_out', lang), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      onPressed: () => _confirmRevoke(activityId, lang),
                    );
                  }

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Card(
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        leading: CircleAvatar(
                          backgroundColor: revoked
                              ? Colors.grey.withValues(alpha: 0.12)
                              : colors.primary.withValues(alpha: 0.12),
                          foregroundColor: revoked ? Colors.grey : colors.primary,
                          child: Icon(_deviceIcon(device)),
                        ),
                        title: Text(
                          '${_deviceLabel(device, lang)} · $browser · $platform',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: revoked ? Colors.grey : null,
                          ),
                        ),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 5),
                          child: Text('${activity['ip_address'] ?? '-'}\n${_dateLabel(activity['created_at'])}'),
                        ),
                        trailing: trailingWidget,
                      ),
                    ),
                  );
                }),
              ],
            ),
          );
        },
      ),
    );
  }
}
