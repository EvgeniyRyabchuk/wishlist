# Birthday Wishlist Platform

A birthday wishlist platform with product information extraction from various e-commerce websites.

## Features

- Create and share wishlists with friends and family
- Extract product information from URLs (supports multiple e-commerce platforms)
- Real-time collaboration with reservation system
- Multi-language support (English, Ukrainian, Russian, German)
- Responsive design with 3-column grid layout
- Docker deployment support
- Support for multiple e-commerce providers

## Supported E-commerce Platforms

- Rozetka.com.ua
- Prom.ua
- OLX.ua
- Amazon.com
- eBay.com
- BestBuy.com
- Target.com
- AliExpress.com
- Walmart.com
- Etsy.com
- Newegg.com
- Sephora.com
- Zalando.de
- MediaMarkt.de
- Saturn.de
- Apple.com
- Samsung.com
- MediaExpert.pl
- Morele.net
- X-kom.pl

## Installation

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Docker (optional, for containerized deployment)

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd wishlist/server
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start the server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Docker Deployment

1. Build and run with Docker Compose:
```bash
docker-compose up -d
```

The application will be available at `http://localhost:3000`

## API Endpoints

- `GET /health` - Health check
- `GET /puppeteer-status` - Puppeteer status check
- `POST /api/extract-product-info` - Extract product info from URL
- `POST /api/lists` - Create a new wishlist
- `GET /api/lists/:token` - Get a wishlist by share token
- `POST /api/goods` - Add a product to a wishlist
- `PUT /api/goods/:id/reserve` - Reserve a product
- `DELETE /api/goods/:id/reserve` - Unreserve a product
- `GET /api/lists/:token/stats` - Get wishlist statistics
- `GET /api/domains` - Get supported domains

## Architecture

- Frontend: HTML, CSS (Tailwind), JavaScript
- Backend: Node.js with Express
- Database: PostgreSQL with Sequelize ORM
- Web Scraping: Puppeteer for product information extraction
- Containerization: Docker and Docker Compose

## Configuration

The application supports the following environment variables:

- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `DB_HOST` - Database host
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `DB_PORT` - Database port

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License