# Boba POS

Simple point-of-sale app for a boba shop.

## Features

- Employee login using `employee.employee_id` and `employee.password`
- Menu grid backed by the existing `item` table
- Ingredient customization modal for add-ons
- Cart with item removal and total calculation
- Checkout flow that writes to `orders` and `orderitem`
- Inventory decrement for base drink ingredients and selected extra ingredients

## Run locally

1. Install dependencies:

   ```powershell
   npm install --ignore-scripts
   .\node_modules\.bin\prisma.cmd generate
   ```

2. Start the app:

   ```powershell
   npm run dev
   ```

3. Open `http://localhost:3000`

## Vercel env vars

Set these in Vercel:

- `DB_NAME`
- `DB_USER`
- `DB_DOMAIN`
- `DB_PASS`
- `SESSION_SECRET`

You can also provide `DATABASE_URL` directly if preferred.
