from db import engine
from sqlalchemy import inspect

inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"Tables found: {tables}")

if "users" in tables:
    columns = [c["name"] for c in inspector.get_columns("users")]
    print(f"Columns in 'users': {columns}")
else:
    print("CRITICAL: 'users' table not found!")
