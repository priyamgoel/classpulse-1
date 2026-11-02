import 'dart:convert';

/// Returns `true` when [token] is missing, malformed, or its `exp` claim is
/// absent or in the past.
///
/// Only the payload is decoded; the signature is *not* verified. This is a
/// client-side convenience check so the app does not restore a session that
/// the server will reject anyway.
bool isJwtExpired(String? token, {DateTime? now}) {
  if (token == null || token.trim().isEmpty) return true;

  final parts = token.split('.');
  if (parts.length != 3) return true;

  try {
    // JWT payloads are unpadded base64url; normalize adds the required
    // padding and accepts either base64 alphabet.
    final normalized = base64Url.normalize(parts[1]);
    final decoded = utf8.decode(base64Url.decode(normalized));
    final payload = jsonDecode(decoded);
    if (payload is! Map) return true;

    final exp = payload['exp'];
    if (exp is! num) return true;

    final expiresAt = DateTime.fromMillisecondsSinceEpoch(
      (exp * 1000).round(),
      isUtc: true,
    );
    final reference = (now ?? DateTime.now()).toUtc();
    return !expiresAt.isAfter(reference);
  } catch (_) {
    return true;
  }
}
