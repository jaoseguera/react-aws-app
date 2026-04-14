const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
let cachedSecret = null;

const getSecret = async () => {
    if (cachedSecret) {
        return cachedSecret;
    }

    const response = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: process.env.SECRET_ARN })
    );
    
    cachedSecret = JSON.parse(response.SecretString);
    return cachedSecret;
}

exports.handler = async (event) => {
    console.log('DB Initialization');

    const secret = await getSecret();

    const dbClient = new Client({
        host: secret.host,
        database: secret.dbname,
        user: secret.username,
        password: secret.password,
        port: secret.port,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await dbClient.connect();
        console.log('Connected to database');

        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS user_rights (
                id          SERIAL PRIMARY KEY,
                user_sub    VARCHAR(255) NOT NULL UNIQUE,
                rights     JSONB NOT NULL DEFAULT '[]',
                created_at  TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('Table user_rights created');

        await dbClient.query(`
            INSERT INTO user_rights (user_sub, rights)
            VALUES ('test-user', '["read_reports", "view_dashboard"]')
            ON CONFLICT (user_sub) DO NOTHING
        `);
        console.log('Table user_rights populated');

        await dbClient.end();
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Database initialized successfully' }),
        };

    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
};