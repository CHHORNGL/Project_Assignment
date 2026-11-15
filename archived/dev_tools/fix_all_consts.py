import os

files = [
    "mobile/lib/screens/farmer_dashboard_screen.dart",
    "mobile/lib/screens/history_screen.dart",
    "mobile/lib/screens/manual_diagnosis_screen.dart",
    "mobile/lib/screens/crop_scan_screen.dart",
    "mobile/lib/screens/login_screen.dart"
]

for path in files:
    if os.path.exists(path):
        with open(path, "r") as f:
            content = f.read()
        
        # Strip const from TextStyle
        content = content.replace('const TextStyle(', 'TextStyle(')
        
        # Strip const from Text
        content = content.replace('const Text(', 'Text(')

        with open(path, "w") as f:
            f.write(content)
