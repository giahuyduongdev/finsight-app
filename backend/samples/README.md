# 📁 Configuration Samples

This directory contains sample configuration files for the Finsight backend application.

## 🚀 Quick Setup

### Option 1: All-in-One (Recommended for simplicity)

Copy the single `.env.sample` file:

```bash
# From the backend directory
cp samples/.env.sample .env
```

### Option 2: Modular Configuration (Recommended for organization)

Copy individual configuration files:

```bash
# From the backend directory
cp samples/db.conf.sample db.conf
cp samples/app.conf.sample app.conf
cp samples/app.keys.sample app.keys
```

Then merge them into a single `.env` file, or configure your app to read multiple config files.

## 📋 Configuration Files

### `.env.sample`

**All-in-one configuration file** containing everything you need:

- Application settings (port, environment)
- Database connection (MongoDB, Redis)
- Authentication (JWT, Auth0)
- Third-party services (Cloudinary, Resend, Gemini AI)
- CORS settings

### `db.conf.sample`

**Database configuration only:**

- MongoDB connection and pool settings
- Redis configuration (local and cloud)
- Memory management settings

### `app.conf.sample`

**Application settings only:**

- Server port and base path
- Environment (development/production)
- CORS origins
- External API URLs

### `app.keys.sample`

**Secrets and API keys only:**

- JWT secrets and expiration
- Encryption keys
- Third-party API keys (Gemini, Cloudinary, Resend, Auth0)

## 🔐 Security Notes

⚠️ **Never commit actual configuration files to git!**

The following files should remain in `.gitignore`:

- `.env` (all-in-one config)
- `db.conf` (database config)
- `app.conf` (app settings)
- `app.keys` (secrets and API keys)

### Security Best Practices:

1. **Generate Strong Secrets:**

   ```bash
   # Generate JWT secrets
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

   # Generate 32-char encryption key
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```

2. **Never use default values in production**
3. **Rotate secrets regularly**
4. **Use environment-specific secrets** (dev, staging, prod)
5. **Store production secrets in secure vault** (AWS Secrets Manager, HashiCorp Vault, etc.)

## 📝 Required Configuration

### Minimum Required Variables:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/finsight
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
ENCRYPTION_SECRET=your-encryption-key
FRONTEND_ORIGIN=http://localhost:5173
```

### Optional Services:

- **Gemini AI**: For receipt OCR and AI features
- **Cloudinary**: For image storage
- **Resend**: For email notifications
- **Auth0**: For OAuth authentication
- **Upstash Redis**: For cloud Redis (alternative to local Redis)

## 🛠️ Setup Script

You can also use the interactive setup script:

```bash
# From the backend directory
cd backend
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The script will ask you to choose between:

1. **All-in-one setup** - Creates single `.env` file
2. **Modular setup** - Creates separate `db.conf`, `app.conf`, `app.keys` files

## 📚 Documentation

For more details on each configuration option, see the main project documentation.
