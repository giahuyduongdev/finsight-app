# Unit Tests

## Overview

This directory contains unit tests for the backend services using mock repositories.

## Structure

```
__tests__/
├── mocks/                          # Mock implementations
│   ├── user-repository.mock.ts
│   ├── refresh-token-repository.mock.ts
│   ├── transaction-repository.mock.ts
│   └── import-batch-repository.mock.ts
├── setup/                          # Test setup utilities
│   └── test-helpers.ts            # Helper functions for tests
├── unit/                           # Unit tests (with mocks)
│   ├── user.service.test.ts
│   └── transaction.service.test.ts
└── README.md
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

## Test Types

### Unit Tests (`__tests__/unit/`)

- **Purpose**: Test individual services in isolation
- **Speed**: ⚡ Very fast (~6-7 seconds)
- **Database**: Uses mock repositories (in-memory)
- **When to use**: During development, TDD, CI/CD

**Example**:

```typescript
describe('UserService', () => {
  let service: UserService
  let mockRepo: MockUserRepository

  beforeEach(() => {
    mockRepo = new MockUserRepository()
    service = new UserService(mockRepo)
  })

  it('should find user by id', async () => {
    const user = await mockRepo.create({ ... })
    const result = await service.findById(user._id)
    expect(result).toBeDefined()
  })
})
```

## Test Coverage

### UserService Tests (11 tests)

- ✅ `findById()` - Returns user without password when exists
- ✅ `findById()` - Returns null when user doesn't exist
- ✅ `findByEmail()` - Returns user without password when exists
- ✅ `findByEmail()` - Returns null when user doesn't exist
- ✅ `update()` - Updates user profile successfully
- ✅ `update()` - Updates profile picture when provided
- ✅ `update()` - Throws NotFoundException when user doesn't exist
- ✅ `changePassword()` - Changes password with correct current password
- ✅ `changePassword()` - Throws UnauthorizedException with incorrect password
- ✅ `changePassword()` - Throws NotFoundException when user doesn't exist
- ✅ `changePassword()` - Hashes password before storing
- ✅ `changePassword()` - Deletes all refresh tokens (logout all devices)

### TransactionService Tests (13 tests)

- ✅ `create()` - Creates transaction successfully
- ✅ `create()` - Creates recurring transaction with nextRecurringDate
- ✅ `findByUserId()` - Returns paginated transactions
- ✅ `findByUserId()` - Filters by keyword
- ✅ `findByUserId()` - Filters by type
- ✅ `findById()` - Returns transaction when exists
- ✅ `findById()` - Throws NotFoundException when not found
- ✅ `findChildTransactions()` - Returns paginated child transactions
- ✅ `duplicate()` - Duplicates transaction successfully
- ✅ `update()` - Updates transaction successfully
- ✅ `deleteById()` - Deletes transaction successfully
- ✅ `bulkDelete()` - Deletes multiple transactions
- ✅ `bulkImport()` - Imports multiple transactions

## Mock Repositories

### MockUserRepository

In-memory implementation of `IUserRepository` for testing:

- Stores users in a Map
- Implements all interface methods
- Provides test helper methods: `clear()`, `getAll()`, `seed()`

### MockRefreshTokenRepository

In-memory implementation of `IRefreshTokenRepository` for testing:

- Stores tokens in a Map
- Implements all interface methods
- Provides test helper methods: `clear()`, `getAll()`, `countByUserId()`

## Writing New Tests

### Example Test Structure

```typescript
import { YourService } from '../../services/your.service'
import { MockYourRepository } from '../mocks/your-repository.mock'

describe('YourService', () => {
  let service: YourService
  let mockRepo: MockYourRepository

  beforeEach(() => {
    mockRepo = new MockYourRepository()
    service = new YourService(mockRepo)
  })

  afterEach(() => {
    mockRepo.clear()
  })

  describe('yourMethod', () => {
    it('should do something', async () => {
      // Arrange
      const mockData = await mockRepo.create({ ... })

      // Act
      const result = await service.yourMethod(mockData._id)

      // Assert
      expect(result).toBeDefined()
      expect(result.property).toBe('expected value')
    })
  })
})
```

## Benefits of Mock Repositories

1. **Fast**: No database connection required
2. **Isolated**: Tests don't affect each other
3. **Predictable**: Full control over test data
4. **Easy to Debug**: Simple in-memory implementation
5. **True Unit Tests**: Tests business logic only

## Next Steps

1. Run existing tests to verify setup: `npm test`
2. Add tests for other services as they are migrated (ReportService, AnalyticsService)
3. Aim for 80%+ code coverage on business logic
4. Consider adding integration tests in the future when needed
