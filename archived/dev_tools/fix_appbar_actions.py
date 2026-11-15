import re

dash_path = "mobile/lib/screens/farmer_dashboard_screen.dart"
with open(dash_path, "r") as f:
    dash_code = f.read()

appbar_regex = r'        actions: \[\n\s+Consumer<ThemeProvider>\(.*?\),\n\s+SizedBox\(width: 8\),\n\s+\],\n'
dash_code = re.sub(appbar_regex, '', dash_code, flags=re.DOTALL)

with open(dash_path, "w") as f:
    f.write(dash_code)
