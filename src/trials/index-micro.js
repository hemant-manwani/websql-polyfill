const initSqlJs = require('sql.js');
const localforage = require('localforage');

(function() {
    if (window.openDatabase) {
        return;
    }

    let SQL;
    let dbInstances = {};

    async function initSql() {
        if (!SQL) {
            // SQL = await initSqlJs({ locateFile: (file) => `${(window.location.pathname || '').replace('install', "Projects")}/js/websql-polyfill/${file}` });
            SQL = await initSqlJs({ locateFile: (file) => file });
        }
    }

    window.openDatabase = function(name, version, displayName, estimatedSize, creationCallback) {
        if (!dbInstances[name]) {
            const storage = localforage.createInstance({
                name: `${name}_sqljs`
            });

            const dbInfo = {
                name: name,
                version: version,
                displayName: displayName,
                estimatedSize: estimatedSize,
                db: null,
                storage: storage,
                ready: false,
                saveTimeout: null
            };

            dbInstances[name] = dbInfo;

            (async () => {
                await initSql();
                try {
                    const savedDbData = await storage.getItem('database');
                    if (savedDbData) {
                        dbInfo.db = new SQL.Database(new Uint8Array(savedDbData));
                    } else {
                        dbInfo.db = new SQL.Database();
                    }

                    const saveDatabase = async () => {
                        const data = dbInfo.db.export();
                        await storage.setItem('database', data);
                    };

                    // Debounced save
                    const debouncedSave = () => {
                        if (dbInfo.saveTimeout) {
                            clearTimeout(dbInfo.saveTimeout);
                        }
                        dbInfo.saveTimeout = setTimeout(saveDatabase, 5000);
                    };

                    dbInfo.ready = true;
                    if (creationCallback) {
                        creationCallback(dbInfo);
                    }
                } catch (error) {
                    console.error('Error initializing database:', error);
                }
            })();
        }

        return {
            transaction: function(callback, errorCallback, successCallback) {
                const runTransaction = async () => {
                    const tx = new SQLTransaction(dbInstances[name].db);
                    try {
                        await callback(tx);
                        await tx.executeQueue();
                        if (successCallback) queueMicrotask(() => successCallback());
                        debouncedSave();
                    } catch (e) {
                        if (errorCallback) queueMicrotask(() => errorCallback(e));
                    }
                };

                if (dbInstances[name].ready) {
                    queueMicrotask(runTransaction);
                } else {
                    const checkReady = setInterval(() => {
                        if (dbInstances[name].ready) {
                            clearInterval(checkReady);
                            queueMicrotask(runTransaction);
                        }
                    }, 50);
                }
            },
            readTransaction: function(callback, errorCallback, successCallback) {
                this.transaction(callback, errorCallback, successCallback);
            },
            changeVersion: function(oldVersion, newVersion, callback, errorCallback, successCallback) {
                if (dbInstances[name].version !== oldVersion) {
                    if (errorCallback) errorCallback(new Error("Version mismatch"));
                    return;
                }
                this.transaction(tx => {
                    callback(tx);
                    dbInstances[name].version = newVersion;
                }, errorCallback, successCallback);
            }
        };
    };

    class SQLTransaction {
        constructor(db) {
            this.db = db;
            this.queue = [];
        }

        executeSql(sqlStatement, args, callback, errorCallback) {
            this.queue.push({ sql: sqlStatement, args, callback, errorCallback });
        }

        async executeQueue() {
            for (const item of this.queue) {
                await new Promise(resolve => {
                    queueMicrotask(async () => {
                        try {
                            const stmt = this.db.prepare(item.sql);
                            let result = [];
                            if (item.args && item.args.length > 0) {
                                stmt.bind(item.args);
                            }
                            while (stmt.step()) {
                                result.push(stmt.getAsObject());
                            }
                            stmt.free();
                            const resultSet = new SQLResultSet(this.db, result, item.sql);
                            if (item.callback) await item.callback(this, resultSet);
                        } catch (e) {
                            if (item.errorCallback) {
                                await item.errorCallback(this, e);
                            } else {
                                throw e;
                            }
                        }
                        resolve();
                    });
                });
            }
            this.queue = [];
        }
    }

    class SQLResultSet {
        constructor(db, result, sql) {
            this.insertId = null;
            this.rowsAffected = 0;
            this.rows = {
                item: (i) => result[i] || null,
                length: result.length
            };

            if (sql.toUpperCase().startsWith('INSERT')) {
                this.insertId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
            }

            if (sql.toUpperCase().startsWith('UPDATE') || sql.toUpperCase().startsWith('DELETE')) {
                this.rowsAffected = db.getRowsModified();
            }
        }
    }
})();