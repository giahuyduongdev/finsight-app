# 🚀 Finsight Backend

Backend API for Finsight - Personal Finance Management Application

## 📋 Prerequisites

- Node.js >= 18.x
- MongoDB >= 6.x
- Redis >= 7.x
- npm or yarn

## 🔧 Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Setup configuration:**

   ```bash
   # From the backend directory
   cd backend

   # Option 1: Use setup script
   chmod +x scripts/setup.sh
   ./scripts/setup.sh

   # Option 2: Manual setup
   cp samples/.env.sample .env
   ```

3. **Update configuration:**
   Edit `.env` file with your actual values:
   - Database connection strings
   - JWT secrets (generate using: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
   - API keys for third-party services

## 📝 Git Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/) specification, enforced by **commitlint**.

### Commit Message Format:

```
<type>: <description>

[optional body]

[optional footer]
```

### Valid Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Maintenance tasks
- `revert`: Revert previous commit

### Examples:

```bash
git commit -m "feat: add user authentication"
git commit -m "fix: resolve login timeout"
git commit -m "docs: update API documentation"
```

### Configuration:

- Commitlint config: `../commitlint.config.js`
- Commit hook: `../.husky/commit-msg`

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Run Tests

```bash
npm test
```

### Run Linter

```bash
npm run lint
```

## 📁 Project Structure

```
backend/
├── samples/              # Configuration samples
│   ├── .env.sample
│   └── README.md
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── middlewares/     # Express middlewares
│   ├── utils/           # Utility functions
│   ├── queues/          # BullMQ queues
│   ├── workers/         # Background workers
│   └── app.ts           # Express app setup
├── logs/                # Application logs
└── index.ts             # Entry point
```

## 🔐 Environment Variables

See `samples/.env.sample` for all available configuration options.

### Required Variables:

- `NODE_ENV` - Application environment
- `PORT` - Server port
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - Refresh token secret
- `ENCRYPTION_SECRET` - Data encryption key
- `FRONTEND_ORIGIN` - CORS origin

### Optional Services:

- Gemini AI (receipt OCR)
- Cloudinary (image storage)
- Resend (email notifications)
- Auth0 (OAuth authentication)

## 📚 API Documentation

API documentation is available at `/api/v1/docs` when running in development mode.

## 🛠️ Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 🐛 Debugging

View logs in the `logs/` directory:

- `combined-*.log` - All logs
- `error-*.log` - Error logs only

## 📊 Queue Dashboard

BullMQ dashboard available at: `http://localhost:5000/admin/queues`

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linter
4. Submit a pull request

## 📄 License

MIT
