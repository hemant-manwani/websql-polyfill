const initSqlJs = require('sql.js');
const localforage = require('localforage');

(function() {
    if (window.openDatabase) {
        return;
    }

    let SQL;
    let dbInstances = {};

    function initSql(callback) {
        if (SQL) {
            callback();
        } else {
            initSqlJs({ locateFile: (file) => `${(window.location.pathname || '').replace('install', "Projects")}/js/websql-polyfill/${file}` }).then(sqlJs => {
                SQL = sqlJs;
                callback();
            });
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
                ready: false
            };

            dbInstances[name] = dbInfo;

            initSql(() => {
                storage.getItem('database').then(savedDbData => {
                    if (savedDbData) {
                        dbInfo.db = new SQL.Database(new Uint8Array(savedDbData));
                    } else {
                        dbInfo.db = new SQL.Database();
                    }

                    setInterval(() => {
                        const data = dbInfo.db.export();
                        storage.setItem('database', data);
                    }, 60000);

                    dbInfo.ready = true;
                    if (creationCallback) {
                        creationCallback(dbInfo);
                    }
                });
            });
        }

        return {
          transaction: function(callback, errorCallback, successCallback) {
              const runTransaction = async () => {
                  const tx = new SQLTransaction(dbInstances[name].db);
                  try {
                      await callback(tx);
                      await tx.executeQueue();
                      if (successCallback) successCallback();
                  } catch (e) {
                      if (errorCallback) errorCallback(e);
                  }
              };
  
              if (dbInstances[name].ready) {
                  runTransaction();
              } else {
                  const checkReady = setInterval(() => {
                      if (dbInstances[name].ready) {
                          clearInterval(checkReady);
                          runTransaction();
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