#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 Setting up Finsight Backend configuration..."
echo ""

# Ask user which setup method they prefer
echo "Choose configuration setup method:"
echo "  1) All-in-one (.env only) - Recommended for simplicity"
echo "  2) Modular (separate db.conf, app.conf, app.keys)"
echo ""
read -p "Enter your choice (1 or 2): " -n 1 -r
echo ""

if [[ $REPLY == "1" ]]; then
    # All-in-one setup
    if [ -f ".env" ]; then
        echo -e "${YELLOW}⚠️  .env file already exists!${NC}"
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Setup cancelled."
            exit 0
        fi
    fi
    
    echo "📋 Copying .env.sample to .env..."
    cp samples/.env.sample .env
    
    echo ""
    echo -e "${GREEN}✅ Configuration file created successfully!${NC}"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Edit .env with your actual configuration values"
    
elif [[ $REPLY == "2" ]]; then
    # Modular setup
    FILES_EXIST=false
    
    if [ -f "db.conf" ] || [ -f "app.conf" ] || [ -f "app.keys" ]; then
        FILES_EXIST=true
        echo -e "${YELLOW}⚠️  Some configuration files already exist!${NC}"
        read -p "Do you want to overwrite them? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Setup cancelled."
            exit 0
        fi
    fi
    
    echo "📋 Copying configuration files..."
    cp samples/db.conf.sample db.conf
    cp samples/app.conf.sample app.conf
    cp samples/app.keys.sample app.keys
    
    echo ""
    echo -e "${GREEN}✅ Configuration files created successfully!${NC}"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Edit db.conf with your database settings"
    echo "   2. Edit app.conf with your application settings"
    echo "   3. Edit app.keys with your secrets and API keys"
    echo ""
    echo -e "${BLUE}ℹ️  Note: You'll need to merge these into .env or configure your app to read multiple files${NC}"
    
else
    echo "Invalid choice. Setup cancelled."
    exit 1
fi

echo ""
echo "🔐 Security reminders:"
echo "   • Generate strong JWT secrets using: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
echo "   • Never commit configuration files with real values to git"
echo "   • Use different secrets for development and production"
echo ""
