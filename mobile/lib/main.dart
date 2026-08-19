import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/farmer_dashboard_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
              ],
      child: const AgriApp(),
    ),
  );
}

class AgriApp extends StatefulWidget {
  const AgriApp({super.key});

  @override
  State<AgriApp> createState() => _AgriAppState();
}

class _AgriAppState extends State<AgriApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AuthProvider>(context, listen: false).checkAuthStatus();
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
          title: 'Agri System',
          debugShowCheckedModeBanner: false,
        themeMode: ThemeMode.light,
          theme: _buildTheme(Brightness.light, context),
          darkTheme: _buildTheme(Brightness.dark, context),
        home: Consumer<AuthProvider>(
            builder: (context, auth, _) {
              if (auth.isLoading && auth.user == null) {
                return const Scaffold(
                  body: Center(child: CircularProgressIndicator()),
                );
              }
              if (auth.isAuthenticated) {
                return const FarmerDashboardScreen();
              }
              return const LoginScreen();
            },
          ),
        );
  }

  ThemeData _buildTheme(Brightness brightness, BuildContext context) {
    final isDark = brightness == Brightness.dark;
    
    // Core Colors
    final primary = const Color(0xFF1B5E20);
    final secondary = const Color(0xFF4CAF50);
    final background = isDark ? const Color(0xFF121212) : const Color(0xFFF8FAFC);
    final surface = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final text = isDark ? const Color(0xFFE2E8F0) : const Color(0xFF0F172A);
    final textMuted = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final inputFill = isDark ? const Color(0xFF2D2D2D) : const Color(0xFFF1F5F9);

    return ThemeData(
      brightness: brightness,
      scaffoldBackgroundColor: background,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        brightness: brightness,
        primary: primary,
        secondary: secondary,
        surface: surface,
      ),
      useMaterial3: true,
      textTheme: GoogleFonts.interTextTheme(ThemeData(brightness: brightness).textTheme).apply(
        bodyColor: text,
        displayColor: text,
      ),
      appBarTheme: AppBarTheme(
        centerTitle: true,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: surface,
        foregroundColor: text,
        iconTheme: IconThemeData(color: text),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: inputFill,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: primary, width: 1.5),
        ),
        labelStyle: TextStyle(color: textMuted),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: isDark ? 2 : 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: isDark ? BorderSide.none : BorderSide(color: Colors.grey.withOpacity(0.1)),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
    );
  }
}
