from database import get_connection

connection = get_connection()
cursor = connection.cursor()

try:
    cursor.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'memories'
        ORDER BY ordinal_position;
    """)

    print("Memories table structure:")
    for column_name, data_type in cursor.fetchall():
        print(f"- {column_name}: {data_type}")

finally:
    cursor.close()
    connection.close()