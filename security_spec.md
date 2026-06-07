# Security Specification: Vaishnavi Enterprise CRM

## data Invariants
1. Only `vaishnavienterprise.print@gmail.com` is allowed to access any CRM database resources.
2. The email of the user MUST be verified in Firebase Auth (`request.auth.token.email_verified == true`).
3. All writes must authenticate with Firebase Auth and match the Authorized user.
4. Timestamps (`createdAt`, `updatedAt`) should be securely set and not spoofed by the client.
5. Path IDs must be valid alphanumeric/dash identifiers.

## The Dirty Dozen Payloads (Expected to return PERMISSION_DENIED)
1. **Unauthenticated Read**: Any request to list leads without an active session.
2. **Unauthenticated Write**: Creating a lead without signing in.
3. **Spoofed Email Read**: Request as standard user `attacker@gmail.com` trying to read leads.
4. **Spoofed Email Write**: Creating a lead with email `vaishnavienterprise.print@gmail.com` but `email_verified` as `false`.
5. **Wrong Owner ID**: Creating a lead with `ownerId` set to a different UID than `request.auth.uid`.
6. **Malicious ID Injection**: Creating a lead with a 1.5KB junk string document ID.
7. **Junk Field Creation**: Creating a lead with an unwhitelisted field `isVerifiedAdmin: true`.
8. **Malicious Notes Overflow**: Writing a note with size larger than 50KB to cause wallet exhaustion.
9. **Status Shortcutting**: Directly modifying the status of a lead to 'Won' while bypassing validation logic using direct Client SDK manipulation without validation rules.
10. **Timestamp Manipulation**: Force-feeding client-side `createdAt` values that don't match `request.time`.
11. **Quotation Rate Tampering**: Writing quotation with a negative rate.
12. **Subcollection Orphanage**: Creating a followup under a nonexistent lead or with a spoofed leadID.

## Rules Design
We implement a unified Master Gate strategy:
- `isAuthorizedUser()` validates the email, email verification status, and existence of user context.
- Validation functions block shadow fields and enforce proper type checks.
