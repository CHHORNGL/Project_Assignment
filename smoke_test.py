import os


def main():
    os.environ.setdefault("SECRET_KEY", "test-secret")
    os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

    from app import create_app

    app = create_app()
    if not app:
        raise RuntimeError("create_app() returned None")

    print("Smoke test passed: app created successfully.")


if __name__ == "__main__":
    main()
