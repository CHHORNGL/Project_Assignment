import '../mobile/lib/services/session_cookie.dart';

void main() {
  final cases = <String, String?>{
    'session=new-id; Secure; HttpOnly; SameSite=None': 'session=new-id',
    'remember_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/, session=rotated-id; Secure': 'session=rotated-id',
    'session=; Max-Age=0; Path=/': 'session=',
    'remember_token=; Max-Age=0': null,
  };
  for (final entry in cases.entries) {
    if (sessionCookieHeader(entry.key) != entry.value) {
      throw StateError('Session cookie parsing failed');
    }
  }
  print('All 4 session cookie parsing cases passed.');
}
