from database import get_connection

connection = get_connection()
cursor = connection.cursor()

cursor.execute("""
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
""")

for row in cursor.fetchall():
    print(row[0])

cursor.close()
connection.close()