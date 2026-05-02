const fs = require('fs');
const initSqlJs = require('sql.js');

async function main() {
  const dbPath = 'C:/Users/otaku/AppData/Roaming/Hoard/hoard.db';
  const filebuffer = fs.readFileSync(dbPath);
  const SQL = await initSqlJs({
    locateFile: file => `node_modules/sql.js/dist/${file}`
  });
  const db = new SQL.Database(filebuffer);
  const stmt = db.prepare("SELECT id, type, title, url, image_path FROM items WHERE type = 'image' LIMIT 5");
  while (stmt.step()) {
    console.log(stmt.getAsObject());
  }
}
main();
