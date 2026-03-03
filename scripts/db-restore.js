const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const backupDir = path.join(__dirname, '../database_backup');
const databaseUrl = process.env.DATABASE_URL;

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

const psqlPath = findPgTool('psql');
if (!psqlPath) {
    console.error('❌ psql not found. Please install PostgreSQL client tools or add them to your PATH.');
    process.exit(1);
}

const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
    .sort((a, b) => {
        // Sort by the sequence number in the filename
        const aNum = parseInt(a.split('_')[1]);
        const bNum = parseInt(b.split('_')[1]);
        return aNum - bNum;
    });

if (files.length === 0) {
    console.error('❌ No backup files found in database_backup directory.');
    process.exit(1);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const argIndex = process.argv[2];
let targetFile;

if (argIndex) {
    // If a number is provided, find the file with that sequence number
    targetFile = files.find(f => f.split('_')[1] === argIndex);
} else {
    // Default to the last one (latest)
    targetFile = files[files.length - 1];
}

if (!targetFile) {
    console.log('Available backups:');
    files.forEach(f => {
        const parts = f.split('_');
        console.log(`[${parts[1]}] ${f}`);
    });
    console.error(`❌ Backup number ${argIndex} not found.`);
    process.exit(1);
}

const filePath = path.join(backupDir, targetFile);

console.log(`\n📄 Backup selected: ${targetFile}`);
console.log(`⚠️  WARNING: This will replace the current data in the database with the content of the backup.`);

rl.question('Are you sure you want to proceed with the restore? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        try {
            // Step 1: Clear existing data to avoid duplicate key errors


            // Step 2: Restore data from backup
            console.log(`\n🚀 Restoring data from ${targetFile}...`);

            // Using --set ON_ERROR_STOP=1 to fail fast on errors
            execSync(`${psqlPath} --set ON_ERROR_STOP=0 -f "${filePath}" "${databaseUrl}"`, {
                stdio: 'inherit',
                env: process.env
            });

            // Step 3: Reset search_path (old backups may set it to empty, breaking Drizzle ORM)
            console.log('\n🔧 Resetting search_path...');
            execSync(`${psqlPath} -c "ALTER ROLE CURRENT_USER SET search_path TO public;" "${databaseUrl}"`, {
                stdio: 'inherit',
                env: process.env
            });

            console.log(`\n✅ Restore completed successfully!`);
        } catch (error) {
            console.error('\n❌ Restore failed:', error.message);
            if (error.message.includes('psql: command not found') || error.message.includes('is not recognized')) {
                console.error('💡 Tip: Make sure PostgreSQL client tools (psql) are installed and in your PATH.');
            }
        }
    } else {
        console.log('Restore cancelled.');
    }
    rl.close();
});
