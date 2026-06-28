# User Lookup Architecture

## Hash Strategy

### 1. Bloom Filter (Redis Bitmap)

Purpose: Quickly filter requests that definitely do not exist.

``` text
index = CRC32(normalize(email)) % BITMAP_SIZE
```

-   Store with `SETBIT`
-   Query with `GETBIT`
-   `BIT = 0` → Definitely does not exist.
-   `BIT = 1` → Might exist, continue checking Redis.

------------------------------------------------------------------------

### 2. Redis Cache

Purpose: Cache existing users and negative lookups.

``` text
user key = user:{SHA256(normalize(email))}
negative key = nf:{SHA256(normalize(email))}
```

Example:

``` text
user:8f3e2d...
nf:8f3e2d...
```

------------------------------------------------------------------------

## Register Flow

``` text
Register
    │
    ▼
Normalize Email
    │
    ▼
GETBIT bloom_users index
```

### BIT = 0

``` text
Definitely new
    │
    ▼
INSERT Database
    │
    ▼
SET user:{sha256(email)} = userId
    │
    ▼
SETBIT bloom_users index 1
```

### BIT = 1

``` text
Maybe exists
    │
    ▼
GET user:{sha256(email)}
```

**Redis HIT**

``` text
→ Email already exists
```

**Redis MISS**

``` text
Check Database
```

Database Found

``` text
SET user:{sha256(email)}
→ Email already exists
```

Database Not Found

``` text
INSERT Database
SET user:{sha256(email)}
SETBIT bloom_users index 1
```

------------------------------------------------------------------------

## Forgot Password Flow

``` text
Forgot Password
      │
      ▼
Rate Limit
      │
      ▼
Normalize Email
      │
      ▼
GETBIT bloom_users index
```

### BIT = 0

``` text
Return:
"If the email exists, we have sent reset instructions."
```

(No Redis, No Database)

### BIT = 1

``` text
GET user:{sha256(email)}
```

Redis User HIT

``` text
Generate reset token
Push mail to queue
Return generic response
```

Redis User MISS

``` text
GET nf:{sha256(email)}
```

Negative Cache HIT

``` text
Return generic response
```

Negative Cache MISS

``` text
Check Database
```

Database Found

``` text
SET user:{sha256(email)}
Generate reset token
Push mail to queue
```

Database Not Found

``` text
SET nf:{sha256(email)} 1 EX 300
Return generic response
```

------------------------------------------------------------------------

## Login Flow

Bloom Filter is **not used**.

``` text
Login
   │
   ▼
Rate Limit
   │
   ▼
Normalize Email
   │
   ▼
GET user:{sha256(email)}
```

Redis HIT

``` text
Load cached user
Verify password
```

Redis MISS

``` text
Check Database
```

Database Found

``` text
SET user:{sha256(email)}
Verify password
```

Database Not Found

``` text
Return:
"Invalid email or password."
```

------------------------------------------------------------------------

## Redis Keys

### Existing User

``` text
user:{sha256(email)} -> userId
```

### Negative Cache

``` text
nf:{sha256(email)} -> 1
TTL: 5 minutes
```

------------------------------------------------------------------------

## Important Notes

-   CRC32 is used **only** for Redis Bitmap indexing.
-   SHA256 is used for Redis cache keys to avoid collisions.
-   The database remains the **source of truth**.
-   Never conclude a user exists only because the bitmap bit is `1`.

``` text
BIT = 0 -> Definitely not exists.
BIT = 1 -> Maybe exists -> Check Redis -> Check Database.
```
