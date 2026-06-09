import sqlite3

conn = sqlite3.connect('./intheflow.db')
cur = conn.cursor()
cur.execute("UPDATE task SET archived = 0 WHERE name LIKE '%Reddit%' OR description LIKE '%Reddit%'")
print(f'Rows updated: {cur.rowcount}')
conn.commit()
conn.close()
