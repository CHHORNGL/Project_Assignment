import re

files = [
    "mobile/lib/screens/history_screen.dart",
    "mobile/lib/screens/manual_diagnosis_screen.dart",
    "mobile/lib/screens/login_screen.dart"
]

for file_path in files:
    with open(file_path, "r") as f:
        code = f.read()

    # Replace Scaffold/AppBar background Colors.white
    code = code.replace("backgroundColor: Colors.white,", "")
    
    # Replace Container background Colors.white
    code = re.sub(r'color: Colors\.white,(\s+borderRadius: BorderRadius)', r'color: Theme.of(context).colorScheme.surface,\1', code)
    code = re.sub(r'color: Colors\.white,(\s+boxShadow:)', r'color: Theme.of(context).colorScheme.surface,\1', code)
    code = re.sub(r'color: Colors\.white,(\s+padding:)', r'color: Theme.of(context).colorScheme.surface,\1', code)

    with open(file_path, "w") as f:
        f.write(code)
