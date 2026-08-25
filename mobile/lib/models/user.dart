class User {
  final int id;
  final String username;
  final String email;
  final List<String> roles;
  final String? aiModel;
  final String? aiApiKey;
  final String? googleSub;
  final bool twoFactorEnabled;
  final bool hasPassword;

  User({
    required this.id,
    required this.username,
    required this.email,
    required this.roles,
    this.aiModel,
    this.aiApiKey,
    this.googleSub,
    this.twoFactorEnabled = false,
    this.hasPassword = false,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      username: json['username'],
      email: json['email'] ?? '',
      roles: List<String>.from(json['roles'] ?? []),
      aiModel: json['ai_model'],
      aiApiKey: json['ai_api_key'],
      googleSub: json['google_sub'],
      twoFactorEnabled: json['two_factor_enabled'] ?? false,
      hasPassword: json['has_password'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'roles': roles,
      'ai_model': aiModel,
      'ai_api_key': aiApiKey,
      'google_sub': googleSub,
      'two_factor_enabled': twoFactorEnabled,
      'has_password': hasPassword,
    };
  }

  bool get isFarmer => roles.contains('farmer');
  bool get isAdmin => roles.contains('admin');
}
