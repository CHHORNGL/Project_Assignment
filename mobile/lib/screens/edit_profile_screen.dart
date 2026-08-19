import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../providers/auth_provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/api_service.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  bool _isUploading = false;
  int _cacheBuster = DateTime.now().millisecondsSinceEpoch;

  Future<void> _pickAndUploadImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      setState(() => _isUploading = true);
      
      final success = await ApiService.updateProfileAvatar(File(pickedFile.path));
      
      if (mounted) {
        if (success) {
          setState(() {
            _cacheBuster = DateTime.now().millisecondsSinceEpoch;
          });
          await Provider.of<AuthProvider>(context, listen: false).checkAuthStatus();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Profile picture updated successfully!')),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to update profile picture.'), backgroundColor: Colors.red),
          );
        }
        setState(() => _isUploading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).user;
    final avatarUrl = user?.id != null 
        ? '${ApiService.baseUrl.replaceAll('/api', '/users')}/avatar/${user!.id}?v=$_cacheBuster'
        : null;
    
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Edit Profile', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Column(
                  children: [
                    GestureDetector(
                      onTap: _isUploading ? null : _pickAndUploadImage,
                      child: Stack(
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.1),
                                  blurRadius: 15,
                                  offset: const Offset(0, 5),
                                ),
                              ],
                            ),
                            child: CircleAvatar(
                              radius: 60,
                              backgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                              backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl) : null,
                              child: avatarUrl == null 
                                  ? Text(
                                      user?.username.substring(0, 1).toUpperCase() ?? 'F',
                                      style: TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary),
                                    )
                                  : null,
                            ),
                          ),
                          Positioned(
                            bottom: 0,
                            right: 0,
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.primary,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 3),
                              ),
                              child: _isUploading 
                                  ? const SizedBox(
                                      width: 18, height: 18, 
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                                    )
                                  : const Icon(Icons.camera_alt, color: Colors.white, size: 20),
                            ),
                          ),
                        ],
                      ).animate().fade().scale(),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Change Profile Picture',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ).animate().fade(delay: 100.ms),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              if (user?.googleSub != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 24),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.g_mobiledata, size: 32, color: Colors.blue.shade700),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Connected with Google',
                              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.blue.shade900),
                            ),
                            Text(
                              user?.email ?? '',
                              style: TextStyle(color: Colors.blue.shade700, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.check_circle, color: Colors.blue.shade700),
                    ],
                  ),
                ).animate().fade().slideY(begin: 0.1),
              _buildTextField('Username', user?.username ?? '', Icons.person_outline, isReadOnly: true),
              const SizedBox(height: 20),
              _buildTextField('Email Address', user?.email ?? '', Icons.email_outlined, isReadOnly: true),
              const SizedBox(height: 12),
              Text(
                'Note: Account details cannot be changed from the mobile app.',
                style: TextStyle(color: Colors.grey.shade500, fontSize: 12, fontStyle: FontStyle.italic),
              ).animate().fade(),
              const Spacer(),
              SwitchListTile(
                title: const Text('Two-Step Verification (2FA)', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Add an extra layer of security to your account'),
                value: user?.twoFactorEnabled ?? false,
                activeColor: Colors.green.shade600,
                contentPadding: EdgeInsets.zero,
                onChanged: (bool value) async {
                  final success = await ApiService.toggle2FA(value);
                  if (success) {
                    await Provider.of<AuthProvider>(context, listen: false).checkAuthStatus();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('2FA ${value ? 'enabled' : 'disabled'} successfully!')),
                    );
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Failed to update 2FA setting.'), backgroundColor: Colors.red),
                    );
                  }
                },
              ).animate().fade().slideY(begin: 0.1),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile details saved!')));
                    Navigator.pop(context);
                  },
                  child: const Text('Save Changes'),
                ),
              ).animate().fade().slideY(begin: 0.2),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField(String label, String initialValue, IconData icon, {bool isReadOnly = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Colors.black87)),
        const SizedBox(height: 8),
        TextFormField(
          initialValue: initialValue,
          readOnly: isReadOnly,
          style: TextStyle(
            fontSize: 16,
            color: isReadOnly ? Colors.grey.shade700 : Colors.black87,
          ),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: Colors.grey.shade400, size: 22),
            filled: true,
            fillColor: isReadOnly ? Colors.grey.shade100 : Colors.grey.shade50,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.green.shade600, width: 2),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          ),
        ),
      ],
    ).animate().fade().slideX();
  }
}
