class Crop {
  final int id;
  final String name;
  final String description;
  final String emoji;
  final String color;

  Crop({
    required this.id,
    required this.name,
    required this.description,
    required this.emoji,
    required this.color,
  });

  factory Crop.fromJson(Map<String, dynamic> json) {
    return Crop(
      id: json['id'],
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      emoji: json['emoji'] ?? '🌱',
      color: json['color'] ?? '#10b981',
    );
  }
}
