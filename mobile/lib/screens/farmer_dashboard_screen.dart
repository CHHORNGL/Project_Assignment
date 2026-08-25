import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/language_provider.dart';
import '../utils/translations.dart';
import 'login_screen.dart';
import 'crop_knowledge_base_screen.dart';
import 'history_screen.dart';
import 'crop_scan_screen.dart';
import 'edit_profile_screen.dart';
import 'notifications_screen.dart';
import 'language_screen.dart';
import 'help_center_screen.dart';
import 'about_screen.dart';
import '../services/api_service.dart';
import 'chat_screen.dart';
import 'ai_settings_screen.dart';
import 'manual_diagnosis_screen.dart';

class FarmerDashboardScreen extends StatefulWidget {
  const FarmerDashboardScreen({super.key});

  @override
  State<FarmerDashboardScreen> createState() => _FarmerDashboardScreenState();
}

class _FarmerDashboardScreenState extends State<FarmerDashboardScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const _DashboardView(),
    const CropScanScreen(),
    const CropKnowledgeBaseScreen(),
    const _ProfileView(),
  ];

  @override
  Widget build(BuildContext context) {
    final lang = Provider.of<LanguageProvider>(context).currentLanguage;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
      extendBody: true,
      appBar: AppBar(
        title: Image.asset(
          'assets/images/logo.jpg',
          height: 40,
        ),
        centerTitle: true,
        elevation: 0,
      ),
      body: _screens[_currentIndex],
      bottomNavigationBar: SafeArea(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(40),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildNavItem(icon: Icons.home_rounded, label: tr('home', lang), index: 0),
              _buildNavItem(icon: Icons.document_scanner_rounded, label: tr('scan', lang), index: 1),
              _buildNavItem(icon: Icons.menu_book_rounded, label: tr('crops', lang), index: 2),
              _buildNavItem(icon: Icons.person_rounded, label: tr('profile', lang), index: 3),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({required IconData icon, required String label, required int index}) {
    final isSelected = _currentIndex == index;
    return GestureDetector(
      onTap: () {
        setState(() {
          _currentIndex = index;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.symmetric(horizontal: isSelected ? 16 : 12, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? Theme.of(context).colorScheme.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(30),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected ? Colors.white : Theme.of(context).colorScheme.onSurfaceVariant,
              size: 24,
            ),
            if (isSelected) ...[
              SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ).animate().fade().slideX(begin: 0.2),
            ]
          ],
        ),
      ),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView();

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).user;
    final lang = Provider.of<LanguageProvider>(context).currentLanguage;
    
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(height: 8),
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr('welcome_back', lang),
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 14, fontWeight: FontWeight.w600),
                    ).animate().fade(duration: 400.ms).slideX(begin: -0.1),
                    SizedBox(height: 4),
                    Text(
                      user?.username ?? tr('farmer', lang),
                      style: TextStyle(
                        fontSize: 28, 
                        fontWeight: FontWeight.w800, 
                        color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87,
                        letterSpacing: -0.5,
                      ),
                    ).animate().fade(delay: 100.ms).slideX(begin: -0.1),
                  ],
                ),
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 10, offset: const Offset(0, 4)),
                    ],
                  ),
                  child: CircleAvatar(
                    radius: 26,
                    backgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                    backgroundImage: user?.id != null 
                        ? NetworkImage('${ApiService.baseUrl.replaceAll('/api', '/users')}/avatar/${user!.id}') 
                        : null,
                    child: user?.id == null 
                        ? Text(user?.username.substring(0, 1).toUpperCase() ?? 'F', style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold, fontSize: 20))
                        : null,
                  ),
                ).animate().fade(delay: 200.ms).scale(),
              ],
            ),
            
            SizedBox(height: 36),
            
            // Weather / Status Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Theme.of(context).dividerColor, width: 1.5),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 15, offset: const Offset(0, 5)),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.blue.shade50, shape: BoxShape.circle),
                    child: Icon(Icons.wb_sunny_outlined, size: 28, color: Colors.blue.shade600),
                  ),
                  SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(tr('farm_status', lang), style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13, fontWeight: FontWeight.w600)),
                        SizedBox(height: 4),
                        Text(tr('optimal_conditions', lang), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87)),
                      ],
                    ),
                  ),
                ],
              ),
            ).animate().fade(delay: 300.ms).slideY(begin: 0.1),
            
            SizedBox(height: 40),
            
            Text(
              tr('operations', lang), 
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87, letterSpacing: -0.3)
            ).animate().fade(delay: 400.ms),
            
            SizedBox(height: 16),
            
            Row(
              children: [
                Expanded(
                  child: _QuickActionButton(
                    icon: Icons.document_scanner_outlined,
                    label: tr('new_scan', lang),
                    iconColor: Colors.green,
                    onTap: () {
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CropScanScreen()));
                    },
                  ).animate().fade(delay: 500.ms).scale(curve: Curves.easeOutBack),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: _QuickActionButton(
                    icon: Icons.checklist_rtl_rounded,
                    label: tr('manual_diagnosis', lang),
                    iconColor: Colors.orange,
                    onTap: () {
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => ManualDiagnosisScreen()));
                    },
                  ).animate().fade(delay: 550.ms).scale(curve: Curves.easeOutBack),
                ),
              ],
            ),
            SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _QuickActionButton(
                    icon: Icons.history_rounded,
                    label: tr('history', lang),
                    iconColor: Colors.blue,
                    onTap: () {
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const HistoryScreen()));
                    },
                  ).animate().fade(delay: 600.ms).scale(curve: Curves.easeOutBack),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: _QuickActionButton(
                    icon: Icons.chat_bubble_outline_rounded,
                    label: tr('expert_chat', lang),
                    iconColor: Colors.purple,
                    onTap: () {
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChatScreen()));
                    },
                  ).animate().fade(delay: 650.ms).scale(curve: Curves.easeOutBack),
                ),
              ],
            ),
            SizedBox(height: 100), // padding for bottom nav
          ],
        ),
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color iconColor;
  final VoidCallback onTap;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.iconColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Theme.of(context).dividerColor, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 15,
              offset: const Offset(0, 5),
            )
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 28, color: iconColor),
            ),
            SizedBox(height: 20),
            Text(
              label, 
              style: TextStyle(
                fontWeight: FontWeight.w700, 
                fontSize: 15, 
                color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87,
                letterSpacing: -0.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileView extends StatefulWidget {
  const _ProfileView();

  @override
  State<_ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<_ProfileView> {
  int _unreadNotifications = 0;

  @override
  void initState() {
    super.initState();
    _loadUnreadCount();
  }

  Future<void> _loadUnreadCount() async {
    final count = await ApiService.getUnreadNotificationsCount();
    if (mounted) setState(() => _unreadNotifications = count);
  }

  void _openNotifications() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const NotificationsScreen()),
    );
    _loadUnreadCount();
  }

  @override
  Widget build(BuildContext context) {
    final lang = Provider.of<LanguageProvider>(context).currentLanguage;
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.user;

    return SingleChildScrollView(
      child: Column(
        children: [
          SizedBox(height: 24),
          // Professional Profile Card
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.green.shade800, Colors.green.shade500],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(32),
                boxShadow: [
                  BoxShadow(color: Colors.green.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 10)),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.2),
                    ),
                    child: CircleAvatar(
                      radius: 40,
                      backgroundColor: Colors.white,
                      backgroundImage: user?.id != null 
                          ? NetworkImage('${ApiService.baseUrl.replaceAll('/api', '/users')}/avatar/${user!.id}') 
                          : null,
                      child: user?.id == null ? Text(
                        user?.username.substring(0, 1).toUpperCase() ?? 'F',
                        style: TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          color: Colors.green.shade700,
                        ),
                      ) : const SizedBox.shrink(),
                    ),
                  ),
                  SizedBox(width: 20),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.username ?? tr('farmer', lang),
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          user?.email ?? 'farmer@agrisystem.com',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.9), 
                            fontSize: 14
                          ),
                        ),
                        SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.verified, color: Colors.white, size: 16),
                              SizedBox(width: 6),
                              Text(
                                tr('verified_farmer', lang),
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ).animate().fade(duration: 500.ms).slideY(begin: 0.1),
          ),
          
          SizedBox(height: 40),
          
          // Menu Settings
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr('account_settings', lang),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    letterSpacing: 0.5,
                  ),
                ).animate().fade(delay: 200.ms),
                SizedBox(height: 16),
                
                // Group 1
                Container(
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Theme.of(context).dividerColor, width: 1.5),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 15, offset: const Offset(0, 5)),
                    ],
                  ),
                  child: Column(
                    children: [
                      _buildSettingsTile(
                        context,
                        icon: Icons.person_outline,
                        title: tr('edit_profile', lang),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EditProfileScreen())),
                      ),
                      Divider(height: 1, color: Theme.of(context).colorScheme.surfaceContainerHighest, indent: 64),
                      _buildSwitchTile(
                        context,
                        icon: Icons.security,
                        title: 'Two-Step Verification (2FA)',
                        value: user?.twoFactorEnabled ?? false,
                        onChanged: (bool value) async {
                          final success = await ApiService.toggle2FA(value);
                          if (success) {
                            await authProvider.checkAuthStatus();
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('2FA ${value ? 'enabled' : 'disabled'} successfully!')),
                              );
                            }
                          } else {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Failed to update 2FA setting.'), backgroundColor: Colors.red),
                              );
                            }
                          }
                        },
                      ),
                      Divider(height: 1, color: Theme.of(context).colorScheme.surfaceContainerHighest, indent: 64),
                      _buildSettingsTile(
                        context,
                        icon: Icons.notifications_none,
                        title: tr('notifications', lang),
                        trailing: _unreadNotifications > 0
                            ? Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: Colors.red,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  _unreadNotifications > 99 ? '99+' : '$_unreadNotifications',
                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              )
                            : null,
                        onTap: _openNotifications,
                      ),
                      Divider(height: 1, color: Theme.of(context).colorScheme.surfaceContainerHighest, indent: 64),
                      _buildSettingsTile(
                        context,
                        icon: Icons.language,
                        title: tr('language', lang),
                        trailing: Text(tr(lang == 'km' ? 'khmer' : 'english', lang), style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 14, fontWeight: FontWeight.w500)),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LanguageScreen())),
                      ),
                      Divider(height: 1, color: Theme.of(context).colorScheme.surfaceContainerHighest, indent: 64),
                      _buildSettingsTile(
                        context,
                        icon: Icons.smart_toy_outlined,
                        title: tr('ai_settings', lang),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AISettingsScreen())),
                      ),
                    ],
                  ),
                ).animate().fade(delay: 300.ms).slideY(begin: 0.1),
                
                SizedBox(height: 32),
                Text(
                  tr('support', lang),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    letterSpacing: 0.5,
                  ),
                ).animate().fade(delay: 400.ms),
                SizedBox(height: 16),
                
                // Group 2
                Container(
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Theme.of(context).dividerColor, width: 1.5),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 15, offset: const Offset(0, 5)),
                    ],
                  ),
                  child: Column(
                    children: [
                      _buildSettingsTile(
                        context,
                        icon: Icons.help_outline,
                        title: tr('help_center', lang),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HelpCenterScreen())),
                      ),
                      Divider(height: 1, color: Theme.of(context).colorScheme.surfaceContainerHighest, indent: 64),
                      _buildSettingsTile(
                        context,
                        icon: Icons.info_outline,
                        title: tr('about', lang),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AboutScreen())),
                      ),
                    ],
                  ),
                ).animate().fade(delay: 500.ms).slideY(begin: 0.1),
                
                SizedBox(height: 48),
                
                SizedBox(
                  width: double.infinity,
                  height: 60,
                  child: TextButton.icon(
                    onPressed: () async {
                      await authProvider.logout();
                      if (context.mounted) {
                        Navigator.of(context).pushReplacement(
                          MaterialPageRoute(builder: (_) => const LoginScreen()),
                        );
                      }
                    },
                    icon: const Icon(Icons.logout, size: 22),
                    label: Text(tr('log_out', lang), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.red.shade600,
                      backgroundColor: Colors.red.shade50,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    ),
                  ),
                ).animate().fade(delay: 600.ms).slideY(begin: 0.1),
                
                SizedBox(height: 120), // Padding for bottom nav bar
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSwitchTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: Theme.of(context).colorScheme.primary, size: 22),
          ),
          SizedBox(width: 16),
          Expanded(
            child: Text(
              title,
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87),
            ),
          ),
          Switch(
            value: value,
            activeColor: Theme.of(context).colorScheme.primary,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    Widget? trailing,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: Theme.of(context).colorScheme.primary, size: 22),
              ),
              SizedBox(width: 16),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87),
                ),
              ),
              if (trailing != null) ...[
                trailing,
                SizedBox(width: 8),
              ],
              Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.26), size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
