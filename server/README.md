# Wishlist Platform Server

This is the server-side component of the birthday wishlist platform. It handles database operations, product information extraction, and API endpoints.

## Features

- Create and manage birthday wishlists
- Extract product information from URLs using Puppeteer
- Allow guests to reserve items
- Track reservation status with unique colors per guest
- View statistics for each wishlist

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- Sequelize ORM
- Puppeteer
- Dotenv for environment configuration

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (running locally or accessible remotely)

## Setup Instructions

1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Set up your PostgreSQL database:
   - Create a database named `wishlist`
   - Update the `.env` file with your database credentials

3. Create a `.env` file in the server directory with the following variables:
   ```
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_USER=evgenijrabcuk
   DB_PASSWORD=password
   DB_NAME=wishlist
   NODE_ENV=development
   PORT=3000
   ```

4. Run database migrations to create the necessary tables:
   ```bash
   npx sequelize db:migrate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`.

## API Documentation

For detailed API documentation, see [API.md](./API.md).

## Database Schema

The application uses PostgreSQL with the following main entities:

- **Creators**: Information about the person creating the wishlist
- **Lists**: Individual wishlists created by creators
- **Guests**: People who reserve items from the wishlist
- **Goods**: Products/items in the wishlist that can be reserved

## Migrations

Database schema changes are handled through Sequelize migrations. To create a new migration:

```bash
npx sequelize migration:generate --name "description-of-migration"
```

To run pending migrations:

```bash
npx sequelize db:migrate
```

To undo the last migration:

```bash
npx sequelize db:migrate:undo
```

## Project Structure

```
server/
├── .env                    # Environment variables
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies and scripts
├── server.js              # Main server file
├── config/                # Configuration files
│   └── config.js          # Database configuration
├── database/              # Database connection
│   └── db.js              # Database connection setup
├── migrations/            # Database migrations
│   └── *.js               # Migration files
├── models/                # Database models
│   ├── index.js           # Models index
│   ├── creator.js         # Creator model
│   ├── list.js            # List model
│   ├── guest.js           # Guest model
│   └── goods.js           # Goods model
└── API.md                 # API documentation
```

## Environment Variables

- `DB_HOST`: Database host (default: 127.0.0.1)
- `DB_PORT`: Database port (default: 5432)
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3000)