import re
import os

# 1. Revert main.dart
main_dart_path = "mobile/lib/main.dart"
with open(main_dart_path, "r") as f:
    main_code = f.read()

# Remove theme_provider import
main_code = main_code.replace("import 'providers/theme_provider.dart';\n", "")
main_code = main_code.replace("ChangeNotifierProvider(create: (_) => ThemeProvider()),\n", "")

# Remove Consumer<ThemeProvider> wrapper around MaterialApp
main_code = re.sub(r'return Consumer<ThemeProvider>\(\n\s+builder: \(context, themeProvider, child\) \{\n\s+return MaterialApp\(', 'return MaterialApp(', main_code)
main_code = main_code.replace('          themeMode: themeProvider.themeMode,', '        themeMode: ThemeMode.light,')
main_code = re.sub(r'          home: Consumer<AuthProvider>\(', '        home: Consumer<AuthProvider>(', main_code)
# Remove the closing brackets for the Consumer
main_code = main_code.replace("""        );
      },
    );
  }""", """        );
  }""")

# 2. Revert farmer_dashboard_screen.dart AppBar
dash_path = "mobile/lib/screens/farmer_dashboard_screen.dart"
with open(dash_path, "r") as f:
    dash_code = f.read()

dash_code = dash_code.replace("import '../providers/theme_provider.dart';\n", "")

appbar_regex = r'        actions: \[\n\s+Consumer<ThemeProvider>\(.*?const SizedBox\(width: 8\),\n\s+\],\n'
dash_code = re.sub(appbar_regex, '', dash_code, flags=re.DOTALL)

with open(main_dart_path, "w") as f:
    f.write(main_code)

with open(dash_path, "w") as f:
    f.write(dash_code)

# 3. Delete ThemeProvider
if os.path.exists("mobile/lib/providers/theme_provider.dart"):
    os.remove("mobile/lib/providers/theme_provider.dart")

