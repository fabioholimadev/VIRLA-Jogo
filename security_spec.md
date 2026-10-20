# Security Specification: VIRLA — Guardiões do Cuidado

## Data Invariants
1. User profile can only be read and written by the authenticated user whose `request.auth.uid` matches the document path `{userId}` or where `resource.data.googleId == request.auth.uid`.
2. Admin documents under `/admins/{adminId}` can only be read/modified by verified admins.
3. Game results can be written by authenticated users for their own score submission, or by authorized server/admin.
4. Emails and Google private data must never be publicly readable by other users.
5. Catch-all deny for all other paths.

## The Dirty Dozen Payloads (Expected: PERMISSION_DENIED)
1. Anonymous user attempting to read `/users/target_user` -> PERMISSION_DENIED.
2. Authenticated user A attempting to write `/users/target_user_B` -> PERMISSION_DENIED.
3. Authenticated user attempting to modify `/admins/target_admin` -> PERMISSION_DENIED.
4. Injection of extra arbitrary keys on UserProfile -> PERMISSION_DENIED.
5. Client setting nickname greater than 16 characters -> PERMISSION_DENIED.
6. Spoofing admin by tampering client token claims -> PERMISSION_DENIED.
7. Unauthenticated user listing `/users` -> PERMISSION_DENIED.
8. Writing negative scores into `/game_results` -> PERMISSION_DENIED.
9. Writing invalid characterIndex (< 0 or > 2) -> PERMISSION_DENIED.
10. Attempting to bypass security rules without email verification where required -> PERMISSION_DENIED.
11. Reading private email addresses from other participants -> PERMISSION_DENIED.
12. Attempting arbitrary document creation on unknown collection -> PERMISSION_DENIED.
