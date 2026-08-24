with open("mobile/lib/screens/farmer_dashboard_screen.dart", "r") as f:
    text = f.read()

text = text.replace('''                style: const TextStyle(
                  color: Theme.of(context).colorScheme.surface,''', 
                  '''                style: const TextStyle(
                  color: Colors.white,''')

with open("mobile/lib/screens/farmer_dashboard_screen.dart", "w") as f:
    f.write(text)
