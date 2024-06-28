import initSqlJs from 'sql.js';
import localforage from 'localforage';

let SQL;
let dbInstances = {};

async function initSql() {
    if (!SQL) {
        SQL = await initSqlJs({
            locateFile: file => `/${file}`
        });
    }
}

async function openDatabase(name, version, displayName, estimatedSize) {
    if (!dbInstances[name]) {
        const storage = localforage.createInstance({
            name: `${name}_sqljs`
        });

        await initSql();
        const savedDbData = await storage.getItem('database');
        const db = savedDbData ? new SQL.Database(new Uint8Array(savedDbData)) : new SQL.Database();

        dbInstances[name] = { db, storage, version };
    }
    return dbInstances[name];
}

async function saveDatabase(name) {
    const { db, storage } = dbInstances[name];
    const data = db.export();
    await storage.setItem('database', data);
}

self.onmessage = async function(e) {
    const { id, action, name, version, displayName, estimatedSize, sql, params } = e.data;
    
    try {
        let result;
        switch (action) {
            case 'open':
                await openDatabase(name, version, displayName, estimatedSize);
                result = { success: true };
                break;
            case 'execute':
                const { db } = await openDatabase(name);
                try {
                    const stmt = db.prepare(sql);
                    if (params) stmt.bind(params);
                    const rows = [];
                    while (stmt.step()) rows.push(stmt.getAsObject());
                    stmt.free();
                    result = { rows, insertId: null, rowsAffected: 0 };
                    if (sql.toUpperCase().startsWith('INSERT')) {
                        result.insertId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
                    }
                    if (sql.toUpperCase().startsWith('UPDATE') || sql.toUpperCase().startsWith('DELETE')) {
                        result.rowsAffected = db.getRowsModified();
                    }
                    await saveDatabase(name);
                } catch (sqlError) {
                    console.error('SQL Error:', sqlError.message);
                    throw new Error(`SQL Error: ${sqlError.message}`);
                }
                break;
        }
        self.postMessage({ id, result });
    } catch (error) {
        console.error('Worker Error:', error.message);
        self.postMessage({ id, error: error.message });
    }
};

export default self;