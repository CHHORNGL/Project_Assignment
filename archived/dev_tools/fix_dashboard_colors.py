import re

with open("mobile/lib/screens/farmer_dashboard_screen.dart", "r") as f:
    code = f.read()

# Replace Scaffold/AppBar/NavigationBar background Colors.white
code = code.replace("backgroundColor: Colors.white,", "")
code = code.replace("color: Colors.white,", "color: Theme.of(context).colorScheme.surface,")

with open("mobile/lib/screens/farmer_dashboard_screen.dart", "w") as f:
    f.write(code)
