# Receipt scan flow

```mermaid
flowchart TD
  A[User selects receipt image] --> B[Frontend sends FormData to POST /transactions/scan-receipt]
  B --> C[Backend receives file in memory via multer]
  C --> D[Validate file type and size]
  D --> E[Compress image with sharp<br/>resize width 1024, JPEG quality 80]
  E --> F[Compute SHA-256 imageHash<br/>from compressed image]
  F --> G[Build Redis cache key<br/>receipt:scan-cache:userId:imageHash]
  G --> H{Cache hit?}

  H -- Yes --> I[Return data.receipt immediately]
  I --> J[Frontend fills transaction form]
  J --> K[No queue, no Cloudinary upload,<br/>no Gemini call]

  H -- No --> L[Create jobId]
  L --> M[Return jobId to frontend immediately]
  M --> P[Frontend shows scanning progress<br/>up to 90 percent while waiting for socket]

  L --> N[Background task converts compressed image<br/>to base64 in memory]
  N --> O[Call Gemini through generateWithFallback<br/>with circuit breaker and model/key fallback]
  O --> Q{Gemini output valid receipt JSON?}

  Q -- No, not a receipt or invalid JSON --> R[Do not upload to Cloudinary]
  R --> S[Emit receipt:scan-failed via socket]
  S --> T[Frontend shows error and resets progress]

  Q -- Yes --> U[Build Cloudinary public_id<br/>receipts/userId/imageHash]
  U --> V{Cloudinary asset exists?}
  V -- Yes --> W[Reuse existing secure_url<br/>no upload_stream call]
  V -- No --> X[Upload compressed image<br/>overwrite false]
  X --> Y[Receive Cloudinary secure_url]
  W --> Z[Attach receiptUrl to extracted data]
  Y --> Z
  Z --> AA[Write Redis cache<br/>TTL = RECEIPT_SCAN_CACHE_TTL_SECONDS]
  AA --> AF[Emit receipt:scan-completed via socket]
  AF --> AG[Frontend fills transaction form]
  AG --> AH[User reviews and clicks Save]
  AH --> AI[Create transaction in MongoDB]
```

## Key points

- Redis cache stores only extracted receipt JSON and `receiptUrl`, not image bytes.
- New scans no longer put image bytes into BullMQ.
- The worker still supports older queued jobs that may have `fileBuffer` or `imageUrl`.
- Cache is scoped by `userId + imageHash`, so scan results are not shared across users.
- Non-receipt images fail fast through `receipt:scan-failed` instead of waiting through all retries.
- Gemini invalid JSON is treated as `NonReceiptImageError`, not as an unknown server failure.
- Non-receipt images are not uploaded to Cloudinary.
- Receipt images use deterministic Cloudinary `public_id`, so a repeated image reuses the old `secure_url` instead of uploading or overwriting.
- `RECEIPT_SCAN_CACHE_TTL_SECONDS` must be a positive integer; invalid values fall back to `86400`.
- Legacy worker retries keep `imageHash` after job data is compacted, so cache reuse still works after upload succeeds.
