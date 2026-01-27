#!/bin/bash
# Aneldida.com Server Setup Script
# Run on fresh Ubuntu 22.04 server

set -e

echo "🚀 Starting Aneldida.com server setup..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Update system
echo -e "${BLUE}[1/8] Updating system...${NC}"
apt-get update -qq
apt-get upgrade -y -qq

# Step 2: Install Node.js 18
echo -e "${BLUE}[2/8] Installing Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null
apt-get install -y nodejs > /dev/null

# Step 3: Install pnpm
echo -e "${BLUE}[3/8] Installing pnpm...${NC}"
npm install -g pnpm > /dev/null

# Step 4: Verify Docker is installed (should come with marketplace image)
echo -e "${BLUE}[4/8] Verifying Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh > /dev/null
fi
apt-get install -y docker-compose-plugin > /dev/null

# Step 5: Create deploy user
echo -e "${BLUE}[5/8] Creating deploy user...${NC}"
if ! id -u deploy &> /dev/null; then
    useradd -m -s /bin/bash deploy
    usermod -aG sudo,docker deploy
    echo "deploy ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/deploy
fi

# Step 6: Setup SSH for deploy user
echo -e "${BLUE}[6/8] Setting up SSH for deploy user...${NC}"
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Step 7: Create project directories
echo -e "${BLUE}[7/8] Creating project directories...${NC}"
mkdir -p /opt/mdclodging
mkdir -p /backups
chown -R deploy:deploy /opt/mdclodging /backups

# Step 8: Install useful tools
echo -e "${BLUE}[8/8] Installing utilities...${NC}"
apt-get install -y git curl wget nano htop certbot ufw postgresql-client > /dev/null

# Configure firewall
echo -e "${BLUE}Configuring firewall...${NC}"
ufw allow 22/tcp > /dev/null
ufw allow 80/tcp > /dev/null
ufw allow 443/tcp > /dev/null
echo "y" | ufw enable > /dev/null 2>&1 || true

echo ""
echo -e "${GREEN}✅ Server setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Exit this session: exit"
echo "2. Connect as deploy user: ssh -i ~/.ssh/aneldida_deploy deploy@161.35.134.50"
echo ""
echo "Versions installed:"
echo "  - Node.js: $(node --version)"
echo "  - npm: $(npm --version)"
echo "  - pnpm: $(pnpm --version)"
echo "  - Docker: $(docker --version)"
echo "  - PostgreSQL client: $(psql --version)"
echo ""
