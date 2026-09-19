from email_validator import validate_email, EmailNotValidError

from auth import hash_password, verify_password
from database import get_connection
from jwt_utils import create_access_token


def signup_user(name: str, email: str, password: str):
    """Create a new user account."""

    name = name.strip()
    email = email.strip().lower()

    if not name:
        return {
            "success": False,
            "message": "Name is required.",
        }

    if len(name) > 100:
        return {
            "success": False,
            "message": "Name must be 100 characters or less.",
        }

    try:
        validated_email = validate_email(email)
        email = validated_email.email
    except EmailNotValidError as e:
        return {
            "success": False,
            "message": str(e),
        }

    if len(password) < 8:
        return {
            "success": False,
            "message": "Password must be at least 8 characters long.",
        }

    password_hash = hash_password(password)

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO users (name, email, password_hash)
            VALUES (%s, %s, %s)
            RETURNING id, name, email, created_at;
            """,
            (name, email, password_hash),
        )

        user = cursor.fetchone()
        connection.commit()

        return {
            "success": True,
            "user": {
                "id": user[0],
                "name": user[1],
                "email": user[2],
                "created_at": user[3],
            },
        }

    except Exception:
        connection.rollback()
        return {
            "success": False,
            "message": "Unable to create account. Please try again.",
        }

    finally:
        cursor.close()
        connection.close()


def login_user(email: str, password: str):
    """Authenticate an existing user and return a JWT token."""

    email = email.strip().lower()

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT id, name, email, password_hash
            FROM users
            WHERE email = %s;
            """,
            (email,),
        )

        user = cursor.fetchone()

        if not user:
            return {
                "success": False,
                "message": "Invalid email or password.",
            }

        user_id, name, user_email, password_hash = user

        if not verify_password(password, password_hash):
            return {
                "success": False,
                "message": "Invalid email or password.",
            }

        token = create_access_token({
            "user_id": user_id
        })

        return {
            "success": True,
            "token": token,
            "user": {
                "id": user_id,
                "name": name,
                "email": user_email,
            },
        }

    except Exception:
        return {
            "success": False,
            "message": "Login failed. Please try again.",
        }

    finally:
        cursor.close()
        connection.close()