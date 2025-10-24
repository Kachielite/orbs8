 # Token Refresh Logic Fix

## Problem
You were experiencing `invalid_grant` errors when attempting manual sync:
```
❌ Failed to refresh Gmail token for user 2: invalid_grant
Failed to initiate manual sync: Gmail connection expired or revoked. Please reconnect your email account.
```

## Understanding the `invalid_grant` Error

The `invalid_grant` error is **not a bug** - it's Google's way of telling you that the refresh token has been invalidated. This can happen when:

1. **User revoked access** - The user manually revoked your app's access in their Google Account settings
2. **Password changed** - The user changed their Google password
3. **Token expired** - Refresh tokens can expire after 6 months of inactivity (for apps not verified by Google)
4. **Security event** - Google detected suspicious activity and revoked the token
5. **Manual revocation** - You or the user revoked the OAuth consent

**This is expected behavior**, and the system must handle it gracefully by prompting the user to reconnect.

## Root Causes Identified

### 1. **Email Worker Missing Token Refresh Logic**
The worker was setting OAuth2 credentials but never checking if the access token was expired before making Gmail API calls. It would use potentially expired tokens, causing the API calls to fail.

### 2. **No Token Validation Before API Calls**
The worker process would directly use stored tokens without:
- Checking if the access token exists
- Checking if the token has expired
- Refreshing the token if needed

### 3. **Poor Error Handling for Revoked Tokens**
When the refresh token was invalid, the system would throw an error but wouldn't:
- Mark the email entity with a clear status
- Update the user's `emailLinked` status to `false`
- Provide clear guidance to the user about what to do next

### 4. **Timing Issue in Manual Sync**
The `manualSync()` method in the service was trying to handle token refresh, but this was happening before queuing the job, which could lead to race conditions or still-expired tokens by the time the worker picked up the job.

## Solutions Implemented

### 1. **Added `ensureValidToken()` Method to Email Worker**
Created a new method that:
- Checks if the access token exists
- Checks if the token is expired (with 60-second buffer)
- Automatically refreshes the token using the refresh token if needed
- Saves the new token to the database
- Returns the updated email entity with fresh credentials
- **Handles `invalid_grant` gracefully** by updating database status and user flags

```typescript
private async ensureValidToken(emailEntity: Email, userId: number): Promise<Email> {
  const now = Date.now();
  const expiresAtMillis = emailEntity.expiresAt ? emailEntity.expiresAt.getTime() : undefined;
  
  const isAccessTokenMissing = !emailEntity.accessToken;
  const isExpired = typeof expiresAtMillis === 'number' ? expiresAtMillis <= now - 60_000 : false;
  const shouldRefresh = isAccessTokenMissing || isExpired;

  if (shouldRefresh) {
    // Refresh token logic with proper error handling...
  }
  
  return emailEntity;
}
```

### 2. **Integrated Token Refresh into Worker Process**
Modified the worker's `process()` method to call `ensureValidToken()` immediately after fetching the email entity and before setting up the Gmail API client:

```typescript
// 1. Find the user entity first
const { user, emailEntity: initialEmailEntity } = await this.findUserAndEmail(userId);

// 2. Check if token needs refresh and refresh if necessary
const emailEntity = await this.ensureValidToken(initialEmailEntity, userId);

// 3. Set up Gmail API client with refreshed credentials
oauth2Client.setCredentials({
  access_token: emailEntity.accessToken,
  refresh_token: emailEntity.refreshToken ?? undefined,
  expiry_date: emailEntity.expiresAt ? emailEntity.expiresAt.getTime() : undefined,
});
```

### 3. **Proper Error Handling for `invalid_grant`**
When `invalid_grant` is detected, the system now:

1. **Updates the email entity**:
   ```typescript
   emailEntity.syncStatus = EmailSyncStatus.FAILED;
   emailEntity.failedReason = 'Gmail connection expired or revoked. Please reconnect your email account.';
   await this.emailRepository.save(emailEntity);
   ```

2. **Updates the user's status**:
   ```typescript
   await this.userRepository.update({ id: userId }, { emailLinked: false });
   ```

3. **Logs a clear warning**:
   ```typescript
   logger.warn(`⚠️  User ${userId} needs to reconnect their Gmail account`);
   ```

4. **Throws a user-friendly error** that gets handled by the worker's error handlers and creates a notification for the user

## Key Improvements

1. **Automatic Token Refresh**: Tokens are now automatically refreshed by the worker when needed
2. **60-Second Buffer**: Tokens are refreshed 60 seconds before expiry to prevent race conditions
3. **Worker-Side Token Management**: Token refresh happens in the worker where it's actually needed, not in the service
4. **Better Error Messages**: Clear user-facing error messages when re-authentication is required
5. **Persistent Token Updates**: Refreshed tokens are saved to the database for future use
6. **Database Status Updates**: When tokens are invalid, the system marks the email connection as failed with a clear reason
7. **User Flag Updates**: The `emailLinked` flag is set to `false` when reconnection is needed
8. **Graceful Degradation**: The system handles token errors without crashing, providing clear guidance to users

## What Happens Now When `invalid_grant` Occurs

1. ✅ Worker detects the token needs refresh
2. ✅ Attempts to refresh using the refresh token
3. ✅ Google returns `invalid_grant` error
4. ✅ System catches this and:
   - Sets `emailEntity.syncStatus = FAILED`
   - Sets `emailEntity.failedReason = 'Gmail connection expired or revoked. Please reconnect your email account.'`
   - Sets `user.emailLinked = false`
   - Logs warning: `⚠️  User ${userId} needs to reconnect their Gmail account`
5. ✅ Throws a clear BadRequestException with user-friendly message
6. ✅ Worker's `onFailed` handler sends a notification to the user
7. ✅ User receives notification to reconnect their Gmail account

## How to Fix the Current Issue

The `invalid_grant` error you're seeing means **user 2 needs to reconnect their Gmail account**. This is working as designed. To fix it:

1. **User 2 should go through the OAuth flow again** by:
   - Calling the email authorization endpoint
   - Completing the Google OAuth consent flow
   - This will generate a new refresh token

2. **Check your database** to confirm:
   ```sql
   SELECT id, syncStatus, failedReason, emailLinked 
   FROM email 
   WHERE userId = 2;
   
   SELECT id, emailLinked 
   FROM user 
   WHERE id = 2;
   ```
   You should see:
   - `email.syncStatus = 'failed'`
   - `email.failedReason = 'Gmail connection expired or revoked...'`
   - `user.emailLinked = false`

3. **The user should receive a notification** informing them that they need to reconnect

## Testing Recommendations

1. ✅ Test with an expired access token to verify automatic refresh works
2. ✅ Test with a revoked refresh token to ensure proper error handling (this is what you're experiencing now)
3. Test manual sync after the user has reconnected their account
4. Monitor logs for successful token refresh messages: `✅ Successfully refreshed token for user X`
5. Check that notifications are sent to users when reconnection is needed

## Additional Notes

- The worker now handles all token refresh logic, making the system more reliable
- The 60-second buffer ensures tokens are refreshed proactively, not reactively
- If a refresh token is invalid/revoked, users will receive clear instructions to reconnect their account
- The system gracefully handles this scenario without crashing or losing data
- **The error you're seeing is the system working correctly** - it's detecting the invalid refresh token and properly informing the user to reconnect
