# B2B Buyer Portal Deployment Guide

## Production Server

- **Server:** uag-api-gateway.ytsys.net (3.141.19.134)
- **URL:** https://b2b-buyer-portal.ytsys.net/
- **Project Path:** `/var/www/b2b-buyer-portal`
- **Node Version:** 22 (managed via nvm)
- **Web Server:** nginx

## Deployment Steps

### 1. SSH into the server

```bash
ssh pshah@uag-api-gateway.ytsys.net
```

### 2. Pull latest changes

```bash
cd /var/www/b2b-buyer-portal
git pull origin main
```

### 3. Install dependencies (if package.json changed)

```bash
source ~/.nvm/nvm.sh && nvm use 22
yarn install
```

### 4. Build the project

```bash
# Remove old dist and caches
sudo rm -rf /var/www/b2b-buyer-portal/apps/storefront/dist
sudo rm -rf /var/www/b2b-buyer-portal/.turbo
sudo rm -rf /var/www/b2b-buyer-portal/node_modules/.cache

# Build
source ~/.nvm/nvm.sh && nvm use 22
yarn build

# Set permissions for nginx
sudo chown -R nginx:nginx /var/www/b2b-buyer-portal/apps/storefront/dist
```

### 5. Verify deployment

```bash
curl -I https://b2b-buyer-portal.ytsys.net/index.js
```

Should return HTTP 200.

## Environment Configuration

The production environment variables are in `/var/www/b2b-buyer-portal/apps/storefront/.env.production`:

```env
VITE_IS_LOCAL_ENVIRONMENT=FALSE
VITE_ASSETS_ABSOLUTE_PATH=https://b2b-buyer-portal.ytsys.net/
VITE_DISABLE_BUILD_HASH=TRUE
```

- `VITE_IS_LOCAL_ENVIRONMENT=FALSE` - Indicates production mode
- `VITE_ASSETS_ABSOLUTE_PATH` - Base URL for assets (with trailing slash)
- `VITE_DISABLE_BUILD_HASH=TRUE` - Removes hashes from filenames so Script Manager doesn't need updates

## Nginx Configuration

Located at `/etc/nginx/conf.d/b2b-buyer-portal.conf`:

```nginx
server {
    listen 80;
    server_name b2b-buyer-portal.ytsys.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name b2b-buyer-portal.ytsys.net;

    ssl_certificate /etc/letsencrypt/live/b2b-buyer-portal.ytsys.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/b2b-buyer-portal.ytsys.net/privkey.pem;

    root /var/www/b2b-buyer-portal/apps/storefront/dist;
    index index.html;

    # CORS headers for all responses
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Origin, Content-Type, Accept" always;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*" always;
    }

    location /chunks/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*" always;
    }

    location / {
        try_files $uri $uri/ =404;
        add_header Access-Control-Allow-Origin "*" always;
    }
}
```

To reload nginx after config changes:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## BigCommerce Script Manager

The buyer portal is loaded into BigCommerce via Script Manager scripts.

### Header Script (Location: Header, Pages: All Pages, Category: Essential)

```html
<script>
var b2bHideBodyStyle = document.createElement('style');
b2bHideBodyStyle.id = 'b2b-account-page-hide-body';
{{#if customer.id}}
  {{#contains page_type "account"}}
    b2bHideBodyStyle.innerHTML = 'body { display: none !important }';
    document.head.appendChild(b2bHideBodyStyle);
  {{/contains}}
{{/if}}
{{#if page_type "login"}}
  b2bHideBodyStyle.innerHTML = 'body { display: none !important }';
  document.head.appendChild(b2bHideBodyStyle);
{{/if}}
const removeCart = () => {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.id = 'b2bPermissions-cartElement-id'
  style.innerHTML='[href="/cart.php"], #form-action-addToCart, [data-button-type="add-cart"], .button--cardAdd, .card-figcaption-button, [data-emthemesmodez-cart-item-add], .add-to-cart-button { display: none !important }'
  document.getElementsByTagName('head').item(0).appendChild(style);
}
removeCart()
</script>
```

### Footer Script (Location: Footer, Pages: All Pages, Category: Essential)

```html
<script>
  window.b3CheckoutConfig = {
    routes: {
      dashboard: '/account.php?action=order_status',
    },
  }
  window.B3 = {
    setting: {
      store_hash: '{{settings.store_hash}}',
      channel_id: {{settings.channel_id}},
      platform: 'bigcommerce'
    },
    'dom.checkoutRegisterParentElement': '#checkout-app',
    'dom.registerElement':
      '[href^="/login.php"], #checkout-customer-login, [href="/login.php"] .navUser-item-loginLabel, #checkout-customer-returning .form-legend-container [href="#"]',
    'dom.openB3Checkout': 'checkout-customer-continue',
    before_login_goto_page: '/account.php?action=order_status',
    checkout_super_clear_session: 'true',
    'dom.navUserLoginElement': '.navUser-item.navUser-item--account',
  }
</script>
<script type="module" crossorigin="" src="https://b2b-buyer-portal.ytsys.net/index.js"></script>
<script nomodule="" crossorigin="" src="https://b2b-buyer-portal.ytsys.net/polyfills-legacy.js"></script>
<script nomodule="" crossorigin="" src="https://b2b-buyer-portal.ytsys.net/index-legacy.js"></script>
```

## Troubleshooting

### CORS Errors
If you see CORS errors in the browser console, verify nginx has the `Access-Control-Allow-Origin` headers configured and reload nginx.

### 403 Forbidden
Check file permissions:
```bash
sudo chown -R nginx:nginx /var/www/b2b-buyer-portal/apps/storefront/dist
```

### Build fails with permission errors
Clear dist folder with sudo before rebuilding:
```bash
sudo rm -rf /var/www/b2b-buyer-portal/apps/storefront/dist
```

### Changes not reflecting
Clear turbo cache:
```bash
sudo rm -rf /var/www/b2b-buyer-portal/.turbo
sudo rm -rf /var/www/b2b-buyer-portal/node_modules/.cache
```
