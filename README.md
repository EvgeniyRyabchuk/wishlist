# Birthday Wishlist Platform

A platform for creating birthday wishlists where the birthday person can add items they want and guests can reserve items to purchase.

## Project Structure

```
wishlist/
├── client/                 # Frontend files (HTML, CSS, JS)
│   ├── index.html          # Main page
│   ├── script.js           # Client-side JavaScript
│   └── styles.css          # Stylesheet
└── server/                 # Backend files (Node.js, Express, PostgreSQL)
    ├── server.js           # Main server file
    ├── package.json        # Dependencies
    ├── .env                # Environment variables
    ├── config/             # Configuration files
    ├── database/           # Database connection
    ├── migrations/         # Database schema migrations
    ├── models/             # Database models
    └── API.md              # API documentation
```

## Features

- Create and manage birthday wishlists
- Extract product information from URLs using Puppeteer
- Allow guests to reserve items
- Track reservation status with unique colors per guest
- View statistics for each wishlist
- Modern UI with glassmorphism design

## Tech Stack

### Frontend
- HTML5
- CSS3 (with Tailwind CSS CDN)
- JavaScript (ES6+)

### Backend
- Node.js
- Express.js
- PostgreSQL
- Sequelize ORM
- Puppeteer (for product info extraction)
- Dotenv (for environment configuration)

## Database Schema

The application uses PostgreSQL with the following main entities:

- **Creators**: Information about the person creating the wishlist
- **Lists**: Individual wishlists created by creators
- **Guests**: People who reserve items from the wishlist
- **Goods**: Products/items in the wishlist that can be reserved

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (running locally or accessible remotely)

### Server Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your PostgreSQL database:
   - Create a database named `wishlist`
   - Update the `.env` file with your database credentials

4. Create a `.env` file in the server directory:
   ```
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_USER=evgenijrabcuk
   DB_PASSWORD=password
   DB_NAME=wishlist
   NODE_ENV=development
   PORT=3000
   ```

5. Run database migrations:
   ```bash
   npx sequelize db:migrate
   ```

6. Start the server:
   ```bash
   npm run dev
   ```

### Client Setup

The client is served by the Node.js server. Once the server is running, access the application at `http://localhost:3000`.

## API Documentation

For detailed API documentation, see [server/API.md](server/API.md).