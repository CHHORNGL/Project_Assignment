import re

with open("mobile/lib/screens/farmer_dashboard_screen.dart", "r") as f:
    code = f.read()

# Add theme provider import if not present
if "providers/theme_provider.dart" not in code:
    code = code.replace("import 'package:provider/provider.dart';", "import 'package:provider/provider.dart';\nimport '../providers/theme_provider.dart';")

# Fix AppBar
appbar_replacement = """      appBar: AppBar(
        title: Image.asset(
          'assets/images/logo.jpg',
          height: 40,
        ),
        centerTitle: true,
        actions: [
          Consumer<ThemeProvider>(
            builder: (context, themeProvider, child) {
              return IconButton(
                icon: Icon(
                  themeProvider.isDarkMode ? Icons.light_mode : Icons.dark_mode,
                  color: Theme.of(context).colorScheme.primary,
                ),
                onPressed: () {
                  themeProvider.toggleTheme();
                },
                tooltip: 'Toggle Dark Mode',
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),"""
code = re.sub(r'      appBar: AppBar\(.*?\),', appbar_replacement, code, flags=re.DOTALL)

# Fix bottom navigation bar hardcoded Colors.white
code = re.sub(r'color: Colors\.white,(\s+)borderRadius: BorderRadius\.circular\(40\),', r'color: Theme.of(context).colorScheme.surface,\1borderRadius: BorderRadius.circular(40),', code)

with open("mobile/lib/screens/farmer_dashboard_screen.dart", "w") as f:
    f.write(code)
