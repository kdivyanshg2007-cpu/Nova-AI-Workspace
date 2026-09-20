from database import get_connection


def main():
    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            ALTER TABLE user_preferences
            ADD COLUMN IF NOT EXISTS tone VARCHAR(20)
            NOT NULL DEFAULT 'friendly';
            """
        )

        cursor.execute(
            """
            ALTER TABLE user_preferences
            ADD COLUMN IF NOT EXISTS response_length VARCHAR(20)
            NOT NULL DEFAULT 'balanced';
            """
        )

        connection.commit()

        print("Day 39 preferences migration completed successfully.")
        print("Added/verified: tone")
        print("Added/verified: response_length")

    except Exception as error:
        connection.rollback()
        print("Migration failed:", error)
        raise

    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    main()