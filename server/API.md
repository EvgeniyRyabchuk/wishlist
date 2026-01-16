# Wishlist Platform API Documentation

## Overview
This document describes the API endpoints for the birthday wishlist platform. The platform allows users to create wishlists, add products, and allow others to reserve items.

## Base URL
`http://localhost:3000` (during development)

## Authentication
Currently, the API uses token-based sharing via unique list tokens. Each list has a share token that allows access to the list.

## Database Schema
The application uses PostgreSQL with the following main entities:

### Creators
- `id`: Integer (Primary Key, Auto Increment)
- `name`: String (Not Null)
- `email`: String (Optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### Lists
- `id`: Integer (Primary Key, Auto Increment)
- `title`: String (Not Null)
- `description`: Text (Optional)
- `creatorId`: Integer (Foreign Key to Creators, Not Null)
- `shareToken`: String (Unique, Not Null)
- `isActive`: Boolean (Default: true)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### Guests
- `id`: Integer (Primary Key, Auto Increment)
- `name`: String (Not Null)
- `email`: String (Optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### Goods
- `id`: Integer (Primary Key, Auto Increment)
- `name`: String (Not Null)
- `description`: Text (Optional)
- `price`: Decimal(10,2) (Optional)
- `imageUrl`: String (Optional)
- `url`: String (Not Null)
- `listId`: Integer (Foreign Key to Lists, Not Null)
- `reservedBy`: Integer (Foreign Key to Guests, Optional)
- `reservationDate`: DateTime (Optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime

## API Endpoints

### Lists

#### GET `/api/lists/:token`
Get a list by its share token.

**Response:**
```json
{
  "id": 1,
  "title": "My Birthday Wishlist",
  "description": "Items I'd love for my birthday!",
  "creator": {
    "name": "John Doe"
  },
  "goods": [
    {
      "id": 1,
      "name": "iPhone 15",
      "description": "Latest iPhone model",
      "price": "999.99",
      "imageUrl": "https://example.com/image.jpg",
      "url": "https://shop.example.com/iphone15",
      "reservedByGuest": {
        "id": 1,
        "name": "Jane Smith"
      },
      "reservationDate": "2023-10-15T10:30:00Z"
    }
  ]
}
```

#### POST `/api/lists`
Create a new wishlist.

**Request Body:**
```json
{
  "title": "My Birthday Wishlist",
  "description": "Items I'd love for my birthday!",
  "creatorName": "John Doe",
  "creatorEmail": "john@example.com"
}
```

**Response:**
```json
{
  "id": 1,
  "title": "My Birthday Wishlist",
  "description": "Items I'd love for my birthday!",
  "creatorId": 1,
  "shareToken": "abc123def456",
  "message": "List created successfully"
}
```

### Goods

#### POST `/api/goods`
Add a product to a wishlist.

**Request Body:**
```json
{
  "listId": 1,
  "url": "https://shop.example.com/product-url"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "iPhone 15",
  "description": "Latest iPhone model",
  "price": "999.99",
  "imageUrl": "https://example.com/image.jpg",
  "url": "https://shop.example.com/iphone15",
  "listId": 1,
  "message": "Product added to wishlist successfully"
}
```

#### PUT `/api/goods/:id/reserve`
Reserve a product for a guest.

**Request Body:**
```json
{
  "guestName": "Jane Smith",
  "guestEmail": "jane@example.com"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "iPhone 15",
  "reservedByGuest": {
    "id": 1,
    "name": "Jane Smith"
  },
  "reservationDate": "2023-10-15T10:30:00Z",
  "message": "Product reserved successfully"
}
```

#### DELETE `/api/goods/:id/reserve`
Unreserve a product.

**Response:**
```json
{
  "id": 1,
  "name": "iPhone 15",
  "message": "Product reservation removed successfully"
}
```

### Statistics

#### GET `/api/lists/:token/stats`
Get statistics for a wishlist.

**Response:**
```json
{
  "totalItems": 5,
  "reservedItems": 2,
  "availableItems": 3,
  "totalBudget": "1249.95",
  "reservations": [
    {
      "guestName": "Jane Smith",
      "reservedCount": 1
    },
    {
      "guestName": "Bob Johnson",
      "reservedCount": 1
    }
  ]
}
```

## How to Use the Server

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL server running locally or remotely

### Setup Instructions

1. Clone the repository
2. Navigate to the server directory: `cd server`
3. Install dependencies: `npm install`
4. Create a PostgreSQL database named `wishlist`
5. Set up environment variables in `.env` file (see below)
6. Run database migrations: `npm run migrate`
7. Start the server: `npm run dev`

### Environment Variables
Create a `.env` file in the server directory with the following variables:

```
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=evgenijrabcuk
DB_PASSWORD=password
DB_NAME=wishlist
NODE_ENV=development
PORT=3000
```

### Database Migrations
To run database migrations:
```bash
npm run migrate
```

To undo the last migration:
```bash
npm run migrate:undo
```

## Development Notes
- The server uses Puppeteer to extract product information from URLs
- Supported sites include Rozetka, Prom.ua, OLX, and other popular e-commerce platforms
- The system generates unique share tokens for each list to enable secure sharing
- Guest names are stored to maintain consistent coloring for reservations