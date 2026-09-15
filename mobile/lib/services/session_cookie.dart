/// Extract only the session cookie, including from combined Set-Cookie headers.
String? sessionCookieHeader(String rawCookie) {
  final match = RegExp(r'(?:^|,\s*)session=([^;,\s]*)').firstMatch(rawCookie);
  if (match == null) return null;
  return 'session=${match.group(1)!}';
}
