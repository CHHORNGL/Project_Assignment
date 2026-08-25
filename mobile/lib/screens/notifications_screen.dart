import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/language_provider.dart';
import '../services/api_service.dart';
import '../utils/translations.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _isLoading = true;
  bool _isLoadingMore = false;
  List<dynamic> _notifications = [];
  int? _nextPage;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        !_isLoadingMore &&
        _nextPage != null) {
      _loadMore();
    }
  }

  Future<void> _fetchNotifications() async {
    setState(() => _isLoading = true);
    final data = await ApiService.getNotifications();
    final items = data['items'] as List<dynamic>;
    setState(() {
      _notifications = items;
      _nextPage = data['nextPage'];
      _isLoading = false;
    });
    _markVisibleAsSeen(items);
  }

  Future<void> _loadMore() async {
    if (_nextPage == null) return;
    setState(() => _isLoadingMore = true);
    final data = await ApiService.getNotifications(page: _nextPage!);
    final items = data['items'] as List<dynamic>;
    setState(() {
      _notifications.addAll(items);
      _nextPage = data['nextPage'];
      _isLoadingMore = false;
    });
    _markVisibleAsSeen(items);
  }

  Future<void> _markVisibleAsSeen(List<dynamic> items) async {
    final unreadIds = items
        .where((n) => n['unread'] == true && n['id'] != null)
        .map<int>((n) => n['id'] as int)
        .toList();
    if (unreadIds.isEmpty) return;
    await ApiService.markNotificationsSeen(unreadIds);
  }

  String _localizeTime(String time, String lang) {
    if (lang != 'km') return time;
    return time
        .replaceFirst('Just now', 'មុននេះបន្តិច')
        .replaceFirst('Yesterday', 'ម្សិលមិញ');
  }

  IconData _iconFor(Map<String, dynamic> item) {
    final icon = (item['icon'] as String?) ?? '';
    if (icon.contains('check-circle')) return Icons.check_circle_outline;
    if (icon.contains('times-circle')) return Icons.cancel_outlined;
    if (icon.contains('comment')) return Icons.chat_bubble_outline;
    if (icon.contains('seedling') || icon.contains('notes-medical')) {
      return Icons.eco_outlined;
    }
    if (icon.contains('life-ring')) return Icons.support_agent_outlined;
    switch (item['level']) {
      case 'success':
        return Icons.check_circle_outline;
      case 'warning':
        return Icons.warning_amber_outlined;
      case 'danger':
        return Icons.error_outline;
      default:
        return Icons.notifications_none;
    }
  }

  Color _colorFor(Map<String, dynamic> item) {
    switch (item['level']) {
      case 'success':
        return Colors.green.shade600;
      case 'warning':
        return Colors.orange.shade700;
      case 'danger':
        return Colors.red.shade600;
      default:
        return Colors.blue.shade700;
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = Provider.of<LanguageProvider>(context).currentLanguage;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
      appBar: AppBar(
        title: Text(
          tr('notifications', lang),
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Theme.of(context).colorScheme.surface,
        elevation: 0,
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
              ? _buildEmptyState(lang)
              : RefreshIndicator(
                  onRefresh: _fetchNotifications,
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount:
                        _notifications.length + (_nextPage != null ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index >= _notifications.length) {
                        return _buildLoadMoreIndicator();
                      }
                      final item = _notifications[index];
                      final isUnread = item['unread'] == true;
                      final color = _colorFor(item);
                      return _buildNotificationItem(
                        item,
                        color,
                        isUnread,
                        lang,
                      ).animate().fade(delay: (40 * index).ms).slideX(begin: 0.1);
                    },
                  ),
                ),
    );
  }

  Widget _buildLoadMoreIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: _isLoadingMore
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              )
            : TextButton.icon(
                onPressed: _loadMore,
                icon: const Icon(Icons.expand_more),
                label: const Text('Load more'),
              ),
      ),
    );
  }

  Widget _buildEmptyState(String lang) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.notifications_none,
              size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(
            lang == 'km' ? 'មិនមានការជូនដំណឹងទេ' : 'No notifications yet',
            style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade700),
          ),
          const SizedBox(height: 8),
          Text(
            lang == 'km'
                ? 'អ្នកបានអានគ្រប់ចប់ហើយ!'
                : 'You\'re all caught up!',
            style: TextStyle(color: Colors.grey.shade500),
          ),
        ],
      ).animate().fade().scale(),
    );
  }

  Widget _buildNotificationItem(
      Map<String, dynamic> item, Color color, bool isUnread, String lang) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isUnread ? color.withValues(alpha: 0.06) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isUnread ? color.withValues(alpha: 0.3) : Colors.grey.shade200,
        ),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isUnread
              ? color.withValues(alpha: 0.15)
              : Colors.grey.shade100,
          child: Icon(_iconFor(item),
              color: isUnread ? color : Colors.grey.shade600, size: 22),
        ),
        title: Text(
          item['title'] ?? 'Notification',
          style: TextStyle(
              fontWeight: isUnread ? FontWeight.bold : FontWeight.normal),
        ),
        subtitle: (item['subtitle'] ?? '').toString().isNotEmpty
            ? Text(
                item['subtitle'],
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              )
            : null,
        trailing: Text(
          _localizeTime((item['time'] ?? '').toString(), lang),
          style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
        ),
      ),
    );
  }
}
