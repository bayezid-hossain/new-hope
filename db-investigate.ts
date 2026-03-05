import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_KY8HnwlIt7Cb@ep-dark-shape-ahnyjoaj-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    console.log('--- RECENT SALES ---');
    const sales = await pool.query(`
        SELECT 
            se.id, 
            se.age as event_age,
            sr.age as report_age,
            se.sale_date,
            sr.created_at as report_created_at
        FROM sale_events se
        JOIN sale_reports sr ON sr.id = se.selected_report_id
        ORDER BY se.created_at DESC
        LIMIT 5
    `);
    console.table(sales.rows);
}

run().catch(console.error).finally(() => pool.end());
