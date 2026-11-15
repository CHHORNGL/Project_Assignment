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
        
        # Strip const from common wrappers
        content = content.replace('const Center(', 'Center(')
        content = content.replace('const Padding(', 'Padding(')
        content = content.replace('const SizedBox(', 'SizedBox(')
        content = content.replace('const Expanded(', 'Expanded(')

        with open(path, "w") as f:
            f.write(content)
