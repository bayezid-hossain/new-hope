const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const backupDir = path.join(__dirname, '../database_backup');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env');
    process.exit(1);
}

function findPgTool(toolName) {
    try {
        execSync(`${toolName} --version`, { stdio: 'ignore' });
        return toolName;
    } catch (e) {
        const commonPaths = [
            `C:\\Program Files\\PostgreSQL\\17\\bin\\${toolName}.exe`,
            `C:\\Program Files\\PostgreSQL\\16\\bin\\${toolName}.exe`,
            `C:\\Program Files\\PostgreSQL\\15\\bin\\${toolName}.exe`,
            `C:\\Program Files\\PostgreSQL\\17\\pgAdmin 4\\runtime\\${toolName}.exe`
        ];
        for (const p of commonPaths) {
            if (fs.existsSync(p)) return `"${p}"`;
        }
        return null;
    }
}

const pgDumpPath = findPgTool('pg_dump');
if (!pgDumpPath) {
    console.error('❌ pg_dump not found. Please install PostgreSQL client tools or add them to your PATH.');
    process.exit(1);
}

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// Get existing backups to determine next sequence number
const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_') && f.endsWith('.sql'));
const nextNum = files.length + 1;
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
const fileName = `backup_${nextNum}_${timestamp}.sql`;
const filePath = path.join(backupDir, fileName);

console.log(`🚀 Starting backup to ${fileName}...`);

try {
    // pg_dump flags:
    // --clean --if-exists: Drop objects before creating them (handles FK dependency ordering)
    // --no-owner: Skip ownership commands (not needed for Neon.tech)
    // --no-privileges: Skip GRANT/REVOKE/ALTER DEFAULT PRIVILEGES (fail on Neon.tech)
    execSync(`${pgDumpPath} --clean --if-exists --no-owner --no-privileges "${databaseUrl}" > "${filePath}"`, { stdio: 'inherit' });

    // Post-process: fix search_path that pg_dump sets to empty (breaks Drizzle ORM)
    let sql = fs.readFileSync(filePath, 'utf-8');
    sql = sql.replace(
        "SELECT pg_catalog.set_config('search_path', '', false);",
        "SELECT pg_catalog.set_config('search_path', 'public', false);"
    );
    // Append search_path reset at end of dump to ensure it's always correct
    sql += "\n-- Fix search_path after restore\nSET search_path TO public;\nALTER ROLE CURRENT_USER SET search_path TO public;\n";
    fs.writeFileSync(filePath, sql, 'utf-8');

    console.log(`✅ Backup completed successfully: ${fileName}`);

    // Create a symlink or a reference for "latest" if needed, 
    // but the user wants by number, so naming it backup_N is good.
} catch (error) {
    console.error('❌ Backup failed:', error.message);
    if (error.message.includes('pg_dump: command not found') || error.message.includes('is not recognized')) {
        console.error('💡 Tip: Make sure PostgreSQL client tools (pg_dump) are installed and in your PATH.');
    }
    process.exit(1);
}
