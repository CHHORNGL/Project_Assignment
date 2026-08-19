import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
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
              _buildNavItem(icon: Icons.home_rounded, label: 'Home', index: 0),
              _buildNavItem(icon: Icons.document_scanner_rounded, label: 'Scan', index: 1),
              _buildNavItem(icon: Icons.menu_book_rounded, label: 'Crops', index: 2),
              _buildNavItem(icon: Icons.person_rounded, label: 'Profile', index: 3),
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
                      'Welcome back,',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 14, fontWeight: FontWeight.w600),
                    ).animate().fade(duration: 400.ms).slideX(begin: -0.1),
                    SizedBox(height: 4),
                    Text(
                      user?.username ?? "Farmer",
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
                        Text('Farm Status', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13, fontWeight: FontWeight.w600)),
                        SizedBox(height: 4),
                        Text('Optimal conditions today', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87)),
                      ],
                    ),
                  ),
                ],
              ),
            ).animate().fade(delay: 300.ms).slideY(begin: 0.1),
            
            SizedBox(height: 40),
            
            Text(
              'Operations', 
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87, letterSpacing: -0.3)
            ).animate().fade(delay: 400.ms),
            
            SizedBox(height: 16),
            
            Row(
              children: [
                Expanded(
                  child: _QuickActionButton(
                    icon: Icons.document_scanner_outlined,
                    label: 'New Scan',
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
                    label: 'Manual Diagnosis',
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
                    label: 'History',
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
                    label: 'Expert Chat',
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

class _ProfileView extends StatelessWidget {
  const _ProfileView();

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.user;

    return SingleChildScrollView(
      child: Column(
        children: [
          SizedBox(height: 40),
          // Center Avatar Section
          Center(
            child: Column(
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 20, offset: const Offset(0, 10)),
                    ],
                  ),
                  child: CircleAvatar(
                    radius: 56,
                    backgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                    backgroundImage: user?.id != null 
                        ? NetworkImage('${ApiService.baseUrl.replaceAll('/api', '/users')}/avatar/${user!.id}') 
                        : null,
                    child: user?.id == null ? Text(
                      user?.username.substring(0, 1).toUpperCase() ?? 'F',
                      style: TextStyle(
                        fontSize: 40,
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ) : const SizedBox.shrink(),
                  ),
                ).animate().scale(curve: Curves.easeOutBack, duration: 500.ms),
                SizedBox(height: 24),
                Text(
                  user?.username ?? 'Farmer',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                    color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87,
                  ),
                ).animate().fade(delay: 100.ms).slideY(begin: 0.1),
                SizedBox(height: 6),
                Text(
                  user?.email ?? 'farmer@agrisystem.com',
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 15),
                ).animate().fade(delay: 200.ms).slideY(begin: 0.1),
                SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Verified Farmer',
                    style: TextStyle(
                      color: Colors.blue.shade700,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ).animate().fade(delay: 300.ms).scale(),
              ],
            ),
          ),
          
          SizedBox(height: 48),
          
          // Menu Settings
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Account Settings',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    letterSpacing: 0.5,
                  ),
                ).animate().fade(delay: 400.ms),
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
                        title: 'Edit Profile',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EditProfileScreen())),
                      ),
                      Divider(height: 1, color: Theme.of(context).colorScheme.surfaceContainerHighest, indent: 64),
                      _buildSettingsTile(
                        context,
                        icon: Icons.notifications_none,
                        title: 'Notifications',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen())),
                      ),
                      Divider(height: 1, color: Theme.of(context).colorScheme.surfaceContainerHighest, indent: 64),
                      _buildSettingsTile(
                        context,
                        icon: Icons.language,
                        title: 'Language',
                        trailing: Text('English', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 14, fontWeight: FontWeight.w500)),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LanguageScreen())),
                      ),
                      Divider(height: 1, color: Theme.of(context).colorScheme.surfaceContainerHighest, indent: 64),
                      _buildSettingsTile(
                        context,
                        icon: Icons.smart_toy_outlined,
                        title: 'AI Settings',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AISettingsScreen())),
                      ),
                    ],
                  ),
                ).animate().fade(delay: 500.ms).slideY(begin: 0.1),
                
                SizedBox(height: 32),
                Text(
                  'Support',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    letterSpacing: 0.5,
                  ),
                ).animate().fade(delay: 600.ms),
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
                        title: 'Help Center',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HelpCenterScreen())),
                      ),
                      Divider(height: 1, color: Theme.of(context).colorScheme.surfaceContainerHighest, indent: 64),
                      _buildSettingsTile(
                        context,
                        icon: Icons.info_outline,
                        title: 'About Agri System',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AboutScreen())),
                      ),
                    ],
                  ),
                ).animate().fade(delay: 700.ms).slideY(begin: 0.1),
                
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
                    label: Text('Log Out', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.red.shade600,
                      backgroundColor: Colors.red.shade50,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    ),
                  ),
                ).animate().fade(delay: 800.ms).slideY(begin: 0.1),
                
                SizedBox(height: 120), // Padding for bottom nav bar
              ],
            ),
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
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: Theme.of(context).textTheme.bodyLarge?.color ?? Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87),
                ),
              ),
              if (trailing != null) ...[
                trailing,
                SizedBox(width: 8),
              ],
              Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.26), size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
