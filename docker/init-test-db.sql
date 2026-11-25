-- Runs once when the Postgres container is first created: a separate database for tests,
-- so running the test suite never touches your development data.
CREATE DATABASE khidma_test;
