import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/language_provider.dart';
import '../services/api_service.dart';
import '../utils/translations.dart';

class HelpCenterScreen extends StatefulWidget {
  const HelpCenterScreen({super.key});

  @override
  State<HelpCenterScreen> createState() => _HelpCenterScreenState();
}

class _HelpCenterScreenState extends State<HelpCenterScreen> {
  static const String facebookUrl = 'https://web.facebook.com/seavik1221';
  static const String telegramUrl = 'https://t.me/CHRNGL1';

  final TextEditingController _messageController = TextEditingController();
  final FocusNode _messageFocus = FocusNode();
  bool _submitting = false;

  @override
  void dispose() {
    _messageController.dispose();
    _messageFocus.dispose();
    super.dispose();
  }

  void _showSnack(String message, {required bool error}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Colors.red.shade600 : Colors.green.shade700,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _openLink(String url) async {
    final Uri uri = Uri.parse(url);
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok) _showSnack(tr('link_err', _lang), error: true);
    } catch (_) {
      _showSnack(tr('link_err', _lang), error: true);
    }
  }

  String get _lang => Provider.of<LanguageProvider>(context, listen: false).currentLanguage;

  Future<void> _submitToAdmin() async {
    final message = _messageController.text.trim();
    if (message.isEmpty) {
      _showSnack(tr('empty_msg_err', _lang), error: true);
      _messageFocus.requestFocus();
      return;
    }
    setState(() => _submitting = true);
    final ok = await ApiService.submitSupportRequest(message);
    if (!mounted) return;
    setState(() => _submitting = false);
    if (ok) {
      _messageController.clear();
      _showSnack(tr('sent_ok', _lang), error: false);
    } else {
      _showSnack(tr('sent_err', _lang), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = Provider.of<LanguageProvider>(context).currentLanguage;
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(tr('help_center', lang), style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.green.shade800, Colors.green.shade500],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.support_agent_rounded, color: Colors.white, size: 30),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tr('help_center', lang),
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          tr('hc_tagline', lang),
                          style: TextStyle(fontSize: 13, height: 1.3, color: Colors.white.withValues(alpha: 0.9)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ).animate().fade().slideY(begin: 0.1),
            const SizedBox(height: 24),

            // Contact Us
            Text(
              tr('contact_us', lang),
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.grey.shade600, letterSpacing: 0.5),
            ).animate().fade(delay: 100.ms),
            const SizedBox(height: 12),
            _buildContactCard(
              context,
              icon: Icons.facebook_rounded,
              iconColor: const Color(0xFF1877F2),
              title: tr('facebook', lang),
              subtitle: tr('facebook_sub', lang),
              onTap: () => _openLink(facebookUrl),
            ).animate().fade(delay: 150.ms).slideX(begin: 0.1),
            const SizedBox(height: 10),
            _buildContactCard(
              context,
              icon: Icons.telegram_rounded,
              iconColor: const Color(0xFF229ED9),
              title: tr('telegram', lang),
              subtitle: tr('telegram_sub', lang),
              onTap: () => _openLink(telegramUrl),
            ).animate().fade(delay: 200.ms).slideX(begin: 0.1),
            const SizedBox(height: 24),

            // Submit to Admin
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.grey.shade200),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 15, offset: const Offset(0, 5)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(10)),
                        child: Icon(Icons.admin_panel_settings_rounded, color: Colors.orange.shade700, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(tr('submit_to_admin', lang), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                            const SizedBox(height: 2),
                            Text(
                              tr('submit_sub', lang),
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade600, height: 1.3),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _messageController,
                    focusNode: _messageFocus,
                    maxLines: 5,
                    maxLength: 2000,
                    textInputAction: TextInputAction.newline,
                    decoration: InputDecoration(
                      hintText: tr('message_hint', lang),
                      hintStyle: TextStyle(color: Colors.grey.shade400),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      contentPadding: const EdgeInsets.all(14),
                      counterText: '',
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: Colors.grey.shade200),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: Colors.green.shade600, width: 1.5),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton.icon(
                      onPressed: _submitting ? null : _submitToAdmin,
                      icon: _submitting
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.send_rounded, size: 18),
                      label: Text(_submitting ? tr('sending', lang) : tr('send', lang), style: const TextStyle(fontWeight: FontWeight.w700)),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.green.shade700,
                        disabledBackgroundColor: Colors.green.shade300,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                ],
              ),
            ).animate().fade(delay: 250.ms).slideY(begin: 0.1),
            const SizedBox(height: 24),

            // FAQ
            Text(
              tr('faq_title', lang),
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.grey.shade600, letterSpacing: 0.5),
            ).animate().fade(delay: 300.ms),
            const SizedBox(height: 12),
            _buildFaqItem('How do I diagnose a plant?', 'Go to the Scan tab, take a clear photo of the affected leaf, and tap Diagnose Now.')
                .animate().fade(delay: 350.ms).slideX(begin: 0.1),
            _buildFaqItem('What is the Knowledge Base?', 'It is a library of known crop diseases and treatments to help you learn more.')
                .animate().fade(delay: 400.ms).slideX(begin: 0.1),
            _buildFaqItem('How accurate is the AI?', 'The AI is highly trained on agricultural data but should be used as a supplementary tool alongside professional advice.')
                .animate().fade(delay: 450.ms).slideX(begin: 0.1),
          ],
        ),
      ),
    );
  }

  Widget _buildContactCard(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 10, offset: const Offset(0, 4)),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: iconColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, color: iconColor, size: 26),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.black87)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Colors.grey.shade400),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFaqItem(String question, String answer) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: ExpansionTile(
        shape: Border(),
        title: Text(question, style: const TextStyle(fontWeight: FontWeight.w600)),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Text(answer, style: TextStyle(color: Colors.grey.shade700, height: 1.5)),
          ),
        ],
      ),
    );
  }
}
