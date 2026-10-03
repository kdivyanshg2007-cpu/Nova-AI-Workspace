from database import get_connection


def create_content_outputs_table():
    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS content_outputs (
                id SERIAL PRIMARY KEY,

                user_id INTEGER NOT NULL
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                workspace_id INTEGER NOT NULL
                    REFERENCES workspaces(id)
                    ON DELETE CASCADE,

                content_type VARCHAR(50) NOT NULL,

                filename VARCHAR(255) NOT NULL,

                file_path TEXT NOT NULL,

                mime_type VARCHAR(150) NOT NULL,

                file_size BIGINT NOT NULL DEFAULT 0,

                version INTEGER NOT NULL DEFAULT 1,

                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_content_outputs_workspace
            ON content_outputs(workspace_id);
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_content_outputs_user_workspace
            ON content_outputs(user_id, workspace_id);
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_content_outputs_created_at
            ON content_outputs(created_at DESC);
            """
        )

        connection.commit()

        print(
            "CONTENT OUTPUTS TABLE CREATED SUCCESSFULLY."
        )
        print(
            "Table: content_outputs"
        )
        print(
            "Indexes: workspace, user+workspace, created_at"
        )

    except Exception as error:
        connection.rollback()

        print(
            "CONTENT OUTPUTS TABLE ERROR:",
            repr(error),
        )

        raise

    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    create_content_outputs_table()
