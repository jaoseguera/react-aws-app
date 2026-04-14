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
    console.log('Raw event:', JSON.stringify(event));

    // Cognito inserts the connected user's sub via JWT
    const userSub = event.requestContext.authorizer.jwt.claims.sub;

    if(!userSub) {
        return {
            statusCode: 401,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Unauthorized' }),
        };
    }

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

        const result = await dbClient.query('SELECT rights FROM user_rights WHERE user_sub = $1', [userSub]);

        await dbClient.end();

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ rights: result.rows[0] ? result.rows[0].rights : [] }),
        };

    } catch (err) {
        console.error('DB Error:', err);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Internal Server Error' }),
        };
    }

}