with open("mobile/lib/screens/farmer_dashboard_screen.dart", "r") as f:
    text = f.read()

bad_block = """      appBar: AppBar(
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
      ),
        centerTitle: true,
        
        elevation: 0,
      ),"""

good_block = """      appBar: AppBar(
        title: Image.asset(
          'assets/images/logo.jpg',
          height: 40,
        ),
        centerTitle: true,
        elevation: 0,
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

text = text.replace(bad_block, good_block)
with open("mobile/lib/screens/farmer_dashboard_screen.dart", "w") as f:
    f.write(text)
