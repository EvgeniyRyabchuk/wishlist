-- This script will be run during PostgreSQL initialization
-- It creates the wishlist_dev database

-- Create the wishlist_dev database
-- This will run only on the first initialization of the PostgreSQL container
CREATE DATABASE wishlist_dev WITH OWNER = postgres;