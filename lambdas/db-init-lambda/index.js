const { Client } = require('pg');

exports.handler = async (event) => {
    console.log('DB Initialization');

    const client = new Client({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        await client.query(`
            CREATE TABLE IF NOT EXISTS users_rights (
                id          SERIAL PRIMARY KEY,
                user_sub    VARCHAR(255) NOT NULL UNIQUE,
                rights     JSONB NOT NULL DEFAULT '[]',
                created_at  TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('Table users_rights created');

        await client.query(`
            INSERT INTO users_rights (user_sub, rights)
            VALUES ('test-user', '["read_reports", "view_dashboard"]')
            ON CONFLICT (user_sub) DO NOTHING
        `);
        console.log('Table users_rights populated');

        await client.end();
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Database initialized successfully' }),
        };

    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
};