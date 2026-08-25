import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1B5E20), // App Primary Color
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Logo Image with Animation
            Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Padding(
                padding: const EdgeInsets.all(4.0), // Slight padding inside circle
                child: ClipOval(
                  child: Image.asset(
                    'assets/images/logo.jpg',
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            )
            .animate()
            .scale(duration: 800.ms, curve: Curves.easeOutBack)
            .fadeIn(duration: 800.ms),
            
            const SizedBox(height: 32),
            
            // App Name with Animation
            Text(
              'Agri System',
              style: GoogleFonts.inter(
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                letterSpacing: 1.5,
              ),
            )
            .animate()
            .slideY(begin: 0.3, end: 0, duration: 600.ms, delay: 300.ms, curve: Curves.easeOutQuint)
            .fadeIn(duration: 600.ms, delay: 300.ms),
            
            const SizedBox(height: 12),
            
            // Subtitle with Animation
            Text(
              'Smart Farming Expert',
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Colors.white.withOpacity(0.8),
                letterSpacing: 2.0,
              ),
            )
            .animate()
            .slideY(begin: 0.3, end: 0, duration: 600.ms, delay: 500.ms, curve: Curves.easeOutQuint)
            .fadeIn(duration: 600.ms, delay: 500.ms),
          ],
        ),
      ),
    );
  }
}
