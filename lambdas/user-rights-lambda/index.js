const { Client } = require('pg');

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

        const result = await client.query('SELECT rights FROM user_rights WHERE user_sub = $1', [userSub]);

        await client.end();

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