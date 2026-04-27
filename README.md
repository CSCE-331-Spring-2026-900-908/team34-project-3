# Brew 34

Simple point-of-sale app for Brew 34.

## Features

- Employee login using the 4-digit PIN stored in `employee.password`
- Menu grid backed by the existing `item` table
- Ingredient customization modal for add-ons
- Cart with item removal and total calculation
- Checkout flow that writes to `orders` and `orderitem`
- Inventory decrement for base drink ingredients and selected extra ingredients

